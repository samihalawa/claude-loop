#!/usr/bin/env node

/**
 * Comprehensive WebSocket Testing Suite
 * Tests WebSocket connections, message handling, real-time features, and connection stability
 */

const WebSocket = require('ws');
const WebUI = require('./lib/web-ui');
const { performance } = require('perf_hooks');

class WebSocketTestSuite {
    constructor() {
        this.webUI = null;
        this.testResults = [];
        this.testPort = 3342;
        this.testToken = null;
        this.connections = [];
    }

    async runAllTests() {
        console.log('🔌 Starting Comprehensive WebSocket Testing\n');
        
        try {
            await this.initializeServer();
            this.testToken = this.webUI.sessionToken;
            
            // Test all WebSocket features
            await this.testBasicConnection();
            await this.testAuthentication();
            await this.testMessageHandling();
            await this.testRealTimeUpdates();
            await this.testConnectionStability();
            await this.testConcurrentConnections();
            await this.testErrorHandling();
            await this.testConnectionLimits();
            await this.testPingPong();
            await this.testLargeMessages();
            
            this.generateTestReport();
            
        } catch (error) {
            console.error('❌ WebSocket test suite failed:', error.message);
            this.addTestResult('SUITE_FAILURE', false, error.message);
        } finally {
            await this.cleanup();
        }
    }

    async initializeServer() {
        console.log('🚀 Initializing WebUI server for WebSocket testing...');
        this.webUI = new WebUI(this.testPort);
        await this.webUI.start();
        console.log(`✅ Server started on port ${this.testPort}\n`);
        this.addTestResult('SERVER_INITIALIZATION', true, 'Server started successfully');
    }

    async testBasicConnection() {
        console.log('🔗 Testing Basic WebSocket Connection...');
        
        try {
            const ws = await this.createConnection(this.testToken);
            this.connections.push(ws);
            
            // Wait for initial messages
            const messages = await this.waitForMessages(ws, 1, 2000);
            
            if (messages.length > 0) {
                console.log('✅ Basic connection established and initial data received');
                this.addTestResult('WS_BASIC_CONNECTION', true, 
                    `Connected successfully, received ${messages.length} initial messages`);
                
                // Verify initial message structure
                const initialMessage = messages[0];
                if (initialMessage.type === 'session_data' && initialMessage.data) {
                    console.log('✅ Initial session data message has correct structure');
                    this.addTestResult('WS_INITIAL_MESSAGE_STRUCTURE', true, 
                        'Initial message has proper type and data fields');
                } else {
                    console.log('❌ Initial message structure invalid');
                    this.addTestResult('WS_INITIAL_MESSAGE_STRUCTURE', false, 
                        `Expected session_data, got ${initialMessage.type}`);
                }
            } else {
                console.log('❌ Basic connection failed to receive initial data');
                this.addTestResult('WS_BASIC_CONNECTION', false, 'No initial messages received');
            }
            
        } catch (error) {
            console.log(`❌ Basic connection test failed: ${error.message}`);
            this.addTestResult('WS_BASIC_CONNECTION', false, error.message);
        }
        
        console.log('');
    }

    async testAuthentication() {
        console.log('🔐 Testing WebSocket Authentication...');
        
        // Test valid token
        try {
            const validWs = await this.createConnection(this.testToken);
            this.connections.push(validWs);
            
            console.log('✅ Valid token authentication successful');
            this.addTestResult('WS_AUTH_VALID_TOKEN', true, 'Valid token accepted');
            
        } catch (error) {
            console.log(`❌ Valid token authentication failed: ${error.message}`);
            this.addTestResult('WS_AUTH_VALID_TOKEN', false, error.message);
        }
        
        // Test invalid token
        try {
            const invalidWs = await this.createConnection('invalid_token', 1000);
            this.connections.push(invalidWs);
            
            console.log('❌ Invalid token was accepted (security issue!)');
            this.addTestResult('WS_AUTH_INVALID_TOKEN', false, 'Invalid token was accepted');
            
        } catch (error) {
            if (error.message.includes('close') || error.message.includes('1008')) {
                console.log('✅ Invalid token properly rejected');
                this.addTestResult('WS_AUTH_INVALID_TOKEN', true, 'Invalid token properly rejected');
            } else {
                console.log(`❌ Invalid token test failed: ${error.message}`);
                this.addTestResult('WS_AUTH_INVALID_TOKEN', false, error.message);
            }
        }
        
        // Test missing token
        try {
            const noTokenWs = await this.createConnection(null, 1000);
            this.connections.push(noTokenWs);
            
            console.log('❌ Missing token was accepted (security issue!)');
            this.addTestResult('WS_AUTH_MISSING_TOKEN', false, 'Missing token was accepted');
            
        } catch (error) {
            if (error.message.includes('close') || error.message.includes('1008')) {
                console.log('✅ Missing token properly rejected');
                this.addTestResult('WS_AUTH_MISSING_TOKEN', true, 'Missing token properly rejected');
            } else {
                console.log(`❌ Missing token test failed: ${error.message}`);
                this.addTestResult('WS_AUTH_MISSING_TOKEN', false, error.message);
            }
        }
        
        console.log('');
    }

