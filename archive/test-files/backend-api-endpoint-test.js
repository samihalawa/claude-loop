#!/usr/bin/env node

const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Test configuration
const TEST_CONFIG = {
    express_server: {
        port: 3001,
        file: './test-broken-app.js'
    },
    webui_server: {
        port: 3333,
        file: './lib/web-ui.js'
    },
    timeout: 30000, // 30 seconds
    retry_attempts: 3,
    retry_delay: 2000 // 2 seconds
};

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Utility function to wait
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// HTTP request helper
function makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const protocol = options.protocol === 'https:' ? https : http;
        const req = protocol.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: body,
                    rawResponse: res
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.setTimeout(TEST_CONFIG.timeout, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        if (postData) {
            req.write(postData);
        }
        
        req.end();
    });
}

// Start server helper
function startServer(serverFile, expectedPort) {
    return new Promise((resolve, reject) => {
        log(`Starting server: ${serverFile}`, 'cyan');
        
        const serverProcess = spawn('node', [serverFile], {
            stdio: 'pipe',
            env: { ...process.env, PORT: expectedPort }
        });
        
        let output = '';
        let hasStarted = false;
        
        const timeout = setTimeout(() => {
            if (!hasStarted) {
                serverProcess.kill();
                reject(new Error(`Server startup timeout for ${serverFile}`));
            }
        }, TEST_CONFIG.timeout);
        
        serverProcess.stdout.on('data', (data) => {
            output += data.toString();
            const dataStr = data.toString();
            if (dataStr.includes(`${expectedPort}`) || 
                dataStr.includes('listening') || 
                dataStr.includes('started') ||
                dataStr.includes('running')) {
                hasStarted = true;
                clearTimeout(timeout);
                resolve(serverProcess);
            }
        });
        
        serverProcess.stderr.on('data', (data) => {
            output += data.toString();
            log(`Server stderr: ${data.toString()}`, 'yellow');
        });
        
        serverProcess.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
        
        serverProcess.on('exit', (code) => {
            if (!hasStarted) {
                clearTimeout(timeout);
                reject(new Error(`Server exited with code ${code}. Output: ${output}`));
            }
        });
        
        // Give server additional time to start
        setTimeout(() => {
            if (!hasStarted) {
                hasStarted = true;
                clearTimeout(timeout);
                resolve(serverProcess);
            }
        }, 5000);
    });
}

// Check if port is available
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = http.createServer();
        server.listen(port, (err) => {
            if (err) {
                resolve(false);
            } else {
                server.close(() => {
                    resolve(true);
                });
            }
        });
        server.on('error', () => {
            resolve(false);
        });
    });
}

// Wait for server to be ready
async function waitForServer(port, maxAttempts = 15) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await makeRequest({
                hostname: 'localhost',
                port: port,
                path: '/health',
                method: 'GET',
                timeout: 5000
            });
            if (response.statusCode < 500) {
                return true;
            }
        } catch (error) {
            // Server not ready yet
        }
        await wait(2000);
        log(`Waiting for server on port ${port}... (attempt ${i + 1}/${maxAttempts})`, 'gray');
    }
    return false;
}

// API endpoint tests
class APIEndpointTester {
    constructor() {
        this.testResults = [];
        this.servers = [];
    }

    async runTest(testName, testFunc) {
        log(`\n🧪 Running test: ${testName}`, 'bold');
        const startTime = Date.now();
        
        try {
            const result = await testFunc();
            const duration = Date.now() - startTime;
            
            this.testResults.push({
                name: testName,
                status: 'PASS',
                duration: duration,
                result: result
            });
            
            log(`✅ PASS: ${testName} (${duration}ms)`, 'green');
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            
            this.testResults.push({
                name: testName,
                status: 'FAIL',
                duration: duration,
                error: error.message
            });
            
            log(`❌ FAIL: ${testName} (${duration}ms)`, 'red');
            log(`   Error: ${error.message}`, 'red');
            return null;
        }
    }

    async testExpressServerEndpoints() {
        const port = TEST_CONFIG.express_server.port;
        
        // Test all Express server endpoints
        const endpoints = [
            { path: '/', method: 'GET', name: 'Homepage' },
            { path: '/health', method: 'GET', name: 'Health Check' },
            { path: '/api/test', method: 'GET', name: 'Test API' },
            { path: '/api/config', method: 'GET', name: 'Config API' },
            { path: '/api/data', method: 'POST', name: 'Data API', 
              data: JSON.stringify({ data: 'test data' }),
              headers: { 'Content-Type': 'application/json' }
            }
        ];

        for (const endpoint of endpoints) {
            await this.runTest(`Express ${endpoint.name} (${endpoint.method} ${endpoint.path})`, async () => {
                const options = {
                    hostname: 'localhost',
                    port: port,
                    path: endpoint.path,
                    method: endpoint.method,
                    headers: endpoint.headers || {}
                };

                const response = await makeRequest(options, endpoint.data);
                
                if (response.statusCode >= 400) {
                    throw new Error(`HTTP ${response.statusCode}: ${response.body}`);
                }

                // Parse response if JSON
                let parsedBody;
                try {
                    parsedBody = JSON.parse(response.body);
                } catch (e) {
                    parsedBody = response.body;
                }

                return {
                    statusCode: response.statusCode,
                    headers: response.headers,
                    body: parsedBody
                };
            });
        }
    }

