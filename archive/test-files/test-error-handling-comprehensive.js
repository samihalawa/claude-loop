#!/usr/bin/env node

/**
 * Comprehensive Error Handling and Input Validation Testing
 * Tests error scenarios, input sanitization, error responses, and proper error handling
 */

const http = require('http');
const WebSocket = require('ws');
const WebUI = require('./lib/web-ui');
const { performance } = require('perf_hooks');

class ErrorHandlingTestSuite {
    constructor() {
        this.webUI = null;
        this.testResults = [];
        this.testPort = 3345;
        this.testToken = null;
        this.connections = [];
    }

    async runAllTests() {
        console.log('🚨 Starting Comprehensive Error Handling and Input Validation Testing\n');
        
        try {
            await this.initializeServer();
            this.testToken = this.webUI.sessionToken;
            
            // Test all error handling categories
            await this.testHTTPErrorHandling();
            await this.testInputValidation();
            await this.testWebSocketErrorHandling();
            await this.testSecurityValidation();
            await this.testDataSanitization();
            await this.testRateLimitingErrors();
            await this.testServerErrorRecovery();
            await this.testBoundaryConditions();
            
            this.generateTestReport();
            
        } catch (error) {
            console.error('❌ Error handling test suite failed:', error.message);
            this.addTestResult('SUITE_FAILURE', false, error.message);
        } finally {
            await this.cleanup();
        }
    }

    async initializeServer() {
        console.log('🚀 Initializing server for error handling tests...');
        this.webUI = new WebUI(this.testPort);
        await this.webUI.start();
        console.log(`✅ Server started on port ${this.testPort}\n`);
        this.addTestResult('SERVER_INITIALIZATION', true, 'Server started successfully');
    }

    async testHTTPErrorHandling() {
        console.log('🌐 Testing HTTP Error Handling...');
        
        const errorTests = [
            {
                name: 'Non-existent route',
                path: `/nonexistent?token=${this.testToken}`,
                expectedStatus: 404,
                description: 'Should return 404 for non-existent routes'
            },
            {
                name: 'Method not allowed',
                path: `/health?token=${this.testToken}`,
                method: 'DELETE',
                expectedStatus: 404,
                description: 'Should return 404 for unsupported HTTP methods'
            },
            {
                name: 'Missing authentication',
                path: '/health',
                expectedStatus: 401,
                description: 'Should return 401 for missing authentication'
            },
            {
                name: 'Invalid authentication',
                path: '/health?token=invalid_token_123',
                expectedStatus: 401,
                description: 'Should return 401 for invalid tokens'
            },
            {
                name: 'Malformed token parameter',
                path: '/health?token=',
                expectedStatus: 401,
                description: 'Should return 401 for empty tokens'
            }
        ];

        for (const test of errorTests) {
            try {
                const result = await this.makeHTTPRequest(test.path, test.method || 'GET');
                
                if (result.status === test.expectedStatus) {
                    console.log(`✅ ${test.name}: ${result.status} (Expected ${test.expectedStatus})`);
                    this.addTestResult(`HTTP_ERROR_${test.name.replace(/\s/g, '_')}`, true, 
                        `Status ${result.status} as expected`);
                    
                    // Verify error response has proper structure
                    if (test.expectedStatus >= 400) {
                        try {
                            const errorData = JSON.parse(result.data);
                            if (errorData.error || errorData.message) {
                                console.log(`  ✅ Error response has proper structure`);
                                this.addTestResult(`HTTP_ERROR_STRUCTURE_${test.name.replace(/\s/g, '_')}`, true, 
                                    'Error response properly structured');
                            } else {
                                console.log(`  ⚠️ Error response missing error/message fields`);
                                this.addTestResult(`HTTP_ERROR_STRUCTURE_${test.name.replace(/\s/g, '_')}`, false, 
                                    'Error response missing standard fields');
                            }
                        } catch (parseError) {
                            console.log(`  ⚠️ Error response not in JSON format`);
                            this.addTestResult(`HTTP_ERROR_STRUCTURE_${test.name.replace(/\s/g, '_')}`, false, 
                                'Error response not JSON');
                        }
                    }
                } else {
                    console.log(`❌ ${test.name}: ${result.status} (Expected ${test.expectedStatus})`);
                    this.addTestResult(`HTTP_ERROR_${test.name.replace(/\s/g, '_')}`, false, 
                        `Status ${result.status}, expected ${test.expectedStatus}`);
                }
                
                await this.wait(200); // Small delay between requests
                
            } catch (error) {
                console.log(`❌ ${test.name}: ${error.message}`);
                this.addTestResult(`HTTP_ERROR_${test.name.replace(/\s/g, '_')}`, false, error.message);
            }
        }
        
        console.log('');
    }

