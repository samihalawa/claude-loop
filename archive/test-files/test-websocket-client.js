#!/usr/bin/env node

const WebSocket = require('ws');
const chalk = require('chalk');

async function testWebSocketClient() {
    console.log(chalk.cyan('🧪 Testing WebSocket client connectivity...\n'));
    
    // Get token from environment or generate one for testing
    const token = process.env.WEBUI_TEST_TOKEN || 
                  require('crypto').randomBytes(48).toString('hex');
    const port = process.env.WEBUI_PORT || 3333;
    const url = `ws://localhost:${port}?token=${token}`;
    
    console.log(chalk.gray(`Using test token: ${token.substring(0, 8)}...`));
    console.log(chalk.gray(`Connecting to: ws://localhost:${port}`));
    
    const ws = new WebSocket(url);
    
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('WebSocket connection timeout'));
        }, 10000);
        
        ws.on('open', () => {
            clearTimeout(timeout);
            console.log(chalk.green('✅ WebSocket connected successfully'));
            
            // Send a test message
            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        });
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log(chalk.blue('📨 Received message:'), message.type);
                
                if (message.type === 'session_data') {
                    console.log(chalk.gray('   - Session iterations:'), message.data.iterations);
                    console.log(chalk.gray('   - Current phase:'), message.data.currentPhase);
                    console.log(chalk.gray('   - Is running:'), message.data.isRunning);
                    console.log(chalk.gray('   - Output entries:'), message.data.output.length);
                } else if (message.type === 'new_output') {
                    console.log(chalk.gray('   - Output type:'), message.data.type);
                    console.log(chalk.gray('   - Message:'), message.data.message.substring(0, 50) + '...');
                } else if (message.type === 'pong') {
                    console.log(chalk.gray('   - Pong received'));
                }
            } catch (error) {
                console.error(chalk.red('❌ Error parsing message:'), error.message);
            }
        });
        
        ws.on('error', (error) => {
            clearTimeout(timeout);
            console.error(chalk.red('❌ WebSocket error:'), error.message);
            reject(error);
        });
        
        ws.on('close', (code, reason) => {
            clearTimeout(timeout);
            console.log(chalk.yellow(`🔌 WebSocket closed: ${code} - ${reason}`));
            resolve();
        });
        
        // Close after 5 seconds
        setTimeout(() => {
            console.log(chalk.cyan('\n🔌 Closing WebSocket connection...'));
            ws.close();
        }, 5000);
    });
}

testWebSocketClient()
    .then(() => {
        console.log(chalk.green('\n✅ WebSocket test completed successfully'));
        process.exit(0);
    })
    .catch((error) => {
        console.error(chalk.red('\n❌ WebSocket test failed:'), error.message);
        process.exit(1);
    });