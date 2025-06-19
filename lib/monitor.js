const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');
const chalk = require('chalk');

class Monitor {
    constructor(logger) {
        this.logger = logger;
        this.server = null;
        this.wss = null;
        this.clients = new Set();
        this.debugState = {
            issues: {},
            agents: [],
            timeline: [],
            metrics: {}
        };
    }

    async start(port = 8080, repoPath = process.cwd()) {
        // Create HTTP server
        this.server = http.createServer(async (req, res) => {
            if (req.url === '/') {
                const html = await this.getMonitorHTML();
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(html);
            } else if (req.url === '/api/state') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(this.debugState));
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });

        // Create WebSocket server
        this.wss = new WebSocket.Server({ server: this.server });
        
        this.wss.on('connection', (ws) => {
            this.clients.add(ws);
            
            // Send initial state
            ws.send(JSON.stringify({
                type: 'state',
                data: this.debugState
            }));
            
            ws.on('close', () => {
                this.clients.delete(ws);
            });
        });

        // Start server
        return new Promise((resolve, reject) => {
            this.server.listen(port, (err) => {
                if (err) reject(err);
                else resolve(port);
            });
        });
    }

    stop() {
        if (this.wss) {
            this.wss.close();
        }
        if (this.server) {
            this.server.close();
        }
    }

    updateState(state) {
        this.debugState = { ...this.debugState, ...state };
        this.broadcast({
            type: 'state',
            data: this.debugState
        });
    }

    addTimelineEvent(event) {
        this.debugState.timeline.unshift({
            timestamp: new Date().toISOString(),
            ...event
        });
        
        // Keep only last 50 events
        if (this.debugState.timeline.length > 50) {
            this.debugState.timeline = this.debugState.timeline.slice(0, 50);
        }
        
        this.broadcast({
            type: 'timeline',
            data: event
        });
    }

    broadcast(message) {
        const data = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    }

    async getMonitorHTML() {
        // Use the monitor.html from debug folder as template
        const templatePath = path.join(__dirname, '..', 'debug', 'monitor.html');
        try {
            return await fs.readFile(templatePath, 'utf8');
        } catch {
            // Return embedded HTML if template not found
            return this.getEmbeddedHTML();
        }
    }

    getEmbeddedHTML() {
        return `<!DOCTYPE html>
<html>
<head>
    <title>Claude Loop Monitor</title>
    <style>
        body {
            font-family: -apple-system, monospace;
            background: #0a0a0a;
            color: #e0e0e0;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            background: linear-gradient(45deg, #00ff88, #00aaff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .stat-card {
            background: #1a1a1a;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #2a2a2a;
        }
        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: #00ff88;
        }
        .timeline {
            background: #1a1a1a;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #2a2a2a;
            max-height: 400px;
            overflow-y: auto;
        }
        .timeline-item {
            padding: 10px;
            border-bottom: 1px solid #2a2a2a;
        }
        .success { color: #00ff88; }
        .error { color: #ff4444; }
        .warning { color: #ffaa00; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Claude Loop Monitor</h1>
        <div class="stats" id="stats">
            <div class="stat-card">
                <div class="stat-value" id="total-issues">0</div>
                <div>Total Issues</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="fixed-issues">0</div>
                <div>Fixed Issues</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="active-agents">0</div>
                <div>Active Agents</div>
            </div>
        </div>
        <div class="timeline" id="timeline">
            <h2>Activity Timeline</h2>
        </div>
    </div>
    <script>
        const ws = new WebSocket('ws://localhost:${this.server.address().port}');
        
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'state') {
                updateDisplay(message.data);
            } else if (message.type === 'timeline') {
                addTimelineEvent(message.data);
            }
        };
        
        function updateDisplay(state) {
            document.getElementById('total-issues').textContent = 
                Object.values(state.issues || {}).flat().length;
            document.getElementById('fixed-issues').textContent = 
                state.metrics?.issuesFixed || 0;
            document.getElementById('active-agents').textContent = 
                (state.agents || []).filter(a => a.status === 'active').length;
        }
        
        function addTimelineEvent(event) {
            const timeline = document.getElementById('timeline');
            const item = document.createElement('div');
            item.className = 'timeline-item ' + (event.type || '');
            item.textContent = new Date(event.timestamp).toLocaleTimeString() + ' - ' + event.message;
            timeline.appendChild(item);
        }
    </script>
</body>
</html>`;
    }
}

module.exports = Monitor;