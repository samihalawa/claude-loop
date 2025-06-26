#!/usr/bin/env node

/**
 * Backend Integration Testing Suite
 * Tests integration between Express API and WebSocket functionality
 */

const express = require('express');
const WebSocket = require('ws');
const WebUI = require('./lib/web-ui');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

class BackendIntegrationTestSuite {
    constructor() {
        this.webUI = null;
        this.expressApp = null;
        this.expressServer = null;
        this.testResults = [];
        this.connections = [];
        this.webUIPort = 3340;
        this.apiPort = 3341;
    }

    async runIntegrationTests() {
        console.log('🔗 Starting Backend Integration Testing Suite\n');
        
        try {
            await this.initializeServices();
            
            // Run integration tests
            await this.testAPIWebSocketIntegration();
            await this.testDataFlowBetweenServices();
            await this.testErrorHandlingIntegration();
            await this.testConcurrentAPIAndWebSocket();
            await this.testDataPersistenceAcrossConnections();
            
            this.generateIntegrationReport();
            
        } catch (error) {
            console.error('❌ Integration test suite failed:', error.message);
            this.addTestResult('INTEGRATION_SUITE_FAILURE', false, error.message);
        } finally {
            await this.cleanup();
        }
    }

    async initializeServices() {
        console.log('🚀 Initializing integrated services...');
        
        // Start WebUI
        this.webUI = new WebUI(this.webUIPort);
        await this.webUI.start();
        console.log(`✅ WebUI started on port ${this.webUIPort}`);
        
        // Create simple Express API for integration testing
        this.expressApp = express();
        this.expressApp.use(express.json());
        
        // API endpoint that integrates with WebUI
        this.expressApp.post('/api/integrate', (req, res) => {
            try {
                const data = req.body;
                
                // Send data to WebUI
                this.webUI.addOutput(`API received: ${JSON.stringify(data)}`, 'info');
                this.webUI.updateSession({
                    lastAPICall: new Date().toISOString(),
                    apiData: data,
                    apiCallCount: (this.webUI.sessionData.apiCallCount || 0) + 1
                });
                
                res.json({
                    success: true,
                    message: 'Data integrated with WebUI',
                    sessionUpdated: true
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Start Express server
        this.expressServer = this.expressApp.listen(this.apiPort, () => {
            console.log(`✅ Express API started on port ${this.apiPort}\n`);
        });
        
        this.addTestResult('SERVICES_INITIALIZATION', true, 'WebUI and Express API initialized successfully');
    }

    async testAPIWebSocketIntegration() {
        console.log('🔄 Testing API-WebSocket Integration...');
        
        try {
            // Create WebSocket client
            const wsClient = await this.createWebSocketClient();
            let receivedMessages = [];
            
            wsClient.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    receivedMessages.push(message);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            });
            
            await this.wait(500);
            
            // Make API call that should trigger WebSocket updates
            const response = await this.makeAPIRequest('/api/integrate', {
                test: 'integration',
                timestamp: new Date().toISOString()
            });
            
            if (!response.success) {
                throw new Error('API call failed');
            }
            
            await this.wait(1000);
            
            // Verify WebSocket received the updates
            const sessionUpdates = receivedMessages.filter(msg => msg.type === 'session_update');
            const outputMessages = receivedMessages.filter(msg => msg.type === 'new_output');
            
            if (sessionUpdates.length === 0) {
                throw new Error('No session updates received via WebSocket');
            }
            
            if (outputMessages.length === 0) {
                throw new Error('No output messages received via WebSocket');
            }
            
            // Verify data integrity
            const lastSessionUpdate = sessionUpdates[sessionUpdates.length - 1];
            if (!lastSessionUpdate.data.lastAPICall) {
                throw new Error('Session update missing API call data');
            }
            
            wsClient.close();
            
            console.log('✅ API-WebSocket integration test passed');
            this.addTestResult('API_WEBSOCKET_INTEGRATION', true, 
                `API triggered ${sessionUpdates.length} session updates and ${outputMessages.length} output messages via WebSocket`);
            
        } catch (error) {
            console.log('❌ API-WebSocket integration test failed:', error.message);
            this.addTestResult('API_WEBSOCKET_INTEGRATION', false, error.message);
        }
    }

    async testDataFlowBetweenServices() {
        console.log('📡 Testing Data Flow Between Services...');
        
        try {
            const wsClient = await this.createWebSocketClient();
            let sessionData = null;
            
            wsClient.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    if (message.type === 'session_update') {
                        sessionData = message.data;
                    }
                } catch (error) {
                    console.error('Parse error:', error);
                }
            });
            
            await this.wait(500);
            
            // Send multiple API requests to test data accumulation
            for (let i = 0; i < 5; i++) {
                await this.makeAPIRequest('/api/integrate', {
                    batch: i,
                    data: `Test data ${i}`
                });
                await this.wait(100);
            }
            
            await this.wait(1000);
            
            // Verify data persistence
            if (!sessionData) {
                throw new Error('No session data received');
            }
            
            if (sessionData.apiCallCount !== 5) {
                throw new Error(`Expected 5 API calls, got ${sessionData.apiCallCount}`);
            }
            
            if (!sessionData.apiData || sessionData.apiData.batch !== 4) {
                throw new Error('Latest API data not properly stored');
            }
            
            wsClient.close();
            
            console.log('✅ Data flow test passed');
            this.addTestResult('DATA_FLOW', true, 
                `Successfully processed 5 API calls with proper data accumulation and persistence`);
            
        } catch (error) {
            console.log('❌ Data flow test failed:', error.message);
            this.addTestResult('DATA_FLOW', false, error.message);
        }
    }

