#!/usr/bin/env node

const WebSocket = require('ws');
const aiConfig = require('./lib/utils/ai-config-manager');

const TOKEN = '76ff531359bc2e9109d0e8e03d8bb27c720d28958cea939568c64f39d07487481aca0a880d724ada6857c4fde8a2a0e9';
const wsUrl = `ws://localhost:3003?token=${TOKEN}`;

console.log('🔗 Testing WebSocket connection...');
console.log('URL:', wsUrl);

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
    console.log('✅ WebSocket connected successfully!');
    
    // Send a test message
    const testMessage = { type: 'ping', timestamp: Date.now() };
    console.log('📤 Sending test message:', testMessage);
    ws.send(JSON.stringify(testMessage));
    
    setTimeout(() => {
        ws.close();
        console.log('🔚 Connection closed');
    }, 3000);
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data);
        console.log('📥 Received message:', message);
    } catch (error) {
        console.log('📥 Received raw data:', data.toString());
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
    console.log(`🔚 WebSocket closed with code ${code}, reason: ${reason}`);
});