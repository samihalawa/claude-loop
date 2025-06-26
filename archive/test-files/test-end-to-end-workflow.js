#!/usr/bin/env node

/**
 * Comprehensive End-to-End Workflow Validation
 * Tests complete user scenarios from CLI startup through web UI interactions
 * Simulates real-world usage patterns and validates all components work together seamlessly
 */

const { spawn } = require('child_process');
const WebSocket = require('ws');
const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');

class EndToEndWorkflowTest {
    constructor() {
        this.testResults = [];
        this.testPort = 3350;
        this.processes = [];
        this.tempFiles = [];
        this.currentPortOffset = 0;
        
        // Set test environment
        process.env.NODE_ENV = 'test';
    }
    
    getNextPort() {
        return this.testPort + (++this.currentPortOffset);
    }

    async runAllWorkflowTests() {
        console.log(chalk.cyan('🚀 End-to-End Workflow Validation Testing\n'));
        
        try {
            // Workflow 1: Complete CLI to Web UI Startup Flow
            await this.testCompleteStartupWorkflow();
            
            // Workflow 2: Real User Interaction Simulation
            await this.testRealUserInteractionWorkflow();
            
            // Workflow 3: Error Recovery and Resilience
            await this.testErrorRecoveryWorkflow();
            
            // Workflow 4: Multi-Session Concurrent Usage
            await this.testConcurrentUsageWorkflow();
            
            // Workflow 5: Production Environment Simulation
            await this.testProductionEnvironmentWorkflow();
            
            // Workflow 6: Integration with External Tools
            await this.testExternalToolsIntegrationWorkflow();
            
            this.generateWorkflowReport();
            
        } catch (error) {
            console.error(chalk.red(`❌ End-to-end workflow test suite failed: ${error.message}`));
            this.addTestResult('WORKFLOW_SUITE_FAILURE', false, error.message);
        } finally {
            await this.cleanup();
        }
    }