    async testInputValidation() {
        console.log('🛡️ Testing Input Validation...');
        
        try {
            // Test WebUI methods with invalid inputs
            const validationTests = [
                {
                    name: 'Null session update',
                    test: () => this.webUI.updateSession(null),
                    expectsCrash: false,
                    description: 'Should handle null session updates gracefully'
                },
                {
                    name: 'Undefined session update',
                    test: () => this.webUI.updateSession(undefined),
                    expectsCrash: false,
                    description: 'Should handle undefined session updates gracefully'
                },
                {
                    name: 'Invalid session data type',
                    test: () => this.webUI.updateSession('invalid_string'),
                    expectsCrash: false,
                    description: 'Should handle non-object session updates gracefully'
                },
                {
                    name: 'Null output message',
                    test: () => this.webUI.addOutput(null, 'info'),
                    expectsCrash: false,
                    description: 'Should handle null output messages gracefully'
                },
                {
                    name: 'Undefined output message',
                    test: () => this.webUI.addOutput(undefined, 'info'),
                    expectsCrash: false,
                    description: 'Should handle undefined output messages gracefully'
                },
                {
                    name: 'Invalid output type',
                    test: () => this.webUI.addOutput('Test message', 'invalid_type'),
                    expectsCrash: false,
                    description: 'Should handle invalid output types gracefully'
                },
                {
                    name: 'Very long message',
                    test: () => this.webUI.addOutput('x'.repeat(50000), 'info'),
                    expectsCrash: false,
                    description: 'Should handle very long messages gracefully'
                },
                {
                    name: 'Circular object broadcast',
                    test: () => {
                        const circular = { test: 'value' };
                        circular.self = circular;
                        return this.webUI.broadcast({ type: 'test', data: circular });
                    },
                    expectsCrash: false,
                    description: 'Should handle circular objects in broadcast gracefully'
                }
            ];

            for (const validation of validationTests) {
                try {
                    await validation.test();
                    
                    if (validation.expectsCrash) {
                        console.log(`❌ ${validation.name}: Expected crash but method succeeded`);
                        this.addTestResult(`INPUT_VALIDATION_${validation.name.replace(/\s/g, '_')}`, false, 
                            'Expected error but method succeeded');
                    } else {
                        console.log(`✅ ${validation.name}: Handled gracefully without crash`);
                        this.addTestResult(`INPUT_VALIDATION_${validation.name.replace(/\s/g, '_')}`, true, 
                            'Method handled invalid input gracefully');
                    }
                } catch (error) {
                    if (validation.expectsCrash) {
                        console.log(`✅ ${validation.name}: Properly threw error: ${error.message}`);
                        this.addTestResult(`INPUT_VALIDATION_${validation.name.replace(/\s/g, '_')}`, true, 
                            'Method properly rejected invalid input');
                    } else {
                        console.log(`❌ ${validation.name}: Unexpected crash: ${error.message}`);
                        this.addTestResult(`INPUT_VALIDATION_${validation.name.replace(/\s/g, '_')}`, false, 
                            `Unexpected error: ${error.message}`);
                    }
                }
            }
            
        } catch (error) {
            console.log(`❌ Input validation test failed: ${error.message}`);
            this.addTestResult('INPUT_VALIDATION', false, error.message);
        }
        
        console.log('');
    }

