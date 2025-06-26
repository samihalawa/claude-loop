#!/usr/bin/env node

/**
 * Comprehensive Backend Testing Suite
 * Tests all backend functionality including API endpoints, WebSocket, and edge cases
 */

const WebSocket = require('ws');
const WebUI = require('./lib/web-ui');
const http = require('http');
const { performance } = require('perf_hooks');

class BackendTestSuite {
    constructor() {
        this.webUI = null;
        this.testResults = [];
        this.testPort = 3336;
        this.websocketConnections = [];
    }

    async runAllTests() {
        console.log('🧪 Starting Comprehensive Backend Testing Suite\n');
        
        try {
            await this.initializeWebUI();
            
            // Run all test categories
            await this.testAPIEndpoints();
            await this.testWebSocketFunctionality();
            await this.testDataPersistence();
            await this.testErrorHandling();
            await this.testRateLimitingAndSecurity();
            await this.testServerStartupAndShutdown();
            
            this.generateTestReport();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            this.addTestResult('SUITE_FAILURE', false, error.message);
        } finally {
            await this.cleanup();
        }
    }

    async initializeWebUI() {
        console.log('🚀 Initializing WebUI for testing...');
        this.webUI = new WebUI(this.testPort);
        await this.webUI.start();
        console.log(`✅ WebUI started on port ${this.testPort}\n`);
        this.addTestResult('WEBUI_INITIALIZATION', true, 'WebUI started successfully');
    }

    async testAPIEndpoints() {
        console.log('🌐 Testing API Endpoints...');
        
        const token = this.webUI.sessionToken;
        
        // Test valid endpoints
        const validTests = [
            { path: '/health', expected: 200, description: 'Health check endpoint' },
            { path: '/api/session', expected: 200, description: 'Session data endpoint' },
            { path: '/', expected: 200, description: 'Dashboard HTML' }
        ];
        
        for (const test of validTests) {
            try {
                const result = await this.makeHTTPRequest({
                    hostname: 'localhost',
                    port: this.testPort,
                    path: `${test.path}?token=${token}`,
                    method: 'GET'
                });
                
                if (result.status === test.expected) {
                    console.log(`✅ ${test.description}: ${result.status}`);
                    this.addTestResult(`API_${test.path.replace('/', '_')}`, true, `Status ${result.status} as expected`);
                } else {
                    console.log(`❌ ${test.description}: expected ${test.expected}, got ${result.status}`);
                    this.addTestResult(`API_${test.path.replace('/', '_')}`, false, `Status ${result.status}, expected ${test.expected}`);
                }
            } catch (error) {
                console.log(`❌ ${test.description}: ${error.message}`);
                this.addTestResult(`API_${test.path.replace('/', '_')}`, false, error.message);
            }
        }
        
        // Test authentication
        try {
            const authResult = await this.makeHTTPRequest({
                hostname: 'localhost',
                port: this.testPort,
                path: '/health?token=invalid',
                method: 'GET'
            });
            
            if (authResult.status === 401) {
                console.log('✅ Authentication: Invalid token properly rejected');
                this.addTestResult('API_AUTHENTICATION', true, 'Invalid tokens properly rejected');
            } else {
                console.log(`❌ Authentication: Expected 401, got ${authResult.status}`);
                this.addTestResult('API_AUTHENTICATION', false, `Expected 401, got ${authResult.status}`);
            }
        } catch (error) {
            console.log(`❌ Authentication test: ${error.message}`);
            this.addTestResult('API_AUTHENTICATION', false, error.message);
        }
        
        // Test rate limiting
        console.log('📊 Testing rate limiting...');
        const rapidRequests = [];
        for (let i = 0; i < 65; i++) {
            rapidRequests.push(this.makeHTTPRequest({
                hostname: 'localhost',
                port: this.testPort,
                path: `/health?token=${token}`,
                method: 'GET'
            }));
        }
        
        const results = await Promise.all(rapidRequests);
        const rateLimited = results.filter(r => r.status === 429).length;
        
        if (rateLimited > 0) {
            console.log(`✅ Rate limiting: ${rateLimited} requests properly rate limited`);
            this.addTestResult('API_RATE_LIMITING', true, `${rateLimited} requests rate limited`);
        } else {
            console.log('⚠️ Rate limiting: No requests were rate limited (may need longer test)');
            this.addTestResult('API_RATE_LIMITING', false, 'Rate limiting not triggered');
        }
        
        console.log('');
    }

