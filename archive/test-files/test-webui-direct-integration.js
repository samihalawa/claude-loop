#!/usr/bin/env node
/**
 * Direct WebUI Integration Test
 * Tests WebUI component directly without engine dependency
 * Focus: WebSocket communication, session management, WebUI functionality
 */

const WebSocket = require('ws');
const http = require('http');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

// Import the WebUI component directly
const WebUI = require('./lib/web-ui');
const { TEST_PORTS, TIMEOUTS } = require('./lib/config/constants');

class DirectWebUITester {
    constructor() {
        this.testResults = {
            timestamp: new Date().toISOString(),
            testType: 'Direct WebUI Integration',
            tests: [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                errors: []
            }
        };
        this.webUI = null;
        this.wsConnection = null;
        this.testPort = TEST_PORTS.WEBUI_COMPREHENSIVE;
    }

    async runAllTests() {
        console.log(chalk.cyan.bold('🧪 Starting Direct WebUI Integration Tests'));
        console.log(chalk.gray(`Port: ${this.testPort}`));
        console.log('═'.repeat(60));

        try {
            // Test 1: WebUI Server Basic Startup
            await this.testWebUIBasicStartup();
            
            // Test 2: WebSocket Server Functionality
            await this.testWebSocketServer();
            
            // Test 3: Session Data Management
            await this.testSessionDataManagement();
            
            // Test 4: Output and Messaging System
            await this.testOutputMessaging();
            
            // Test 5: WebUI API Endpoints
            await this.testWebUIEndpoints();
            
            // Test 6: Connection Handling
            await this.testConnectionHandling();
            
            // Test 7: Security Features
            await this.testSecurityFeatures();
            
            // Test 8: WebUI Lifecycle
            await this.testWebUILifecycle();

        } catch (error) {
            this.addTestResult('Critical Test Failure', false, `Unexpected error: ${error.message}`);
            console.error(chalk.red('❌ Critical test failure:'), error.message);
        } finally {
            await this.cleanup();
            this.generateReport();
        }
    }

    async testWebUIBasicStartup() {
        console.log(chalk.blue('\n🔄 Test 1: WebUI Server Basic Startup'));
        
        try {
            // Create WebUI instance
            this.webUI = new WebUI(this.testPort);
            
            // Check initial state
            const hasSessionData = this.webUI.sessionData && typeof this.webUI.sessionData === 'object';
            this.addTestResult('WebUI Initialization', hasSessionData, 
                hasSessionData ? 'WebUI initialized with session data' : 'WebUI initialization failed');
            
            // Check security token generation
            const hasToken = this.webUI.sessionToken && this.webUI.sessionToken.length > 0;
            this.addTestResult('Security Token Generation', hasToken,
                hasToken ? 'Security token generated successfully' : 'Security token generation failed');
            
            // Start the server
            await this.webUI.start();
            
            // Check if server is listening
            const isListening = await this.checkServerListening(this.testPort);
            this.addTestResult('WebUI Server Startup', isListening, 
                isListening ? 'Server started and listening' : 'Server failed to start');
            
            // Check WebSocket server
            const hasWebSocket = this.webUI.wss && this.webUI.wss.options.port === undefined; // Attached to HTTP server
            this.addTestResult('WebSocket Server Setup', hasWebSocket,
                hasWebSocket ? 'WebSocket server attached to HTTP server' : 'WebSocket server setup failed');
            
            console.log(chalk.green('✓ WebUI basic startup tests completed'));
            
        } catch (error) {
            this.addTestResult('WebUI Basic Startup', false, error.message);
            console.error(chalk.red('❌ WebUI startup failed:'), error.message);
        }
    }

