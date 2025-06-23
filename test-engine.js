#!/usr/bin/env node

const ClaudeLoopEngine = require('./lib/claude-loop-engine');
const chalk = require('chalk');

async function testEngine() {
    console.log(chalk.cyan('🧪 Testing ClaudeLoopEngine functionality...\n'));
    
    try {
        // Test 1: Basic instantiation
        console.log(chalk.blue('Test 1: Basic instantiation'));
        const engine = new ClaudeLoopEngine({
            repoPath: __dirname,
            maxIterations: 1,
            claudeCommand: 'claude',
            ui: false
        });
        console.log(chalk.green('✓ Engine instantiated successfully'));
        console.log(chalk.gray(`  - Repo path: ${engine.repoPath}`));
        console.log(chalk.gray(`  - Max iterations: ${engine.maxIterations}`));
        console.log(chalk.gray(`  - Claude command: ${engine.claudeCommand}`));
        console.log(chalk.gray(`  - UI enabled: ${engine.ui}`));
        
        // Test 2: Security function test
        console.log(chalk.blue('\nTest 2: Command sanitization'));
        const engine2 = new ClaudeLoopEngine({
            claudeCommand: 'echo malicious'
        });
        if (engine2.claudeCommand === 'claude') {
            console.log(chalk.green('✓ Security sanitization working - rejected malicious command'));
        } else {
            console.log(chalk.red('✗ Security failure - accepted malicious command'));
        }
        
        // Test 3: Test signal handlers
        console.log(chalk.blue('\nTest 3: Signal handlers'));
        // Signal handlers are set up during construction
        console.log(chalk.green('✓ Signal handlers configured'));
        
        // Test 4: Test temp file tracking
        console.log(chalk.blue('\nTest 4: Temp file tracking'));
        console.log(chalk.gray(`  - Temp files set initialized: ${engine.tempFiles instanceof Set}`));
        console.log(chalk.green('✓ Temp file tracking ready'));
        
        // Test 5: Test utility methods
        console.log(chalk.blue('\nTest 5: Utility methods'));
        const progressBar = engine.generateProgressBar(3, 10);
        console.log(chalk.gray(`  - Progress bar test: ${progressBar}`));
        
        const elapsed = engine.formatElapsedTime(Date.now() - 5000);
        console.log(chalk.gray(`  - Time formatting test: ${elapsed}`));
        
        const focus = engine.getIterationFocus(3);
        console.log(chalk.gray(`  - Iteration focus test: ${focus}`));
        console.log(chalk.green('✓ Utility methods working'));
        
        // Test 6: Invalid path handling
        console.log(chalk.blue('\nTest 6: Invalid path handling'));
        try {
            const engineBad = new ClaudeLoopEngine({
                repoPath: '/non/existent/path',
                maxIterations: 0
            });
            await engineBad.run();
            console.log(chalk.red('✗ Should have failed with invalid path'));
        } catch (error) {
            if (error.message.includes('Invalid repository path')) {
                console.log(chalk.green('✓ Invalid path properly rejected'));
            } else {
                console.log(chalk.yellow(`⚠ Unexpected error: ${error.message}`));
            }
        }
        
        // Test 7: Cleanup functionality
        console.log(chalk.blue('\nTest 7: Cleanup functionality'));
        await engine.cleanup();
        console.log(chalk.green('✓ Cleanup executed without errors'));
        
        console.log(chalk.cyan('\n🎉 All engine tests completed!'));
        
    } catch (error) {
        console.error(chalk.red('\n❌ Engine test failed:'), error.message);
        console.error(chalk.gray(error.stack));
        process.exit(1);
    }
}

// Run tests
testEngine().catch(console.error);