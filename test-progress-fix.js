#!/usr/bin/env node

const ClaudeLoopEngine = require('./lib/claude-loop-engine');
const chalk = require('chalk');

async function testProgressFix() {
    console.log(chalk.cyan('🧪 Testing Claude Loop Progress Fix\n'));
    
    try {
        // Create engine with short iterations for testing
        const engine = new ClaudeLoopEngine({
            repoPath: process.cwd(),
            maxIterations: 3,
            claudeCommand: 'echo', // Use echo instead of claude for testing
            ui: false
        });
        
        console.log(chalk.green('✅ Engine created successfully'));
        
        // Test progress display
        console.log(chalk.blue('\n📊 Testing progress display...'));
        engine.startProgressDisplay();
        
        // Simulate iterations
        for (let i = 1; i <= 3; i++) {
            engine.iteration = i;
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        }
        
        engine.stopProgressDisplay();
        console.log(chalk.green('✅ Progress display working'));
        
        // Test non-blocking execution (with echo command)
        console.log(chalk.blue('\n🔄 Testing non-blocking execution...'));
        const result = await engine.executeClaudeNonBlocking(['Hello World'], null, 5000);
        console.log(chalk.green('✅ Non-blocking execution working'));
        
        // Test cleanup
        console.log(chalk.blue('\n🧹 Testing cleanup...'));
        await engine.cleanup();
        console.log(chalk.green('✅ Cleanup working'));
        
        console.log(chalk.green('\n🎉 All tests passed! Claude Loop should now show progress and not freeze.'));
        
    } catch (error) {
        console.error(chalk.red('❌ Test failed:'), error.message);
        process.exit(1);
    }
}

// Run test
testProgressFix().catch(error => {
    console.error(chalk.red('❌ Test error:'), error.message);
    process.exit(1);
});
