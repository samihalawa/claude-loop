const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const chalk = require('chalk');
const logger = require('./utils/unified-logger');

class WebUI {
    constructor(port = 3333) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        
        // Simple session token for basic identification
        this.sessionToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        
        // Simple WebSocket server - no security bullshit
        this.wss = new WebSocket.Server({ 
            server: this.server,
            maxConnections: 100
        });
        
        this.clients = new Set();
        this.sessionData = {
            iterations: 0,
            maxIterations: 10,
            currentPhase: 'Initializing',
            isRunning: false,
            repoPath: '',
            startTime: null,
            progress: 0,
            elapsed: '0m 0s'
        };
        this.outputBuffer = [];
        
        this.setupRoutes();
        this.setupWebSocket();
    }

    setupRoutes() {
        // Serve static files
        this.app.use(express.static(path.join(__dirname, 'templates')));
        
        // Main dashboard route - no token bullshit
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'templates', 'dashboard.html'));
        });
        
        // API endpoints - no auth needed
        this.app.get('/api/session', (req, res) => {
            res.json(this.sessionData);
        });
        
        this.app.get('/api/output', (req, res) => {
            res.json({ output: this.outputBuffer });
        });
        
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', port: this.port });
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            logger.info(chalk.green('🔌 WebSocket client connected'));
            this.clients.add(ws);
            
            // Send current session data immediately
            ws.send(JSON.stringify({
                type: 'session_update',
                data: this.sessionData
            }));
            
            // Send recent output
            if (this.outputBuffer.length > 0) {
                ws.send(JSON.stringify({
                    type: 'output_batch',
                    data: this.outputBuffer.slice(-50) // Last 50 messages
                }));
            }
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleWebSocketMessage(ws, data);
                } catch (error) {
                    logger.warn(`Invalid WebSocket message: ${error.message}`);
                }
            });
            
            ws.on('close', () => {
                logger.info(chalk.yellow('🔌 WebSocket client disconnected'));
                this.clients.delete(ws);
            });
            
            ws.on('error', (error) => {
                logger.error(`WebSocket error: ${error.message}`);
                this.clients.delete(ws);
            });
        });
    }

    handleWebSocketMessage(ws, data) {
        switch (data.type) {
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong' }));
                break;
            case 'get_session':
                ws.send(JSON.stringify({
                    type: 'session_update',
                    data: this.sessionData
                }));
                break;
            case 'get_output':
                ws.send(JSON.stringify({
                    type: 'output_batch',
                    data: this.outputBuffer.slice(-100)
                }));
                break;
            default:
                logger.warn(`Unknown WebSocket message type: ${data.type}`);
        }
    }

    broadcast(message) {
        const messageStr = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(messageStr);
                } catch (error) {
                    logger.warn(`Failed to send message to client: ${error.message}`);
                    this.clients.delete(client);
                }
            }
        });
    }

    updateSession(updates) {
        Object.assign(this.sessionData, updates);
        this.broadcast({
            type: 'session_update',
            data: this.sessionData
        });
    }

    addOutput(message, type = 'info') {
        const outputEntry = {
            timestamp: new Date().toISOString(),
            message: message.toString(),
            type: type
        };
        
        this.outputBuffer.push(outputEntry);
        
        // Keep only last 1000 messages
        if (this.outputBuffer.length > 1000) {
            this.outputBuffer = this.outputBuffer.slice(-1000);
        }
        
        this.broadcast({
            type: 'output',
            data: outputEntry
        });
    }

    async start() {
        return new Promise((resolve, reject) => {
            // Try to find an available port
            const tryPort = (port) => {
                this.server.listen(port, (error) => {
                    if (error) {
                        if (error.code === 'EADDRINUSE') {
                            logger.info(`Port ${port} in use, trying ${port + 1}...`);
                            tryPort(port + 1);
                        } else {
                            reject(error);
                        }
                    } else {
                        this.port = port;
                        logger.info(chalk.green(`🌐 Web UI started: http://localhost:${this.port}`));
                        logger.info(chalk.gray('📊 Real-time progress monitoring available'));
                        resolve();
                    }
                });
            };
            
            tryPort(this.port);
        });
    }

    async stop() {
        return new Promise((resolve) => {
            // Close all WebSocket connections
            this.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.close();
                }
            });
            this.clients.clear();
            
            // Close WebSocket server
            this.wss.close(() => {
                // Close HTTP server
                this.server.close(() => {
                    logger.info(chalk.gray('🌐 Web UI stopped'));
                    resolve();
                });
            });
        });
    }

    // Utility methods for backward compatibility
    regenerateToken() {
        // No-op - no tokens needed
        logger.info(chalk.gray('No tokens needed for internal app'));
    }

    cleanupRateLimiting() {
        // No-op - no rate limiting
    }

    getStats() {
        return {
            connectedClients: this.clients.size,
            outputBufferSize: this.outputBuffer.length,
            sessionData: this.sessionData
        };
    }
}

module.exports = WebUI;
