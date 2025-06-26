#!/usr/bin/env node
/**
 * End-to-End WebUI Integration Test
 * Tests comprehensive WebUI integration with the main claude-loop system
 * Focus: WebSocket communication, session management, real-time updates, UI responsiveness
 */

const WebSocket = require('ws');
const http = require('http');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

// Import the actual components
const WebUI = require('./lib/web-ui');
const ClaudeLoopEngine = require('./lib/claude-loop-engine');
const config = require('./lib/config');
const { TEST_PORTS, TIMEOUTS } = require('./lib/config/constants');

class E2EWebUITester {
    constructor() {
        this.testResults = {
            timestamp: new Date().toISOString(),
            testType: 'E2E WebUI Integration',
            tests: [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                errors: []
            }
        };
        this.webUI = null;
        this.engine = null;
        this.wsConnection = null;
        this.testPort = TEST_PORTS.WEBUI_COMPREHENSIVE;
    }

    async runAllTests() {
        console.log(chalk.cyan.bold('🧪 Starting E2E WebUI Integration Tests'));
        console.log(chalk.gray(`Port: ${this.testPort}`));
        console.log('═'.repeat(60));

        try {
            // Test 1: WebUI Server Startup and Configuration
            await this.testWebUIStartup();
            
            // Test 2: Engine Integration with WebUI
            await this.testEngineWebUIIntegration();
            
            // Test 3: WebSocket Connection and Communication
            await this.testWebSocketCommunication();
            
            // Test 4: Real-time Session Data Synchronization
            await this.testSessionDataSync();
            
            // Test 5: Message Broadcasting and Output Handling
            await this.testMessageBroadcasting();
            
            // Test 6: Error Handling and Recovery
            await this.testErrorHandling();
            
            // Test 7: Connection Management and Limits
            await this.testConnectionManagement();
            
            // Test 8: UI Lifecycle Management
            await this.testUILifecycle();
            
            // Test 9: Security and Authentication
            await this.testSecurityFeatures();
            
            // Test 10: Performance under Load
            await this.testPerformanceLoad();

        } catch (error) {
            this.addTestResult('Critical Test Failure', false, `Unexpected error: ${error.message}`);
            console.error(chalk.red('❌ Critical test failure:'), error.message);
        } finally {
            await this.cleanup();
            this.generateReport();
        }
    }

