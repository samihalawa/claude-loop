#!/usr/bin/env node

/**
 * Simple server test to debug Express server issues
 */

const path = require('path');
const chalk = require('chalk');

async function testWebUIClass() {
        const testPort1 = await aiConfig.allocatePort('test-service-1');
    console.log(chalk.blue('Testing WebUI class instantiation...'));
    
    try {
        const WebUI = require('./lib/web-ui');
        console.log(chalk.green('✓ WebUI class loaded successfully'));
        
        // Create instance
        const webUI = new WebUI(testPort1); // Use different port to avoid conflicts
        console.log(chalk.green('✓ WebUI instance created successfully'));
        console.log(chalk.gray(`Port: ${webUI.port}`));
        console.log(chalk.gray(`Token: ${webUI.sessionToken.substring(0, 10)}...`));
        
        // Try to start the server
        console.log(chalk.blue('Starting WebUI server...'));
        await webUI.start();
        console.log(chalk.green('✓ WebUI server started successfully'));
        
        // Test basic functionality
        console.log(chalk.blue('Testing server endpoints...'));
        
        // Test health endpoint without auth (should fail)
        try {
            const response = await fetch(`http://localhost:${testPort2}/health`);
            console.log(chalk.yellow(`Health endpoint response: ${response.status}`));
        } catch (error) {
            console.log(chalk.red(`Health endpoint error: ${error.message}`));
        }
        
        // Test health endpoint with auth
        try {
            const response = await fetch(`http://localhost:${testPort3}/health?token=${webUI.sessionToken}`);
            const data = await response.json();
            console.log(chalk.green(`✓ Health endpoint with auth: ${response.status}`));
            console.log(chalk.gray(`Response: ${JSON.stringify(data)}`));
        } catch (error) {
            console.log(chalk.red(`Health endpoint with auth error: ${error.message}`));
        }
        
        // Stop the server
        console.log(chalk.blue('Stopping WebUI server...'));
        await webUI.stop();
        console.log(chalk.green('✓ WebUI server stopped successfully'));
        
        return true;
        
    } catch (error) {
        console.log(chalk.red(`✗ WebUI test failed: ${error.message}`));
        console.log(chalk.red(`Stack: ${error.stack}`));
        return false;
    }
}

async function testConstants() {
    console.log(chalk.blue('Testing constants...'));
    
    try {
        const constants = require('./lib/config/constants');
const aiConfig = require('./lib/utils/ai-config-manager');
        console.log(chalk.green('✓ Constants loaded successfully'));
        console.log(chalk.gray(`Default port: ${constants.PORTS.WEBUI_DEFAULT}`));
        console.log(chalk.gray(`Max connections: ${constants.CONNECTION_LIMITS.MAX_CONNECTIONS}`));
        console.log(chalk.gray(`Rate limit: ${constants.RATE_LIMITS.REQUESTS_PER_MINUTE}`));
        return true;
    } catch (error) {
        console.log(chalk.red(`✗ Constants test failed: ${error.message}`));
        return false;
    }
}

async function main() {
    console.log(chalk.cyan.bold('Simple Server Test\n'));
    
    const results = [];
    
    // Test constants first
    results.push(await testConstants());
    
    // Test WebUI class
    results.push(await testWebUIClass());
    
    // Summary
    console.log(chalk.cyan.bold('\nTest Summary:'));
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    if (passed === total) {
        console.log(chalk.green(`✓ All ${total} tests passed`));
        process.exit(0);
    } else {
        console.log(chalk.red(`✗ ${total - passed} of ${total} tests failed`));
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error(chalk.red('Test runner failed:'), error);
        process.exit(1);
    });
}

module.exports = { testWebUIClass, testConstants };