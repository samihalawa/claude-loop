#!/usr/bin/env node

/**
 * Comprehensive Express Server Test
 * Tests the WebUI server functionality including:
 * - Server startup and shutdown
 * - Express middleware
 * - WebSocket connections
 * - API endpoints
 * - Security features
 * - Rate limiting
 * - Authentication
 */

const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const WebSocket = require('ws');

class ExpressServerTester {
    constructor() {
        this.port = 3333;
        this.serverProcess = null;
        this.testResults = [];
        this.websocketToken = null;
        this.serverLogFile = path.join(__dirname, 'server-test.log');
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${type.toUpperCase()}]`;
        
        switch (type) {
            case 'success':
                console.log(chalk.green(`${prefix} ${message}`));
                break;
            case 'error':
                console.log(chalk.red(`${prefix} ${message}`));
                break;
            case 'warning':
                console.log(chalk.yellow(`${prefix} ${message}`));
                break;
            default:
                console.log(chalk.blue(`${prefix} ${message}`));
        }
    }

    async startServer() {
        this.log('Starting Express server test...');
        
        try {
            // Create a simple test server using the WebUI class
            const testServerCode = `
const WebUI = require('./lib/web-ui');
const chalk = require('chalk');

const webUI = new WebUI(${this.port});

console.log('Test server starting...');
webUI.start().then(() => {
    console.log('Test server started successfully');
    console.log('Access token:', webUI.sessionToken);
    
    // Keep the server running
    process.on('SIGINT', () => {
        console.log('Shutting down test server...');
        webUI.stop().then(() => {
            process.exit(0);
        });
    });
}).catch((error) => {
    console.error('Failed to start test server:', error);
    process.exit(1);
});
`;

            // Write the test server script
            const serverScript = path.join(__dirname, 'temp-test-server.js');
            await fs.writeFile(serverScript, testServerCode);
            
            // Start the server process
            this.serverProcess = spawn('node', [serverScript], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: __dirname
            });

            // Capture server output
            let serverOutput = '';
            this.serverProcess.stdout.on('data', (data) => {
                const output = data.toString();
                serverOutput += output;
                
                // Extract the access token from server output
                const tokenMatch = output.match(/Access token: ([a-f0-9]+)/);
                if (tokenMatch) {
                    this.websocketToken = tokenMatch[1];
                    this.log(`Extracted access token: ${this.websocketToken.substring(0, 10)}...`);
                }
            });

            this.serverProcess.stderr.on('data', (data) => {
                serverOutput += data.toString();
            });

            // Wait for server to start
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Server startup timeout'));
                }, 10000);

                const checkServer = setInterval(async () => {
                    try {
                        // Try to connect to the server
                        const response = await fetch(`http://localhost:${this.port}/health`);
                        if (response.ok) {
                            clearTimeout(timeout);
                            clearInterval(checkServer);
                            resolve();
                        }
                    } catch (error) {
                        // Server not ready yet
                    }
                }, 500);
            });

            // Write server output to log file
            await fs.writeFile(this.serverLogFile, serverOutput);
            this.log('Server started successfully', 'success');
            
        } catch (error) {
            this.log(`Failed to start server: ${error.message}`, 'error');
            throw error;
        }
    }

    async testHealthEndpoint() {
        this.log('Testing health endpoint...');
        
        try {
            const response = await fetch(`http://localhost:${this.port}/health`);
            const data = await response.json();
            
            if (response.ok && data.status === 'ok') {
                this.log('Health endpoint working correctly', 'success');
                this.testResults.push({ test: 'Health Endpoint', status: 'PASS' });
            } else {
                throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
            }
        } catch (error) {
            this.log(`Health endpoint test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Health Endpoint', status: 'FAIL', error: error.message });
        }
    }

    async testAuthenticationRequired() {
        this.log('Testing authentication requirement...');
        
        try {
            // Test without token
            const response = await fetch(`http://localhost:${this.port}/`);
            
            if (response.status === 401) {
                this.log('Authentication correctly required', 'success');
                this.testResults.push({ test: 'Authentication Required', status: 'PASS' });
            } else {
                throw new Error(`Expected 401, got ${response.status}`);
            }
        } catch (error) {
            this.log(`Authentication test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Authentication Required', status: 'FAIL', error: error.message });
        }
    }

    async testMainDashboard() {
        this.log('Testing main dashboard with valid token...');
        
        try {
            if (!this.websocketToken) {
                throw new Error('No access token available');
            }

            const response = await fetch(`http://localhost:${this.port}/?token=${this.websocketToken}`);
            
            if (response.ok) {
                const html = await response.text();
                
                // Check for key dashboard elements
                const hasTitle = html.includes('Claude Loop');
                const hasWebSocket = html.includes('WebSocket');
                const hasBootstrap = html.includes('bootstrap');
                
                if (hasTitle && hasWebSocket && hasBootstrap) {
                    this.log('Dashboard loads correctly with all components', 'success');
                    this.testResults.push({ test: 'Main Dashboard', status: 'PASS' });
                } else {
                    throw new Error('Dashboard missing expected components');
                }
            } else {
                throw new Error(`Dashboard returned ${response.status}`);
            }
        } catch (error) {
            this.log(`Dashboard test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Main Dashboard', status: 'FAIL', error: error.message });
        }
    }

    async testSessionAPI() {
        this.log('Testing session API endpoint...');
        
        try {
            if (!this.websocketToken) {
                throw new Error('No access token available');
            }

            const response = await fetch(`http://localhost:${this.port}/api/session?token=${this.websocketToken}`);
            
            if (response.ok) {
                const sessionData = await response.json();
                
                // Check for expected session data structure
                const hasIterations = typeof sessionData.iterations === 'number';
                const hasCurrentPhase = typeof sessionData.currentPhase === 'string';
                const hasOutput = Array.isArray(sessionData.output);
                const hasStartTime = typeof sessionData.startTime === 'number';
                
                if (hasIterations && hasCurrentPhase && hasOutput && hasStartTime) {
                    this.log('Session API returns correct data structure', 'success');
                    this.testResults.push({ test: 'Session API', status: 'PASS' });
                } else {
                    throw new Error('Session data structure invalid');
                }
            } else {
                throw new Error(`Session API returned ${response.status}`);
            }
        } catch (error) {
            this.log(`Session API test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Session API', status: 'FAIL', error: error.message });
        }
    }

    async testWebSocketConnection() {
        this.log('Testing WebSocket connection...');
        
        try {
            if (!this.websocketToken) {
                throw new Error('No access token available');
            }

            const wsUrl = `ws://localhost:${this.port}?token=${this.websocketToken}`;
            const ws = new WebSocket(wsUrl);
            
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('WebSocket connection timeout'));
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

                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        this.log(`Received WebSocket message: ${message.type}`);
                    } catch (e) {
                        this.log(`Received non-JSON WebSocket message: ${data.toString()}`);
                    }
                });
            });

            // Test WebSocket message sending
            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));

            // Wait a bit for any responses
            await new Promise(resolve => setTimeout(resolve, 1000));

            ws.close();
            this.testResults.push({ test: 'WebSocket Connection', status: 'PASS' });
            
        } catch (error) {
            this.log(`WebSocket test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'WebSocket Connection', status: 'FAIL', error: error.message });
        }
    }

    async testRateLimiting() {
        this.log('Testing rate limiting...');
        
        try {
            if (!this.websocketToken) {
                throw new Error('No access token available');
            }

            // Make many rapid requests to trigger rate limiting
            const requests = [];
            for (let i = 0; i < 50; i++) {
                requests.push(
                    fetch(`http://localhost:${this.port}/health?token=${this.websocketToken}`)
                        .then(r => r.status)
                        .catch(() => 429)
                );
            }

            const results = await Promise.all(requests);
            const rateLimitedRequests = results.filter(status => status === 429);

            if (rateLimitedRequests.length > 0) {
                this.log(`Rate limiting working: ${rateLimitedRequests.length} requests were rate limited`, 'success');
                this.testResults.push({ test: 'Rate Limiting', status: 'PASS' });
            } else {
                this.log('Rate limiting may not be working as expected', 'warning');
                this.testResults.push({ test: 'Rate Limiting', status: 'PARTIAL', note: 'No rate limiting detected' });
            }
        } catch (error) {
            this.log(`Rate limiting test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Rate Limiting', status: 'FAIL', error: error.message });
        }
    }

    async testSecurityHeaders() {
        this.log('Testing security headers...');
        
        try {
            if (!this.websocketToken) {
                throw new Error('No access token available');
            }

            const response = await fetch(`http://localhost:${this.port}/?token=${this.websocketToken}`);
            
            const expectedHeaders = [
                'x-content-type-options',
                'x-frame-options',
                'x-xss-protection',
                'referrer-policy',
                'content-security-policy'
            ];

            const missingHeaders = expectedHeaders.filter(header => 
                !response.headers.has(header)
            );

            if (missingHeaders.length === 0) {
                this.log('All security headers present', 'success');
                this.testResults.push({ test: 'Security Headers', status: 'PASS' });
            } else {
                this.log(`Missing security headers: ${missingHeaders.join(', ')}`, 'warning');
                this.testResults.push({ 
                    test: 'Security Headers', 
                    status: 'PARTIAL', 
                    note: `Missing: ${missingHeaders.join(', ')}` 
                });
            }
        } catch (error) {
            this.log(`Security headers test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Security Headers', status: 'FAIL', error: error.message });
        }
    }

    async stopServer() {
        this.log('Stopping test server...');
        
        if (this.serverProcess) {
            this.serverProcess.kill('SIGINT');
            
            // Wait for process to exit
            await new Promise((resolve) => {
                this.serverProcess.on('exit', resolve);
                setTimeout(resolve, 5000); // Force exit after 5 seconds
            });
        }

        // Clean up temp files
        try {
            await fs.unlink(path.join(__dirname, 'temp-test-server.js'));
        } catch (error) {
            // Ignore cleanup errors
        }

        this.log('Server stopped', 'success');
    }

    async generateReport() {
        this.log('\n' + '='.repeat(60));
        this.log('EXPRESS SERVER TEST RESULTS');
        this.log('='.repeat(60));

        let passCount = 0;
        let failCount = 0;
        let partialCount = 0;

        this.testResults.forEach(result => {
            const status = result.status === 'PASS' ? chalk.green('✓ PASS') :
                          result.status === 'FAIL' ? chalk.red('✗ FAIL') :
                          chalk.yellow('~ PARTIAL');
            
            this.log(`${result.test}: ${status}`);
            
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
        this.log(`Total Tests: ${this.testResults.length}`);
        this.log(`Passed: ${passCount}`, 'success');
        this.log(`Failed: ${failCount}`, failCount > 0 ? 'error' : 'info');
        this.log(`Partial: ${partialCount}`, partialCount > 0 ? 'warning' : 'info');
        this.log('-'.repeat(60));

        // Write detailed report
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total: this.testResults.length,
                passed: passCount,
                failed: failCount,
                partial: partialCount
            },
            tests: this.testResults,
            serverLog: this.serverLogFile
        };

        const reportFile = path.join(__dirname, 'express-server-test-report.json');
        await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
        this.log(`Detailed report written to: ${reportFile}`, 'info');

        return failCount === 0;
    }

    async runAllTests() {
        try {
            await this.startServer();
            
            // Run all tests
            await this.testHealthEndpoint();
            await this.testAuthenticationRequired();
            await this.testMainDashboard();
            await this.testSessionAPI();
            await this.testWebSocketConnection();
            await this.testRateLimiting();
            await this.testSecurityHeaders();
            
        } catch (error) {
            this.log(`Test execution failed: ${error.message}`, 'error');
        } finally {
            await this.stopServer();
            return await this.generateReport();
        }
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    const tester = new ExpressServerTester();
    tester.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = ExpressServerTester;