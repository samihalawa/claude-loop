#!/usr/bin/env node

const WebSocket = require('ws');
const chalk = require('chalk');

class WebSocketStandaloneTest {
    constructor() {
        this.testPort = 3340;
        this.testResults = [];
    }

    async runTests() {
        console.log(chalk.cyan('🔌 WebSocket Standalone Integration Test\n'));
        
        const WebUI = require('./lib/web-ui');
        const webUI = new WebUI(this.testPort);
        
        try {
            // Start WebUI
            console.log(chalk.yellow('Starting WebUI server...'));
            await webUI.start();
            
            const token = webUI.sessionToken;
            console.log(chalk.gray(`Token: ${token.substring(0, 8)}...`));
            
            // Test WebSocket connection
            await this.testWebSocketConnection(token);
            
            // Test WebSocket message broadcasting
            await this.testWebSocketBroadcast(webUI, token);
            
            // Test WebSocket authentication
            await this.testWebSocketAuth(token);
            
            console.log(chalk.green('\n✅ All WebSocket tests passed!'));
            
        } catch (error) {
            console.error(chalk.red(`❌ WebSocket test failed: ${error.message}`));
            console.error(chalk.red(error.stack));
        } finally {
            await webUI.stop();
            console.log(chalk.gray('WebUI stopped'));
        }
    }

    async testWebSocketConnection(token) {
        console.log(chalk.yellow('Testing WebSocket Connection...'));
        
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${token}`, {
                handshakeTimeout: 5000,
                perMessageDeflate: false
            });
            
            let connected = false;
            
            ws.on('open', () => {
                console.log(chalk.green('✓ WebSocket connected successfully'));
                connected = true;
                ws.close();
                resolve();
            });
            
            ws.on('error', (error) => {
                console.error(chalk.red(`❌ WebSocket connection error: ${error.message}`));
                reject(error);
            });
            
            ws.on('close', (code, reason) => {
                console.log(chalk.gray(`WebSocket closed: ${code} - ${reason}`));
                if (!connected) {
                    reject(new Error(`WebSocket closed without connecting: ${code} - ${reason}`));
                }
            });
            
            setTimeout(() => {
                if (!connected) {
                    ws.terminate();
                    reject(new Error('WebSocket connection timeout'));
                }
            }, 10000);
        });
    }

    async testWebSocketBroadcast(webUI, token) {
        console.log(chalk.yellow('Testing WebSocket Broadcast...'));
        
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${token}`);
            let messageReceived = false;
            
            ws.on('open', () => {
                console.log(chalk.gray('WebSocket ready for broadcast test'));
                
                // Simulate session update after a short delay
                setTimeout(() => {
                    webUI.updateSession({
                        iterations: 1,
                        currentPhase: 'Testing broadcast',
                        testMessage: 'Hello WebSocket!'
                    });
                }, 1000);
            });
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    console.log(chalk.gray(`Received message type: ${message.type}`));
                    
                    if (message.type === 'session_update' || message.type === 'session_data') {
                        if (message.data && (message.data.testMessage || message.data.currentPhase)) {
                            console.log(chalk.green('✓ WebSocket broadcast working'));
                            messageReceived = true;
                            ws.close();
                            resolve();
                        }
                    }
                } catch (error) {
                    reject(new Error(`Failed to parse WebSocket message: ${error.message}`));
                }
            });
            
            ws.on('error', (error) => {
                reject(new Error(`WebSocket broadcast test error: ${error.message}`));
            });
            
            ws.on('close', () => {
                if (!messageReceived) {
                    reject(new Error('WebSocket closed without receiving broadcast message'));
                }
            });
            
            setTimeout(() => {
                if (!messageReceived) {
                    ws.close();
                    reject(new Error('WebSocket broadcast test timeout'));
                }
            }, 15000);
        });
    }

    async testWebSocketAuth(validToken) {
        console.log(chalk.yellow('Testing WebSocket Authentication...'));
        
        // Test invalid token
        return new Promise((resolve, reject) => {
            const invalidToken = 'invalid-token-12345';
            const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${invalidToken}`);
            
            let authFailed = false;
            
            ws.on('open', () => {
                reject(new Error('WebSocket should not connect with invalid token'));
            });
            
            ws.on('close', (code, reason) => {
                if (code === 1008) { // Invalid token close code
                    console.log(chalk.green('✓ WebSocket authentication working (invalid token rejected)'));
                    authFailed = true;
                    resolve();
                } else {
                    reject(new Error(`Unexpected close code: ${code} - ${reason}`));
                }
            });
            
            ws.on('error', (error) => {
                // Connection errors are expected for invalid tokens
                console.log(chalk.gray(`Expected auth error: ${error.message}`));
            });
            
            setTimeout(() => {
                if (!authFailed) {
                    ws.terminate();
                    reject(new Error('WebSocket auth test timeout'));
                }
            }, 5000);
        });
    }
}

// Run if called directly
if (require.main === module) {
    const tester = new WebSocketStandaloneTest();
    tester.runTests().catch(error => {
        console.error(chalk.red(`Test failed: ${error.message}`));
        process.exit(1);
    });
}

module.exports = WebSocketStandaloneTest;