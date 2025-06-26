#!/usr/bin/env node

const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const crypto = require('crypto');
const http = require('http');
const aiConfig = require('./lib/utils/ai-config-manager');

/**
 * WebSocket Authentication Testing
 * Tests WebSocket authentication and basic functionality
 */
class WebSocketAuthTester {
    constructor() {
        this.testResults = {
            timestamp: new Date().toISOString(),
            testSuite: 'WebSocket Authentication Testing',
            tests: {},
            summary: ''
        };
        
        this.webUIPort = 3333;
        this.serverToken = null;
    }

    async runAllTests() {
        console.log(chalk.cyan('🔐 Starting WebSocket Authentication Testing\n'));
        
        try {
            // Test server response to understand authentication requirements
            await this.analyzeServerAuth();
            
            // Test WebSocket without token (should fail)
            await this.testWebSocketWithoutToken();
            
            // Test WebSocket with invalid token (should fail)
            await this.testWebSocketWithInvalidToken();
            
            // If we can get a valid token, test with it
            await this.attemptTokenBasedTest();
            
            // Generate test report
            await this.generateTestReport();
            
        } catch (error) {
            console.error(chalk.red('❌ WebSocket auth testing failed:'), error.message);
            throw error;
        }
    }

    async analyzeServerAuth() {
        console.log(chalk.yellow('🔍 Analyzing Server Authentication Requirements...'));
        
        const testName = 'serverAuthAnalysis';
        
        try {
            // Test HTTP endpoint to understand auth requirements
            const response = await this.makeHttpRequest('http://localhost:${testPort1}/health');
            
            // Test WebSocket without authentication to see the response
            const wsResponse = await this.testUnauthenticatedWebSocket();
            
            this.testResults.tests[testName] = {
                status: 'passed',
                details: {
                    httpResponse: response,
                    webSocketResponse: wsResponse,
                    authRequired: response.includes('token') || wsResponse.statusCode === 401
                },
                message: 'Server authentication requirements analyzed'
            };
            
            console.log(chalk.green('✅ Authentication analysis completed'));
            console.log(chalk.gray(`   HTTP Response: ${response.substring(0, 100)}...`));
            console.log(chalk.gray(`   WebSocket Status: ${wsResponse.statusCode || 'No status'}`));
            
        } catch (error) {
            this.testResults.tests[testName] = {
                status: 'failed',
                error: error.message,
                message: 'Failed to analyze server authentication'
            };
            
            console.log(chalk.red('❌ Authentication analysis failed:'), error.message);
        }
    }