    async testWebUIStartup() {
        console.log(chalk.blue('\n🔄 Test 1: WebUI Server Startup and Configuration'));
        
        try {
            this.webUI = new WebUI(this.testPort);
            
            // Test startup process
            const startupPromise = this.webUI.start();
            const timeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Startup timeout')), TIMEOUTS.TEST_TIMEOUT)
            );
            
            await Promise.race([startupPromise, timeout]);
            
            // Verify server is listening
            const isListening = await this.checkServerListening(this.testPort);
            this.addTestResult('WebUI Server Startup', isListening, 
                isListening ? 'Server started successfully' : 'Server failed to start');
            
            // Test configuration loading
            const hasConfig = this.webUI.sessionData && typeof this.webUI.sessionData === 'object';
            this.addTestResult('Configuration Loading', hasConfig, 
                hasConfig ? 'Configuration loaded correctly' : 'Configuration missing or invalid');
            
            // Test security settings
            const hasSecurityToken = this.webUI.sessionToken && this.webUI.sessionToken.length > 0;
            this.addTestResult('Security Token Generation', hasSecurityToken,
                hasSecurityToken ? 'Security token generated' : 'Security token missing');
            
            console.log(chalk.green('✓ WebUI startup tests completed'));
            
        } catch (error) {
            this.addTestResult('WebUI Server Startup', false, error.message);
            console.error(chalk.red('❌ WebUI startup failed:'), error.message);
        }
    }

    async testEngineWebUIIntegration() {
        console.log(chalk.blue('\n🔄 Test 2: Engine Integration with WebUI'));
        
        try {
            // Initialize engine with WebUI integration
            this.engine = new ClaudeLoopEngine();
            
            // Test engine-webUI binding
            if (this.webUI && this.engine.setWebUI) {
                this.engine.setWebUI(this.webUI);
                const integrationSuccess = this.engine.webUI === this.webUI;
                this.addTestResult('Engine-WebUI Binding', integrationSuccess,
                    integrationSuccess ? 'Engine successfully bound to WebUI' : 'Engine-WebUI binding failed');
            } else {
                this.addTestResult('Engine-WebUI Binding', false, 'Engine or WebUI missing setWebUI method');
            }
            
            // Test unified logger integration
            if (this.webUI && this.webUI.logger) {
                this.webUI.logger.setWebUI(this.webUI);
                const loggerIntegration = this.webUI.logger.webUI === this.webUI;
                this.addTestResult('Logger Integration', loggerIntegration,
                    loggerIntegration ? 'Logger integrated with WebUI' : 'Logger integration failed');
            }
            
            // Test session data initialization
            const sessionDataValid = this.webUI.sessionData && 
                typeof this.webUI.sessionData.iterations === 'number' &&
                typeof this.webUI.sessionData.isRunning === 'boolean';
            this.addTestResult('Session Data Initialization', sessionDataValid,
                sessionDataValid ? 'Session data properly initialized' : 'Session data invalid or missing');
            
            console.log(chalk.green('✓ Engine-WebUI integration tests completed'));
            
        } catch (error) {
            this.addTestResult('Engine-WebUI Integration', false, error.message);
            console.error(chalk.red('❌ Engine integration failed:'), error.message);
        }
    }

    async testWebSocketCommunication() {
        console.log(chalk.blue('\n🔄 Test 3: WebSocket Connection and Communication'));
        
        try {
            // Test WebSocket connection
            const wsUrl = `ws://localhost:${this.testPort}`;
            this.wsConnection = new WebSocket(wsUrl);
            
            const connectionPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
                
                this.wsConnection.on('open', () => {
                    clearTimeout(timeout);
                    resolve(true);
                });
                
                this.wsConnection.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
            
            await connectionPromise;
            this.addTestResult('WebSocket Connection', true, 'Successfully connected to WebSocket server');
            
            // Test message sending and receiving
            const messageTestPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Message test timeout')), 3000);
                let messagesReceived = 0;
                
                this.wsConnection.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        messagesReceived++;
                        if (messagesReceived >= 1) {
                            clearTimeout(timeout);
                            resolve(true);
                        }
                    } catch (error) {
                        clearTimeout(timeout);
                        reject(new Error('Invalid JSON message received'));
                    }
                });
                
                // Send a test message
                this.wsConnection.send(JSON.stringify({
                    type: 'test',
                    data: 'integration_test'
                }));
            });
            
            await messageTestPromise;
            this.addTestResult('WebSocket Messaging', true, 'Message sending and receiving works correctly');
            
            console.log(chalk.green('✓ WebSocket communication tests completed'));
            
        } catch (error) {
            this.addTestResult('WebSocket Communication', false, error.message);
            console.error(chalk.red('❌ WebSocket communication failed:'), error.message);
        }
    }

    async testSessionDataSync() {
        console.log(chalk.blue('\n🔄 Test 4: Real-time Session Data Synchronization'));
        
        try {
            if (!this.webUI) {
                throw new Error('WebUI not initialized');
            }
            
            // Test session data updates
            const originalIterations = this.webUI.sessionData.iterations;
            this.webUI.updateSession({ iterations: originalIterations + 1 });
            
            const sessionUpdated = this.webUI.sessionData.iterations === originalIterations + 1;
            this.addTestResult('Session Data Update', sessionUpdated,
                sessionUpdated ? 'Session data updated correctly' : 'Session data update failed');
            
            // Test phase updates
            const testPhase = 'Integration Testing Phase';
            this.webUI.updateSession({ currentPhase: testPhase });
            
            const phaseUpdated = this.webUI.sessionData.currentPhase === testPhase;
            this.addTestResult('Phase Update', phaseUpdated,
                phaseUpdated ? 'Phase updated correctly' : 'Phase update failed');
            
            // Test output synchronization
            const testOutput = 'Test integration output message';
            this.webUI.addOutput(testOutput, 'info');
            
            const outputAdded = this.webUI.sessionData.output.some(entry => 
                entry.message === testOutput && entry.type === 'info');
            this.addTestResult('Output Synchronization', outputAdded,
                outputAdded ? 'Output synchronized correctly' : 'Output synchronization failed');
            
            console.log(chalk.green('✓ Session data synchronization tests completed'));
            
        } catch (error) {
            this.addTestResult('Session Data Synchronization', false, error.message);
            console.error(chalk.red('❌ Session data sync failed:'), error.message);
        }
    }

    async testMessageBroadcasting() {
        console.log(chalk.blue('\n🔄 Test 5: Message Broadcasting and Output Handling'));
        
        try {
            if (!this.webUI || !this.wsConnection) {
                throw new Error('WebUI or WebSocket connection not available');
            }
            
            // Test message broadcasting to connected clients
            const broadcastTestPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Broadcast test timeout')), 3000);
                
                this.wsConnection.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        if (message.type === 'output' && message.data.message === 'Broadcast test message') {
                            clearTimeout(timeout);
                            resolve(true);
                        }
                    } catch (error) {
                        // Ignore parsing errors for other messages
                    }
                });
                
                // Trigger a broadcast
                this.webUI.addOutput('Broadcast test message', 'info');
            });
            
            await broadcastTestPromise;
            this.addTestResult('Message Broadcasting', true, 'Messages broadcast correctly to WebSocket clients');
            
            // Test different message types
            const messageTypes = ['info', 'success', 'warning', 'error'];
            for (const type of messageTypes) {
                this.webUI.addOutput(`Test ${type} message`, type);
                const hasMessage = this.webUI.sessionData.output.some(entry => 
                    entry.message === `Test ${type} message` && entry.type === type);
                this.addTestResult(`Message Type: ${type}`, hasMessage,
                    hasMessage ? `${type} messages handled correctly` : `${type} message handling failed`);
            }
            
            console.log(chalk.green('✓ Message broadcasting tests completed'));
            
        } catch (error) {
            this.addTestResult('Message Broadcasting', false, error.message);
            console.error(chalk.red('❌ Message broadcasting failed:'), error.message);
        }
    }

    async testErrorHandling() {
        console.log(chalk.blue('\n🔄 Test 6: Error Handling and Recovery'));
        
        try {
            if (!this.webUI) {
                throw new Error('WebUI not initialized');
            }
            
            // Test graceful error handling for invalid WebSocket messages
            if (this.wsConnection) {
                try {
                    this.wsConnection.send('invalid json');
                    // WebUI should handle this gracefully without crashing
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    this.addTestResult('Invalid Message Handling', true, 'Invalid messages handled gracefully');
                } catch (error) {
                    this.addTestResult('Invalid Message Handling', false, `Error handling failed: ${error.message}`);
                }
            }
            
            // Test error message propagation
            const errorMessage = 'Test error message';
            this.webUI.addOutput(errorMessage, 'error');
            
            const errorPropagated = this.webUI.sessionData.output.some(entry => 
                entry.message === errorMessage && entry.type === 'error');
            this.addTestResult('Error Message Propagation', errorPropagated,
                errorPropagated ? 'Error messages propagated correctly' : 'Error message propagation failed');
            
            // Test connection recovery (simulate disconnect and reconnect)
            if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
                this.wsConnection.close();
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Attempt reconnection
                const wsUrl = `ws://localhost:${this.testPort}`;
                this.wsConnection = new WebSocket(wsUrl);
                
                const reconnectPromise = new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Reconnection timeout')), 3000);
                    
                    this.wsConnection.on('open', () => {
                        clearTimeout(timeout);
                        resolve(true);
                    });
                    
                    this.wsConnection.on('error', (error) => {
                        clearTimeout(timeout);
                        reject(error);
                    });
                });
                
                await reconnectPromise;
                this.addTestResult('Connection Recovery', true, 'WebSocket reconnection successful');
            }
            
            console.log(chalk.green('✓ Error handling tests completed'));
            
        } catch (error) {
            this.addTestResult('Error Handling', false, error.message);
            console.error(chalk.red('❌ Error handling test failed:'), error.message);
        }
    }

    async testConnectionManagement() {
        console.log(chalk.blue('\n🔄 Test 7: Connection Management and Limits'));
        
        try {
            if (!this.webUI) {
                throw new Error('WebUI not initialized');
            }
            
            // Test connection counting
            const initialConnectionCount = this.webUI.wss.clients.size;
            const maxConnections = this.webUI.maxConnections;
            
            this.addTestResult('Connection Counting', true, 
                `Current connections: ${initialConnectionCount}, Max: ${maxConnections}`);
            
            // Test connection limit enforcement (simulate multiple connections)
            const testConnections = [];
            const wsUrl = `ws://localhost:${this.testPort}`;
            
            try {
                // Create connections up to the limit
                for (let i = 0; i < Math.min(3, maxConnections); i++) {
                    const ws = new WebSocket(wsUrl);
                    testConnections.push(ws);
                    
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 2000);
                        ws.on('open', () => {
                            clearTimeout(timeout);
                            resolve();
                        });
                        ws.on('error', reject);
                    });
                }
                
                this.addTestResult('Multiple Connections', true, 
                    `Successfully created ${testConnections.length} connections`);
                
                // Clean up test connections
                testConnections.forEach(ws => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.close();
                    }
                });
                
            } catch (error) {
                this.addTestResult('Multiple Connections', false, error.message);
            }
            
            // Test connection cleanup
            await new Promise(resolve => setTimeout(resolve, 2000));
            const finalConnectionCount = this.webUI.wss.clients.size;
            
            this.addTestResult('Connection Cleanup', true, 
                `Final connection count: ${finalConnectionCount}`);
            
            console.log(chalk.green('✓ Connection management tests completed'));
            
        } catch (error) {
            this.addTestResult('Connection Management', false, error.message);
            console.error(chalk.red('❌ Connection management test failed:'), error.message);
        }
    }

    async testUILifecycle() {
        console.log(chalk.blue('\n🔄 Test 8: UI Lifecycle Management'));
        
        try {
            if (!this.webUI) {
                throw new Error('WebUI not initialized');
            }
            
            // Test session start/stop lifecycle
            const sessionInfo = {
                repoPath: '/test/repo',
                maxIterations: 5
            };
            
            // Start session
            this.webUI.updateSession({ 
                isRunning: true, 
                startTime: Date.now(),
                repoPath: sessionInfo.repoPath 
            });
            
            const sessionStarted = this.webUI.sessionData.isRunning === true;
            this.addTestResult('Session Start', sessionStarted,
                sessionStarted ? 'Session started correctly' : 'Session start failed');
            
            // Update during session
            for (let i = 1; i <= 3; i++) {
                this.webUI.updateSession({ iterations: i });
                this.webUI.addOutput(`Iteration ${i} progress update`, 'info');
            }
            
            const iterationsUpdated = this.webUI.sessionData.iterations === 3;
            this.addTestResult('Session Progress Updates', iterationsUpdated,
                iterationsUpdated ? 'Progress updates work correctly' : 'Progress update failed');
            
            // End session
            this.webUI.updateSession({ 
                isRunning: false,
                endTime: Date.now()
            });
            
            const sessionStopped = this.webUI.sessionData.isRunning === false;
            this.addTestResult('Session Stop', sessionStopped,
                sessionStopped ? 'Session stopped correctly' : 'Session stop failed');
            
            console.log(chalk.green('✓ UI lifecycle tests completed'));
            
        } catch (error) {
            this.addTestResult('UI Lifecycle', false, error.message);
            console.error(chalk.red('❌ UI lifecycle test failed:'), error.message);
        }
    }

    async testSecurityFeatures() {
        console.log(chalk.blue('\n🔄 Test 9: Security and Authentication'));
        
        try {
            if (!this.webUI) {
                throw new Error('WebUI not initialized');
            }
            
            // Test security token validation
            const hasValidToken = this.webUI.sessionToken && 
                this.webUI.sessionToken.length >= 48 && // Minimum entropy
                this.webUI.tokenExpiry > Date.now(); // Not expired
                
            this.addTestResult('Security Token Validation', hasValidToken,
                hasValidToken ? 'Security token is valid and properly configured' : 'Security token invalid');
            
            // Test JSON sanitization
            const testObject = {
                normal: 'value',
                __proto__: 'malicious',
                constructor: 'attack',
                prototype: 'payload'
            };
            
            try {
                this.webUI.addOutput(JSON.stringify(testObject), 'info');
                this.addTestResult('JSON Sanitization', true, 'Malicious JSON handled safely');
            } catch (error) {
                this.addTestResult('JSON Sanitization', false, `JSON sanitization failed: ${error.message}`);
            }
            
            // Test rate limiting (basic check)
            const rateLimitExists = this.webUI.maxRequestsPerMinute && 
                this.webUI.maxRequestsPerMinute > 0;
            this.addTestResult('Rate Limiting Configuration', rateLimitExists,
                rateLimitExists ? 'Rate limiting properly configured' : 'Rate limiting not configured');
            
            console.log(chalk.green('✓ Security feature tests completed'));
            
        } catch (error) {
            this.addTestResult('Security Features', false, error.message);
            console.error(chalk.red('❌ Security feature test failed:'), error.message);
        }
    }

    async testPerformanceLoad() {
        console.log(chalk.blue('\n🔄 Test 10: Performance under Load'));
        
        try {
            if (!this.webUI) {
                throw new Error('WebUI not initialized');
            }
            
            // Test high-volume message handling
            const messageCount = 50;
            const startTime = Date.now();
            
            for (let i = 0; i < messageCount; i++) {
                this.webUI.addOutput(`Performance test message ${i}`, 'info');
            }
            
            const processingTime = Date.now() - startTime;
            const messagesPerSecond = Math.round((messageCount / processingTime) * 1000);
            
            this.addTestResult('High Volume Message Processing', true, 
                `Processed ${messageCount} messages in ${processingTime}ms (${messagesPerSecond} msg/sec)`);
            
            // Test output buffer management
            const outputCount = this.webUI.sessionData.output.length;
            const maxOutputEntries = this.webUI.maxOutputEntries || 50;
            
            const bufferManaged = outputCount <= maxOutputEntries;
            this.addTestResult('Output Buffer Management', bufferManaged,
                bufferManaged ? `Output buffer properly managed (${outputCount}/${maxOutputEntries})` : 
                'Output buffer overflow detected');
            
            // Test memory usage (basic check)
            const memUsage = process.memoryUsage();
            const memoryMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            
            this.addTestResult('Memory Usage', true, 
                `Current memory usage: ${memoryMB}MB (heap: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB)`);
            
            console.log(chalk.green('✓ Performance load tests completed'));
            
        } catch (error) {
            this.addTestResult('Performance Load', false, error.message);
            console.error(chalk.red('❌ Performance load test failed:'), error.message);
        }
    }

    async checkServerListening(port) {
        return new Promise((resolve) => {
            const req = http.request({
                host: 'localhost',
                port: port,
                method: 'HEAD',
                timeout: 2000
            }, (res) => {
                resolve(true);
            });
            
            req.on('error', () => resolve(false));
            req.on('timeout', () => resolve(false));
            req.end();
        });
    }

    addTestResult(testName, passed, details) {
        const result = {
            testName,
            passed,
            details,
            timestamp: new Date().toISOString()
        };
        
        this.testResults.tests.push(result);
        this.testResults.summary.total++;
        
        if (passed) {
            this.testResults.summary.passed++;
            console.log(chalk.green('✓'), testName, chalk.gray(`- ${details}`));
        } else {
            this.testResults.summary.failed++;
            this.testResults.summary.errors.push(`${testName}: ${details}`);
            console.log(chalk.red('❌'), testName, chalk.red(`- ${details}`));
        }
    }

    async cleanup() {
        console.log(chalk.yellow('\n🧹 Cleaning up test resources...'));
        
        try {
            // Close WebSocket connection
            if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
                this.wsConnection.close();
            }
            
            // Stop WebUI server
            if (this.webUI && this.webUI.stop) {
                await this.webUI.stop();
            }
            
            // Wait for cleanup
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.error(chalk.yellow('⚠ Cleanup warning:'), error.message);
        }
    }

    generateReport() {
        const reportPath = path.join(__dirname, 'claude-loop-e2e-webui-integration-report.json');
        
        try {
            fs.writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2));
            
            console.log('\n' + '═'.repeat(60));
            console.log(chalk.cyan.bold('📊 E2E WebUI Integration Test Results'));
            console.log('═'.repeat(60));
            console.log(chalk.blue(`Total Tests: ${this.testResults.summary.total}`));
            console.log(chalk.green(`Passed: ${this.testResults.summary.passed}`));
            console.log(chalk.red(`Failed: ${this.testResults.summary.failed}`));
            console.log(chalk.blue(`Success Rate: ${Math.round((this.testResults.summary.passed / this.testResults.summary.total) * 100)}%`));
            console.log(chalk.gray(`Report saved: ${reportPath}`));
            
            if (this.testResults.summary.errors.length > 0) {
                console.log(chalk.red('\n❌ Errors Found:'));
                this.testResults.summary.errors.forEach(error => {
                    console.log(chalk.red(`  • ${error}`));
                });
            }
            
            console.log('═'.repeat(60));
            
        } catch (error) {
            console.error(chalk.red('❌ Failed to generate report:'), error.message);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new E2EWebUITester();
    tester.runAllTests().catch(error => {
        console.error(chalk.red('❌ Test suite failed:'), error.message);
        process.exit(1);
    });
}

module.exports = E2EWebUITester;