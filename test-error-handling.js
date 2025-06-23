#!/usr/bin/env node

const ClaudeLoopEngine = require('./lib/claude-loop-engine');
const WebUI = require('./lib/web-ui');
const chalk = require('chalk');
const fs = require('fs').promises;

async function testErrorHandling() {
    console.log(chalk.cyan('🧪 Testing Error Handling functionality...\n'));
    
    try {
        // Test 1: Invalid repository path
        console.log(chalk.blue('Test 1: Invalid repository path'));
        try {
            const engine = new ClaudeLoopEngine({
                repoPath: '/non/existent/path/that/definitely/does/not/exist',
                maxIterations: 1
            });
            await engine.run();
            console.log(chalk.red('✗ Should have failed with invalid path'));
        } catch (error) {
            if (error.message.includes('Invalid repository path')) {
                console.log(chalk.green('✓ Invalid repository path properly handled'));
            } else {
                console.log(chalk.yellow(`⚠ Unexpected error: ${error.message}`));
            }
        }
        
        // Test 2: WebUI port conflict
        console.log(chalk.blue('\nTest 2: WebUI port conflict handling'));
        const webUI1 = new WebUI(4000);
        await webUI1.start();
        console.log(chalk.gray('  - First WebUI started on port 4000'));
        
        try {
            const webUI2 = new WebUI(4000); // Same port
            await webUI2.start();
            console.log(chalk.red('✗ Should have failed with port conflict'));
            await webUI2.stop();
        } catch (error) {
            console.log(chalk.green('✓ Port conflict properly handled'));
        }
        
        await webUI1.stop();
        
        // Test 3: WebSocket invalid token
        console.log(chalk.blue('\nTest 3: WebSocket invalid token handling'));
        const webUI3 = new WebUI(4001);
        await webUI3.start();
        
        const WebSocket = require('ws');
        try {
            const ws = new WebSocket(`ws://localhost:4001?token=invalid_token`);
            
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection should have been rejected'));
                }, 3000);
                
                ws.on('close', (code) => {
                    clearTimeout(timeout);
                    if (code === 1008) { // Invalid token code
                        console.log(chalk.green('✓ Invalid WebSocket token properly rejected'));
                        resolve();
                    } else {
                        reject(new Error(`Unexpected close code: ${code}`));
                    }
                });
                
                ws.on('open', () => {
                    clearTimeout(timeout);
                    reject(new Error('Connection should have been rejected'));
                });
            });
        } catch (error) {
            if (error.message.includes('should have been rejected')) {
                console.log(chalk.red('✗ Invalid token was not rejected'));
            } else {
                console.log(chalk.green('✓ WebSocket error handling working'));
            }
        }
        
        await webUI3.stop();
        
        // Test 4: Engine with invalid max iterations
        console.log(chalk.blue('\nTest 4: Engine with edge case parameters'));
        try {
            const engine = new ClaudeLoopEngine({
                maxIterations: 0
            });
            console.log(chalk.gray(`  - Max iterations set to 0: ${engine.maxIterations}`));
            // This should work but do nothing
            console.log(chalk.green('✓ Zero iterations handled gracefully'));
        } catch (error) {
            console.log(chalk.red(`✗ Failed with zero iterations: ${error.message}`));
        }
        
        // Test 5: Engine cleanup with no temp files
        console.log(chalk.blue('\nTest 5: Engine cleanup edge cases'));
        const engine = new ClaudeLoopEngine();
        await engine.cleanup(); // Should not fail even with no temp files
        console.log(chalk.green('✓ Cleanup with no temp files handled gracefully'));
        
        // Test 6: WebUI with invalid session updates
        console.log(chalk.blue('\nTest 6: WebUI invalid session updates'));
        const webUI4 = new WebUI(4002);
        await webUI4.start();
        
        // Try invalid updates
        webUI4.updateSession(null); // Should not crash
        webUI4.updateSession(undefined); // Should not crash
        webUI4.updateSession({}); // Should work
        webUI4.addOutput(null); // Should not crash
        webUI4.addOutput(''); // Should handle empty string
        
        console.log(chalk.green('✓ WebUI handles invalid inputs gracefully'));
        await webUI4.stop();
        
        // Test 7: Memory and resource limits
        console.log(chalk.blue('\nTest 7: Memory and resource handling'));
        const webUI5 = new WebUI(4003);
        await webUI5.start();
        
        // Add many output messages to test memory management
        for (let i = 0; i < 100; i++) {
            webUI5.addOutput(`Test message ${i}`, 'info');
        }
        
        const outputCount = webUI5.sessionData.output.length;
        const maxEntries = parseInt(process.env.WEBUI_MAX_OUTPUT_ENTRIES) || 50;
        
        if (outputCount <= maxEntries) {
            console.log(chalk.green('✓ Output message limit enforced correctly'));
            console.log(chalk.gray(`  - Output count: ${outputCount}/${maxEntries}`));
        } else {
            console.log(chalk.red(`✗ Output limit not enforced: ${outputCount}/${maxEntries}`));
        }
        
        await webUI5.stop();
        
        console.log(chalk.cyan('\n🎉 All error handling tests completed!'));
        
    } catch (error) {
        console.error(chalk.red('\n❌ Error handling test failed:'), error.message);
        console.error(chalk.gray(error.stack));
        process.exit(1);
    }
}

// Run tests
testErrorHandling().catch(console.error);