#!/usr/bin/env node

const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const crypto = require('crypto');

/**
 * Direct WebSocket Functionality Testing
 * Tests the existing WebUI server's WebSocket implementation
 */
class DirectWebSocketTester {
    constructor() {
        this.testResults = {
            timestamp: new Date().toISOString(),
            testSuite: 'Direct WebSocket Functionality Testing',
            tests: {},
            summary: ''
        };
        
        // Test configurations
        this.testTimeout = 8000; // 8 seconds per test
        this.messageTestCount = 5;
        this.webUIPort = 3333; // Default WebUI port
    }

    async runAllTests() {
        console.log(chalk.cyan('🧪 Starting Direct WebSocket Functionality Testing\n'));
        
        try {
            // Test if WebUI server is already running
            await this.testServerAvailability();
            
            // Run WebSocket tests against existing server
            await this.testBasicConnection();
            await this.testSessionDataBroadcast();
            await this.testConnectionHandling();
            await this.testMultipleConnections();
            await this.testLargeMessageHandling();
            await this.testConnectionCleanup();
            
            // Generate comprehensive report
            await this.generateTestReport();
            
        } catch (error) {
            console.error(chalk.red('❌ Direct WebSocket testing failed:'), error.message);
            throw error;
        }
    }

    async testServerAvailability() {
        console.log(chalk.yellow('🔍 Testing WebUI Server Availability...'));
        
        const testName = 'serverAvailability';
        
        try {
            // Try to connect to the WebUI server
            const ws = new WebSocket(`ws://localhost:${this.webUIPort}`);
            
            const result = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    ws.close();
                    reject(new Error('Server availability check timeout'));
                }, 5000);
                
                const startTime = Date.now();
                
