#!/usr/bin/env node

const WebSocket = require('ws');

const token = '2bc2532e923c6d7c317f683da65561a7d1beb63eb6a3745ec3432cf7ec74c9fe5c51d22c5fbf19fbe5075a97060bf556c71b89a946f945db91b93b6a8b26788a';
const wsUrl = `ws://localhost:3333?token=${token}`;

console.log('🔌 Testing WebSocket Connection...');
console.log(`Connecting to: ${wsUrl.replace(token, '***TOKEN***')}`);

const ws = new WebSocket(wsUrl);
let messageCount = 0;

ws.on('open', () => {
    console.log('✅ WebSocket Connected!');
    
    // Send a ping
    console.log('📤 Sending ping...');
    ws.send(JSON.stringify({ type: 'ping' }));
    
    // Request session data
    console.log('📤 Requesting session data...');
    ws.send(JSON.stringify({ type: 'request_session' }));
    
    // Close after 5 seconds
    setTimeout(() => {
        console.log('🔌 Closing connection...');
        ws.close();
    }, 5000);
});

ws.on('message', (data) => {
    messageCount++;
    try {
        const message = JSON.parse(data);
        console.log(`📨 Message ${messageCount} - Type: ${message.type}`);
        
        if (message.type === 'session_data' || message.type === 'session_update') {
            console.log(`  📊 Current Phase: ${message.data.currentPhase}`);
            console.log(`  🔄 Running: ${message.data.isRunning}`);
            console.log(`  🔢 Iterations: ${message.data.iterations}`);
            console.log(`  📝 Output entries: ${message.data.output.length}`);
        } else if (message.type === 'pong') {
            console.log(`  🏓 Pong received at: ${message.timestamp}`);
        }
    } catch (e) {
        console.log(`❌ Invalid JSON message: ${data}`);
    }
});

ws.on('close', (code, reason) => {
    console.log(`🔌 Connection closed - Code: ${code}, Reason: ${reason}`);
    console.log(`📊 Total messages received: ${messageCount}`);
    
    if (messageCount > 0) {
        console.log('✅ WebSocket functionality is working correctly!');
    } else {
        console.log('❌ No messages received - potential issue');
    }
});

ws.on('error', (error) => {
    console.log(`❌ WebSocket error: ${error.message}`);
});