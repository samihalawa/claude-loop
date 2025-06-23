#!/usr/bin/env node

/**
 * Comprehensive Express.js Routes and API Endpoints Testing
 * Tests all available routes, validates responses, checks security, and verifies functionality
 */

const http = require('http');
const https = require('https');
const WebUI = require('./lib/web-ui');
const { performance } = require('perf_hooks');

class ExpressRoutesTestSuite {
    constructor() {
        this.webUI = null;
        this.testResults = [];
        this.testPort = 3339;
        this.baseURL = `http://localhost:${this.testPort}`;
        this.testToken = null;
    }

    async runAllTests() {
        console.log('🌐 Starting Comprehensive Express.js Routes Testing\n');
        
        try {
            await this.initializeServer();
            
            // Get test token
            this.testToken = this.webUI.sessionToken;
            
            // Test all route categories
            await this.testPublicRoutes();
            await this.testAPIEndpoints();
            await this.testSecurityFeatures();
            await this.testMiddlewareStack();
            await this.testErrorResponses();
            await this.testContentTypes();
            await this.testRateLimitingRoutes();
            
            this.generateTestReport();
            
        } catch (error) {
            console.error('❌ Express routes test suite failed:', error.message);
            this.addTestResult('SUITE_FAILURE', false, error.message);
        } finally {
            await this.cleanup();
        }
    }

    async initializeServer() {
        console.log('🚀 Initializing WebUI server for testing...');
        this.webUI = new WebUI(this.testPort);
        await this.webUI.start();
        console.log(`✅ Server started on port ${this.testPort}\n`);
        this.addTestResult('SERVER_INITIALIZATION', true, 'Server started successfully');
    }

    async testPublicRoutes() {
        console.log('🏠 Testing Public Routes...');
        
        const publicRoutes = [
            {
                name: 'Dashboard Homepage',
                path: '/',
                method: 'GET',
                expectedStatus: 200,
                expectedContentType: 'text/html',
                requiresAuth: true,
                description: 'Main dashboard HTML page'
            }
        ];

        for (const route of publicRoutes) {
            await this.testRoute(route);
        }
        
        console.log('');
    }

    async testAPIEndpoints() {
        console.log('🔌 Testing API Endpoints...');
        
        const apiRoutes = [
            {
                name: 'Session Data API',
                path: '/api/session',
                method: 'GET',
                expectedStatus: 200,
                expectedContentType: 'application/json',
                requiresAuth: true,
                description: 'Current session data endpoint',
                validateResponse: (data) => {
                    const parsed = JSON.parse(data);
                    return parsed.hasOwnProperty('iterations') && 
                           parsed.hasOwnProperty('currentPhase') &&
                           parsed.hasOwnProperty('output') &&
                           parsed.hasOwnProperty('startTime');
                }
            },
            {
                name: 'Health Check API',
                path: '/health',
                method: 'GET', 
                expectedStatus: 200,
                expectedContentType: 'application/json',
                requiresAuth: true,
                description: 'Server health check endpoint',
                validateResponse: (data) => {
                    const parsed = JSON.parse(data);
                    return parsed.hasOwnProperty('status') && 
                           parsed.hasOwnProperty('timestamp');
                }
            }
        ];

        for (const route of apiRoutes) {
            await this.testRoute(route);
        }
        
        console.log('');
    }

