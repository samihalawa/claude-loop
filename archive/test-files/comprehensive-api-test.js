#!/usr/bin/env node

/**
 * Comprehensive API Endpoint Testing Suite
 * Tests all API endpoints for functionality, error handling, and security
 */

const express = require('express');
const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const crypto = require('crypto');

class ComprehensiveAPITestSuite {
    constructor() {
        this.testResults = [];
        this.serverProcess = null;
        this.webUIProcess = null;
        this.baseURL = 'http://localhost:3001';
        this.webUIURL = 'http://localhost:3334';
        this.webSocketURL = 'ws://localhost:3334';
        this.webUIToken = null;
    }

    async runAllTests() {
        console.log('🧪 Starting Comprehensive API Endpoint Testing Suite');
        console.log('='.repeat(60));
        
        try {
            // Start servers
            await this.startTestServers();
            
            // Test broken app API endpoints
            await this.testBrokenAppEndpoints();
            
            // Test WebUI endpoints
            await this.testWebUIEndpoints();
            
            // Test WebSocket functionality
            await this.testWebSocketConnections();
            
            // Generate comprehensive report
            this.generateTestReport();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            this.addTestResult('SUITE_FAILURE', false, error.message);
        } finally {
            await this.cleanup();
        }
    }

    async startTestServers() {
        console.log('\n🚀 Starting test servers...');
        
        return new Promise((resolve, reject) => {
            // Start test-broken-app.js
            this.serverProcess = spawn('node', ['test-broken-app.js'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, NODE_ENV: 'development' }
            });
            
            let serverReady = false;
            let webUIReady = false;
            
            this.serverProcess.stdout.on('data', (data) => {
                const output = data.toString();
                if (output.includes('App running on port 3001')) {
                    serverReady = true;
                    console.log('✅ Test server started on port 3001');
                    
                    // Start WebUI
                    this.webUIProcess = spawn('node', ['start-webui.js'], {
                        stdio: ['pipe', 'pipe', 'pipe'],
                        env: { ...process.env, WEBUI_PORT: '3334' }
                    });
                    
                    this.webUIProcess.stdout.on('data', (webUIData) => {
                        const webUIOutput = webUIData.toString();
                        if (webUIOutput.includes('Full Token:')) {
                            const tokenMatch = webUIOutput.match(/Full Token: ([a-f0-9]+)/);
                            if (tokenMatch) {
                                this.webUIToken = tokenMatch[1];
                                webUIReady = true;
                                console.log('✅ WebUI started with token:', this.webUIToken.substring(0, 8) + '...');
                                
                                if (serverReady && webUIReady) {
                                    setTimeout(resolve, 2000); // Wait for services to be fully ready
                                }
                            }
                        }
                    });
                    
                    this.webUIProcess.stderr.on('data', (data) => {
                        // Ignore stderr for startup
                    });
                }
            });
            
            this.serverProcess.stderr.on('data', (data) => {
                // Ignore stderr for startup
            });
            
            setTimeout(() => {
                if (!serverReady || !webUIReady) {
                    reject(new Error('Servers failed to start within timeout'));
                }
            }, 15000);
        });
    }

    async testBrokenAppEndpoints() {
        console.log('\n📡 Testing test-broken-app.js API endpoints...');
        
        // Test health endpoint
        await this.testEndpoint('GET', '/health', null, 'Health Check', 200);
        
        // Test config endpoint
        await this.testEndpoint('GET', '/api/config', null, 'Config API', 200);
        
        // Test endpoint
        await this.testEndpoint('GET', '/api/test', null, 'Test API', 200);
        
        // Test data endpoint - valid data
        await this.testEndpoint('POST', '/api/data', { data: 'test' }, 'Data API - Valid', 200);
        
        // Test data endpoint - missing data
        await this.testEndpoint('POST', '/api/data', { invalid: 'test' }, 'Data API - Missing Data', 400);
        
        // Test data endpoint - no body
        await this.testEndpoint('POST', '/api/data', null, 'Data API - No Body', 400);
        
        // Test data endpoint - XSS attempt (should sanitize and reject empty result)
        await this.testEndpoint('POST', '/api/data', { 
            data: '<script>alert("xss")</script>' 
        }, 'Data API - XSS Protection', 400);
        
        // Test 404 endpoint
        await this.testEndpoint('GET', '/nonexistent', null, '404 Handler', 404);
        
        // Test home page
        await this.testEndpoint('GET', '/', null, 'Homepage', 200);
    }

    async testWebUIEndpoints() {
        console.log('\n🌐 Testing WebUI API endpoints...');
        
        if (!this.webUIToken) {
            this.addTestResult('WEBUI_TOKEN', false, 'No WebUI token available');
            return;
        }
        
        // Test WebUI health with token
        await this.testWebUIEndpoint('GET', '/health', null, 'WebUI Health Check');
        
        // Test WebUI session API with token
        await this.testWebUIEndpoint('GET', '/api/session', null, 'WebUI Session API');
        
        // Test WebUI home with token
        await this.testWebUIEndpoint('GET', '/', null, 'WebUI Homepage');
        
        // Test WebUI without token (should fail)
        await this.testEndpoint('GET', '/health', null, 'WebUI Health - No Token', 401, this.webUIURL);
    }

    async testWebSocketConnections() {
        console.log('\n🔌 Testing WebSocket connections...');
        
        if (!this.webUIToken) {
            this.addTestResult('WEBSOCKET_TOKEN', false, 'No WebUI token for WebSocket test');
            return;
        }
        
        // Test valid WebSocket connection
        await this.testWebSocketConnection(this.webUIToken, 'Valid WebSocket Connection', true);
        
        // Test invalid WebSocket connection
        await this.testWebSocketConnection('invalid_token', 'Invalid WebSocket Connection', false);
        
        // Test WebSocket without token
        await this.testWebSocketConnection(null, 'WebSocket No Token', false);
    }

    async testEndpoint(method, path, body, description, expectedStatus = 200, baseURL = null) {
        const url = `${baseURL || this.baseURL}${path}`;
        const startTime = Date.now();
        
        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' }
            };
            
            if (body) {
                options.body = JSON.stringify(body);
            }
            
            const response = await fetch(url, options);
            const responseTime = Date.now() - startTime;
            const responseBody = await response.text();
            
            let parsedBody;
            try {
                parsedBody = JSON.parse(responseBody);
            } catch {
                parsedBody = responseBody;
            }
            
            const success = response.status === expectedStatus;
            
            this.addTestResult(
                description,
                success,
                success ? 
                    `Status: ${response.status}, Time: ${responseTime}ms` :
                    `Expected ${expectedStatus}, got ${response.status}: ${responseBody.substring(0, 100)}`
            );
            
            if (success) {
                console.log(`✅ ${description}: ${response.status} (${responseTime}ms)`);
            } else {
                console.log(`❌ ${description}: Expected ${expectedStatus}, got ${response.status}`);
            }
            
        } catch (error) {
            this.addTestResult(description, false, `Error: ${error.message}`);
            console.log(`❌ ${description}: ${error.message}`);
        }
    }

    async testWebUIEndpoint(method, path, body, description) {
        const url = `${this.webUIURL}${path}?token=${this.webUIToken}`;
        await this.testEndpoint(method, '', body, description, 200, url);
    }

    async testWebSocketConnection(token, description, shouldSucceed = true) {
        return new Promise((resolve) => {
            const wsURL = token ? 
                `${this.webSocketURL}?token=${token}` : 
                this.webSocketURL;
            
            const ws = new WebSocket(wsURL, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (WebSocket Test Client)'
                }
            });
            
            let resolved = false;
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    this.addTestResult(description, !shouldSucceed, 'Connection timeout');
                    console.log(`${shouldSucceed ? '❌' : '✅'} ${description}: Timeout`);
                    ws.close();
                    resolve();
                }
            }, 5000);
            
            ws.on('open', () => {
                // For security tests, wait to see if connection gets closed immediately due to auth
                if (!shouldSucceed) {
                    setTimeout(() => {
                        if (!resolved && ws.readyState === WebSocket.OPEN) {
                            resolved = true;
                            clearTimeout(timeout);
                            this.addTestResult(description, false, 'Connection stayed open despite invalid auth');
                            console.log(`❌ ${description}: Connected and stayed open (security issue)`);
                            ws.close();
                            resolve();
                        }
                    }, 100); // Wait to see if server closes connection
                } else {
                    resolved = true;
                    clearTimeout(timeout);
                    this.addTestResult(description, true, 'Connection successful');
                    console.log(`✅ ${description}: Connected`);
                    ws.close();
                    resolve();
                }
            });
            
            ws.on('error', (error) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    this.addTestResult(description, !shouldSucceed, `Error: ${error.message}`);
                    console.log(`${shouldSucceed ? '❌' : '✅'} ${description}: ${error.message}`);
                    resolve();
                }
            });
            
            ws.on('close', (code, reason) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    if (shouldSucceed) {
                        const success = code === 1000;
                        this.addTestResult(description, success, `Closed: ${code} ${reason}`);
                        console.log(`${success ? '✅' : '❌'} ${description}: Closed ${code} ${reason}`);
                    } else {
                        // For invalid tokens, expect rejection codes (1008 = policy violation)
                        const success = code === 1008 || code === 1005;
                        this.addTestResult(description, success, `Properly rejected: ${code} ${reason}`);
                        console.log(`${success ? '✅' : '❌'} ${description}: Properly rejected ${code} ${reason}`);
                    }
                    resolve();
                }
            });
        });
    }

    addTestResult(name, success, details) {
        this.testResults.push({
            name,
            success,
            details,
            timestamp: new Date().toISOString()
        });
    }

    generateTestReport() {
        console.log('\n📋 COMPREHENSIVE API TEST REPORT');
        console.log('='.repeat(60));
        
        const passed = this.testResults.filter(r => r.success).length;
        const total = this.testResults.length;
        const percentage = ((passed / total) * 100).toFixed(1);
        
        console.log(`\n📊 Overall Results: ${passed}/${total} tests passed (${percentage}%)\n`);
        
        this.testResults.forEach(result => {
            const status = result.success ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} ${result.name}`);
            if (result.details) {
                console.log(`   ${result.details}`);
            }
        });
        
        console.log('\n🎯 SUMMARY:');
        if (percentage >= 90) {
            console.log('🟢 Excellent: All API endpoints functioning properly');
        } else if (percentage >= 75) {
            console.log('🟡 Good: Most endpoints working, some issues to address');
        } else {
            console.log('🔴 Critical: Multiple endpoints have issues requiring immediate attention');
        }
        
        const failures = this.testResults.filter(r => !r.success);
        if (failures.length > 0) {
            console.log('\n🚨 FAILURES TO ADDRESS:');
            failures.forEach(failure => {
                console.log(`   - ${failure.name}: ${failure.details}`);
            });
        }
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test servers...');
        
        if (this.serverProcess) {
            this.serverProcess.kill('SIGTERM');
            console.log('✅ Test server stopped');
        }
        
        if (this.webUIProcess) {
            this.webUIProcess.kill('SIGTERM');
            console.log('✅ WebUI server stopped');
        }
        
        console.log('✅ Cleanup completed');
    }
}

// Run the test suite
if (require.main === module) {
    const testSuite = new ComprehensiveAPITestSuite();
    testSuite.runAllTests().catch(console.error);
}

module.exports = ComprehensiveAPITestSuite;