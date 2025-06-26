const WebUI = require('./lib/web-ui.js');
const { logger } = require('./lib/utils/logger');
const envValidator = require('./lib/utils/env-validator');

async function startWebUI() {
    try {
        // Validate environment first
        const validation = envValidator.validateEnvironment();
        envValidator.generateReport(validation);
        
        if (!validation.valid) {
            logger.error('Environment validation failed. Please fix the errors above.');
            process.exit(1);
        }

        const port = validation.sanitized.WEBUI_PORT || 3333;
        const webUI = new WebUI(port);
        await webUI.start();
        
        logger.success('WebUI Server Started Successfully');
        // For development/testing: expose full token
        console.log(`Access URL: http://localhost:${port}?token=${webUI.sessionToken}`);
        console.log(`Full Token: ${webUI.sessionToken}`);
        const maskedToken = webUI.sessionToken.substring(0, 8) + '...';
        logger.security(`Session token (first 8 chars): ${maskedToken}`);
        
        // Add some test data to make the dashboard more interesting
        webUI.updateSession({
            iterations: 2,
            currentPhase: 'UI Testing Phase',
            isRunning: true
        });
        webUI.addOutput('Server started successfully', 'success');
        webUI.addOutput('Dashboard ready for testing', 'info');
        webUI.addOutput('All systems operational', 'success');
        
        // Keep the process running
        process.on('SIGINT', async () => {
            logger.info('Shutting down WebUI...');
            await webUI.stop();
            process.exit(0);
        });
        
    } catch (err) {
        logger.error('Failed to start WebUI:', err.message);
        process.exit(1);
    }
}

startWebUI();