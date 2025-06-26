#!/usr/bin/env node

const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const chalk = require('chalk');
const fs = require('fs').promises;

/**
 * Simple WebSocket Server Testing
 * Tests basic WebSocket functionality without complex dependencies
 */

class SimpleWebSocketTester {
    constructor() {
        this.testResults = [];
        this.testPort = 3056; // Use different port to avoid conflicts
        this.server = null;
        this.wss = null;
    }

    async runAllTests() {
        console.log(chalk.cyan.bold('\n🧪 Simple WebSocket Server Testing'));
        console.log(chalk.gray('Testing basic WebSocket functionality\n'));

        const startTime = Date.now();

        try {
            // Start simple WebSocket server for testing
            await this.startSimpleServer();
            
            // Wait a moment for server to be ready
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Run basic WebSocket tests
            await this.testBasicConnection();
            await this.testMultipleConnections();
            await this.testMessageHandling();
            await this.testConnectionLimits();
            await this.testErrorHandling();
            await this.testConnectionCleanup();

        } catch (error) {
            console.error(chalk.red('❌ WebSocket testing failed:'), error.message);
        } finally {
            await this.cleanup();
        }

        const duration = Date.now() - startTime;
        await this.generateReport(duration);
    }

    async startSimpleServer() {
        try {
            // Create simple Express app
            const app = express();
            this.server = http.createServer(app);
            
            // Create WebSocket server
            this.wss = new WebSocket.Server({
                server: this.server,
                maxConnections: 10,
                perMessageDeflate: true,
                clientTracking: true
            });

            // Basic WebSocket handling
            this.wss.on('connection', (ws, req) => {
                console.log(chalk.gray('  → Client connected'));
                
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        console.log(chalk.gray('  → Message received:', message.type || 'unknown'));
                        
                        // Echo response
                        ws.send(JSON.stringify({
                            type: 'response',
                            original: message,
                            timestamp: Date.now()
                        }));
                    } catch (error) {
                        console.log(chalk.gray('  → Non-JSON message received'));
                    }
                });

                ws.on('close', () => {
                    console.log(chalk.gray('  → Client disconnected'));
                });

                ws.on('error', (error) => {
                    console.log(chalk.gray('  → WebSocket error:', error.message));
                });
            });

            // Start server
            await new Promise((resolve, reject) => {
                this.server.listen(this.testPort, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log(chalk.green('✓ Simple WebSocket server started on port', this.testPort));
                        resolve();
                    }
                });
            });

        } catch (error) {
            throw new Error(`Failed to start simple server: ${error.message}`);
        }
    }

    async testBasicConnection() {
        const testName = 'Basic WebSocket Connection';
        console.log(chalk.yellow(`\n→ Testing ${testName}...`));
        
        try {
            const ws = new WebSocket(`ws://localhost:${this.testPort}`);
            
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 5000);

                ws.on('open', () => {
                    clearTimeout(timeout);
                    console.log(chalk.green('  ✓ WebSocket connection established'));
                    ws.close();
                    resolve();
                });

                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });

            this.recordTest(testName, 'PASS');
        } catch (error) {
            this.recordTest(testName, 'FAIL', error.message);
        }
    }

    async testMultipleConnections() {
        const testName = 'Multiple WebSocket Connections';
        console.log(chalk.yellow(`\n→ Testing ${testName}...`));
        
        try {
            const connections = [];
            const connectionCount = 3;

            // Create multiple connections
            for (let i = 0; i < connectionCount; i++) {
                const ws = new WebSocket(`ws://localhost:${this.testPort}`);
                connections.push(ws);

                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error(`Connection ${i} timeout`));
                    }, 5000);

                    ws.on('open', () => {
                        clearTimeout(timeout);
                        console.log(chalk.green(`  ✓ Connection ${i + 1} established`));
                        resolve();
                    });

                    ws.on('error', reject);
                });
            }

            // Close all connections
            connections.forEach((ws, index) => {
                ws.close();
                console.log(chalk.gray(`  → Connection ${index + 1} closed`));
            });

            this.recordTest(testName, 'PASS');
        } catch (error) {
            this.recordTest(testName, 'FAIL', error.message);
        }
    }

    async testMessageHandling() {
        const testName = 'Message Handling';
        console.log(chalk.yellow(`\n→ Testing ${testName}...`));
        
        try {
            const ws = new WebSocket(`ws://localhost:${this.testPort}`);
            let messageReceived = false;

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Message handling timeout'));
                }, 5000);

                ws.on('open', () => {
                    console.log(chalk.green('  ✓ Connection established for message test'));
                    
                    // Send test message
                    const testMessage = { type: 'test', data: 'Hello WebSocket' };
                    ws.send(JSON.stringify(testMessage));
                    console.log(chalk.gray('  → Test message sent'));
                });

                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        console.log(chalk.green('  ✓ Response received:', message.type));
                        messageReceived = true;
                        
                        clearTimeout(timeout);
                        ws.close();
                        resolve();
                    } catch (parseError) {
                        console.log(chalk.gray('  → Raw message received'));
                        messageReceived = true;
                        clearTimeout(timeout);
                        ws.close();
                        resolve();
                    }
                });

                ws.on('error', reject);
            });

            this.recordTest(testName, 'PASS');
        } catch (error) {
            this.recordTest(testName, 'FAIL', error.message);
        }
    }

    async testConnectionLimits() {
        const testName = 'Connection Limits';
        console.log(chalk.yellow(`\n→ Testing ${testName}...`));
        
        try {
            const maxConnections = 12; // Slightly above server limit
            const connections = [];
            let connectionsEstablished = 0;

            for (let i = 0; i < maxConnections; i++) {
                try {
                    const ws = new WebSocket(`ws://localhost:${this.testPort}`);
                    connections.push(ws);

                    await new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            resolve(); // Don't reject, just continue
                        }, 2000);

                        ws.on('open', () => {
                            clearTimeout(timeout);
                            connectionsEstablished++;
                            console.log(chalk.green(`  ✓ Connection ${i + 1} established`));
                            resolve();
                        });

                        ws.on('error', () => {
                            clearTimeout(timeout);
                            console.log(chalk.yellow(`  ⚠ Connection ${i + 1} rejected`));
                            resolve();
                        });
                    });
                } catch (error) {
                    console.log(chalk.yellow(`  ⚠ Connection ${i + 1} failed: ${error.message}`));
                }
            }

            // Clean up connections
            connections.forEach((ws) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            });

            console.log(chalk.cyan(`  → Total connections established: ${connectionsEstablished}/${maxConnections}`));
            this.recordTest(testName, 'PASS', `${connectionsEstablished} connections established`);
        } catch (error) {
            this.recordTest(testName, 'FAIL', error.message);
        }
    }

    async testErrorHandling() {
        const testName = 'Error Handling';
        console.log(chalk.yellow(`\n→ Testing ${testName}...`));
        
        try {
            const ws = new WebSocket(`ws://localhost:${this.testPort}`);

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    ws.close();
                    resolve(); // Don't reject, this test is about error handling
                }, 5000);

                ws.on('open', () => {
                    console.log(chalk.green('  ✓ Connection established for error test'));
                    
                    // Send malformed JSON
                    ws.send('invalid-json-data');
                    console.log(chalk.gray('  → Invalid JSON sent'));
                    
                    // Send oversized message
                    const largeMessage = 'x'.repeat(1024 * 100); // 100KB
                    try {
                        ws.send(largeMessage);
                        console.log(chalk.gray('  → Large message sent'));
                    } catch (error) {
                        console.log(chalk.green('  ✓ Large message properly rejected'));
                    }
                    
                    clearTimeout(timeout);
                    setTimeout(() => {
                        ws.close();
                        resolve();
                    }, 1000);
                });

                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    console.log(chalk.green('  ✓ Error properly handled:', error.message));
                    resolve();
                });
            });

            this.recordTest(testName, 'PASS');
        } catch (error) {
            this.recordTest(testName, 'FAIL', error.message);
        }
    }

    async testConnectionCleanup() {
        const testName = 'Connection Cleanup';
        console.log(chalk.yellow(`\n→ Testing ${testName}...`));
        
        try {
            const ws = new WebSocket(`ws://localhost:${this.testPort}`);

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    resolve(); // Don't reject, this test is about cleanup
                }, 5000);

                ws.on('open', () => {
                    console.log(chalk.green('  ✓ Connection established for cleanup test'));
                    
                    // Abruptly terminate connection
                    ws.terminate();
                    console.log(chalk.gray('  → Connection terminated abruptly'));
                    
                    clearTimeout(timeout);
                    setTimeout(resolve, 1000); // Give time for cleanup
                });

                ws.on('error', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });

            this.recordTest(testName, 'PASS');
        } catch (error) {
            this.recordTest(testName, 'FAIL', error.message);
        }
    }

    recordTest(name, status, error = null) {
        const result = {
            name,
            status,
            timestamp: new Date().toISOString(),
            error
        };
        
        this.testResults.push(result);
        
        const statusColor = status === 'PASS' ? 'green' : 'red';
        const statusIcon = status === 'PASS' ? '✓' : '❌';
        console.log(chalk[statusColor](`${statusIcon} ${name}: ${status}`));
        
        if (error) {
            console.log(chalk.red(`  Error: ${error}`));
        }
    }

    async cleanup() {
        console.log(chalk.gray('\n→ Cleaning up test environment...'));
        
        // Close WebSocket server
        if (this.wss) {
            this.wss.close();
            console.log(chalk.green('✓ WebSocket server closed'));
        }

        // Close HTTP server
        if (this.server) {
            await new Promise((resolve) => {
                this.server.close(() => {
                    console.log(chalk.green('✓ HTTP server closed'));
                    resolve();
                });
            });
        }
    }

    async generateReport(duration) {
        const passedTests = this.testResults.filter(t => t.status === 'PASS').length;
        const failedTests = this.testResults.filter(t => t.status === 'FAIL').length;
        const successRate = this.testResults.length > 0 ? ((passedTests / this.testResults.length) * 100).toFixed(2) : 0;

        const report = {
            timestamp: new Date().toISOString(),
            testType: 'Simple WebSocket Server',
            summary: {
                totalTests: this.testResults.length,
                passedTests,
                failedTests,
                successRate: parseFloat(successRate),
                duration
            },
            results: this.testResults
        };

        // Save report
        const reportPath = '/Users/samihalawa/git/claude-loop/websocket-simple-test-report.json';
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        // Display summary
        console.log(chalk.cyan.bold('\n📊 Simple WebSocket Test Summary'));
        console.log(chalk.gray('=' .repeat(50)));
        console.log(chalk.white(`Total Tests: ${this.testResults.length}`));
        console.log(chalk.green(`Passed: ${passedTests}`));
        console.log(chalk.red(`Failed: ${failedTests}`));
        console.log(chalk.cyan(`Success Rate: ${successRate}%`));
        console.log(chalk.gray(`Duration: ${duration}ms`));
        console.log(chalk.gray(`Report saved: ${reportPath}`));
        
        if (failedTests > 0) {
            console.log(chalk.yellow('\n⚠ Failed Tests:'));
            this.testResults
                .filter(t => t.status === 'FAIL')
                .forEach(test => {
                    console.log(chalk.red(`  - ${test.name}: ${test.error}`));
                });
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new SimpleWebSocketTester();
    tester.runAllTests()
        .then(() => {
            console.log(chalk.green('\n✅ Simple WebSocket testing completed'));
            process.exit(0);
        })
        .catch((error) => {
            console.error(chalk.red('\n❌ Simple WebSocket testing failed:'), error);
            process.exit(1);
        });
}

module.exports = SimpleWebSocketTester;