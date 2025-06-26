#!/usr/bin/env node

const WebUI = require('./lib/web-ui');
const chalk = require('chalk');
const aiConfig = require('./lib/utils/ai-config-manager');

async function startUIForTesting() {
        const testPort1 = await aiConfig.allocatePort('test-service-1');
    console.log(chalk.cyan('🧪 Starting WebUI for browser testing...\n'));
    
    const webui = new WebUI(testPort1);
    
    try {
        await webui.start();
        
        // Add some test data
        webui.updateSession({
            iterations: 3,
            currentPhase: 'Browser UI Testing',
            isRunning: true
        });
        
        webui.addOutput('🧪 Browser testing started', 'info');
        webui.addOutput('✅ WebUI server ready for testing', 'success');
        webui.addOutput('⚠️ This is a warning message', 'warning');
        webui.addOutput('❌ This is an error message for testing', 'error');
        
        console.log(chalk.green('✅ WebUI ready for browser testing'));
        console.log(chalk.cyan(`🔗 URL: http://localhost:${testPort2}?token=${webui.sessionToken}`));
        console.log(chalk.gray('\nPress Ctrl+C to stop the server\n'));
        
        // Keep the process alive
        process.on('SIGINT', async () => {
            console.log(chalk.yellow('\n🛑 Stopping WebUI server...'));
            await webui.stop();
            process.exit(0);
        });
        
        // Simulate some activity
        setInterval(() => {
            const messages = [
                'Processing repository files...',
                'Running code analysis...',
                'Applying fixes...',
                'Testing changes...'
            ];
            const types = ['info', 'success', 'warning'];
            const randomMessage = messages[Math.floor(Math.random() * messages.length)];
            const randomType = types[Math.floor(Math.random() * types.length)];
            
            webui.addOutput(randomMessage, randomType);
        }, 5000);
        
    } catch (error) {
        console.error(chalk.red('❌ Failed to start WebUI:'), error.message);
        process.exit(1);
    }
}

startUIForTesting();