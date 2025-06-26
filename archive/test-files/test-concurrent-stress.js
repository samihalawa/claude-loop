#!/usr/bin/env node

/**
 * Concurrent WebSocket Stress Testing Suite
 * Tests for race conditions, data corruption, and performance under heavy load
 */

const WebSocket = require('ws');
const WebUI = require('./lib/web-ui');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

class ConcurrentStressTestSuite {
    constructor() {
        this.webUI = null;
        this.testResults = [];
        this.connections = [];
        this.testPort = 3338; // Different port for stress testing
        this.stressTestRunning = false;
    }

    async runStressTests() {
        console.log('⚡ Starting Concurrent WebSocket Stress Testing Suite\n');
        
        try {
            await this.initializeWebUI();
            
            // Run stress tests
            await this.testMaxConcurrentConnections();
            await this.testHighVolumeMessaging();
            await this.testConcurrentDataUpdates();
            await this.testConnectionChurn();
            await this.testMemoryLeakDetection();
            await this.testDataConsistencyUnderLoad();
            await this.testErrorRecoveryUnderStress();
            
            this.generateStressTestReport();
            
        } catch (error) {
            console.error('❌ Stress test suite failed:', error.message);
            this.addTestResult('STRESS_SUITE_FAILURE', false, error.message);
        } finally {
            await this.cleanup();
        }
    }

    async initializeWebUI() {
        console.log('🚀 Initializing WebUI for stress testing...');
        this.webUI = new WebUI(this.testPort);
        await this.webUI.start();
        console.log(`✅ WebUI started on port ${this.testPort} for stress testing\n`);
        this.addTestResult('STRESS_WEBUI_INIT', true, 'WebUI initialized for stress testing');
    }

    async testMaxConcurrentConnections() {
        console.log('🔥 Testing Maximum Concurrent Connections...');
        
        try {
            const maxConnections = this.webUI.maxConnections;
            const clients = [];
            const startTime = performance.now();
            
            console.log(`   Attempting to create ${maxConnections + 5} connections (max: ${maxConnections})`);
            
            // Try to create more connections than the limit
            for (let i = 0; i < maxConnections + 5; i++) {
                try {
                    const client = await this.createTestClient(2000); // 2 second timeout
                    clients.push(client);
                    console.log(`   ✓ Connection ${i + 1} established`);
                } catch (error) {
                    console.log(`   ⚠️ Connection ${i + 1} failed (expected after max): ${error.message}`);
                    break;
                }
            }
            
            const successfulConnections = clients.length;
            const connectionTime = performance.now() - startTime;
            
            // Verify connection limit is enforced
            if (successfulConnections > maxConnections) {
                throw new Error(`Too many connections allowed: ${successfulConnections} > ${maxConnections}`);
            }
            
            // Test that existing connections still work
            for (let i = 0; i < Math.min(3, clients.length); i++) {
                if (clients[i].readyState !== WebSocket.OPEN) {
                    throw new Error(`Connection ${i} is not in OPEN state`);
                }
            }
            
            // Clean up connections
            clients.forEach(client => {
                try {
                    client.close();
                } catch (error) {
                    console.error('Error closing client:', error.message);
                }
            });
            
            console.log(`✅ Max connections test passed: ${successfulConnections}/${maxConnections + 5} (${connectionTime.toFixed(2)}ms)`);
            this.addTestResult('MAX_CONNECTIONS', true, 
                `${successfulConnections} connections established, limit enforced, time: ${connectionTime.toFixed(2)}ms`);
            
        } catch (error) {
            console.log('❌ Max connections test failed:', error.message);
            this.addTestResult('MAX_CONNECTIONS', false, error.message);
        }
    }

