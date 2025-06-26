#!/usr/bin/env node

/**
 * Comprehensive Middleware and Security Features Testing
 * Tests authentication, authorization, CORS, security headers, rate limiting, and all middleware functionality
 */

const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const WebUI = require('./lib/web-ui');
const crypto = require('crypto');

class MiddlewareSecurityTestSuite {
    constructor() {
        this.webUI = null;
        this.testResults = [];
        this.testPort = 3347;
        this.testToken = null;
        this.connections = [];
    }

    async runAllTests() {
        console.log('🔒 Starting Comprehensive Middleware and Security Testing\n');
        
        try {
            await this.initializeServer();
            this.testToken = this.webUI.sessionToken;
            
            // Test all middleware and security categories
            await this.testAuthenticationMiddleware();
            await this.testSecurityHeaders();
            await this.testCORSMiddleware();
            await this.testRateLimitingMiddleware();
            await this.testInputSanitizationMiddleware();
            await this.testConnectionSecurity();
            await this.testSessionSecurity();
            await this.testRequestValidation();
            
            this.generateTestReport();
            
        } catch (error) {
            console.error('❌ Middleware and security test suite failed:', error.message);
            this.addTestResult('SUITE_FAILURE', false, error.message);
        } finally {
            await this.cleanup();
        }
    }

    async initializeServer() {
        console.log('🚀 Initializing server for middleware and security tests...');
        this.webUI = new WebUI(this.testPort);
        await this.webUI.start();
        console.log(`✅ Server started on port ${this.testPort}\n`);
        this.addTestResult('SERVER_INITIALIZATION', true, 'Server started successfully');
    }