    async testErrorHandlingIntegration() {
        console.log('🚨 Testing Error Handling Integration...');
        
        try {
            const wsClient = await this.createWebSocketClient();
            let errorMessages = [];
            
            wsClient.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    if (message.type === 'new_output' && message.data.type === 'error') {
                        errorMessages.push(message.data);
                    }
                } catch (error) {
                    console.error('Parse error:', error);
                }
            });
            
            await this.wait(500);
            
            // Test API error that should propagate to WebSocket
            try {
                await this.makeAPIRequest('/api/nonexistent', { test: 'error' });
            } catch (error) {
                // Expected 404 error
            }
            
            // Test malformed request
            try {
                await this.makeAPIRequest('/api/integrate', null);
            } catch (error) {
                // Expected error
            }
            
            await this.wait(1000);
            
            // Check that errors were properly handled (no crashes)
            const response = await this.makeAPIRequest('/api/integrate', { test: 'recovery' });
            if (!response.success) {
                throw new Error('Service not recovered after errors');
            }
            
            wsClient.close();
            
            console.log('✅ Error handling integration test passed');
            this.addTestResult('ERROR_HANDLING_INTEGRATION', true, 
                'Services handle errors gracefully without affecting each other');
            
        } catch (error) {
            console.log('❌ Error handling integration test failed:', error.message);
            this.addTestResult('ERROR_HANDLING_INTEGRATION', false, error.message);
        }
    }

    async testConcurrentAPIAndWebSocket() {
        console.log('⚡ Testing Concurrent API and WebSocket Operations...');
        
        try {
            // Create multiple WebSocket clients
            const clients = [];
            const receivedCounts = [];
            
            for (let i = 0; i < 3; i++) {
                const client = await this.createWebSocketClient();
                clients.push(client);
                receivedCounts.push(0);
                
                client.on('message', () => {
                    receivedCounts[i]++;
                });
            }
            
            await this.wait(500);
            
            // Concurrent API calls and WebSocket messages
            const promises = [];
            
            // API calls
            for (let i = 0; i < 10; i++) {
                promises.push(
                    this.makeAPIRequest('/api/integrate', { concurrent: i })
                );
            }
            
            // WebSocket updates
            for (let i = 0; i < 10; i++) {
                promises.push(
                    new Promise(resolve => {
                        setTimeout(() => {
                            this.webUI.addOutput(`Concurrent WebSocket ${i}`, 'info');
                            resolve();
                        }, Math.random() * 100);
                    })
                );
            }
            
            await Promise.all(promises);
            await this.wait(1000);
            
            // Verify all clients received similar number of messages
            const avgReceived = receivedCounts.reduce((sum, count) => sum + count, 0) / receivedCounts.length;
            
            for (let i = 0; i < receivedCounts.length; i++) {
                if (Math.abs(receivedCounts[i] - avgReceived) > 5) {
                    throw new Error(`Client ${i} received ${receivedCounts[i]} messages, average was ${avgReceived}`);
                }
            }
            
            // Clean up
            clients.forEach(client => client.close());
            
            console.log('✅ Concurrent operations test passed');
            this.addTestResult('CONCURRENT_OPERATIONS', true, 
                `Successfully handled 10 concurrent API calls and 10 WebSocket updates across 3 clients`);
            
        } catch (error) {
            console.log('❌ Concurrent operations test failed:', error.message);
            this.addTestResult('CONCURRENT_OPERATIONS', false, error.message);
        }
    }

    async testDataPersistenceAcrossConnections() {
        console.log('💾 Testing Data Persistence Across Connections...');
        
        try {
            // Make API call to store data
            await this.makeAPIRequest('/api/integrate', {
                persistent: 'test data',
                timestamp: new Date().toISOString()
            });
            
            await this.wait(500);
            
            // Create new WebSocket client and verify it receives current state
            const client1 = await this.createWebSocketClient();
            let initialData = null;
            
            client1.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    if (message.type === 'session_data' && !initialData) {
                        initialData = message.data;
                    }
                } catch (error) {
                    console.error('Parse error:', error);
                }
            });
            
            await this.wait(1000);
            
            if (!initialData) {
                throw new Error('New client did not receive initial session data');
            }
            
            if (!initialData.apiData || initialData.apiData.persistent !== 'test data') {
                throw new Error('Persistent data not found in session');
            }
            
            client1.close();
            
            // Create another client to double-check persistence
            const client2 = await this.createWebSocketClient();
            let secondData = null;
            
            client2.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    if (message.type === 'session_data' && !secondData) {
                        secondData = message.data;
                    }
                } catch (error) {
                    console.error('Parse error:', error);
                }
            });
            
            await this.wait(1000);
            
            if (!secondData || !secondData.apiData || secondData.apiData.persistent !== 'test data') {
                throw new Error('Data not persistent across multiple connections');
            }
            
            client2.close();
            
            console.log('✅ Data persistence test passed');
            this.addTestResult('DATA_PERSISTENCE', true, 
                'Data persists correctly across multiple WebSocket connections');
            
        } catch (error) {
            console.log('❌ Data persistence test failed:', error.message);
            this.addTestResult('DATA_PERSISTENCE', false, error.message);
        }
    }

    async createWebSocketClient() {
        return new Promise((resolve, reject) => {
            const token = this.webUI.sessionToken;
            const client = new WebSocket(`ws://localhost:${this.webUIPort}?token=${token}`);
            
            client.on('open', () => {
                this.connections.push(client);
                resolve(client);
            });
            
            client.on('error', reject);
            
            setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, 5000);
        });
    }

    async makeAPIRequest(endpoint, data) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: this.apiPort,
                path: endpoint,
                method: data ? 'POST' : 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            const req = require('http').request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseData);
                        if (res.statusCode >= 400) {
                            reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
                        } else {
                            resolve(parsed);
                        }
                    } catch (error) {
                        reject(new Error('Invalid JSON response'));
                    }
                });
            });
            
            req.on('error', reject);
            
            if (data) {
                req.write(JSON.stringify(data));
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

    generateIntegrationReport() {
        console.log('\n🔗 BACKEND INTEGRATION TEST REPORT');
        console.log('='.repeat(50));
        
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        const successRate = ((passed / total) * 100).toFixed(1);
        
        console.log(`\n📊 Overall Results: ${passed}/${total} integration tests passed (${successRate}%)\n`);
        
        for (const result of this.testResults) {
            const status = result.passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} ${result.test}`);
            console.log(`   ${result.details}`);
            console.log('');
        }
        
        // Integration analysis
        console.log('🔍 INTEGRATION ANALYSIS:');
        
        const criticalTests = ['API_WEBSOCKET_INTEGRATION', 'DATA_FLOW', 'DATA_PERSISTENCE'];
        const criticalPassed = this.testResults.filter(r => 
            criticalTests.includes(r.test) && r.passed
        ).length;
        
        if (criticalPassed === criticalTests.length) {
            console.log('   ✓ All critical integration points working correctly');
        } else {
            console.log('   ⚠️ Some critical integration points have issues');
        }
        
        const performanceTests = ['CONCURRENT_OPERATIONS'];
        const performancePassed = this.testResults.filter(r => 
            performanceTests.includes(r.test) && r.passed
        ).length;
        
        if (performancePassed === performanceTests.length) {
            console.log('   ✓ Performance under concurrent load is acceptable');
        }
        
        console.log('');
        
        return {
            totalTests: total,
            passedTests: passed,
            successRate: parseFloat(successRate),
            integrationWorking: criticalPassed === criticalTests.length,
            details: this.testResults
        };
    }

    async cleanup() {
        console.log('🧹 Cleaning up integration test resources...');
        
        // Close all WebSocket connections
        for (const connection of this.connections) {
            try {
                if (connection.readyState === WebSocket.OPEN) {
                    connection.close();
                }
            } catch (error) {
                console.error('Error closing connection:', error.message);
            }
        }
        
        // Stop Express server
        if (this.expressServer) {
            try {
                this.expressServer.close();
                console.log('✅ Express server stopped');
            } catch (error) {
                console.error('Error stopping Express server:', error.message);
            }
        }
        
        // Stop WebUI
        if (this.webUI) {
            try {
                await this.webUI.stop();
                console.log('✅ WebUI stopped');
            } catch (error) {
                console.error('Error stopping WebUI:', error.message);
            }
        }
        
        console.log('✅ Integration test cleanup completed\n');
    }
}

// Run tests if called directly
if (require.main === module) {
    const testSuite = new BackendIntegrationTestSuite();
    testSuite.runIntegrationTests()
        .then(() => {
            console.log('🎉 Integration test suite completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Integration test suite failed:', error);
            process.exit(1);
        });
}

module.exports = BackendIntegrationTestSuite;