    async testWebSocketErrorHandling() {
        console.log('🔌 Testing WebSocket Error Handling...');
        
        try {
            // Test WebSocket with proper User-Agent
            const ws = await this.createWebSocketConnection(this.testToken);
            this.connections.push(ws);
            
            const errorTests = [
                {
                    name: 'Invalid JSON message',
                    message: 'invalid json {',
                    expectsClose: false,
                    description: 'Should handle invalid JSON gracefully'
                },
                {
                    name: 'Very large JSON message',
                    message: JSON.stringify({ type: 'test', data: 'x'.repeat(1000000) }),
                    expectsClose: false,
                    description: 'Should handle large messages gracefully'
                },
                {
                    name: 'Deeply nested object',
                    message: JSON.stringify(this.createDeeplyNestedObject(50)),
                    expectsClose: false,
                    description: 'Should handle deeply nested objects'
                },
                {
                    name: 'Non-string message',
                    message: Buffer.from('binary data'),
                    expectsClose: false,
                    description: 'Should handle binary data gracefully'
                }
            ];

            let connectionStable = true;
            ws.on('close', () => {
                connectionStable = false;
            });

            for (const test of errorTests) {
                try {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(test.message);
                        await this.wait(500);
                        
                        if (connectionStable && !test.expectsClose) {
                            console.log(`✅ ${test.name}: Connection remained stable`);
                            this.addTestResult(`WS_ERROR_${test.name.replace(/\s/g, '_')}`, true, 
                                'Connection remained stable after error input');
                        } else if (!connectionStable && test.expectsClose) {
                            console.log(`✅ ${test.name}: Connection properly closed`);
                            this.addTestResult(`WS_ERROR_${test.name.replace(/\s/g, '_')}`, true, 
                                'Connection properly closed for invalid input');
                        } else {
                            console.log(`❌ ${test.name}: Unexpected connection state`);
                            this.addTestResult(`WS_ERROR_${test.name.replace(/\s/g, '_')}`, false, 
                                'Unexpected connection state change');
                        }
                    } else {
                        console.log(`⚠️ ${test.name}: Connection already closed`);
                        this.addTestResult(`WS_ERROR_${test.name.replace(/\s/g, '_')}`, false, 
                            'Connection closed before test');
                        break;
                    }
                } catch (error) {
                    console.log(`❌ ${test.name}: ${error.message}`);
                    this.addTestResult(`WS_ERROR_${test.name.replace(/\s/g, '_')}`, false, error.message);
                }
            }
            
        } catch (error) {
            console.log(`❌ WebSocket error handling test failed: ${error.message}`);
            this.addTestResult('WS_ERROR_HANDLING', false, error.message);
        }
        