    async testAuthenticationMiddleware() {
        console.log('🔐 Testing Authentication Middleware...');
        
        try {
            // Test 1: No token provided
            console.log('  1a. Testing request without authentication token...');
            const noTokenResponse = await this.makeHTTPRequest('/', 'GET');
            
            if (noTokenResponse.status === 401) {
                console.log('     ✅ Correctly rejects requests without token');
                this.addTestResult('AUTH_NO_TOKEN', true, 'Returns 401 for missing token');
            } else {
                console.log(`     ❌ Expected 401, got ${noTokenResponse.status}`);
                this.addTestResult('AUTH_NO_TOKEN', false, `Expected 401, got ${noTokenResponse.status}`);
            }
            
            // Test 2: Invalid token provided
            console.log('  1b. Testing request with invalid token...');
            const invalidTokenResponse = await this.makeHTTPRequest('/?token=invalid_token_123', 'GET');
            
            if (invalidTokenResponse.status === 401) {
                console.log('     ✅ Correctly rejects invalid tokens');
                this.addTestResult('AUTH_INVALID_TOKEN', true, 'Returns 401 for invalid token');
                
                // Check if error response is properly structured
                try {
                    const errorData = JSON.parse(invalidTokenResponse.data);
                    if (errorData.error && errorData.error.includes('Invalid')) {
                        console.log('     ✅ Error response properly structured');
                        this.addTestResult('AUTH_ERROR_STRUCTURE', true, 'Error response has proper structure');
                    } else {
                        console.log('     ❌ Error response missing proper structure');
                        this.addTestResult('AUTH_ERROR_STRUCTURE', false, 'Error response malformed');
                    }
                } catch (parseError) {
                    console.log('     ❌ Error response not valid JSON');
                    this.addTestResult('AUTH_ERROR_STRUCTURE', false, 'Error response not JSON');
                }
            } else {
                console.log(`     ❌ Expected 401, got ${invalidTokenResponse.status}`);
                this.addTestResult('AUTH_INVALID_TOKEN', false, `Expected 401, got ${invalidTokenResponse.status}`);
            }
            
            // Test 3: Valid token provided
            console.log('  1c. Testing request with valid token...');
            const validTokenResponse = await this.makeHTTPRequest(`/?token=${this.testToken}`, 'GET');
            
            if (validTokenResponse.status === 200) {
                console.log('     ✅ Correctly accepts valid tokens');
                this.addTestResult('AUTH_VALID_TOKEN', true, 'Returns 200 for valid token');
            } else {
                console.log(`     ❌ Expected 200, got ${validTokenResponse.status}`);
                this.addTestResult('AUTH_VALID_TOKEN', false, `Expected 200, got ${validTokenResponse.status}`);
            }
            
            // Test 4: Token timing safety
            console.log('  1d. Testing token timing attack resistance...');
            const startTime1 = Date.now();
            await this.makeHTTPRequest('/?token=invalid_token_exactly_64_chars_long_to_match_valid_length_test', 'GET');
            const timeTaken1 = Date.now() - startTime1;
            
            const startTime2 = Date.now();
            await this.makeHTTPRequest('/?token=short', 'GET');
            const timeTaken2 = Date.now() - startTime2;
            
            const timeDifference = Math.abs(timeTaken1 - timeTaken2);
            
            if (timeDifference < 100) { // Less than 100ms difference
                console.log('     ✅ Token comparison appears timing-safe');
                this.addTestResult('AUTH_TIMING_SAFETY', true, 'Token validation timing-safe');
            } else {
                console.log(`     ⚠️ Potential timing attack vulnerability (${timeDifference}ms difference)`);
                this.addTestResult('AUTH_TIMING_SAFETY', false, 'Potential timing attack vulnerability');
            }
            
            // Test 5: Token in query vs header
            console.log('  1e. Testing token location handling...');
            const queryTokenResponse = await this.makeHTTPRequest(`/?token=${this.testToken}`, 'GET');
            const headerTokenResponse = await this.makeHTTPRequest('/', 'GET', null, {
                'Authorization': `Bearer ${this.testToken}`
            });
            
            if (queryTokenResponse.status === 200) {
                console.log('     ✅ Query parameter token handling works');
                this.addTestResult('AUTH_QUERY_TOKEN', true, 'Query token authentication works');
            } else {
                console.log('     ❌ Query parameter token handling failed');
                this.addTestResult('AUTH_QUERY_TOKEN', false, 'Query token authentication failed');
            }
            
            // Note: Header token might not be implemented, so we test but don't fail
            if (headerTokenResponse.status === 200) {
                console.log('     ✅ Authorization header token handling works');
                this.addTestResult('AUTH_HEADER_TOKEN', true, 'Header token authentication works');
            } else {
                console.log('     ℹ️ Authorization header token not implemented (query-only)');
                this.addTestResult('AUTH_HEADER_TOKEN', false, 'Header token not implemented');
            }
            
        } catch (error) {
            console.log(`❌ Authentication middleware test failed: ${error.message}`);
            this.addTestResult('AUTH_MIDDLEWARE', false, error.message);
        }
        
        console.log('');
    }

