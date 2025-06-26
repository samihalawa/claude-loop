#\!/usr/bin/env node

const WebSocket = require('ws');
const aiConfig = require('./lib/utils/ai-config-manager');

const TOKEN = '76ff531359bc2e9109d0e8e03d8bb27c720d28958cea939568c64f39d07487481aca0a880d724ada6857c4fde8a2a0e9';

console.log('Testing WebSocket connection...');
const ws = new WebSocket(`ws://localhost:3003/?token=${TOKEN}`);

ws.on('open', () => {
    console.log('✅ WebSocket connected successfully\!');
    ws.close();
});

ws.on('error', (error) => {
    console.log('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
    console.log(`🔚 Closed with code ${code}, reason: ${reason || 'none'}`);
});
EOF < /dev/null