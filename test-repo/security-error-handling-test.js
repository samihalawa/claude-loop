#!/usr/bin/env node

/**
 * Security and Error Handling Testing Suite for Claude Loop Backend
 * Tests authentication, authorization, input validation, and error boundaries
 */

const WebSocket = require('ws');
const crypto = require('crypto');

class SecurityErrorHandlingTest {
    constructor(port = 3333, validToken) {
        this.port = port;
        this.validToken = validToken;
        this.results = {
            tokenAuthentication: false,
            rateLimiting: false,
            inputValidation: false,
            xssProtection: false,
            csrfProtection: false,
            securityHeaders: false,
            errorHandling: false,
            injectionPrevention: false,
            userAgentValidation: false,
            corsPolicy: false,
            errors: []
        };
    }

    async runTests() {
        console.log('🔐 Security and Error Handling Testing Suite');
        console.log('============================================\n');

        try {
            console.log('Test 1: Token Authentication Security');
            await this.testTokenAuthentication();
            
            console.log('Test 2: Rate Limiting Protection');
            await this.testRateLimiting();
            
            console.log('Test 3: Input Validation');
            await this.testInputValidation();
            
            console.log('Test 4: XSS Protection');
            await this.testXSSProtection();
            
            console.log('Test 5: Security Headers');
            await this.testSecurityHeaders();
            
            console.log('Test 6: Error Handling');
            await this.testErrorHandling();
            
            console.log('Test 7: Injection Prevention');
            await this.testInjectionPrevention();
            
            console.log('Test 8: User Agent Validation');
            await this.testUserAgentValidation();
            
            console.log('Test 9: CORS Policy');
            await this.testCORSPolicy();
            
            this.printResults();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            this.results.errors.push(`Test suite error: ${error.message}`);
        }
    }

    async testTokenAuthentication() {
        try {
            // Test 1: Valid token
            const validResponse = await this.makeRequest('/api/session', { token: this.validToken });
            if (validResponse.status === 200) {
                console.log('  ✅ Valid token accepted');
            } else {
                throw new Error(`Valid token rejected: ${validResponse.status}`);
            }

            // Test 2: Invalid token
            const invalidResponse = await this.makeRequest('/api/session', { token: 'invalid_token' });
            if (invalidResponse.status === 401) {
                console.log('  ✅ Invalid token rejected');
            } else {
                throw new Error(`Invalid token not rejected properly: ${invalidResponse.status}`);
            }

            // Test 3: Missing token
            const missingResponse = await this.makeRequest('/api/session');
            if (missingResponse.status === 401) {
                console.log('  ✅ Missing token rejected');
            } else {
                throw new Error(`Missing token not rejected properly: ${missingResponse.status}`);
            }

            // Test 4: Malformed token
            const malformedResponse = await this.makeRequest('/api/session', { token: 'a'.repeat(200) });
            if (malformedResponse.status === 401) {
                console.log('  ✅ Malformed token rejected');
            } else {
                throw new Error(`Malformed token not rejected properly: ${malformedResponse.status}`);
            }

            this.results.tokenAuthentication = true;
            console.log('  ✅ Token authentication test passed');

        } catch (error) {
            console.log('  ❌ Token authentication test failed:', error.message);
            this.results.errors.push(`Token auth: ${error.message}`);
        }
    }

    async testRateLimiting() {
        try {
            // Test rapid requests to trigger rate limiting
            console.log('  📡 Sending rapid requests to test rate limiting...');
            
            const requests = [];
            for (let i = 0; i < 35; i++) { // More than the default limit of 30
                requests.push(this.makeRequest('/health', { token: this.validToken }));
            }

            const responses = await Promise.all(requests.map(p => p.catch(e => ({ status: 500, error: e }))));
            
            const successCount = responses.filter(r => r.status === 200).length;
            const rateLimitedCount = responses.filter(r => r.status === 429).length;

            console.log(`  📊 ${successCount} requests succeeded, ${rateLimitedCount} rate limited`);

            if (rateLimitedCount > 0) {
                console.log('  ✅ Rate limiting active');
                this.results.rateLimiting = true;
            } else {
                console.log('  ⚠️  Rate limiting not triggered (may need longer test)');
                this.results.rateLimiting = false;
            }

        } catch (error) {
            console.log('  ❌ Rate limiting test failed:', error.message);
            this.results.errors.push(`Rate limiting: ${error.message}`);
        }
    }

    async testInputValidation() {
        try {
            // Test various malicious inputs
            const maliciousInputs = [
                '../../../etc/passwd',
                '<script>alert("xss")</script>',
                'DROP TABLE users;',
                '${7*7}',
                '{{7*7}}',
                '%00%00%00',
                'null',
                'undefined',
                JSON.stringify({ __proto__: { polluted: true } })
            ];

            let validationPassed = true;
            
            for (const input of maliciousInputs) {
                const response = await this.makeRequest(`/api/session?token=${encodeURIComponent(input)}`);
                if (response.status !== 401) {
                    console.log(`  ❌ Malicious input not rejected: ${input.substring(0, 20)}...`);
                    validationPassed = false;
                } else {
                    console.log(`  ✅ Malicious input rejected: ${input.substring(0, 20)}...`);
                }
            }

            this.results.inputValidation = validationPassed;
            if (validationPassed) {
                console.log('  ✅ Input validation test passed');
            } else {
                throw new Error('Some malicious inputs were not properly rejected');
            }

        } catch (error) {
            console.log('  ❌ Input validation test failed:', error.message);
            this.results.errors.push(`Input validation: ${error.message}`);
        }
    }

