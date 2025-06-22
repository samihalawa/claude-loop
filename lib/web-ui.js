const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const chalk = require('chalk');

class WebUI {
    constructor(port = 3333) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        this.clients = new Set();
        this.sessionData = {
            iterations: 0,
            currentPhase: 'Starting...',
            output: [],
            startTime: Date.now(),
            isRunning: false
        };
        
        this.setupRoutes();
        this.setupWebSocket();
    }

    setupRoutes() {
        // Serve the dashboard
        this.app.get('/', (req, res) => {
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
        this.wss.on('connection', (ws) => {
            this.clients.add(ws);
            console.log(chalk.gray('📱 Web UI client connected'));
            
            // Send current session data
            ws.send(JSON.stringify({
                type: 'session_data',
                data: this.sessionData
            }));

            ws.on('close', () => {
                this.clients.delete(ws);
                console.log(chalk.gray('📱 Web UI client disconnected'));
            });
        });
    }

    broadcast(data) {
        const message = JSON.stringify(data);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
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

    addOutput(output, type = 'info') {
        const entry = {
            timestamp: new Date().toISOString(),
            type,
            message: output
        };
        
        this.sessionData.output.push(entry);
        
        // Keep only last 100 entries
        if (this.sessionData.output.length > 100) {
            this.sessionData.output = this.sessionData.output.slice(-100);
        }

        this.broadcast({
            type: 'new_output',
            data: entry
        });
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

    stop() {
        return new Promise((resolve) => {
            this.server.close(() => {
                console.log(chalk.gray('🌐 Web UI server stopped'));
                resolve();
            });
        });
    }

    getDashboardHTML() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude Loop - Live Debug Monitor</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
            background: #0a0a0a; 
            color: #e0e0e0; 
            line-height: 1.4;
        }
        .container { 
            max-width: 1400px; 
            margin: 0 auto; 
            padding: 20px; 
        }
        .header {
            background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);
        }
        .header h1 { 
            font-size: 2rem; 
            font-weight: bold;
            margin-bottom: 8px;
        }
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .status-card {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        .status-card h3 { 
            color: #60a5fa; 
            margin-bottom: 10px; 
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .status-value { 
            font-size: 1.5rem; 
            font-weight: bold; 
            color: #fff;
        }
        .output-container {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            height: 600px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        .output-header {
            background: #2a2a2a;
            padding: 15px 20px;
            border-bottom: 1px solid #333;
            font-weight: bold;
        }
        .output-content {
            flex: 1;
            overflow-y: auto;
            padding: 0;
        }
        .output-line {
            padding: 8px 20px;
            border-bottom: 1px solid #2a2a2a;
            white-space: pre-wrap;
            font-family: inherit;
        }
        .output-line.info { color: #e0e0e0; }
        .output-line.success { color: #22c55e; }
        .output-line.error { color: #ef4444; }
        .output-line.warning { color: #f59e0b; }
        .running { color: #22c55e; }
        .stopped { color: #ef4444; }
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #333;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 10px;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #60a5fa);
            border-radius: 4px;
            transition: width 0.3s ease;
        }
        .timestamp {
            color: #666;
            font-size: 0.8rem;
            margin-right: 10px;
        }
        .auto-scroll {
            padding: 10px 20px;
            background: #2a2a2a;
            border-top: 1px solid #333;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .auto-scroll input {
            margin-right: 5px;
        }
        .connection-status {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 6px;
            font-size: 0.9rem;
            font-weight: bold;
        }
        .connected {
            background: #065f46;
            color: #10b981;
        }
        .disconnected {
            background: #7f1d1d;
            color: #ef4444;
        }
    </style>
</head>
<body>
    <div id="connectionStatus" class="connection-status disconnected">● Connecting...</div>
    
    <div class="container">
        <div class="header">
            <h1>🔄 Claude Loop - Live Debug Monitor</h1>
            <p>Real-time monitoring of Claude CLI iterative debugging</p>
        </div>

        <div class="status-grid">
            <div class="status-card">
                <h3>Current Status</h3>
                <div id="status" class="status-value stopped">Initializing...</div>
            </div>
            <div class="status-card">
                <h3>Iterations</h3>
                <div id="iterations" class="status-value">0</div>
                <div class="progress-bar">
                    <div id="progress" class="progress-fill" style="width: 0%"></div>
                </div>
            </div>
            <div class="status-card">
                <h3>Current Phase</h3>
                <div id="currentPhase" class="status-value">Starting...</div>
            </div>
            <div class="status-card">
                <h3>Runtime</h3>
                <div id="runtime" class="status-value">0m 0s</div>
            </div>
        </div>

        <div class="output-container">
            <div class="output-header">
                Claude CLI Output Stream
            </div>
            <div id="output" class="output-content"></div>
            <div class="auto-scroll">
                <input type="checkbox" id="autoScroll" checked>
                <label for="autoScroll">Auto-scroll to bottom</label>
            </div>
        </div>
    </div>

    <script>
        let ws;
        let sessionData = {};
        const maxIterations = 10; // Default, will be updated from server

        function connect() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(\`\${protocol}//\${window.location.host}\`);
            
            ws.onopen = () => {
                updateConnectionStatus(true);
            };
            
            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                handleMessage(message);
            };
            
            ws.onclose = () => {
                updateConnectionStatus(false);
                setTimeout(connect, 2000); // Reconnect after 2 seconds
            };
            
            ws.onerror = () => {
                updateConnectionStatus(false);
            };
        }

        function updateConnectionStatus(connected) {
            const status = document.getElementById('connectionStatus');
            if (connected) {
                status.textContent = '● Connected';
                status.className = 'connection-status connected';
            } else {
                status.textContent = '● Disconnected';
                status.className = 'connection-status disconnected';
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
            line.innerHTML = \`<span class="timestamp">[\${timestamp}]</span>\${entry.message}\`;
            
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