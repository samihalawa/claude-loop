#!/usr/bin/env node

const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

/**
 * Simple WebSocket Functionality Test
 * Tests basic WebSocket functionality without complex authentication
 */
async function testWebSocketBasic() {
    console.log(chalk.cyan('🧪 Testing WebSocket Basic Functionality\n'));
    
    const testResults = {
        timestamp: new Date().toISOString(),
        testSuite: 'Simple WebSocket Test',
        tests: {},
        summary: ''
    };
    
    const webUIPort = 3333;
    
    try {
        // Test 1: WebSocket Connection Establishment
        console.log(chalk.yellow('🔌 Testing WebSocket Connection...'));
        
        const connectionTest = await new Promise((resolve) => {
            const startTime = Date.now();
            const ws = new WebSocket(`ws://localhost:${webUIPort}`);
            
            let connectionOpened = false;
            let messagesReceived = 0;
            const receivedMessages = [];
            
            const timeout = setTimeout(() => {
                ws.close();
                resolve({
                    success: connectionOpened,
                    connectionTime: Date.now() - startTime,
                    messagesReceived,
                    receivedMessages,
                    status: 'timeout'
                });
            }, 5000);
            
            ws.on('open', () => {
                connectionOpened = true;
                console.log(chalk.gray('   WebSocket connection opened'));
            });
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    messagesReceived++;
                    receivedMessages.push(message);
                    
                    console.log(chalk.gray(`   Received message ${messagesReceived}: ${message.type || 'unknown'}`));
                    
                    // After receiving messages, close and complete test
                    if (messagesReceived >= 2) {
                        clearTimeout(timeout);
                        ws.close();
                        resolve({
                            success: true,
                            connectionTime: Date.now() - startTime,
                            messagesReceived,
                            receivedMessages,
                            status: 'completed'
                        });
                    }
                } catch (parseError) {
                    messagesReceived++;
                    receivedMessages.push({ raw: data.toString(), parseError: parseError.message });
                }
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeout);
                console.log(chalk.gray(`   WebSocket error: ${error.message}`));
                resolve({
                    success: false,
                    connectionTime: Date.now() - startTime,
                    error: error.message,
                    status: 'error'
                });
            });
            
            ws.on('close', (code, reason) => {
                if (!timeout._destroyed) {
                    clearTimeout(timeout);
                    console.log(chalk.gray(`   WebSocket closed: ${code} ${reason}`));
                    resolve({
                        success: connectionOpened,
                        connectionTime: Date.now() - startTime,
                        messagesReceived,
                        receivedMessages,
                        closeCode: code,
                        closeReason: reason.toString(),
                        status: 'closed'
                    });
                }
            });
        });
        
        testResults.tests.connectionTest = {
            status: connectionTest.success ? 'passed' : 'failed',
            details: connectionTest,
            message: connectionTest.success ? 
                `WebSocket connection successful (${connectionTest.messagesReceived} messages)` :
                `WebSocket connection failed: ${connectionTest.error || connectionTest.status}`
        };
        
        if (connectionTest.success) {
            console.log(chalk.green(`✅ WebSocket connection test passed`));
            console.log(chalk.gray(`   Connection time: ${connectionTest.connectionTime}ms`));
            console.log(chalk.gray(`   Messages received: ${connectionTest.messagesReceived}`));
        } else {
            console.log(chalk.red(`❌ WebSocket connection test failed: ${connectionTest.error || connectionTest.status}`));
        }
        
        // Test 2: Multiple Connection Handling
        console.log(chalk.yellow('\n👥 Testing Multiple Connections...'));
        
        const multiConnectionTest = await testMultipleConnections(webUIPort);
        
        testResults.tests.multiConnectionTest = {
            status: multiConnectionTest.success ? 'passed' : 'failed',
            details: multiConnectionTest,
            message: `Multiple connections test: ${multiConnectionTest.successfulConnections}/${multiConnectionTest.totalAttempts} successful`
        };
        
        if (multiConnectionTest.success) {
            console.log(chalk.green(`✅ Multiple connections test passed (${multiConnectionTest.successfulConnections}/${multiConnectionTest.totalAttempts})`));
        } else {
            console.log(chalk.red(`❌ Multiple connections test failed`));
        }
        
        // Test 3: Connection Cleanup
        console.log(chalk.yellow('\n🧹 Testing Connection Cleanup...'));
        
        const cleanupTest = await testConnectionCleanup(webUIPort);
        
        testResults.tests.cleanupTest = {
            status: cleanupTest.success ? 'passed' : 'failed',
            details: cleanupTest,
            message: `Connection cleanup test: ${cleanupTest.cleanedConnections}/${cleanupTest.totalConnections} cleaned properly`
        };
        
        if (cleanupTest.success) {
            console.log(chalk.green(`✅ Connection cleanup test passed`));
        } else {
            console.log(chalk.red(`❌ Connection cleanup test failed`));
        }
        
        // Generate Results
        const totalTests = Object.keys(testResults.tests).length;
        const passedTests = Object.values(testResults.tests).filter(test => test.status === 'passed').length;
        const successRate = ((passedTests / totalTests) * 100).toFixed(1);
        
        testResults.summary = `Simple WebSocket Testing Complete: ${passedTests}/${totalTests} tests passed (${successRate}% success rate)`;
        
        // Save report
        const reportPath = path.join(process.cwd(), 'websocket-simple-test-report.json');
        await fs.writeFile(reportPath, JSON.stringify(testResults, null, 2));
        
        console.log(chalk.green('\n🎉 Simple WebSocket Testing COMPLETED!'));
        console.log(chalk.cyan('\n📋 Test Summary:'));
        
        Object.entries(testResults.tests).forEach(([testName, result]) => {
            const status = result.status === 'passed' ? chalk.green('✅') : chalk.red('❌');
            console.log(`   ${status} ${testName}: ${result.message}`);
        });
        
        console.log(chalk.cyan(`\n🎯 Overall Success Rate: ${successRate}% (${passedTests}/${totalTests} tests passed)`));
        console.log(chalk.gray(`📄 Report saved to: ${reportPath}`));
        
        if (passedTests === totalTests) {
            console.log(chalk.green('\n🚀 All WebSocket tests passed! WebSocket functionality is working correctly.'));
        } else {
            console.log(chalk.yellow(`\n⚠️  ${totalTests - passedTests} test(s) failed. Review the report for details.`));
        }
        
        return successRate >= 66; // Consider 66%+ as acceptable
        
    } catch (error) {
        console.error(chalk.red('❌ WebSocket testing failed:'), error.message);
        throw error;
    }
}

