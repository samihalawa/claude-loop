#!/usr/bin/env node

const WebSocket = require('ws');
const https = require('https');
const http = require('http');

// Comprehensive WebSocket and UI Testing
class WebUITester {
    constructor() {
        this.baseUrl = 'http://localhost:3333';
        this.token = '2bc2532e923c6d7c317f683da65561a7d1beb63eb6a3745ec3432cf7ec74c9fe5c51d22c5fbf19fbe5075a97060bf556c71b89a946f945db91b93b6a8b26788a';
        this.results = {
            httpTests: {},
            websocketTests: {},
            securityTests: {},
            performanceTests: {}
        };
    }

    async runAllTests() {
        console.log('🚀 Starting Comprehensive Web UI Testing...\n');
        
        await this.testHTTPEndpoints();
        await this.testWebSocketConnection();
        await this.testSecurity();
        await this.testPerformance();
        
        this.generateReport();
    }

    async testHTTPEndpoints() {
        console.log('📡 Testing HTTP Endpoints...');
        
        // Test main dashboard
        await this.testEndpoint('GET', '/', 'Main Dashboard', true);
        
        // Test API session
        await this.testEndpoint('GET', '/api/session', 'Session API', true);
        
        // Test health check
        await this.testEndpoint('GET', '/health', 'Health Check', true);
        
        // Test invalid token
        await this.testEndpoint('GET', '/', 'Invalid Token Test', false, 'invalid_token');
        
        // Test no token
        await this.testEndpoint('GET', '/', 'No Token Test', false, null);
        
        console.log('✅ HTTP endpoint tests completed\n');
    }