    async testSecurityFeatures() {
        console.log('🔒 Testing Security Features...');
        
        // Test authentication
        const authTests = [
            {
                name: 'No Token Access',
                path: '/health',
                method: 'GET',
                expectedStatus: 401,
                description: 'Should reject requests without token'
            },
            {
                name: 'Invalid Token Access',
                path: '/health?token=invalid',
                method: 'GET',
                expectedStatus: 401,
                description: 'Should reject requests with invalid token'
            },
            {
                name: 'Empty Token Access',
                path: '/health?token=',
                method: 'GET',
                expectedStatus: 401,
                description: 'Should reject requests with empty token'
            }
        ];

        for (const test of authTests) {
            try {
                const result = await this.makeHTTPRequest(test.path, test.method);
                
                if (result.status === test.expectedStatus) {
                    console.log(`✅ ${test.name}: ${result.status} (Expected ${test.expectedStatus})`);
                    this.addTestResult(`SECURITY_${test.name.replace(/\s/g, '_')}`, true, 
                        `Status ${result.status} as expected`);
                } else {
                    console.log(`❌ ${test.name}: ${result.status} (Expected ${test.expectedStatus})`);
                    this.addTestResult(`SECURITY_${test.name.replace(/\s/g, '_')}`, false, 
                        `Status ${result.status}, expected ${test.expectedStatus}`);
                }
            } catch (error) {
                console.log(`❌ ${test.name}: ${error.message}`);
                this.addTestResult(`SECURITY_${test.name.replace(/\s/g, '_')}`, false, error.message);
            }
        }

        // Test security headers
        try {
            const result = await this.makeHTTPRequest(`/health?token=${this.testToken}`, 'GET');
            
            const securityHeaders = [
                'x-content-type-options',
                'x-frame-options', 
                'x-xss-protection',
                'referrer-policy',
                'content-security-policy'
            ];
            
            let missingHeaders = [];
            for (const header of securityHeaders) {
                if (!result.headers[header]) {
                    missingHeaders.push(header);
                }
            }
            
            if (missingHeaders.length === 0) {
                console.log('✅ Security Headers: All required headers present');
                this.addTestResult('SECURITY_HEADERS', true, 'All security headers present');
            } else {
                console.log(`❌ Security Headers: Missing ${missingHeaders.join(', ')}`);
                this.addTestResult('SECURITY_HEADERS', false, `Missing headers: ${missingHeaders.join(', ')}`);
            }
            
        } catch (error) {
            console.log(`❌ Security Headers Test: ${error.message}`);
            this.addTestResult('SECURITY_HEADERS', false, error.message);
        }
        
        console.log('');
    }

    async testMiddlewareStack() {
        console.log('🔄 Testing Middleware Stack...');
        
        try {
            // Test rate limiting
            console.log('📊 Testing rate limiting middleware...');
            const rapidRequests = [];
            
            for (let i = 0; i < 50; i++) {
                rapidRequests.push(this.makeHTTPRequest(`/health?token=${this.testToken}`, 'GET'));
            }
            
            const results = await Promise.all(rapidRequests);
            const rateLimited = results.filter(r => r.status === 429).length;
            const successful = results.filter(r => r.status === 200).length;
            
            if (rateLimited > 0) {
                console.log(`✅ Rate Limiting: ${rateLimited} requests limited, ${successful} successful`);
                this.addTestResult('MIDDLEWARE_RATE_LIMITING', true, 
                    `${rateLimited} requests rate limited out of 50`);
            } else {
                console.log('⚠️ Rate Limiting: No requests were rate limited');
                this.addTestResult('MIDDLEWARE_RATE_LIMITING', false, 
                    'Rate limiting not triggered within 50 requests');
            }
            
        } catch (error) {
            console.log(`❌ Middleware test failed: ${error.message}`);
            this.addTestResult('MIDDLEWARE_TESTING', false, error.message);
        }
        
        console.log('');
    }

    async testErrorResponses() {
        console.log('🚨 Testing Error Response Handling...');
        
        const errorTests = [
            {
                name: 'Non-existent Route',
                path: `/nonexistent?token=${this.testToken}`,
                method: 'GET',
                expectedStatus: 404,
                description: 'Should return 404 for non-existent routes'
            },
            {
                name: 'Invalid HTTP Method',
                path: `/health?token=${this.testToken}`,
                method: 'DELETE',
                expectedStatus: 404,
                description: 'Should return 404 for unsupported methods'
            }
        ];

        for (const test of errorTests) {
            try {
                const result = await this.makeHTTPRequest(test.path, test.method);
                
                if (result.status === test.expectedStatus) {
                    console.log(`✅ ${test.name}: ${result.status} (Expected ${test.expectedStatus})`);
                    this.addTestResult(`ERROR_${test.name.replace(/\s/g, '_')}`, true, 
                        `Status ${result.status} as expected`);
                } else {
                    console.log(`❌ ${test.name}: ${result.status} (Expected ${test.expectedStatus})`);
                    this.addTestResult(`ERROR_${test.name.replace(/\s/g, '_')}`, false, 
                        `Status ${result.status}, expected ${test.expectedStatus}`);
                }
            } catch (error) {
                console.log(`❌ ${test.name}: ${error.message}`);
                this.addTestResult(`ERROR_${test.name.replace(/\s/g, '_')}`, false, error.message);
            }
        }
        
        console.log('');
    }

