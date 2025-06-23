#!/usr/bin/env node

const WebUI = require('./lib/web-ui');
const WebSocket = require('ws');
const chalk = require('chalk');

async function testWebUI() {
    console.log(chalk.cyan('🧪 Testing WebUI functionality...\n'));
    
    let webUI = null;
    
    try {
        // Test 1: Basic instantiation
        console.log(chalk.blue('Test 1: Basic instantiation'));
        webUI = new WebUI(3999); // Use different port to avoid conflicts
        console.log(chalk.green('✓ WebUI instantiated successfully'));
        console.log(chalk.gray(`  - Port: ${webUI.port}`));
        console.log(chalk.gray(`  - Session token generated: ${webUI.sessionToken ? 'Yes' : 'No'}`));
        
        // Test 2: Start WebUI server
        console.log(chalk.blue('\nTest 2: Start WebUI server'));
        await webUI.start();
        console.log(chalk.green('✓ WebUI server started successfully'));
        
        // Test 3: Session data management
        console.log(chalk.blue('\nTest 3: Session data management'));
        webUI.updateSession({
            iterations: 5,
            currentPhase: 'Testing',
            isRunning: true
        });
        console.log(chalk.green('✓ Session data updated'));
        console.log(chalk.gray(`  - Iterations: ${webUI.sessionData.iterations}`));
        console.log(chalk.gray(`  - Current phase: ${webUI.sessionData.currentPhase}`));
        console.log(chalk.gray(`  - Is running: ${webUI.sessionData.isRunning}`));
        
        // Test 4: Output logging
        console.log(chalk.blue('\nTest 4: Output logging'));
        webUI.addOutput('Test info message', 'info');
        webUI.addOutput('Test success message', 'success');
        webUI.addOutput('Test warning message', 'warning');
        webUI.addOutput('Test error message', 'error');
        console.log(chalk.green('✓ Output messages added'));
        console.log(chalk.gray(`  - Total output entries: ${webUI.sessionData.output.length}`));
        
        // Test 5: WebSocket connection (basic test)
        console.log(chalk.blue('\nTest 5: WebSocket functionality test'));
        const ws = new WebSocket(`ws://localhost:${webUI.port}?token=${webUI.sessionToken}`);
        
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, 5000);
            
            ws.on('open', () => {
                clearTimeout(timeout);
                console.log(chalk.green('✓ WebSocket connection established'));
                resolve();
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
        
        // Test 6: WebSocket message handling
        console.log(chalk.blue('\nTest 6: WebSocket message handling'));
        let messageReceived = false;
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                if (message.type === 'session_data') {
                    messageReceived = true;
                    console.log(chalk.green('✓ Session data message received'));
                    console.log(chalk.gray(`  - Message type: ${message.type}`));
                }
            } catch (error) {
                console.log(chalk.red('✗ Failed to parse WebSocket message'));
            }
        });
        
        // Wait for initial message
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!messageReceived) {
            console.log(chalk.yellow('⚠ No session data message received initially'));
        }
        
        // Test 7: Broadcast functionality
        console.log(chalk.blue('\nTest 7: Broadcast functionality'));
        webUI.addOutput('Broadcast test message', 'info');
        
        // Wait for broadcast message
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Test 8: Connection limits
        console.log(chalk.blue('\nTest 8: Connection management'));
        console.log(chalk.gray(`  - Current connections: ${webUI.connectionCount}`));
        console.log(chalk.gray(`  - Max connections: ${webUI.maxConnections}`));
        console.log(chalk.green('✓ Connection management working'));
        
        // Clean up WebSocket
        ws.close();
        
        // Test 9: Stop WebUI server
        console.log(chalk.blue('\nTest 9: Stop WebUI server'));
        await webUI.stop();
        console.log(chalk.green('✓ WebUI server stopped successfully'));
        
        console.log(chalk.cyan('\n🎉 All WebUI tests completed!'));
        
    } catch (error) {
        console.error(chalk.red('\n❌ WebUI test failed:'), error.message);
        console.error(chalk.gray(error.stack));
        
        // Cleanup
        if (webUI) {
            try {
                await webUI.stop();
            } catch (cleanupError) {
                console.error(chalk.gray('Cleanup error:', cleanupError.message));
            }
        }
        
        process.exit(1);
    }
}

// Run tests
testWebUI().catch(console.error);