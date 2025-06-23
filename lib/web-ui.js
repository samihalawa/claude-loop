const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const chalk = require('chalk');
const crypto = require('crypto');

// JSON sanitization to prevent prototype pollution
function sanitizeJSON(obj, maxDepth = 10, currentDepth = 0) {
    if (currentDepth > maxDepth) {
        throw new Error('JSON object too deeply nested');
    }
    
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeJSON(item, maxDepth, currentDepth + 1));
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        // Prevent prototype pollution
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            continue;
        }
        sanitized[key] = sanitizeJSON(value, maxDepth, currentDepth + 1);
    }
    
    return sanitized;
}

class WebUI {
    constructor(port = parseInt(process.env.WEBUI_PORT) || 3333) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        
        // Enhanced WebSocket server configuration with security settings
        this.wss = new WebSocket.Server({ 
            server: this.server,
            maxConnections: parseInt(process.env.WEBUI_MAX_CONNECTIONS) || 5, // Reduced default limit
            perMessageDeflate: false, // Disable compression for better performance
            clientTracking: true, // Enable client tracking for better cleanup
            handshakeTimeout: 10000, // 10 second handshake timeout
            maxPayload: 16 * 1024 * 1024, // 16MB max payload size
            skipUTF8Validation: false // Enable UTF8 validation for security
        });
        
        this.clients = new Set();
        this.connectionCount = 0;
        this.maxConnections = parseInt(process.env.WEBUI_MAX_CONNECTIONS) || 5;
        this.sessionData = {
            iterations: 0,
            currentPhase: 'Starting...',
            output: [],
            startTime: Date.now(),
            isRunning: false
        };
        
        // Generate secure session token with higher entropy and expiration
        this.sessionToken = crypto.randomBytes(48).toString('hex');
        this.tokenExpiry = Date.now() + (parseInt(process.env.WEBUI_TOKEN_EXPIRY_HOURS) || 24) * 60 * 60 * 1000; // 24 hour default
        // Only show first 8 characters for security
        const maskedToken = this.sessionToken.substring(0, 8) + '...';
        console.log(chalk.cyan(`🔐 WebUI Access Token: ${maskedToken}`));
        console.log(chalk.gray('Add this token as ?token=<token> to the URL for access'));
        console.log(chalk.gray(`Token expires: ${new Date(this.tokenExpiry).toLocaleString()}`));
        console.log(chalk.yellow('⚠️  For security, full token is not displayed. Check environment or config for full token.'));
        
        // Enhanced rate limiting with memory management
        this.requestCounts = new Map();
        this.connectionAttempts = new Map(); // Track connection attempts per IP
        this.cleanupInterval = setInterval(() => {
            this.cleanupRateLimiting();
        }, 60000); // Reset counts every minute
        