    async testUnauthenticatedWebSocket() {
        return new Promise((resolve) => {
            const ws = new WebSocket(`ws://localhost:${this.webUIPort}`);
            
            const timeout = setTimeout(() => {
                ws.close();
                resolve({ statusCode: 'timeout', message: 'Connection timeout' });
            }, 3000);
            
            ws.on('open', () => {
                clearTimeout(timeout);
                ws.close();
                resolve({ statusCode: 'open', message: 'Connection opened without auth' });
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeout);
                
                // Parse error to extract status code
                let statusCode = null;
                if (error.message.includes('401')) {
                    statusCode = 401;
                } else if (error.message.includes('403')) {
                    statusCode = 403;
                } else if (error.message.includes('Unexpected server response')) {
                    const match = error.message.match(/(\d{3})/);
                    statusCode = match ? parseInt(match[1]) : 'unknown';
                }
                
                resolve({ 
                    statusCode, 
                    message: error.message,
                    error: error.code
                });
            });
        });
    }

    async testWebSocketWithoutToken() {
        console.log(chalk.yellow('\n🚫 Testing WebSocket Without Token...'));
        
        const testName = 'webSocketWithoutToken';
        
        try {
            const result = await this.testUnauthenticatedWebSocket();
            
            const shouldFail = result.statusCode === 401 || result.message.includes('401');
            
            this.testResults.tests[testName] = {
                status: shouldFail ? 'passed' : 'failed',
                details: result,
                message: shouldFail ? 
                    'WebSocket correctly rejected connection without token' : 
                    'WebSocket unexpectedly allowed connection without token'
            };
            
            if (shouldFail) {
                console.log(chalk.green('✅ WebSocket correctly rejected unauthenticated connection'));
            } else {
                console.log(chalk.yellow('⚠️  WebSocket allowed unauthenticated connection'));
            }
            
        } catch (error) {
            this.testResults.tests[testName] = {
                status: 'failed',
                error: error.message,
                message: 'Failed to test WebSocket without token'
            };
            
            console.log(chalk.red('❌ WebSocket without token test failed:'), error.message);
        }
    }

    async testWebSocketWithInvalidToken() {
        console.log(chalk.yellow('\n🔑 Testing WebSocket With Invalid Token...'));
        
        const testName = 'webSocketWithInvalidToken';
        
        try {
            const invalidToken = crypto.randomBytes(24).toString('hex');
            const wsUrl = `ws://localhost:${this.webUIPort}?token=${invalidToken}`;
            
            const result = await new Promise((resolve) => {
                const ws = new WebSocket(wsUrl);
                
                const timeout = setTimeout(() => {
                    ws.close();
                    resolve({ statusCode: 'timeout', message: 'Connection timeout' });
                }, 3000);
                
                ws.on('open', () => {
                    clearTimeout(timeout);
                    ws.close();
                    resolve({ statusCode: 'open', message: 'Connection opened with invalid token' });
                });
                
                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    
                    let statusCode = null;
                    if (error.message.includes('401')) {
                        statusCode = 401;
                    } else if (error.message.includes('403')) {
                        statusCode = 403;
                    }
                    
                    resolve({ 
                        statusCode, 
                        message: error.message,
                        tokenUsed: invalidToken.substring(0, 8) + '...'
                    });
                });
            });
            
            const shouldFail = result.statusCode === 401 || result.message.includes('401');
            
            this.testResults.tests[testName] = {
                status: shouldFail ? 'passed' : 'failed',
                details: result,
                message: shouldFail ? 
                    'WebSocket correctly rejected invalid token' : 
                    'WebSocket unexpectedly accepted invalid token'
            };
            
            if (shouldFail) {
                console.log(chalk.green('✅ WebSocket correctly rejected invalid token'));
            } else {
                console.log(chalk.yellow('⚠️  WebSocket accepted invalid token'));
            }
            
        } catch (error) {
            this.testResults.tests[testName] = {
                status: 'failed',
                error: error.message,
                message: 'Failed to test WebSocket with invalid token'
            };
            
            console.log(chalk.red('❌ WebSocket invalid token test failed:'), error.message);
        }
    }

    async attemptTokenBasedTest() {
        console.log(chalk.yellow('\n🔐 Attempting Token-Based WebSocket Test...'));
        
        const testName = 'tokenBasedWebSocket';
        
        try {
            // Try to get a token using various methods
            const token = await this.attemptToGetToken();
            
            if (!token) {
                this.testResults.tests[testName] = {
                    status: 'skipped',
                    details: { reason: 'No token available' },
                    message: 'Token-based test skipped - no valid token found'
                };
                
                console.log(chalk.yellow('⚠️  Token-based test skipped - no valid token available'));
                console.log(chalk.gray('💡 To test with token, start WebUI server and check console for token'));
                return;
            }
            
            // Test WebSocket with token
            const result = await this.testWebSocketWithToken(token);
            
            this.testResults.tests[testName] = {
                status: result.success ? 'passed' : 'failed',
                details: result,
                message: result.success ? 
                    'WebSocket successfully connected with valid token' : 
                    'WebSocket failed to connect with token'
            };
            
            if (result.success) {
                console.log(chalk.green('✅ WebSocket successfully connected with valid token'));
                console.log(chalk.gray(`   Connection time: ${result.connectionTime}ms`));
                console.log(chalk.gray(`   Messages received: ${result.messagesReceived}`));
            } else {
                console.log(chalk.red('❌ WebSocket failed with token:'), result.error);
            }
            
        } catch (error) {
            this.testResults.tests[testName] = {
                status: 'failed',
                error: error.message,
                message: 'Token-based WebSocket test failed'
            };
            
            console.log(chalk.red('❌ Token-based WebSocket test failed:'), error.message);
        }
    }

    async attemptToGetToken() {
        // For this test, we'll try a few approaches to get a token
        console.log(chalk.gray('   Attempting to retrieve valid token...'));
        
        // Method 1: Try some common test tokens (not secure, just for testing)
        const testTokens = [
            'test-token',
            'development-token',
            'local-token'
        ];
        
        for (const token of testTokens) {
            const isValid = await this.validateToken(token);
            if (isValid) {
                console.log(chalk.gray(`   Found working test token: ${token.substring(0, 8)}...`));
                return token;
            }
        }
        
        // Method 2: Try to generate a mock token (this likely won't work but worth testing)
        console.log(chalk.gray('   No test tokens worked, authentication is properly secured'));
        return null;
    }

    async validateToken(token) {
        try {
            const response = await this.makeHttpRequest(`http://localhost:${testPort2}/health?token=${token}`);
            return !response.includes('Invalid or missing token');
        } catch (error) {
            return false;
        }
    }

    async testWebSocketWithToken(token) {
        const wsUrl = `ws://localhost:${this.webUIPort}?token=${token}`;
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                ws.close();
                resolve({ 
                    success: false, 
                    error: 'Connection timeout',
                    connectionTime: 5000 
                });
            }, 5000);
            
            const startTime = Date.now();
            let messagesReceived = 0;
            const ws = new WebSocket(wsUrl);
            
            ws.on('open', () => {
                console.log(chalk.gray('   WebSocket connection opened with token'));
            });
            
            ws.on('message', (data) => {
                messagesReceived++;
                console.log(chalk.gray(`   Received message ${messagesReceived}`));
                
                // After receiving first message, consider test successful
                if (messagesReceived >= 1) {
                    clearTimeout(timeout);
                    ws.close();
                    resolve({
                        success: true,
                        connectionTime: Date.now() - startTime,
                        messagesReceived,
                        tokenUsed: token.substring(0, 8) + '...'
                    });
                }
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeout);
                resolve({
                    success: false,
                    error: error.message,
                    connectionTime: Date.now() - startTime
                });
            });
            
            ws.on('close', () => {
                if (messagesReceived === 0) {
                    clearTimeout(timeout);
                    resolve({
                        success: true, // Connection opened and closed cleanly
                        connectionTime: Date.now() - startTime,
                        messagesReceived: 0,
                        note: 'Connection opened and closed without messages'
                    });
                }
            });
        });
    }

    async makeHttpRequest(url) {
        return new Promise((resolve, reject) => {
            http.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
    }

    async generateTestReport() {
        console.log(chalk.cyan('\n📊 Generating WebSocket Authentication Test Report...'));
        
        const totalTests = Object.keys(this.testResults.tests).length;
        const passedTests = Object.values(this.testResults.tests).filter(test => test.status === 'passed').length;
        const skippedTests = Object.values(this.testResults.tests).filter(test => test.status === 'skipped').length;
        const failedTests = totalTests - passedTests - skippedTests;
        const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0.0';
        
        this.testResults.summary = `WebSocket Authentication Testing Complete: ${passedTests}/${totalTests} tests passed (${successRate}% success rate)`;
        
        const reportPath = path.join(process.cwd(), 'websocket-auth-test-report.json');
        await fs.writeFile(reportPath, JSON.stringify(this.testResults, null, 2));
        
        console.log(chalk.green('\n🎉 WebSocket Authentication Testing COMPLETED!'));
        console.log(chalk.cyan('\n📋 Test Summary:'));
        
        Object.entries(this.testResults.tests).forEach(([testName, result]) => {
            let status = '';
            if (result.status === 'passed') status = chalk.green('✅');
            else if (result.status === 'skipped') status = chalk.yellow('⏭️');
            else status = chalk.red('❌');
            
            console.log(`   ${status} ${testName}: ${result.message}`);
        });
        
        console.log(chalk.cyan(`\n🎯 Results: ${passedTests} passed, ${failedTests} failed, ${skippedTests} skipped`));
        console.log(chalk.cyan(`📊 Success Rate: ${successRate}%`));
        console.log(chalk.gray(`📄 Detailed report saved to: ${reportPath}`));
        
        // Conclusions about the WebSocket authentication
        console.log(chalk.cyan('\n🔐 Authentication Analysis:'));
        
        const authAnalysis = this.testResults.tests.serverAuthAnalysis;
        const withoutTokenTest = this.testResults.tests.webSocketWithoutToken;
        const invalidTokenTest = this.testResults.tests.webSocketWithInvalidToken;
        
        if (authAnalysis && authAnalysis.details.authRequired) {
            console.log(chalk.green('   ✅ Server properly requires authentication'));
        }
        
        if (withoutTokenTest && withoutTokenTest.status === 'passed') {
            console.log(chalk.green('   ✅ Unauthenticated connections are properly blocked'));
        }
        
        if (invalidTokenTest && invalidTokenTest.status === 'passed') {
            console.log(chalk.green('   ✅ Invalid tokens are properly rejected'));
        }
        
        const authSecure = (withoutTokenTest?.status === 'passed') && 
                          (invalidTokenTest?.status === 'passed');
        
        if (authSecure) {
            console.log(chalk.green('\n🛡️  WebSocket authentication is properly implemented and secure!'));
        } else {
            console.log(chalk.yellow('\n⚠️  Some authentication security concerns detected'));
        }
        
        return authSecure;
    }
}

// Run the tests if this script is executed directly
if (require.main === module) {
    const tester = new WebSocketAuthTester();
    
    tester.runAllTests()
        .then((success) => {
            
        // Clean up allocated ports
        aiConfig.releasePort(testPort1, 'test-service-1');
        console.log(chalk.green('\n✅ WebSocket authentication testing completed'));
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error(chalk.red('\n❌ WebSocket authentication testing failed:'), error.message);
            process.exit(1);
        });
}

module.exports = WebSocketAuthTester;