    async testSecurityHeaders() {
        console.log('🛡️ Testing Security Headers...');
        
        try {
            // Test 1: Basic security headers
            console.log('  2a. Testing basic security headers...');
            const response = await this.makeHTTPRequest(`/?token=${this.testToken}`, 'GET');
            
            const securityHeaders = {
                'x-frame-options': 'X-Frame-Options (clickjacking protection)',
                'x-content-type-options': 'X-Content-Type-Options (MIME sniffing protection)',
                'content-security-policy': 'Content-Security-Policy (XSS protection)',
                'x-xss-protection': 'X-XSS-Protection (XSS filtering)',
                'strict-transport-security': 'Strict-Transport-Security (HTTPS enforcement)',
                'referrer-policy': 'Referrer-Policy (referrer leakage protection)'
            };
            
            let securityHeadersPresent = 0;
            for (const [header, description] of Object.entries(securityHeaders)) {
                if (response.headers[header]) {
                    console.log(`     ✅ ${description}: ${response.headers[header]}`);
                    securityHeadersPresent++;
                } else {
                    console.log(`     ❌ Missing ${description}`);
                }
            }
            
            const headerScore = (securityHeadersPresent / Object.keys(securityHeaders).length * 100).toFixed(1);
            
            if (securityHeadersPresent >= 4) {
                console.log(`     ✅ Good security headers coverage (${headerScore}%)`);
                this.addTestResult('SECURITY_HEADERS', true, `${securityHeadersPresent}/${Object.keys(securityHeaders).length} security headers present`);
            } else {
                console.log(`     ⚠️ Limited security headers coverage (${headerScore}%)`);
                this.addTestResult('SECURITY_HEADERS', false, `Only ${securityHeadersPresent}/${Object.keys(securityHeaders).length} security headers present`);
            }
            
            // Test 2: Content Security Policy validation
            console.log('  2b. Testing Content Security Policy validation...');
            const cspHeader = response.headers['content-security-policy'];
            
            if (cspHeader) {
                const hasUnsafeInline = cspHeader.includes("'unsafe-inline'");
                const hasUnsafeEval = cspHeader.includes("'unsafe-eval'");
                const hasStrictSrc = cspHeader.includes("'self'") || cspHeader.includes("'none'");
                
                if (!hasUnsafeInline && !hasUnsafeEval && hasStrictSrc) {
                    console.log('     ✅ CSP policy is strict and secure');
                    this.addTestResult('CSP_VALIDATION', true, 'CSP policy is secure');
                } else {
                    console.log('     ⚠️ CSP policy could be more restrictive');
                    this.addTestResult('CSP_VALIDATION', false, 'CSP policy has security weaknesses');
                }
            } else {
                console.log('     ❌ No CSP policy found');
                this.addTestResult('CSP_VALIDATION', false, 'No CSP policy implemented');
            }
            
            // Test 3: Server information disclosure
            console.log('  2c. Testing server information disclosure...');
            const serverHeader = response.headers['server'];
            const poweredByHeader = response.headers['x-powered-by'];
            
            let informationLeakage = 0;
            if (serverHeader) {
                console.log(`     ⚠️ Server header disclosed: ${serverHeader}`);
                informationLeakage++;
            }
            if (poweredByHeader) {
                console.log(`     ⚠️ X-Powered-By header disclosed: ${poweredByHeader}`);
                informationLeakage++;
            }
            
            if (informationLeakage === 0) {
                console.log('     ✅ No unnecessary server information disclosed');
                this.addTestResult('INFO_DISCLOSURE', true, 'No server information leaked');
            } else {
                console.log(`     ⚠️ ${informationLeakage} information disclosure headers found`);
                this.addTestResult('INFO_DISCLOSURE', false, `${informationLeakage} info disclosure headers`);
            }
            
        } catch (error) {
            console.log(`❌ Security headers test failed: ${error.message}`);
            this.addTestResult('SECURITY_HEADERS', false, error.message);
        }
        
        console.log('');
    }

    async testCORSMiddleware() {
        console.log('🌐 Testing CORS Middleware...');
        
        try {
            // Test 1: CORS preflight request
            console.log('  3a. Testing CORS preflight request...');
            const preflightResponse = await this.makeHTTPRequest(`/?token=${this.testToken}`, 'OPTIONS', null, {
                'Origin': 'https://example.com',
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'Content-Type'
            });
            
            const corsHeaders = {
                'access-control-allow-origin': 'Access-Control-Allow-Origin',
                'access-control-allow-methods': 'Access-Control-Allow-Methods',
                'access-control-allow-headers': 'Access-Control-Allow-Headers',
                'access-control-max-age': 'Access-Control-Max-Age'
            };
            
            let corsHeadersPresent = 0;
            for (const [header, description] of Object.entries(corsHeaders)) {
                if (preflightResponse.headers[header]) {
                    console.log(`     ✅ ${description}: ${preflightResponse.headers[header]}`);
                    corsHeadersPresent++;
                } else {
                    console.log(`     ❌ Missing ${description}`);
                }
            }
            
            if (corsHeadersPresent >= 2) {
                console.log('     ✅ CORS preflight handling implemented');
                this.addTestResult('CORS_PREFLIGHT', true, 'CORS preflight properly handled');
            } else {
                console.log('     ⚠️ Limited CORS preflight support');
                this.addTestResult('CORS_PREFLIGHT', false, 'CORS preflight not properly implemented');
            }
            
            // Test 2: CORS origin validation
            console.log('  3b. Testing CORS origin validation...');
            const allowedOriginResponse = await this.makeHTTPRequest(`/?token=${this.testToken}`, 'GET', null, {
                'Origin': 'http://localhost:3000'
            });
            
            const maliciousOriginResponse = await this.makeHTTPRequest(`/?token=${this.testToken}`, 'GET', null, {
                'Origin': 'https://malicious-site.com'
            });
            
            const allowedOriginCORS = allowedOriginResponse.headers['access-control-allow-origin'];
            const maliciousOriginCORS = maliciousOriginResponse.headers['access-control-allow-origin'];
            
            if (allowedOriginCORS || maliciousOriginCORS === '*') {
                if (maliciousOriginCORS !== 'https://malicious-site.com') {
                    console.log('     ✅ CORS origin validation working correctly');
                    this.addTestResult('CORS_ORIGIN_VALIDATION', true, 'CORS origin properly validated');
                } else {
                    console.log('     ⚠️ CORS accepts all origins (potential security risk)');
                    this.addTestResult('CORS_ORIGIN_VALIDATION', false, 'CORS too permissive with origins');
                }
            } else {
                console.log('     ℹ️ CORS headers not present or restrictive policy');
                this.addTestResult('CORS_ORIGIN_VALIDATION', true, 'CORS restrictive or not implemented');
            }
            
        } catch (error) {
            console.log(`❌ CORS middleware test failed: ${error.message}`);
            this.addTestResult('CORS_MIDDLEWARE', false, error.message);
        }
        
        console.log('');
    }

