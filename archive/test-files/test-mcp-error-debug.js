#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const chalk = require('chalk');

async function testMCPErrorHandling() {
    console.log(chalk.cyan('🔍 Debug MCP Error Handling\n'));
    
    const MCPInstaller = require('./lib/mcp-installer');
    const testPath = path.join(os.tmpdir(), `mcp-debug-${Date.now()}.json`);
    
    try {
        // Test malformed mcpServers
        const malformedConfig = { mcpServers: 'not an object' };
        await fs.writeFile(testPath, JSON.stringify(malformedConfig));
        
        const installer = new MCPInstaller();
        installer.configPath = testPath;
        
        console.log(chalk.yellow('Testing with malformed config...'));
        
        try {
            const availability = await installer.checkMCPAvailability();
            console.log(chalk.green('Result:'), availability);
            
            // Check what type of result we got
            console.log(chalk.gray('Type check:'));
            console.log(chalk.gray(`  hasVUDA: ${typeof availability.hasVUDA} = ${availability.hasVUDA}`));
            console.log(chalk.gray(`  hasBrowserMCP: ${typeof availability.hasBrowserMCP} = ${availability.hasBrowserMCP}`));
            console.log(chalk.gray(`  hasSequentialThinking: ${typeof availability.hasSequentialThinking} = ${availability.hasSequentialThinking}`));
            console.log(chalk.gray(`  all: ${Array.isArray(availability.all)} = [${availability.all}]`));
            
        } catch (error) {
            console.log(chalk.red('Error caught:'), error.message);
            console.log(chalk.red('Error type:'), error.constructor.name);
        }
        
    } finally {
        await fs.unlink(testPath).catch(() => {});
    }
}

testMCPErrorHandling().catch(console.error);