    async testHighVolumeMessaging() {
        console.log('📈 Testing High Volume Messaging...');
        
        try {
            const messageCount = 1000;
            const clientCount = 5;
            const clients = [];
            const receivedCounts = [];
            
            // Create test clients
            for (let i = 0; i < clientCount; i++) {
                const client = await this.createTestClient();
                clients.push(client);
                receivedCounts.push(0);
                
                client.on('message', () => {
                    receivedCounts[i]++;
                });
            }
            
            await this.wait(500); // Let connections settle
            
            const startTime = performance.now();
            
            // Send high volume of messages
            console.log(`   Sending ${messageCount} messages...`);
            for (let i = 0; i < messageCount; i++) {
                this.webUI.addOutput(`High volume message ${i}`, 'info');
                
                // Add some session updates too
                if (i % 100 === 0) {
                    this.webUI.updateSession({
                        iterations: Math.floor(i / 100),
                        currentPhase: `High volume test ${i}`
                    });
                }
                
                // Small delay every 50 messages to prevent overwhelming
                if (i % 50 === 0) {
                    await this.wait(1);
                }
            }
            
            const sendTime = performance.now() - startTime;
            
            // Wait for messages to be processed
            await this.wait(2000);
            
            // Verify message delivery
            let totalReceived = receivedCounts.reduce((sum, count) => sum + count, 0);
            let expectedTotal = clientCount * (messageCount + Math.floor(messageCount / 100)); // Include session updates
            
            console.log(`   Sent: ${messageCount} messages + ${Math.floor(messageCount / 100)} updates`);
            console.log(`   Received total: ${totalReceived} (expected ~${expectedTotal})`);
            
            // Allow some tolerance for timing issues
            if (totalReceived < expectedTotal * 0.9) {
                throw new Error(`Too few messages received: ${totalReceived} < ${expectedTotal * 0.9}`);
            }
            
            // Clean up
            clients.forEach(client => client.close());
            
            console.log(`✅ High volume messaging test passed (${sendTime.toFixed(2)}ms send time)`);
            this.addTestResult('HIGH_VOLUME_MESSAGING', true, 
                `${messageCount} messages sent to ${clientCount} clients in ${sendTime.toFixed(2)}ms`);
            
        } catch (error) {
            console.log('❌ High volume messaging test failed:', error.message);
            this.addTestResult('HIGH_VOLUME_MESSAGING', false, error.message);
        }
    }