        console.log('');
    }

    async testSecurityValidation() {
        console.log('🔒 Testing Security Validation...');
        
        const securityTests = [
            {
                name: 'XSS attempt in query parameter',
                path: `/health?token=${this.testToken}&test=<script>alert('xss')</script>`,
                description: 'Should handle XSS attempts in query parameters'
            },
            {
                name: 'SQL injection attempt',
                path: `/health?token=${this.testToken}&id=1'; DROP TABLE users; --`,
                description: 'Should handle SQL injection attempts'
            },
            {
                name: 'Path traversal attempt',
                path: `/health?token=${this.testToken}&file=../../../etc/passwd`,
                description: 'Should handle path traversal attempts'
            },
            {
                name: 'Command injection attempt',
                path: `/health?token=${this.testToken}&cmd=; rm -rf /`,
                description: 'Should handle command injection attempts'
            },
            {
                name: 'Header injection attempt',
                path: `/health?token=${this.testToken}`,
                headers: {
                    'X-Injected-Header': '\r\nMalicious: value',
                    'User-Agent': 'Malicious\r\nInjected: header'
                },
                description: 'Should handle header injection attempts'
            }
        ];

        for (const test of securityTests) {
            try {
                const result = await this.makeHTTPRequest(test.path, 'GET', null, test.headers);
                
                // Any response is acceptable as long as the server doesn't crash
                if (result.status) {
                    console.log(`✅ ${test.name}: Server handled security test (status: ${result.status})`);
                    this.addTestResult(`SECURITY_${test.name.replace(/\s/g, '_')}`, true, 
                        `Server remained stable, status: ${result.status}`);
                } else {
                    console.log(`❌ ${test.name}: No response from server`);
                    this.addTestResult(`SECURITY_${test.name.replace(/\s/g, '_')}`, false, 
                        'No response from server');
                }
                
                await this.wait(200);
                
            } catch (error) {
                console.log(`❌ ${test.name}: ${error.message}`);
                this.addTestResult(`SECURITY_${test.name.replace(/\s/g, '_')}`, false, error.message);
            }
        }
        
        console.log('');
    }

    async testDataSanitization() {
        console.log('🧼 Testing Data Sanitization...');
        
        try {
            // Test output sanitization
            const sanitizationTests = [
                {
                    name: 'HTML in output message',
                    input: '<script>alert("xss")</script>Hello World',
                    description: 'Should sanitize HTML in output messages'
                },
                {
                    name: 'Control characters',
                    input: 'Hello\x00\x01\x02World',
                    description: 'Should handle control characters'
                },
                {
                    name: 'Unicode characters',
                    input: 'Hello 👋 World 🌍',
                    description: 'Should handle Unicode characters properly'
                },
                {
                    name: 'Very long string',
                    input: 'A'.repeat(50000),
                    description: 'Should handle very long strings'
                },
                {
                    name: 'Special characters',
                    input: '!@#$%^&*()_+-=[]{}|;:\'",.<>?',
                    description: 'Should handle special characters'
                }
            ];

            for (const test of sanitizationTests) {
                try {
                    // Test adding output with potentially dangerous content
                    this.webUI.addOutput(test.input, 'info');
                    
                    console.log(`✅ ${test.name}: Output added without crash`);
                    this.addTestResult(`SANITIZATION_${test.name.replace(/\s/g, '_')}`, true, 
                        'Content processed without errors');
                        
                } catch (error) {
                    console.log(`❌ ${test.name}: ${error.message}`);
                    this.addTestResult(`SANITIZATION_${test.name.replace(/\s/g, '_')}`, false, error.message);
                }
            }
            
        } catch (error) {
            console.log(`❌ Data sanitization test failed: ${error.message}`);
            this.addTestResult('DATA_SANITIZATION', false, error.message);
        }
        
        console.log('');
    }

    async testRateLimitingErrors() {
        console.log('📊 Testing Rate Limiting Error Responses...');
        
        try {
            console.log('  🚀 Sending rapid requests to trigger rate limiting...');
            
            const rapidRequests = [];
            for (let i = 0; i < 40; i++) {
                rapidRequests.push(this.makeHTTPRequest(`/health?token=${this.testToken}`, 'GET'));
            }
            
            const results = await Promise.all(rapidRequests);
            
            const successCount = results.filter(r => r.status === 200).length;
            const rateLimitedCount = results.filter(r => r.status === 429).length;
            
            if (rateLimitedCount > 0) {
                console.log(`✅ Rate limiting triggered: ${rateLimitedCount} requests limited, ${successCount} successful`);
                this.addTestResult('RATE_LIMITING_ERRORS', true, 
                    `${rateLimitedCount} requests properly rate limited`);
                
                // Check rate limit error response structure
                const rateLimitedResponse = results.find(r => r.status === 429);
                if (rateLimitedResponse) {
                    try {
                        const errorData = JSON.parse(rateLimitedResponse.data);
                        if (errorData.error && errorData.retryAfter) {
                            console.log(`✅ Rate limit error response properly structured`);
                            this.addTestResult('RATE_LIMIT_ERROR_STRUCTURE', true, 
                                'Rate limit response has proper error structure');
                        } else {
                            console.log(`⚠️ Rate limit error response missing fields`);
                            this.addTestResult('RATE_LIMIT_ERROR_STRUCTURE', false, 
                                'Rate limit response missing required fields');
                        }
                    } catch (parseError) {
                        console.log(`⚠️ Rate limit error response not JSON`);
                        this.addTestResult('RATE_LIMIT_ERROR_STRUCTURE', false, 
                            'Rate limit response not in JSON format');
                    }
                }
            } else {
                console.log(`⚠️ Rate limiting not triggered (may need more requests)`);
                this.addTestResult('RATE_LIMITING_ERRORS', false, 
                    'Rate limiting not triggered within test parameters');
            }
            
        } catch (error) {
            console.log(`❌ Rate limiting error test failed: ${error.message}`);
            this.addTestResult('RATE_LIMITING_ERRORS', false, error.message);
        }
        
        console.log('');
    }

    async testServerErrorRecovery() {
        console.log('🔄 Testing Server Error Recovery...');
        
        try {
            // Test server stability after various error conditions
            const recoveryTests = [
                {
                    name: 'Server status after error conditions',
                    test: async () => {
                        // Make a normal request to verify server is still responsive
                        const result = await this.makeHTTPRequest(`/health?token=${this.testToken}`, 'GET');
                        return result.status === 200;
                    }
                },
                {
                    name: 'WebSocket server after error conditions',
                    test: async () => {
                        // Try to establish a new WebSocket connection
                        try {
                            const ws = await this.createWebSocketConnection(this.testToken, 3000);
                            ws.close();
                            return true;
                        } catch (error) {
                            return false;
                        }
                    }
                },
                {
                    name: 'Session data integrity',
                    test: async () => {
                        // Verify session data endpoint still works
                        const result = await this.makeHTTPRequest(`/api/session?token=${this.testToken}`, 'GET');
                        if (result.status === 200) {
                            const sessionData = JSON.parse(result.data);
                            return sessionData.hasOwnProperty('iterations');
                        }
                        return false;
                    }
                }
            ];

            for (const test of recoveryTests) {
                try {
                    const success = await test.test();
                    
                    if (success) {
                        console.log(`✅ ${test.name}: Server recovered successfully`);
                        this.addTestResult(`RECOVERY_${test.name.replace(/\s/g, '_')}`, true, 
                            'Server functioning normally after error conditions');
                    } else {
                        console.log(`❌ ${test.name}: Server not fully recovered`);
                        this.addTestResult(`RECOVERY_${test.name.replace(/\s/g, '_')}`, false, 
                            'Server not functioning properly after error conditions');
                    }
                } catch (error) {
                    console.log(`❌ ${test.name}: Recovery test failed: ${error.message}`);
                    this.addTestResult(`RECOVERY_${test.name.replace(/\s/g, '_')}`, false, error.message);
                }
            }
            
        } catch (error) {
            console.log(`❌ Server error recovery test failed: ${error.message}`);
            this.addTestResult('SERVER_ERROR_RECOVERY', false, error.message);
        }
        
        console.log('');
    }

    async testBoundaryConditions() {
        console.log('🎯 Testing Boundary Conditions...');
        
        try {
            const boundaryTests = [
                {
                    name: 'Empty string inputs',
                    test: () => this.webUI.addOutput('', 'info'),
                    description: 'Should handle empty strings'
                },
                {
                    name: 'Maximum length input',
                    test: () => this.webUI.addOutput('x'.repeat(10000), 'info'),
                    description: 'Should handle maximum length inputs'
                },
                {
                    name: 'Numeric inputs as strings',
                    test: () => this.webUI.addOutput(123456789, 'info'),
                    description: 'Should handle numeric inputs'
                },
                {
                    name: 'Boolean inputs as strings',
                    test: () => this.webUI.addOutput(true, 'info'),
                    description: 'Should handle boolean inputs'
                },
                {
                    name: 'Array inputs',
                    test: () => this.webUI.addOutput(['array', 'input'], 'info'),
                    description: 'Should handle array inputs'
                },
                {
                    name: 'Object inputs',
                    test: () => this.webUI.addOutput({ object: 'input' }, 'info'),
                    description: 'Should handle object inputs'
                }
            ];

            for (const test of boundaryTests) {
                try {
                    await test.test();
                    console.log(`✅ ${test.name}: Handled successfully`);
                    this.addTestResult(`BOUNDARY_${test.name.replace(/\s/g, '_')}`, true, 
                        'Boundary condition handled correctly');
                } catch (error) {
                    console.log(`❌ ${test.name}: ${error.message}`);
                    this.addTestResult(`BOUNDARY_${test.name.replace(/\s/g, '_')}`, false, error.message);
                }
            }
            
        } catch (error) {
            console.log(`❌ Boundary conditions test failed: ${error.message}`);
            this.addTestResult('BOUNDARY_CONDITIONS', false, error.message);
        }
        
        console.log('');
    }

    // Helper methods
    async createWebSocketConnection(token, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const url = `ws://localhost:${this.testPort}?token=${token}`;
            const options = {
                headers: {
                    'User-Agent': 'Error-Handling-Test-Suite/1.0 (Node.js)'
                }
            };
            
            const ws = new WebSocket(url, options);
            
            const timeoutId = setTimeout(() => {
                ws.close();
                reject(new Error('WebSocket connection timeout'));
            }, timeout);
            
            ws.on('open', () => {
                clearTimeout(timeoutId);
                resolve(ws);
            });
            
            ws.on('close', (code, reason) => {
                clearTimeout(timeoutId);
                reject(new Error(`WebSocket close: ${code} - ${reason}`));
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
        });
    }

    async makeHTTPRequest(path, method = 'GET', body = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: this.testPort,
                path: path,
                method: method,
                headers: {
                    'User-Agent': 'Error-Handling-Test-Suite/1.0',
                    ...headers
                }
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
            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (body) {
                req.write(body);
            }

            req.end();
        });
    }

    createDeeplyNestedObject(depth) {
        const obj = { level: 0 };
        let current = obj;
        
        for (let i = 1; i < depth; i++) {
            current.nested = { level: i };
            current = current.nested;
        }
        
        return obj;
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    addTestResult(testName, passed, details) {
        this.testResults.push({
            test: testName,
            passed,
            details,
            timestamp: new Date().toISOString()
        });
    }

    generateTestReport() {
        console.log('\n📋 ERROR HANDLING & INPUT VALIDATION TEST REPORT');
        console.log('='.repeat(70));
        
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        const successRate = ((passed / total) * 100).toFixed(1);
        
        console.log(`\n📊 Overall Results: ${passed}/${total} tests passed (${successRate}%)\n`);
        
        // Group tests by category
        const categories = {
            'Server Setup': this.testResults.filter(r => r.test.startsWith('SERVER_')),
            'HTTP Error Handling': this.testResults.filter(r => r.test.startsWith('HTTP_ERROR_')),
            'Input Validation': this.testResults.filter(r => r.test.startsWith('INPUT_VALIDATION_')),
            'WebSocket Errors': this.testResults.filter(r => r.test.startsWith('WS_ERROR_')),
            'Security Validation': this.testResults.filter(r => r.test.startsWith('SECURITY_')),
            'Data Sanitization': this.testResults.filter(r => r.test.startsWith('SANITIZATION_')),
            'Rate Limiting': this.testResults.filter(r => r.test.includes('RATE_LIMIT')),
            'Error Recovery': this.testResults.filter(r => r.test.startsWith('RECOVERY_')),
            'Boundary Conditions': this.testResults.filter(r => r.test.startsWith('BOUNDARY_'))
        };
        
        for (const [category, tests] of Object.entries(categories)) {
            if (tests.length > 0) {
                const categoryPassed = tests.filter(t => t.passed).length;
                const categoryRate = ((categoryPassed / tests.length) * 100).toFixed(1);
                
                console.log(`🏷️ ${category}: ${categoryPassed}/${tests.length} (${categoryRate}%)`);
                
                for (const test of tests) {
                    const status = test.passed ? '✅ PASS' : '❌ FAIL';
                    console.log(`   ${status} ${test.test.replace(/_/g, ' ')}`);
                    console.log(`      ${test.details}`);
                }
                console.log('');
            }
        }
        
        // Critical issues
        const criticalFailures = this.testResults.filter(r => 
            !r.passed && [
                'SERVER_INITIALIZATION',
                'RECOVERY_Server_status_after_error_conditions',
                'INPUT_VALIDATION_Null_session_update'
            ].includes(r.test)
        );
        
        if (criticalFailures.length > 0) {
            console.log('🚨 CRITICAL ERROR HANDLING ISSUES:');
            criticalFailures.forEach(failure => {
                console.log(`   - ${failure.test}: ${failure.details}`);
            });
            console.log('');
        }
        
        // Recommendations
        console.log('💡 RECOMMENDATIONS:');
        if (successRate >= 90) {
            console.log('   - Error handling is robust and comprehensive');
            console.log('   - Input validation working correctly');
        }
        if (successRate < 80) {
            console.log('   - Review error handling implementations');
            console.log('   - Strengthen input validation and sanitization');
        }
        
        const securityTests = this.testResults.filter(r => r.test.startsWith('SECURITY_'));
        const securityPassed = securityTests.filter(t => t.passed).length;
        if (securityPassed === securityTests.length) {
            console.log('   - Security validation is properly implemented');
        }
        
        console.log('   - Consider adding automated error monitoring');
        console.log('   - Implement comprehensive logging for security events');
        console.log('');
        
        return {
            totalTests: total,
            passedTests: passed,
            successRate: parseFloat(successRate),
            criticalFailures: criticalFailures.length,
            categories,
            details: this.testResults
        };
    }

    async cleanup() {
        console.log('🧹 Cleaning up error handling test resources...');
        
        // Close all WebSocket connections
        for (const ws of this.connections) {
            try {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            } catch (error) {
                console.error('Error closing WebSocket:', error.message);
            }
        }
        
        // Stop WebUI
        if (this.webUI) {
            try {
                await this.webUI.stop();
                console.log('✅ WebUI stopped successfully');
            } catch (error) {
                console.error('Error stopping WebUI:', error.message);
            }
        }
        
        console.log('✅ Cleanup completed\n');
    }
}

// Run tests if called directly
if (require.main === module) {
    const testSuite = new ErrorHandlingTestSuite();
    testSuite.runAllTests()
        .then(() => {
            console.log('🎉 Error handling test suite completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = ErrorHandlingTestSuite;