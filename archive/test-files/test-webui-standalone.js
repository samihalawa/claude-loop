#!/usr/bin/env node

const WebUI = require('./lib/web-ui');
const aiConfig = require('./lib/utils/ai-config-manager');

async function testWebUI() {
        const testPort1 = await aiConfig.allocatePort('test-service-1');
    console.log('🧪 Testing Web UI Standalone');
    
    try {
        const webUI = new WebUI(testPort1); // Use different port to avoid conflicts
        
        // Test starting the server
        console.log('📡 Starting Web UI server...');
        await webUI.start();
        
        // Test updating session data
        console.log('📊 Testing session updates...');
        webUI.updateSession({
            isRunning: true,
            currentPhase: 'Testing Web UI',
            iterations: 2,
            maxIterations: 10,
            startTime: Date.now()
        });
        
        // Test adding output
        console.log('📝 Testing output streaming...');
        webUI.addOutput('Testing Web UI integration', 'info');
        webUI.addOutput('Connection established successfully', 'success');
        webUI.addOutput('Sample warning message', 'warning');
        webUI.addOutput('Sample error message', 'error');
        
        
        // Clean up allocated ports
        aiConfig.releasePort(testPort1, 'test-service-1');
        console.log('✅ Web UI test completed successfully');
        console.log(`🌐 Access at: http://localhost:${testPort2}?token=${webUI.sessionToken}`);
        
        // Keep running for a few seconds to test
        setTimeout(async () => {
            console.log('🛑 Stopping Web UI...');
            await webUI.stop();
            console.log('✅ Web UI stopped successfully');
            process.exit(0);
        }, 10000);
        
    } catch (error) {
        console.error('❌ Web UI test failed:', error.message);
        process.exit(1);
    }
}

testWebUI();