    async testConcurrentDataUpdates() {
        console.log('🔄 Testing Concurrent Data Updates...');
        
        try {
            const updateCount = 100;
            const clientCount = 3;
            const clients = [];
            const receivedUpdates = [];
            
            // Create test clients
            for (let i = 0; i < clientCount; i++) {
                const client = await this.createTestClient();
                clients.push(client);
                receivedUpdates.push([]);
                
                client.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        if (message.type === 'session_update') {
                            receivedUpdates[i].push(message.data);
                        }
                    } catch (error) {
                        console.error(`Client ${i} parse error:`, error);
                    }
                });
            }
            
            await this.wait(500);
            
            const startTime = performance.now();
            
            // Perform concurrent updates
            console.log(`   Performing ${updateCount} concurrent session updates...`);
            
            const updatePromises = [];
            for (let i = 0; i < updateCount; i++) {
                const updatePromise = new Promise(resolve => {
                    setTimeout(() => {
                        this.webUI.updateSession({
                            iterations: i,
                            currentPhase: `Concurrent update ${i}`,
                            testField: `value-${i}`,
                            timestamp: Date.now()
                        });
                        resolve();
                    }, Math.random() * 10); // Random delay up to 10ms
                });
                updatePromises.push(updatePromise);
            }
            
            await Promise.all(updatePromises);
            const updateTime = performance.now() - startTime;
            
            // Wait for all updates to be received
            await this.wait(1000);
            
            // Verify data consistency across clients
            for (let i = 1; i < clientCount; i++) {
                if (Math.abs(receivedUpdates[i].length - receivedUpdates[0].length) > 5) {
                    throw new Error(`Client ${i} received ${receivedUpdates[i].length} updates, ` +
                        `client 0 received ${receivedUpdates[0].length} updates (difference > 5)`);
                }
            }
            
            // Verify final state consistency
            const finalIteration = this.webUI.sessionData.iterations;
            if (finalIteration !== updateCount - 1) {
                throw new Error(`Final iteration mismatch: expected ${updateCount - 1}, got ${finalIteration}`);
            }
            
            // Clean up
            clients.forEach(client => client.close());
            
            console.log(`✅ Concurrent data updates test passed (${updateTime.toFixed(2)}ms)`);
            this.addTestResult('CONCURRENT_UPDATES', true, 
                `${updateCount} concurrent updates completed in ${updateTime.toFixed(2)}ms, data consistent`);
            
        } catch (error) {
            console.log('❌ Concurrent data updates test failed:', error.message);
            this.addTestResult('CONCURRENT_UPDATES', false, error.message);
        }
    }

    async testConnectionChurn() {
        console.log('🌪️ Testing Connection Churn (Rapid Connect/Disconnect)...');
        
        try {
            const churnCycles = 50;
            const connectionsPerCycle = 3;
            
            console.log(`   Running ${churnCycles} churn cycles with ${connectionsPerCycle} connections each...`);
            
            const startTime = performance.now();
            const connectionTimes = [];
            
            for (let cycle = 0; cycle < churnCycles; cycle++) {
                const cycleStart = performance.now();
                const clients = [];
                
                // Create connections
                for (let i = 0; i < connectionsPerCycle; i++) {
                    try {
                        const client = await this.createTestClient(1000);
                        clients.push(client);
                    } catch (error) {
                        console.log(`   ⚠️ Connection failed in cycle ${cycle}: ${error.message}`);
                    }
                }
                
                // Send a message to test the connections
                this.webUI.addOutput(`Churn test cycle ${cycle}`, 'info');
                
                // Small delay
                await this.wait(10);
                
                // Close connections
                for (const client of clients) {
                    try {
                        client.close();
                    } catch (error) {
                        console.error('Error closing client during churn:', error.message);
                    }
                }
                
                const cycleTime = performance.now() - cycleStart;
                connectionTimes.push(cycleTime);
                
                // Brief pause between cycles
                await this.wait(5);
                
                if (cycle % 10 === 0) {
                    console.log(`   Completed ${cycle + 1}/${churnCycles} cycles`);
                }
            }
            
            const totalTime = performance.now() - startTime;
            const avgCycleTime = connectionTimes.reduce((sum, time) => sum + time, 0) / connectionTimes.length;
            
            // Verify server is still responsive
            const testClient = await this.createTestClient();
            testClient.close();
            
            console.log(`✅ Connection churn test passed (${totalTime.toFixed(2)}ms total, ${avgCycleTime.toFixed(2)}ms avg/cycle)`);
            this.addTestResult('CONNECTION_CHURN', true, 
                `${churnCycles} churn cycles completed, avg time: ${avgCycleTime.toFixed(2)}ms/cycle`);
            
        } catch (error) {
            console.log('❌ Connection churn test failed:', error.message);
            this.addTestResult('CONNECTION_CHURN', false, error.message);
        }
    }

    async testMemoryLeakDetection() {
        console.log('🔍 Testing Memory Leak Detection...');
        
        try {
            const initialMemory = process.memoryUsage();
            const cycleCount = 20;
            
            console.log(`   Running ${cycleCount} memory stress cycles...`);
            
            for (let cycle = 0; cycle < cycleCount; cycle++) {
                // Create and destroy connections
                const clients = [];
                for (let i = 0; i < 5; i++) {
                    const client = await this.createTestClient();
                    clients.push(client);
                }
                
                // Generate output
                for (let i = 0; i < 50; i++) {
                    this.webUI.addOutput(`Memory stress cycle ${cycle}, message ${i}`, 'info');
                }
                
                // Update session data
                this.webUI.updateSession({
                    iterations: cycle,
                    currentPhase: `Memory stress cycle ${cycle}`,
                    largeData: 'x'.repeat(1000) // Some larger data
                });
                
                // Close connections
                clients.forEach(client => client.close());
                
                await this.wait(50);
                
                if (cycle % 5 === 0) {
                    const currentMemory = process.memoryUsage();
                    const heapDelta = (currentMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
                    console.log(`   Cycle ${cycle}: heap delta ${heapDelta.toFixed(2)}MB`);
                }
            }
            
            // Force garbage collection if possible
            if (global.gc) {
                global.gc();
                await this.wait(100);
            }
            
            const finalMemory = process.memoryUsage();
            const heapGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
            const rssGrowth = (finalMemory.rss - initialMemory.rss) / 1024 / 1024;
            
            console.log(`   Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            console.log(`   Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            console.log(`   Heap growth: ${heapGrowth.toFixed(2)}MB`);
            console.log(`   RSS growth: ${rssGrowth.toFixed(2)}MB`);
            
            // Check for excessive memory growth (threshold: 10MB)
            if (heapGrowth > 10) {
                console.log('⚠️ Warning: Significant heap growth detected, possible memory leak');
                this.addTestResult('MEMORY_LEAK_DETECTION', false, 
                    `Excessive heap growth: ${heapGrowth.toFixed(2)}MB > 10MB threshold`);
            } else {
                console.log(`✅ Memory leak detection passed`);
                this.addTestResult('MEMORY_LEAK_DETECTION', true, 
                    `Acceptable memory growth: heap +${heapGrowth.toFixed(2)}MB, RSS +${rssGrowth.toFixed(2)}MB`);
            }
            
        } catch (error) {
            console.log('❌ Memory leak detection test failed:', error.message);
            this.addTestResult('MEMORY_LEAK_DETECTION', false, error.message);
        }
    }

    async testDataConsistencyUnderLoad() {
        console.log('🎯 Testing Data Consistency Under Load...');
        
        try {
            const clients = [];
            const clientData = [];
            const testDuration = 5000; // 5 seconds
            
            // Create multiple clients
            for (let i = 0; i < 4; i++) {
                const client = await this.createTestClient();
                clients.push(client);
                clientData.push({
                    sessionUpdates: [],
                    outputMessages: []
                });
                
                client.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        if (message.type === 'session_update') {
                            clientData[i].sessionUpdates.push(message.data);
                        } else if (message.type === 'new_output') {
                            clientData[i].outputMessages.push(message.data);
                        }
                    } catch (error) {
                        console.error(`Client ${i} parse error:`, error);
                    }
                });
            }
            
            await this.wait(500);
            
            console.log(`   Running consistency test for ${testDuration}ms...`);
            
            const startTime = performance.now();
            let updateCount = 0;
            let messageCount = 0;
            
            // Generate load while testing
            const loadInterval = setInterval(() => {
                // Session updates
                if (Math.random() < 0.3) {
                    this.webUI.updateSession({
                        iterations: updateCount,
                        currentPhase: `Load test ${updateCount}`,
                        timestamp: Date.now(),
                        loadTestData: crypto.randomBytes(16).toString('hex')
                    });
                    updateCount++;
                }
                
                // Output messages
                if (Math.random() < 0.7) {
                    this.webUI.addOutput(`Load test message ${messageCount}`, 
                        ['info', 'success', 'warning', 'error'][Math.floor(Math.random() * 4)]);
                    messageCount++;
                }
            }, 10); // Every 10ms
            
            // Wait for test duration
            await this.wait(testDuration);
            clearInterval(loadInterval);
            
            // Wait for final messages to be processed
            await this.wait(500);
            
            const endTime = performance.now();
            const actualDuration = endTime - startTime;
            
            console.log(`   Generated ${updateCount} updates and ${messageCount} messages in ${actualDuration.toFixed(2)}ms`);
            
            // Verify data consistency across clients
            for (let i = 1; i < clients.length; i++) {
                const updates0 = clientData[0].sessionUpdates.length;
                const updatesi = clientData[i].sessionUpdates.length;
                const messages0 = clientData[0].outputMessages.length;
                const messagesi = clientData[i].outputMessages.length;
                
                console.log(`   Client ${i}: ${updatesi} updates, ${messagesi} messages`);
                
                // Allow small variance due to timing
                if (Math.abs(updatesi - updates0) > 5) {
                    throw new Error(`Update count mismatch between client 0 and ${i}: ${updates0} vs ${updatesi}`);
                }
                
                if (Math.abs(messagesi - messages0) > 10) {
                    throw new Error(`Message count mismatch between client 0 and ${i}: ${messages0} vs ${messagesi}`);
                }
            }
            
            // Verify final state
            const finalIteration = this.webUI.sessionData.iterations;
            if (finalIteration !== updateCount - 1) {
                throw new Error(`Final iteration inconsistent: expected ${updateCount - 1}, got ${finalIteration}`);
            }
            
            // Clean up
            clients.forEach(client => client.close());
            
            console.log(`✅ Data consistency test passed under load`);
            this.addTestResult('DATA_CONSISTENCY_LOAD', true, 
                `Consistency maintained: ${updateCount} updates, ${messageCount} messages across ${clients.length} clients`);
            
        } catch (error) {
            console.log('❌ Data consistency under load test failed:', error.message);
            this.addTestResult('DATA_CONSISTENCY_LOAD', false, error.message);
        }
    }

    async testErrorRecoveryUnderStress() {
        console.log('🚑 Testing Error Recovery Under Stress...');
        
        try {
            const clients = [];
            let errorCount = 0;
            let recoveryCount = 0;
            
            // Create clients that will experience "errors"
            for (let i = 0; i < 3; i++) {
                const client = await this.createTestClient();
                clients.push(client);
                
                client.on('error', () => {
                    errorCount++;
                });
                
                client.on('close', () => {
                    recoveryCount++;
                });
            }
            
            await this.wait(500);
            
            // Simulate stress conditions that might cause errors
            console.log('   Simulating stress conditions...');
            
            // 1. Rapid message sending
            for (let i = 0; i < 100; i++) {
                this.webUI.addOutput(`Stress message ${i}`, 'info');
            }
            
            // 2. Force close some connections abruptly
            if (clients.length > 0) {
                clients[0].terminate(); // Abrupt termination
            }
            
            await this.wait(100);
            
            // 3. Continue sending messages (should handle dead connections gracefully)
            for (let i = 0; i < 50; i++) {
                this.webUI.addOutput(`Post-error message ${i}`, 'info');
                this.webUI.updateSession({
                    iterations: i,
                    currentPhase: `Error recovery test ${i}`
                });
            }
            
            await this.wait(500);
            
            // 4. Create new connections to verify system is still working
            const newClient = await this.createTestClient();
            let receivedMessage = false;
            
            newClient.on('message', () => {
                receivedMessage = true;
            });
            
            this.webUI.addOutput('Recovery test message', 'success');
            await this.wait(200);
            
            if (!receivedMessage) {
                throw new Error('System not responsive after stress test');
            }
            
            // Clean up
            clients.forEach(client => {
                try {
                    if (client.readyState === WebSocket.OPEN) {
                        client.close();
                    }
                } catch (error) {
                    // Expected for already closed connections
                }
            });
            newClient.close();
            
            console.log(`   Handled ${errorCount} errors and ${recoveryCount} connection closures`);
            console.log(`✅ Error recovery under stress test passed`);
            this.addTestResult('ERROR_RECOVERY_STRESS', true, 
                `System recovered from ${errorCount} errors and ${recoveryCount} connection closures`);
            
        } catch (error) {
            console.log('❌ Error recovery under stress test failed:', error.message);
            this.addTestResult('ERROR_RECOVERY_STRESS', false, error.message);
        }
    }

    async createTestClient(timeout = 5000) {
        return new Promise((resolve, reject) => {
            const token = this.webUI.sessionToken;
            const client = new WebSocket(`ws://localhost:${this.testPort}?token=${token}`);
            
            const timeoutId = setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, timeout);
            
            client.on('open', () => {
                clearTimeout(timeoutId);
                this.connections.push(client);
                resolve(client);
            });
            
            client.on('error', (error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
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

    generateStressTestReport() {
        console.log('\n⚡ CONCURRENT STRESS TEST REPORT');
        console.log('='.repeat(50));
        
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        const successRate = ((passed / total) * 100).toFixed(1);
        
        console.log(`\n📊 Overall Results: ${passed}/${total} stress tests passed (${successRate}%)\n`);
        
        for (const result of this.testResults) {
            const status = result.passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} ${result.test}`);
            console.log(`   ${result.details}`);
            console.log('');
        }
        
        // Performance analysis
        console.log('📈 PERFORMANCE ANALYSIS:');
        const memoryResult = this.testResults.find(r => r.test === 'MEMORY_LEAK_DETECTION');
        if (memoryResult && memoryResult.passed) {
            console.log('   ✓ No significant memory leaks detected');
        } else if (memoryResult) {
            console.log('   ⚠️ Potential memory leak detected');
        }
        
        const concurrentResult = this.testResults.find(r => r.test === 'CONCURRENT_UPDATES');
        if (concurrentResult && concurrentResult.passed) {
            console.log('   ✓ Data consistency maintained under concurrent load');
        }
        
        const churnResult = this.testResults.find(r => r.test === 'CONNECTION_CHURN');
        if (churnResult && churnResult.passed) {
            console.log('   ✓ System handles connection churn gracefully');
        }
        
        console.log('');
        
        // Critical issues
        const criticalFailures = this.testResults.filter(r => 
            !r.passed && ['MEMORY_LEAK_DETECTION', 'DATA_CONSISTENCY_LOAD', 'ERROR_RECOVERY_STRESS'].includes(r.test)
        );
        
        if (criticalFailures.length > 0) {
            console.log('🚨 CRITICAL PERFORMANCE ISSUES:');
            criticalFailures.forEach(failure => {
                console.log(`   - ${failure.test}: ${failure.details}`);
            });
            console.log('');
        }
        
        // Recommendations
        console.log('💡 STRESS TEST RECOMMENDATIONS:');
        if (successRate < 100) {
            console.log('   - Address failed stress tests before production deployment');
        }
        console.log('   - Monitor connection counts and implement circuit breakers if needed');
        console.log('   - Consider implementing WebSocket heartbeat mechanism');
        console.log('   - Add metrics for connection churn and message throughput');
        console.log('   - Implement graceful degradation under high load');
        console.log('');
        
        return {
            totalTests: total,
            passedTests: passed,
            successRate: parseFloat(successRate),
            criticalFailures: criticalFailures.length,
            performanceIssues: criticalFailures.map(f => f.test),
            details: this.testResults
        };
    }

    async cleanup() {
        console.log('🧹 Cleaning up stress test resources...');
        
        // Close all test connections
        for (const connection of this.connections) {
            try {
                if (connection.readyState === WebSocket.OPEN) {
                    connection.close();
                }
            } catch (error) {
                console.error('Error closing connection:', error.message);
            }
        }
        
        // Stop WebUI
        if (this.webUI) {
            try {
                await this.webUI.stop();
                console.log('✅ Stress test WebUI stopped successfully');
            } catch (error) {
                console.error('Error stopping stress test WebUI:', error.message);
            }
        }
        
        console.log('✅ Stress test cleanup completed\n');
    }
}

// Run tests if called directly
if (require.main === module) {
    const testSuite = new ConcurrentStressTestSuite();
    testSuite.runStressTests()
        .then(() => {
            console.log('🎉 Stress test suite completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Stress test suite failed:', error);
            process.exit(1);
        });
}

module.exports = ConcurrentStressTestSuite;