    async testWebUIServerEndpoints() {
        const port = TEST_CONFIG.webui_server.port;
        
        // Note: WebUI requires token authentication
        // We'll test the health endpoint and token-protected routes
        
        await this.runTest('WebUI Health Check (no token)', async () => {
            try {
                const response = await makeRequest({
                    hostname: 'localhost',
                    port: port,
                    path: '/health',
                    method: 'GET'
                });
                
                // Should fail with 401 due to missing token
                if (response.statusCode !== 401) {
                    throw new Error(`Expected 401, got ${response.statusCode}`);
                }
                
                return { message: 'Correctly rejected request without token' };
            } catch (error) {
                if (error.code === 'ECONNREFUSED') {
                    throw new Error('WebUI server not running or not accessible');
                }
                throw error;
            }
        });
        
        await this.runTest('WebUI Session API (no token)', async () => {
            try {
                const response = await makeRequest({
                    hostname: 'localhost',
                    port: port,
                    path: '/api/session',
                    method: 'GET'
                });
                
                // Should fail with 401 due to missing token
                if (response.statusCode !== 401) {
                    throw new Error(`Expected 401, got ${response.statusCode}`);
                }
                
                return { message: 'Correctly rejected session request without token' };
            } catch (error) {
                if (error.code === 'ECONNREFUSED') {
                    throw new Error('WebUI server not running or not accessible');
                }
                throw error;
            }
        });
    }

