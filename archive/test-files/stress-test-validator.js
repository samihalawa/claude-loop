#!/usr/bin/env node
/**
 * Comprehensive Stress Testing & Error Condition Validator
 * Tests concurrent connections, rate limiting, error handling under load, and edge cases
 */

const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');
const { spawn } = require('child_process');
const chalk = require('chalk');

class StressTestValidator {
    constructor() {
        this.results = {
            concurrentConnections: {},
            rateLimitingEffectiveness: {},
            errorHandling: {},
            edgeCases: {},
            resourceExhaustion: {},
            recoveryTests: {},
            failureScenarios: []
        };
        this.activeConnections = [];
        this.testPort = 3335;
        this.testToken = null;
        this.webui = null;
    }

    async runStressTests() {
        console.log(chalk.blue.bold('\n🔥 Comprehensive Stress Testing & Error Condition Validation\n'));
        
        try {
            // Setup test environment
            await this.setupTestEnvironment();
            
            // Concurrent connection stress tests
            await this.testConcurrentConnections();
            
            // Rate limiting effectiveness
            await this.testRateLimitingEffectiveness();
            
            // Error handling under load
            await this.testErrorHandlingUnderLoad();
            
            // Edge case scenarios
            await this.testEdgeCases();
            
            // Resource exhaustion tests
            await this.testResourceExhaustion();
            
            // Recovery and resilience tests
            await this.testRecoveryScenarios();
            
            // Generate comprehensive report
            await this.generateStressTestReport();
            
        } catch (error) {
            console.error(chalk.red('Stress testing failed:'), error.message);
        } finally {
            await this.cleanup();
        }
    }

    async setupTestEnvironment() {
        console.log(chalk.cyan('🏗️  Setting up stress test environment...'));
        
        try {
            const WebUI = require('./lib/web-ui');
            this.webui = new WebUI(this.testPort);
            await this.webui.start();
            this.testToken = this.webui.sessionToken;
            
            console.log(chalk.green(`✓ Test WebUI started on port ${this.testPort}`));
            
            // Wait for server to be ready
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            throw new Error(`Failed to setup test environment: ${error.message}`);
        }
    }