        // Connection health monitoring
        this.pingInterval = setInterval(() => {
            this.pingClients();
        }, 30000); // Ping clients every 30 seconds
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }

    // Helper method to get client IP address
    getClientIP(req) {
        return req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
               req.ip ||
               'unknown';
    }

    // Helper method to track connection attempts
    trackConnectionAttempt(clientIP) {
        const now = Date.now();
        if (!this.connectionAttempts.has(clientIP)) {
            this.connectionAttempts.set(clientIP, []);
        }
        
        const attempts = this.connectionAttempts.get(clientIP);
        // Keep only attempts from last 5 minutes
        const recentAttempts = attempts.filter(time => now - time < 300000);
        recentAttempts.push(now);
        this.connectionAttempts.set(clientIP, recentAttempts);
        
        // Log if too many attempts
        if (recentAttempts.length > 10) {
            console.log(chalk.yellow(`🚨 Excessive connection attempts from ${clientIP}: ${recentAttempts.length} in 5 minutes`));
        }
    }

    // Helper method to clean up rate limiting data
    cleanupRateLimiting() {
        const now = Date.now();
        const windowStart = now - 60000; // 1 minute window
        
        // Clean up request counts
        for (const [ip, requests] of this.requestCounts.entries()) {
            const recentRequests = requests.filter(time => time > windowStart);
            if (recentRequests.length === 0) {
                this.requestCounts.delete(ip);
            } else {
                this.requestCounts.set(ip, recentRequests);
            }
        }
        
        // Clean up connection attempts (5 minute window)
        const connectionWindowStart = now - 300000;
        for (const [ip, attempts] of this.connectionAttempts.entries()) {
            const recentAttempts = attempts.filter(time => time > connectionWindowStart);
            if (recentAttempts.length === 0) {
                this.connectionAttempts.delete(ip);
            } else {
                this.connectionAttempts.set(ip, recentAttempts);
            }
        }
    }

    // Helper method to ping clients for connection health
    pingClients() {
        if (this.clients.size === 0) return;
        
        const deadClients = [];
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.ping();
                    // Check if client responded to last ping
                    if (Date.now() - client.lastPong > 60000) { // 1 minute timeout
                        console.log(chalk.yellow(`🔌 Client ${client.clientIP} appears unresponsive, closing connection`));
                        client.close(1000, 'Ping timeout');
                        deadClients.push(client);
                    }
                } catch (error) {
                    console.error(`Error pinging client ${client.clientIP}:`, error.message);
                    deadClients.push(client);
                }
            } else {
                deadClients.push(client);
            }
        });
        
        // Clean up dead connections
        deadClients.forEach(client => {
            this.clients.delete(client);
        });
        this.connectionCount = this.clients.size;
    }

    // Helper method to regenerate token
    regenerateToken() {
        this.sessionToken = crypto.randomBytes(32).toString('hex');
        this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now
        console.log(chalk.cyan(`🔐 New WebUI Access Token: ${this.sessionToken}`));
        console.log(chalk.gray(`Token expires: ${new Date(this.tokenExpiry).toLocaleString()}`));
    }

    // Helper method to safely send data to a client
    sendToClient(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                const message = JSON.stringify(data);
                ws.send(message);
            } catch (error) {
                console.error(`Error sending data to client ${ws.clientIP}:`, error.message);
                this.clients.delete(ws);
                this.connectionCount = this.clients.size;
            }
        }
    }

    // Helper method to handle WebSocket messages with rate limiting
    handleWebSocketMessage(ws, message) {
        const now = Date.now();
        
        // Rate limiting check
        if (now - ws.messageWindow > 60000) { // Reset window every minute
            ws.messageCount = 0;
            ws.messageWindow = now;
        }
        
        ws.messageCount++;
        const maxMessages = parseInt(process.env.WEBUI_MAX_WS_MESSAGES_PER_MINUTE) || 30;
        
        if (ws.messageCount > maxMessages) {
            console.log(chalk.yellow(`🚫 WebSocket message rate limit exceeded for ${ws.clientIP}`));
            ws.close(1008, 'Message rate limit exceeded');
            return;
        }
        
        try {
            const rawData = JSON.parse(message);
            const data = sanitizeJSON(rawData); // Sanitize to prevent prototype pollution
            // Handle specific message types here if needed
            console.log(chalk.gray(`📨 WebSocket message from ${ws.clientIP}:`, data.type || 'unknown'));
        } catch (error) {
            console.error(`Invalid WebSocket message from ${ws.clientIP}:`, error.message);
        }
    }

    setupMiddleware() {
        // Security headers middleware
        this.app.use((req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
            res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;");
            next();
        });

        // Enhanced rate limiting middleware with IP tracking
        this.app.use((req, res, next) => {
            const clientIP = this.getClientIP(req);
            const now = Date.now();
            const windowStart = now - 60000; // 1 minute window
            
            // Initialize IP tracking if not exists
            if (!this.requestCounts.has(clientIP)) {
                this.requestCounts.set(clientIP, []);
            }
            
            const requests = this.requestCounts.get(clientIP);
            // Remove old requests outside the window
            const recentRequests = requests.filter(time => time > windowStart);
            
            // Check rate limit (reduced for security)
            const maxRequests = parseInt(process.env.WEBUI_MAX_REQUESTS_PER_MINUTE) || 30;
            if (recentRequests.length >= maxRequests) {
                console.log(chalk.yellow(`🚫 Rate limit exceeded for IP: ${clientIP}`));
                res.status(429).json({ 
                    error: 'Rate limit exceeded',
                    retryAfter: 60,
                    limit: maxRequests
                });
                return;
            }
            
            recentRequests.push(now);
            this.requestCounts.set(clientIP, recentRequests);
            next();
        });

        // Enhanced token authentication with expiration check
        this.app.use((req, res, next) => {
            const token = req.query.token;
            
            // Check token expiration
            if (Date.now() > this.tokenExpiry) {
                console.log(chalk.red('🔒 Token has expired, generating new token'));
                this.regenerateToken();
                res.status(401).json({ 
                    error: 'Token expired', 
                    message: 'Check console for new token'
                });
                return;
            }
            
            // Validate token using timing-safe comparison
            if (!token || !this.timingSafeTokenCompare(token, this.sessionToken)) {
                const clientIP = this.getClientIP(req);
                console.log(chalk.yellow(`🚫 Invalid token attempt from IP: ${clientIP}`));
                res.status(401).json({ 
                    error: 'Invalid or missing token',
                    message: 'Add ?token=<your_token> to the URL'
                });
                return;
            }
            
            next();
        });
    }

    setupRoutes() {
        // Add security headers to all responses
        this.app.use((req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
            res.setHeader('Content-Security-Policy', 
                "default-src 'self'; " +
                "script-src 'self' 'unsafe-inline' cdn.jsdelivr.net cdnjs.cloudflare.com; " +
                "style-src 'self' 'unsafe-inline' cdn.jsdelivr.net cdnjs.cloudflare.com fonts.googleapis.com; " +
                "font-src 'self' fonts.googleapis.com fonts.gstatic.com; " +
                "connect-src 'self' ws: wss:; " +
                "img-src 'self' data: https:; " +
                "object-src 'none'; " +
                "base-uri 'self'"
            );
            next();
        });

        // Serve the dashboard
        this.app.get('/', (req, res) => {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(this.getDashboardHTML());
        });

        // API endpoint for session data
        this.app.get('/api/session', (req, res) => {
            res.json(this.sessionData);
        });

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            const clientIP = this.getClientIP(req);
            
            // Enhanced connection attempt tracking
            this.trackConnectionAttempt(clientIP);
            
            // Check connection limit BEFORE processing connection
            if (this.clients.size >= this.maxConnections) {
                ws.close(1013, 'Server overloaded');
                console.log(chalk.yellow(`🚫 Connection rejected: limit reached (${this.clients.size}/${this.maxConnections}) from ${clientIP}`));
                return;
            }
            
            // Enhanced token validation for WebSocket with expiration check
            const url = new URL(req.url, `http://${req.headers.host}`);
            const token = url.searchParams.get('token');
            
            // Check token expiration
            if (Date.now() > this.tokenExpiry) {
                ws.close(1008, 'Token expired');
                console.log(chalk.red(`🔒 WebSocket connection rejected: token expired for ${clientIP}`));
                return;
            }
            
            if (!token || !this.timingSafeTokenCompare(token, this.sessionToken)) {
                ws.close(1008, 'Invalid token');
                console.log(chalk.yellow(`🚫 WebSocket connection rejected: invalid token from ${clientIP}`));
                return;
            }
            
            // Add connection metadata
            ws.clientIP = clientIP;
            ws.connectedAt = Date.now();
            ws.lastPong = Date.now();
            ws.isAlive = true;
            
            // Add to clients set and update connection count atomically
            this.clients.add(ws);
            this.connectionCount = this.clients.size; // Keep in sync
            console.log(chalk.gray(`📱 Web UI client connected from ${clientIP} (${this.connectionCount}/${this.maxConnections})`));
            
            // Set up connection timeout (reduced for security)
            const timeout = setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close(1000, 'Connection timeout');
                }
            }, 180000); // 3 minute timeout (reduced from 5)
            
            // Send current session data safely after a small delay to ensure client is ready
            setTimeout(() => {
                this.sendToClient(ws, {
                    type: 'session_data',
                    data: this.sessionData
                });
            }, 100); // 100ms delay to ensure client readiness

            // Enhanced event handlers
            ws.on('close', (code, reason) => {
                clearTimeout(timeout);
                this.clients.delete(ws);
                this.connectionCount = this.clients.size; // Keep in sync
                console.log(chalk.gray(`📱 Web UI client disconnected from ${clientIP} (${this.connectionCount}/${this.maxConnections}) - Code: ${code}, Reason: ${reason}`));
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeout);
                console.error(`WebSocket error from ${clientIP}:`, error.message);
                this.clients.delete(ws);
                this.connectionCount = this.clients.size; // Keep in sync
            });
            
            // Handle pong responses for connection health
            ws.on('pong', () => {
                ws.lastPong = Date.now();
                ws.isAlive = true;
            });
            
            // Rate limiting for WebSocket messages
            ws.messageCount = 0;
            ws.messageWindow = Date.now();
            ws.on('message', (message) => {
                this.handleWebSocketMessage(ws, message);
            });
        });
    }

    broadcast(data) {
        if (this.clients.size === 0) return;
        
        // Use try-catch for JSON stringify to prevent crashes
        let message;
        try {
            message = JSON.stringify(data);
        } catch (error) {
            console.error('Error serializing broadcast data:', error.message);
            return;
        }
        
        const deadClients = [];
        const clientsArray = Array.from(this.clients); // Create snapshot to avoid concurrent modification
        
        clientsArray.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message);
                } catch (error) {
                    console.error('Error broadcasting to client:', error.message);
                    deadClients.push(client);
                }
            } else {
                deadClients.push(client);
            }
        });
        
        // Clean up dead connections atomically
        if (deadClients.length > 0) {
            deadClients.forEach(client => {
                this.clients.delete(client);
            });
            this.connectionCount = this.clients.size; // Keep in sync
            console.log(chalk.gray(`🧹 Cleaned up ${deadClients.length} dead connections`));
        }
    }

    // Ping clients to check connection health
    pingClients() {
        if (this.clients.size === 0) return;
        
        const deadClients = [];
        const clientsArray = Array.from(this.clients);
        
        clientsArray.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    // Send ping and mark as not alive until pong received
                    client.isAlive = false;
                    client.ping();
                    
                    // Set up pong handler
                    client.on('pong', () => {
                        client.isAlive = true;
                        client.lastPong = Date.now();
                    });
                    
                } catch (error) {
                    console.error('Error pinging client:', error.message);
                    deadClients.push(client);
                }
            } else {
                deadClients.push(client);
            }
        });
        
        // Check for clients that didn't respond to previous ping
        setTimeout(() => {
            const unresponsiveClients = [];
            clientsArray.forEach(client => {
                if (!client.isAlive && client.readyState === WebSocket.OPEN) {
                    unresponsiveClients.push(client);
                    client.terminate();
                }
            });
            
            if (unresponsiveClients.length > 0) {
                console.log(chalk.gray(`🧹 Terminated ${unresponsiveClients.length} unresponsive connections`));
            }
        }, 5000); // Wait 5 seconds for pong response
        
        // Clean up dead connections
        if (deadClients.length > 0) {
            deadClients.forEach(client => {
                this.clients.delete(client);
            });
            this.connectionCount = this.clients.size;
            console.log(chalk.gray(`🧹 Cleaned up ${deadClients.length} dead connections during ping`));
        }
    }

    updateSession(updates) {
        // Validate updates to prevent corruption
        if (!updates || typeof updates !== 'object') {
            console.error('Invalid session update data:', updates);
            return;
        }
        
        // Apply updates atomically
        try {
            Object.assign(this.sessionData, updates);
            
            // Create a deep copy for broadcasting to prevent reference issues
            const sessionCopy = JSON.parse(JSON.stringify(this.sessionData));
            
            this.broadcast({
                type: 'session_update',
                data: sessionCopy
            });
        } catch (error) {
            console.error('Error updating session:', error.message);
        }
    }

    addOutput(output, type = 'info') {
        // Validate input
        if (output === null || output === undefined) {
            console.warn('Attempting to add null/undefined output, skipping');
            return;
        }
        
        // Sanitize message to prevent XSS and ensure it's a string
        const message = String(output).substring(0, 10000); // Limit message length
        
        // Validate type
        const validTypes = ['info', 'success', 'error', 'warning'];
        const safeType = validTypes.includes(type) ? type : 'info';
        
        const entry = {
            timestamp: new Date().toISOString(),
            type: safeType,
            message: message
        };
        
        // Thread-safe array operations
        try {
            this.sessionData.output.push(entry);
            
            // Keep only last entries for better memory management (configurable)
            const maxOutputEntries = parseInt(process.env.WEBUI_MAX_OUTPUT_ENTRIES) || 50;
            if (this.sessionData.output.length > maxOutputEntries) {
                this.sessionData.output.splice(0, this.sessionData.output.length - maxOutputEntries);
            }

            this.broadcast({
                type: 'new_output',
                data: entry
            });
        } catch (error) {
            console.error('Error adding output:', error.message);
        }
    }

    start() {
        return new Promise((resolve, reject) => {
            this.server.listen(this.port, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(chalk.green(`🌐 Web UI started: http://localhost:${this.port}`));
                    console.log(chalk.gray('📊 Real-time progress monitoring available'));
                    resolve();
                }
            });
        });
    }

    // Enhanced security and utility methods
    getClientIP(req) {
        return req.headers['x-forwarded-for']?.split(',')[0] || 
               req.headers['x-real-ip'] || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
               'unknown';
    }

    timingSafeTokenCompare(a, b) {
        // Prevent timing attacks by ensuring comparison takes constant time
        if (!a || !b || typeof a !== 'string' || typeof b !== 'string') {
            return false;
        }
        
        // Pad shorter string to prevent length-based timing differences
        const maxLength = Math.max(a.length, b.length);
        const paddedA = a.padEnd(maxLength, '\0');
        const paddedB = b.padEnd(maxLength, '\0');
        
        let result = 0;
        for (let i = 0; i < maxLength; i++) {
            result |= paddedA.charCodeAt(i) ^ paddedB.charCodeAt(i);
        }
        
        // Additional check to ensure original lengths match
        return result === 0 && a.length === b.length;
    }

    trackConnectionAttempt(clientIP) {
        const now = Date.now();
        if (!this.connectionAttempts.has(clientIP)) {
            this.connectionAttempts.set(clientIP, []);
        }
        
        const attempts = this.connectionAttempts.get(clientIP);
        // Keep only attempts from the last 5 minutes
        const recentAttempts = attempts.filter(time => now - time < 300000);
        recentAttempts.push(now);
        this.connectionAttempts.set(clientIP, recentAttempts);
        
        // Log suspicious activity (more than 20 attempts in 5 minutes)
        if (recentAttempts.length > 20) {
            console.log(chalk.red(`🚨 Suspicious connection activity from ${clientIP}: ${recentAttempts.length} attempts in 5 minutes`));
        }
    }

    regenerateToken() {
        this.sessionToken = crypto.randomBytes(48).toString('hex');
        this.tokenExpiry = Date.now() + (parseInt(process.env.WEBUI_TOKEN_EXPIRY_HOURS) || 24) * 60 * 60 * 1000;
        const maskedToken = this.sessionToken.substring(0, 8) + '...';
        console.log(chalk.cyan(`🔐 New WebUI Access Token: ${maskedToken}`));
        console.log(chalk.gray(`Token expires: ${new Date(this.tokenExpiry).toLocaleString()}`));
        console.log(chalk.yellow('⚠️  For security, full token is not displayed. Check environment or config for full token.'));
    }

    cleanupRateLimiting() {
        const now = Date.now();
        const cutoff = now - 60000; // 1 minute ago
        
        // Clean up request counts
        for (const [ip, requests] of this.requestCounts.entries()) {
            const recentRequests = requests.filter(time => time > cutoff);
            if (recentRequests.length === 0) {
                this.requestCounts.delete(ip);
            } else {
                this.requestCounts.set(ip, recentRequests);
            }
        }
        
        // Clean up connection attempts (keep 5 minutes)
        const connectionCutoff = now - 300000;
        for (const [ip, attempts] of this.connectionAttempts.entries()) {
            const recentAttempts = attempts.filter(time => time > connectionCutoff);
            if (recentAttempts.length === 0) {
                this.connectionAttempts.delete(ip);
            } else {
                this.connectionAttempts.set(ip, recentAttempts);
            }
        }
        
        console.log(chalk.gray(`🧹 Rate limiting cleanup: ${this.requestCounts.size} IPs tracked, ${this.connectionAttempts.size} connection attempts tracked`));
    }

    pingClients() {
        const now = Date.now();
        const deadClients = [];
        
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                // Check if client responded to last ping
                if (now - client.lastPong > 60000) { // 1 minute since last pong
                    console.log(chalk.yellow(`💀 Client ${client.clientIP} appears dead (no pong for ${Math.round((now - client.lastPong) / 1000)}s)`));
                    deadClients.push(client);
                    return;
                }
                
                // Send ping
                try {
                    client.isAlive = false;
                    client.ping();
                } catch (error) {
                    console.error(`Error pinging client ${client.clientIP}:`, error.message);
                    deadClients.push(client);
                }
            } else {
                deadClients.push(client);
            }
        });
        
        // Clean up dead clients
        deadClients.forEach(client => {
            this.clients.delete(client);
            try {
                client.terminate();
            } catch (error) {
                // Ignore termination errors
            }
        });
        
        if (deadClients.length > 0) {
            this.connectionCount = this.clients.size;
            console.log(chalk.gray(`🧹 Cleaned up ${deadClients.length} dead WebSocket connections`));
        }
    }

    sendToClient(client, data) {
        if (client.readyState !== WebSocket.OPEN) {
            return false;
        }
        
        try {
            const message = JSON.stringify(data);
            client.send(message);
            return true;
        } catch (error) {
            console.error(`Error sending to client ${client.clientIP}:`, error.message);
            return false;
        }
    }

    handleWebSocketMessage(ws, message) {
        const now = Date.now();
        
        // Reset message window if needed
        if (now - ws.messageWindow > 60000) { // 1 minute window
            ws.messageCount = 0;
            ws.messageWindow = now;
        }
        
        ws.messageCount++;
        
        // Rate limit messages (max 10 per minute per client)
        const maxMessages = parseInt(process.env.WEBUI_MAX_WS_MESSAGES_PER_MINUTE) || 10;
        if (ws.messageCount > maxMessages) {
            console.log(chalk.yellow(`🚫 Rate limiting WebSocket messages from ${ws.clientIP}`));
            ws.close(1008, 'Message rate limit exceeded');
            return;
        }
        
        try {
            // Parse and validate message
            const data = JSON.parse(message);
            
            // Handle specific message types if needed
            switch (data.type) {
                case 'ping':
                    this.sendToClient(ws, { type: 'pong', timestamp: now });
                    break;
                default:
                    console.log(chalk.gray(`📨 Received message from ${ws.clientIP}: ${data.type || 'unknown'}`));
            }
        } catch (error) {
            console.error(`Invalid message from ${ws.clientIP}:`, error.message);
            // Don't close connection for invalid JSON, just log it
        }
    }

    stop() {
        return new Promise((resolve) => {
            // Clean up intervals
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
            }
            if (this.pingInterval) {
                clearInterval(this.pingInterval);
            }
            
            // Close all WebSocket connections gracefully
            this.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    try {
                        client.close(1001, 'Server shutting down');
                    } catch (error) {
                        client.terminate();
                    }
                }
            });
            this.clients.clear();
            
            // Close WebSocket server
            this.wss.close(() => {
                // Close HTTP server
                this.server.close(() => {
                    console.log(chalk.gray('🌐 Web UI server stopped'));
                    resolve();
                });
            });
        });
    }

    getDashboardHTML() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude Loop - AI Repository Debugger</title>
    
    <!-- CDN Resources -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    
    <style>
        :root {
            --claude-primary: #667eea;
            --claude-secondary: #764ba2;
            --claude-dark: #1a1a2e;
            --claude-darker: #16213e;
            --claude-bg: #0f1419;
            --claude-card-bg: #1a1a2e;
            --claude-text: #e2e8f0;
            --claude-text-secondary: #8796a0;
            --claude-border: #2d3748;
            --claude-success: #48bb78;
            --claude-warning: #ed8936;
            --claude-error: #f56565;
            --claude-accent: #00f5ff;
        }

        * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        body { 
            background: var(--claude-bg);
            color: var(--claude-text);
            margin: 0;
            padding: 0;
            overflow-x: hidden;
            min-height: 100vh;
        }

        .app-container {
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        /* Header */
        .app-header {
            background: linear-gradient(135deg, var(--claude-primary) 0%, var(--claude-secondary) 100%);
            padding: 1.5rem 2rem;
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
            border-bottom: 1px solid var(--claude-border);
        }

        .header-content {
            max-width: 1400px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 1rem;
            color: white;
        }

        .brand-icon {
            font-size: 2.5rem;
            background: linear-gradient(45deg, var(--claude-accent), #fff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .brand-text h1 {
            font-size: 1.8rem;
            font-weight: 800;
            margin: 0;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .brand-text p {
            font-size: 0.9rem;
            margin: 0;
            opacity: 0.9;
        }

        .status-badge {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem 1.5rem;
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            border-radius: 2rem;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .status-pulse {
            width: 12px;
            height: 12px;
            background: var(--claude-success);
            border-radius: 50%;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.1); }
        }

        /* Main Content */
        .main-content {
            flex: 1;
            max-width: 1400px;
            margin: 0 auto;
            width: 100%;
            padding: 2rem;
            display: flex;
            flex-direction: column;
            gap: 2rem;
        }

        /* Status Grid */
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1.5rem;
        }

        .status-card {
            background: var(--claude-card-bg);
            border: 1px solid var(--claude-border);
            border-radius: 1rem;
            padding: 2rem;
            position: relative;
            overflow: hidden;
            transition: all 0.3s ease;
        }

        .status-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--claude-primary), var(--claude-secondary));
        }

        .status-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 20px 40px rgba(102, 126, 234, 0.15);
        }

        .status-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1rem;
        }

        .status-card h3 { 
            color: var(--claude-text-secondary);
            font-size: 0.875rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 0;
        }

        .status-card-icon {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, var(--claude-primary), var(--claude-secondary));
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.2rem;
        }

        .status-value { 
            font-size: 2.5rem; 
            font-weight: 800; 
            color: var(--claude-text);
            margin-bottom: 0.5rem;
        }

        .status-description {
            color: var(--claude-text-secondary);
            font-size: 0.875rem;
        }

        .progress-container {
            margin-top: 1.5rem;
        }

        .progress-bar {
            width: 100%;
            height: 8px;
            background: var(--claude-darker);
            border-radius: 4px;
            overflow: hidden;
            position: relative;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--claude-primary), var(--claude-secondary));
            border-radius: 4px;
            transition: width 0.5s ease;
            position: relative;
        }

        .progress-fill::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
            animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }

        /* Output Container */
        .output-container {
            background: var(--claude-card-bg);
            border: 1px solid var(--claude-border);
            border-radius: 1rem;
            overflow: hidden;
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 500px;
        }

        .output-header {
            background: var(--claude-darker);
            padding: 1.5rem 2rem;
            border-bottom: 1px solid var(--claude-border);
            display: flex;
            align-items: center;
            justify-content: between;
        }

        .output-header h3 {
            font-weight: 700;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .output-header .header-icon {
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, var(--claude-primary), var(--claude-secondary));
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }

        .output-content {
            flex: 1;
            overflow-y: auto;
            padding: 0;
            position: relative;
        }

        .output-line {
            padding: 1rem 2rem;
            border-bottom: 1px solid rgba(45, 55, 72, 0.3);
            display: flex;
            align-items: flex-start;
            gap: 1rem;
            transition: background 0.2s ease;
            font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
            font-size: 0.875rem;
            line-height: 1.5;
        }

        .output-line:hover {
            background: rgba(102, 126, 234, 0.05);
        }

        .output-line-icon {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            margin-top: 0.125rem;
        }

        .output-line.info .output-line-icon { 
            background: rgba(102, 126, 234, 0.2);
            color: var(--claude-primary);
        }
        .output-line.success .output-line-icon { 
            background: rgba(72, 187, 120, 0.2);
            color: var(--claude-success);
        }
        .output-line.error .output-line-icon { 
            background: rgba(245, 101, 101, 0.2);
            color: var(--claude-error);
        }
        .output-line.warning .output-line-icon { 
            background: rgba(237, 137, 54, 0.2);
            color: var(--claude-warning);
        }

        .output-line-content {
            flex: 1;
        }

        .output-line.info { color: var(--claude-text); }
        .output-line.success { color: var(--claude-success); }
        .output-line.error { color: var(--claude-error); }
        .output-line.warning { color: var(--claude-warning); }

        .timestamp {
            color: var(--claude-text-secondary);
            font-size: 0.75rem;
            margin-bottom: 0.25rem;
            font-weight: 500;
        }

        .auto-scroll {
            padding: 1rem 2rem;
            background: var(--claude-darker);
            border-top: 1px solid var(--claude-border);
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .auto-scroll label {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--claude-text-secondary);
            font-size: 0.875rem;
            cursor: pointer;
        }

        .auto-scroll input[type="checkbox"] {
            width: 16px;
            height: 16px;
            accent-color: var(--claude-primary);
        }

        /* Connection Status */
        .connection-status {
            position: fixed;
            top: 2rem;
            right: 2rem;
            padding: 0.75rem 1.5rem;
            border-radius: 2rem;
            font-size: 0.875rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            backdrop-filter: blur(10px);
            z-index: 1000;
            transition: all 0.3s ease;
        }

        .connected {
            background: rgba(72, 187, 120, 0.2);
            color: var(--claude-success);
            border: 1px solid rgba(72, 187, 120, 0.3);
        }

        .disconnected {
            background: rgba(245, 101, 101, 0.2);
            color: var(--claude-error);
            border: 1px solid rgba(245, 101, 101, 0.3);
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            .header-content {
                flex-direction: column;
                gap: 1rem;
                text-align: center;
            }
            
            .main-content {
                padding: 1rem;
            }
            
            .status-grid {
                grid-template-columns: 1fr;
            }
            
            .brand-text h1 {
                font-size: 1.5rem;
            }
            
            .connection-status {
                top: 1rem;
                right: 1rem;
                font-size: 0.75rem;
            }
        }

        /* Scrollbar Styling */
        ::-webkit-scrollbar {
            width: 8px;
        }

        ::-webkit-scrollbar-track {
            background: var(--claude-darker);
        }

        ::-webkit-scrollbar-thumb {
            background: var(--claude-border);
            border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--claude-primary);
        }

        /* Enhanced visual effects */
        .glow-effect {
            box-shadow: 0 0 20px rgba(102, 126, 234, 0.3);
        }

        .running .status-value {
            color: var(--claude-success);
        }

        .stopped .status-value {
            color: var(--claude-error);
        }
    </style>