    async testXSSProtection() {
        try {
            // Test XSS protection via headers and content handling
            const response = await this.makeRequest('/health', { token: this.validToken });
            
            const xssHeader = response.headers.get('x-xss-protection');
            const contentTypeOptions = response.headers.get('x-content-type-options');
            
            if (xssHeader && xssHeader.includes('1; mode=block')) {
                console.log('  ✅ X-XSS-Protection header present');
            } else {
                throw new Error('X-XSS-Protection header missing or incorrect');
            }

            if (contentTypeOptions && contentTypeOptions.includes('nosniff')) {
                console.log('  ✅ X-Content-Type-Options header present');
            } else {
                throw new Error('X-Content-Type-Options header missing');
            }

            this.results.xssProtection = true;
            console.log('  ✅ XSS protection test passed');

        } catch (error) {
            console.log('  ❌ XSS protection test failed:', error.message);
            this.results.errors.push(`XSS protection: ${error.message}`);
        }
    }

    async testSecurityHeaders() {
        try {
            const response = await this.makeRequest('/health', { token: this.validToken });
            
            const requiredHeaders = {
                'x-frame-options': 'DENY',
                'x-content-type-options': 'nosniff',
                'x-xss-protection': '1; mode=block',
                'referrer-policy': 'strict-origin-when-cross-origin',
                'content-security-policy': 'default-src'
            };

            let allHeadersPresent = true;
            
            for (const [header, expectedValue] of Object.entries(requiredHeaders)) {
                const headerValue = response.headers.get(header);
                if (headerValue && headerValue.includes(expectedValue)) {
                    console.log(`  ✅ ${header} header present`);
                } else {
                    console.log(`  ❌ ${header} header missing or incorrect`);
                    allHeadersPresent = false;
                }
            }

            this.results.securityHeaders = allHeadersPresent;
            if (allHeadersPresent) {
                console.log('  ✅ Security headers test passed');
            } else {
                throw new Error('Some security headers are missing or incorrect');
            }

        } catch (error) {
            console.log('  ❌ Security headers test failed:', error.message);
            this.results.errors.push(`Security headers: ${error.message}`);
        }
    }

    async testErrorHandling() {
        try {
            // Test various error conditions
            const errorTests = [
                { path: '/nonexistent', expectedStatus: 404 },
                { path: '/api/nonexistent', expectedStatus: 404 },
                { path: '/api/session', method: 'POST', expectedStatus: 404 },
                { path: '/api/session', method: 'DELETE', expectedStatus: 404 }
            ];

            let errorHandlingPassed = true;

            for (const test of errorTests) {
                const response = await this.makeRequest(test.path, { 
                    token: this.validToken,
                    method: test.method || 'GET'
                });

                if (response.status === test.expectedStatus) {
                    console.log(`  ✅ ${test.method || 'GET'} ${test.path}: ${response.status}`);
                } else {
                    console.log(`  ❌ ${test.method || 'GET'} ${test.path}: expected ${test.expectedStatus}, got ${response.status}`);
                    errorHandlingPassed = false;
                }
            }

            this.results.errorHandling = errorHandlingPassed;
            if (errorHandlingPassed) {
                console.log('  ✅ Error handling test passed');
            } else {
                throw new Error('Some error conditions not handled properly');
            }

        } catch (error) {
            console.log('  ❌ Error handling test failed:', error.message);
            this.results.errors.push(`Error handling: ${error.message}`);
        }
    }

    async testInjectionPrevention() {
        try {
            // Test SQL injection and command injection attempts
            const injectionAttempts = [
                "'; DROP TABLE users; --",
                "1' OR '1'='1",
                "'; EXEC xp_cmdshell('dir'); --",
                "$(cat /etc/passwd)",
                "`rm -rf /`",
                "|cat /etc/passwd",
                "&& cat /etc/passwd",
                "|| cat /etc/passwd"
            ];

            let injectionBlocked = true;

            for (const injection of injectionAttempts) {
                const response = await this.makeRequest(`/api/session?token=${encodeURIComponent(injection)}`);
                
                if (response.status === 401) {
                    console.log(`  ✅ Injection attempt blocked: ${injection.substring(0, 15)}...`);
                } else {
                    console.log(`  ❌ Injection attempt not blocked: ${injection.substring(0, 15)}...`);
                    injectionBlocked = false;
                }
            }

            this.results.injectionPrevention = injectionBlocked;
            if (injectionBlocked) {
                console.log('  ✅ Injection prevention test passed');
            } else {
                throw new Error('Some injection attempts were not blocked');
            }

        } catch (error) {
            console.log('  ❌ Injection prevention test failed:', error.message);
            this.results.errors.push(`Injection prevention: ${error.message}`);
        }
    }

