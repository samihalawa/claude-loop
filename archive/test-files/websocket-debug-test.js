#!/usr/bin/env node

const WebSocket = require('ws');
const { spawn } = require('child_process');

async function testWebSocketAuth() {
    console.log('🔌 Testing WebSocket Authentication...');
    
    // Start WebUI server
    const webUIProcess = spawn('node', ['start-webui.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'development', WEBUI_PORT: '3335' }
    });
    
    let validToken = null;
    
    return new Promise((resolve) => {
        webUIProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('WebUI Output:', output);
            
            if (output.includes('Full Token:')) {
                const tokenMatch = output.match(/Full Token: ([a-f0-9]+)/);
                if (tokenMatch) {
                    validToken = tokenMatch[1];
                    console.log('✅ Valid token extracted:', validToken.substring(0, 8) + '...');
                    
                    setTimeout(async () => {
                        await runWebSocketTests(validToken);
                        webUIProcess.kill('SIGTERM');
                        resolve();
                    }, 3000);
                }
            }
        });
        
        webUIProcess.stderr.on('data', (data) => {
            console.log('WebUI Error:', data.toString());
        });
    });
}

async function runWebSocketTests(validToken) {
    console.log('\n--- Testing Valid Token ---');
    await testConnection(`ws://localhost:3335?token=${validToken}`, 'Valid Token', true);
    
    console.log('\n--- Testing Invalid Token ---');
    await testConnection(`ws://localhost:3335?token=invalid_token_12345`, 'Invalid Token', false);
    
    console.log('\n--- Testing No Token ---');
    await testConnection(`ws://localhost:3335`, 'No Token', false);
    
    console.log('\n--- Testing Empty Token ---');
    await testConnection(`ws://localhost:3335?token=`, 'Empty Token', false);
}

function testConnection(url, description, shouldSucceed) {
    return new Promise((resolve) => {
        console.log(`🔗 Testing: ${description}`);
        console.log(`   URL: ${url}`);
        
        const ws = new WebSocket(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (WebSocket Debug Test)'
            }
        });
        
        let resolved = false;
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                console.log(`   ⏰ Timeout (${shouldSucceed ? 'UNEXPECTED' : 'expected'})`);
                ws.close();
                resolve();
            }
        }, 5000);
        
        ws.on('open', () => {
            // For security tests, wait to see if connection gets closed immediately
            if (!shouldSucceed) {
                setTimeout(() => {
                    if (!resolved && ws.readyState === WebSocket.OPEN) {
                        resolved = true;
                        clearTimeout(timeout);
                        console.log(`   ❌ Connected and stayed open (SECURITY ISSUE!)`);
                        ws.close();
                        resolve();
                    }
                }, 100); // Wait 100ms to see if server closes connection
            } else {
                resolved = true;
                clearTimeout(timeout);
                console.log(`   ✅ Connected (expected)`);
                ws.close();
                resolve();
            }
        });
        
        ws.on('error', (error) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                console.log(`   ❌ Error: ${error.message} (${shouldSucceed ? 'UNEXPECTED' : 'expected'})`);
                resolve();
            }
        });
        
        ws.on('close', (code, reason) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                if (shouldSucceed) {
                    console.log(`   🔒 Closed: ${code} ${reason} (${code === 1000 ? 'expected' : 'UNEXPECTED'})`);
                } else {
                    // For invalid tokens, we expect certain close codes
                    if (code === 1008 || code === 1005) {
                        console.log(`   ✅ Properly rejected: ${code} ${reason} (expected)`);
                    } else {
                        console.log(`   🔒 Closed: ${code} ${reason} (unexpected code)`);
                    }
                }
                resolve();
            }
        });
    });
}

if (require.main === module) {
    testWebSocketAuth().catch(console.error);
}