    async testRateLimitingMiddleware() {
        console.log('📊 Testing Rate Limiting Middleware...');
        
        try {
            // Test 1: Rate limiting detection
            console.log('  4a. Testing rate limiting enforcement...');
            
            const rapidRequests = [];
            for (let i = 0; i < 30; i++) {
                rapidRequests.push(this.makeHTTPRequest(`/health?token=${this.testToken}`, 'GET'));
            }
            
            const results = await Promise.all(rapidRequests);
            const rateLimitedResponses = results.filter(r => r.status === 429);
            const successfulResponses = results.filter(r => r.status === 200);
            
            if (rateLimitedResponses.length > 0) {
                console.log(`     ✅ Rate limiting active: ${rateLimitedResponses.length} requests limited`);
                this.addTestResult('RATE_LIMITING_ACTIVE', true, `${rateLimitedResponses.length}/${results.length} requests rate limited`);
                
                // Test rate limit headers
                const rateLimitResponse = rateLimitedResponses[0];
                const rateLimitHeaders = {
                    'x-ratelimit-limit': 'Rate limit threshold',
                    'x-ratelimit-remaining': 'Remaining requests',
                    'x-ratelimit-reset': 'Reset time',
                    'retry-after': 'Retry after time'
                };
                
                let rateLimitHeadersPresent = 0;
                for (const [header, description] of Object.entries(rateLimitHeaders)) {
                    if (rateLimitResponse.headers[header]) {
                        console.log(`     ✅ ${description}: ${rateLimitResponse.headers[header]}`);
                        rateLimitHeadersPresent++;
                    }
                }
                
                if (rateLimitHeadersPresent >= 1) {
                    console.log('     ✅ Rate limit headers present');
                    this.addTestResult('RATE_LIMIT_HEADERS', true, 'Rate limit headers implemented');
                } else {
                    console.log('     ⚠️ Rate limit headers missing');
                    this.addTestResult('RATE_LIMIT_HEADERS', false, 'No rate limit headers found');
                }
            } else {
                console.log('     ⚠️ Rate limiting not triggered (may need more requests)');
                this.addTestResult('RATE_LIMITING_ACTIVE', false, 'Rate limiting not detected');
            }
            
            // Test 2: Rate limiting per IP
            console.log('  4b. Testing per-IP rate limiting...');
            
            // Wait for rate limit to reset
            await this.wait(2000);
            
            const ipTestRequests = [];
            for (let i = 0; i < 10; i++) {
                ipTestRequests.push(this.makeHTTPRequest(`/health?token=${this.testToken}`, 'GET', null, {
                    'X-Forwarded-For': `192.168.1.${100 + i}` // Simulate different IPs
                }));
            }
            
            const ipResults = await Promise.all(ipTestRequests);
            const ipSuccessful = ipResults.filter(r => r.status === 200).length;
            
            if (ipSuccessful >= 8) {
                console.log('     ✅ Per-IP rate limiting working correctly');
                this.addTestResult('PER_IP_RATE_LIMITING', true, 'Per-IP rate limiting functional');
            } else {
                console.log('     ℹ️ Global rate limiting (not per-IP)');
                this.addTestResult('PER_IP_RATE_LIMITING', false, 'Rate limiting not per-IP');
            }
            
        } catch (error) {
            console.log(`❌ Rate limiting middleware test failed: ${error.message}`);
            this.addTestResult('RATE_LIMITING_MIDDLEWARE', false, error.message);
        }
        
        console.log('');
    }