    async testContentTypes() {
        console.log('📄 Testing Content Types and Response Formats...');
        
        const contentTests = [
            {
                name: 'HTML Content Type',
                path: `/?token=${this.testToken}`,
                expectedContentType: 'text/html',
                description: 'Dashboard should return HTML'
            },
            {
                name: 'JSON Content Type',
                path: `/api/session?token=${this.testToken}`,
                expectedContentType: 'application/json',
                description: 'API endpoints should return JSON'
            }
        ];

        for (const test of contentTests) {
            try {
                const result = await this.makeHTTPRequest(test.path, 'GET');
                const contentType = result.headers['content-type'] || '';
                
                if (contentType.includes(test.expectedContentType)) {
                    console.log(`✅ ${test.name}: ${contentType}`);
                    this.addTestResult(`CONTENT_${test.name.replace(/\s/g, '_')}`, true, 
                        `Content-Type: ${contentType}`);
                } else {
                    console.log(`❌ ${test.name}: ${contentType} (Expected ${test.expectedContentType})`);
                    this.addTestResult(`CONTENT_${test.name.replace(/\s/g, '_')}`, false, 
                        `Got ${contentType}, expected ${test.expectedContentType}`);
                }
            } catch (error) {
                console.log(`❌ ${test.name}: ${error.message}`);
                this.addTestResult(`CONTENT_${test.name.replace(/\s/g, '_')}`, false, error.message);
            }
        }
        
        console.log('');
    }

    async testRateLimitingRoutes() {
        console.log('⏱️ Testing Rate Limiting on Different Routes...');
        
        const routes = ['/', '/api/session', '/health'];
        
        for (const route of routes) {
            try {
                console.log(`Testing rate limiting on ${route}...`);
                const requests = [];
                
                for (let i = 0; i < 35; i++) {
                    requests.push(this.makeHTTPRequest(`${route}?token=${this.testToken}`, 'GET'));
                }
                
                const results = await Promise.all(requests);
                const rateLimited = results.filter(r => r.status === 429).length;
                
                if (rateLimited > 0) {
                    console.log(`✅ ${route}: ${rateLimited} requests rate limited`);
                    this.addTestResult(`RATE_LIMIT_${route.replace(/\//g, '_')}`, true, 
                        `${rateLimited} requests rate limited`);
                } else {
                    console.log(`⚠️ ${route}: No rate limiting detected`);
                    this.addTestResult(`RATE_LIMIT_${route.replace(/\//g, '_')}`, false, 
                        'Rate limiting not detected');
                }
                
                // Wait between tests to avoid interference
                await this.wait(1000);
                
            } catch (error) {
                console.log(`❌ ${route}: ${error.message}`);
                this.addTestResult(`RATE_LIMIT_${route.replace(/\//g, '_')}`, false, error.message);
            }
        }
        
        console.log('');
    }

