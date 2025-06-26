#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const chalk = require('chalk');
const crypto = require('crypto');

class CLIWebUIIntegrationTest {
    constructor() {
        this.testResults = [];
        this.testPort = 3339; // Unique port for this test
        this.cliProcess = null;
        this.testTimeout = 30000; // 30 seconds
    }

    async runTests() {
        console.log(chalk.cyan('🧪 CLI to Web UI Integration Testing\n'));
        
        try {
            // Test 1: CLI help functionality
            await this.testCLIHelp();
            
            // Test 2: CLI version check
            await this.testCLIVersion();
            
            // Test 3: Web UI startup integration
            await this.testWebUIStartup();
            
            // Test 4: CLI with --ui flag integration
            await this.testCLIWithUIFlag();
            
            // Test 5: WebSocket communication test
            await this.testWebSocketCommunication();
            
            // Test 6: Token-based authentication
            await this.testTokenAuthentication();
            
            // Generate test report
            this.generateReport();
            
        } catch (error) {
            console.error(chalk.red(`❌ Integration test failed: ${error.message}`));
            this.testResults.push({
                test: 'Integration Test Suite',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        return this.testResults;
    }

    async testCLIHelp() {
        console.log(chalk.yellow('📋 Testing CLI Help Functionality...'));
        
        return new Promise((resolve, reject) => {
            const helpProcess = spawn('node', ['bin/claude-loop.js', '--help'], {
                cwd: process.cwd(),
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let output = '';
            helpProcess.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            helpProcess.on('close', (code) => {
                if (code === 0 && output.includes('claude-loop') && output.includes('Options')) {
                    console.log(chalk.green('✓ CLI help working correctly'));
                    this.testResults.push({
                        test: 'CLI Help',
                        status: 'PASSED',
                        details: 'Help command executed successfully',
                        timestamp: new Date().toISOString()
                    });
                    resolve();
                } else {
                    const error = `CLI help failed with code ${code}`;
                    console.log(chalk.red(`❌ ${error}`));
                    this.testResults.push({
                        test: 'CLI Help',
                        status: 'FAILED',
                        error: error,
                        timestamp: new Date().toISOString()
                    });
                    reject(new Error(error));
                }
            });
            
            setTimeout(() => {
                helpProcess.kill();
                reject(new Error('CLI help test timeout'));
            }, 5000);
        });
    }

    async testCLIVersion() {
        console.log(chalk.yellow('📋 Testing CLI Version Check...'));
        
        return new Promise((resolve, reject) => {
            const versionProcess = spawn('node', ['bin/claude-loop.js', '--version'], {
                cwd: process.cwd(),
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let output = '';
            versionProcess.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            versionProcess.on('close', (code) => {
                if (code === 0 && output.trim().match(/^\d+\.\d+\.\d+$/)) {
                    console.log(chalk.green(`✓ CLI version check working: ${output.trim()}`));
                    this.testResults.push({
                        test: 'CLI Version',
                        status: 'PASSED',
                        details: `Version: ${output.trim()}`,
                        timestamp: new Date().toISOString()
                    });
                    resolve();
                } else {
                    const error = `CLI version failed with code ${code}`;
                    console.log(chalk.red(`❌ ${error}`));
                    this.testResults.push({
                        test: 'CLI Version',
                        status: 'FAILED',
                        error: error,
                        timestamp: new Date().toISOString()
                    });
                    reject(new Error(error));
                }
            });
            
            setTimeout(() => {
                versionProcess.kill();
                reject(new Error('CLI version test timeout'));
            }, 5000);
        });
    }

    async testWebUIStartup() {
        console.log(chalk.yellow('🌐 Testing Web UI Startup Integration...'));
        
        // Import WebUI class to test direct instantiation
        const WebUI = require('./lib/web-ui');
        
        try {
            const webUI = new WebUI(this.testPort);
            await webUI.start();
            
            // Test if web UI is accessible (health endpoint requires token)
            const token = webUI.sessionToken;
            const response = await this.makeHTTPRequest(`http://localhost:${this.testPort}/health?token=${token}`);
            
            if (response.status === 'ok') {
                console.log(chalk.green('✓ Web UI startup successful'));
                this.testResults.push({
                    test: 'Web UI Startup',
                    status: 'PASSED',
                    details: `Server running on port ${this.testPort}`,
                    timestamp: new Date().toISOString()
                });
            } else {
                throw new Error('Health check failed');
            }
            
            // Clean up
            await webUI.stop();
            
        } catch (error) {
            console.log(chalk.red(`❌ Web UI startup failed: ${error.message}`));
            this.testResults.push({
                test: 'Web UI Startup',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testCLIWithUIFlag() {
        console.log(chalk.yellow('🚀 Testing CLI with --ui Flag Integration...'));
        
        return new Promise((resolve, reject) => {
            // Set environment variable for test port
            process.env.WEBUI_PORT = this.testPort;
            
            const cliProcess = spawn('node', [
                'bin/claude-loop.js', 
                'loop', 
                '--ui', 
                '--max-iterations', '1',
                '--claude-command', 'echo'  // Use echo instead of claude to avoid actual CLI calls
            ], {
                cwd: process.cwd(),
                stdio: ['pipe', 'pipe', 'pipe'],
                env: process.env
            });
            
            let output = '';
            let errorOutput = '';
            
            cliProcess.stdout.on('data', (data) => {
                output += data.toString();
                console.log(chalk.gray(data.toString().trim()));
            });
            
            cliProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
                console.log(chalk.gray(data.toString().trim()));
            });
            
            cliProcess.on('close', (code) => {
                // Check if Web UI startup messages are present
                const webUIStarted = output.includes('Web UI started') || output.includes('🌐');
                const hasProgressMessages = output.includes('Claude Loop') || output.includes('🔄');
                
                if (webUIStarted && hasProgressMessages) {
                    console.log(chalk.green('✓ CLI with --ui flag integration working'));
                    this.testResults.push({
                        test: 'CLI with UI Flag',
                        status: 'PASSED',
                        details: 'UI flag enables web interface correctly',
                        timestamp: new Date().toISOString()
                    });
                    resolve();
                } else {
                    const error = `CLI with UI flag failed. Output: ${output.substring(0, 500)}...`;
                    console.log(chalk.red(`❌ ${error}`));
                    this.testResults.push({
                        test: 'CLI with UI Flag',
                        status: 'FAILED',
                        error: error,
                        timestamp: new Date().toISOString()
                    });
                    reject(new Error(error));
                }
            });
            
            // Kill process after timeout
            setTimeout(() => {
                cliProcess.kill('SIGTERM');
                setTimeout(() => {
                    cliProcess.kill('SIGKILL');
                }, 2000);
            }, this.testTimeout);
        });
    }

    async testWebSocketCommunication() {
        console.log(chalk.yellow('🔌 Testing WebSocket Communication...'));
        
        const WebUI = require('./lib/web-ui');
        const webUI = new WebUI(this.testPort);
        
        try {
            await webUI.start();
            
            // Get the session token for authentication
            const token = webUI.sessionToken;
            
            // Test WebSocket connection
            return new Promise((resolve, reject) => {
                const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${token}`);
                let messageReceived = false;
                let connected = false;
                
                ws.on('open', () => {
                    console.log(chalk.gray('WebSocket connection established'));
                    connected = true;
                    
                    // Test sending a message to trigger session data
                    setTimeout(() => {
                        webUI.updateSession({
                            iterations: 1,
                            currentPhase: 'Testing WebSocket'
                        });
                    }, 100);
                });
                
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        if (message.type === 'session_update' || message.type === 'session_data') {
                            messageReceived = true;
                            console.log(chalk.green('✓ WebSocket message received correctly'));
                            
                            this.testResults.push({
                                test: 'WebSocket Communication',
                                status: 'PASSED',
                                details: 'Real-time communication working',
                                timestamp: new Date().toISOString()
                            });
                            
                            ws.close();
                            resolve();
                        }
                    } catch (error) {
                        reject(new Error(`WebSocket message parsing failed: ${error.message}`));
                    }
                });
                
                ws.on('error', (error) => {
                    reject(new Error(`WebSocket connection failed: ${error.message}`));
                });
                
                ws.on('close', (code, reason) => {
                    if (!messageReceived && !connected) {
                        reject(new Error(`WebSocket closed without connecting: ${code} - ${reason}`));
                    } else if (messageReceived) {
                        // This is expected - message was received and we closed
                        resolve();
                    }
                });
                
                // Timeout
                setTimeout(() => {
                    if (!messageReceived) {
                        ws.close();
                        reject(new Error('WebSocket communication timeout'));
                    }
                }, 15000);
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ WebSocket test failed: ${error.message}`));
            this.testResults.push({
                test: 'WebSocket Communication',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        } finally {
            await webUI.stop();
        }
    }

    async testTokenAuthentication() {
        console.log(chalk.yellow('🔐 Testing Token-based Authentication...'));
        
        const WebUI = require('./lib/web-ui');
        const webUI = new WebUI(this.testPort);
        
        try {
            await webUI.start();
            const validToken = webUI.sessionToken;
            const invalidToken = crypto.randomBytes(32).toString('hex');
            
            // Test 1: Valid token should work
            const validResponse = await this.makeHTTPRequest(
                `http://localhost:${this.testPort}/api/session?token=${validToken}`
            );
            
            if (!validResponse.iterations !== undefined) {
                throw new Error('Valid token authentication failed');
            }
            
            // Test 2: Invalid token should fail
            try {
                await this.makeHTTPRequest(
                    `http://localhost:${this.testPort}/api/session?token=${invalidToken}`
                );
                throw new Error('Invalid token was accepted (security issue)');
            } catch (error) {
                if (!error.message.includes('401') && !error.message.includes('Unauthorized')) {
                    throw new Error('Invalid token should return 401 Unauthorized');
                }
            }
            
            // Test 3: No token should fail
            try {
                await this.makeHTTPRequest(`http://localhost:${this.testPort}/api/session`);
                throw new Error('No token was accepted (security issue)');
            } catch (error) {
                if (!error.message.includes('401') && !error.message.includes('Unauthorized')) {
                    throw new Error('Missing token should return 401 Unauthorized');
                }
            }
            
            console.log(chalk.green('✓ Token authentication working correctly'));
            this.testResults.push({
                test: 'Token Authentication',
                status: 'PASSED',
                details: 'Security authentication functioning properly',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ Token authentication failed: ${error.message}`));
            this.testResults.push({
                test: 'Token Authentication',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        } finally {
            await webUI.stop();
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

    generateReport() {
        console.log(chalk.cyan.bold('\n📊 CLI to Web UI Integration Test Report\n'));
        console.log('='.repeat(60));
        
        const passed = this.testResults.filter(t => t.status === 'PASSED').length;
        const failed = this.testResults.filter(t => t.status === 'FAILED').length;
        const total = this.testResults.length;
        
        console.log(`Total Tests: ${total}`);
        console.log(`${chalk.green('Passed:')} ${passed}`);
        console.log(`${chalk.red('Failed:')} ${failed}`);
        console.log(`Success Rate: ${Math.round((passed / total) * 100)}%\n`);
        
        this.testResults.forEach(result => {
            const statusColor = result.status === 'PASSED' ? chalk.green : chalk.red;
            const statusIcon = result.status === 'PASSED' ? '✓' : '❌';
            
            console.log(`${statusColor(statusIcon)} ${result.test}: ${statusColor(result.status)}`);
            if (result.details) {
                console.log(`   ${chalk.gray(result.details)}`);
            }
            if (result.error) {
                console.log(`   ${chalk.red('Error:')} ${result.error}`);
            }
        });
        
        console.log('\n' + '='.repeat(60));
        
        // Save results to file
        const fs = require('fs').promises;
        const reportPath = './cli-webui-integration-report.json';
        
        fs.writeFile(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            summary: { total, passed, failed, successRate: Math.round((passed / total) * 100) },
            results: this.testResults
        }, null, 2)).then(() => {
            console.log(chalk.gray(`\n📄 Report saved to: ${reportPath}`));
        }).catch(error => {
            console.log(chalk.yellow(`⚠️ Could not save report: ${error.message}`));
        });
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new CLIWebUIIntegrationTest();
    tester.runTests().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error(chalk.red(`\n❌ Test suite failed: ${error.message}`));
        process.exit(1);
    });
}

module.exports = CLIWebUIIntegrationTest;