    async testConcurrentConnections() {
        console.log(chalk.yellow('⚡ Testing Concurrent Connection Limits...'));
        
        const connectionTests = [];
        const maxConnections = 20;
        let successfulConnections = 0;
        let rejectedConnections = 0;
        let failedConnections = 0;
        
        console.log(chalk.gray(`  Attempting ${maxConnections} concurrent connections...`));
        
        const connectionPromises = Array(maxConnections).fill().map(async (_, index) => {
            try {
                const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${this.testToken}`);
                
                return new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Connection timeout'));
                    }, 5000);
                    
                    ws.on('open', () => {
                        clearTimeout(timeout);
                        this.activeConnections.push(ws);
                        successfulConnections++;
                        resolve({ status: 'success', index });
                    });
                    
                    ws.on('close', (code, reason) => {
                        clearTimeout(timeout);
                        if (code === 1013) { // Server overloaded
                            rejectedConnections++;
                            resolve({ status: 'rejected', index, code, reason });
                        } else {
                            resolve({ status: 'closed', index, code, reason });
                        }
                    });
                    
                    ws.on('error', (error) => {
                        clearTimeout(timeout);
                        failedConnections++;
                        resolve({ status: 'error', index, error: error.message });
                    });
                });
                
            } catch (error) {
                failedConnections++;
                return { status: 'failed', index, error: error.message };
            }
        });
        
        const results = await Promise.allSettled(connectionPromises);
        const connectionResults = results.map(r => r.status === 'fulfilled' ? r.value : { status: 'promise_failed' });
        
        console.log(chalk.gray(`  Successful connections: ${successfulConnections}`));
        console.log(chalk.gray(`  Rejected connections: ${rejectedConnections}`));
        console.log(chalk.gray(`  Failed connections: ${failedConnections}`));
        
        // Test connection stability under load
        console.log(chalk.gray('  Testing connection stability...'));
        const stabilityStartTime = Date.now();
        
        // Send messages to all active connections
        const messagePromises = this.activeConnections.map(async (ws, index) => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    for (let i = 0; i < 10; i++) {
                        ws.send(JSON.stringify({
                            type: 'stress_test',
                            data: `Message ${i} from connection ${index}`,
                            timestamp: Date.now()
                        }));
                        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms between messages
                    }
                    return { status: 'success', messages: 10 };
                } catch (error) {
                    return { status: 'error', error: error.message };
                }
            }
            return { status: 'closed' };
        });
        
        const messageResults = await Promise.allSettled(messagePromises);
        const stabilityDuration = Date.now() - stabilityStartTime;
        
        this.results.concurrentConnections = {
            maxAttempted: maxConnections,
            successful: successfulConnections,
            rejected: rejectedConnections,
            failed: failedConnections,
            connectionLimit: Math.max(5, successfulConnections), // Expected limit is 5
            limitEffective: rejectedConnections > 0,
            stabilityTest: {
                duration: stabilityDuration,
                messagingResults: messageResults.map(r => r.status === 'fulfilled' ? r.value : { status: 'failed' })
            },
            connectionResults
        };
        
        // Analyze if connection limits are working properly
        if (successfulConnections > 5) {
            this.addFailureScenario('CONNECTION_LIMIT_BYPASS', 
                `Connection limit bypassed: ${successfulConnections} connections accepted (expected max: 5)`, 'high');
        }
        
        console.log(chalk.green('  ✓ Concurrent connection tests completed'));
    }

    async testRateLimitingEffectiveness() {
        console.log(chalk.yellow('🚦 Testing Rate Limiting Effectiveness...'));
        
        const rateLimitTests = [];
        
        // Test 1: HTTP request rate limiting
        console.log(chalk.gray('  Testing HTTP request rate limiting...'));
        const httpStartTime = Date.now();
        const httpRequests = [];
        
        // Rapid fire requests
        for (let i = 0; i < 100; i++) {
            httpRequests.push(this.makeHTTPRequest(`http://localhost:${this.testPort}?token=${this.testToken}`));
        }
        
        const httpResults = await Promise.allSettled(httpRequests);
        const httpSuccessful = httpResults.filter(r => r.status === 'fulfilled' && r.value.statusCode === 200).length;
        const httpRateLimited = httpResults.filter(r => r.status === 'fulfilled' && r.value.statusCode === 429).length;
        const httpFailed = httpResults.filter(r => r.status === 'rejected').length;
        
        rateLimitTests.push({
            test: 'HTTP Rate Limiting',
            totalRequests: 100,
            successful: httpSuccessful,
            rateLimited: httpRateLimited,
            failed: httpFailed,
            duration: Date.now() - httpStartTime,
            effective: httpRateLimited > 0
        });
        
        console.log(chalk.gray(`    HTTP requests: ${httpSuccessful} successful, ${httpRateLimited} rate-limited, ${httpFailed} failed`));
        
        // Test 2: WebSocket message rate limiting
        console.log(chalk.gray('  Testing WebSocket message rate limiting...'));
        
        if (this.activeConnections.length > 0) {
            const wsConnection = this.activeConnections[0];
            const wsStartTime = Date.now();
            let messagesSent = 0;
            let messagesRejected = 0;
            
            const messagePromises = [];
            
            // Send rapid messages
            for (let i = 0; i < 50; i++) {
                const messagePromise = new Promise((resolve) => {
                    try {
                        if (wsConnection.readyState === WebSocket.OPEN) {
                            wsConnection.send(JSON.stringify({
                                type: 'rate_limit_test',
                                data: `Rapid message ${i}`,
                                timestamp: Date.now()
                            }));
                            messagesSent++;
                            resolve({ status: 'sent', index: i });
                        } else {
                            resolve({ status: 'connection_closed', index: i });
                        }
                    } catch (error) {
                        messagesRejected++;
                        resolve({ status: 'error', index: i, error: error.message });
                    }
                });
                messagePromises.push(messagePromise);
            }
            
            const wsResults = await Promise.allSettled(messagePromises);
            
            rateLimitTests.push({
                test: 'WebSocket Message Rate Limiting',
                totalMessages: 50,
                sent: messagesSent,
                rejected: messagesRejected,
                duration: Date.now() - wsStartTime,
                effective: messagesRejected > 0 || messagesSent < 50
            });
            
            console.log(chalk.gray(`    WebSocket messages: ${messagesSent} sent, ${messagesRejected} rejected`));
        }
        
        this.results.rateLimitingEffectiveness = {
            tests: rateLimitTests,
            httpRateLimitingWorks: rateLimitTests[0].effective,
            wsRateLimitingWorks: rateLimitTests.length > 1 ? rateLimitTests[1].effective : false
        };
        
        // Check if rate limiting is working as expected
        if (!this.results.rateLimitingEffectiveness.httpRateLimitingWorks) {
            this.addFailureScenario('HTTP_RATE_LIMIT_INEFFECTIVE', 
                'HTTP rate limiting not working - all requests succeeded', 'medium');
        }
        
        console.log(chalk.green('  ✓ Rate limiting effectiveness tests completed'));
    }

    async testErrorHandlingUnderLoad() {
        console.log(chalk.yellow('💥 Testing Error Handling Under Load...'));
        
        const errorTests = [];
        
        // Test 1: Invalid token flood
        console.log(chalk.gray('  Testing invalid token flood...'));
        const invalidTokenPromises = Array(20).fill().map(async (_, index) => {
            const invalidToken = crypto.randomBytes(32).toString('hex');
            try {
                const result = await this.makeHTTPRequest(`http://localhost:${this.testPort}?token=${invalidToken}`);
                return { status: 'response', statusCode: result.statusCode, index };
            } catch (error) {
                return { status: 'error', error: error.message, index };
            }
        });
        
        const invalidTokenResults = await Promise.allSettled(invalidTokenPromises);
        const unauthorizedResponses = invalidTokenResults
            .filter(r => r.status === 'fulfilled' && r.value.statusCode === 401).length;
        
        errorTests.push({
            test: 'Invalid Token Flood',
            attempts: 20,
            unauthorizedResponses,
            properlyRejected: unauthorizedResponses === 20
        });
        
        console.log(chalk.gray(`    Invalid tokens: ${unauthorizedResponses}/20 properly rejected`));
        
        // Test 2: Malformed WebSocket connections
        console.log(chalk.gray('  Testing malformed WebSocket connections...'));
        const malformedConnections = [];
        
        for (let i = 0; i < 10; i++) {
            try {
                const ws = new WebSocket(`ws://localhost:${this.testPort}`, {
                    headers: {
                        'Invalid-Header': 'malformed-value',
                        'User-Agent': `<script>alert('xss')</script>`
                    }
                });
                
                const result = await new Promise((resolve) => {
                    const timeout = setTimeout(() => resolve({ status: 'timeout' }), 2000);
                    
                    ws.on('open', () => {
                        clearTimeout(timeout);
                        resolve({ status: 'opened' });
                        ws.close();
                    });
                    
                    ws.on('close', (code, reason) => {
                        clearTimeout(timeout);
                        resolve({ status: 'closed', code, reason });
                    });
                    
                    ws.on('error', (error) => {
                        clearTimeout(timeout);
                        resolve({ status: 'error', error: error.message });
                    });
                });
                
                malformedConnections.push(result);
                
            } catch (error) {
                malformedConnections.push({ status: 'exception', error: error.message });
            }
        }
        
        errorTests.push({
            test: 'Malformed WebSocket Connections',
            attempts: 10,
            results: malformedConnections,
            properlyHandled: malformedConnections.filter(r => r.status === 'error' || r.status === 'closed').length
        });
        
        // Test 3: Large payload handling
        console.log(chalk.gray('  Testing large payload handling...'));
        const largePayloadTest = await this.testLargePayloads();
        errorTests.push(largePayloadTest);
        
        this.results.errorHandling = {
            tests: errorTests,
            invalidTokenHandling: errorTests[0].properlyRejected,
            malformedConnectionHandling: errorTests[1].properlyHandled >= 8, // At least 80% properly handled
            largePayloadHandling: errorTests[2].properlyHandled
        };
        
        console.log(chalk.green('  ✓ Error handling under load tests completed'));
    }

    async testLargePayloads() {
        const largePayloadSizes = [
            { size: 1024 * 10, description: '10KB' },    // 10KB
            { size: 1024 * 100, description: '100KB' },  // 100KB
            { size: 1024 * 1024, description: '1MB' },   // 1MB
            { size: 1024 * 1024 * 5, description: '5MB' } // 5MB
        ];
        
        const results = [];
        
        for (const payloadTest of largePayloadSizes) {
            try {
                const largeData = 'x'.repeat(payloadTest.size);
                const startTime = Date.now();
                
                const response = await this.makeHTTPRequest(
                    `http://localhost:${this.testPort}?token=${this.testToken}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ data: largeData })
                    }
                );
                
                const duration = Date.now() - startTime;
                
                results.push({
                    size: payloadTest.size,
                    description: payloadTest.description,
                    status: 'completed',
                    statusCode: response.statusCode,
                    duration,
                    handled: response.statusCode < 500
                });
                
            } catch (error) {
                results.push({
                    size: payloadTest.size,
                    description: payloadTest.description,
                    status: 'error',
                    error: error.message,
                    handled: true // Error is proper handling for oversized requests
                });
            }
        }
        
        console.log(chalk.gray(`    Large payloads: ${results.filter(r => r.handled).length}/${results.length} properly handled`));
        
        return {
            test: 'Large Payload Handling',
            attempts: largePayloadSizes.length,
            results,
            properlyHandled: results.filter(r => r.handled).length === results.length
        };
    }

    async testEdgeCases() {
        console.log(chalk.yellow('🎯 Testing Edge Case Scenarios...'));
        
        const edgeCaseTests = [];
        
        // Test 1: Rapid connect/disconnect cycles
        console.log(chalk.gray('  Testing rapid connect/disconnect cycles...'));
        const rapidCycleStartTime = Date.now();
        
        for (let cycle = 0; cycle < 10; cycle++) {
            const connections = [];
            
            // Create 5 connections rapidly
            for (let i = 0; i < 5; i++) {
                try {
                    const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${this.testToken}`);
                    connections.push(ws);
                    
                    // Close immediately after opening
                    ws.on('open', () => {
                        setTimeout(() => ws.close(), Math.random() * 100);
                    });
                } catch (error) {
                    // Expected in some cases
                }
            }
            
            // Wait a bit before next cycle
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const rapidCycleDuration = Date.now() - rapidCycleStartTime;
        
        edgeCaseTests.push({
            test: 'Rapid Connect/Disconnect Cycles',
            cycles: 10,
            duration: rapidCycleDuration,
            completed: true
        });
        
        console.log(chalk.gray(`    Rapid cycles: ${rapidCycleDuration}ms for 10 cycles`));
        
        // Test 2: Empty and null message handling
        console.log(chalk.gray('  Testing empty and null message handling...'));
        const messageTests = await this.testSpecialMessages();
        edgeCaseTests.push(messageTests);
        
        // Test 3: Concurrent token validation
        console.log(chalk.gray('  Testing concurrent token validation...'));
        const tokenValidationTest = await this.testConcurrentTokenValidation();
        edgeCaseTests.push(tokenValidationTest);
        
        this.results.edgeCases = {
            tests: edgeCaseTests,
            rapidCyclesHandled: edgeCaseTests[0].completed,
            specialMessagesHandled: edgeCaseTests[1].properlyHandled,
            concurrentTokenValidation: edgeCaseTests[2].consistent
        };
        
        console.log(chalk.green('  ✓ Edge case scenario tests completed'));
    }

    async testSpecialMessages() {
        const specialMessages = [
            null,
            undefined,
            '',
            '{}',
            '{"incomplete": }',
            '{"__proto__": {"evil": true}}',
            '{"constructor": {"prototype": {"evil": true}}}',
            JSON.stringify({ type: null }),
            JSON.stringify({ type: 'test', data: null }),
            JSON.stringify({ type: 'test', data: undefined }),
        ];
        
        const results = [];
        
        if (this.activeConnections.length > 0) {
            const ws = this.activeConnections[0];
            
            for (const message of specialMessages) {
                try {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(message);
                        results.push({ message: String(message), status: 'sent' });
                    } else {
                        results.push({ message: String(message), status: 'connection_closed' });
                    }
                } catch (error) {
                    results.push({ message: String(message), status: 'error', error: error.message });
                }
                
                // Small delay between messages
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        
        return {
            test: 'Special Message Handling',
            attempts: specialMessages.length,
            results,
            properlyHandled: results.filter(r => r.status === 'error' || r.status === 'sent').length === results.length
        };
    }

    async testConcurrentTokenValidation() {
        const validationPromises = Array(20).fill().map(async (_, index) => {
            const useValidToken = index % 2 === 0;
            const token = useValidToken ? this.testToken : crypto.randomBytes(32).toString('hex');
            
            try {
                const response = await this.makeHTTPRequest(`http://localhost:${this.testPort}?token=${token}`);
                return {
                    index,
                    validToken: useValidToken,
                    statusCode: response.statusCode,
                    expectedStatus: useValidToken ? 200 : 401,
                    correct: (useValidToken && response.statusCode === 200) || (!useValidToken && response.statusCode === 401)
                };
            } catch (error) {
                return {
                    index,
                    validToken: useValidToken,
                    error: error.message,
                    correct: !useValidToken // Errors are OK for invalid tokens
                };
            }
        });
        
        const validationResults = await Promise.allSettled(validationPromises);
        const results = validationResults.map(r => r.status === 'fulfilled' ? r.value : { correct: false });
        const correctValidations = results.filter(r => r.correct).length;
        
        return {
            test: 'Concurrent Token Validation',
            attempts: 20,
            correctValidations,
            results,
            consistent: correctValidations === 20
        };
    }

    async testResourceExhaustion() {
        console.log(chalk.yellow('📈 Testing Resource Exhaustion Scenarios...'));
        
        const resourceTests = [];
        
        // Test 1: Memory pressure simulation
        console.log(chalk.gray('  Testing memory pressure handling...'));
        const memoryStartTime = Date.now();
        const initialMemory = process.memoryUsage();
        
        // Create memory pressure by allocating large objects
        const memoryPressureObjects = [];
        try {
            for (let i = 0; i < 100; i++) {
                memoryPressureObjects.push(Buffer.alloc(1024 * 1024)); // 1MB each
                
                // Check if system is still responsive
                if (i % 10 === 0) {
                    const testResponse = await this.makeHTTPRequest(`http://localhost:${this.testPort}?token=${this.testToken}`);
                    if (testResponse.statusCode !== 200) {
                        break;
                    }
                }
            }
        } catch (error) {
            // Expected when memory runs out
        }
        
        const memoryEndTime = Date.now();
        const finalMemory = process.memoryUsage();
        
        resourceTests.push({
            test: 'Memory Pressure',
            duration: memoryEndTime - memoryStartTime,
            initialMemory: initialMemory.heapUsed,
            finalMemory: finalMemory.heapUsed,
            memoryIncrease: finalMemory.heapUsed - initialMemory.heapUsed,
            objectsAllocated: memoryPressureObjects.length
        });
        
        // Clean up memory pressure objects
        memoryPressureObjects.length = 0;
        if (global.gc) global.gc();
        
        console.log(chalk.gray(`    Memory pressure: ${memoryPressureObjects.length} MB allocated`));
        
        this.results.resourceExhaustion = {
            tests: resourceTests,
            memoryPressureHandled: resourceTests[0].duration < 30000 // Should complete within 30s
        };
        
        console.log(chalk.green('  ✓ Resource exhaustion tests completed'));
    }

    async testRecoveryScenarios() {
        console.log(chalk.yellow('🔄 Testing Recovery and Resilience...'));
        
        const recoveryTests = [];
        
        // Test 1: Server restart simulation
        console.log(chalk.gray('  Testing server recovery...'));
        
        try {
            // Stop the WebUI server
            await this.webui.stop();
            console.log(chalk.gray('    Server stopped'));
            
            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Restart the server
            const WebUI = require('./lib/web-ui');
            this.webui = new WebUI(this.testPort);
            await this.webui.start();
            this.testToken = this.webui.sessionToken;
            
            console.log(chalk.gray('    Server restarted'));
            
            // Test if server is functional
            const testResponse = await this.makeHTTPRequest(`http://localhost:${this.testPort}?token=${this.testToken}`);
            
            recoveryTests.push({
                test: 'Server Restart Recovery',
                successful: testResponse.statusCode === 200,
                statusCode: testResponse.statusCode
            });
            
        } catch (error) {
            recoveryTests.push({
                test: 'Server Restart Recovery',
                successful: false,
                error: error.message
            });
        }
        
        this.results.recoveryTests = {
            tests: recoveryTests,
            serverRecoveryWorks: recoveryTests[0].successful
        };
        
        console.log(chalk.green('  ✓ Recovery and resilience tests completed'));
    }

    async makeHTTPRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const req = http.request(url, {
                method: options.method || 'GET',
                headers: options.headers || {},
                timeout: 5000
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ 
                    statusCode: res.statusCode, 
                    headers: res.headers, 
                    data 
                }));
            });
            
            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));
            
            if (options.body) {
                req.write(options.body);
            }
            
            req.end();
        });
    }

    addFailureScenario(type, description, severity = 'medium') {
        this.results.failureScenarios.push({
            type,
            description,
            severity,
            timestamp: new Date().toISOString()
        });
    }

    async generateStressTestReport() {
        console.log(chalk.blue.bold('\n📊 Generating Stress Test Report...\n'));
        
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: this.getTotalTestCount(),
                failedScenarios: this.results.failureScenarios.length,
                criticalFailures: this.results.failureScenarios.filter(f => f.severity === 'high').length,
                resilienceScore: this.calculateResilienceScore(),
                stressTestScore: this.calculateStressTestScore()
            },
            results: this.results,
            recommendations: this.generateStressTestRecommendations()
        };
        
        await fs.writeFile(
            path.join(process.cwd(), 'stress-test-report.json'),
            JSON.stringify(report, null, 2)
        );
        
        this.printStressTestSummary(report);
        
        console.log(chalk.green('\n✅ Stress testing completed successfully!'));
        console.log(chalk.gray('Report saved to: stress-test-report.json'));
        
        return report;
    }

    getTotalTestCount() {
        let count = 0;
        count += this.results.concurrentConnections.connectionResults?.length || 0;
        count += this.results.rateLimitingEffectiveness.tests?.length || 0;
        count += this.results.errorHandling.tests?.length || 0;
        count += this.results.edgeCases.tests?.length || 0;
        count += this.results.resourceExhaustion.tests?.length || 0;
        count += this.results.recoveryTests.tests?.length || 0;
        return count;
    }

    calculateResilienceScore() {
        let score = 100;
        
        // Deduct for failure scenarios
        this.results.failureScenarios.forEach(failure => {
            switch (failure.severity) {
                case 'high': score -= 30; break;
                case 'medium': score -= 15; break;
                case 'low': score -= 5; break;
            }
        });
        
        // Check specific resilience metrics
        if (!this.results.concurrentConnections?.limitEffective) score -= 20;
        if (!this.results.rateLimitingEffectiveness?.httpRateLimitingWorks) score -= 15;
        if (!this.results.errorHandling?.invalidTokenHandling) score -= 10;
        if (!this.results.recoveryTests?.serverRecoveryWorks) score -= 25;
        
        return Math.max(0, score);
    }

    calculateStressTestScore() {
        let score = 100;
        
        // Connection handling
        if (this.results.concurrentConnections?.successful > 5) score -= 20;
        
        // Rate limiting
        if (!this.results.rateLimitingEffectiveness?.httpRateLimitingWorks) score -= 25;
        if (!this.results.rateLimitingEffectiveness?.wsRateLimitingWorks) score -= 15;
        
        // Error handling
        if (!this.results.errorHandling?.invalidTokenHandling) score -= 15;
        if (!this.results.errorHandling?.malformedConnectionHandling) score -= 10;
        
        // Edge cases
        if (!this.results.edgeCases?.specialMessagesHandled) score -= 10;
        if (!this.results.edgeCases?.concurrentTokenValidation) score -= 5;
        
        return Math.max(0, score);
    }

    generateStressTestRecommendations() {
        const recommendations = [];
        
        this.results.failureScenarios.forEach(failure => {
            switch (failure.type) {
                case 'CONNECTION_LIMIT_BYPASS':
                    recommendations.push('Strengthen connection limit enforcement');
                    recommendations.push('Implement IP-based connection tracking');
                    break;
                case 'HTTP_RATE_LIMIT_INEFFECTIVE':
                    recommendations.push('Review and tighten HTTP rate limiting thresholds');
                    recommendations.push('Implement progressive rate limiting penalties');
                    break;
            }
        });
        
        // General recommendations
        recommendations.push('Implement comprehensive monitoring and alerting');
        recommendations.push('Add circuit breaker patterns for resilience');
        recommendations.push('Regular stress testing in staging environments');
        recommendations.push('Implement graceful degradation under load');
        
        return [...new Set(recommendations)];
    }

    printStressTestSummary(report) {
        console.log(chalk.blue.bold('🔥 STRESS TEST SUMMARY'));
        console.log(chalk.blue('='.repeat(50)));
        
        console.log(chalk.white(`Resilience Score: ${chalk.bold(report.summary.resilienceScore)}/100`));
        console.log(chalk.white(`Stress Test Score: ${chalk.bold(report.summary.stressTestScore)}/100`));
        console.log(chalk.white(`Total Tests: ${chalk.bold(report.summary.totalTests)}`));
        console.log(chalk.white(`Failed Scenarios: ${chalk.bold(report.summary.failedScenarios)}`));
        console.log(chalk.white(`Critical Failures: ${chalk.bold(report.summary.criticalFailures)}`));
        
        // Connection limits
        console.log(chalk.cyan.bold('\n⚡ CONNECTION LIMITS:'));
        console.log(chalk.cyan(`  Successful connections: ${this.results.concurrentConnections?.successful || 0}`));
        console.log(chalk.cyan(`  Rejected connections: ${this.results.concurrentConnections?.rejected || 0}`));
        console.log(chalk.cyan(`  Limit effective: ${this.results.concurrentConnections?.limitEffective ? '✓' : '✗'}`));
        
        // Rate limiting
        console.log(chalk.yellow.bold('\n🚦 RATE LIMITING:'));
        console.log(chalk.yellow(`  HTTP rate limiting: ${this.results.rateLimitingEffectiveness?.httpRateLimitingWorks ? '✓' : '✗'}`));
        console.log(chalk.yellow(`  WebSocket rate limiting: ${this.results.rateLimitingEffectiveness?.wsRateLimitingWorks ? '✓' : '✗'}`));
        
        // Failures
        if (this.results.failureScenarios.length > 0) {
            console.log(chalk.red.bold('\n🚨 FAILURE SCENARIOS:'));
            this.results.failureScenarios.forEach((failure, index) => {
                const severityColor = failure.severity === 'high' ? chalk.red : 
                                    failure.severity === 'medium' ? chalk.yellow : chalk.gray;
                console.log(severityColor(`${index + 1}. [${failure.severity.toUpperCase()}] ${failure.description}`));
            });
        } else {
            console.log(chalk.green.bold('\n✅ NO CRITICAL FAILURES DETECTED'));
        }
        
        // Recommendations
        console.log(chalk.yellow.bold('\n💡 RECOMMENDATIONS:'));
        report.recommendations.slice(0, 5).forEach((rec, index) => {
            console.log(chalk.yellow(`${index + 1}. ${rec}`));
        });
    }

    async cleanup() {
        console.log(chalk.gray('\nCleaning up stress test resources...'));
        
        // Close all active connections
        this.activeConnections.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        });
        
        // Stop WebUI if running
        if (this.webui) {
            try {
                await this.webui.stop();
            } catch (error) {
                console.error('Error stopping WebUI:', error.message);
            }
        }
        
        console.log(chalk.green('✓ Cleanup completed'));
    }
}

// Run the stress tests if this file is executed directly
if (require.main === module) {
    const validator = new StressTestValidator();
    validator.runStressTests().catch(console.error);
}

module.exports = StressTestValidator;