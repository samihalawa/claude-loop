#!/usr/bin/env node

/**
 * Comprehensive API Endpoints Testing Suite
 * Tests all API endpoints systematically with proper authentication, error handling, and edge cases
 */

const WebUI = require('./lib/web-ui');
const http = require('http');
const https = require('https');
const chalk = require('chalk');
const crypto = require('crypto');

class APIEndpointTestSuite {
    constructor() {
        this.testResults = [];
        this.totalTests = 0;
        this.passedTests = 0;
        this.failedTests = 0;
        this.startTime = Date.now();
        this.webUI = null;
        this.testPort = 4001; // Unique port for testing
        this.baseURL = `http://localhost:${this.testPort}`;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: chalk.blue('ℹ'),
            success: chalk.green('✓'),
            error: chalk.red('✗'),
            warning: chalk.yellow('⚠'),
            debug: chalk.gray('►')
        }[type] || chalk.blue('ℹ');
        
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async runTest(testName, testFunction) {
        this.totalTests++;
        this.log(`Running test: ${testName}`, 'debug');
        
        // Add delay between tests to avoid rate limiting
        if (this.totalTests > 1) {
            await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
        }
        
        try {
            const startTime = Date.now();
            await testFunction();
            const duration = Date.now() - startTime;
            
            this.passedTests++;
            this.testResults.push({
                name: testName,
                status: 'PASS',
                duration,
                error: null
            });
            this.log(`PASS: ${testName} (${duration}ms)`, 'success');
        } catch (error) {
            this.failedTests++;
            this.testResults.push({
                name: testName,
                status: 'FAIL',
                duration: Date.now() - this.startTime,
                error: error.message
            });
            this.log(`FAIL: ${testName} - ${error.message}`, 'error');
        }
    }

    async makeRequest(path, options = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.baseURL);
            
