const WebUI = require('./lib/web-ui.js');

async function startWebUI() {
    try {
        const webUI = new WebUI(3333);
        await webUI.start();
        
        console.log('✅ WebUI Server Started Successfully');
        console.log('🔗 Access URL: http://localhost:3333?token=' + webUI.sessionToken);
        
        // Add some test data to make the dashboard more interesting
        webUI.updateSession({
            iterations: 2,
            currentPhase: 'UI Testing Phase',
            isRunning: true
        });
        webUI.addOutput('🚀 Server started successfully', 'success');
        webUI.addOutput('📊 Dashboard ready for testing', 'info');
        webUI.addOutput('🔍 All systems operational', 'success');
        
        // Keep the process running
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down WebUI...');
            await webUI.stop();
            process.exit(0);
        });
        
    } catch (err) {
        console.error('❌ Failed to start WebUI:', err);
        process.exit(1);
    }
}

startWebUI();