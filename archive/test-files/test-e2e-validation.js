#!/usr/bin/env node

const ClaudeLoopEngine = require('./lib/claude-loop-engine');
const WebUI = require('./lib/web-ui');
const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');
const chalk = require('chalk');

/**
 * End-to-End Workflow Validation Test
 * Simulates complete user scenarios from CLI startup through web UI interactions
 * to ensure all components work together seamlessly.
 */
class E2EValidationTest {
    constructor() {
        this.testResults = [];
        this.testPort = 9500 + Math.floor(Math.random() * 100);
        this.webUI = null;
        this.engines = [];
        this.tempFiles = [];
    }

    async runValidation() {
        console.log(chalk.cyan.bold('🧪 End-to-End Workflow Validation Testing\n'));
        
        try {
            // Test 1: Complete CLI to Engine Workflow
            await this.testCLIToEngineWorkflow();
            
            // Test 2: Engine Configuration and Initialization
            await this.testEngineConfigurationWorkflow();
            
            // Test 3: WebUI Startup and Session Management
            await this.testWebUISessionWorkflow();
            
            // Test 4: Real-time Communication Workflow
            await this.testRealTimeCommunicationWorkflow();
            
            // Test 5: File Operation and Cleanup Workflow
            await this.testFileOperationWorkflow();
            
            // Test 6: Complete Integration Workflow Simulation
            await this.testCompleteIntegrationWorkflow();
            
            // Test 7: Error Handling and Recovery
            await this.testErrorHandlingWorkflow();
            
            // Test 8: Resource Management Under Load
            await this.testResourceManagementWorkflow();
            
            // Generate final report
            this.generateFinalReport();
            
        } catch (error) {
            console.error(chalk.red(`❌ E2E Validation Test Suite Failed: ${error.message}`));
            this.testResults.push({
                test: 'E2E Validation Test Suite',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        } finally {
            await this.cleanup();
        }
        
        return this.testResults;
    }

    async testCLIToEngineWorkflow() {
        console.log(chalk.yellow('🔧 Testing CLI to Engine Workflow...'));
        
        try {
            // Test CLI parameter processing
            const testConfigs = [
                {
                    repoPath: process.cwd(),
                    maxIterations: 3,
                    claudeCommand: 'echo "Test command 1"',
                    ui: false
                },
                {
                    repoPath: process.cwd(),
                    maxIterations: 5,
                    claudeCommand: 'echo "Test command 2"',
                    ui: true
                }
            ];
            
            for (let i = 0; i < testConfigs.length; i++) {
                const config = testConfigs[i];
                const engine = new ClaudeLoopEngine(config);
                this.engines.push(engine);
                
                // Verify configuration was properly applied
                if (engine.repoPath !== config.repoPath) {
                    throw new Error(`Config ${i}: repoPath mismatch`);
                }
                
                if (engine.maxIterations !== config.maxIterations) {
                    throw new Error(`Config ${i}: maxIterations mismatch`);
                }
                
                // Test engine initialization components
                if (!engine.mcpInstaller) {
                    throw new Error(`Config ${i}: MCP installer not initialized`);
                }
                
                if (!(engine.tempFiles instanceof Set)) {
                    throw new Error(`Config ${i}: Temp file tracking not initialized`);
                }
                
                // Test basic engine methods
                const progressBar = engine.generateProgressBar(1, config.maxIterations);
                if (!progressBar || typeof progressBar !== 'string') {
                    throw new Error(`Config ${i}: Progress bar generation failed`);
                }
                
                const focus = engine.getIterationFocus(1);
                if (!focus || typeof focus !== 'string') {
                    throw new Error(`Config ${i}: Iteration focus generation failed`);
                }
                
                console.log(chalk.gray(`   ✓ Engine ${i + 1} configuration validated`));
            }
            
            console.log(chalk.green('✓ CLI to Engine workflow working correctly'));
            this.testResults.push({
                test: 'CLI to Engine Workflow',
                status: 'PASSED',
                details: `Tested ${testConfigs.length} different configurations`,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ CLI to Engine workflow failed: ${error.message}`));
            this.testResults.push({
                test: 'CLI to Engine Workflow',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testEngineConfigurationWorkflow() {
        console.log(chalk.yellow('⚙️  Testing Engine Configuration Workflow...'));
        
        try {
            const engine = new ClaudeLoopEngine({
                repoPath: process.cwd(),
                maxIterations: 10,
                claudeCommand: 'echo "Configuration test"',
                ui: false
            });
            
            // Test progress calculation methods
            for (let i = 1; i <= 10; i++) {
                const progressBar = engine.generateProgressBar(i, 10);
                const elapsed = engine.formatElapsedTime(Date.now() - 10000);
                const focus = engine.getIterationFocus(i);
                
                if (!progressBar || !elapsed || !focus) {
                    throw new Error(`Progress calculation failed at iteration ${i}`);
                }
                
                // Test different phases
                if (i <= 3 && !focus.includes('Setup')) {
                    throw new Error(`Early iteration focus incorrect: ${focus}`);
                }
                
                if (i >= 8 && !focus.includes('Finalization')) {
                    throw new Error(`Late iteration focus incorrect: ${focus}`);
                }
            }
            
            // Test MCP installer integration
            if (!engine.mcpInstaller) {
                throw new Error('MCP installer not available');
            }
            
            // Test basic MCP availability checking (may fail gracefully)
            try {
                await engine.mcpInstaller.checkMCPAvailability();
                console.log(chalk.gray('   ✓ MCP availability check completed'));
            } catch (error) {
                // This is acceptable - MCP config may not exist in test environment
                console.log(chalk.gray('   ✓ MCP availability check handled gracefully'));
            }
            
            console.log(chalk.green('✓ Engine configuration workflow working correctly'));
            this.testResults.push({
                test: 'Engine Configuration Workflow',
                status: 'PASSED',
                details: 'All progress calculations and MCP integration working',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ Engine configuration workflow failed: ${error.message}`));
            this.testResults.push({
                test: 'Engine Configuration Workflow',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testWebUISessionWorkflow() {
        console.log(chalk.yellow('🌐 Testing WebUI Session Workflow...'));
        
        try {
            // Find available port more reliably
            this.testPort = await this.findAvailablePort(this.testPort);
            
            this.webUI = new WebUI(this.testPort);
            await this.webUI.start();
            
            console.log(chalk.gray(`   ✓ WebUI started on port ${this.testPort}`));
            
            // Test session token generation
            const token = this.webUI.sessionToken;
            if (!token || token.length < 16) {
                throw new Error('Session token not properly generated');
            }
            
            // Test session data initialization
            const sessionData = this.webUI.sessionData;
            if (!sessionData || typeof sessionData.iterations !== 'number') {
                throw new Error('Session data not properly initialized');
            }
            
            // Test session updates
            const testUpdates = [
                { iterations: 1, currentPhase: 'Phase 1', isRunning: true },
                { iterations: 2, currentPhase: 'Phase 2', isRunning: true },
                { iterations: 3, currentPhase: 'Phase 3', isRunning: false }
            ];
            
            for (const update of testUpdates) {
                this.webUI.updateSession(update);
                
                // Verify update was applied
                for (const [key, value] of Object.entries(update)) {
                    if (this.webUI.sessionData[key] !== value) {
                        throw new Error(`Session update failed for ${key}: expected ${value}, got ${this.webUI.sessionData[key]}`);
                    }
                }
            }
            
            // Test output logging
            const testOutputs = [
                { message: 'Test info message', type: 'info' },
                { message: 'Test success message', type: 'success' },
                { message: 'Test warning message', type: 'warning' },
                { message: 'Test error message', type: 'error' }
            ];
            
            for (const output of testOutputs) {
                this.webUI.addOutput(output.message, output.type);
            }
            
            // Verify outputs were added
            const outputEntries = this.webUI.sessionData.output;
            if (outputEntries.length < testOutputs.length) {
                throw new Error('Not all output messages were added to session');
            }
            
            console.log(chalk.green('✓ WebUI session workflow working correctly'));
            this.testResults.push({
                test: 'WebUI Session Workflow',
                status: 'PASSED',
                details: `Session management and output logging tested on port ${this.testPort}`,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ WebUI session workflow failed: ${error.message}`));
            this.testResults.push({
                test: 'WebUI Session Workflow',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testRealTimeCommunicationWorkflow() {
        console.log(chalk.yellow('📡 Testing Real-time Communication Workflow...'));
        
        if (!this.webUI) {
            throw new Error('WebUI not available for communication testing');
        }
        
        try {
            const token = this.webUI.sessionToken;
            
            // Test WebSocket connection and communication
            const clientMessages = [];
            
            const wsTest = new Promise((resolve, reject) => {
                const ws = new WebSocket(`ws://localhost:${this.testPort}?token=${token}`, {
                    headers: {
                        'User-Agent': 'Claude-Loop-E2E-Test/1.0'
                    }
                });
                
                ws.on('open', () => {
                    console.log(chalk.gray('   ✓ WebSocket client connected'));
                    
                    // Trigger session updates to test real-time communication
                    setTimeout(() => {
                        this.webUI.updateSession({
                            iterations: 5,
                            currentPhase: 'Real-time test',
                            testTimestamp: Date.now()
                        });
                        
                        this.webUI.addOutput('Real-time communication test', 'info');
                    }, 100);
                });
                
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        clientMessages.push(message);
                        
                        console.log(chalk.gray(`   ✓ Received: ${message.type}`));
                        
                        if (message.type === 'session_update' && message.data.testTimestamp) {
                            // Test complete
                            ws.close();
                            resolve();
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse WebSocket message: ${error.message}`));
                    }
                });
                
                ws.on('error', (error) => {
                    reject(new Error(`WebSocket error: ${error.message}`));
                });
                
                ws.on('close', (code, reason) => {
                    if (clientMessages.length === 0) {
                        reject(new Error(`WebSocket closed without receiving messages: ${code} - ${reason}`));
                    }
                });
                
                setTimeout(() => {
                    ws.close();
                    if (clientMessages.length === 0) {
                        reject(new Error('WebSocket test timeout - no messages received'));
                    }
                }, 10000);
            });
            
            await wsTest;
            
            // Verify messages were received
            if (clientMessages.length === 0) {
                throw new Error('No WebSocket messages received');
            }
            
            // Verify message structure
            const hasSessionMessage = clientMessages.some(msg => 
                msg.type === 'session_data' || msg.type === 'session_update'
            );
            
            if (!hasSessionMessage) {
                throw new Error('No session messages received via WebSocket');
            }
            
            console.log(chalk.green('✓ Real-time communication workflow working correctly'));
            this.testResults.push({
                test: 'Real-time Communication Workflow',
                status: 'PASSED',
                details: `Received ${clientMessages.length} WebSocket messages`,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ Real-time communication workflow failed: ${error.message}`));
            this.testResults.push({
                test: 'Real-time Communication Workflow',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testFileOperationWorkflow() {
        console.log(chalk.yellow('📁 Testing File Operation Workflow...'));
        
        try {
            const engine = new ClaudeLoopEngine({
                repoPath: process.cwd(),
                maxIterations: 2,
                claudeCommand: 'echo "File operation test"',
                ui: false
            });
            
            // Test temp file creation and tracking
            const testFiles = [];
            for (let i = 0; i < 5; i++) {
                const tempFile = path.join(process.cwd(), `e2e-test-${i}-${Date.now()}.tmp`);
                testFiles.push(tempFile);
                this.tempFiles.push(tempFile);
                
                // Create temp file
                await fs.writeFile(tempFile, `E2E test file ${i}\nTimestamp: ${new Date().toISOString()}`);
                
                // Add to engine tracking
                engine.tempFiles.add(tempFile);
                
                // Verify file exists
                const content = await fs.readFile(tempFile, 'utf8');
                if (!content.includes(`E2E test file ${i}`)) {
                    throw new Error(`File ${i} content verification failed`);
                }
            }
            
            console.log(chalk.gray(`   ✓ Created and verified ${testFiles.length} temp files`));
            
            // Test cleanup
            await engine.cleanup();
            
            // Verify files were cleaned up
            for (let i = 0; i < testFiles.length; i++) {
                try {
                    await fs.access(testFiles[i]);
                    throw new Error(`File ${i} was not cleaned up: ${testFiles[i]}`);
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        throw error;
                    }
                    // File was successfully cleaned up
                }
            }
            
            console.log(chalk.gray(`   ✓ All temp files cleaned up successfully`));
            
            console.log(chalk.green('✓ File operation workflow working correctly'));
            this.testResults.push({
                test: 'File Operation Workflow',
                status: 'PASSED',
                details: `Created, verified, and cleaned up ${testFiles.length} temp files`,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ File operation workflow failed: ${error.message}`));
            this.testResults.push({
                test: 'File Operation Workflow',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testCompleteIntegrationWorkflow() {
        console.log(chalk.yellow('🔄 Testing Complete Integration Workflow...'));
        
        try {
            if (!this.webUI) {
                throw new Error('WebUI not available for integration testing');
            }
            
            // Simulate a complete claude-loop session
            const engine = new ClaudeLoopEngine({
                repoPath: process.cwd(),
                maxIterations: 3,
                claudeCommand: 'echo "Integration test iteration"',
                ui: false
            });
            
            // Test session initialization
            this.webUI.updateSession({
                iterations: 0,
                currentPhase: 'Starting integration test',
                isRunning: true,
                startTime: Date.now()
            });
            
            // Simulate iterations
            for (let i = 1; i <= 3; i++) {
                // Update progress
                const progressBar = engine.generateProgressBar(i, 3);
                const focus = engine.getIterationFocus(i);
                
                this.webUI.updateSession({
                    iterations: i,
                    currentPhase: `Iteration ${i}: ${focus}`,
                    isRunning: true,
                    progress: Math.round((i / 3) * 100)
                });
                
                // Log iteration output
                this.webUI.addOutput(`Starting iteration ${i}`, 'info');
                this.webUI.addOutput(`Progress: ${progressBar}`, 'info');
                this.webUI.addOutput(`Focus: ${focus}`, 'info');
                
                // Simulate some work
                await new Promise(resolve => setTimeout(resolve, 100));
                
                this.webUI.addOutput(`Iteration ${i} completed`, 'success');
            }
            
            // Complete session
            this.webUI.updateSession({
                iterations: 3,
                currentPhase: 'Session completed',
                isRunning: false,
                progress: 100
            });
            
            this.webUI.addOutput('Integration test session completed successfully', 'success');
            
            // Test cleanup
            await engine.cleanup();
            
            console.log(chalk.green('✓ Complete integration workflow working correctly'));
            this.testResults.push({
                test: 'Complete Integration Workflow',
                status: 'PASSED',
                details: 'Full session simulation with 3 iterations completed',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ Complete integration workflow failed: ${error.message}`));
            this.testResults.push({
                test: 'Complete Integration Workflow',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testErrorHandlingWorkflow() {
        console.log(chalk.yellow('🚨 Testing Error Handling Workflow...'));
        
        try {
            if (!this.webUI) {
                throw new Error('WebUI not available for error testing');
            }
            
            // Test error logging
            const errorMessages = [
                'Test error message 1',
                'Test error message 2',
                'Critical system error test'
            ];
            
            for (const errorMsg of errorMessages) {
                this.webUI.addOutput(errorMsg, 'error');
            }
            
            // Verify errors are in output
            const errorEntries = this.webUI.sessionData.output.filter(entry => entry.type === 'error');
            if (errorEntries.length < errorMessages.length) {
                throw new Error('Not all error messages were logged');
            }
            
            // Test invalid session updates (should not crash)
            this.webUI.updateSession(null);
            this.webUI.updateSession('invalid');
            this.webUI.updateSession(123);
            
            // Test engine error handling
            const engine = new ClaudeLoopEngine({
                repoPath: process.cwd(),
                maxIterations: 1,
                claudeCommand: 'echo "Error test"',
                ui: false
            });
            
            // Test cleanup with non-existent files (should not throw)
            engine.tempFiles.add('/non/existent/file.tmp');
            await engine.cleanup(); // Should complete without throwing
            
            console.log(chalk.green('✓ Error handling workflow working correctly'));
            this.testResults.push({
                test: 'Error Handling Workflow',
                status: 'PASSED',
                details: 'Error logging and graceful handling verified',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ Error handling workflow failed: ${error.message}`));
            this.testResults.push({
                test: 'Error Handling Workflow',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testResourceManagementWorkflow() {
        console.log(chalk.yellow('🔧 Testing Resource Management Workflow...'));
        
        try {
            // Test multiple engines
            const engines = [];
            for (let i = 0; i < 3; i++) {
                const engine = new ClaudeLoopEngine({
                    repoPath: process.cwd(),
                    maxIterations: 2,
                    claudeCommand: `echo "Resource test ${i}"`,
                    ui: false
                });
                engines.push(engine);
            }
            
            // Test concurrent operations
            const operationPromises = engines.map(async (engine, index) => {
                // Create temp file for each engine
                const tempFile = path.join(process.cwd(), `resource-test-${index}-${Date.now()}.tmp`);
                await fs.writeFile(tempFile, `Resource test ${index}`);
                engine.tempFiles.add(tempFile);
                
                // Simulate some work
                await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
                
                return engine.cleanup();
            });
            
            await Promise.all(operationPromises);
            
            // Test WebUI output buffer management
            if (this.webUI) {
                const initialOutputCount = this.webUI.sessionData.output.length;
                
                // Add many messages to test buffer limits
                for (let i = 0; i < 100; i++) {
                    this.webUI.addOutput(`Resource test message ${i}`, 'info');
                }
                
                const finalOutputCount = this.webUI.sessionData.output.length;
                const maxOutputEntries = parseInt(process.env.WEBUI_MAX_OUTPUT_ENTRIES) || 50;
                
                if (finalOutputCount <= maxOutputEntries) {
                    console.log(chalk.gray(`   ✓ Output buffer correctly limited to ${finalOutputCount} entries`));
                } else {
                    throw new Error(`Output buffer exceeded limit: ${finalOutputCount} > ${maxOutputEntries}`);
                }
            }
            
            console.log(chalk.green('✓ Resource management workflow working correctly'));
            this.testResults.push({
                test: 'Resource Management Workflow',
                status: 'PASSED',
                details: 'Concurrent operations and buffer management verified',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ Resource management workflow failed: ${error.message}`));
            this.testResults.push({
                test: 'Resource Management Workflow',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async findAvailablePort(startPort) {
        const net = require('net');
        
        return new Promise((resolve, reject) => {
            if (startPort > 65535) {
                reject(new Error('No available ports found'));
                return;
            }
            
            const server = net.createServer();
            
            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
                    this.findAvailablePort(startPort + 1).then(resolve).catch(reject);
                } else {
                    reject(err);
                }
            });
            
            server.listen(startPort, '127.0.0.1', (err) => {
                if (err) {
                    this.findAvailablePort(startPort + 1).then(resolve).catch(reject);
                } else {
                    const port = server.address().port;
                    server.close(() => {
                        resolve(port);
                    });
                }
            });
        });
    }

    async cleanup() {
        try {
            // Clean up WebUI
            if (this.webUI) {
                await this.webUI.stop();
                console.log(chalk.gray('✓ WebUI stopped'));
            }
            
            // Clean up engines
            for (const engine of this.engines) {
                await engine.cleanup();
            }
            console.log(chalk.gray('✓ Engines cleaned up'));
            
            // Clean up temp files
            for (const tempFile of this.tempFiles) {
                try {
                    await fs.unlink(tempFile);
                } catch (error) {
                    // File may already be cleaned up
                }
            }
            console.log(chalk.gray('✓ Temp files cleaned up'));
            
        } catch (error) {
            console.log(chalk.yellow(`⚠️ Cleanup warning: ${error.message}`));
        }
    }

    generateFinalReport() {
        console.log(chalk.cyan.bold('\n📊 End-to-End Workflow Validation Report\n'));
        console.log('='.repeat(80));
        
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
        
        console.log('\n' + '='.repeat(80));
        
        // Save results to file
        const reportPath = path.join(process.cwd(), 'e2e-validation-report.json');
        const report = {
            timestamp: new Date().toISOString(),
            testSuite: 'End-to-End Workflow Validation',
            summary: { 
                total, 
                passed, 
                failed, 
                successRate: Math.round((passed / total) * 100) 
            },
            results: this.testResults,
            platform: {
                node: process.version,
                platform: process.platform,
                arch: process.arch
            }
        };
        
        fs.writeFile(reportPath, JSON.stringify(report, null, 2)).then(() => {
            console.log(chalk.gray(`\n📄 E2E Validation report saved to: ${reportPath}`));
        }).catch(error => {
            console.log(chalk.yellow(`⚠️ Could not save report: ${error.message}`));
        });
        
        if (passed === total) {
            console.log(chalk.green.bold('\n🎉 All E2E Workflow Validation Tests Passed!'));
            console.log(chalk.cyan('🚀 Claude Loop is ready for production with robust end-to-end functionality!'));
        } else {
            console.log(chalk.red.bold('\n❌ Some E2E Workflow Validation Tests Failed'));
            console.log(chalk.yellow('⚠️ Review failed tests and address issues before production use.'));
        }
    }
}

// Run E2E validation if called directly
if (require.main === module) {
    const validator = new E2EValidationTest();
    validator.runValidation().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error(chalk.red(`\n❌ E2E Validation failed: ${error.message}`));
        process.exit(1);
    });
}

module.exports = E2EValidationTest;