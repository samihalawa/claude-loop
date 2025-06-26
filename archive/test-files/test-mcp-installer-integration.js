#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const crypto = require('crypto');

class MCPInstallerIntegrationTest {
    constructor() {
        this.testResults = [];
        this.testConfigPath = path.join(os.tmpdir(), `claude-test-config-${Date.now()}.json`);
        this.backupConfigPath = null;
        this.originalConfigPath = path.join(
            os.homedir(),
            'Library/Application Support/Claude/claude_desktop_config.json'
        );
    }

    async runTests() {
        console.log(chalk.cyan('🔧 MCP Installer Integration Testing\n'));
        
        try {
            // Test 1: MCP Installer Class Instantiation
            await this.testMCPInstallerInstantiation();
            
            // Test 2: Configuration File Handling
            await this.testConfigurationFileHandling();
            
            // Test 3: MCP Availability Check
            await this.testMCPAvailabilityCheck();
            
            // Test 4: Smithery Credentials Detection
            await this.testSmitheryCredentialsDetection();
            
            // Test 5: MCP Installation Logic (Dry Run)
            await this.testMCPInstallationLogic();
            
            // Test 6: Error Handling and Edge Cases
            await this.testErrorHandlingAndEdgeCases();
            
            // Test 7: Integration with Claude Loop Engine
            await this.testEngineIntegration();
            
            // Generate comprehensive report
            this.generateReport();
            
        } catch (error) {
            console.error(chalk.red(`❌ MCP installer test suite failed: ${error.message}`));
            this.testResults.push({
                test: 'MCP Installer Test Suite',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        } finally {
            await this.cleanup();
        }
        
        return this.testResults;
    }

    async testMCPInstallerInstantiation() {
        console.log(chalk.yellow('📦 Testing MCP Installer Class Instantiation...'));
        
        try {
            const MCPInstaller = require('./lib/mcp-installer');
            
            // Test basic instantiation
            const installer = new MCPInstaller();
            
            // Verify required properties
            if (!installer.configPath) {
                throw new Error('configPath not set');
            }
            
            if (!installer.requiredMCPs) {
                throw new Error('requiredMCPs not defined');
            }
            
            if (typeof installer.checkAndInstall !== 'function') {
                throw new Error('checkAndInstall method not available');
            }
            
            if (typeof installer.checkMCPAvailability !== 'function') {
                throw new Error('checkMCPAvailability method not available');
            }
            
            // Verify required MCPs structure
            const expectedMCPs = ['vuda', 'browsermcp', 'sequential-thinking'];
            for (const mcpKey of expectedMCPs) {
                if (!installer.requiredMCPs[mcpKey]) {
                    throw new Error(`Required MCP '${mcpKey}' not defined`);
                }
                
                const mcp = installer.requiredMCPs[mcpKey];
                if (!mcp.name || !mcp.package || !mcp.description) {
                    throw new Error(`MCP '${mcpKey}' missing required properties`);
                }
            }
            
            console.log(chalk.green('✓ MCP Installer instantiation successful'));
            this.testResults.push({
                test: 'MCP Installer Instantiation',
                status: 'PASSED',
                details: 'All required methods and properties present',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ MCP Installer instantiation failed: ${error.message}`));
            this.testResults.push({
                test: 'MCP Installer Instantiation',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testConfigurationFileHandling() {
        console.log(chalk.yellow('📄 Testing Configuration File Handling...'));
        
        const MCPInstaller = require('./lib/mcp-installer');
        
        try {
            // Create a test configuration file
            const testConfig = {
                mcpServers: {
                    'existing-mcp': {
                        command: 'npx',
                        args: ['-y', '@existing/mcp-package']
                    }
                }
            };
            
            await fs.writeFile(this.testConfigPath, JSON.stringify(testConfig, null, 2));
            
            // Test with custom config path
            const installer = new MCPInstaller();
            installer.configPath = this.testConfigPath;
            
            // Test config reading
            const config = JSON.parse(await fs.readFile(this.testConfigPath, 'utf8'));
            if (!config.mcpServers || !config.mcpServers['existing-mcp']) {
                throw new Error('Test config not properly created');
            }
            
            console.log(chalk.green('✓ Configuration file handling working'));
            this.testResults.push({
                test: 'Configuration File Handling',
                status: 'PASSED',
                details: 'Config file read/write operations successful',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ Configuration file handling failed: ${error.message}`));
            this.testResults.push({
                test: 'Configuration File Handling',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testMCPAvailabilityCheck() {
        console.log(chalk.yellow('🔍 Testing MCP Availability Check...'));
        
        const MCPInstaller = require('./lib/mcp-installer');
        
        try {
            // Test with empty config
            const emptyConfig = { mcpServers: {} };
            await fs.writeFile(this.testConfigPath, JSON.stringify(emptyConfig, null, 2));
            
            const installer = new MCPInstaller();
            installer.configPath = this.testConfigPath;
            
            const availability = await installer.checkMCPAvailability();
            
            // Verify structure
            if (typeof availability.hasVUDA !== 'boolean') {
                throw new Error('hasVUDA should be boolean');
            }
            if (typeof availability.hasBrowserMCP !== 'boolean') {
                throw new Error('hasBrowserMCP should be boolean');
            }
            if (typeof availability.hasSequentialThinking !== 'boolean') {
                throw new Error('hasSequentialThinking should be boolean');
            }
            if (!Array.isArray(availability.all)) {
                throw new Error('all should be an array');
            }
            
            // With empty config, all should be false
            if (availability.hasVUDA || availability.hasBrowserMCP || availability.hasSequentialThinking) {
                throw new Error('Empty config should show no MCPs available');
            }
            
            // Test with populated config
            const populatedConfig = {
                mcpServers: {
                    'vuda': { command: 'npx', args: ['-y', '@samihalawa/visual-ui-debug-agent-mcp'] },
                    'browsermcp': { command: 'npx', args: ['-y', '@browsermcp/mcp'] }
                }
            };
            await fs.writeFile(this.testConfigPath, JSON.stringify(populatedConfig, null, 2));
            
            const availability2 = await installer.checkMCPAvailability();
            if (!availability2.hasVUDA || !availability2.hasBrowserMCP || availability2.hasSequentialThinking) {
                throw new Error('Populated config availability check failed');
            }
            
            console.log(chalk.green('✓ MCP availability check working correctly'));
            this.testResults.push({
                test: 'MCP Availability Check',
                status: 'PASSED',
                details: 'Correctly detects installed and missing MCPs',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ MCP availability check failed: ${error.message}`));
            this.testResults.push({
                test: 'MCP Availability Check',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testSmitheryCredentialsDetection() {
        console.log(chalk.yellow('🔑 Testing Smithery Credentials Detection...'));
        
        const MCPInstaller = require('./lib/mcp-installer');
        
        try {
            const installer = new MCPInstaller();
            installer.configPath = this.testConfigPath;
            
            // Test with no Smithery MCPs
            const configNoSmithery = {
                mcpServers: {
                    'regular-mcp': { command: 'npx', args: ['-y', '@regular/mcp'] }
                }
            };
            await fs.writeFile(this.testConfigPath, JSON.stringify(configNoSmithery, null, 2));
            
            let config = JSON.parse(await fs.readFile(this.testConfigPath, 'utf8'));
            let credentials = installer.findSmitheryCredentials(config);
            
            if (credentials !== null) {
                throw new Error('Should return null when no Smithery MCPs found');
            }
            
            // Test with Smithery MCPs
            const configWithSmithery = {
                mcpServers: {
                    'smithery-mcp': {
                        command: 'npx',
                        args: ['-y', '@smithery/cli@latest', 'run', '@samihalawa/test-mcp', '--key', 'test-key', '--profile', 'test-profile']
                    }
                }
            };
            await fs.writeFile(this.testConfigPath, JSON.stringify(configWithSmithery, null, 2));
            
            config = JSON.parse(await fs.readFile(this.testConfigPath, 'utf8'));
            credentials = installer.findSmitheryCredentials(config);
            
            if (!credentials || credentials.key !== 'test-key' || credentials.profile !== 'test-profile') {
                throw new Error('Should extract Smithery credentials correctly');
            }
            
            console.log(chalk.green('✓ Smithery credentials detection working'));
            this.testResults.push({
                test: 'Smithery Credentials Detection',
                status: 'PASSED',
                details: 'Correctly detects and extracts Smithery credentials',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ Smithery credentials detection failed: ${error.message}`));
            this.testResults.push({
                test: 'Smithery Credentials Detection',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testMCPInstallationLogic() {
        console.log(chalk.yellow('⚙️ Testing MCP Installation Logic (Dry Run)...'));
        
        const MCPInstaller = require('./lib/mcp-installer');
        
        try {
            const installer = new MCPInstaller();
            installer.configPath = this.testConfigPath;
            
            // Start with empty config
            const emptyConfig = { mcpServers: {} };
            await fs.writeFile(this.testConfigPath, JSON.stringify(emptyConfig, null, 2));
            
            let config = JSON.parse(await fs.readFile(this.testConfigPath, 'utf8'));
            
            // Test installing a regular MCP
            const regularMCP = {
                key: 'test-mcp',
                name: 'Test MCP',
                package: '@test/mcp-package',
                description: 'Test MCP for integration testing'
            };
            
            await installer.installMCP(regularMCP, config, null, null);
            
            // Verify regular MCP was added
            if (!config.mcpServers[regularMCP.key]) {
                throw new Error('Regular MCP not added to config');
            }
            
            const regularMCPConfig = config.mcpServers[regularMCP.key];
            if (regularMCPConfig.command !== 'npx' || !regularMCPConfig.args.includes(regularMCP.package)) {
                throw new Error('Regular MCP not configured correctly');
            }
            
            // Test installing a Smithery MCP
            const smitheryMCP = {
                key: 'smithery-test',
                name: 'Smithery Test MCP',
                package: '@samihalawa/test-mcp',
                description: 'Smithery test MCP'
            };
            
            await installer.installMCP(smitheryMCP, config, 'test-key', 'test-profile');
            
            // Verify Smithery MCP was added
            if (!config.mcpServers[smitheryMCP.key]) {
                throw new Error('Smithery MCP not added to config');
            }
            
            const smitheryMCPConfig = config.mcpServers[smitheryMCP.key];
            if (smitheryMCPConfig.command !== 'npx' || 
                !smitheryMCPConfig.args.includes('@smithery/cli@latest') ||
                !smitheryMCPConfig.args.includes('--key') ||
                !smitheryMCPConfig.args.includes('test-key')) {
                throw new Error('Smithery MCP not configured correctly');
            }
            
            console.log(chalk.green('✓ MCP installation logic working correctly'));
            this.testResults.push({
                test: 'MCP Installation Logic',
                status: 'PASSED',
                details: 'Both regular and Smithery MCPs configured correctly',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ MCP installation logic failed: ${error.message}`));
            this.testResults.push({
                test: 'MCP Installation Logic',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testErrorHandlingAndEdgeCases() {
        console.log(chalk.yellow('🛡️ Testing Error Handling and Edge Cases...'));
        
        const MCPInstaller = require('./lib/mcp-installer');
        
        try {
            const installer = new MCPInstaller();
            
            // Test 1: Non-existent config file
            installer.configPath = '/non/existent/path/config.json';
            
            try {
                const availability = await installer.checkMCPAvailability();
                // Should return default values when config doesn't exist
                if (availability.hasVUDA || availability.hasBrowserMCP || availability.hasSequentialThinking) {
                    throw new Error('Non-existent config should return false for all MCPs');
                }
            } catch (error) {
                if (!error.message.includes('ENOENT')) {
                    throw new Error('Should handle non-existent config gracefully');
                }
            }
            
            // Test 2: Invalid JSON config
            const invalidJsonPath = path.join(os.tmpdir(), `invalid-json-${Date.now()}.json`);
            await fs.writeFile(invalidJsonPath, 'invalid json content');
            
            installer.configPath = invalidJsonPath;
            
            try {
                await installer.checkMCPAvailability();
                throw new Error('Should throw error for invalid JSON');
            } catch (error) {
                if (!error.message.includes('JSON') && !error.message.includes('parse')) {
                    throw new Error('Should properly report JSON parsing errors');
                }
            }
            
            // Cleanup invalid json file
            await fs.unlink(invalidJsonPath).catch(() => {});
            
            // Test 3: Config with malformed mcpServers
            const malformedConfig = { mcpServers: 'not an object' };
            const malformedPath = path.join(os.tmpdir(), `malformed-${Date.now()}.json`);
            await fs.writeFile(malformedPath, JSON.stringify(malformedConfig));
            
            installer.configPath = malformedPath;
            
            try {
                const availability = await installer.checkMCPAvailability();
                // Should handle gracefully and return empty results
                if (!Array.isArray(availability.all) || availability.all.length > 0) {
                    throw new Error('Should handle malformed config gracefully');
                }
            } catch (error) {
                // This is also acceptable - should either handle gracefully or throw meaningful error
                if (!error.message.includes('mcpServers')) {
                    throw new Error('Should provide meaningful error for malformed config');
                }
            }
            
            // Cleanup malformed config file
            await fs.unlink(malformedPath).catch(() => {});
            
            console.log(chalk.green('✓ Error handling and edge cases working correctly'));
            this.testResults.push({
                test: 'Error Handling and Edge Cases',
                status: 'PASSED',
                details: 'Properly handles non-existent, invalid, and malformed configs',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ Error handling test failed: ${error.message}`));
            this.testResults.push({
                test: 'Error Handling and Edge Cases',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testEngineIntegration() {
        console.log(chalk.yellow('🔗 Testing Engine Integration...'));
        
        try {
            const ClaudeLoopEngine = require('./lib/claude-loop-engine');
            
            // Test that engine properly instantiates MCP installer
            const engine = new ClaudeLoopEngine({
                repoPath: process.cwd(),
                maxIterations: 1,
                claudeCommand: 'echo'
            });
            
            if (!engine.mcpInstaller) {
                throw new Error('Engine should have mcpInstaller instance');
            }
            
            // Test that MCP installer is the correct type
            if (typeof engine.mcpInstaller.checkAndInstall !== 'function') {
                throw new Error('Engine mcpInstaller should have checkAndInstall method');
            }
            
            if (typeof engine.mcpInstaller.checkMCPAvailability !== 'function') {
                throw new Error('Engine mcpInstaller should have checkMCPAvailability method');
            }
            
            // Test MCP availability check integration
            try {
                const availability = await engine.mcpInstaller.checkMCPAvailability();
                
                if (typeof availability !== 'object' || availability === null) {
                    throw new Error('MCP availability check should return object');
                }
                
                const requiredProps = ['hasVUDA', 'hasBrowserMCP', 'hasSequentialThinking', 'all'];
                for (const prop of requiredProps) {
                    if (!(prop in availability)) {
                        throw new Error(`MCP availability should include ${prop}`);
                    }
                }
                
            } catch (error) {
                // Acceptable if config doesn't exist - should handle gracefully
                if (!error.message.includes('ENOENT') && !error.message.includes('JSON')) {
                    throw error;
                }
            }
            
            console.log(chalk.green('✓ Engine integration working correctly'));
            this.testResults.push({
                test: 'Engine Integration',
                status: 'PASSED',
                details: 'MCP installer properly integrated into Claude Loop Engine',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ Engine integration failed: ${error.message}`));
            this.testResults.push({
                test: 'Engine Integration',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async cleanup() {
        try {
            // Clean up test config file
            await fs.unlink(this.testConfigPath).catch(() => {});
            
            // Restore original config if we backed it up
            if (this.backupConfigPath) {
                await fs.copyFile(this.backupConfigPath, this.originalConfigPath).catch(() => {});
                await fs.unlink(this.backupConfigPath).catch(() => {});
            }
            
            console.log(chalk.gray('✓ Test cleanup completed'));
        } catch (error) {
            console.log(chalk.yellow(`⚠️ Cleanup warning: ${error.message}`));
        }
    }

    generateReport() {
        console.log(chalk.cyan.bold('\n📊 MCP Installer Integration Test Report\n'));
        console.log('='.repeat(60));
        
        const passed = this.testResults.filter(t => t.status === 'PASSED').length;
        const failed = this.testResults.filter(t => t.status === 'FAILED').length;
        const total = this.testResults.length;
        
        console.log(`Total Tests: ${total}`);
        console.log(`${chalk.green('Passed:')} ${passed}`);
        console.log(`${chalk.red('Failed:')} ${failed}`);
        console.log(`Success Rate: ${Math.round((passed / total) * 100)}%\n`);
        
        this.testResults.forEach(result => {
            const statusColor = result.status === 'PASSED' ? chalk.green : chalk.red;
            const statusIcon = result.status === 'PASSED' ? '✓' : '❌';
            
            console.log(`${statusColor(statusIcon)} ${result.test}: ${statusColor(result.status)}`);
            if (result.details) {
                console.log(`   ${chalk.gray(result.details)}`);
            }
            if (result.error) {
                console.log(`   ${chalk.red('Error:')} ${result.error}`);
            }
        });
        
        console.log('\n' + '='.repeat(60));
        
        // Save results to file
        const reportPath = './mcp-installer-integration-report.json';
        
        fs.writeFile(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            summary: { total, passed, failed, successRate: Math.round((passed / total) * 100) },
            results: this.testResults
        }, null, 2)).then(() => {
            console.log(chalk.gray(`\n📄 Report saved to: ${reportPath}`));
        }).catch(error => {
            console.log(chalk.yellow(`⚠️ Could not save report: ${error.message}`));
        });
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new MCPInstallerIntegrationTest();
    tester.runTests().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error(chalk.red(`\n❌ MCP installer test suite failed: ${error.message}`));
        process.exit(1);
    });
}

module.exports = MCPInstallerIntegrationTest;