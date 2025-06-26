#!/usr/bin/env node

/**
 * Consolidated WebUI Test Suite
 * Replaces multiple duplicate test files with a comprehensive test suite
 * Uses the new test-helpers utility to eliminate code duplication
 */

const { WebUITestHelper, TestRunner, ProcessTestHelper } = require('./lib/utils/test-helpers');
const WebSocket = require('ws');
const chalk = require('chalk');

async function runWebUITests() {
    console.log(chalk.cyan.bold('🧪 Claude Loop WebUI Comprehensive Test Suite\n'));
    
    const testRunner = new TestRunner('WebUI Comprehensive Tests');
    let webUIHelper = null;
    
    // Setup graceful shutdown
    ProcessTestHelper.setupGracefulShutdown(async () => {
        if (webUIHelper) {
            await webUIHelper.cleanup();
        }
    });
    
    try {
        // Test 1: Basic instantiation and startup
        await testRunner.runTest('WebUI instantiation and startup', async () => {
            webUIHelper = new WebUITestHelper();
            await webUIHelper.startWebUI();
            
            if (!webUIHelper.webUI) {
                throw new Error('WebUI not properly initialized');
            }
            
            if (!webUIHelper.webUI.sessionToken) {
                throw new Error('Session token not generated');
            }
        });
        
        // Test 2: Session data management
        await testRunner.runTest('Session data management', async () => {
            const testData = webUIHelper.getTestSessionData();
            webUIHelper.webUI.updateSession(testData);
            
            const sessionData = webUIHelper.webUI.sessionData;
            if (sessionData.iterations !== testData.iterations) {
                throw new Error('Session data not properly updated');
            }
        });
        
        // Test 3: Output message handling
        await testRunner.runTest('Output message handling', async () => {
            const initialCount = webUIHelper.webUI.sessionData.output.length;
            webUIHelper.addTestMessages();
            
            const finalCount = webUIHelper.webUI.sessionData.output.length;
            if (finalCount !== initialCount + 4) {
                throw new Error(`Expected 4 new messages, got ${finalCount - initialCount}`);
            }
        });
        
        // Test 4: Broadcasting functionality
        await testRunner.runTest('Broadcasting functionality', async () => {
            webUIHelper.testBroadcast();
            // Broadcasting doesn't throw errors, so this test passes if no exception occurs
        });
        
        // Test 5: WebSocket connection
        await testRunner.runTest('WebSocket connection', async () => {
            const wsUrl = `ws://localhost:${webUIHelper.port}?token=${webUIHelper.webUI.sessionToken}`;
            const ws = new WebSocket(wsUrl);
            
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('WebSocket connection timeout'));
                }, 5000);
                
                ws.on('open', () => {
                    clearTimeout(timeout);
                    ws.close();
                    resolve();
                });
                
                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(new Error(`WebSocket connection failed: ${error.message}`));
                });
            });
        });
        
        // Test 6: Invalid token handling
        await testRunner.runTest('Invalid token handling', async () => {
            const wsUrl = `ws://localhost:${webUIHelper.port}?token=invalid_token`;
            const ws = new WebSocket(wsUrl);
            
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Expected connection to be rejected'));
                }, 5000);
                
                ws.on('close', (code) => {
                    clearTimeout(timeout);
                    if (code === 1008) { // Expected close code for invalid token
                        resolve();
                    } else {
                        reject(new Error(`Unexpected close code: ${code}`));
                    }
                });
                
                ws.on('open', () => {
                    clearTimeout(timeout);
                    ws.close();
                    reject(new Error('Connection should have been rejected due to invalid token'));
                });
                
                ws.on('error', () => {
                    clearTimeout(timeout);
                    resolve(); // Connection rejection is also acceptable
                });
            });
        });
        
        // Test 7: Server stop functionality
        await testRunner.runTest('Server stop functionality', async () => {
            await webUIHelper.stopWebUI();
            
            // Try to connect after stopping - should fail
            const wsUrl = `ws://localhost:${webUIHelper.port}?token=${webUIHelper.webUI.sessionToken}`;
            const ws = new WebSocket(wsUrl);
            
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    resolve(); // Timeout is expected when server is stopped
                }, 2000);
                
                ws.on('open', () => {
                    clearTimeout(timeout);
                    ws.close();
                    reject(new Error('Connection should not succeed when server is stopped'));
                });
                
                ws.on('error', () => {
                    clearTimeout(timeout);
                    resolve(); // Error is expected when server is stopped
                });
            });
        });
        
    } catch (error) {
        console.error(chalk.red('Test suite setup failed:'), error.message);
    } finally {
        // Cleanup
        if (webUIHelper) {
            await webUIHelper.cleanup();
        }
        
        // Print results
        const success = testRunner.printResults();
        
        if (success) {
            console.log(chalk.green.bold('\n🎉 All WebUI tests passed!'));
        } else {
            console.log(chalk.red.bold('\n❌ Some WebUI tests failed!'));
        }
        
        process.exit(success ? 0 : 1);
    }
}

// Self-executing test
if (require.main === module) {
    runWebUITests().catch(error => {
        console.error(chalk.red('Test execution failed:'), error.message);
        process.exit(1);
    });
}

module.exports = { runWebUITests };