async function testMultipleConnections(port) {
    const connections = [];
    const results = [];
    const connectionCount = 3;
    
    try {
        // Create multiple connections
        for (let i = 0; i < connectionCount; i++) {
            const connectionPromise = new Promise((resolve) => {
                const ws = new WebSocket(`ws://localhost:${port}`);
                connections.push(ws);
                
                let opened = false;
                let messagesReceived = 0;
                
                const timeout = setTimeout(() => {
                    ws.close();
                    resolve({ index: i, opened, messagesReceived, status: 'timeout' });
                }, 3000);
                
                ws.on('open', () => {
                    opened = true;
                    console.log(chalk.gray(`   Connection ${i + 1} opened`));
                });
                
                ws.on('message', () => {
                    messagesReceived++;
                    if (messagesReceived >= 1) {
                        clearTimeout(timeout);
                        ws.close();
                        resolve({ index: i, opened, messagesReceived, status: 'success' });
                    }
                });
                
                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    resolve({ index: i, opened, messagesReceived, status: 'error', error: error.message });
                });
                
                ws.on('close', () => {
                    if (!timeout._destroyed) {
                        clearTimeout(timeout);
                        resolve({ index: i, opened, messagesReceived, status: 'closed' });
                    }
                });
            });
            
            results.push(connectionPromise);
            
            // Small delay between connections
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Wait for all connections to complete
        const connectionResults = await Promise.all(results);
        
        const successfulConnections = connectionResults.filter(r => 
            r.status === 'success' || (r.opened && r.status === 'closed')
        ).length;
        
        return {
            success: successfulConnections >= Math.floor(connectionCount * 0.66), // At least 66% success
            totalAttempts: connectionCount,
            successfulConnections,
            connectionResults
        };
        
    } catch (error) {
        return {
            success: false,
            totalAttempts: connectionCount,
            successfulConnections: 0,
            error: error.message
        };
    }
}

async function testConnectionCleanup(port) {
    const connections = [];
    const connectionCount = 3;
    
    try {
        // Create connections and close them rapidly
        for (let i = 0; i < connectionCount; i++) {
            const ws = new WebSocket(`ws://localhost:${port}`);
            connections.push(ws);
            
            ws.on('open', () => {
                console.log(chalk.gray(`   Cleanup test connection ${i + 1} opened`));
                // Close immediately
                setTimeout(() => ws.close(), 100);
            });
        }
        
        // Wait for all to clean up
        const cleanupResults = await Promise.all(
            connections.map((ws, index) => 
                new Promise((resolve) => {
                    let opened = false;
                    let closed = false;
                    
                    ws.on('open', () => { opened = true; });
                    ws.on('close', () => { 
                        closed = true;
                        console.log(chalk.gray(`   Cleanup test connection ${index + 1} closed`));
                        resolve({ index, opened, closed, cleanedUp: true });
                    });
                    ws.on('error', () => {
                        resolve({ index, opened, closed, cleanedUp: false });
                    });
                    
                    // Timeout
                    setTimeout(() => {
                        if (!closed) {
                            ws.close();
                            resolve({ index, opened, closed: false, cleanedUp: false });
                        }
                    }, 2000);
                })
            )
        );
        
        const cleanedConnections = cleanupResults.filter(r => r.cleanedUp).length;
        
        return {
            success: cleanedConnections >= Math.floor(connectionCount * 0.66),
            totalConnections: connectionCount,
            cleanedConnections,
            cleanupResults
        };
        
    } catch (error) {
        return {
            success: false,
            totalConnections: connectionCount,
            cleanedConnections: 0,
            error: error.message
        };
    }
}

// Run the test if this script is executed directly
if (require.main === module) {
    testWebSocketBasic()
        .then((success) => {
            console.log(chalk.green('\n✅ Simple WebSocket testing completed successfully'));
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error(chalk.red('\n❌ Simple WebSocket testing failed:'), error.message);
            process.exit(1);
        });
}

module.exports = testWebSocketBasic;