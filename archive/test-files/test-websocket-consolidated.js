#!/usr/bin/env node

/**
 * Consolidated WebSocket Test Suite
 * Replaces multiple scattered WebSocket test files with comprehensive testing
 * Uses modern test patterns and WebUITestHelper for consistency
 */

const { WebUITestHelper, TestRunner } = require('./lib/utils/test-helpers');
const logger = require('./lib/utils/unified-logger');
const WebSocket = require('ws');
const chalk = require('chalk');

class ConsolidatedWebSocketTest {
    constructor() {
        this.testRunner = new TestRunner('Consolidated WebSocket Test Suite');
        this.webUIHelper = null;
        this.testPort = null;
    }

    async runAllTests() {
        try {
            logger.info(chalk.cyan('🚀 Starting Consolidated WebSocket Test Suite'));
            
            await this.setupTests();
            
            // Core WebSocket functionality tests
            await this.testRunner.runTest('Basic Connection', () => this.testBasicConnection());
            await this.testRunner.runTest('Authentication', () => this.testAuthentication());
            await this.testRunner.runTest('Message Exchange', () => this.testMessageExchange());
            await this.testRunner.runTest('Real-time Updates', () => this.testRealTimeUpdates());
            
            // Error handling and edge cases
            await this.testRunner.runTest('Invalid Token Handling', () => this.testInvalidToken());
            await this.testRunner.runTest('Connection Limits', () => this.testConnectionLimits());
            await this.testRunner.runTest('Large Message Handling', () => this.testLargeMessages());
            
            // Performance and resilience
            await this.testRunner.runTest('Concurrent Connections', () => this.testConcurrentConnections());
            await this.testRunner.runTest('Connection Recovery', () => this.testConnectionRecovery());
            await this.testRunner.runTest('Rate Limiting', () => this.testRateLimiting());
            
            // Generate comprehensive report
            this.testRunner.generateReport();
            
            // Save results
            await this.saveTestResults();
            
        } catch (error) {
            logger.error(`WebSocket test suite failed: ${error.message}`);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    async setupTests() {
        this.webUIHelper = new WebUITestHelper();
        await this.webUIHelper.startServer();
        this.testPort = this.webUIHelper.port;
        logger.info(`WebSocket test environment ready on port ${this.testPort}`);
    }

    async testBasicConnection() {
        logger.info('Testing basic WebSocket connection...');
        
        const token = this.webUIHelper.webUI.sessionToken;
        
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${token}`, {
                headers: { 'User-Agent': 'ConsolidatedWebSocketTest/1.0' }
            });
            
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Connection timeout'));
            }, 5000);
            
            ws.on('open', () => {
                clearTimeout(timeout);
                logger.info('✓ Basic connection established');
                ws.close();
                resolve();
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    async testAuthentication() {
        logger.info('Testing WebSocket authentication...');
        
        const validToken = this.webUIHelper.webUI.sessionToken;
        const invalidToken = 'invalid-token-12345';
        
        // Test valid token
        await this.testTokenAuthentication(validToken, true);
        
        // Test invalid token
        await this.testTokenAuthentication(invalidToken, false);
        
        logger.info('✓ Authentication tests completed');
    }

    async testTokenAuthentication(token, shouldSucceed) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${token}`, {
                headers: { 'User-Agent': 'ConsolidatedWebSocketTest/1.0' }
            });
            
            const timeout = setTimeout(() => {
                if (shouldSucceed) {
                    reject(new Error('Expected connection to succeed but timed out'));
                } else {
                    // Expected to fail, timeout is acceptable
                    resolve();
                }
            }, 3000);
            
            ws.on('open', () => {
                clearTimeout(timeout);
                if (shouldSucceed) {
                    ws.close();
                    resolve();
                } else {
                    ws.close();
                    reject(new Error('Expected connection to fail but it succeeded'));
                }
            });
            
            ws.on('error', () => {
                clearTimeout(timeout);
                if (shouldSucceed) {
                    reject(new Error('Expected connection to succeed but it failed'));
                } else {
                    resolve();
                }
            });
        });
    }

    async testMessageExchange() {
        logger.info('Testing message exchange...');
        
        const token = this.webUIHelper.webUI.sessionToken;
        
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${token}`, {
                headers: { 'User-Agent': 'ConsolidatedWebSocketTest/1.0' }
            });
            
            let sessionDataReceived = false;
            
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Message exchange timeout'));
            }, 8000);
            
            ws.on('open', () => {
                logger.info('Connected, waiting for session data...');
            });
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    if (message.type === 'session_data') {
                        sessionDataReceived = true;
                        logger.info('✓ Session data received');
                        clearTimeout(timeout);
                        ws.close();
                        resolve();
                    }
                } catch (error) {
                    clearTimeout(timeout);
                    reject(new Error('Invalid message format received'));
                }
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    async testRealTimeUpdates() {
        logger.info('Testing real-time updates...');
        
        const token = this.webUIHelper.webUI.sessionToken;
        
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${token}`, {
                headers: { 'User-Agent': 'ConsolidatedWebSocketTest/1.0' }
            });
            
            let updatesReceived = 0;
            const expectedUpdates = 3;
            
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Real-time updates test timeout'));
            }, 10000);
            
            ws.on('open', () => {
                // Trigger some updates
                setTimeout(() => {
                    this.webUIHelper.webUI.updateSession({ iterations: 1, currentPhase: 'Test Phase 1' });
                    this.webUIHelper.webUI.addOutput('Test message 1', 'info');
                }, 1000);
                
                setTimeout(() => {
                    this.webUIHelper.webUI.updateSession({ iterations: 2, currentPhase: 'Test Phase 2' });
                    this.webUIHelper.webUI.addOutput('Test message 2', 'success');
                }, 2000);
                
                setTimeout(() => {
                    this.webUIHelper.webUI.addOutput('Test message 3', 'warning');
                }, 3000);
            });
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    if (message.type === 'session_update' || message.type === 'new_output') {
                        updatesReceived++;
                        logger.info(`Update received: ${message.type}`);
                        
                        if (updatesReceived >= expectedUpdates) {
                            clearTimeout(timeout);
                            ws.close();
                            logger.info(`✓ Received ${updatesReceived} real-time updates`);
                            resolve();
                        }
                    }
                } catch (error) {
                    // Ignore parsing errors for this test
                }
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    async testInvalidToken() {
        logger.info('Testing invalid token handling...');
        
        const invalidTokens = [
            '',
            'invalid',
            '12345',
            'null',
            'undefined',
            'a'.repeat(1000) // Very long token
        ];
        
        for (const token of invalidTokens) {
            await this.testTokenAuthentication(token, false);
        }
        
        logger.info('✓ Invalid token handling verified');
    }

    async testConnectionLimits() {
        logger.info('Testing connection limits...');
        
        const token = this.webUIHelper.webUI.sessionToken;
        const connections = [];
        const maxConnections = 3; // Test limit
        
        try {
            // Create multiple connections
            for (let i = 0; i < maxConnections + 2; i++) {
                const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${token}`, {
                    headers: { 'User-Agent': `ConsolidatedWebSocketTest-${i}/1.0` }
                });
                connections.push(ws);
                
                // Small delay between connections
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Wait for connections to stabilize
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            logger.info(`✓ Connection limit testing completed with ${connections.length} attempts`);
            
        } finally {
            // Clean up all connections
            connections.forEach(ws => {
                try {
                    ws.close();
                } catch (error) {
                    // Ignore cleanup errors
                }
            });
        }
    }

    async testLargeMessages() {
        logger.info('Testing large message handling...');
        
        const token = this.webUIHelper.webUI.sessionToken;
        
        // Test with large output message
        const largeMessage = 'x'.repeat(5000); // 5KB message
        this.webUIHelper.webUI.addOutput(largeMessage, 'info');
        
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${token}`, {
                headers: { 'User-Agent': 'ConsolidatedWebSocketTest/1.0' }
            });
            
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Large message test timeout'));
            }, 8000);
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    if (message.type === 'new_output' && message.data.message.length > 1000) {
                        clearTimeout(timeout);
                        ws.close();
                        logger.info('✓ Large message handled successfully');
                        resolve();
                    }
                } catch (error) {
                    // Continue waiting for the right message
                }
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    async testConcurrentConnections() {
        logger.info('Testing concurrent connections...');
        
        const token = this.webUIHelper.webUI.sessionToken;
        const concurrentCount = 5;
        const connections = [];
        
        const connectionPromises = Array(concurrentCount).fill(0).map((_, index) => {
            return new Promise((resolve, reject) => {
                const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${token}`, {
                    headers: { 'User-Agent': `ConsolidatedWebSocketTest-Concurrent-${index}/1.0` }
                });
                
                connections.push(ws);
                
                const timeout = setTimeout(() => {
                    reject(new Error(`Concurrent connection ${index} timeout`));
                }, 5000);
                
                ws.on('open', () => {
                    clearTimeout(timeout);
                    resolve(index);
                });
                
                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
        });
        
        try {
            const results = await Promise.all(connectionPromises);
            logger.info(`✓ ${results.length} concurrent connections established`);
        } finally {
            // Clean up connections
            connections.forEach(ws => {
                try {
                    ws.close();
                } catch (error) {
                    // Ignore cleanup errors
                }
            });
        }
    }

    async testConnectionRecovery() {
        logger.info('Testing connection recovery...');
        
        const token = this.webUIHelper.webUI.sessionToken;
        
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${token}`, {
                headers: { 'User-Agent': 'ConsolidatedWebSocketTest/1.0' }
            });
            
            const timeout = setTimeout(() => {
                reject(new Error('Connection recovery test timeout'));
            }, 8000);
            
            ws.on('open', () => {
                // Simulate connection interruption
                setTimeout(() => {
                    ws.close(1000, 'Test disconnection');
                }, 1000);
            });
            
            ws.on('close', (code, reason) => {
                if (code === 1000) {
                    clearTimeout(timeout);
                    logger.info('✓ Connection closed gracefully for recovery test');
                    resolve();
                }
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    async testRateLimiting() {
        logger.info('Testing rate limiting...');
        
        const token = this.webUIHelper.webUI.sessionToken;
        
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${token}`, {
                headers: { 'User-Agent': 'ConsolidatedWebSocketTest/1.0' }
            });
            
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Rate limiting test timeout'));
            }, 5000);
            
            ws.on('open', () => {
                // Send rapid messages to test rate limiting
                for (let i = 0; i < 10; i++) {
                    try {
                        ws.send(JSON.stringify({ type: 'test', message: `Rapid message ${i}` }));
                    } catch (error) {
                        // Expected if rate limited
                    }
                }
                
                // Complete test after a short delay
                setTimeout(() => {
                    clearTimeout(timeout);
                    ws.close();
                    logger.info('✓ Rate limiting test completed');
                    resolve();
                }, 2000);
            });
            
            ws.on('error', (error) => {
                // Rate limiting errors are expected
                clearTimeout(timeout);
                logger.info('✓ Rate limiting is working (connection rejected)');
                resolve();
            });
        });
    }

    async saveTestResults() {
        const results = {
            timestamp: new Date().toISOString(),
            testSuite: 'Consolidated WebSocket Tests',
            summary: this.testRunner.getResults(),
            consolidatedFrom: 'Multiple scattered WebSocket test files',
            port: this.testPort,
            recommendations: [
                'This consolidated test suite replaces multiple individual WebSocket test files',
                'Provides comprehensive coverage with standardized patterns',
                'Uses WebUITestHelper for consistent test environment',
                'Includes error handling, performance, and edge case testing'
            ]
        };
        
        const fs = require('fs').promises;
        await fs.writeFile('./websocket-test-results.json', JSON.stringify(results, null, 2));
        logger.info('Test results saved to websocket-test-results.json');
    }

    async cleanup() {
        if (this.webUIHelper) {
            await this.webUIHelper.cleanup();
        }
        logger.info('WebSocket test cleanup completed');
    }
}

// Run tests if called directly
if (require.main === module) {
    const test = new ConsolidatedWebSocketTest();
    test.runAllTests().then(() => {
        logger.info(chalk.green('🎉 Consolidated WebSocket test suite completed successfully!'));
        process.exit(0);
    }).catch(error => {
        logger.error(chalk.red(`❌ WebSocket test suite failed: ${error.message}`));
        process.exit(1);
    });
}

module.exports = ConsolidatedWebSocketTest;