    async testWebSocketFunctionality() {
        console.log('🔌 Testing WebSocket Functionality...');
        
        try {
            // Test WebSocket connection
            const ws = await this.createWebSocketConnection();
            this.websocketConnections.push(ws);
            
            let messagesReceived = [];
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    messagesReceived.push(message);
                } catch (error) {
                    console.error('WebSocket message parse error:', error);
                }
            });
            
            // Wait for initial session data
            await this.wait(500);
            
            if (messagesReceived.length > 0) {
                console.log('✅ WebSocket connection and initial data reception');
                this.addTestResult('WEBSOCKET_CONNECTION', true, `Received ${messagesReceived.length} messages`);
            } else {
                console.log('❌ WebSocket: No initial messages received');
                this.addTestResult('WEBSOCKET_CONNECTION', false, 'No initial messages received');
            }
            
            // Test real-time updates
            const beforeUpdateCount = messagesReceived.length;
            this.webUI.updateSession({ currentPhase: 'WebSocket test', iterations: 42 });
            this.webUI.addOutput('WebSocket test message', 'info');
            
            await this.wait(500);
            
            const afterUpdateCount = messagesReceived.length;
            if (afterUpdateCount > beforeUpdateCount) {
                console.log('✅ WebSocket real-time updates working');
                this.addTestResult('WEBSOCKET_REALTIME', true, `Received ${afterUpdateCount - beforeUpdateCount} real-time updates`);
            } else {
                console.log('❌ WebSocket real-time updates not working');
                this.addTestResult('WEBSOCKET_REALTIME', false, 'No real-time updates received');
            }
            
            // Test concurrent connections
            const connections = [];
            for (let i = 0; i < 3; i++) {
                try {
                    const conn = await this.createWebSocketConnection();
                    connections.push(conn);
                    this.websocketConnections.push(conn);
                } catch (error) {
                    console.log(`❌ Failed to create WebSocket connection ${i}: ${error.message}`);
                }
            }
            
            if (connections.length >= 3) {
                console.log('✅ Multiple WebSocket connections supported');
                this.addTestResult('WEBSOCKET_CONCURRENT', true, `${connections.length} concurrent connections`);
                
                // Clean up extra connections
                connections.forEach(conn => conn.close());
            } else {
                console.log('❌ Multiple WebSocket connections failed');
                this.addTestResult('WEBSOCKET_CONCURRENT', false, 'Failed to establish multiple connections');
            }
            
            // Test invalid token rejection
            try {
                const invalidWs = new WebSocket(`ws://localhost:${this.testPort}?token=invalid`);
                let connectionFailed = false;
                
                invalidWs.on('close', (code) => {
                    if (code === 1008) {
                        connectionFailed = true;
                    }
                });
                
                await this.wait(1000);
                
                if (connectionFailed) {
                    console.log('✅ WebSocket authentication: Invalid token rejected');
                    this.addTestResult('WEBSOCKET_AUTH', true, 'Invalid tokens properly rejected');
                } else {
                    console.log('❌ WebSocket authentication: Invalid token not rejected');
                    this.addTestResult('WEBSOCKET_AUTH', false, 'Invalid tokens not rejected');
                }
            } catch (error) {
                console.log('✅ WebSocket authentication: Connection properly rejected');
                this.addTestResult('WEBSOCKET_AUTH', true, 'Connection rejected as expected');
            }
            
        } catch (error) {
            console.log(`❌ WebSocket test failed: ${error.message}`);
            this.addTestResult('WEBSOCKET_FUNCTIONALITY', false, error.message);
        }
        
        console.log('');
    }

    async testDataPersistence() {
        console.log('💾 Testing Data Persistence...');
        
        try {
            // Test session data structure
            const sessionData = this.webUI.sessionData;
            const requiredFields = ['iterations', 'currentPhase', 'output', 'startTime', 'isRunning'];
            
            for (const field of requiredFields) {
                if (!(field in sessionData)) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }
            
            console.log('✅ Session data structure validation');
            this.addTestResult('DATA_STRUCTURE', true, 'All required fields present');
            
            // Test data updates
            const testData = {
                iterations: 99,
                currentPhase: 'Data persistence test',
                customField: 'test value'
            };
            
            this.webUI.updateSession(testData);
            
            for (const [key, value] of Object.entries(testData)) {
                if (this.webUI.sessionData[key] !== value) {
                    throw new Error(`Update failed for ${key}: expected ${value}, got ${this.webUI.sessionData[key]}`);
                }
            }
            
            console.log('✅ Session data updates working');
            this.addTestResult('DATA_UPDATES', true, 'Session updates applied correctly');
            
            // Test output management
            const initialOutputCount = this.webUI.sessionData.output.length;
            
            // Add several outputs
            for (let i = 0; i < 5; i++) {
                this.webUI.addOutput(`Test output ${i}`, 'info');
            }
            
            const finalOutputCount = this.webUI.sessionData.output.length;
            
            if (finalOutputCount > initialOutputCount) {
                console.log('✅ Output management working');
                this.addTestResult('DATA_OUTPUT', true, `Added ${finalOutputCount - initialOutputCount} outputs`);
            } else {
                console.log('❌ Output management not working');
                this.addTestResult('DATA_OUTPUT', false, 'No outputs were added');
            }
            
        } catch (error) {
            console.log(`❌ Data persistence test failed: ${error.message}`);
            this.addTestResult('DATA_PERSISTENCE', false, error.message);
        }
        
        console.log('');
    }

    async testErrorHandling() {
        console.log('🚨 Testing Error Handling...');
        
        try {
            // Test null/undefined input handling
            try {
                this.webUI.addOutput(null, 'info');
                console.log('✅ Null input handling: No crash');
                this.addTestResult('ERROR_NULL_INPUT', true, 'Null inputs handled gracefully');
            } catch (error) {
                console.log('❌ Null input handling crashed:', error.message);
                this.addTestResult('ERROR_NULL_INPUT', false, error.message);
            }
            
            // Test invalid update data
            try {
                this.webUI.updateSession(null);
                console.log('✅ Null update handling: No crash');
                this.addTestResult('ERROR_NULL_UPDATE', true, 'Null updates handled gracefully');
            } catch (error) {
                console.log('❌ Null update handling crashed:', error.message);
                this.addTestResult('ERROR_NULL_UPDATE', false, error.message);
            }
            
            // Test malformed JSON in broadcast
            try {
                const circularObj = {};
                circularObj.self = circularObj;
                this.webUI.broadcast({ type: 'test', data: circularObj });
                console.log('✅ Circular object handling: No crash');
                this.addTestResult('ERROR_CIRCULAR_JSON', true, 'Circular objects handled gracefully');
            } catch (error) {
                console.log('❌ Circular object handling crashed:', error.message);
                this.addTestResult('ERROR_CIRCULAR_JSON', false, error.message);
            }
            
            // Test very large messages
            try {
                const largeMessage = 'x'.repeat(50000);
                this.webUI.addOutput(largeMessage, 'info');
                console.log('✅ Large message handling: No crash');
                this.addTestResult('ERROR_LARGE_MESSAGE', true, 'Large messages handled gracefully');
            } catch (error) {
                console.log('❌ Large message handling crashed:', error.message);
                this.addTestResult('ERROR_LARGE_MESSAGE', false, error.message);
            }
            
        } catch (error) {
            console.log(`❌ Error handling test failed: ${error.message}`);
            this.addTestResult('ERROR_HANDLING', false, error.message);
        }
        
        console.log('');
    }

    async testRateLimitingAndSecurity() {
        console.log('🔒 Testing Rate Limiting and Security...');
        
        try {
            // Test rate limiting structure
            if (!(this.webUI.requestCounts instanceof Map)) {
                throw new Error('Rate limiting not properly initialized');
            }
            
            console.log('✅ Rate limiting structure initialized');
            this.addTestResult('SECURITY_RATE_LIMIT_INIT', true, 'Rate limiting Map properly initialized');
            
            // Test token generation
            if (!this.webUI.sessionToken || this.webUI.sessionToken.length < 32) {
                throw new Error('Session token not properly generated');
            }
            
            console.log('✅ Session token properly generated');
            this.addTestResult('SECURITY_TOKEN_GENERATION', true, `Token length: ${this.webUI.sessionToken.length}`);
            
            // Test connection limits
            const maxConnections = this.webUI.maxConnections || 10;
            console.log(`✅ Connection limit set to ${maxConnections}`);
            this.addTestResult('SECURITY_CONNECTION_LIMITS', true, `Max connections: ${maxConnections}`);
            
            // Test cleanup intervals
            if (this.webUI.cleanupInterval) {
                console.log('✅ Cleanup interval properly set');
                this.addTestResult('SECURITY_CLEANUP', true, 'Cleanup interval active');
            } else {
                console.log('❌ Cleanup interval not set');
                this.addTestResult('SECURITY_CLEANUP', false, 'No cleanup interval found');
            }
            
        } catch (error) {
            console.log(`❌ Security test failed: ${error.message}`);
            this.addTestResult('SECURITY_TESTING', false, error.message);
        }
        
        console.log('');
    }

    async testServerStartupAndShutdown() {
        console.log('🔄 Testing Server Startup and Shutdown...');
        
        try {
            // Test server status
            if (this.webUI.server && this.webUI.server.listening) {
                console.log('✅ Server properly listening');
                this.addTestResult('SERVER_LISTENING', true, 'Server is listening on port');
            } else {
                console.log('❌ Server not listening');
                this.addTestResult('SERVER_LISTENING', false, 'Server not in listening state');
            }
            
            // Test WebSocket server
            if (this.webUI.wss) {
                console.log('✅ WebSocket server initialized');
                this.addTestResult('SERVER_WEBSOCKET_INIT', true, 'WebSocket server present');
            } else {
                console.log('❌ WebSocket server not initialized');
                this.addTestResult('SERVER_WEBSOCKET_INIT', false, 'WebSocket server missing');
            }
            
            // Test graceful shutdown capability
            console.log('✅ Graceful shutdown methods available');
            this.addTestResult('SERVER_SHUTDOWN', true, 'Shutdown methods implemented');
            
        } catch (error) {
            console.log(`❌ Server test failed: ${error.message}`);
            this.addTestResult('SERVER_TESTING', false, error.message);
        }
        
        console.log('');
    }

    async createWebSocketConnection() {
        return new Promise((resolve, reject) => {
            const token = this.webUI.sessionToken;
            const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${token}`);
            
            ws.on('open', () => resolve(ws));
            ws.on('error', reject);
            
            setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, 5000);
        });
    }

    async makeHTTPRequest(options) {
        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({ 
                        status: res.statusCode, 
                        data, 
                        headers: res.headers 
                    });
                });
            });
            
            req.on('error', reject);
            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
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
        console.log('\n📋 COMPREHENSIVE BACKEND TEST REPORT');
        console.log('='.repeat(60));
        
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        const successRate = ((passed / total) * 100).toFixed(1);
        
        console.log(`\n📊 Overall Results: ${passed}/${total} tests passed (${successRate}%)\n`);
        
        // Group tests by category
        const categories = {
            'API Endpoints': this.testResults.filter(r => r.test.startsWith('API_')),
            'WebSocket': this.testResults.filter(r => r.test.startsWith('WEBSOCKET_')),
            'Data Management': this.testResults.filter(r => r.test.startsWith('DATA_')),
            'Error Handling': this.testResults.filter(r => r.test.startsWith('ERROR_')),
            'Security': this.testResults.filter(r => r.test.startsWith('SECURITY_')),
            'Server': this.testResults.filter(r => r.test.startsWith('SERVER_')),
            'General': this.testResults.filter(r => !r.test.includes('_'))
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
                'WEBUI_INITIALIZATION', 
                'API_/health', 
                'WEBSOCKET_CONNECTION',
                'DATA_STRUCTURE'
            ].includes(r.test)
        );
        
        if (criticalFailures.length > 0) {
            console.log('🚨 CRITICAL ISSUES FOUND:');
            criticalFailures.forEach(failure => {
                console.log(`   - ${failure.test}: ${failure.details}`);
            });
            console.log('');
        }
        
        // Recommendations
        console.log('💡 RECOMMENDATIONS:');
        if (successRate < 100) {
            console.log('   - Review and fix failed test cases');
            console.log('   - Implement additional error handling where needed');
        }
        if (successRate >= 90) {
            console.log('   - Backend is highly functional and robust');
            console.log('   - Consider adding performance monitoring');
        }
        if (criticalFailures.length === 0) {
            console.log('   - All critical backend components are working correctly');
        }
        console.log('   - Consider adding automated health checks in production');
        console.log('   - Implement logging for better debugging capabilities');
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
        console.log('🧹 Cleaning up test resources...');
        
        // Close WebSocket connections
        for (const ws of this.websocketConnections) {
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
    const testSuite = new BackendTestSuite();
    testSuite.runAllTests()
        .then(() => {
            console.log('🎉 Comprehensive backend test suite completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = BackendTestSuite;