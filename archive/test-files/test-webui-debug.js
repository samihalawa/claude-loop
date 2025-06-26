#!/usr/bin/env node

const WebSocket = require('ws');
const chalk = require('chalk');
const http = require('http');

class WebUIDebugTest {
    constructor() {
        this.testPort = 3341;
    }

    async runTests() {
        console.log(chalk.cyan('🔍 WebUI Debug Test\n'));
        
        const WebUI = require('./lib/web-ui');
        const webUI = new WebUI(this.testPort);
        
        try {
            // Start WebUI
            console.log(chalk.yellow('Starting WebUI server...'));
            await webUI.start();
            
            const token = webUI.sessionToken;
            console.log(chalk.gray(`Full token: ${token}`));
            
            // Test 1: HTTP request to health endpoint
            console.log(chalk.yellow('\n1. Testing HTTP health endpoint...'));
            try {
                const healthResponse = await this.makeHTTPRequest(`http://localhost:${this.testPort}/health?token=${token}`);
                console.log(chalk.green('✓ Health endpoint working'));
                console.log(chalk.gray('Response:', JSON.stringify(healthResponse)));
            } catch (error) {
                console.log(chalk.red(`❌ Health endpoint failed: ${error.message}`));
            }
            
            // Test 2: HTTP request to dashboard
            console.log(chalk.yellow('\n2. Testing HTTP dashboard endpoint...'));
            try {
                const dashboardResponse = await this.makeHTTPRequest(`http://localhost:${this.testPort}/?token=${token}`);
                console.log(chalk.green('✓ Dashboard endpoint working'));
                console.log(chalk.gray(`Dashboard response length: ${dashboardResponse.length}`));
            } catch (error) {
                console.log(chalk.red(`❌ Dashboard endpoint failed: ${error.message}`));
            }
            
            // Test 3: WebSocket upgrade request manually
            console.log(chalk.yellow('\n3. Testing WebSocket connection...'));
            try {
                await this.testWebSocketUpgrade(token);
            } catch (error) {
                console.log(chalk.red(`❌ WebSocket test failed: ${error.message}`));
                console.log(chalk.red(error.stack));
            }
            
        } catch (error) {
            console.error(chalk.red(`❌ Test setup failed: ${error.message}`));
        } finally {
            await webUI.stop();
            console.log(chalk.gray('WebUI stopped'));
        }
    }

    async makeHTTPRequest(url) {
        return new Promise((resolve, reject) => {
            const request = http.get(url, (response) => {
                let data = '';
                
                response.on('data', (chunk) => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    if (response.statusCode >= 200 && response.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (error) {
                            resolve(data);
                        }
                    } else {
                        reject(new Error(`HTTP ${response.statusCode}: ${data}`));
                    }
                });
            });
            
            request.on('error', reject);
            
            setTimeout(() => {
                request.destroy();
                reject(new Error('HTTP request timeout'));
            }, 5000);
        });
    }

    async testWebSocketUpgrade(token) {
        return new Promise((resolve, reject) => {
            console.log(chalk.gray(`Connecting to: ws://localhost:${this.testPort}?token=${token}`));
            
            const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${token}`, {
                handshakeTimeout: 10000,
                perMessageDeflate: false,
                headers: {
                    'User-Agent': 'WebSocket Test Client'
                }
            });
            
            let connected = false;
            let upgradeResponse = null;
            
            // Capture upgrade response
            ws.on('upgrade', (response) => {
                upgradeResponse = response;
                console.log(chalk.gray(`Upgrade response status: ${response.statusCode}`));
                console.log(chalk.gray(`Upgrade response headers:`, response.headers));
            });
            
            ws.on('open', () => {
                console.log(chalk.green('✓ WebSocket connected successfully'));
                connected = true;
                
                // Test sending a message
                ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            });
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    console.log(chalk.gray(`Received message:`, message));
                } catch (error) {
                    console.log(chalk.gray(`Received raw data:`, data.toString()));
                }
                
                ws.close();
                resolve();
            });
            
            ws.on('error', (error) => {
                console.error(chalk.red(`WebSocket error: ${error.message}`));
                if (error.response) {
                    console.log(chalk.red(`Error response status: ${error.response.statusCode}`));
                    console.log(chalk.red(`Error response headers:`, error.response.headers));
                }
                reject(error);
            });
            
            ws.on('close', (code, reason) => {
                console.log(chalk.gray(`WebSocket closed: ${code} - ${reason}`));
                if (!connected) {
                    reject(new Error(`WebSocket closed without connecting: ${code} - ${reason}`));
                } else if (!upgradeResponse) {
                    resolve(); // Connection was successful
                }
            });
            
            setTimeout(() => {
                if (!connected) {
                    ws.terminate();
                    reject(new Error('WebSocket connection timeout'));
                }
            }, 15000);
        });
    }
}

// Run if called directly
if (require.main === module) {
    const tester = new WebUIDebugTest();
    tester.runTests().catch(error => {
        console.error(chalk.red(`Debug test failed: ${error.message}`));
        process.exit(1);
    });
}

module.exports = WebUIDebugTest;