    async testErrorHandling() {
        const port = TEST_CONFIG.express_server.port;
        
        // Test 404 handling
        await this.runTest('404 Error Handling', async () => {
            const response = await makeRequest({
                hostname: 'localhost',
                port: port,
                path: '/nonexistent-endpoint',
                method: 'GET'
            });
            
            if (response.statusCode !== 404) {
                throw new Error(`Expected 404, got ${response.statusCode}`);
            }
            
            return { statusCode: response.statusCode, body: response.body };
        });
        
        // Test invalid POST data
        await this.runTest('Invalid POST Data Handling', async () => {
            const response = await makeRequest({
                hostname: 'localhost',
                port: port,
                path: '/api/data',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, 'invalid json data');
            
            if (response.statusCode < 400) {
                throw new Error(`Expected error status, got ${response.statusCode}`);
            }
            
            return { statusCode: response.statusCode, body: response.body };
        });
        
        // Test missing required fields
        await this.runTest('Missing Required Fields', async () => {
            const response = await makeRequest({
                hostname: 'localhost',
                port: port,
                path: '/api/data',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, JSON.stringify({}));
            
            if (response.statusCode !== 400) {
                throw new Error(`Expected 400, got ${response.statusCode}`);
            }
            
            return { statusCode: response.statusCode, body: response.body };
        });
    }

    async testSecurityFeatures() {
        const port = TEST_CONFIG.express_server.port;
        
        // Test XSS prevention
        await this.runTest('XSS Prevention', async () => {
            const maliciousData = {
                data: '<script>alert("xss")</script>'
            };
            
            const response = await makeRequest({
                hostname: 'localhost',
                port: port,
                path: '/api/data',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, JSON.stringify(maliciousData));
            
            // XSS prevention should succeed with sanitized response
            if (response.statusCode !== 200) {
                throw new Error(`Expected successful request with sanitized content, got ${response.statusCode}`);
            }
            
            // Check if XSS was properly handled
            const parsedBody = JSON.parse(response.body);
            if (!parsedBody.success || !parsedBody.result) {
                throw new Error('Response format is incorrect');
            }
            
            // Verify the malicious script tag was removed
            const processedData = parsedBody.result.processed;
            if (processedData.includes('<script>') || processedData.includes('alert')) {
                throw new Error('XSS script tag not properly sanitized');
            }
            
            // Verify that the content was actually sanitized (empty or clean)
            if (processedData.length === 0 || !processedData.includes('xss')) {
                return { 
                    message: 'XSS properly handled - malicious content sanitized', 
                    sanitizedContent: processedData,
                    originalLength: maliciousData.data.length,
                    sanitizedLength: processedData.length
                };
            } else {
                return { 
                    message: 'XSS partially handled - some content preserved safely', 
                    sanitizedContent: processedData 
                };
            }
        });
        
        // Test large payload handling
        await this.runTest('Large Payload Handling', async () => {
            const largeData = {
                data: 'x'.repeat(20 * 1024 * 1024) // 20MB
            };
            
            try {
                const response = await makeRequest({
                    hostname: 'localhost',
                    port: port,
                    path: '/api/data',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }, JSON.stringify(largeData));
                
                // Should either succeed or fail gracefully
                return { 
                    statusCode: response.statusCode,
                    message: response.statusCode >= 400 ? 'Large payload properly rejected' : 'Large payload accepted'
                };
            } catch (error) {
                if (error.message.includes('ECONNRESET') || error.message.includes('timeout')) {
                    return { message: 'Large payload properly handled with connection reset' };
                }
                throw error;
            }
        });
    }

    async generateReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(t => t.status === 'PASS').length;
        const failedTests = this.testResults.filter(t => t.status === 'FAIL').length;
        const totalDuration = this.testResults.reduce((sum, t) => sum + t.duration, 0);
        
        const report = {
            summary: {
                total: totalTests,
                passed: passedTests,
                failed: failedTests,
                success_rate: `${Math.round((passedTests / totalTests) * 100)}%`,
                total_duration: `${totalDuration}ms`
            },
            results: this.testResults,
            timestamp: new Date().toISOString()
        };
        
        // Save detailed report
        await fs.writeFile(
            path.join(__dirname, 'backend-api-test-report.json'),
            JSON.stringify(report, null, 2)
        );
        
        // Print summary
        log('\n📊 API Endpoint Testing Summary', 'bold');
        log('━'.repeat(50), 'gray');
        log(`Total Tests: ${totalTests}`, 'cyan');
        log(`Passed: ${passedTests}`, 'green');
        log(`Failed: ${failedTests}`, failedTests > 0 ? 'red' : 'green');
        log(`Success Rate: ${report.summary.success_rate}`, passedTests === totalTests ? 'green' : 'yellow');
        log(`Total Duration: ${totalDuration}ms`, 'gray');
        log('━'.repeat(50), 'gray');
        
        if (failedTests > 0) {
            log('\n❌ Failed Tests:', 'red');
            this.testResults.filter(t => t.status === 'FAIL').forEach(test => {
                log(`  • ${test.name}: ${test.error}`, 'red');
            });
        }
        
        log(`\n📄 Detailed report saved to: backend-api-test-report.json`, 'cyan');
        
        return report;
    }

    async cleanup() {
        log('\n🧹 Cleaning up servers...', 'yellow');
        for (const server of this.servers) {
            if (server && !server.killed) {
                server.kill('SIGTERM');
                // Wait for graceful shutdown
                await wait(2000);
                if (!server.killed) {
                    server.kill('SIGKILL');
                }
            }
        }
        log('✅ Cleanup completed', 'green');
    }

    async run() {
        log('🚀 Starting Backend API Endpoint Testing', 'bold');
        log('━'.repeat(50), 'gray');
        
        try {
            // Check if Express server file exists
            const expressServerExists = await fs.access(TEST_CONFIG.express_server.file).then(() => true).catch(() => false);
            
            if (expressServerExists) {
                log(`📡 Starting Express test server...`, 'cyan');
                
                // Check if port is available
                const expressPortAvailable = await isPortAvailable(TEST_CONFIG.express_server.port);
                if (!expressPortAvailable) {
                    log(`⚠️  Port ${TEST_CONFIG.express_server.port} is busy, using different port`, 'yellow');
                    TEST_CONFIG.express_server.port = 3010;
                }
                
                // Start Express server
                const expressServer = await startServer(
                    TEST_CONFIG.express_server.file,
                    TEST_CONFIG.express_server.port
                );
                this.servers.push(expressServer);
                
                // Wait for server to be ready
                await wait(3000);
                
                const isExpressReady = await waitForServer(TEST_CONFIG.express_server.port);
                if (isExpressReady) {
                    log(`✅ Express server ready on port ${TEST_CONFIG.express_server.port}`, 'green');
                    
                    // Run Express server tests
                    await this.testExpressServerEndpoints();
                    await this.testErrorHandling();
                    await this.testSecurityFeatures();
                } else {
                    log(`❌ Express server failed to start properly`, 'red');
                }
            } else {
                log(`⚠️  Express server file not found: ${TEST_CONFIG.express_server.file}`, 'yellow');
            }
            
            // Test WebUI server (if running)
            log(`\n📡 Testing WebUI server endpoints...`, 'cyan');
            await this.testWebUIServerEndpoints();
            
            // Generate final report
            const report = await this.generateReport();
            
            return report;
            
        } catch (error) {
            log(`💥 Critical error during testing: ${error.message}`, 'red');
            throw error;
        } finally {
            await this.cleanup();
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new APIEndpointTester();
    
    // Handle cleanup on exit
    process.on('SIGINT', async () => {
        log('\n🛑 Received SIGINT, cleaning up...', 'yellow');
        await tester.cleanup();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        log('\n🛑 Received SIGTERM, cleaning up...', 'yellow');
        await tester.cleanup();
        process.exit(0);
    });
    
    tester.run()
        .then((report) => {
            log('\n🎉 API endpoint testing completed successfully!', 'green');
            process.exit(report.summary.failed > 0 ? 1 : 0);
        })
        .catch((error) => {
            log(`\n💥 Testing failed: ${error.message}`, 'red');
            process.exit(1);
        });
}

module.exports = APIEndpointTester;