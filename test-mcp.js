#!/usr/bin/env node

const MCPInstaller = require('./lib/mcp-installer');
const chalk = require('chalk');

async function testMCP() {
    console.log(chalk.cyan('🧪 Testing MCP Installer functionality...\n'));
    
    try {
        // Test 1: Basic instantiation
        console.log(chalk.blue('Test 1: Basic instantiation'));
        const installer = new MCPInstaller();
        console.log(chalk.green('✓ MCP Installer instantiated successfully'));
        console.log(chalk.gray(`  - Config path: ${installer.configPath}`));
        console.log(chalk.gray(`  - Required MCPs: ${Object.keys(installer.requiredMCPs).join(', ')}`));
        
        // Test 2: Check MCP availability
        console.log(chalk.blue('\nTest 2: Check MCP availability'));
        const availability = await installer.checkMCPAvailability();
        console.log(chalk.green('✓ MCP availability check completed'));
        console.log(chalk.gray(`  - VUDA available: ${availability.hasVUDA}`));
        console.log(chalk.gray(`  - BrowserMCP available: ${availability.hasBrowserMCP}`));
        console.log(chalk.gray(`  - Sequential Thinking available: ${availability.hasSequentialThinking}`));
        console.log(chalk.gray(`  - All MCPs: ${availability.all.join(', ') || 'none'}`));
        
        // Test 3: Smithery credentials finder
        console.log(chalk.blue('\nTest 3: Smithery credentials finder'));
        const fakeConfig = {
            mcpServers: {
                testServer: {
                    args: ['@smithery/cli@latest', 'run', 'test', '--key', 'testkey', '--profile', 'testprofile']
                }
            }
        };
        const credentials = installer.findSmitheryCredentials(fakeConfig);
        if (credentials && credentials.key === 'testkey' && credentials.profile === 'testprofile') {
            console.log(chalk.green('✓ Smithery credentials extraction working'));
        } else {
            console.log(chalk.red('✗ Smithery credentials extraction failed'));
        }
        
        // Test 4: Required MCPs structure
        console.log(chalk.blue('\nTest 4: Required MCPs structure validation'));
        const requiredMCPs = installer.requiredMCPs;
        let structureValid = true;
        
        for (const [key, mcp] of Object.entries(requiredMCPs)) {
            if (!mcp.name || !mcp.package || typeof mcp.required !== 'boolean') {
                structureValid = false;
                console.log(chalk.red(`✗ Invalid MCP structure for ${key}`));
            }
        }
        
        if (structureValid) {
            console.log(chalk.green('✓ All MCP structures valid'));
        }
        
        // Test 5: Config path validation
        console.log(chalk.blue('\nTest 5: Config path validation'));
        if (installer.configPath.includes('Claude')) {
            console.log(chalk.green('✓ Config path points to Claude directory'));
        } else {
            console.log(chalk.yellow('⚠ Config path may not be correct for Claude'));
        }
        
        console.log(chalk.cyan('\n🎉 All MCP tests completed!'));
        
    } catch (error) {
        console.error(chalk.red('\n❌ MCP test failed:'), error.message);
        console.error(chalk.gray(error.stack));
        process.exit(1);
    }
}

// Run tests
testMCP().catch(console.error);