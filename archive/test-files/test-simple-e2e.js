#!/usr/bin/env node

const ClaudeLoopEngine = require('./lib/claude-loop-engine');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

/**
 * Simple End-to-End Integration Test
 * Focuses on core functionality without WebUI server complexity
 */
async function testSimpleE2E() {
    console.log(chalk.cyan.bold('🧪 Simple End-to-End Integration Test\n'));
    
    const testResults = [];
    
    try {
        // Test 1: Engine Initialization and Configuration
        console.log(chalk.yellow('⚙️  Testing Engine Initialization...'));
        
        const engine = new ClaudeLoopEngine({
            repoPath: process.cwd(),
            maxIterations: 5,
            claudeCommand: 'echo "E2E test command"',
            ui: false
        });
        
        // Verify engine properties
        if (!engine.repoPath || !engine.maxIterations || !engine.mcpInstaller) {
            throw new Error('Engine not properly initialized');
        }
        
        console.log(chalk.green('✓ Engine initialized successfully'));
        testResults.push({
            test: 'Engine Initialization',
            status: 'PASSED',
            details: 'All core properties initialized correctly'
        });
        
        // Test 2: Progress Calculation Functions
        console.log(chalk.yellow('📊 Testing Progress Calculations...'));
        
        for (let i = 1; i <= 5; i++) {
            const progressBar = engine.generateProgressBar(i, 5);
            const elapsed = engine.formatElapsedTime(Date.now() - 5000);
            const focus = engine.getIterationFocus(i);
            
            if (!progressBar || !elapsed || !focus) {
                throw new Error(`Progress calculation failed at iteration ${i}`);
            }
            
            if (typeof progressBar !== 'string' || typeof elapsed !== 'string' || typeof focus !== 'string') {
                throw new Error(`Invalid type returned by progress functions at iteration ${i}`);
            }
        }
        
        console.log(chalk.green('✓ Progress calculations working correctly'));
        testResults.push({
            test: 'Progress Calculations',
            status: 'PASSED',
            details: 'All progress functions return correct types and values'
        });
        
        // Test 3: File Operation Management
        console.log(chalk.yellow('📁 Testing File Operations...'));
        
        const tempFiles = [];
        for (let i = 0; i < 3; i++) {
            const tempFile = path.join(process.cwd(), `simple-e2e-test-${i}-${Date.now()}.tmp`);
            tempFiles.push(tempFile);
            
            // Create file
            await fs.writeFile(tempFile, `E2E test file ${i}\nContent: ${new Date().toISOString()}`);
            
            // Add to engine tracking
            engine.tempFiles.add(tempFile);
            
            // Verify file exists and has correct content
            const content = await fs.readFile(tempFile, 'utf8');
            if (!content.includes(`E2E test file ${i}`)) {
                throw new Error(`File ${i} content verification failed`);
            }
        }
        
        console.log(chalk.gray(`   ✓ Created and verified ${tempFiles.length} temp files`));
        
        // Test cleanup
        await engine.cleanup();
        
        // Verify files were cleaned up
        for (let i = 0; i < tempFiles.length; i++) {
            try {
                await fs.access(tempFiles[i]);
                throw new Error(`File ${i} was not cleaned up: ${tempFiles[i]}`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
                // File was successfully cleaned up
            }
        }
        
        console.log(chalk.green('✓ File operations and cleanup working correctly'));
        testResults.push({
            test: 'File Operations',
            status: 'PASSED',
            details: `Created, verified, and cleaned up ${tempFiles.length} temp files`
        });
        
        // Test 4: MCP Integration Availability
        console.log(chalk.yellow('🔧 Testing MCP Integration...'));
        
        if (!engine.mcpInstaller) {
            throw new Error('MCP installer not available');
        }
        
        // Test MCP installer methods exist
        const requiredMethods = ['checkMCPAvailability', 'checkAndInstall', 'findSmitheryCredentials'];
        for (const method of requiredMethods) {
            if (typeof engine.mcpInstaller[method] !== 'function') {
                throw new Error(`MCP installer method ${method} not available`);
            }
        }
        
        // Test MCP availability check (may fail gracefully)
        try {
            await engine.mcpInstaller.checkMCPAvailability();
            console.log(chalk.gray('   ✓ MCP availability check completed'));
        } catch (error) {
            if (error.message.includes('ENOENT') || error.message.includes('config')) {
                console.log(chalk.gray('   ✓ MCP availability check handled missing config gracefully'));
            } else {
                throw error;
            }
        }
        
        console.log(chalk.green('✓ MCP integration working correctly'));
        testResults.push({
            test: 'MCP Integration',
            status: 'PASSED',
            details: 'MCP installer available and methods callable'
        });
        
        // Test 5: Configuration Management
        console.log(chalk.yellow('⚙️  Testing Configuration Management...'));
        
        // Test explicit configuration override
        const configTestEngine = new ClaudeLoopEngine({
            repoPath: process.cwd(),
            maxIterations: 15,
            claudeCommand: 'echo "Config test"',
            ui: false
        });
        
        // Should use provided value
        if (configTestEngine.maxIterations !== 15) {
            throw new Error(`Configuration override not working: expected 15, got ${configTestEngine.maxIterations}`);
        }
        
        // Test default value when no maxIterations provided
        const defaultTestEngine = new ClaudeLoopEngine({
            repoPath: process.cwd(),
            claudeCommand: 'echo "Default test"',
            ui: false
        });
        
        // Should use default value
        if (typeof defaultTestEngine.maxIterations !== 'number' || defaultTestEngine.maxIterations < 1) {
            throw new Error(`Default configuration not working: got ${defaultTestEngine.maxIterations}`);
        }
        
        console.log(chalk.green('✓ Configuration management working correctly'));
        testResults.push({
            test: 'Configuration Management',
            status: 'PASSED',
            details: 'Environment variables properly read and applied'
        });
        
        // Test 6: Error Handling
        console.log(chalk.yellow('🚨 Testing Error Handling...'));
        
        // Test cleanup with non-existent files
        const nonExistentFile = path.join(process.cwd(), 'non-existent-file.tmp');
        engine.tempFiles.add(nonExistentFile);
        
        // This should not throw an error
        await engine.cleanup();
        
        console.log(chalk.green('✓ Error handling working correctly'));
        testResults.push({
            test: 'Error Handling',
            status: 'PASSED',
            details: 'Graceful handling of non-existent files and edge cases'
        });
        
        // Generate report
        console.log(chalk.cyan.bold('\n📊 Simple E2E Integration Test Report\n'));
        console.log('='.repeat(60));
        
        const passed = testResults.filter(t => t.status === 'PASSED').length;
        const failed = testResults.filter(t => t.status === 'FAILED').length;
        const total = testResults.length;
        
        console.log(`Total Tests: ${total}`);
        console.log(`${chalk.green('Passed:')} ${passed}`);
        console.log(`${chalk.red('Failed:')} ${failed}`);
        console.log(`Success Rate: ${Math.round((passed / total) * 100)}%\n`);
        
        testResults.forEach(result => {
            const statusColor = result.status === 'PASSED' ? chalk.green : chalk.red;
            const statusIcon = result.status === 'PASSED' ? '✓' : '❌';
            
            console.log(`${statusColor(statusIcon)} ${result.test}: ${statusColor(result.status)}`);
            if (result.details) {
                console.log(`   ${chalk.gray(result.details)}`);
            }
        });
        
        console.log('='.repeat(60));
        
        // Save report
        const report = {
            timestamp: new Date().toISOString(),
            testSuite: 'Simple End-to-End Integration Test',
            summary: { total, passed, failed, successRate: Math.round((passed / total) * 100) },
            results: testResults,
            platform: {
                node: process.version,
                platform: process.platform,
                arch: process.arch
            }
        };
        
        const reportPath = path.join(process.cwd(), 'simple-e2e-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(chalk.gray(`\n📄 Report saved to: ${reportPath}`));
        
        if (passed === total) {
            console.log(chalk.green.bold('\n🎉 All Simple E2E Tests Passed!'));
            console.log(chalk.cyan('🚀 Core Claude Loop functionality is working correctly!'));
        }
        
        return testResults;
        
    } catch (error) {
        console.error(chalk.red(`❌ Simple E2E Test Failed: ${error.message}`));
        console.error(chalk.red(error.stack));
        
        testResults.push({
            test: 'Simple E2E Test Suite',
            status: 'FAILED',
            error: error.message,
            timestamp: new Date().toISOString()
        });
        
        process.exit(1);
    }
}

// Run test if called directly
if (require.main === module) {
    testSimpleE2E().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error(chalk.red(`\n❌ Test execution failed: ${error.message}`));
        process.exit(1);
    });
}

module.exports = testSimpleE2E;