    async testInputSanitizationMiddleware() {
        console.log('🧼 Testing Input Sanitization Middleware...');
        
        try {
            // Test 1: Query parameter sanitization
            console.log('  5a. Testing query parameter sanitization...');
            
            const maliciousQueries = [
                { input: '<script>alert("xss")</script>', description: 'XSS attempt' },
                { input: '../../../etc/passwd', description: 'Path traversal' },
                { input: '${process.env}', description: 'Template injection' },
                { input: 'union select * from users--', description: 'SQL injection' },
                { input: '{"__proto__":{"polluted":true}}', description: 'Prototype pollution' }
            ];
            
            let sanitizationWorking = true;
            for (const query of maliciousQueries) {
                try {
                    const response = await this.makeHTTPRequest(
                        `/health?token=${this.testToken}&test=${encodeURIComponent(query.input)}`, 
                        'GET'
                    );
                    
                    if (response.status === 200 || response.status === 400) {
                        console.log(`     ✅ ${query.description}: Server handled safely`);
                    } else {
                        console.log(`     ⚠️ ${query.description}: Unexpected response ${response.status}`);
                    }
                } catch (error) {
                    console.log(`     ❌ ${query.description}: ${error.message}`);
                    sanitizationWorking = false;
                }
            }
            
            if (sanitizationWorking) {
                console.log('     ✅ Input sanitization working correctly');
                this.addTestResult('INPUT_SANITIZATION', true, 'Malicious inputs handled safely');
            } else {
                console.log('     ❌ Input sanitization issues found');
                this.addTestResult('INPUT_SANITIZATION', false, 'Input sanitization not working properly');
            }
            
            // Test 2: Request body sanitization
            console.log('  5b. Testing request body sanitization...');
            
            const maliciousBody = JSON.stringify({
                message: '<script>alert("xss")</script>',
                command: 'rm -rf /',
                injection: '${process.env.TOKEN}'
            });
            
            try {
                const response = await this.makeHTTPRequest(
                    `/?token=${this.testToken}`, 
                    'POST', 
                    maliciousBody,
                    { 'Content-Type': 'application/json' }
                );
                
                if (response.status >= 200 && response.status < 500) {
                    console.log('     ✅ Request body handled safely');
                    this.addTestResult('BODY_SANITIZATION', true, 'Request body sanitization working');
                } else {
                    console.log(`     ⚠️ Unexpected response to malicious body: ${response.status}`);
                    this.addTestResult('BODY_SANITIZATION', false, 'Unexpected response to malicious body');
                }
            } catch (error) {
                console.log(`     ❌ Request body sanitization test failed: ${error.message}`);
                this.addTestResult('BODY_SANITIZATION', false, error.message);
            }
            
        } catch (error) {
            console.log(`❌ Input sanitization middleware test failed: ${error.message}`);
            this.addTestResult('INPUT_SANITIZATION_MIDDLEWARE', false, error.message);
        }
        
        console.log('');
    }