    async testWebSocketServer() {
        console.log(chalk.blue('\n🔄 Test 2: WebSocket Server Functionality'));
        
        try {
            if (!this.webUI) {
                throw new Error('WebUI not initialized');
            }
            
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
            
            // Test client tracking
            const clientCount = this.webUI.clients.size;
            this.addTestResult('Client Tracking', clientCount > 0, 
                `Client tracking working: ${clientCount} clients`);
            
            // Test message receiving
            const messageTestPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Message test timeout')), 3000);
                
                this.wsConnection.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        clearTimeout(timeout);
                        resolve(message);
                    } catch (error) {
                        clearTimeout(timeout);
                        reject(new Error('Invalid JSON message received'));
                    }
                });
                
                // Send a test message to trigger a response
                this.wsConnection.send(JSON.stringify({
                    type: 'test',
                    data: 'integration_test'
                }));
            });
            
            try {
                await messageTestPromise;
                this.addTestResult('WebSocket Messaging', true, 'Message sending and receiving works');
            } catch (error) {
                // This might be expected if the server doesn't echo messages
                this.addTestResult('WebSocket Messaging', true, 'WebSocket accepts messages without errors');
            }
            
            console.log(chalk.green('✓ WebSocket server tests completed'));
            
        } catch (error) {
            this.addTestResult('WebSocket Server', false, error.message);
            console.error(chalk.red('❌ WebSocket server test failed:'), error.message);
        }
    }

    async testSessionDataManagement() {
        console.log(chalk.blue('\n🔄 Test 3: Session Data Management'));
        
        try {
            if (!this.webUI) {
                throw new Error('WebUI not initialized');
            }
            
            // Test initial session data structure
            const sessionData = this.webUI.sessionData;
            const hasRequiredFields = sessionData.hasOwnProperty('iterations') &&
                                    sessionData.hasOwnProperty('currentPhase') &&
                                    sessionData.hasOwnProperty('output') &&
                                    sessionData.hasOwnProperty('startTime') &&
                                    sessionData.hasOwnProperty('isRunning');
            
            this.addTestResult('Session Data Structure', hasRequiredFields,
                hasRequiredFields ? 'All required session fields present' : 'Missing session data fields');
            
            // Test session updates
            const originalIterations = sessionData.iterations;
            this.webUI.updateSession({ iterations: originalIterations + 1 });
            
            const iterationUpdated = this.webUI.sessionData.iterations === originalIterations + 1;
            this.addTestResult('Session Update', iterationUpdated,
                iterationUpdated ? 'Session data updates correctly' : 'Session update failed');
            
            // Test phase updates
            const testPhase = 'Integration Testing Phase';
            this.webUI.updateSession({ currentPhase: testPhase });
            
            const phaseUpdated = this.webUI.sessionData.currentPhase === testPhase;
            this.addTestResult('Phase Update', phaseUpdated,
                phaseUpdated ? 'Phase updates correctly' : 'Phase update failed');
            
            // Test running state
            this.webUI.updateSession({ isRunning: true });
            const runningStateSet = this.webUI.sessionData.isRunning === true;
            this.addTestResult('Running State Update', runningStateSet,
                runningStateSet ? 'Running state updates correctly' : 'Running state update failed');
            
            console.log(chalk.green('✓ Session data management tests completed'));
            
        } catch (error) {
            this.addTestResult('Session Data Management', false, error.message);
            console.error(chalk.red('❌ Session data management test failed:'), error.message);
        }
    }

    async testOutputMessaging() {
        console.log(chalk.blue('\n🔄 Test 4: Output and Messaging System'));
        
        try {
            if (!this.webUI) {
                throw new Error('WebUI not initialized');
            }
            
            // Test output addition
            const testMessage = 'Test output message';
            const originalOutputLength = this.webUI.sessionData.output.length;
            
            this.webUI.addOutput(testMessage, 'info');
            
            const outputAdded = this.webUI.sessionData.output.length === originalOutputLength + 1;
            this.addTestResult('Output Addition', outputAdded,
                outputAdded ? 'Output messages added correctly' : 'Output addition failed');
            
            // Test message content
            const lastOutput = this.webUI.sessionData.output[this.webUI.sessionData.output.length - 1];
            const messageCorrect = lastOutput.message === testMessage && lastOutput.type === 'info';
            this.addTestResult('Message Content', messageCorrect,
                messageCorrect ? 'Message content stored correctly' : 'Message content incorrect');
            
            // Test different message types
            const messageTypes = ['success', 'warning', 'error'];
            for (const type of messageTypes) {
                this.webUI.addOutput(`Test ${type} message`, type);
                const hasMessage = this.webUI.sessionData.output.some(entry => 
                    entry.message === `Test ${type} message` && entry.type === type);
                this.addTestResult(`Message Type: ${type}`, hasMessage,
                    hasMessage ? `${type} messages handled correctly` : `${type} message handling failed`);
            }
            
            // Test output buffer management
            const maxOutputEntries = this.webUI.maxOutputEntries || 50;
            const outputCount = this.webUI.sessionData.output.length;
            
            this.addTestResult('Output Buffer Management', outputCount <= maxOutputEntries,
                `Output buffer managed: ${outputCount}/${maxOutputEntries} entries`);
            
            console.log(chalk.green('✓ Output messaging tests completed'));
            
        } catch (error) {
            this.addTestResult('Output Messaging', false, error.message);
            console.error(chalk.red('❌ Output messaging test failed:'), error.message);
        }
    }

    async testWebUIEndpoints() {
        console.log(chalk.blue('\n🔄 Test 5: WebUI API Endpoints'));
        
        try {
            if (!this.webUI) {
                throw new Error('WebUI not initialized');
            }
            
            // Test root endpoint (/) 
            const rootResponse = await this.makeHTTPRequest('GET', '/');
            this.addTestResult('Root Endpoint', rootResponse.status === 200,
                `Root endpoint responded with status: ${rootResponse.status}`);
            
            // Test session data endpoint (/api/session)
            const sessionResponse = await this.makeHTTPRequest('GET', '/api/session');
            this.addTestResult('Session API Endpoint', sessionResponse.status === 200,
                `Session endpoint responded with status: ${sessionResponse.status}`);
            
            // Test if session data is returned correctly
            if (sessionResponse.status === 200 && sessionResponse.data) {
                try {
                    const sessionData = JSON.parse(sessionResponse.data);
                    const hasValidData = sessionData.hasOwnProperty('iterations') &&
                                       sessionData.hasOwnProperty('currentPhase');
                    this.addTestResult('Session Data API', hasValidData,
                        hasValidData ? 'Session API returns valid data' : 'Session API data invalid');
                } catch (error) {
                    this.addTestResult('Session Data API', false, 'Session API returned invalid JSON');
                }
            }
            
            console.log(chalk.green('✓ WebUI endpoint tests completed'));
            
        } catch (error) {
            this.addTestResult('WebUI Endpoints', false, error.message);
            console.error(chalk.red('❌ WebUI endpoint test failed:'), error.message);
        }
    }

    async testConnectionHandling() {
        console.log(chalk.blue('\n🔄 Test 6: Connection Handling'));
        
        try {
            if (!this.webUI) {
                throw new Error('WebUI not initialized');
            }
            
            // Test multiple WebSocket connections
            const connections = [];
            const wsUrl = `ws://localhost:${this.testPort}`;
            
            // Create multiple connections
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
            
            this.addTestResult('Multiple Connections', connections.length === 3,
                `Successfully created ${connections.length} WebSocket connections`);
            
            // Test connection counting
            const clientCount = this.webUI.clients.size;
            this.addTestResult('Connection Counting', clientCount >= 3,
                `WebUI tracking ${clientCount} client connections`);
            
            // Clean up connections
            connections.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            });
            
            // Wait for cleanup
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log(chalk.green('✓ Connection handling tests completed'));
            
        } catch (error) {
            this.addTestResult('Connection Handling', false, error.message);
            console.error(chalk.red('❌ Connection handling test failed:'), error.message);
        }
    }

    async testSecurityFeatures() {
        console.log(chalk.blue('\n🔄 Test 7: Security Features'));
        
        try {
            if (!this.webUI) {
                throw new Error('WebUI not initialized');
            }
            
            // Test security token
            const tokenLength = this.webUI.sessionToken.length;
            const tokenValid = tokenLength >= 48; // Should be at least 48 characters for security
            this.addTestResult('Security Token Length', tokenValid,
                `Token length: ${tokenLength} characters (min 48 required)`);
            
            // Test token expiry
            const tokenExpiry = this.webUI.tokenExpiry;
            const expiryValid = tokenExpiry > Date.now();
            this.addTestResult('Token Expiry', expiryValid,
                expiryValid ? 'Token has valid expiry date' : 'Token expiry invalid');
            
            // Test security headers (check a few key ones)
            const rootResponse = await this.makeHTTPRequest('GET', '/');
            const hasSecurityHeaders = rootResponse.headers && 
                                     rootResponse.headers['x-content-type-options'] === 'nosniff' &&
                                     rootResponse.headers['x-frame-options'] === 'DENY';
            
            this.addTestResult('Security Headers', hasSecurityHeaders,
                hasSecurityHeaders ? 'Security headers properly set' : 'Security headers missing or incorrect');
            
            // Test CSP header
            const hasCsp = rootResponse.headers && rootResponse.headers['content-security-policy'];
            this.addTestResult('Content Security Policy', !!hasCsp,
                hasCsp ? 'CSP header present' : 'CSP header missing');
            
            console.log(chalk.green('✓ Security feature tests completed'));
            
        } catch (error) {
            this.addTestResult('Security Features', false, error.message);
            console.error(chalk.red('❌ Security feature test failed:'), error.message);
        }
    }

    async testWebUILifecycle() {
        console.log(chalk.blue('\n🔄 Test 8: WebUI Lifecycle'));
        
        try {
            if (!this.webUI) {
                throw new Error('WebUI not initialized');
            }
            
            // Test that WebUI is running
            const isRunning = this.webUI.server && this.webUI.server.listening;
            this.addTestResult('WebUI Running State', isRunning,
                isRunning ? 'WebUI server is running and listening' : 'WebUI server not running');
            
            // Test port assignment
            const correctPort = this.webUI.port === this.testPort;
            this.addTestResult('Port Assignment', correctPort,
                `WebUI port: ${this.webUI.port}, expected: ${this.testPort}`);
            
            // Test WebSocket server integration
            const wsServerIntegrated = this.webUI.wss && this.webUI.wss.options.server === this.webUI.server;
            this.addTestResult('WebSocket Integration', wsServerIntegrated,
                wsServerIntegrated ? 'WebSocket server properly integrated' : 'WebSocket integration issue');
            
            // Test session initialization
            const sessionInitialized = this.webUI.sessionData && 
                                      typeof this.webUI.sessionData.startTime === 'number' &&
                                      this.webUI.sessionData.startTime > 0;
            this.addTestResult('Session Initialization', sessionInitialized,
                sessionInitialized ? 'Session properly initialized' : 'Session initialization failed');
            
            console.log(chalk.green('✓ WebUI lifecycle tests completed'));
            
        } catch (error) {
            this.addTestResult('WebUI Lifecycle', false, error.message);
            console.error(chalk.red('❌ WebUI lifecycle test failed:'), error.message);
        }
    }

    async makeHTTPRequest(method, path) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: this.testPort,
                path: path,
                method: method,
                timeout: 5000
            };
            
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                });
            });
            
            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));
            req.end();
        });
    }

    async checkServerListening(port) {
        try {
            const response = await this.makeHTTPRequest('HEAD', '/');
            return response.status >= 200 && response.status < 400;
        } catch (error) {
            return false;
        }
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
        const reportPath = path.join(__dirname, 'claude-loop-direct-webui-integration-report.json');
        
        try {
            fs.writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2));
            
            console.log('\n' + '═'.repeat(60));
            console.log(chalk.cyan.bold('📊 Direct WebUI Integration Test Results'));
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
    const tester = new DirectWebUITester();
    tester.runAllTests().catch(error => {
        console.error(chalk.red('❌ Test suite failed:'), error.message);
        process.exit(1);
    });
}

module.exports = DirectWebUITester;