    async testRoute(route) {
        const startTime = performance.now();
        
        try {
            const path = route.requiresAuth ? `${route.path}?token=${this.testToken}` : route.path;
            const result = await this.makeHTTPRequest(path, route.method);
            const endTime = performance.now();
            const responseTime = Math.round(endTime - startTime);
            
            // Validate status code
            if (result.status !== route.expectedStatus) {
                console.log(`❌ ${route.name}: Status ${result.status} (Expected ${route.expectedStatus})`);
                this.addTestResult(`ROUTE_${route.name.replace(/\s/g, '_')}`, false, 
                    `Status ${result.status}, expected ${route.expectedStatus}`);
                return;
            }
            
            // Validate content type
            if (route.expectedContentType) {
                const contentType = result.headers['content-type'] || '';
                if (!contentType.includes(route.expectedContentType)) {
                    console.log(`❌ ${route.name}: Content-Type ${contentType} (Expected ${route.expectedContentType})`);
                    this.addTestResult(`ROUTE_${route.name.replace(/\s/g, '_')}`, false, 
                        `Content-Type ${contentType}, expected ${route.expectedContentType}`);
                    return;
                }
            }
            
            // Validate response data
            if (route.validateResponse && !route.validateResponse(result.data)) {
                console.log(`❌ ${route.name}: Response validation failed`);
                this.addTestResult(`ROUTE_${route.name.replace(/\s/g, '_')}`, false, 
                    'Response data validation failed');
                return;
            }
            
            console.log(`✅ ${route.name}: ${result.status} (${responseTime}ms)`);
            this.addTestResult(`ROUTE_${route.name.replace(/\s/g, '_')}`, true, 
                `Status ${result.status}, response time ${responseTime}ms`);
            
        } catch (error) {
            console.log(`❌ ${route.name}: ${error.message}`);
            this.addTestResult(`ROUTE_${route.name.replace(/\s/g, '_')}`, false, error.message);
        }
    }

    async makeHTTPRequest(path, method = 'GET', body = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: this.testPort,
                path: path,
                method: method,
                headers: {
                    'User-Agent': 'Express-Routes-Test-Suite/1.0',
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
        console.log('\n📋 EXPRESS.JS ROUTES TEST REPORT');
        console.log('='.repeat(60));
        
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        const successRate = ((passed / total) * 100).toFixed(1);
        
        console.log(`\n📊 Overall Results: ${passed}/${total} tests passed (${successRate}%)\n`);
        
        // Group tests by category
        const categories = {
            'Server Setup': this.testResults.filter(r => r.test.startsWith('SERVER_')),
            'Routes': this.testResults.filter(r => r.test.startsWith('ROUTE_')),
            'Security': this.testResults.filter(r => r.test.startsWith('SECURITY_')),
            'Middleware': this.testResults.filter(r => r.test.startsWith('MIDDLEWARE_')),
            'Error Handling': this.testResults.filter(r => r.test.startsWith('ERROR_')),
            'Content Types': this.testResults.filter(r => r.test.startsWith('CONTENT_')),
            'Rate Limiting': this.testResults.filter(r => r.test.startsWith('RATE_LIMIT_'))
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
        
        // Recommendations
        console.log('💡 RECOMMENDATIONS:');
        if (successRate >= 95) {
            console.log('   - Express.js routes are highly functional and secure');
            console.log('   - All critical endpoints working correctly');
        }
        if (successRate < 90) {
            console.log('   - Review and fix failed route tests');
            console.log('   - Check middleware configuration');
        }
        
        const securityTests = this.testResults.filter(r => r.test.startsWith('SECURITY_'));
        const securityPassed = securityTests.filter(t => t.passed).length;
        if (securityPassed === securityTests.length) {
            console.log('   - Security features are properly implemented');
        }
        
        console.log('   - Consider adding request logging for production monitoring');
        console.log('   - Implement automated API health checks');
        console.log('');
        
        return {
            totalTests: total,
            passedTests: passed,
            successRate: parseFloat(successRate),
            categories,
            details: this.testResults
        };
    }

    async cleanup() {
        console.log('🧹 Cleaning up test resources...');
        
        if (this.webUI) {
            try {
                await this.webUI.stop();
                console.log('✅ Server stopped successfully');
            } catch (error) {
                console.error('Error stopping server:', error.message);
            }
        }
        
        console.log('✅ Cleanup completed\n');
    }
}

// Run tests if called directly
if (require.main === module) {
    const testSuite = new ExpressRoutesTestSuite();
    testSuite.runAllTests()
        .then(() => {
            console.log('🎉 Express.js routes test suite completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = ExpressRoutesTestSuite;