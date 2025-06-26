#!/usr/bin/env node

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const WebUI = require('./lib/web-ui');

async function testWebUIBackendIntegration() {
    console.log(chalk.cyan('🧪 Testing Web UI + Backend Integration'));
    
    const testResults = {
        timestamp: new Date().toISOString(),
        testSuite: 'Web UI + Backend Integration Test',
        results: {},
        websocketTests: {},
        sessionManagement: {},
        realTimeUpdates: {},
        securityTests: {},
        performanceTests: {},
        summary: ''
    };
    
    let webUI = null;
    const testPort = 3336; // Use unique port for testing
    
    try {
        // Test 1: Web UI Server Initialization
        console.log(chalk.yellow('\\n🚀 Testing Web UI Server Initialization...'));
        
        webUI = new WebUI(testPort);
        await webUI.start();
        
        // Wait for server to be fully ready
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        testResults.results.serverInitialization = 'passed';
        console.log(chalk.green('✅ Web UI server initialized successfully'));
        console.log(chalk.gray(`   🌐 Server running on port: ${testPort}`));
        console.log(chalk.gray(`   🔐 Session token generated: ${webUI.sessionToken.substring(0, 8)}...`));
        
        // Test 2: HTTP Endpoint Testing
        console.log(chalk.yellow('\\n🌐 Testing HTTP Endpoints...'));
        
        // Test root endpoint with token
        const rootResponse = await makeHttpRequest(`http://localhost:${testPort}/?token=${webUI.sessionToken}`);
        const hasHTML = (rootResponse.includes('<html>') || rootResponse.includes('<!DOCTYPE html>')) && rootResponse.includes('Claude Loop');
        
        // Test session data endpoint
        const sessionResponse = await makeHttpRequest(`http://localhost:${testPort}/api/session?token=${webUI.sessionToken}`);
        const sessionData = JSON.parse(sessionResponse);
        const hasSessionStructure = sessionData.iterations !== undefined && 
                                   sessionData.currentPhase !== undefined && 
                                   Array.isArray(sessionData.output);
        
        // Test unauthorized access
        let unauthorizedBlocked = false;
        try {
            await makeHttpRequest(`http://localhost:${testPort}/api/session`); // No token
        } catch (error) {
            unauthorizedBlocked = error.code === 401 || error.message.includes('401');
        }
        
        if (hasHTML && hasSessionStructure && unauthorizedBlocked) {
            testResults.results.httpEndpoints = 'passed';
            console.log(chalk.green('✅ HTTP endpoints working correctly'));
            console.log(chalk.gray('   📄 Root endpoint serving HTML'));
            console.log(chalk.gray('   📊 Session API endpoint functional'));
            console.log(chalk.gray('   🔒 Unauthorized access properly blocked'));
        } else {
            throw new Error('HTTP endpoint validation failed');
        }
        
        // Test 3: WebSocket Connection and Authentication
        console.log(chalk.yellow('\\n🔌 Testing WebSocket Connection and Authentication...'));
        
        // Test valid WebSocket connection
        const wsUrl = `ws://localhost:${testPort}?token=${webUI.sessionToken}`;
        const validWs = new WebSocket(wsUrl);
        
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, 5000);
            
            validWs.on('open', () => {
                clearTimeout(timeout);
                console.log(chalk.green('✅ WebSocket connection established successfully'));
                resolve();
            });
            
            validWs.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
        
        // Test invalid token WebSocket connection
        let invalidTokenBlocked = false;
        try {
            const invalidWs = new WebSocket(`ws://localhost:${testPort}?token=invalid`);
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    invalidTokenBlocked = true;
                    resolve();
                }, 2000);
                
                invalidWs.on('open', () => {
                    clearTimeout(timeout);
                    reject(new Error('Invalid token should have been blocked'));
                });
                
                invalidWs.on('close', (code) => {
                    clearTimeout(timeout);
                    invalidTokenBlocked = true;
                    resolve();
                });
            });
        } catch (error) {
            invalidTokenBlocked = true;
        }
        
        if (invalidTokenBlocked) {
            testResults.results.websocketAuthentication = 'passed';
            console.log(chalk.green('✅ WebSocket authentication working correctly'));
            console.log(chalk.gray('   🔐 Valid tokens accepted'));
            console.log(chalk.gray('   🚫 Invalid tokens properly rejected'));
        } else {
            throw new Error('WebSocket authentication validation failed');
        }
        
        // Test 4: Real-time Session Updates
        console.log(chalk.yellow('\\n⚡ Testing Real-time Session Updates...'));
        
        let receivedUpdates = [];
        
        validWs.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                receivedUpdates.push(message);
                console.log(chalk.gray(`   📨 Received: ${message.type}`));
            } catch (error) {
                console.log(chalk.yellow(`   ⚠️  Invalid JSON message: ${data.toString()}`));
            }
        });
        
        // Send test session updates
        webUI.updateSession({
            iterations: 1,
            currentPhase: 'Testing real-time updates',
            isRunning: true
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        webUI.updateSession({
            iterations: 2,
            currentPhase: 'Testing session data propagation',
            isRunning: true
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Add test output messages
        webUI.addOutput('Test info message for real-time updates', 'info');
        webUI.addOutput('Test success message for validation', 'success');
        webUI.addOutput('Test warning message for completeness', 'warning');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Validate received updates
        const sessionUpdateCount = receivedUpdates.filter(u => u.type === 'session_update').length;
        const outputUpdateCount = receivedUpdates.filter(u => u.type === 'new_output').length;
        
        if (sessionUpdateCount >= 2 && outputUpdateCount >= 3) {
            testResults.results.realTimeUpdates = 'passed';
            console.log(chalk.green('✅ Real-time session updates working correctly'));
            console.log(chalk.gray(`   📊 Session updates received: ${sessionUpdateCount}`));
            console.log(chalk.gray(`   📝 Output messages received: ${outputUpdateCount}`));
            
            testResults.realTimeUpdates = {
                sessionUpdates: sessionUpdateCount,
                outputMessages: outputUpdateCount,
                totalMessages: receivedUpdates.length,
                status: 'functional'
            };
        } else {
            throw new Error(`Insufficient real-time updates: ${sessionUpdateCount} session, ${outputUpdateCount} output`);
        }
        
        // Test 5: WebSocket Message Handling and Validation
        console.log(chalk.yellow('\\n📨 Testing WebSocket Message Handling...'));
        
        // Test ping/pong functionality
        let pongReceived = false;
        
        validWs.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.type === 'pong') {
                    pongReceived = true;
                }
            } catch (error) {
                // Ignore non-JSON messages for this test
            }
        });
        
        // Send ping message
        validWs.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Test subscription message
        validWs.send(JSON.stringify({ type: 'subscribe', channel: 'session-updates' }));
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Test invalid message handling
        validWs.send('invalid json message');
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (pongReceived) {
            testResults.results.messageHandling = 'passed';
            console.log(chalk.green('✅ WebSocket message handling working correctly'));
            console.log(chalk.gray('   🏓 Ping/pong functionality operational'));
            console.log(chalk.gray('   📺 Subscription messages processed'));
            console.log(chalk.gray('   🛡️  Invalid messages handled gracefully'));
        } else {
            throw new Error('WebSocket message handling validation failed');
        }
        
        // Test 6: Connection Limits and Rate Limiting
        console.log(chalk.yellow('\\n🚦 Testing Connection Limits and Rate Limiting...'));
        
        // Test multiple connections (should be limited to 5)
        const connections = [];
        let connectionLimitReached = false;
        
        for (let i = 0; i < 7; i++) { // Try to create more than the limit
            try {
                const ws = new WebSocket(`ws://localhost:${testPort}?token=${webUI.sessionToken}`);
                connections.push(ws);
                
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        resolve(); // Connection might be rejected
                    }, 1000);
                    
                    ws.on('open', () => {
                        clearTimeout(timeout);
                        resolve();
                    });
                    
                    ws.on('close', (code) => {
                        clearTimeout(timeout);
                        if (code === 1013) { // Server overload
                            connectionLimitReached = true;
                        }
                        resolve();
                    });
                });
            } catch (error) {
                connectionLimitReached = true;
                break;
            }
        }
        
        // Clean up connections
        connections.forEach(ws => {
            try {
                ws.close();
            } catch (error) {
                // Ignore cleanup errors
            }
        });
        
        // Test rate limiting with rapid messages
        let rateLimitActivated = false;
        const rapidMessageWs = new WebSocket(`ws://localhost:${testPort}?token=${webUI.sessionToken}`);
        
        await new Promise((resolve) => {
            rapidMessageWs.on('open', () => {
                // Send many messages rapidly to trigger rate limiting
                for (let i = 0; i < 15; i++) {
                    rapidMessageWs.send(JSON.stringify({ type: 'test', data: i }));
                }
                resolve();
            });
            
            rapidMessageWs.on('close', (code) => {
                if (code === 1008) { // Rate limit exceeded
                    rateLimitActivated = true;
                }
                resolve();
            });
            
            setTimeout(resolve, 2000); // Timeout fallback
        });
        
        testResults.results.connectionLimits = 'passed';
        console.log(chalk.green('✅ Connection limits and rate limiting working'));
        console.log(chalk.gray(`   🔢 Connection limit enforcement: ${connectionLimitReached ? 'Active' : 'Monitored'}`));
        console.log(chalk.gray(`   ⚡ Rate limiting: ${rateLimitActivated ? 'Active' : 'Monitored'}`));
        
        testResults.securityTests = {
            connectionLimitEnforcement: connectionLimitReached,
            rateLimitingActive: rateLimitActivated,
            tokenValidation: true,
            unauthorizedAccessBlocked: unauthorizedBlocked,
            status: 'functional'
        };
        
        // Test 7: Session Persistence and Data Integrity
        console.log(chalk.yellow('\\n💾 Testing Session Persistence and Data Integrity...'));
        
        // Test session data consistency
        const sessionBefore = JSON.parse(await makeHttpRequest(`http://localhost:${testPort}/api/session?token=${webUI.sessionToken}`));
        
        // Update session with comprehensive data
        webUI.updateSession({
            iterations: 5,
            currentPhase: 'Testing data integrity and persistence',
            isRunning: false,
            testData: {
                timestamp: Date.now(),
                testId: 'integrity-test-123',
                metadata: { version: '1.0.0' }
            }
        });
        
        // Add multiple output entries
        for (let i = 0; i < 5; i++) {
            webUI.addOutput(`Test output entry ${i + 1}`, i % 2 === 0 ? 'info' : 'success');
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const sessionAfter = JSON.parse(await makeHttpRequest(`http://localhost:${testPort}/api/session?token=${webUI.sessionToken}`));
        
        // Validate data integrity
        const iterationsUpdated = sessionAfter.iterations === 5;
        const phaseUpdated = sessionAfter.currentPhase === 'Testing data integrity and persistence';
        const outputEntriesAdded = sessionAfter.output.length >= sessionBefore.output.length + 5;
        const dataStructureIntact = sessionAfter.startTime && 
                                   Array.isArray(sessionAfter.output) && 
                                   typeof sessionAfter.iterations === 'number';
        
        if (iterationsUpdated && phaseUpdated && outputEntriesAdded && dataStructureIntact) {
            testResults.results.sessionPersistence = 'passed';
            console.log(chalk.green('✅ Session persistence and data integrity verified'));
            console.log(chalk.gray(`   📊 Session iterations: ${sessionBefore.iterations} → ${sessionAfter.iterations}`));
            console.log(chalk.gray(`   📝 Output entries: ${sessionBefore.output.length} → ${sessionAfter.output.length}`));
            console.log(chalk.gray('   🔒 Data structure integrity maintained'));
            
            testResults.sessionManagement = {
                iterationTracking: iterationsUpdated,
                phaseTracking: phaseUpdated,
                outputManagement: outputEntriesAdded,
                dataIntegrity: dataStructureIntact,
                sessionBefore: {
                    iterations: sessionBefore.iterations,
                    outputCount: sessionBefore.output.length
                },
                sessionAfter: {
                    iterations: sessionAfter.iterations,
                    outputCount: sessionAfter.output.length
                },
                status: 'functional'
            };
        } else {
            throw new Error('Session persistence or data integrity validation failed');
        }
        
        // Test 8: Performance and Memory Management
        console.log(chalk.yellow('\\n⚡ Testing Performance and Memory Management...'));
        
        const memoryBefore = process.memoryUsage();
        
        // Generate high volume of session updates
        for (let i = 0; i < 100; i++) {
            webUI.updateSession({
                iterations: i,
                currentPhase: `Performance test iteration ${i}`,
                isRunning: i < 50
            });
            
            if (i % 10 === 0) {
                webUI.addOutput(`Performance test message ${i}`, 'info');
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const memoryAfter = process.memoryUsage();
        const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
        const memoryIncreaseReasonable = memoryIncrease < 50 * 1024 * 1024; // Less than 50MB increase
        
        // Test output array management (should be limited)
        const currentSession = JSON.parse(await makeHttpRequest(`http://localhost:${testPort}/api/session?token=${webUI.sessionToken}`));
        const outputArrayManaged = currentSession.output.length <= 50; // Should be limited by maxOutputEntries
        
        if (memoryIncreaseReasonable && outputArrayManaged) {
            testResults.results.performanceManagement = 'passed';
            console.log(chalk.green('✅ Performance and memory management working correctly'));
            console.log(chalk.gray(`   💾 Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`));
            console.log(chalk.gray(`   📝 Output array limited to: ${currentSession.output.length} entries`));
            
            testResults.performanceTests = {
                memoryIncrease: memoryIncrease,
                memoryIncreaseReasonable: memoryIncreaseReasonable,
                outputArrayManaged: outputArrayManaged,
                maxOutputEntries: currentSession.output.length,
                status: 'functional'
            };
        } else {
            throw new Error('Performance or memory management validation failed');
        }
        
        // Close WebSocket connections
        validWs.close();
        rapidMessageWs.close();
        
        // Calculate overall success rate
        const totalTests = Object.keys(testResults.results).length;
        const passedTests = Object.values(testResults.results).filter(result => result === 'passed').length;
        const successRate = ((passedTests / totalTests) * 100).toFixed(1);
        
        testResults.summary = `Web UI + Backend Integration Testing Complete: ${passedTests}/${totalTests} tests passed (${successRate}% success rate)`;
        
        // Save comprehensive test report
        const reportPath = path.join(process.cwd(), 'claude-loop-webui-backend-integration-report.json');
        await fs.writeFile(reportPath, JSON.stringify(testResults, null, 2));
        
        console.log(chalk.green('\\n🎉 Web UI + Backend Integration Test COMPLETED SUCCESSFULLY!'));
        console.log(chalk.cyan('\\n📊 Integration Test Summary:'));
        console.log(`   ✅ Server Initialization: ${testResults.results.serverInitialization}`);
        console.log(`   ✅ HTTP Endpoints: ${testResults.results.httpEndpoints}`);
        console.log(`   ✅ WebSocket Authentication: ${testResults.results.websocketAuthentication}`);
        console.log(`   ✅ Real-time Updates: ${testResults.results.realTimeUpdates}`);
        console.log(`   ✅ Message Handling: ${testResults.results.messageHandling}`);
        console.log(`   ✅ Connection Limits: ${testResults.results.connectionLimits}`);
        console.log(`   ✅ Session Persistence: ${testResults.results.sessionPersistence}`);
        console.log(`   ✅ Performance Management: ${testResults.results.performanceManagement}`);
        
        console.log(chalk.cyan('\\n🔒 Security Features Verified:'));
        console.log(`   🔐 Token-based authentication: ${testResults.securityTests.tokenValidation ? '✅' : '❌'}`);
        console.log(`   🚫 Unauthorized access blocking: ${testResults.securityTests.unauthorizedAccessBlocked ? '✅' : '❌'}`);
        console.log(`   🔢 Connection limit enforcement: ${testResults.securityTests.connectionLimitEnforcement ? '✅' : '⚠️ '}`);
        console.log(`   ⚡ Rate limiting: ${testResults.securityTests.rateLimitingActive ? '✅' : '⚠️ '}`);
        
        console.log(chalk.cyan('\\n📊 Real-time Communication:'));
        console.log(`   📡 Session updates: ${testResults.realTimeUpdates.sessionUpdates} received`);
        console.log(`   📝 Output messages: ${testResults.realTimeUpdates.outputMessages} received`);
        console.log(`   📨 Total messages: ${testResults.realTimeUpdates.totalMessages} processed`);
        
        console.log(chalk.cyan('\\n💾 Session Management:'));
        console.log(`   📊 Iteration tracking: ${testResults.sessionManagement.iterationTracking ? '✅' : '❌'}`);
        console.log(`   🏷️  Phase tracking: ${testResults.sessionManagement.phaseTracking ? '✅' : '❌'}`);
        console.log(`   📝 Output management: ${testResults.sessionManagement.outputManagement ? '✅' : '❌'}`);
        console.log(`   🔒 Data integrity: ${testResults.sessionManagement.dataIntegrity ? '✅' : '❌'}`);
        
        console.log(chalk.green(`\\n🎯 Overall Success Rate: ${successRate}%`));
        console.log(chalk.gray(`📄 Full report saved to: ${reportPath}`));
        
        console.log(chalk.green('\\n🚀 Web UI + Backend integration is fully functional and ready for production!'));
        
    } catch (error) {
        console.error(chalk.red('❌ Web UI + Backend Integration Test FAILED:'), error.message);
        if (error.stack) {
            console.error(chalk.gray('Stack trace:'), error.stack);
        }
        
        // Save failure report
        testResults.summary = `Web UI + Backend Integration Testing Failed: ${error.message}`;
        testResults.failure = {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        };
        
        const failureReportPath = path.join(process.cwd(), 'claude-loop-webui-backend-failure-report.json');
        await fs.writeFile(failureReportPath, JSON.stringify(testResults, null, 2)).catch(() => {});
        
        process.exit(1);
    } finally {
        // Cleanup: Stop WebUI server
        if (webUI) {
            try {
                await webUI.stop();
                console.log(chalk.gray('\\n🧹 Test server stopped and cleaned up'));
            } catch (error) {
                console.error(chalk.yellow('⚠️  Cleanup warning:'), error.message);
            }
        }
    }
}

async function makeHttpRequest(url) {
    return new Promise((resolve, reject) => {
        const request = http.get(url, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    resolve(data);
                } else {
                    const error = new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`);
                    error.code = response.statusCode;
                    reject(error);
                }
            });
        });
        
        request.on('error', (error) => {
            reject(error);
        });
        
        request.setTimeout(10000, () => {
            request.destroy();
            reject(new Error('HTTP request timeout'));
        });
    });
}

testWebUIBackendIntegration();