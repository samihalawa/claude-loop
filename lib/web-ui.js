const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const chalk = require('chalk');
const logger = require('./utils/unified-logger');
const ClaudeChatIntegration = require('./claude-chat-integration');

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
        
        // Initialize Claude Code integration
        this.claudeIntegration = new ClaudeChatIntegration(this);
        
        // Settings storage
        this.settings = {
            defaultModel: 'sonnet',
            maxTurns: 5,
            allowedTools: '',
            disallowedTools: '',
            claudeCliPath: '/opt/homebrew/bin/claude',
            systemPrompt: '',
            mcpServers: []
        };
        
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

        // Enhanced Claude Chat interface - no token needed
        this.app.get('/chat', (req, res) => {
            res.sendFile(path.join(__dirname, 'templates', 'claude-chat-dashboard.html'));
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
            
            // Send file tree immediately for chat interface
            this.sendFileTree(ws);
            
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
            case 'chat_message':
                this.handleChatMessage(ws, data);
                break;
            case 'get_file_tree':
                this.sendFileTree(ws);
                break;
            case 'update_settings':
                this.handleSettingsUpdate(ws, data);
                break;
            default:
                logger.warn(`Unknown WebSocket message type: ${data.type}`);
        }
    }

    async handleChatMessage(ws, data) {
        const { message, model = 'sonnet', settings: clientSettings } = data;
        logger.info(chalk.blue(`💬 Chat message received: ${message.substring(0, 50)}...`));
        
        try {
            // Update settings if provided
            if (clientSettings) {
                this.settings = { ...this.settings, ...clientSettings };
            }
            
            // Check for slash commands
            const slashCommand = this.claudeIntegration.parseSlashCommands(message);
            if (slashCommand) {
                const response = await this.claudeIntegration.handleSlashCommand(
                    slashCommand.command, 
                    slashCommand.args,
                    this
                );
                
                this.broadcast({
                    type: 'chat_response',
                    data: {
                        message: response,
                        model: model,
                        timestamp: Date.now(),
                        isCommand: true
                    }
                });
                return;
            }
            
            // Parse file references
            const fileReferences = this.claudeIntegration.parseFileReferences(message);
            
            // Prepare context for Claude Code with settings
            const context = {
                model: model,
                files: fileReferences,
                settings: this.settings
            };
            
            // Send to Claude Code CLI (with fallback)
            const response = await this.claudeIntegration.sendToClaudeCode(message, context);
            
            this.broadcast({
                type: 'chat_response',
                data: {
                    message: response,
                    model: model,
                    timestamp: Date.now(),
                    fileReferences: fileReferences
                }
            });
            
        } catch (error) {
            logger.error(`Chat message error: ${error.message}`);
            
            // Send error response
            this.broadcast({
                type: 'chat_response',
                data: {
                    message: `**Error**: ${error.message}\n\nFalling back to demo mode. Type \`/help\` for available commands.`,
                    model: model,
                    timestamp: Date.now(),
                    isError: true
                }
            });
        }
    }

    handleSettingsUpdate(ws, data) {
        const { settings: newSettings } = data;
        
        if (newSettings) {
            this.settings = { ...this.settings, ...newSettings };
            logger.info(chalk.cyan(`⚙️ Settings updated: model=${this.settings.defaultModel}, maxTurns=${this.settings.maxTurns}`));
            
            // Apply settings to Claude integration
            this.claudeIntegration.updateSettings(this.settings);
            
            // Broadcast settings update to all clients
            this.broadcast({
                type: 'settings_updated',
                data: {
                    settings: this.settings,
                    timestamp: Date.now()
                }
            });
        }
    }


    sendFileTree(ws) {
        const fs = require('fs');
        const path = require('path');
        
        try {
            const rootPath = process.cwd();
            const fileTree = this.buildFileTree(rootPath, 2); // Max depth 2
            
            ws.send(JSON.stringify({
                type: 'file_tree',
                data: fileTree
            }));
        } catch (error) {
            logger.error(`Error building file tree: ${error.message}`);
        }
    }

    buildFileTree(dirPath, maxDepth, currentDepth = 0) {
        const fs = require('fs');
        const path = require('path');
        
        if (currentDepth >= maxDepth) return [];
        
        try {
            const items = fs.readdirSync(dirPath);
            const tree = [];
            
            for (const item of items) {
                if (item.startsWith('.') || item === 'node_modules' || item === 'archive') continue;
                
                const fullPath = path.join(dirPath, item);
                const stats = fs.statSync(fullPath);
                
                const treeItem = {
                    name: item,
                    path: fullPath,
                    isDirectory: stats.isDirectory(),
                    size: stats.size,
                    modified: stats.mtime
                };
                
                if (stats.isDirectory() && currentDepth < maxDepth - 1) {
                    treeItem.children = this.buildFileTree(fullPath, maxDepth, currentDepth + 1);
                }
                
                tree.push(treeItem);
            }
            
            return tree.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            });
        } catch (error) {
            return [];
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
