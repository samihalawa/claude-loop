#!/usr/bin/env node

// Quick test script for web UI functionality
const WebUI = require('./lib/web-ui');
const config = require('./lib/config');
const { logger } = require('./lib/utils/logger');

async function testWebUI() {
    logger.info('🧪 Testing Web UI Server...');
    
    // Use config-driven port allocation
    const testPort = config.get('webUI.port') + 1; // Offset to avoid conflicts
    const webUI = new WebUI(testPort);
    
    try {
        // Start the server
        await webUI.start();
        logger.success('Web UI server started successfully');
        
        // Test session updates
        webUI.updateSession({
            iterations: 3,
            currentPhase: 'Testing UI Components',
            isRunning: true,
            startTime: Date.now() - 30000 // 30 seconds ago
        });
        logger.success('Session update test passed');
        
        // Test output messages
        webUI.addOutput('Test info message', 'info');
        webUI.addOutput('Test success message', 'success');
        webUI.addOutput('Test warning message', 'warning');
        webUI.addOutput('Test error message', 'error');
        logger.success('Output message tests passed');
        
        // Test broadcasting
        webUI.broadcast({
            type: 'test_message',
            data: { test: 'broadcast working' }
        });
        logger.success('Broadcast test passed');
        
        logger.info(`🌐 Web UI running at: http://localhost:${testPort}/?token=${webUI.sessionToken}`);
        logger.info('📝 Test messages sent to UI');
        logger.info('🔗 Open the URL in your browser to test the interface');
        logger.info('⏸️  Press Ctrl+C to stop the server when done testing');
        
        // Keep server running
        process.on('SIGINT', async () => {
            logger.info('🛑 Stopping test server...');
            await webUI.stop();
            process.exit(0);
        });
        
    } catch (error) {
        logger.error('Web UI test failed', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    testWebUI();
}

module.exports = { testWebUI };