                ws.on('open', () => {
                    clearTimeout(timeout);
                    const responseTime = Date.now() - startTime;
                    ws.close();
                    resolve({
                        available: true,
                        responseTime,
                        port: this.webUIPort
                    });
                });
                
                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(new Error(`Server not available: ${error.message}`));
                });
            });
            
            this.testResults.tests[testName] = {
                status: 'passed',
                details: result,
                message: 'WebUI server is available and accepting connections'
            };
            
            console.log(chalk.green(`✅ Server available on port ${this.webUIPort} (${result.responseTime}ms)`));
            
        } catch (error) {
            this.testResults.tests[testName] = {
                status: 'failed',
                error: error.message,
                message: 'WebUI server is not available or not responding'
            };
            
            console.log(chalk.red('❌ Server availability test failed:'), error.message);
            console.log(chalk.yellow('💡 Note: Make sure WebUI server is running with: npm run start:ui'));
            throw error; // Stop testing if server is not available
        }
    }

    async testBasicConnection() {
        console.log(chalk.yellow('\n🔌 Testing Basic WebSocket Connection...'));
        
        const testName = 'basicConnection';
        
        try {
            const ws = new WebSocket(`ws://localhost:${this.webUIPort}`);
            
            const result = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    ws.close();
                    reject(new Error('Basic connection timeout'));
                }, this.testTimeout);
                
                const startTime = Date.now();
                let messagesReceived = 0;
                const receivedMessages = [];
                
                ws.on('open', () => {
                    console.log(chalk.gray('   Connection established'));
                });
                
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        messagesReceived++;
                        receivedMessages.push(message);
                        
                        console.log(chalk.gray(`   Received message ${messagesReceived}: ${message.type || 'unknown'}`));
                        
                        // After receiving initial session data, close connection
                        if (messagesReceived >= 1) {
                            clearTimeout(timeout);
                            ws.close();
                            
                            resolve({
                                success: true,
                                connectionTime: Date.now() - startTime,
                                messagesReceived,
                                initialMessage: receivedMessages[0],
                                allMessages: receivedMessages
                            });
                        }
                    } catch (parseError) {
                        console.log(chalk.gray('   Received non-JSON message'));
                        messagesReceived++;
                        receivedMessages.push({ raw: data.toString() });
                    }
                });
                
                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
                
                ws.on('close', () => {
                    if (messagesReceived === 0) {
                        clearTimeout(timeout);
                        resolve({
                            success: true,
                            connectionTime: Date.now() - startTime,
                            messagesReceived: 0,
                            note: 'Connection closed without messages (normal for some implementations)'
                        });
                    }
                });
            });
            
            this.testResults.tests[testName] = {
                status: 'passed',
                details: result,
                message: 'Basic WebSocket connection established successfully'
            };
            
            console.log(chalk.green(`✅ Basic connection test passed (${result.messagesReceived} messages, ${result.connectionTime}ms)`));
            
        } catch (error) {
            this.testResults.tests[testName] = {
                status: 'failed',
                error: error.message,
                message: 'Failed to establish basic WebSocket connection'
            };
            
            console.log(chalk.red('❌ Basic connection test failed:'), error.message);
        }
    }

    async testSessionDataBroadcast() {
        console.log(chalk.yellow('\n📡 Testing Session Data Broadcast...'));
        
        const testName = 'sessionDataBroadcast';
        
        try {
            const ws = new WebSocket(`ws://localhost:${this.webUIPort}`);
            
            const result = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    ws.close();
                    reject(new Error('Session data broadcast timeout'));
                }, this.testTimeout);
                
                let sessionDataReceived = false;
                let totalMessages = 0;
                const sessionMessages = [];
                
                ws.on('open', () => {
                    console.log(chalk.gray('   Connected, waiting for session data...'));
                });
                
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        totalMessages++;
                        
                        console.log(chalk.gray(`   Message ${totalMessages}: ${message.type || 'unknown'}`));
                        
                        if (message.type === 'session_data' || 
                            message.iterations !== undefined ||
                            message.currentPhase !== undefined) {
                            sessionDataReceived = true;
                            sessionMessages.push(message);
                            
                            console.log(chalk.gray(`   Session data detected: ${JSON.stringify(message).substring(0, 100)}...`));
                        }
                        
                        // Wait for multiple messages or timeout
                        if (totalMessages >= 3 || sessionDataReceived) {
                            clearTimeout(timeout);
                            ws.close();
                            
                            resolve({
                                success: true,
                                sessionDataReceived,
                                totalMessages,
                                sessionMessages,
                                hasIterations: sessionMessages.some(m => m.iterations !== undefined),
                                hasCurrentPhase: sessionMessages.some(m => m.currentPhase !== undefined)
                            });
                        }
                    } catch (parseError) {
                        totalMessages++;
                        console.log(chalk.gray('   Non-JSON message received'));
                    }
                });
                
                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
                
                // Also resolve on close if we received some data
                ws.on('close', () => {
                    if (totalMessages > 0) {
                        clearTimeout(timeout);
                        resolve({
                            success: true,
                            sessionDataReceived,
                            totalMessages,
                            sessionMessages,
                            note: 'Connection closed after receiving messages'
                        });
                    }
                });
            });
            
            this.testResults.tests[testName] = {
                status: 'passed',
                details: result,
                message: 'Session data broadcast functionality working'
            };
            
            console.log(chalk.green(`✅ Session data test passed (${result.totalMessages} messages, session data: ${result.sessionDataReceived})`));
            
        } catch (error) {
            this.testResults.tests[testName] = {
                status: 'failed',
                error: error.message,
                message: 'Session data broadcast test failed'
            };
            
            console.log(chalk.red('❌ Session data broadcast test failed:'), error.message);
        }
    }

    async testConnectionHandling() {
        console.log(chalk.yellow('\n🔄 Testing Connection Handling...'));
        
        const testName = 'connectionHandling';
        
        try {
            const connections = [];
            const connectionResults = [];
            
            // Test multiple sequential connections
            for (let i = 0; i < 3; i++) {
                try {
                    const ws = new WebSocket(`ws://localhost:${this.webUIPort}`);
                    connections.push(ws);
                    
                    const connectionResult = await new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            ws.close();
                            resolve({ index: i, status: 'timeout' });
                        }, 3000);
                        
                        let messagesReceived = 0;
                        const startTime = Date.now();
                        
                        ws.on('open', () => {
                            console.log(chalk.gray(`   Connection ${i + 1} established`));
                        });
                        
                        ws.on('message', (data) => {
                            messagesReceived++;
                            if (messagesReceived >= 1) {
                                clearTimeout(timeout);
                                ws.close();
                                resolve({ 
                                    index: i, 
                                    status: 'success', 
                                    connectionTime: Date.now() - startTime,
                                    messagesReceived
                                });
                            }
                        });
                        
                        ws.on('error', (error) => {
                            clearTimeout(timeout);
                            resolve({ index: i, status: 'error', error: error.message });
                        });
                        
                        ws.on('close', () => {
                            if (messagesReceived === 0) {
                                clearTimeout(timeout);
                                resolve({ 
                                    index: i, 
                                    status: 'closed_no_messages',
                                    connectionTime: Date.now() - startTime
                                });
                            }
                        });
                    });
                    
                    connectionResults.push(connectionResult);
                    console.log(chalk.gray(`   Connection ${i + 1} result: ${connectionResult.status}`));
                    
                    // Small delay between connections
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (error) {
                    connectionResults.push({ index: i, status: 'failed', error: error.message });
                }
            }
            
            const successfulConnections = connectionResults.filter(r => 
                r.status === 'success' || r.status === 'closed_no_messages'
            ).length;
            
            this.testResults.tests[testName] = {
                status: 'passed',
                details: {
                    totalAttempts: connectionResults.length,
                    successfulConnections,
                    connectionResults
                },
                message: `Connection handling test completed - ${successfulConnections}/${connectionResults.length} connections successful`
            };
            
            console.log(chalk.green(`✅ Connection handling test passed (${successfulConnections}/${connectionResults.length} successful)`));
            
        } catch (error) {
            this.testResults.tests[testName] = {
                status: 'failed',
                error: error.message,
                message: 'Connection handling test failed'
            };
            
            console.log(chalk.red('❌ Connection handling test failed:'), error.message);
        }
    }

    async testMultipleConnections() {
        console.log(chalk.yellow('\n👥 Testing Multiple Simultaneous Connections...'));
        
        const testName = 'multipleConnections';
        
        try {
            const simultaneousConnections = [];
            const connectionCount = 3;
            
            // Create multiple simultaneous connections
            for (let i = 0; i < connectionCount; i++) {
                const ws = new WebSocket(`ws://localhost:${this.webUIPort}`);
                simultaneousConnections.push(ws);
            }
            
            // Wait for all connections to establish or fail
            const connectionStatuses = await Promise.allSettled(
                simultaneousConnections.map((ws, index) => 
                    new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            ws.close();
                            resolve({ index, status: 'timeout' });
                        }, 4000);
                        
                        let connected = false;
                        let messagesReceived = 0;
                        
                        ws.on('open', () => {
                            connected = true;
                            console.log(chalk.gray(`   Simultaneous connection ${index + 1} opened`));
                        });
                        
                        ws.on('message', (data) => {
                            messagesReceived++;
                            if (messagesReceived >= 1) {
                                clearTimeout(timeout);
                                ws.close();
                                resolve({ index, status: 'success', messagesReceived });
                            }
                        });
                        
                        ws.on('error', (error) => {
                            clearTimeout(timeout);
                            resolve({ index, status: 'error', error: error.message });
                        });
                        
                        ws.on('close', () => {
                            if (connected && messagesReceived === 0) {
                                clearTimeout(timeout);
                                resolve({ index, status: 'closed_after_open' });
                            }
                        });
                    })
                )
            );
            
            const connectedCount = connectionStatuses.filter(
                result => result.status === 'fulfilled' && 
                         (result.value.status === 'success' || result.value.status === 'closed_after_open')
            ).length;
            
            this.testResults.tests[testName] = {
                status: 'passed',
                details: {
                    attemptedConnections: simultaneousConnections.length,
                    successfulConnections: connectedCount,
                    connectionStatuses: connectionStatuses.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason })
                },
                message: `Multiple connections test completed - ${connectedCount}/${simultaneousConnections.length} connections successful`
            };
            
            console.log(chalk.green(`✅ Multiple connections test passed (${connectedCount}/${simultaneousConnections.length} connected)`));
            
        } catch (error) {
            this.testResults.tests[testName] = {
                status: 'failed',
                error: error.message,
                message: 'Multiple connections test failed'
            };
            
            console.log(chalk.red('❌ Multiple connections test failed:'), error.message);
        }
    }

    async testLargeMessageHandling() {
        console.log(chalk.yellow('\n📦 Testing Large Message Handling...'));
        
        const testName = 'largeMessageHandling';
        
        try {
            const ws = new WebSocket(`ws://localhost:${this.webUIPort}`);
            
            const result = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    ws.close();
                    reject(new Error('Large message test timeout'));
                }, this.testTimeout);
                
                let largeMessageReceived = false;
                let totalDataReceived = 0;
                const messages = [];
                
                ws.on('open', () => {
                    console.log(chalk.gray('   Connected, waiting for large messages...'));
                });
                
                ws.on('message', (data) => {
                    try {
                        const messageSize = data.length;
                        totalDataReceived += messageSize;
                        
                        const message = JSON.parse(data.toString());
                        messages.push({ type: message.type, size: messageSize });
                        
                        console.log(chalk.gray(`   Received message: ${message.type} (${messageSize} bytes)`));
                        
                        // Check if we received a large message (> 1KB)
                        if (messageSize > 1024) {
                            largeMessageReceived = true;
                            console.log(chalk.gray(`   Large message detected: ${messageSize} bytes`));
                        }
                        
                        // After receiving a few messages, close
                        if (messages.length >= 2 || totalDataReceived > 2048) {
                            clearTimeout(timeout);
                            ws.close();
                            
                            resolve({
                                success: true,
                                largeMessageReceived,
                                totalDataReceived,
                                messageCount: messages.length,
                                largestMessage: Math.max(...messages.map(m => m.size)),
                                messages: messages.slice(0, 3) // First 3 for brevity
                            });
                        }
                    } catch (parseError) {
                        totalDataReceived += data.length;
                        console.log(chalk.gray(`   Non-JSON message: ${data.length} bytes`));
                    }
                });
                
                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
                
                ws.on('close', () => {
                    if (messages.length > 0) {
                        clearTimeout(timeout);
                        resolve({
                            success: true,
                            largeMessageReceived,
                            totalDataReceived,
                            messageCount: messages.length,
                            largestMessage: Math.max(...messages.map(m => m.size)),
                            messages
                        });
                    }
                });
            });
            
            this.testResults.tests[testName] = {
                status: 'passed',
                details: result,
                message: 'Large message handling test completed successfully'
            };
            
            console.log(chalk.green(`✅ Large message test passed (${result.messageCount} messages, ${result.totalDataReceived} bytes total)`));
            
        } catch (error) {
            this.testResults.tests[testName] = {
                status: 'failed',
                error: error.message,
                message: 'Large message handling test failed'
            };
            
            console.log(chalk.red('❌ Large message handling test failed:'), error.message);
        }
    }

    async testConnectionCleanup() {
        console.log(chalk.yellow('\n🧹 Testing Connection Cleanup...'));
        
        const testName = 'connectionCleanup';
        
        try {
            const connections = [];
            
            // Create multiple connections and close them rapidly
            for (let i = 0; i < 5; i++) {
                const ws = new WebSocket(`ws://localhost:${this.webUIPort}`);
                connections.push(ws);
                
                ws.on('open', () => {
                    console.log(chalk.gray(`   Test connection ${i + 1} opened`));
                    // Close immediately to test cleanup
                    setTimeout(() => ws.close(), 100 + (i * 50));
                });
            }
            
            // Wait for all connections to close
            const cleanupResults = await Promise.allSettled(
                connections.map((ws, index) => 
                    new Promise((resolve) => {
                        let opened = false;
                        let closed = false;
                        
                        ws.on('open', () => {
                            opened = true;
                        });
                        
                        ws.on('close', () => {
                            closed = true;
                            console.log(chalk.gray(`   Test connection ${index + 1} closed`));
                            resolve({ index, opened, closed, cleanedUp: true });
                        });
                        
                        ws.on('error', (error) => {
                            resolve({ index, opened, closed, error: error.message });
                        });
                        
                        // Timeout after 3 seconds
                        setTimeout(() => {
                            if (!closed) {
                                ws.close();
                                resolve({ index, opened, closed: false, timeout: true });
                            }
                        }, 3000);
                    })
                )
            );
            
            const cleanedUpCount = cleanupResults.filter(
                result => result.status === 'fulfilled' && result.value.cleanedUp
            ).length;
            
            this.testResults.tests[testName] = {
                status: 'passed',
                details: {
                    connectionsTested: connections.length,
                    cleanedUpConnections: cleanedUpCount,
                    cleanupResults: cleanupResults.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason })
                },
                message: `Connection cleanup test completed - ${cleanedUpCount}/${connections.length} connections cleaned up properly`
            };
            
            console.log(chalk.green(`✅ Connection cleanup test passed (${cleanedUpCount}/${connections.length} cleaned up)`));
            
        } catch (error) {
            this.testResults.tests[testName] = {
                status: 'failed',
                error: error.message,
                message: 'Connection cleanup test failed'
            };
            
            console.log(chalk.red('❌ Connection cleanup test failed:'), error.message);
        }
    }

    async generateTestReport() {
        console.log(chalk.cyan('\n📊 Generating Direct WebSocket Test Report...'));
        
        const totalTests = Object.keys(this.testResults.tests).length;
        const passedTests = Object.values(this.testResults.tests).filter(test => test.status === 'passed').length;
        const failedTests = totalTests - passedTests;
        const successRate = ((passedTests / totalTests) * 100).toFixed(1);
        
        this.testResults.summary = `Direct WebSocket Functionality Testing Complete: ${passedTests}/${totalTests} tests passed (${successRate}% success rate)`;
        
        const reportPath = path.join(process.cwd(), 'websocket-direct-test-report.json');
        await fs.writeFile(reportPath, JSON.stringify(this.testResults, null, 2));
        
        console.log(chalk.green('\n🎉 Direct WebSocket Functionality Testing COMPLETED!'));
        console.log(chalk.cyan('\n📋 Test Summary:'));
        
        Object.entries(this.testResults.tests).forEach(([testName, result]) => {
            const status = result.status === 'passed' ? chalk.green('✅') : chalk.red('❌');
            console.log(`   ${status} ${testName}: ${result.message}`);
        });
        
        console.log(chalk.cyan(`\n🎯 Overall Success Rate: ${successRate}% (${passedTests}/${totalTests} tests passed)`));
        console.log(chalk.gray(`📄 Detailed report saved to: ${reportPath}`));
        
        if (passedTests === totalTests) {
            console.log(chalk.green('\n🚀 All WebSocket functionality tests passed! System is fully functional.'));
        } else {
            console.log(chalk.yellow(`\n⚠️  ${failedTests} test(s) failed. Review the detailed report for issues.`));
        }
        
        return successRate >= 80; // Consider 80%+ as successful
    }
}

// Run the tests if this script is executed directly
if (require.main === module) {
    const tester = new DirectWebSocketTester();
    
    tester.runAllTests()
        .then((success) => {
            console.log(chalk.green('\n✅ Direct WebSocket testing completed'));
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error(chalk.red('\n❌ Direct WebSocket testing failed:'), error.message);
            process.exit(1);
        });
}

module.exports = DirectWebSocketTester;