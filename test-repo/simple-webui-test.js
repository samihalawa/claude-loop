const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');

// Simple WebUI test service
class SimpleWebUI {
    constructor(port = 3333) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.sessionToken = crypto.randomBytes(32).toString('hex');
        
        this.wss = new WebSocket.Server({ 
            server: this.server,
            maxConnections: 10
        });
        
        this.clients = new Set();
        this.sessionData = {
            iterations: 0,
            maxIterations: 10,
            currentPhase: 'Testing',
            isRunning: true,
            repoPath: '/test',
            startTime: new Date().toISOString(),
            progress: 25,
            elapsed: '5m 30s'
        };
        this.outputBuffer = [];
        
        this.setupRoutes();
        this.setupWebSocket();
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                port: this.port,
                timestamp: new Date().toISOString()
            });
        });
        
        // Session API
        this.app.get('/api/session', (req, res) => {
            res.json(this.sessionData);
        });
        
        // Root route
        this.app.get('/', (req, res) => {
            res.json({ 
                message: 'Claude Loop WebUI Test Service',
                status: 'running',
                endpoints: ['/health', '/api/session', '/ws']
            });
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            console.log('🔌 WebSocket client connected');
            this.clients.add(ws);
            
            // Send current session data immediately
            ws.send(JSON.stringify({
                type: 'session_update',
                data: this.sessionData
            }));
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleWebSocketMessage(ws, data);
                } catch (error) {
                    console.warn(`Invalid WebSocket message: ${error.message}`);
                }
            });
            
            ws.on('close', () => {
                console.log('🔌 WebSocket client disconnected');
                this.clients.delete(ws);
            });
            
            ws.on('error', (error) => {
                console.error(`WebSocket error: ${error.message}`);
                this.clients.delete(ws);
            });
        });
    }

    handleWebSocketMessage(ws, data) {
        switch (data.type) {
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                break;
            case 'get_session':
                ws.send(JSON.stringify({
                    type: 'session_update',
                    data: this.sessionData
                }));
                break;
            default:
                console.warn(`Unknown WebSocket message type: ${data.type}`);
        }
    }

    broadcast(message) {
        const messageStr = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(messageStr);
                } catch (error) {
                    console.warn(`Failed to send message to client: ${error.message}`);
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

    async start() {
        return new Promise((resolve, reject) => {
            this.server.listen(this.port, (error) => {
                if (error) {
                    reject(error);
                } else {
                    console.log(`🌐 Simple WebUI started: http://localhost:${this.port}`);
                    console.log(`🔐 Session token: ${this.sessionToken.substring(0, 8)}...`);
                    resolve();
                }
            });
        });
    }

    async stop() {
        return new Promise((resolve) => {
            this.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.close();
                }
            });
            this.clients.clear();
            
            this.server.close(() => {
                console.log('🛑 Simple WebUI stopped');
                resolve();
            });
        });
    }
}

// Start the service if run directly
if (require.main === module) {
    const webUI = new SimpleWebUI();
    webUI.start().then(() => {
        console.log('Service started successfully');
        
        // Add test data
        webUI.updateSession({
            iterations: 3,
            currentPhase: 'Backend Testing',
            isRunning: true
        });
        
        // Keep running
        process.on('SIGINT', async () => {
            console.log('Shutting down...');
            await webUI.stop();
            process.exit(0);
        });
    }).catch(err => {
        console.error('Failed to start service:', err.message);
        process.exit(1);
    });
}

module.exports = SimpleWebUI;