</head>
<body>
    <div id="connectionStatus" class="connection-status disconnected">
        <i class="fas fa-circle"></i>
        <span>Connecting...</span>
    </div>
    
    <div class="app-container">
        <!-- Header -->
        <div class="app-header">
            <div class="header-content">
                <div class="brand">
                    <i class="fas fa-robot brand-icon"></i>
                    <div class="brand-text">
                        <h1>Claude Loop</h1>
                        <p>AI-Powered Repository Debugger</p>
                    </div>
                </div>
                
                <div class="status-badge">
                    <div class="status-pulse"></div>
                    <span>Live Monitoring</span>
                </div>
            </div>
        </div>

        <!-- Main Content -->
        <div class="main-content">
            <!-- Status Grid -->
            <div class="status-grid">
                <div class="status-card">
                    <div class="status-card-header">
                        <h3>Session Status</h3>
                        <div class="status-card-icon">
                            <i class="fas fa-power-off"></i>
                        </div>
                    </div>
                    <div id="status" class="status-value stopped">Initializing...</div>
                    <div class="status-description">Current debugging session state</div>
                </div>
                
                <div class="status-card">
                    <div class="status-card-header">
                        <h3>Iterations</h3>
                        <div class="status-card-icon">
                            <i class="fas fa-sync-alt"></i>
                        </div>
                    </div>
                    <div id="iterations" class="status-value">0</div>
                    <div class="status-description">Debugging cycles completed</div>
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div id="progress" class="progress-fill" style="width: 0%"></div>
                        </div>
                    </div>
                </div>
                
                <div class="status-card">
                    <div class="status-card-header">
                        <h3>Current Phase</h3>
                        <div class="status-card-icon">
                            <i class="fas fa-tasks"></i>
                        </div>
                    </div>
                    <div id="currentPhase" class="status-value">Starting...</div>
                    <div class="status-description">Active debugging focus area</div>
                </div>
                
                <div class="status-card">
                    <div class="status-card-header">
                        <h3>Runtime</h3>
                        <div class="status-card-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                    </div>
                    <div id="runtime" class="status-value">0m 0s</div>
                    <div class="status-description">Total session duration</div>
                </div>
            </div>

            <!-- Output Container -->
            <div class="output-container">
                <div class="output-header">
                    <h3>
                        <div class="header-icon">
                            <i class="fas fa-terminal"></i>
                        </div>
                        Claude CLI Output Stream
                    </h3>
                </div>
                <div id="output" class="output-content"></div>
                <div class="auto-scroll">
                    <label for="autoScroll">
                        <input type="checkbox" id="autoScroll" checked>
                        Auto-scroll to bottom
                    </label>
                </div>
            </div>
        </div>
    </div>

    <script>
        let ws;
        let sessionData = {};
        let reconnectAttempts = 0;
        const maxIterations = 10; // Default, will be updated from server

        function connect() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const token = new URLSearchParams(window.location.search).get('token');
            if (!token) {
                document.body.innerHTML = '<h1>Access Token Required</h1><p>Please add ?token=YOUR_TOKEN to the URL</p>';
                return;
            }
            ws = new WebSocket(\`\${protocol}//\${window.location.host}?token=\${encodeURIComponent(token)}\`);
            
            ws.onopen = () => {
                updateConnectionStatus(true);
                reconnectAttempts = 0; // Reset on successful connection
            };
            
            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                handleMessage(message);
            };
            
            ws.onclose = (event) => {
                updateConnectionStatus(false);
                // Exponential backoff for reconnection
                const delay = Math.min(2000 * Math.pow(2, reconnectAttempts), 30000);
                setTimeout(connect, delay);
                reconnectAttempts++;
            };
            
            ws.onerror = () => {
                updateConnectionStatus(false);
            };
        }

        function updateConnectionStatus(connected) {
            const status = document.getElementById('connectionStatus');
            const icon = status.querySelector('i');
            const text = status.querySelector('span');
            
            if (connected) {
                text.textContent = 'Connected';
                status.className = 'connection-status connected';
                icon.className = 'fas fa-check-circle';
            } else {
                text.textContent = 'Disconnected';
                status.className = 'connection-status disconnected';
                icon.className = 'fas fa-times-circle';
            }
        }

        function handleMessage(message) {
            switch (message.type) {
                case 'session_data':
                case 'session_update':
                    sessionData = message.data;
                    updateUI();
                    break;
                case 'new_output':
                    addOutputLine(message.data);
                    break;
            }
        }

        function updateUI() {
            // Status
            const statusEl = document.getElementById('status');
            statusEl.textContent = sessionData.isRunning ? 'Running' : 'Stopped';
            statusEl.className = \`status-value \${sessionData.isRunning ? 'running' : 'stopped'}\`;
            
            // Iterations
            document.getElementById('iterations').textContent = 
                \`\${sessionData.iterations} / \${maxIterations}\`;
            
            // Progress bar
            const progress = (sessionData.iterations / maxIterations) * 100;
            document.getElementById('progress').style.width = \`\${Math.min(progress, 100)}%\`;
            
            // Current phase
            document.getElementById('currentPhase').textContent = sessionData.currentPhase || 'Waiting...';
            
            // Runtime
            const runtime = formatElapsedTime(sessionData.startTime);
            document.getElementById('runtime').textContent = runtime;
        }

        function addOutputLine(entry) {
            const outputContainer = document.getElementById('output');
            const line = document.createElement('div');
            line.className = \`output-line \${entry.type}\`;
            
            const timestamp = new Date(entry.timestamp).toLocaleTimeString();
            
            // Get appropriate icon for message type
            let iconClass = 'fas fa-info-circle';
            if (entry.type === 'success') iconClass = 'fas fa-check-circle';
            if (entry.type === 'error') iconClass = 'fas fa-exclamation-circle';
            if (entry.type === 'warning') iconClass = 'fas fa-exclamation-triangle';
            
            // Create elements safely to prevent XSS
            const iconDiv = document.createElement('div');
            iconDiv.className = 'output-line-icon';
            const icon = document.createElement('i');
            icon.className = iconClass;
            iconDiv.appendChild(icon);
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'output-line-content';
            
            const timestampDiv = document.createElement('div');
            timestampDiv.className = 'timestamp';
            timestampDiv.textContent = \`[\${timestamp}]\`;
            
            const messageDiv = document.createElement('div');
            messageDiv.textContent = entry.message; // Safely set text content
            
            contentDiv.appendChild(timestampDiv);
            contentDiv.appendChild(messageDiv);
            line.appendChild(iconDiv);
            line.appendChild(contentDiv);
            
            outputContainer.appendChild(line);
            
            // Auto-scroll if enabled
            if (document.getElementById('autoScroll').checked) {
                outputContainer.scrollTop = outputContainer.scrollHeight;
            }
        }

        function formatElapsedTime(startTime) {
            const elapsed = Date.now() - startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            return \`\${minutes}m \${seconds}s\`;
        }

        // Update runtime every second
        setInterval(() => {
            if (sessionData.startTime) {
                const runtime = formatElapsedTime(sessionData.startTime);
                document.getElementById('runtime').textContent = runtime;
            }
        }, 1000);

        // Connect on load
        connect();
    </script>
</body>
</html>`;
    }
}

module.exports = WebUI;