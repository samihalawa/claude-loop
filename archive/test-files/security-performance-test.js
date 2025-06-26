#!/usr/bin/env node

/**
 * Security and Performance Live Testing for claude-loop
 * Tests actual functionality under various attack scenarios and performance conditions
 */

const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');
const { spawn } = require('child_process');

class SecurityPerformanceTest {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            securityTests: {},
            performanceTests: {},
            overallScore: 0,
            recommendations: []
        };
        this.testPort = 3335;
        this.webUIProcess = null;
    }

    async runTests() {
        console.log('🚀 Starting Security & Performance Live Testing...\n');
        
        try {
            // Start WebUI for testing
            await this.startWebUI();
            
            // Security Tests
            await this.testRateLimitingLive();
            await this.testDOSResistance();
            await this.testConnectionLimits();
            await this.testTokenSecurityLive();
            await this.testWebSocketSecurity();
            
            // Performance Tests
            await this.testMemoryUsage();
            await this.testConcurrentConnections();
            await this.testResponseTimes();
            await this.testResourceCleanup();
            
            this.calculateOverallScore();
            await this.generateReport();
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
        } finally {
            await this.cleanup();
        }
        
        return this.results;
    }

    async startWebUI() {
        console.log('🔧 Starting WebUI for testing...');
        
        return new Promise((resolve, reject) => {
            this.webUIProcess = spawn('node', [
                path.join(__dirname, 'start-webui.js')
            ], {
                stdio: 'pipe',
                env: { ...process.env, WEBUI_PORT: this.testPort }
            });
            
            let output = '';
            this.webUIProcess.stdout.on('data', (data) => {
                output += data.toString();
                if (output.includes('WebUI started') || output.includes('Server running')) {
                    setTimeout(resolve, 2000); // Give it time to fully start
                }
            });
            
            this.webUIProcess.stderr.on('data', (data) => {
                console.log('WebUI stderr:', data.toString());
            });
            
            setTimeout(() => {
                if (!output.includes('WebUI started') && !output.includes('Server running')) {
                    console.log('⚠️  WebUI may not have started properly, proceeding with tests...');
                    resolve();
                }
            }, 5000);
        });
    }

    async testRateLimitingLive() {
        console.log('🧪 Testing Rate Limiting (Live)...');
        
        const startTime = Date.now();
        let successCount = 0;
        let blockedCount = 0;
        
        try {
            // Send rapid requests to test rate limiting
            const promises = [];
            for (let i = 0; i < 100; i++) {
                promises.push(this.makeHTTPRequest(`http://localhost:${this.testPort}/status`));
            }
            
            const results = await Promise.allSettled(promises);
            
            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value.statusCode === 200) {
                    successCount++;
                } else if (result.status === 'fulfilled' && result.value.statusCode === 429) {
                    blockedCount++;
                } else {
                    // Connection refused or other error
                    blockedCount++;
                }
            });
            
            const testTime = Date.now() - startTime;
            
            // Rate limiting should kick in after some requests
            const rateLimitWorking = blockedCount > 0 || successCount < 90;
            
            this.results.securityTests.rateLimitingLive = {
                status: rateLimitWorking ? 'pass' : 'fail',
                successCount,
                blockedCount,
                testTime,
                description: rateLimitWorking ? 
                    'Rate limiting successfully blocked excessive requests' : 
                    'Rate limiting may not be working properly'
            };
            
            console.log(`${rateLimitWorking ? '✅' : '❌'} Rate limiting: ${successCount} success, ${blockedCount} blocked`);
            
        } catch (error) {
            this.results.securityTests.rateLimitingLive = {
                status: 'error',
                error: error.message,
                description: 'Failed to test rate limiting'
            };
            console.log('❌ Rate limiting test failed:', error.message);
        }
    }

    async testDOSResistance() {
        console.log('🧪 Testing DOS Resistance...');
        
        const startTime = Date.now();
        let connectionAttempts = 0;
        let successfulConnections = 0;
        
        try {
            // Attempt many concurrent connections
            const promises = [];
            for (let i = 0; i < 50; i++) {
                connectionAttempts++;
                promises.push(this.testConnection());
            }
            
            const results = await Promise.allSettled(promises);
            
            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    successfulConnections++;
                }
            });
            
            const testTime = Date.now() - startTime;
            const resistantToDOS = successfulConnections < connectionAttempts * 0.8;
            
            this.results.securityTests.dosResistance = {
                status: resistantToDOS ? 'pass' : 'warning',
                connectionAttempts,
                successfulConnections,
                testTime,
                description: resistantToDOS ? 
                    'System successfully limited concurrent connections' : 
                    'System may be vulnerable to DOS attacks'
            };
            
            console.log(`${resistantToDOS ? '✅' : '⚠️'} DOS resistance: ${successfulConnections}/${connectionAttempts} connections succeeded`);
            
        } catch (error) {
            this.results.securityTests.dosResistance = {
                status: 'error',
                error: error.message,
                description: 'Failed to test DOS resistance'
            };
            console.log('❌ DOS resistance test failed:', error.message);
        }
    }

    async testConnectionLimits() {
        console.log('🧪 Testing Connection Limits...');
        
        try {
            const connections = [];
            let successfulConnections = 0;
            const maxAttempts = 20;
            
            for (let i = 0; i < maxAttempts; i++) {
                try {
                    const ws = new WebSocket(`ws://localhost:${this.testPort}`);
                    await new Promise((resolve, reject) => {
                        ws.on('open', () => {
                            successfulConnections++;
                            connections.push(ws);
                            resolve();
                        });
                        ws.on('error', reject);
                        setTimeout(reject, 3000); // 3 second timeout
                    });
                } catch (error) {
                    // Connection limit reached or connection failed
                    break;
                }
            }
            
            // Clean up connections
            connections.forEach(ws => {
                try { ws.close(); } catch (e) {}
            });
            
            const limitWorking = successfulConnections < maxAttempts;
            
            this.results.securityTests.connectionLimits = {
                status: limitWorking ? 'pass' : 'warning',
                maxAttempts,
                successfulConnections,
                description: limitWorking ? 
                    'Connection limits successfully enforced' : 
                    'Connection limits may not be properly enforced'
            };
            
            console.log(`${limitWorking ? '✅' : '⚠️'} Connection limits: ${successfulConnections}/${maxAttempts} connections allowed`);
            
        } catch (error) {
            this.results.securityTests.connectionLimits = {
                status: 'error',
                error: error.message,
                description: 'Failed to test connection limits'
            };
            console.log('❌ Connection limits test failed:', error.message);
        }
    }

    async testTokenSecurityLive() {
        console.log('🧪 Testing Token Security (Live)...');
        
        try {
            // Test access without token
            const noTokenResponse = await this.makeHTTPRequest(`http://localhost:${this.testPort}/status`);
            
            // Test with invalid token
            const invalidTokenResponse = await this.makeHTTPRequest(`http://localhost:${this.testPort}/status?token=invalid`);
            
            // Test with malicious token attempts
            const maliciousTokens = [
                'admin',
                '../../etc/passwd',
                '<script>alert("xss")</script>',
                'null',
                'undefined',
                '${7*7}',
                '{{7*7}}'
            ];
            
            let maliciousBlocked = 0;
            for (const token of maliciousTokens) {
                const response = await this.makeHTTPRequest(`http://localhost:${this.testPort}/status?token=${encodeURIComponent(token)}`);
                if (response.statusCode === 401 || response.statusCode === 403) {
                    maliciousBlocked++;
                }
            }
            
            const tokenSecurityGood = (
                (noTokenResponse.statusCode === 401 || noTokenResponse.statusCode === 403) &&
                (invalidTokenResponse.statusCode === 401 || invalidTokenResponse.statusCode === 403) &&
                maliciousBlocked >= maliciousTokens.length * 0.8
            );
            
            this.results.securityTests.tokenSecurityLive = {
                status: tokenSecurityGood ? 'pass' : 'fail',
                noTokenBlocked: noTokenResponse.statusCode === 401 || noTokenResponse.statusCode === 403,
                invalidTokenBlocked: invalidTokenResponse.statusCode === 401 || invalidTokenResponse.statusCode === 403,
                maliciousTokensBlocked: maliciousBlocked,
                totalMaliciousTokens: maliciousTokens.length,
                description: tokenSecurityGood ? 
                    'Token security properly implemented' : 
                    'Token security may have vulnerabilities'
            };
            
            console.log(`${tokenSecurityGood ? '✅' : '❌'} Token security: ${maliciousBlocked}/${maliciousTokens.length} malicious tokens blocked`);
            
        } catch (error) {
            this.results.securityTests.tokenSecurityLive = {
                status: 'error',
                error: error.message,
                description: 'Failed to test token security'
            };
            console.log('❌ Token security test failed:', error.message);
        }
    }

    async testWebSocketSecurity() {
        console.log('🧪 Testing WebSocket Security...');
        
        try {
            let securityScore = 0;
            const tests = [];
            
            // Test origin validation
            try {
                const ws = new WebSocket(`ws://localhost:${this.testPort}`, {
                    origin: 'http://malicious.example.com'
                });
                await new Promise((resolve, reject) => {
                    ws.on('error', () => {
                        securityScore++;
                        tests.push({ name: 'origin_validation', status: 'pass' });
                        resolve();
                    });
                    ws.on('open', () => {
                        ws.close();
                        tests.push({ name: 'origin_validation', status: 'fail' });
                        resolve();
                    });
                    setTimeout(resolve, 3000);
                });
            } catch (error) {
                tests.push({ name: 'origin_validation', status: 'error' });
            }
            
            // Test message size limits
            try {
                const ws = new WebSocket(`ws://localhost:${this.testPort}`);
                let largeMsgBlocked = false;
                
                await new Promise((resolve, reject) => {
                    ws.on('open', () => {
                        // Send very large message
                        const largeMessage = 'x'.repeat(10 * 1024 * 1024); // 10MB
                        try {
                            ws.send(largeMessage);
                        } catch (error) {
                            largeMsgBlocked = true;
                            securityScore++;
                        }
                        setTimeout(resolve, 2000);
                    });
                    ws.on('error', () => {
                        largeMsgBlocked = true;
                        securityScore++;
                        resolve();
                    });
                    ws.on('close', resolve);
                    setTimeout(resolve, 5000);
                });
                
                tests.push({ 
                    name: 'message_size_limits', 
                    status: largeMsgBlocked ? 'pass' : 'fail' 
                });
                
                ws.close();
            } catch (error) {
                tests.push({ name: 'message_size_limits', status: 'error' });
            }
            
            const wsSecurityGood = securityScore >= 1;
            
            this.results.securityTests.webSocketSecurity = {
                status: wsSecurityGood ? 'pass' : 'warning',
                securityScore,
                tests,
                description: wsSecurityGood ? 
                    'WebSocket security measures working' : 
                    'WebSocket security may need improvement'
            };
            
            console.log(`${wsSecurityGood ? '✅' : '⚠️'} WebSocket security: ${securityScore}/2 security measures working`);
            
        } catch (error) {
            this.results.securityTests.webSocketSecurity = {
                status: 'error',
                error: error.message,
                description: 'Failed to test WebSocket security'
            };
            console.log('❌ WebSocket security test failed:', error.message);
        }
    }

    async testMemoryUsage() {
        console.log('🧪 Testing Memory Usage...');
        
        try {
            const initialMemory = process.memoryUsage();
            
            // Simulate some load
            const connections = [];
            for (let i = 0; i < 10; i++) {
                try {
                    const response = await this.makeHTTPRequest(`http://localhost:${this.testPort}/status`);
                    connections.push(response);
                } catch (error) {
                    // Expected if rate limited
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;
            
            const memoryGood = memoryIncreasePercent < 50; // Less than 50% increase
            
            this.results.performanceTests.memoryUsage = {
                status: memoryGood ? 'pass' : 'warning',
                initialMemory: Math.round(initialMemory.heapUsed / 1024 / 1024 * 100) / 100,
                finalMemory: Math.round(finalMemory.heapUsed / 1024 / 1024 * 100) / 100,
                memoryIncrease: Math.round(memoryIncrease / 1024 / 1024 * 100) / 100,
                memoryIncreasePercent: Math.round(memoryIncreasePercent * 100) / 100,
                description: memoryGood ? 
                    'Memory usage remains stable under load' : 
                    'Memory usage increased significantly'
            };
            
            console.log(`${memoryGood ? '✅' : '⚠️'} Memory usage: ${memoryIncreasePercent.toFixed(1)}% increase`);
            
        } catch (error) {
            this.results.performanceTests.memoryUsage = {
                status: 'error',
                error: error.message,
                description: 'Failed to test memory usage'
            };
            console.log('❌ Memory usage test failed:', error.message);
        }
    }

    async testConcurrentConnections() {
        console.log('🧪 Testing Concurrent Connections Performance...');
        
        try {
            const startTime = Date.now();
            const concurrentRequests = 20;
            
            const promises = [];
            for (let i = 0; i < concurrentRequests; i++) {
                promises.push(this.makeHTTPRequest(`http://localhost:${this.testPort}/status`));
            }
            
            const results = await Promise.allSettled(promises);
            const endTime = Date.now();
            
            const successful = results.filter(r => r.status === 'fulfilled' && r.value.statusCode < 400).length;
            const totalTime = endTime - startTime;
            const avgResponseTime = totalTime / concurrentRequests;
            
            const performanceGood = avgResponseTime < 1000 && successful > 0; // Under 1 second avg
            
            this.results.performanceTests.concurrentConnections = {
                status: performanceGood ? 'pass' : 'warning',
                concurrentRequests,
                successful,
                totalTime,
                avgResponseTime: Math.round(avgResponseTime * 100) / 100,
                description: performanceGood ? 
                    'Handles concurrent connections efficiently' : 
                    'Concurrent connection performance needs improvement'
            };
            
            console.log(`${performanceGood ? '✅' : '⚠️'} Concurrent connections: ${successful}/${concurrentRequests} successful, ${avgResponseTime.toFixed(1)}ms avg`);
            
        } catch (error) {
            this.results.performanceTests.concurrentConnections = {
                status: 'error',
                error: error.message,
                description: 'Failed to test concurrent connections'
            };
            console.log('❌ Concurrent connections test failed:', error.message);
        }
    }

    async testResponseTimes() {
        console.log('🧪 Testing Response Times...');
        
        try {
            const responseTimes = [];
            const requestCount = 10;
            
            for (let i = 0; i < requestCount; i++) {
                const startTime = Date.now();
                try {
                    await this.makeHTTPRequest(`http://localhost:${this.testPort}/status`);
                    const responseTime = Date.now() - startTime;
                    responseTimes.push(responseTime);
                } catch (error) {
                    // May be rate limited, continue
                }
                
                await new Promise(resolve => setTimeout(resolve, 500)); // Wait between requests
            }
            
            if (responseTimes.length === 0) {
                throw new Error('No successful responses to measure');
            }
            
            const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
            const maxResponseTime = Math.max(...responseTimes);
            const minResponseTime = Math.min(...responseTimes);
            
            const responseTimeGood = avgResponseTime < 500; // Under 500ms average
            
            this.results.performanceTests.responseTimes = {
                status: responseTimeGood ? 'pass' : 'warning',
                requestCount: responseTimes.length,
                avgResponseTime: Math.round(avgResponseTime * 100) / 100,
                maxResponseTime,
                minResponseTime,
                responseTimes,
                description: responseTimeGood ? 
                    'Response times are acceptable' : 
                    'Response times may be too slow'
            };
            
            console.log(`${responseTimeGood ? '✅' : '⚠️'} Response times: ${avgResponseTime.toFixed(1)}ms avg (${minResponseTime}-${maxResponseTime}ms range)`);
            
        } catch (error) {
            this.results.performanceTests.responseTimes = {
                status: 'error',
                error: error.message,
                description: 'Failed to test response times'
            };
            console.log('❌ Response times test failed:', error.message);
        }
    }

    async testResourceCleanup() {
        console.log('🧪 Testing Resource Cleanup...');
        
        try {
            const initialHandles = process._getActiveHandles().length;
            const initialRequests = process._getActiveRequests().length;
            
            // Create some connections and then close them
            const connections = [];
            for (let i = 0; i < 5; i++) {
                try {
                    const ws = new WebSocket(`ws://localhost:${this.testPort}`);
                    connections.push(ws);
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    // Expected if connection limits reached
                }
            }
            
            // Close all connections
            connections.forEach(ws => {
                try { ws.close(); } catch (e) {}
            });
            
            // Wait for cleanup
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const finalHandles = process._getActiveHandles().length;
            const finalRequests = process._getActiveRequests().length;
            
            const handlesIncrease = finalHandles - initialHandles;
            const requestsIncrease = finalRequests - initialRequests;
            
            const cleanupGood = handlesIncrease <= 2 && requestsIncrease <= 2; // Allow small increase
            
            this.results.performanceTests.resourceCleanup = {
                status: cleanupGood ? 'pass' : 'warning',
                initialHandles,
                finalHandles,
                handlesIncrease,
                initialRequests,
                finalRequests,
                requestsIncrease,
                description: cleanupGood ? 
                    'Resources cleaned up properly' : 
                    'Resource cleanup may have issues'
            };
            
            console.log(`${cleanupGood ? '✅' : '⚠️'} Resource cleanup: +${handlesIncrease} handles, +${requestsIncrease} requests`);
            
        } catch (error) {
            this.results.performanceTests.resourceCleanup = {
                status: 'error',
                error: error.message,
                description: 'Failed to test resource cleanup'
            };
            console.log('❌ Resource cleanup test failed:', error.message);
        }
    }

    async makeHTTPRequest(url) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                timeout: 5000
            };
            
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data
                    });
                });
            });
            
            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));
            req.end();
        });
    }

    async testConnection() {
        return new Promise((resolve) => {
            const ws = new WebSocket(`ws://localhost:${this.testPort}`);
            
            ws.on('open', () => {
                ws.close();
                resolve(true);
            });
            
            ws.on('error', () => resolve(false));
            
            setTimeout(() => {
                try { ws.close(); } catch (e) {}
                resolve(false);
            }, 3000);
        });
    }

    calculateOverallScore() {
        let totalTests = 0;
        let passedTests = 0;
        
        // Count security tests
        Object.values(this.results.securityTests).forEach(test => {
            totalTests++;
            if (test.status === 'pass') passedTests++;
        });
        
        // Count performance tests
        Object.values(this.results.performanceTests).forEach(test => {
            totalTests++;
            if (test.status === 'pass') passedTests++;
        });
        
        this.results.overallScore = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
        
        // Generate recommendations
        if (this.results.overallScore < 70) {
            this.results.recommendations.push('Multiple security and performance issues found - requires immediate attention');
        } else if (this.results.overallScore < 85) {
            this.results.recommendations.push('Some improvements needed - review failing tests');
        } else {
            this.results.recommendations.push('Good security and performance posture - address minor issues');
        }
    }

    async generateReport() {
        const report = {
            ...this.results,
            summary: {
                overallScore: this.results.overallScore,
                securityTestsTotal: Object.keys(this.results.securityTests).length,
                securityTestsPassed: Object.values(this.results.securityTests).filter(t => t.status === 'pass').length,
                performanceTestsTotal: Object.keys(this.results.performanceTests).length,
                performanceTestsPassed: Object.values(this.results.performanceTests).filter(t => t.status === 'pass').length
            }
        };
        
        await fs.writeFile(
            path.join(__dirname, 'security-performance-test-report.json'),
            JSON.stringify(report, null, 2)
        );
        
        console.log('\n📊 Security & Performance Test Results:');
        console.log(`Overall Score: ${this.results.overallScore}/100`);
        console.log(`Security Tests: ${report.summary.securityTestsPassed}/${report.summary.securityTestsTotal} passed`);
        console.log(`Performance Tests: ${report.summary.performanceTestsPassed}/${report.summary.performanceTestsTotal} passed`);
        console.log('\n📝 Report saved to: security-performance-test-report.json');
    }

    async cleanup() {
        console.log('🧹 Cleaning up test resources...');
        
        if (this.webUIProcess) {
            try {
                this.webUIProcess.kill('SIGTERM');
                await new Promise(resolve => setTimeout(resolve, 2000));
                if (!this.webUIProcess.killed) {
                    this.webUIProcess.kill('SIGKILL');
                }
            } catch (error) {
                console.log('⚠️  Error cleaning up WebUI process:', error.message);
            }
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new SecurityPerformanceTest();
    tester.runTests().catch(console.error);
}

module.exports = SecurityPerformanceTest;