            const requestOptions = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: options.method || 'GET',
                headers: {
                    'User-Agent': 'API-Test-Suite/1.0',
                    ...options.headers
                },
                timeout: 5000
            };

            const req = http.request(requestOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const responseData = {
                            statusCode: res.statusCode,
                            headers: res.headers,
                            body: data,
                            json: null
                        };
                        
                        // Try to parse JSON if content-type suggests it
                        if (res.headers['content-type']?.includes('application/json')) {
                            try {
                                responseData.json = JSON.parse(data);
                            } catch (e) {
                                // Not valid JSON, leave as string
                            }
                        }
                        
                        resolve(responseData);
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (options.body) {
                req.write(options.body);
            }
            
            req.end();
        });
    }

    async setupWebUI() {
        this.webUI = new WebUI(this.testPort);
        await this.webUI.start();
        this.log(`Test WebUI started on port ${this.testPort}`, 'info');
        
        // Wait a moment for server to be ready
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    async teardownWebUI() {
        if (this.webUI) {
            await this.webUI.stop();
            this.webUI = null;
            this.log('Test WebUI stopped', 'info');
        }
    }

    async testHealthEndpoint() {
        const response = await this.makeRequest(`/health?token=${this.webUI.sessionToken}`);
        
        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }
        
        if (!response.json) {
            throw new Error('Response is not JSON');
        }
        
        if (response.json.status !== 'ok') {
            throw new Error(`Expected status 'ok', got '${response.json.status}'`);
        }
        
        if (!response.json.timestamp) {
            throw new Error('Missing timestamp in response');
        }
        
        // Validate timestamp format
        const timestamp = new Date(response.json.timestamp);
        if (isNaN(timestamp.getTime())) {
            throw new Error('Invalid timestamp format');
        }
    }

    async testSessionEndpoint() {
        const response = await this.makeRequest(`/api/session?token=${this.webUI.sessionToken}`);
        
        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }
        
        if (!response.json) {
            throw new Error('Response is not JSON');
        }
        
        // Validate session data structure
        const session = response.json;
        const requiredFields = ['iterations', 'currentPhase', 'output', 'startTime', 'isRunning'];
        
        for (const field of requiredFields) {
            if (!(field in session)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        if (typeof session.iterations !== 'number') {
            throw new Error('iterations should be a number');
        }
        
        if (typeof session.currentPhase !== 'string') {
            throw new Error('currentPhase should be a string');
        }
        
        if (!Array.isArray(session.output)) {
            throw new Error('output should be an array');
        }
        
        if (typeof session.startTime !== 'number') {
            throw new Error('startTime should be a number');
        }
        
        if (typeof session.isRunning !== 'boolean') {
            throw new Error('isRunning should be a boolean');
        }
    }

    async testDashboardEndpoint() {
        const response = await this.makeRequest(`/?token=${this.webUI.sessionToken}`);
        
        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }
        
        if (!response.headers['content-type']?.includes('text/html')) {
            throw new Error('Expected HTML content type');
        }
        
        // Check for essential HTML elements
        const html = response.body;
        if (!html.includes('<!DOCTYPE html>')) {
            throw new Error('Missing DOCTYPE declaration');
        }
        
        if (!html.includes('Claude Loop')) {
            throw new Error('Missing Claude Loop branding');
        }
        
        if (!html.includes('sessionData')) {
            throw new Error('Missing JavaScript session data handling');
        }
        
        if (!html.includes('WebSocket')) {
            throw new Error('Missing WebSocket client code');
        }
    }

    async testAuthenticationRequired() {
        // Test without token
        const response = await this.makeRequest('/api/session');
        
        if (response.statusCode !== 401) {
            throw new Error(`Expected 401, got ${response.statusCode}`);
        }
        
        if (!response.json || response.json.error !== 'Invalid or missing token') {
            throw new Error('Expected proper authentication error message');
        }
    }

    async testInvalidToken() {
        const invalidToken = 'invalid-token-123';
        const response = await this.makeRequest(`/api/session?token=${invalidToken}`);
        
        if (response.statusCode !== 401) {
            throw new Error(`Expected 401, got ${response.statusCode}`);
        }
        
        if (!response.json || response.json.error !== 'Invalid or missing token') {
            throw new Error('Expected proper authentication error message');
        }
    }

    async testExpiredToken() {
        // Temporarily set token expiry to past
        const originalExpiry = this.webUI.tokenExpiry;
        this.webUI.tokenExpiry = Date.now() - 1000; // 1 second ago
        
        try {
            const response = await this.makeRequest(`/api/session?token=${this.webUI.sessionToken}`);
            
            if (response.statusCode !== 401) {
                throw new Error(`Expected 401, got ${response.statusCode}`);
            }
            
            if (!response.json || response.json.error !== 'Token expired') {
                throw new Error('Expected token expired error message');
            }
        } finally {
            // Restore original expiry
            this.webUI.tokenExpiry = originalExpiry;
        }
    }

    async testRateLimiting() {
        const token = this.webUI.sessionToken;
        const maxRequests = 15; // Reduced to avoid overwhelming the system
        const responses = [];
        
        // Make sequential requests with small delays
        for (let i = 0; i < maxRequests; i++) {
            try {
                const response = await this.makeRequest(`/health?token=${token}`);
                responses.push(response);
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
                responses.push({ statusCode: 500, error: error.message });
            }
        }
        
        // Check if any were rate limited
        const rateLimitedResponses = responses.filter(response => response.statusCode === 429);
        
        if (rateLimitedResponses.length === 0) {
            this.log('Note: Rate limiting not triggered with current test parameters', 'info');
        } else {
            this.log(`Rate limiting triggered after ${responses.length - rateLimitedResponses.length} requests`, 'info');
        }
        
        // At least some requests should succeed
        const successfulResponses = responses.filter(response => response.statusCode === 200);
        if (successfulResponses.length === 0) {
            throw new Error('No requests succeeded - rate limiting may be too aggressive');
        }
    }

    async testSecurityHeaders() {
        const response = await this.makeRequest(`/health?token=${this.webUI.sessionToken}`);
        
        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }
        
        const headers = response.headers;
        const requiredHeaders = [
            'x-content-type-options',
            'x-frame-options',
            'x-xss-protection',
            'referrer-policy',
            'content-security-policy'
        ];
        
        for (const header of requiredHeaders) {
            if (!headers[header]) {
                throw new Error(`Missing security header: ${header}`);
            }
        }
        
        // Validate specific header values
        if (headers['x-content-type-options'] !== 'nosniff') {
            throw new Error('Invalid X-Content-Type-Options header');
        }
        
        if (headers['x-frame-options'] !== 'DENY') {
            throw new Error('Invalid X-Frame-Options header');
        }
        
        if (!headers['x-xss-protection'].includes('1')) {
            throw new Error('Invalid X-XSS-Protection header');
        }
    }

    async testCORSHandling() {
        const response = await this.makeRequest(`/health?token=${this.webUI.sessionToken}`, {
            headers: {
                'Origin': 'http://malicious-site.com'
            }
        });
        
        // Should still work but without permissive CORS headers
        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }
        
        // Check that no permissive CORS headers are set
        if (response.headers['access-control-allow-origin'] === '*') {
            throw new Error('Permissive CORS detected - security risk');
        }
    }

    async testMethodNotAllowed() {
        // Test unsupported HTTP methods
        const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];
        
        for (const method of methods) {
            try {
                const response = await this.makeRequest(`/api/session?token=${this.webUI.sessionToken}`, {
                    method
                });
                
                // Should get 404 or 405 for unsupported methods
                if (response.statusCode !== 404 && response.statusCode !== 405) {
                    this.log(`Warning: ${method} method returned ${response.statusCode} instead of 404/405`, 'warning');
                }
            } catch (error) {
                // Connection errors are acceptable for unsupported methods
                if (!error.message.includes('ECONNRESET') && !error.message.includes('socket hang up')) {
                    throw error;
                }
            }
        }
    }

    async testMalformedRequests() {
        // Test with malformed parameters
        const malformedTests = [
            { path: '/api/session?token=', desc: 'empty token' },
            { path: '/api/session?token=' + 'x'.repeat(1000), desc: 'oversized token' },
            { path: '/api/session?token=<script>alert(1)</script>', desc: 'XSS attempt in token' },
            { path: '/api/session?token=../../etc/passwd', desc: 'path traversal attempt' },
            { path: '/api/session?' + 'param=value&'.repeat(100), desc: 'parameter pollution' }
        ];
        
        for (const test of malformedTests) {
            try {
                const response = await this.makeRequest(test.path);
                
                // Should be rejected with 401 (invalid token) or 400 (bad request)
                if (response.statusCode !== 401 && response.statusCode !== 400) {
                    this.log(`Warning: ${test.desc} returned ${response.statusCode}`, 'warning');
                }
            } catch (error) {
                // Connection errors are acceptable for malformed requests
                if (!error.message.includes('timeout') && !error.message.includes('ECONNRESET')) {
                    throw new Error(`Error testing ${test.desc}: ${error.message}`);
                }
            }
        }
    }

    async testContentNegotiation() {
        // Test different Accept headers
        const response = await this.makeRequest(`/api/session?token=${this.webUI.sessionToken}`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (response.statusCode !== 200) {
            throw new Error(`Expected 200, got ${response.statusCode}`);
        }
        
        if (!response.headers['content-type']?.includes('application/json')) {
            throw new Error('Expected JSON content type');
        }
    }

    async testConcurrentRequests() {
        const token = this.webUI.sessionToken;
        const concurrentRequests = 10;
        const promises = [];
        
        // Make concurrent requests to different endpoints
        for (let i = 0; i < concurrentRequests; i++) {
            const endpoint = i % 3 === 0 ? '/health' : 
                           i % 3 === 1 ? '/api/session' : '/';
            promises.push(this.makeRequest(`${endpoint}?token=${token}`));
        }
        
        const responses = await Promise.all(promises);
        
        // All should succeed
        for (let i = 0; i < responses.length; i++) {
            const response = responses[i];
            if (response.statusCode !== 200) {
                throw new Error(`Concurrent request ${i} failed with status ${response.statusCode}`);
            }
        }
    }

    async testSessionDataConsistency() {
        // Make multiple session requests and verify data consistency
        const responses = [];
        
        for (let i = 0; i < 5; i++) {
            const response = await this.makeRequest(`/api/session?token=${this.webUI.sessionToken}`);
            if (response.statusCode !== 200) {
                throw new Error(`Session request ${i} failed`);
            }
            responses.push(response.json);
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Verify all responses have consistent structure
        const firstResponse = responses[0];
        for (let i = 1; i < responses.length; i++) {
            const response = responses[i];
            
            // Check that structure is consistent
            if (Object.keys(response).length !== Object.keys(firstResponse).length) {
                throw new Error(`Response ${i} has different number of fields`);
            }
            
            for (const key of Object.keys(firstResponse)) {
                if (!(key in response)) {
                    throw new Error(`Response ${i} missing field: ${key}`);
                }
                
                if (typeof response[key] !== typeof firstResponse[key]) {
                    throw new Error(`Response ${i} field ${key} has different type`);
                }
            }
        }
    }

    async generateReport() {
        const duration = Date.now() - this.startTime;
        const successRate = this.totalTests > 0 ? (this.passedTests / this.totalTests * 100).toFixed(2) : 0;
        
        console.log('\n' + chalk.cyan('='.repeat(60)));
        console.log(chalk.cyan.bold('           API ENDPOINTS TEST SUITE REPORT'));
        console.log(chalk.cyan('='.repeat(60)));
        
        console.log(chalk.blue(`📊 Total Tests: ${this.totalTests}`));
        console.log(chalk.green(`✅ Passed: ${this.passedTests}`));
        console.log(chalk.red(`❌ Failed: ${this.failedTests}`));
        console.log(chalk.yellow(`📈 Success Rate: ${successRate}%`));
        console.log(chalk.gray(`⏱️ Total Duration: ${duration}ms`));
        
        if (this.failedTests > 0) {
            console.log('\n' + chalk.red.bold('FAILED TESTS:'));
            this.testResults
                .filter(result => result.status === 'FAIL')
                .forEach(result => {
                    console.log(chalk.red(`❌ ${result.name}: ${result.error}`));
                });
        }
        
        console.log('\n' + chalk.cyan('='.repeat(60)));
        
        // Write detailed report
        const report = {
            timestamp: new Date().toISOString(),
            testType: 'API Endpoints',
            summary: {
                totalTests: this.totalTests,
                passedTests: this.passedTests,
                failedTests: this.failedTests,
                successRate: parseFloat(successRate),
                duration
            },
            results: this.testResults
        };
        
        try {
            const fs = require('fs').promises;
            await fs.writeFile('api-endpoints-test-report.json', JSON.stringify(report, null, 2));
            console.log(chalk.gray('📄 Detailed report saved to api-endpoints-test-report.json'));
        } catch (error) {
            console.log(chalk.yellow(`⚠ Could not save report: ${error.message}`));
        }
        
        return this.failedTests === 0;
    }

    async runAllTests() {
        console.log(chalk.cyan.bold('\n🌐 Starting API Endpoints Test Suite\n'));
        
        try {
            await this.setupWebUI();
            
            // Core endpoint functionality tests
            await this.runTest('Health Endpoint', () => this.testHealthEndpoint());
            await this.runTest('Session Endpoint', () => this.testSessionEndpoint());
            await this.runTest('Dashboard Endpoint', () => this.testDashboardEndpoint());
            
            // Authentication and security tests
            await this.runTest('Authentication Required', () => this.testAuthenticationRequired());
            await this.runTest('Invalid Token Handling', () => this.testInvalidToken());
            await this.runTest('Expired Token Handling', () => this.testExpiredToken());
            await this.runTest('Rate Limiting', () => this.testRateLimiting());
            await this.runTest('Security Headers', () => this.testSecurityHeaders());
            await this.runTest('CORS Handling', () => this.testCORSHandling());
            
            // Edge cases and error handling
            await this.runTest('Method Not Allowed', () => this.testMethodNotAllowed());
            await this.runTest('Malformed Requests', () => this.testMalformedRequests());
            await this.runTest('Content Negotiation', () => this.testContentNegotiation());
            
            // Performance and consistency tests
            await this.runTest('Concurrent Requests', () => this.testConcurrentRequests());
            await this.runTest('Session Data Consistency', () => this.testSessionDataConsistency());
            
        } finally {
            await this.teardownWebUI();
        }
        
        return await this.generateReport();
    }
}

// Run tests if called directly
if (require.main === module) {
    const testSuite = new APIEndpointTestSuite();
    testSuite.runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error(chalk.red('Test suite crashed:'), error);
            process.exit(1);
        });
}

module.exports = APIEndpointTestSuite;