    async testUserAgentValidation() {
        try {
            // Test WebSocket user agent validation
            const invalidUserAgents = [
                '',
                'curl/7.68.0',
                'wget/1.20.3',
                '<script>alert("xss")</script>',
                'a'.repeat(600), // Too long
                'x' // Too short
            ];

            let userAgentValidationWorking = true;

            for (const userAgent of invalidUserAgents) {
                try {
                    const ws = new WebSocket(`ws://localhost:${this.port}?token=${this.validToken}`, {
                        headers: { 'User-Agent': userAgent }
                    });

                    const result = await new Promise((resolve) => {
                        let connected = false;
                        
                        ws.on('open', () => {
                            connected = true;
                            ws.close();
                            resolve('connected');
                        });
                        
                        ws.on('close', (code) => {
                            if (!connected) {
                                resolve('rejected');
                            }
                        });
                        
                        ws.on('error', () => {
                            resolve('rejected');
                        });
                        
                        setTimeout(() => resolve('timeout'), 2000);
                    });

                    if (result === 'connected') {
                        console.log(`  ❌ Invalid user agent accepted: ${userAgent.substring(0, 20)}...`);
                        userAgentValidationWorking = false;
                    } else {
                        console.log(`  ✅ Invalid user agent rejected: ${userAgent.substring(0, 20)}...`);
                    }

                } catch (error) {
                    console.log(`  ✅ Invalid user agent rejected: ${userAgent.substring(0, 20)}...`);
                }
            }

            this.results.userAgentValidation = userAgentValidationWorking;
            if (userAgentValidationWorking) {
                console.log('  ✅ User agent validation test passed');
            } else {
                console.log('  ⚠️  User agent validation test partially failed');
            }

        } catch (error) {
            console.log('  ❌ User agent validation test failed:', error.message);
            this.results.errors.push(`User agent validation: ${error.message}`);
        }
    }

    async testCORSPolicy() {
        try {
            // Test CORS headers
            const corsResponse = await this.makeRequest('/api/session', {
                token: this.validToken,
                method: 'OPTIONS',
                headers: {
                    'Origin': 'http://localhost:3000',
                    'Access-Control-Request-Method': 'GET'
                }
            });

            const corsHeaders = {
                'access-control-allow-origin': 'http://localhost:3000',
                'access-control-allow-methods': 'GET, POST, OPTIONS',
                'access-control-allow-headers': 'Content-Type, Authorization'
            };

            let corsWorking = true;

            for (const [header, expectedValue] of Object.entries(corsHeaders)) {
                const headerValue = corsResponse.headers.get(header);
                if (headerValue && headerValue.includes(expectedValue)) {
                    console.log(`  ✅ CORS header ${header} present`);
                } else {
                    console.log(`  ❌ CORS header ${header} missing or incorrect`);
                    corsWorking = false;
                }
            }

            this.results.corsPolicy = corsWorking;
            if (corsWorking) {
                console.log('  ✅ CORS policy test passed');
            } else {
                throw new Error('CORS headers not configured properly');
            }

        } catch (error) {
            console.log('  ❌ CORS policy test failed:', error.message);
            this.results.errors.push(`CORS policy: ${error.message}`);
        }
    }

    async makeRequest(path, options = {}) {
        const url = `http://localhost:${this.port}${path}`;
        const token = options.token || '';
        const fullUrl = token ? `${url}${url.includes('?') ? '&' : '?'}token=${token}` : url;
        
        return fetch(fullUrl, {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
    }

    printResults() {
        console.log('\n🔍 Security and Error Handling Test Results:');
        console.log('=============================================');
        
        Object.entries(this.results).forEach(([test, result]) => {
            if (test === 'errors') return;
            const status = result ? '✅' : '❌';
            const formattedTest = test.replace(/([A-Z])/g, ' $1').toLowerCase();
            console.log(`${formattedTest}: ${status}`);
        });
        
        if (this.results.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.results.errors.forEach(error => console.log(`  - ${error}`));
        }
        
        const passedTests = Object.values(this.results).filter(Boolean).length - 1; // -1 for errors array
        const totalTests = Object.keys(this.results).length - 1; // -1 for errors array
        console.log(`\n📊 Tests Passed: ${passedTests}/${totalTests}`);
        
        const securityScore = Math.round((passedTests / totalTests) * 100);
        console.log(`🔐 Security Score: ${securityScore}%`);
    }
}

// Run tests if called directly
if (require.main === module) {
    const token = process.argv[2] || 'd710c2fe3d0319ee3cccd87914f65d47367d7c3163743e89e20822eada0c6be4a06038c1bb12323ccc0d613686834fd40fa384fa9debf931d2390ddf2e667f28';
    const port = process.argv[3] || 3333;
    
    const test = new SecurityErrorHandlingTest(port, token);
    test.runTests().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = SecurityErrorHandlingTest;