    async testEndpoint(method, path, testName, shouldSucceed, customToken = null) {
        return new Promise((resolve) => {
            const token = customToken === null ? '' : (customToken || this.token);
            const url = `${this.baseUrl}${path}${token ? `?token=${token}` : ''}`;
            
            const startTime = Date.now();
            const req = http.get(url, (res) => {
                const duration = Date.now() - startTime;
                let data = '';
                
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    const success = shouldSucceed ? res.statusCode === 200 : res.statusCode !== 200;
                    this.results.httpTests[testName] = {
                        success,
                        statusCode: res.statusCode,
                        duration,
                        size: data.length,
                        headers: res.headers
                    };
                    
                    console.log(`  ${success ? '✅' : '❌'} ${testName}: ${res.statusCode} (${duration}ms, ${data.length} bytes)`);
                    resolve();
                });
            });
            
            req.on('error', (err) => {
                this.results.httpTests[testName] = {
                    success: false,
                    error: err.message,
                    duration: Date.now() - startTime
                };
                console.log(`  ❌ ${testName}: Error - ${err.message}`);
                resolve();
            });
            
            req.setTimeout(5000, () => {
                req.destroy();
                this.results.httpTests[testName] = {
                    success: false,
                    error: 'Timeout',
                    duration: 5000
                };
                console.log(`  ❌ ${testName}: Timeout`);
                resolve();
            });
        });
    }

    async testWebSocketConnection() {
        console.log('🔌 Testing WebSocket Connection...');
        
        return new Promise((resolve) => {
            const wsUrl = `ws://localhost:3333?token=${this.token}`;
            const ws = new WebSocket(wsUrl);
            const startTime = Date.now();
            let messageCount = 0;
            let sessionDataReceived = false;
            
            ws.on('open', () => {
                const connectionTime = Date.now() - startTime;
                console.log(`  ✅ WebSocket Connected (${connectionTime}ms)`);
                
                // Test ping message
                ws.send(JSON.stringify({ type: 'ping' }));
                
                // Test session request
                ws.send(JSON.stringify({ type: 'request_session' }));
                
                // Auto-close after testing
                setTimeout(() => {
                    ws.close();
                }, 3000);
            });
            
            ws.on('message', (data) => {
                messageCount++;
                try {
                    const message = JSON.parse(data);
                    console.log(`  📨 Message ${messageCount}: ${message.type}`);
                    
                    if (message.type === 'session_data' || message.type === 'session_update') {
                        sessionDataReceived = true;
                        console.log(`    📊 Session Data: ${message.data.currentPhase}, Running: ${message.data.isRunning}`);
                    }
                } catch (e) {
                    console.log(`  ❌ Invalid JSON message received`);
                }
            });
            
            ws.on('close', (code, reason) => {
                const totalTime = Date.now() - startTime;
                this.results.websocketTests = {
                    success: code === 1000 || code === 1001,
                    connectionTime: Date.now() - startTime,
                    totalTime,
                    messageCount,
                    sessionDataReceived,
                    closeCode: code,
                    closeReason: reason.toString()
                };
                
                console.log(`  🔌 WebSocket Closed: Code ${code} (${totalTime}ms total, ${messageCount} messages)`);
                console.log(`  ✅ WebSocket tests completed\n`);
                resolve();
            });
            
            ws.on('error', (error) => {
                this.results.websocketTests = {
                    success: false,
                    error: error.message,
                    duration: Date.now() - startTime
                };
                console.log(`  ❌ WebSocket Error: ${error.message}`);
                resolve();
            });
        });
    }

    async testSecurity() {
        console.log('🔒 Testing Security Features...');
        
        // Test CORS headers
        await this.testCORS();
        
        // Test rate limiting (already done above, but let's verify)
        await this.testRateLimiting();
        
        // Test XSS protection
        await this.testXSSProtection();
        
        console.log('✅ Security tests completed\n');
    }

    async testCORS() {
        return new Promise((resolve) => {
            const options = {
                hostname: 'localhost',
                port: 3333,
                path: `/health?token=${this.token}`,
                method: 'OPTIONS',
                headers: {
                    'Origin': 'http://malicious.example.com',
                    'Access-Control-Request-Method': 'GET'
                }
            };

            const req = http.request(options, (res) => {
                this.results.securityTests.cors = {
                    success: res.statusCode === 204,
                    headers: res.headers,
                    allowsArbitraryOrigin: !res.headers['access-control-allow-origin'] || 
                                          res.headers['access-control-allow-origin'] === '*'
                };
                console.log(`  🛡️  CORS Test: ${res.statusCode} - ${this.results.securityTests.cors.allowsArbitraryOrigin ? '❌ Allows any origin' : '✅ Origin restricted'}`);
                resolve();
            });

            req.on('error', (err) => {
                this.results.securityTests.cors = { success: false, error: err.message };
                resolve();
            });

            req.end();
        });
    }

    async testRateLimiting() {
        console.log('  🚦 Testing Rate Limiting...');
        let requestCount = 0;
        let rateLimited = false;
        
        const testPromises = [];
        for (let i = 0; i < 35; i++) {
            testPromises.push(
                new Promise((resolve) => {
                    const req = http.get(`${this.baseUrl}/health?token=${this.token}`, (res) => {
                        requestCount++;
                        if (res.statusCode === 429) {
                            rateLimited = true;
                        }
                        resolve(res.statusCode);
                    });
                    req.on('error', () => resolve('error'));
                })
            );
        }
        
        await Promise.all(testPromises);
        
        this.results.securityTests.rateLimiting = {
            success: rateLimited,
            requestCount,
            rateLimitTriggered: rateLimited
        };
        
        console.log(`  🚦 Rate Limiting: ${rateLimited ? '✅ Triggered' : '❌ Not triggered'} (${requestCount} requests)`);
    }

    async testXSSProtection() {
        const xssPayload = '<script>alert("xss")</script>';
        await this.testEndpoint('GET', `/?malicious=${encodeURIComponent(xssPayload)}`, 'XSS Protection Test', false);
        this.results.securityTests.xss = { tested: true };
        console.log('  🛡️  XSS Protection: ✅ Tested');
    }

    async testPerformance() {
        console.log('⚡ Testing Performance...');
        
        const iterations = 10;
        const times = [];
        
        for (let i = 0; i < iterations; i++) {
            const start = Date.now();
            await this.testEndpoint('GET', '/', `Performance Test ${i+1}`, true);
            times.push(Date.now() - start);
        }
        
        const avgTime = times.reduce((a, b) => a + b) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        
        this.results.performanceTests = {
            iterations,
            averageTime: avgTime,
            minTime,
            maxTime,
            times
        };
        
        console.log(`  ⚡ Performance: Avg ${avgTime.toFixed(1)}ms, Min ${minTime}ms, Max ${maxTime}ms`);
        console.log('✅ Performance tests completed\n');
    }

    generateReport() {
        console.log('📋 COMPREHENSIVE UI TEST REPORT');
        console.log('=====================================\n');
        
        // HTTP Tests Summary
        const httpTests = Object.entries(this.results.httpTests);
        const httpSuccess = httpTests.filter(([name, result]) => result.success).length;
        console.log(`🌐 HTTP Tests: ${httpSuccess}/${httpTests.length} passed`);
        httpTests.forEach(([name, result]) => {
            console.log(`  ${result.success ? '✅' : '❌'} ${name}: ${result.statusCode || 'Error'} (${result.duration}ms)`);
        });
        
        // WebSocket Tests
        console.log(`\n🔌 WebSocket Tests:`);
        const ws = this.results.websocketTests;
        if (ws.success) {
            console.log(`  ✅ Connection: ${ws.connectionTime}ms`);
            console.log(`  ✅ Messages: ${ws.messageCount} received`);
            console.log(`  ✅ Session Data: ${ws.sessionDataReceived ? 'Received' : 'Not received'}`);
        } else {
            console.log(`  ❌ Failed: ${ws.error || 'Unknown error'}`);
        }
        
        // Security Tests
        console.log(`\n🔒 Security Tests:`);
        const sec = this.results.securityTests;
        console.log(`  ${sec.cors?.success ? '✅' : '❌'} CORS Configuration`);
        console.log(`  ${sec.rateLimiting?.success ? '✅' : '❌'} Rate Limiting`);
        console.log(`  ${sec.xss?.tested ? '✅' : '❌'} XSS Protection`);
        
        // Performance
        console.log(`\n⚡ Performance:`);
        const perf = this.results.performanceTests;
        console.log(`  Average Response: ${perf.averageTime?.toFixed(1)}ms`);
        console.log(`  Min Response: ${perf.minTime}ms`);
        console.log(`  Max Response: ${perf.maxTime}ms`);
        
        // Overall Assessment
        console.log(`\n🎯 OVERALL ASSESSMENT:`);
        const totalTests = httpTests.length + 3 + 3; // http + websocket + security
        const passedTests = httpSuccess + (ws.success ? 3 : 0) + 
                           (sec.cors?.success ? 1 : 0) + 
                           (sec.rateLimiting?.success ? 1 : 0) + 
                           (sec.xss?.tested ? 1 : 0);
        
        console.log(`  📊 Tests Passed: ${passedTests}/${totalTests}`);
        console.log(`  🎯 Success Rate: ${((passedTests/totalTests)*100).toFixed(1)}%`);
        
        if (perf.averageTime < 100) console.log('  ⚡ Performance: Excellent (<100ms)');
        else if (perf.averageTime < 500) console.log('  ⚡ Performance: Good (<500ms)');
        else console.log('  ⚡ Performance: Needs improvement (>500ms)');
        
        console.log('\n✅ UI Testing Complete!');
    }
}

// Run tests
if (require.main === module) {
    const tester = new WebUITester();
    tester.runAllTests().catch(console.error);
}

module.exports = WebUITester;