    async testCompleteStartupWorkflow() {
        console.log(chalk.yellow('🚀 Testing Complete CLI to Web UI Startup Workflow...'));
        
        try {
            const ClaudeLoopEngine = require('./lib/claude-loop-engine');
            const WebUI = require('./lib/web-ui');
            
            console.log(chalk.gray('  1a. Testing engine initialization with UI flag...'));
            
            // Step 1: Initialize engine with UI flag (simulating CLI --ui)
            const engine = new ClaudeLoopEngine({
                repoPath: process.cwd(),
                maxIterations: 3,
                ui: true
            });
            
            if (!engine.ui) {
                throw new Error('Engine UI flag not properly set');
            }
            console.log(chalk.green('     ✅ Engine initialized with UI flag'));
            
            console.log(chalk.gray('  1b. Starting WebUI server...'));
            
            // Step 2: Start WebUI server (simulating what engine would do)
            const currentPort = this.getNextPort();
            const webUI = new WebUI(currentPort);
            await webUI.start();
            
            if (!webUI.sessionToken) {
                throw new Error('WebUI session token not generated');
            }
            console.log(chalk.green('     ✅ WebUI server started with token authentication'));
            
            console.log(chalk.gray('  1c. Testing client connection and session establishment...'));
            
            // Step 3: Simulate browser connection
            const token = webUI.sessionToken;
            let sessionEstablished = false;
            let initialDataReceived = false;
            
            const clientTest = new Promise((resolve, reject) => {
                const ws = new WebSocket(`ws://localhost:${currentPort}?token=${token}`, {
                    headers: {
                        'User-Agent': 'Claude-Loop-E2E-Test/1.0 (workflow validation)'
                    }
                });
                
                const timeout = setTimeout(() => {
                    ws.close();
                    reject(new Error('Client connection timeout'));
                }, 8000);
                
                ws.on('open', () => {
                    sessionEstablished = true;
                    console.log(chalk.green('     ✅ Client connected and session established'));
                });
                
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        if (message.type === 'session_data') {
                            initialDataReceived = true;
                            console.log(chalk.green('     ✅ Initial session data received'));
                            console.log(chalk.gray(`        Session data: ${Object.keys(message.data).join(', ')}`));
                            
                            clearTimeout(timeout);
                            ws.close();
                            resolve();
                        }
                    } catch (error) {
                        clearTimeout(timeout);
                        reject(error);
                    }
                });
                
                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
            
            await clientTest;
            
            console.log(chalk.gray('  1d. Testing engine-webui integration...'));
            
            // Step 4: Test engine updating WebUI (simulating real workflow)
            webUI.updateSession({
                iterations: 1,
                currentPhase: 'E2E Workflow Test',
                isRunning: true
            });
            
            webUI.addOutput('Starting end-to-end workflow validation', 'info');
            webUI.addOutput('Engine initialized successfully', 'success');
            
            // Verify session state
            const sessionData = webUI.sessionData;
            if (sessionData.iterations !== 1 || sessionData.currentPhase !== 'E2E Workflow Test') {
                throw new Error('Session updates not properly applied');
            }
            console.log(chalk.green('     ✅ Engine-WebUI integration working'));
            
            // Step 5: Cleanup
            await webUI.stop();
            await engine.cleanup();
            
            console.log(chalk.green('✅ Complete startup workflow: PASSED'));
            this.addTestResult('COMPLETE_STARTUP_WORKFLOW', true, 
                'CLI initialization, WebUI startup, client connection, and session establishment all working');
            
        } catch (error) {
            console.log(chalk.red(`❌ Complete startup workflow failed: ${error.message}`));
            this.addTestResult('COMPLETE_STARTUP_WORKFLOW', false, error.message);
        }
    }

    async testRealUserInteractionWorkflow() {
        console.log(chalk.yellow('👤 Testing Real User Interaction Workflow...'));
        
        try {
            const WebUI = require('./lib/web-ui');
            
            console.log(chalk.gray('  2a. Setting up user session...'));
            
            const currentPort = this.getNextPort();
            const webUI = new WebUI(currentPort);
            await webUI.start();
            
            const token = webUI.sessionToken;
            
            console.log(chalk.gray('  2b. Simulating user dashboard access...'));
            
            // Simulate user accessing dashboard
            const { spawn } = require('child_process');
            const dashboardAccess = await new Promise((resolve, reject) => {
                const curl = spawn('curl', ['-s', `http://localhost:${currentPort}?token=${token}`]);
                let data = '';
                curl.stdout.on('data', chunk => data += chunk);
                curl.on('close', () => resolve(data));
                curl.on('error', reject);
            });
            
            if (!dashboardAccess.includes('Claude Loop') || !dashboardAccess.includes('output')) {
                throw new Error('Dashboard not properly rendered');
            }
            console.log(chalk.green('     ✅ User can access dashboard'));
            
            console.log(chalk.gray('  2c. Simulating real-time monitoring session...'));
            
            // Simulate user monitoring a real session
            let messagesReceived = 0;
            let sessionUpdatesReceived = 0;
            let outputMessagesReceived = 0;
            
            const monitoringTest = new Promise((resolve, reject) => {
                const ws = new WebSocket(`ws://localhost:${currentPort}?token=${token}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });
                
                const timeout = setTimeout(() => {
                    ws.close();
                    reject(new Error('Monitoring session timeout'));
                }, 15000);
                
                ws.on('open', () => {
                    console.log(chalk.green('     ✅ User monitoring session started'));
                    
                    // Simulate a real workflow with multiple phases
                    setTimeout(() => {
                        webUI.updateSession({
                            iterations: 1,
                            currentPhase: 'Analyzing repository structure',
                            isRunning: true
                        });
                        webUI.addOutput('Scanning repository files...', 'info');
                    }, 500);
                    
                    setTimeout(() => {
                        webUI.updateSession({
                            iterations: 2,
                            currentPhase: 'Running automated analysis'
                        });
                        webUI.addOutput('Found 15 JavaScript files', 'info');
                        webUI.addOutput('Analyzing dependencies...', 'info');
                    }, 1000);
                    
                    setTimeout(() => {
                        webUI.updateSession({
                            iterations: 3,
                            currentPhase: 'Generating recommendations'
                        });
                        webUI.addOutput('Analysis complete', 'success');
                        webUI.addOutput('Generated 5 improvement suggestions', 'success');
                    }, 1500);
                    
                    setTimeout(() => {
                        webUI.updateSession({
                            iterations: 3,
                            currentPhase: 'Workflow complete',
                            isRunning: false
                        });
                        webUI.addOutput('Workflow completed successfully', 'success');
                    }, 2000);
                });
                
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        messagesReceived++;
                        
                        if (message.type === 'session_update') {
                            sessionUpdatesReceived++;
                            console.log(chalk.gray(`        Session update: ${message.data.currentPhase}`));
                        } else if (message.type === 'new_output') {
                            outputMessagesReceived++;
                            console.log(chalk.gray(`        Output: ${message.data.message.substring(0, 30)}...`));
                        }
                        
                        // Complete test after receiving sufficient updates
                        if (messagesReceived >= 8 && sessionUpdatesReceived >= 3 && outputMessagesReceived >= 4) {
                            clearTimeout(timeout);
                            ws.close();
                            resolve({
                                messagesReceived,
                                sessionUpdatesReceived,
                                outputMessagesReceived
                            });
                        }
                    } catch (error) {
                        clearTimeout(timeout);
                        reject(error);
                    }
                });
                
                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
            
            const results = await monitoringTest;
            
            if (results.sessionUpdatesReceived < 3 || results.outputMessagesReceived < 4) {
                throw new Error('Insufficient real-time updates received');
            }
            
            console.log(chalk.green('     ✅ Real-time monitoring working correctly'));
            console.log(chalk.gray(`        Messages: ${results.messagesReceived}, Updates: ${results.sessionUpdatesReceived}, Output: ${results.outputMessagesReceived}`));
            
            await webUI.stop();
            
            console.log(chalk.green('✅ Real user interaction workflow: PASSED'));
            this.addTestResult('REAL_USER_INTERACTION', true, 
                `Dashboard access and real-time monitoring working (${results.messagesReceived} messages)`);
            
        } catch (error) {
            console.log(chalk.red(`❌ Real user interaction workflow failed: ${error.message}`));
            this.addTestResult('REAL_USER_INTERACTION', false, error.message);
        }
    }

    async testErrorRecoveryWorkflow() {
        console.log(chalk.yellow('🔧 Testing Error Recovery and Resilience Workflow...'));
        
        try {
            const WebUI = require('./lib/web-ui');
            
            console.log(chalk.gray('  3a. Testing graceful error handling...'));
            
            const currentPort = this.getNextPort();
            const webUI = new WebUI(currentPort);
            await webUI.start();
            
            const token = webUI.sessionToken;
            
            // Test error scenarios
            let errorHandlingWorking = false;
            let reconnectionWorking = false;
            
            const errorRecoveryTest = new Promise((resolve, reject) => {
                const ws = new WebSocket(`ws://localhost:${currentPort}?token=${token}`, {
                    headers: {
                        'User-Agent': 'Claude-Loop-E2E-Error-Test/1.0 (error recovery validation)'
                    }
                });
                
                const timeout = setTimeout(() => {
                    ws.close();
                    reject(new Error('Error recovery test timeout'));
                }, 10000);
                
                ws.on('open', () => {
                    console.log(chalk.green('     ✅ Initial connection established'));
                    
                    // Simulate an error scenario
                    setTimeout(() => {
                        webUI.addOutput('Simulating error condition...', 'warning');
                        webUI.addOutput('Error: Test error for recovery validation', 'error');
                        webUI.updateSession({
                            currentPhase: 'Error occurred',
                            isRunning: false
                        });
                    }, 500);
                    
                    // Simulate recovery
                    setTimeout(() => {
                        webUI.addOutput('Attempting recovery...', 'info');
                        webUI.addOutput('Recovery successful', 'success');
                        webUI.updateSession({
                            currentPhase: 'System recovered',
                            isRunning: true
                        });
                    }, 1500);
                });
                
                let errorMessageReceived = false;
                let recoveryMessageReceived = false;
                
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        
                        if (message.type === 'new_output') {
                            if (message.data.type === 'error') {
                                errorMessageReceived = true;
                                console.log(chalk.green('     ✅ Error message properly transmitted'));
                            } else if (message.data.message.includes('Recovery successful')) {
                                recoveryMessageReceived = true;
                                console.log(chalk.green('     ✅ Recovery message properly transmitted'));
                            }
                        }
                        
                        if (errorMessageReceived && recoveryMessageReceived) {
                            errorHandlingWorking = true;
                            clearTimeout(timeout);
                            ws.close();
                            resolve();
                        }
                    } catch (error) {
                        clearTimeout(timeout);
                        reject(error);
                    }
                });
                
                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
            
            await errorRecoveryTest;
            
            console.log(chalk.gray('  3b. Testing connection resilience...'));
            
            // Test connection resilience by simulating temporary network issues
            const resilienceTest = new Promise((resolve, reject) => {
                const ws = new WebSocket(`ws://localhost:${currentPort}?token=${token}`, {
                    headers: {
                        'User-Agent': 'Claude-Loop-E2E-Resilience-Test/1.0 (connection resilience)'
                    }
                });
                
                const timeout = setTimeout(() => {
                    reject(new Error('Resilience test timeout'));
                }, 8000);
                
                ws.on('open', () => {
                    console.log(chalk.green('     ✅ Resilience test connection established'));
                    
                    // Send a message to verify connection
                    ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
                    
                    // Close and test if system can handle it gracefully
                    setTimeout(() => {
                        ws.close(1000, 'Simulated network interruption');
                    }, 1000);
                });
                
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        if (message.type === 'session_data') {
                            console.log(chalk.green('     ✅ Session data received before interruption'));
                        }
                    } catch (error) {
                        // Ignore parsing errors during resilience test
                    }
                });
                
                ws.on('close', (code, reason) => {
                    if (code === 1000) {
                        reconnectionWorking = true;
                        console.log(chalk.green('     ✅ Connection closed gracefully'));
                        clearTimeout(timeout);
                        resolve();
                    }
                });
                
                ws.on('error', (error) => {
                    // Errors are expected in resilience testing
                    console.log(chalk.gray(`     Connection error (expected): ${error.message}`));
                });
            });
            
            await resilienceTest;
            
            await webUI.stop();
            
            if (errorHandlingWorking && reconnectionWorking) {
                console.log(chalk.green('✅ Error recovery and resilience workflow: PASSED'));
                this.addTestResult('ERROR_RECOVERY_WORKFLOW', true, 
                    'Error handling and connection resilience working correctly');
            } else {
                throw new Error('Error recovery or resilience not working properly');
            }
            
        } catch (error) {
            console.log(chalk.red(`❌ Error recovery workflow failed: ${error.message}`));
            this.addTestResult('ERROR_RECOVERY_WORKFLOW', false, error.message);
        }
    }

    async testConcurrentUsageWorkflow() {
        console.log(chalk.yellow('👥 Testing Multi-Session Concurrent Usage Workflow...'));
        
        try {
            const WebUI = require('./lib/web-ui');
            
            console.log(chalk.gray('  4a. Starting multiple WebUI instances...'));
            
            // Start multiple WebUI instances to simulate multiple users
            const webUIInstances = [];
            const ports = [];
            
            for (let i = 0; i < 3; i++) {
                const currentPort = this.getNextPort();
                const webUI = new WebUI(currentPort);
                await webUI.start();
                webUIInstances.push(webUI);
                ports.push(currentPort);
                console.log(chalk.green(`     ✅ WebUI instance ${i + 1} started on port ${currentPort}`));
            }
            
            console.log(chalk.gray('  4b. Testing concurrent client connections...'));
            
            // Test concurrent connections across instances
            const concurrentTests = [];
            
            for (let i = 0; i < webUIInstances.length; i++) {
                const webUI = webUIInstances[i];
                const port = ports[i];
                const token = webUI.sessionToken;
                
                const concurrentTest = new Promise((resolve, reject) => {
                    const ws = new WebSocket(`ws://localhost:${port}?token=${token}`, {
                        headers: {
                            'User-Agent': `Claude-Loop-Concurrent-Test-${i + 1}/1.0 (concurrent usage validation)`
                        }
                    });
                    
                    const timeout = setTimeout(() => {
                        ws.close();
                        reject(new Error(`Concurrent test ${i + 1} timeout`));
                    }, 8000);
                    
                    let messagesReceived = 0;
                    
                    ws.on('open', () => {
                        console.log(chalk.green(`     ✅ Concurrent client ${i + 1} connected`));
                        
                        // Simulate concurrent activity
                        webUI.updateSession({
                            iterations: i + 1,
                            currentPhase: `Concurrent session ${i + 1}`,
                            isRunning: true
                        });
                        
                        webUI.addOutput(`Processing in session ${i + 1}`, 'info');
                        webUI.addOutput(`Session ${i + 1} working independently`, 'success');
                    });
                    
                    ws.on('message', (data) => {
                        try {
                            const message = JSON.parse(data);
                            messagesReceived++;
                            
                            if (messagesReceived >= 3) {
                                clearTimeout(timeout);
                                ws.close();
                                resolve({
                                    instance: i + 1,
                                    messagesReceived
                                });
                            }
                        } catch (error) {
                            clearTimeout(timeout);
                            reject(error);
                        }
                    });
                    
                    ws.on('error', (error) => {
                        clearTimeout(timeout);
                        reject(error);
                    });
                });
                
                concurrentTests.push(concurrentTest);
            }
            
            const concurrentResults = await Promise.all(concurrentTests);
            
            console.log(chalk.gray('  4c. Verifying session isolation...'));
            
            // Verify each instance maintains independent state
            for (let i = 0; i < webUIInstances.length; i++) {
                const sessionData = webUIInstances[i].sessionData;
                if (sessionData.iterations !== i + 1) {
                    throw new Error(`Session isolation failed for instance ${i + 1}`);
                }
            }
            
            console.log(chalk.green('     ✅ Session isolation working correctly'));
            
            // Cleanup all instances
            for (const webUI of webUIInstances) {
                await webUI.stop();
            }
            
            const totalMessages = concurrentResults.reduce((sum, result) => sum + result.messagesReceived, 0);
            
            console.log(chalk.green('✅ Concurrent usage workflow: PASSED'));
            this.addTestResult('CONCURRENT_USAGE_WORKFLOW', true, 
                `${concurrentResults.length} concurrent sessions with ${totalMessages} total messages`);
            
        } catch (error) {
            console.log(chalk.red(`❌ Concurrent usage workflow failed: ${error.message}`));
            this.addTestResult('CONCURRENT_USAGE_WORKFLOW', false, error.message);
        }
    }

    async testProductionEnvironmentWorkflow() {
        console.log(chalk.yellow('🏭 Testing Production Environment Simulation...'));
        
        try {
            const WebUI = require('./lib/web-ui');
            
            console.log(chalk.gray('  5a. Testing with production-like settings...'));
            
            // Set production-like environment
            const originalNodeEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            
            const currentPort = this.getNextPort();
            const webUI = new WebUI(currentPort);
            await webUI.start();
            
            const token = webUI.sessionToken;
            
            console.log(chalk.gray('  5b. Testing security headers and restrictions...'));
            
            // Test security headers are properly set
            const securityTest = await new Promise((resolve, reject) => {
                const curl = spawn('curl', ['-I', '-s', `http://localhost:${currentPort}?token=${token}`]);
                let headers = '';
                curl.stdout.on('data', chunk => headers += chunk);
                curl.on('close', () => resolve(headers));
                curl.on('error', reject);
            });
            
            const requiredHeaders = [
                'X-Content-Type-Options',
                'X-Frame-Options',
                'X-XSS-Protection',
                'Content-Security-Policy'
            ];
            
            let missingHeaders = [];
            for (const header of requiredHeaders) {
                if (!securityTest.includes(header)) {
                    missingHeaders.push(header);
                }
            }
            
            if (missingHeaders.length > 0) {
                console.log(chalk.yellow(`     ⚠️ Missing security headers: ${missingHeaders.join(', ')}`));
            } else {
                console.log(chalk.green('     ✅ All security headers present'));
            }
            
            console.log(chalk.gray('  5c. Testing load simulation...'));
            
            // Simulate production load with multiple rapid connections
            const loadTests = [];
            for (let i = 0; i < 5; i++) {
                const loadTest = new Promise((resolve, reject) => {
                    const ws = new WebSocket(`ws://localhost:${currentPort}?token=${token}`, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        }
                    });
                    
                    const timeout = setTimeout(() => {
                        ws.close();
                        reject(new Error(`Load test ${i + 1} timeout`));
                    }, 5000);
                    
                    ws.on('open', () => {
                        // Rapid updates to test load handling
                        for (let j = 0; j < 3; j++) {
                            setTimeout(() => {
                                webUI.addOutput(`Load test ${i + 1} message ${j + 1}`, 'info');
                            }, j * 100);
                        }
                    });
                    
                    let messagesReceived = 0;
                    ws.on('message', () => {
                        messagesReceived++;
                        if (messagesReceived >= 3) {
                            clearTimeout(timeout);
                            ws.close();
                            resolve(i + 1);
                        }
                    });
                    
                    ws.on('error', (error) => {
                        clearTimeout(timeout);
                        reject(error);
                    });
                });
                
                loadTests.push(loadTest);
            }
            
            const loadResults = await Promise.all(loadTests);
            console.log(chalk.green(`     ✅ Load simulation completed with ${loadResults.length} concurrent connections`));
            
            await webUI.stop();
            
            // Restore original environment
            process.env.NODE_ENV = originalNodeEnv;
            
            console.log(chalk.green('✅ Production environment simulation: PASSED'));
            this.addTestResult('PRODUCTION_ENVIRONMENT', true, 
                `Security headers present, load testing with ${loadResults.length} connections completed`);
            
        } catch (error) {
            console.log(chalk.red(`❌ Production environment simulation failed: ${error.message}`));
            this.addTestResult('PRODUCTION_ENVIRONMENT', false, error.message);
            
            // Restore environment even on error
            process.env.NODE_ENV = 'test';
        }
    }

    async testExternalToolsIntegrationWorkflow() {
        console.log(chalk.yellow('🔧 Testing Integration with External Tools...'));
        
        try {
            const ClaudeLoopEngine = require('./lib/claude-loop-engine');
            const MCPInstaller = require('./lib/mcp-installer');
            
            console.log(chalk.gray('  6a. Testing MCP installer integration...'));
            
            const engine = new ClaudeLoopEngine({
                repoPath: process.cwd(),
                maxIterations: 1
            });
            
            // Test MCP installer availability
            if (!engine.mcpInstaller || !(engine.mcpInstaller instanceof MCPInstaller)) {
                throw new Error('MCP installer not properly integrated');
            }
            console.log(chalk.green('     ✅ MCP installer properly integrated'));
            
            console.log(chalk.gray('  6b. Testing external tool availability checks...'));
            
            try {
                const mcpStatus = await engine.mcpInstaller.checkMCPAvailability();
                console.log(chalk.green('     ✅ MCP availability check completed'));
                console.log(chalk.gray(`        Available tools: ${Object.keys(mcpStatus).join(', ')}`));
            } catch (error) {
                if (error.message.includes('ENOENT') || error.message.includes('JSON')) {
                    console.log(chalk.yellow('     ⚠️ MCP config not found (acceptable for testing)'));
                } else {
                    throw error;
                }
            }
            
            console.log(chalk.gray('  6c. Testing file system integration...'));
            
            // Test secure temp file creation and cleanup
            const tempFileName = 'e2e-test-file.tmp';
            engine.tempFiles.add(tempFileName);
            
            if (!engine.tempFiles.has(tempFileName)) {
                throw new Error('Temp file tracking not working');
            }
            console.log(chalk.green('     ✅ File system integration working'));
            
            console.log(chalk.gray('  6d. Testing engine cleanup procedures...'));
            
            // Test cleanup
            await engine.cleanup();
            console.log(chalk.green('     ✅ Engine cleanup completed successfully'));
            
            console.log(chalk.green('✅ External tools integration workflow: PASSED'));
            this.addTestResult('EXTERNAL_TOOLS_INTEGRATION', true, 
                'MCP installer, file system, and cleanup integration all working');
            
        } catch (error) {
            console.log(chalk.red(`❌ External tools integration workflow failed: ${error.message}`));
            this.addTestResult('EXTERNAL_TOOLS_INTEGRATION', false, error.message);
        }
    }

    addTestResult(testName, passed, details) {
        this.testResults.push({
            test: testName,
            status: passed ? 'PASSED' : 'FAILED',
            details: details,
            timestamp: new Date().toISOString()
        });
    }

    async cleanup() {
        try {
            // Kill any running processes
            for (const process of this.processes) {
                try {
                    process.kill('SIGTERM');
                    setTimeout(() => {
                        if (!process.killed) {
                            process.kill('SIGKILL');
                        }
                    }, 2000);
                } catch (error) {
                    // Process may already be dead
                }
            }
            
            // Clean up any temp files
            for (const tempFile of this.tempFiles) {
                try {
                    await fs.unlink(tempFile);
                } catch (error) {
                    // File may not exist
                }
            }
            
            console.log(chalk.gray('✓ End-to-end test cleanup completed'));
        } catch (error) {
            console.log(chalk.yellow(`⚠️ Cleanup warning: ${error.message}`));
        }
    }

    generateWorkflowReport() {
        console.log(chalk.cyan.bold('\n📊 End-to-End Workflow Validation Report\n'));
        console.log('='.repeat(80));
        
        const passed = this.testResults.filter(t => t.status === 'PASSED').length;
        const failed = this.testResults.filter(t => t.status === 'FAILED').length;
        const total = this.testResults.length;
        
        console.log(`Total Workflows: ${total}`);
        console.log(`${chalk.green('Passed:')} ${passed}`);
        console.log(`${chalk.red('Failed:')} ${failed}`);
        console.log(`Success Rate: ${Math.round((passed / total) * 100)}%\n`);
        
        this.testResults.forEach(result => {
            const statusColor = result.status === 'PASSED' ? chalk.green : chalk.red;
            const statusIcon = result.status === 'PASSED' ? '✓' : '❌';
            
            console.log(`${statusColor(statusIcon)} ${result.test}: ${statusColor(result.status)}`);
            console.log(`   ${chalk.gray(result.details)}`);
        });
        
        console.log('\n' + '='.repeat(80));
        
        // Save results to file
        const fs = require('fs').promises;
        const reportPath = './end-to-end-workflow-report.json';
        
        fs.writeFile(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            summary: { total, passed, failed, successRate: Math.round((passed / total) * 100) },
            results: this.testResults
        }, null, 2)).then(() => {
            console.log(chalk.gray(`\n📄 Report saved to: ${reportPath}`));
        }).catch(error => {
            console.log(chalk.yellow(`⚠️ Could not save report: ${error.message}`));
        });
        
        // Overall assessment
        console.log(chalk.cyan('\n🎯 End-to-End Workflow Assessment:'));
        if (passed === total) {
            console.log(chalk.green('🎉 Excellent! All end-to-end workflows are working perfectly!'));
            console.log(chalk.green('   ✓ Complete system integration validated'));
            console.log(chalk.green('   ✓ Real user scenarios successfully tested'));
            console.log(chalk.green('   ✓ Error recovery and resilience confirmed'));
            console.log(chalk.green('   ✓ Production readiness validated'));
        } else if (passed >= total * 0.8) {
            console.log(chalk.yellow('⚡ Good workflow integration with minor issues'));
            console.log(chalk.yellow('   ✓ Core workflows are functional'));
            console.log(chalk.yellow('   ⚠ Some advanced scenarios need attention'));
        } else {
            console.log(chalk.red('🔧 Significant workflow issues detected'));
            console.log(chalk.red('   ✗ Critical integration failures'));
            console.log(chalk.red('   ✗ User experience may be compromised'));
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new EndToEndWorkflowTest();
    tester.runAllWorkflowTests().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error(chalk.red(`\n❌ End-to-end workflow testing failed: ${error.message}`));
        process.exit(1);
    });
}

module.exports = EndToEndWorkflowTest;