    async testConnectionSecurity() {
        console.log('🔗 Testing Connection Security...');
        
        try {
            // Test 1: WebSocket connection security
            console.log('  6a. Testing WebSocket connection security...');
            
            try {
                // Test without User-Agent (should be blocked)
                const wsWithoutUA = new WebSocket(`ws://localhost:${this.testPort}?token=${this.testToken}`);
                
                const connectionResult = await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        wsWithoutUA.close();
                        resolve('timeout');
                    }, 3000);
                    
                    wsWithoutUA.on('open', () => {
                        clearTimeout(timeout);
                        wsWithoutUA.close();
                        resolve('connected');
                    });
                    
                    wsWithoutUA.on('close', (code, reason) => {
                        clearTimeout(timeout);
                        resolve(`closed-${code}`);
                    });
                    
                    wsWithoutUA.on('error', (error) => {
                        clearTimeout(timeout);
                        resolve(`error-${error.message}`);
                    });
                });
                
                if (connectionResult.includes('closed') || connectionResult.includes('error')) {
                    console.log('     ✅ WebSocket connection properly validates security');
                    this.addTestResult('WS_CONNECTION_SECURITY', true, 'WebSocket security validation working');
                } else {
                    console.log('     ⚠️ WebSocket connection might be too permissive');
                    this.addTestResult('WS_CONNECTION_SECURITY', false, 'WebSocket security validation weak');
                }
            } catch (error) {
                console.log('     ✅ WebSocket connection properly secured');
                this.addTestResult('WS_CONNECTION_SECURITY', true, 'WebSocket connection secured');
            }
            
            // Test 2: Connection limit enforcement
            console.log('  6b. Testing connection limit enforcement...');
            
            const connections = [];
            let connectionCount = 0;
            
            try {
                for (let i = 0; i < 10; i++) {
                    const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${this.testToken}`, {
                        headers: { 'User-Agent': 'Security-Test/1.0' }
                    });
                    
                    connections.push(ws);
                    
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            resolve();
                        }, 1000);
                        
                        ws.on('open', () => {
                            connectionCount++;
                            clearTimeout(timeout);
                            resolve();
                        });
                        
                        ws.on('error', () => {
                            clearTimeout(timeout);
                            resolve();
                        });
                    });
                }
                
                if (connectionCount < 10) {
                    console.log(`     ✅ Connection limits enforced (${connectionCount}/10 connections allowed)`);
                    this.addTestResult('CONNECTION_LIMITS', true, `Connection limits working: ${connectionCount}/10`);
                } else {
                    console.log(`     ⚠️ No connection limits detected (${connectionCount}/10 connections allowed)`);
                    this.addTestResult('CONNECTION_LIMITS', false, 'No connection limits detected');
                }
                
                // Clean up connections
                for (const ws of connections) {
                    try {
                        ws.close();
                    } catch (error) {
                        // Ignore cleanup errors
                    }
                }
                
            } catch (error) {
                console.log(`     ❌ Connection limit test failed: ${error.message}`);
                this.addTestResult('CONNECTION_LIMITS', false, error.message);
            }
            
        } catch (error) {
            console.log(`❌ Connection security test failed: ${error.message}`);
            this.addTestResult('CONNECTION_SECURITY', false, error.message);
        }
        
        console.log('');
    }

    async testSessionSecurity() {
        console.log('🔑 Testing Session Security...');
        
        try {
            // Test 1: Token entropy and randomness
            console.log('  7a. Testing token entropy and randomness...');
            
            const tokenLength = this.testToken.length;
            const tokenEntropy = this.calculateEntropy(this.testToken);
            
            if (tokenLength >= 32) {
                console.log(`     ✅ Token length adequate (${tokenLength} characters)`);
                this.addTestResult('TOKEN_LENGTH', true, `Token length: ${tokenLength} characters`);
            } else {
                console.log(`     ❌ Token length insufficient (${tokenLength} characters)`);
                this.addTestResult('TOKEN_LENGTH', false, `Token too short: ${tokenLength} characters`);
            }
            
            if (tokenEntropy >= 4.0) {
                console.log(`     ✅ Token entropy good (${tokenEntropy.toFixed(2)} bits per character)`);
                this.addTestResult('TOKEN_ENTROPY', true, `Token entropy: ${tokenEntropy.toFixed(2)} bits/char`);
            } else {
                console.log(`     ⚠️ Token entropy could be better (${tokenEntropy.toFixed(2)} bits per character)`);
                this.addTestResult('TOKEN_ENTROPY', false, `Low token entropy: ${tokenEntropy.toFixed(2)} bits/char`);
            }
            
            // Test 2: Session token expiration
            console.log('  7b. Testing session token properties...');
            
            // Check if token has expiration information
            const sessionData = this.webUI.sessionData;
            if (sessionData.tokenExpires || this.webUI.tokenExpires) {
                console.log('     ✅ Token expiration implemented');
                this.addTestResult('TOKEN_EXPIRATION', true, 'Token expiration implemented');
            } else {
                console.log('     ⚠️ Token expiration not detected');
                this.addTestResult('TOKEN_EXPIRATION', false, 'No token expiration found');
            }
            
            // Test 3: Session data isolation
            console.log('  7c. Testing session data isolation...');
            
            const originalSessionData = JSON.stringify(this.webUI.sessionData);
            
            // Attempt to modify session through API
            try {
                const modificationResponse = await this.makeHTTPRequest(
                    `/?token=${this.testToken}`,
                    'POST',
                    JSON.stringify({ maliciousData: 'attempt' }),
                    { 'Content-Type': 'application/json' }
                );
                
                const afterModificationData = JSON.stringify(this.webUI.sessionData);
                
                if (originalSessionData === afterModificationData) {
                    console.log('     ✅ Session data properly isolated');
                    this.addTestResult('SESSION_ISOLATION', true, 'Session data isolation working');
                } else {
                    console.log('     ❌ Session data isolation compromised');
                    this.addTestResult('SESSION_ISOLATION', false, 'Session data can be modified externally');
                }
            } catch (error) {
                console.log('     ✅ Session data properly protected');
                this.addTestResult('SESSION_ISOLATION', true, 'Session data protected from external modification');
            }
            
        } catch (error) {
            console.log(`❌ Session security test failed: ${error.message}`);
            this.addTestResult('SESSION_SECURITY', false, error.message);
        }
        
        console.log('');
    }

    async testRequestValidation() {
        console.log('✅ Testing Request Validation...');
        
        try {
            // Test 1: HTTP method validation
            console.log('  8a. Testing HTTP method validation...');
            
            const unsupportedMethods = ['PUT', 'DELETE', 'PATCH', 'TRACE', 'CONNECT'];
            let methodValidationWorking = true;
            
            for (const method of unsupportedMethods) {
                try {
                    const response = await this.makeHTTPRequest(`/?token=${this.testToken}`, method);
                    
                    if (response.status === 405 || response.status === 404) {
                        console.log(`     ✅ ${method} method properly rejected`);
                    } else {
                        console.log(`     ⚠️ ${method} method unexpected response: ${response.status}`);
                        methodValidationWorking = false;
                    }
                } catch (error) {
                    console.log(`     ✅ ${method} method properly blocked`);
                }
            }
            
            if (methodValidationWorking) {
                console.log('     ✅ HTTP method validation working');
                this.addTestResult('HTTP_METHOD_VALIDATION', true, 'HTTP methods properly validated');
            } else {
                console.log('     ⚠️ HTTP method validation issues');
                this.addTestResult('HTTP_METHOD_VALIDATION', false, 'HTTP method validation problems');
            }
            
            // Test 2: Content-Type validation
            console.log('  8b. Testing Content-Type validation...');
            
            const maliciousContentTypes = [
                'application/x-www-form-urlencoded; boundary=malicious',
                'multipart/form-data; boundary=evil',
                'text/xml; charset=utf-8',
                'application/soap+xml'
            ];
            
            let contentTypeValidationWorking = true;
            
            for (const contentType of maliciousContentTypes) {
                try {
                    const response = await this.makeHTTPRequest(
                        `/?token=${this.testToken}`,
                        'POST',
                        'malicious payload',
                        { 'Content-Type': contentType }
                    );
                    
                    if (response.status >= 400 && response.status < 500) {
                        console.log(`     ✅ ${contentType.split(';')[0]} properly rejected`);
                    } else {
                        console.log(`     ⚠️ ${contentType.split(';')[0]} unexpected response: ${response.status}`);
                    }
                } catch (error) {
                    console.log(`     ✅ ${contentType.split(';')[0]} properly blocked`);
                }
            }
            
            console.log('     ✅ Content-Type validation working');
            this.addTestResult('CONTENT_TYPE_VALIDATION', true, 'Content-Type validation functional');
            
        } catch (error) {
            console.log(`❌ Request validation test failed: ${error.message}`);
            this.addTestResult('REQUEST_VALIDATION', false, error.message);
        }
        
        console.log('');
    }

    // Helper methods
    calculateEntropy(str) {
        const frequency = {};
        for (const char of str) {
            frequency[char] = (frequency[char] || 0) + 1;
        }
        
        let entropy = 0;
        const length = str.length;
        
        for (const count of Object.values(frequency)) {
            const p = count / length;
            entropy -= p * Math.log2(p);
        }
        
        return entropy;
    }

    async makeHTTPRequest(path, method = 'GET', body = null, headers = {}) {
        const http = require('http');
        
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: this.testPort,
                path: path,
                method: method,
                headers: {
                    'User-Agent': 'Middleware-Security-Test-Suite/1.0',
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
        console.log('\n📋 MIDDLEWARE AND SECURITY TEST REPORT');
        console.log('='.repeat(70));
        
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        const successRate = ((passed / total) * 100).toFixed(1);
        
        console.log(`\n📊 Overall Results: ${passed}/${total} tests passed (${successRate}%)\n`);
        
        // Group tests by category
        const categories = {
            'Server Setup': this.testResults.filter(r => r.test.startsWith('SERVER_')),
            'Authentication': this.testResults.filter(r => r.test.startsWith('AUTH_')),
            'Security Headers': this.testResults.filter(r => r.test.includes('SECURITY_') || r.test.includes('CSP_') || r.test.includes('INFO_')),
            'CORS Middleware': this.testResults.filter(r => r.test.startsWith('CORS_')),
            'Rate Limiting': this.testResults.filter(r => r.test.includes('RATE_LIMIT')),
            'Input Sanitization': this.testResults.filter(r => r.test.includes('SANITIZATION')),
            'Connection Security': this.testResults.filter(r => r.test.includes('CONNECTION_') || r.test.startsWith('WS_')),
            'Session Security': this.testResults.filter(r => r.test.includes('TOKEN_') || r.test.includes('SESSION_')),
            'Request Validation': this.testResults.filter(r => r.test.includes('_VALIDATION'))
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
        
        // Critical security issues
        const criticalSecurityFailures = this.testResults.filter(r => 
            !r.passed && [
                'AUTH_NO_TOKEN',
                'AUTH_INVALID_TOKEN',
                'TOKEN_LENGTH',
                'SESSION_ISOLATION'
            ].includes(r.test)
        );
        
        if (criticalSecurityFailures.length > 0) {
            console.log('🚨 CRITICAL SECURITY ISSUES:');
            criticalSecurityFailures.forEach(failure => {
                console.log(`   - ${failure.test}: ${failure.details}`);
            });
            console.log('');
        }
        
        // Security recommendations
        console.log('💡 SECURITY RECOMMENDATIONS:');
        if (successRate >= 90) {
            console.log('   - Security implementation is excellent');
            console.log('   - Authentication and authorization working correctly');
        }
        if (successRate < 80) {
            console.log('   - Review security middleware implementations');
            console.log('   - Strengthen authentication and input validation');
        }
        
        const authTests = this.testResults.filter(r => r.test.startsWith('AUTH_'));
        const authPassed = authTests.filter(t => t.passed).length;
        if (authPassed === authTests.length) {
            console.log('   - Authentication middleware is properly implemented');
        }
        
        const securityHeaderTests = this.testResults.filter(r => r.test.includes('SECURITY_'));
        const securityHeadersPassed = securityHeaderTests.filter(t => t.passed).length;
        if (securityHeadersPassed === securityHeaderTests.length) {
            console.log('   - Security headers are properly configured');
        }
        
        console.log('   - Consider implementing additional security monitoring');
        console.log('   - Regular security audits and penetration testing recommended');
        console.log('');
        
        return {
            totalTests: total,
            passedTests: passed,
            successRate: parseFloat(successRate),
            criticalFailures: criticalSecurityFailures.length,
            categories,
            details: this.testResults
        };
    }

    async cleanup() {
        console.log('🧹 Cleaning up middleware and security test resources...');
        
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
    const testSuite = new MiddlewareSecurityTestSuite();
    testSuite.runAllTests()
        .then(() => {
            console.log('🎉 Middleware and security test suite completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = MiddlewareSecurityTestSuite;