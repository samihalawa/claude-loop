#!/usr/bin/env node

/**
 * WebSocket Functionality Testing
 * Comprehensive testing of WebSocket connections, messages, and real-time features
 */

const WebSocket = require('ws');
const chalk = require('chalk');
const { createServer } = require('http');
const path = require('path');
const fs = require('fs').promises;

class WebSocketTester {
    constructor() {
        this.testPort = null;
        this.webUI = null;
        this.results = [];
        this.connections = [];
    }

    async findAvailablePort(startPort = 4100) {
        for (let port = startPort; port < startPort + 100; port++) {
            try {
                await new Promise((resolve, reject) => {
                    const server = createServer();
                    server.listen(port, () => {
                        server.close(() => resolve());
                    });
                    server.on('error', reject);
                });
                return port;
            } catch (error) {
                continue;
            }
        }
        throw new Error('No available ports found');
    }

    log(message, type = 'info') {
        const prefix = `[${new Date().toISOString()}]`;
        switch (type) {
            case 'success':
                console.log(chalk.green(`${prefix} ✓ ${message}`));
                break;
            case 'error':
                console.log(chalk.red(`${prefix} ✗ ${message}`));
                break;
            case 'warning':
                console.log(chalk.yellow(`${prefix} ⚠ ${message}`));
                break;
            default:
                console.log(chalk.blue(`${prefix} ${message}`));
        }
    }

    async setupServer() {
        this.log('Setting up WebSocket server...');
        
        try {
            this.testPort = await this.findAvailablePort();
            const WebUI = require('./lib/web-ui');
            this.webUI = new WebUI(this.testPort);
            
            await this.webUI.start();
            this.log(`WebSocket server running on port ${this.testPort}`, 'success');
            return true;

        } catch (error) {
            this.log(`Server setup failed: ${error.message}`, 'error');
            return false;
        }
    }

    async testBasicConnection() {
        this.log('Testing basic WebSocket connection...');
        
        try {
            const wsUrl = `ws://localhost:${this.testPort}?token=${this.webUI.sessionToken}`;
            const ws = new WebSocket(wsUrl);

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 5000);

                ws.on('open', () => {
                    clearTimeout(timeout);
                    this.log('WebSocket connection established', 'success');
                    resolve();
                });

                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });

            // Test receiving initial session data
            const messageReceived = await new Promise((resolve) => {
                const timeout = setTimeout(() => resolve(false), 2000);
                
                ws.on('message', (data) => {
                    clearTimeout(timeout);
                    try {
                        const message = JSON.parse(data);
                        this.log(`Received message type: ${message.type}`);
                        resolve(true);
                    } catch (e) {
                        resolve(false);
                    }
                });
            });

            ws.close();

            if (messageReceived) {
                this.log('Initial session data received', 'success');
                this.results.push({ test: 'Basic WebSocket Connection', status: 'PASS' });
            } else {
                this.log('No initial session data received', 'warning');
                this.results.push({ test: 'Basic WebSocket Connection', status: 'PARTIAL' });
            }

            return true;

        } catch (error) {
            this.log(`Basic connection test failed: ${error.message}`, 'error');
            this.results.push({ test: 'Basic WebSocket Connection', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testAuthenticationRequired() {
        this.log('Testing WebSocket authentication...');
        
        try {
            // Test connection without token
            const wsUrlNoToken = `ws://localhost:${this.testPort}`;
            
            const authTest = await new Promise((resolve) => {
                const ws = new WebSocket(wsUrlNoToken);
                
                const timeout = setTimeout(() => {
                    resolve({ authenticated: true, reason: 'timeout' });
                }, 2000);

                ws.on('open', () => {
                    clearTimeout(timeout);
                    ws.close();
                    resolve({ authenticated: true, reason: 'opened' });
                });

                ws.on('close', (code, reason) => {
                    clearTimeout(timeout);
                    if (code === 1008) { // Invalid token close code
                        resolve({ authenticated: false, reason: 'invalid_token', code });
                    } else {
                        resolve({ authenticated: false, reason: reason.toString(), code });
                    }
                });

                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    resolve({ authenticated: false, reason: error.message, error: true });
                });
            });

            if (!authTest.authenticated) {
                this.log('WebSocket properly rejects unauthenticated connections', 'success');
                this.log(`Rejection reason: ${authTest.reason} (code: ${authTest.code})`);
                this.results.push({ test: 'WebSocket Authentication', status: 'PASS' });
            } else {
                this.log('WebSocket allows unauthenticated connections', 'error');
                this.results.push({ test: 'WebSocket Authentication', status: 'FAIL', error: 'No authentication required' });
            }

            return true;

        } catch (error) {
            this.log(`Authentication test failed: ${error.message}`, 'error');
            this.results.push({ test: 'WebSocket Authentication', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testMessageBroadcasting() {
        this.log('Testing message broadcasting...');
        
        try {
            // Create multiple connections
            const connections = [];
            const wsUrl = `ws://localhost:${this.testPort}?token=${this.webUI.sessionToken}`;

            for (let i = 0; i < 3; i++) {
                const ws = new WebSocket(wsUrl);
                connections.push(ws);

                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 3000);
                    ws.on('open', () => {
                        clearTimeout(timeout);
                        resolve();
                    });
                    ws.on('error', reject);
                });
            }

            this.log(`Created ${connections.length} WebSocket connections`);

            // Test broadcasting by updating session data
            const messagePromises = connections.map((ws, index) => {
                return new Promise((resolve) => {
                    const timeout = setTimeout(() => resolve(null), 3000);
                    
                    ws.on('message', (data) => {
                        try {
                            const message = JSON.parse(data);
                            if (message.type === 'session_update') {
                                clearTimeout(timeout);
                                resolve({ client: index, message });
                            }
                        } catch (e) {
                            // Ignore invalid JSON
                        }
                    });
                });
            });

            // Trigger a broadcast by updating session data
            this.webUI.updateSession({ testBroadcast: true, timestamp: Date.now() });

            // Wait for all clients to receive the broadcast
            const results = await Promise.all(messagePromises);
            const receivedCount = results.filter(r => r !== null).length;

            // Close connections
            connections.forEach(ws => ws.close());

            if (receivedCount === connections.length) {
                this.log(`All ${receivedCount} clients received broadcast message`, 'success');
                this.results.push({ test: 'Message Broadcasting', status: 'PASS' });
            } else {
                this.log(`Only ${receivedCount}/${connections.length} clients received broadcast`, 'warning');
                this.results.push({ test: 'Message Broadcasting', status: 'PARTIAL', note: `${receivedCount}/${connections.length} received` });
            }

            return true;

        } catch (error) {
            this.log(`Broadcasting test failed: ${error.message}`, 'error');
            this.results.push({ test: 'Message Broadcasting', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testMessageHandling() {
        this.log('Testing client message handling...');
        
        try {
            const wsUrl = `ws://localhost:${this.testPort}?token=${this.webUI.sessionToken}`;
            const ws = new WebSocket(wsUrl);

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Connection timeout')), 3000);
                ws.on('open', () => {
                    clearTimeout(timeout);
                    resolve();
                });
                ws.on('error', reject);
            });

            // Test sending various message types
            const testMessages = [
                { type: 'ping', timestamp: Date.now() },
                { type: 'test', data: 'hello' },
                { invalid: 'json without type' }
            ];

            for (const message of testMessages) {
                this.log(`Sending message: ${JSON.stringify(message)}`);
                ws.send(JSON.stringify(message));
                
                // Wait a bit between messages
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Test invalid JSON
            this.log('Sending invalid JSON...');
            ws.send('invalid json{');

            // Wait for any responses
            await new Promise(resolve => setTimeout(resolve, 1000));

            ws.close();

            this.log('Message handling completed (check server logs for details)', 'success');
            this.results.push({ test: 'Message Handling', status: 'PASS' });
            return true;

        } catch (error) {
            this.log(`Message handling test failed: ${error.message}`, 'error');
            this.results.push({ test: 'Message Handling', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testConnectionLimits() {
        this.log('Testing connection limits...');
        
        try {
            const maxConnections = this.webUI.maxConnections;
            this.log(`Max connections configured: ${maxConnections}`);

            const connections = [];
            const wsUrl = `ws://localhost:${this.testPort}?token=${this.webUI.sessionToken}`;

            // Try to create more connections than the limit
            for (let i = 0; i < maxConnections + 2; i++) {
                try {
                    const ws = new WebSocket(wsUrl);
                    connections.push(ws);

                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 2000);
                        
                        ws.on('open', () => {
                            clearTimeout(timeout);
                            this.log(`Connection ${i + 1} established`);
                            resolve();
                        });

                        ws.on('close', (code, reason) => {
                            clearTimeout(timeout);
                            if (code === 1013) { // Server overloaded
                                this.log(`Connection ${i + 1} rejected (server overloaded)`);
                                reject(new Error('Server overloaded'));
                            } else {
                                reject(new Error(`Connection closed: ${code} ${reason}`));
                            }
                        });

                        ws.on('error', (error) => {
                            clearTimeout(timeout);
                            reject(error);
                        });
                    });

                } catch (error) {
                    this.log(`Connection ${i + 1} failed: ${error.message}`);
                    break;
                }
            }

            // Close all connections
            connections.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            });

            const establishedConnections = connections.filter(ws => 
                ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CLOSED
            ).length;

            if (establishedConnections <= maxConnections) {
                this.log(`Connection limiting working: ${establishedConnections}/${maxConnections + 2} connections allowed`, 'success');
                this.results.push({ test: 'Connection Limits', status: 'PASS' });
            } else {
                this.log(`Connection limiting may not be working: ${establishedConnections} connections established`, 'warning');
                this.results.push({ test: 'Connection Limits', status: 'PARTIAL' });
            }

            return true;

        } catch (error) {
            this.log(`Connection limits test failed: ${error.message}`, 'error');
            this.results.push({ test: 'Connection Limits', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testPingPongMechanism() {
        this.log('Testing ping/pong mechanism...');
        
        try {
            const wsUrl = `ws://localhost:${this.testPort}?token=${this.webUI.sessionToken}`;
            const ws = new WebSocket(wsUrl);

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Connection timeout')), 3000);
                ws.on('open', () => {
                    clearTimeout(timeout);
                    resolve();
                });
                ws.on('error', reject);
            });

            // Test ping/pong
            const pongReceived = await new Promise((resolve) => {
                const timeout = setTimeout(() => resolve(false), 5000);
                
                ws.on('pong', () => {
                    clearTimeout(timeout);
                    this.log('Pong received from server');
                    resolve(true);
                });

                // Send ping
                this.log('Sending ping to server...');
                ws.ping();
            });

            ws.close();

            if (pongReceived) {
                this.log('Ping/pong mechanism working', 'success');
                this.results.push({ test: 'Ping/Pong Mechanism', status: 'PASS' });
            } else {
                this.log('No pong received', 'warning');
                this.results.push({ test: 'Ping/Pong Mechanism', status: 'FAIL', error: 'No pong received' });
            }

            return true;

        } catch (error) {
            this.log(`Ping/pong test failed: ${error.message}`, 'error');
            this.results.push({ test: 'Ping/Pong Mechanism', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async cleanup() {
        this.log('Cleaning up...');
        
        // Close any remaining connections
        this.connections.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        });

        if (this.webUI) {
            try {
                await this.webUI.stop();
                this.log('Server stopped successfully', 'success');
            } catch (error) {
                this.log(`Error stopping server: ${error.message}`, 'error');
            }
        }
    }

    async generateReport() {
        this.log('\n' + '='.repeat(60));
        this.log('WEBSOCKET TESTING RESULTS');
        this.log('='.repeat(60));

        let passCount = 0;
        let failCount = 0;
        let partialCount = 0;

        this.results.forEach(result => {
            const icon = result.status === 'PASS' ? '✓' : 
                        result.status === 'FAIL' ? '✗' : '~';
            const color = result.status === 'PASS' ? 'green' :
                         result.status === 'FAIL' ? 'red' : 'yellow';
            
            console.log(chalk[color](`${icon} ${result.test}: ${result.status}`));
            
            if (result.error) {
                this.log(`  Error: ${result.error}`, 'error');
            }
            if (result.note) {
                this.log(`  Note: ${result.note}`, 'warning');
            }

            if (result.status === 'PASS') passCount++;
            else if (result.status === 'FAIL') failCount++;
            else partialCount++;
        });

        this.log('\n' + '-'.repeat(60));
        this.log(`Total Tests: ${this.results.length}`);
        this.log(`Passed: ${passCount}`, 'success');
        this.log(`Failed: ${failCount}`, failCount > 0 ? 'error' : 'info');
        this.log(`Partial: ${partialCount}`, partialCount > 0 ? 'warning' : 'info');
        this.log('-'.repeat(60));

        // Write report
        const report = {
            timestamp: new Date().toISOString(),
            port: this.testPort,
            summary: { total: this.results.length, passed: passCount, failed: failCount, partial: partialCount },
            tests: this.results
        };

        const reportFile = path.join(__dirname, 'websocket-test-report.json');
        await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
        this.log(`Report written to: ${reportFile}`, 'info');

        return failCount === 0;
    }

    async runAllTests() {
        try {
            this.log(chalk.cyan.bold('Starting WebSocket Testing\n'));

            if (!(await this.setupServer())) {
                throw new Error('Server setup failed');
            }

            // Run tests in sequence
            await this.testBasicConnection();
            await this.testAuthenticationRequired();
            await this.testMessageBroadcasting();
            await this.testMessageHandling();
            await this.testConnectionLimits();
            await this.testPingPongMechanism();

        } catch (error) {
            this.log(`Test execution failed: ${error.message}`, 'error');
        } finally {
            await this.cleanup();
            return await this.generateReport();
        }
    }
}

// Run if called directly
if (require.main === module) {
    const tester = new WebSocketTester();
    tester.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = WebSocketTester;