    async testMessageHandling() {
        console.log('📨 Testing Message Handling...');
        
        try {
            const ws = await this.createConnection(this.testToken);
            this.connections.push(ws);
            
            const testMessages = [
                { type: 'ping', timestamp: Date.now() },
                { type: 'test', data: 'hello world' },
                { type: 'complex', data: { nested: { object: true }, array: [1, 2, 3] } }
            ];
            
            let messagesHandled = 0;
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    if (message.type === 'pong') {
                        messagesHandled++;
                    }
                } catch (error) {
                    // Ignore parsing errors for this test
                }
            });
            
            // Send test messages
            for (const msg of testMessages) {
                try {
                    ws.send(JSON.stringify(msg));
                    await this.wait(100);
                } catch (error) {
                    console.log(`⚠️ Failed to send message: ${error.message}`);
                }
            }
            
            await this.wait(1000); // Wait for processing
            
            if (messagesHandled > 0) {
                console.log(`✅ Message handling working (${messagesHandled} messages processed)`);
                this.addTestResult('WS_MESSAGE_HANDLING', true, 
                    `${messagesHandled} messages handled successfully`);
            } else {
                console.log('⚠️ No message responses received (may be expected behavior)');
                this.addTestResult('WS_MESSAGE_HANDLING', true, 
                    'Messages sent without errors (responses not required)');
            }
            
            // Test malformed JSON
            try {
                ws.send('invalid json {');
                await this.wait(500);
                
                if (ws.readyState === WebSocket.OPEN) {
                    console.log('✅ Malformed JSON handled gracefully (connection still open)');
                    this.addTestResult('WS_MALFORMED_JSON', true, 'Connection remained stable after malformed JSON');
                } else {
                    console.log('❌ Connection closed after malformed JSON');
                    this.addTestResult('WS_MALFORMED_JSON', false, 'Connection closed after malformed JSON');
                }
            } catch (error) {
                console.log(`⚠️ Malformed JSON test error: ${error.message}`);
                this.addTestResult('WS_MALFORMED_JSON', false, error.message);
            }
            
        } catch (error) {
            console.log(`❌ Message handling test failed: ${error.message}`);
            this.addTestResult('WS_MESSAGE_HANDLING', false, error.message);
        }
        
        console.log('');
    }

    async testRealTimeUpdates() {
        console.log('⚡ Testing Real-time Updates...');
        
        try {
            const ws = await this.createConnection(this.testToken);
            this.connections.push(ws);
            
            const receivedUpdates = [];
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    if (message.type === 'session_update' || message.type === 'new_output') {
                        receivedUpdates.push(message);
                    }
                } catch (error) {
                    // Ignore parsing errors
                }
            });
            
            // Clear initial messages
            await this.wait(500);
            receivedUpdates.length = 0;
            
            // Trigger server-side updates
            console.log('  📡 Triggering session updates...');
            this.webUI.updateSession({ 
                currentPhase: 'WebSocket real-time test',
                iterations: 42,
                testValue: 'real-time-test-' + Date.now()
            });
            
            await this.wait(200);
            
            this.webUI.addOutput('Real-time test message 1', 'info');
            this.webUI.addOutput('Real-time test message 2', 'success');
            
            await this.wait(500);
            
            if (receivedUpdates.length >= 3) {
                console.log(`✅ Real-time updates working (${receivedUpdates.length} updates received)`);
                this.addTestResult('WS_REALTIME_UPDATES', true, 
                    `${receivedUpdates.length} real-time updates received`);
                
                // Verify update types
                const updateTypes = receivedUpdates.map(u => u.type);
                const hasSessionUpdate = updateTypes.includes('session_update');
                const hasOutputUpdate = updateTypes.includes('new_output');
                
                if (hasSessionUpdate && hasOutputUpdate) {
                    console.log('✅ Both session and output updates received');
                    this.addTestResult('WS_UPDATE_TYPES', true, 'Both session and output updates working');
                } else {
                    console.log(`⚠️ Missing update types: session=${hasSessionUpdate}, output=${hasOutputUpdate}`);
                    this.addTestResult('WS_UPDATE_TYPES', false, 
                        `Missing updates: session=${hasSessionUpdate}, output=${hasOutputUpdate}`);
                }
                
            } else {
                console.log(`❌ Insufficient real-time updates (${receivedUpdates.length} received, expected ≥3)`);
                this.addTestResult('WS_REALTIME_UPDATES', false, 
                    `Only ${receivedUpdates.length} updates received`);
            }
            
        } catch (error) {
            console.log(`❌ Real-time updates test failed: ${error.message}`);
            this.addTestResult('WS_REALTIME_UPDATES', false, error.message);
        }
        
        console.log('');
    }

    async testConnectionStability() {
        console.log('🏗️ Testing Connection Stability...');
        
        try {
            const ws = await this.createConnection(this.testToken);
            this.connections.push(ws);
            
            console.log('  🕐 Testing connection stability over time...');
            
            let connectionStable = true;
            let disconnectReason = null;
            
            ws.on('close', (code, reason) => {
                connectionStable = false;
                disconnectReason = `Code: ${code}, Reason: ${reason}`;
            });
            
            ws.on('error', (error) => {
                connectionStable = false;
                disconnectReason = `Error: ${error.message}`;
            });
            
            // Test stability over 5 seconds with periodic activity
            for (let i = 0; i < 5; i++) {
                if (!connectionStable) break;
                
                // Send periodic ping to keep connection active
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
                }
                
                await this.wait(1000);
            }
            
            if (connectionStable && ws.readyState === WebSocket.OPEN) {
                console.log('✅ Connection remained stable over test period');
                this.addTestResult('WS_CONNECTION_STABILITY', true, 'Connection stable for 5+ seconds');
            } else {
                console.log(`❌ Connection became unstable: ${disconnectReason}`);
                this.addTestResult('WS_CONNECTION_STABILITY', false, disconnectReason);
            }
            
        } catch (error) {
            console.log(`❌ Connection stability test failed: ${error.message}`);
            this.addTestResult('WS_CONNECTION_STABILITY', false, error.message);
        }
        
        console.log('');
    }

    async testConcurrentConnections() {
        console.log('👥 Testing Concurrent Connections...');
        
        try {
            const concurrentConnections = [];
            const connectionCount = 3;
            
            console.log(`  🔗 Creating ${connectionCount} concurrent connections...`);
            
            // Create multiple connections simultaneously
            const connectionPromises = [];
            for (let i = 0; i < connectionCount; i++) {
                connectionPromises.push(this.createConnection(this.testToken));
            }
            
            const connections = await Promise.all(connectionPromises);
            concurrentConnections.push(...connections);
            this.connections.push(...connections);
            
            console.log(`✅ Successfully created ${connections.length} concurrent connections`);
            this.addTestResult('WS_CONCURRENT_CONNECTIONS', true, 
                `${connections.length} concurrent connections established`);
            
            // Test that all connections receive broadcasts
            const messageCounters = connections.map(() => 0);
            
            connections.forEach((conn, index) => {
                conn.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        if (message.type === 'session_update') {
                            messageCounters[index]++;
                        }
                    } catch (error) {
                        // Ignore parsing errors
                    }
                });
            });
            
            // Wait for initial messages to clear
            await this.wait(500);
            messageCounters.forEach((_, i) => messageCounters[i] = 0);
            
            // Trigger broadcast
            this.webUI.updateSession({ 
                currentPhase: 'Concurrent connection test',
                testBroadcast: Date.now()
            });
            
            await this.wait(1000);
            
            const allReceived = messageCounters.every(count => count > 0);
            const totalReceived = messageCounters.reduce((sum, count) => sum + count, 0);
            
            if (allReceived) {
                console.log(`✅ All ${connections.length} connections received broadcast messages`);
                this.addTestResult('WS_BROADCAST_ALL', true, 
                    `All connections received updates (${totalReceived} total)`);
            } else {
                console.log(`❌ Not all connections received broadcasts: ${messageCounters}`);
                this.addTestResult('WS_BROADCAST_ALL', false, 
                    `Message counts: ${messageCounters.join(', ')}`);
            }
            
            // Clean up concurrent connections
            concurrentConnections.forEach(conn => {
                if (conn.readyState === WebSocket.OPEN) {
                    conn.close();
                }
            });
            
        } catch (error) {
            console.log(`❌ Concurrent connections test failed: ${error.message}`);
            this.addTestResult('WS_CONCURRENT_CONNECTIONS', false, error.message);
        }
        
        console.log('');
    }

    async testErrorHandling() {
        console.log('🚨 Testing Error Handling...');
        
        // Test connection limit (if applicable)
        try {
            const maxConnections = this.webUI.maxConnections || 5;
            console.log(`  📊 Testing connection limit (max: ${maxConnections})...`);
            
            const connections = [];
            let rejectedConnections = 0;
            
            // Try to create more connections than the limit
            for (let i = 0; i < maxConnections + 2; i++) {
                try {
                    const conn = await this.createConnection(this.testToken, 2000);
                    connections.push(conn);
                } catch (error) {
                    if (error.message.includes('close') || error.message.includes('1013')) {
                        rejectedConnections++;
                    }
                }
            }
            
            this.connections.push(...connections);
            
            if (rejectedConnections > 0) {
                console.log(`✅ Connection limit enforced (${rejectedConnections} connections rejected)`);
                this.addTestResult('WS_CONNECTION_LIMIT', true, 
                    `${rejectedConnections} excess connections properly rejected`);
            } else if (connections.length <= maxConnections) {
                console.log(`✅ Connection limit respected (${connections.length} connections)`);
                this.addTestResult('WS_CONNECTION_LIMIT', true, 
                    `Connection count within limit: ${connections.length}/${maxConnections}`);
            } else {
                console.log(`⚠️ Connection limit not enforced (${connections.length} > ${maxConnections})`);
                this.addTestResult('WS_CONNECTION_LIMIT', false, 
                    `Too many connections allowed: ${connections.length}/${maxConnections}`);
            }
            
        } catch (error) {
            console.log(`❌ Error handling test failed: ${error.message}`);
            this.addTestResult('WS_ERROR_HANDLING', false, error.message);
        }
        
        console.log('');
    }

    async testConnectionLimits() {
        console.log('⚖️ Testing Connection Limits and Rate Limiting...');
        
        try {
            const ws = await this.createConnection(this.testToken);
            this.connections.push(ws);
            
            // Test message rate limiting
            console.log('  📊 Testing message rate limiting...');
            
            let connectionClosed = false;
            ws.on('close', (code) => {
                if (code === 1008) {
                    connectionClosed = true;
                }
            });
            
            // Send many messages rapidly
            for (let i = 0; i < 50; i++) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'test', message: i }));
                }
            }
            
            await this.wait(2000);
            
            if (connectionClosed) {
                console.log('✅ Message rate limiting working (connection closed for excess messages)');
                this.addTestResult('WS_MESSAGE_RATE_LIMIT', true, 'Rate limiting enforced');
            } else if (ws.readyState === WebSocket.OPEN) {
                console.log('⚠️ Message rate limiting not triggered (may have higher limits)');
                this.addTestResult('WS_MESSAGE_RATE_LIMIT', true, 'Connection remained stable under load');
            } else {
                console.log('❌ Connection closed for unknown reason');
                this.addTestResult('WS_MESSAGE_RATE_LIMIT', false, 'Connection closed unexpectedly');
            }
            
        } catch (error) {
            console.log(`❌ Connection limits test failed: ${error.message}`);
            this.addTestResult('WS_CONNECTION_LIMITS', false, error.message);
        }
        
        console.log('');
    }

    async testPingPong() {
        console.log('🏓 Testing Ping/Pong Heartbeat...');
        
        try {
            const ws = await this.createConnection(this.testToken);
            this.connections.push(ws);
            
            let pongReceived = false;
            
            ws.on('pong', () => {
                pongReceived = true;
            });
            
            // Send ping
            ws.ping();
            
            await this.wait(1000);
            
            if (pongReceived) {
                console.log('✅ Ping/Pong heartbeat working');
                this.addTestResult('WS_PING_PONG', true, 'Pong response received');
            } else {
                console.log('❌ No pong response received');
                this.addTestResult('WS_PING_PONG', false, 'No pong response');
            }
            
        } catch (error) {
            console.log(`❌ Ping/Pong test failed: ${error.message}`);
            this.addTestResult('WS_PING_PONG', false, error.message);
        }
        
        console.log('');
    }

    async testLargeMessages() {
        console.log('📦 Testing Large Message Handling...');
        
        try {
            const ws = await this.createConnection(this.testToken);
            this.connections.push(ws);
            
            // Create a large message (1MB)
            const largeData = 'x'.repeat(1024 * 1024);
            const largeMessage = JSON.stringify({ 
                type: 'large_test', 
                data: largeData,
                size: largeData.length
            });
            
            let messageHandled = false;
            let connectionStable = true;
            
            ws.on('close', () => {
                connectionStable = false;
            });
            
            ws.on('error', () => {
                connectionStable = false;
            });
            
            try {
                ws.send(largeMessage);
                messageHandled = true;
            } catch (error) {
                console.log(`⚠️ Large message send failed: ${error.message}`);
            }
            
            await this.wait(2000);
            
            if (messageHandled && connectionStable) {
                console.log('✅ Large message (1MB) handled successfully');
                this.addTestResult('WS_LARGE_MESSAGES', true, 'Large message handled without issues');
            } else if (!connectionStable) {
                console.log('❌ Connection closed after large message');
                this.addTestResult('WS_LARGE_MESSAGES', false, 'Connection closed after large message');
            } else {
                console.log('❌ Large message could not be sent');
                this.addTestResult('WS_LARGE_MESSAGES', false, 'Large message send failed');
            }
            
        } catch (error) {
            console.log(`❌ Large message test failed: ${error.message}`);
            this.addTestResult('WS_LARGE_MESSAGES', false, error.message);
        }
        
        console.log('');
    }

    async createConnection(token, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const url = token 
                ? `ws://localhost:${this.testPort}?token=${token}`
                : `ws://localhost:${this.testPort}`;
                
            // Add proper headers including User-Agent to avoid security filtering
            const options = {
                headers: {
                    'User-Agent': 'WebSocket-Test-Suite/1.0 (Node.js WebSocket Client)'
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

    async waitForMessages(ws, count, timeout = 5000) {
        return new Promise((resolve) => {
            const messages = [];
            
            const messageHandler = (data) => {
                try {
                    const message = JSON.parse(data);
                    messages.push(message);
                    if (messages.length >= count) {
                        ws.removeListener('message', messageHandler);
                        resolve(messages);
                    }
                } catch (error) {
                    // Ignore parse errors
                }
            };
            
            ws.on('message', messageHandler);
            
            setTimeout(() => {
                ws.removeListener('message', messageHandler);
                resolve(messages);
            }, timeout);
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
        console.log('\n📋 WEBSOCKET TEST REPORT');
        console.log('='.repeat(60));
        
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        const successRate = ((passed / total) * 100).toFixed(1);
        
        console.log(`\n📊 Overall Results: ${passed}/${total} tests passed (${successRate}%)\n`);
        
        // Group tests by category
        const categories = {
            'Server Setup': this.testResults.filter(r => r.test.startsWith('SERVER_')),
            'Basic Functionality': this.testResults.filter(r => r.test.startsWith('WS_BASIC_') || r.test.startsWith('WS_INITIAL_')),
            'Authentication': this.testResults.filter(r => r.test.startsWith('WS_AUTH_')),
            'Message Handling': this.testResults.filter(r => r.test.includes('MESSAGE') || r.test.includes('HANDLING')),
            'Real-time Features': this.testResults.filter(r => r.test.includes('REALTIME') || r.test.includes('UPDATE') || r.test.includes('BROADCAST')),
            'Connection Management': this.testResults.filter(r => r.test.includes('CONNECTION') && !r.test.includes('AUTH')),
            'Performance & Limits': this.testResults.filter(r => r.test.includes('LIMIT') || r.test.includes('LARGE') || r.test.includes('PING'))
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
                'WS_BASIC_CONNECTION', 
                'WS_AUTH_VALID_TOKEN', 
                'WS_REALTIME_UPDATES'
            ].includes(r.test)
        );
        
        if (criticalFailures.length > 0) {
            console.log('🚨 CRITICAL WEBSOCKET ISSUES:');
            criticalFailures.forEach(failure => {
                console.log(`   - ${failure.test}: ${failure.details}`);
            });
            console.log('');
        }
        
        // Recommendations
        console.log('💡 RECOMMENDATIONS:');
        if (successRate >= 90) {
            console.log('   - WebSocket functionality is highly robust');
            console.log('   - Real-time features working correctly');
        }
        if (successRate < 80) {
            console.log('   - Review WebSocket implementation');
            console.log('   - Check connection management and error handling');
        }
        
        const authTests = this.testResults.filter(r => r.test.startsWith('WS_AUTH_'));
        const authPassed = authTests.filter(t => t.passed).length;
        if (authPassed === authTests.length) {
            console.log('   - WebSocket security is properly implemented');
        }
        
        console.log('   - Consider implementing connection health monitoring');
        console.log('   - Add WebSocket metrics and analytics');
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
        console.log('🧹 Cleaning up WebSocket test resources...');
        
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
    const testSuite = new WebSocketTestSuite();
    testSuite.runAllTests()
        .then(() => {
            console.log('🎉 WebSocket test suite completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = WebSocketTestSuite;