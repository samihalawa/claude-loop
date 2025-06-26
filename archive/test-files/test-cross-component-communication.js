#!/usr/bin/env node

const { spawn } = require('child_process');
const WebSocket = require('ws');
const chalk = require('chalk');
const path = require('path');

class CrossComponentCommunicationTest {
    constructor() {
        this.testResults = [];
        this.testPort = 3342;
        this.processes = [];
        this.currentPortOffset = 0;
        
        // Set test environment to allow WebSocket connections
        process.env.NODE_ENV = 'test';
    }
    
    getNextPort() {
        return this.testPort + (++this.currentPortOffset);
    }

    async runTests() {
        console.log(chalk.cyan('🔗 Cross-Component Communication Testing\n'));
        
        try {
            // Test 1: CLI to Engine Communication
            await this.testCLIToEngineComm();
            
            // Test 2: Engine to Web UI Communication
            await this.testEngineToWebUIComm();
            
            // Test 3: Web UI to Client Communication (WebSocket)
            await this.testWebUIToClientComm();
            
            // Test 4: MCP Integration Communication
            await this.testMCPIntegrationComm();
            
            // Test 5: Error Propagation and Handling
            await this.testErrorPropagationAndHandling();
            
            // Test 6: Session State Synchronization
            await this.testSessionStateSynchronization();
            
            // Test 7: Real-time Progress Updates
            await this.testRealTimeProgressUpdates();
            
            // Test 8: Component Lifecycle Management
            await this.testComponentLifecycleManagement();
            
            // Generate comprehensive report
            this.generateReport();
            
        } catch (error) {
            console.error(chalk.red(`❌ Cross-component communication test suite failed: ${error.message}`));
            this.testResults.push({
                test: 'Cross-Component Communication Test Suite',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        } finally {
            await this.cleanup();
        }
        
        return this.testResults;
    }

    async testCLIToEngineComm() {
        console.log(chalk.yellow('📡 Testing CLI to Engine Communication...'));
        
        try {
            const ClaudeLoopEngine = require('./lib/claude-loop-engine');
            console.log(chalk.gray('ClaudeLoopEngine loaded successfully'));
            
            // Test CLI parameter passing to engine
            const testConfig = {
                repoPath: process.cwd(),
                maxIterations: 5,
                claudeCommand: 'echo',
                ui: true
            };
            
            const engine = new ClaudeLoopEngine(testConfig);
            
            // Verify parameters were properly passed
            if (engine.repoPath !== testConfig.repoPath) {
                throw new Error('repoPath not properly passed to engine');
            }
            
            if (engine.maxIterations !== testConfig.maxIterations) {
                throw new Error('maxIterations not properly passed to engine');
            }
            
            // Note: claudeCommand gets sanitized, so we check if it's properly sanitized
            if (!engine.claudeCommand || typeof engine.claudeCommand !== 'string') {
                throw new Error('claudeCommand not properly initialized in engine');
            }
            
            if (engine.ui !== testConfig.ui) {
                throw new Error('ui flag not properly passed to engine');
            }
            
            // Test engine initialization
            if (!engine.mcpInstaller) {
                throw new Error('MCP installer not initialized in engine');
            }
            
            if (!(engine.tempFiles instanceof Set)) {
                throw new Error('Temp file tracking not initialized in engine');
            }
            
            // Test signal handler setup
            const initialSigIntListeners = process.listenerCount('SIGINT');
            const initialSigTermListeners = process.listenerCount('SIGTERM');
            
            // Create another engine to test signal handler registration
            const engine2 = new ClaudeLoopEngine({ repoPath: process.cwd() });
            
            // Signal handlers should be set up
            const hasSignalHandlers = process.listenerCount('SIGINT') > 0 || 
                                    process.listenerCount('SIGTERM') > 0;
            
            if (!hasSignalHandlers) {
                console.log(chalk.yellow('⚠️ Signal handlers may not be properly set up'));
            }
            
            console.log(chalk.green('✓ CLI to engine communication working correctly'));
            this.testResults.push({
                test: 'CLI to Engine Communication',
                status: 'PASSED',
                details: 'Parameters properly passed and engine initialized correctly',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ CLI to engine communication failed: ${error.message}`));
            this.testResults.push({
                test: 'CLI to Engine Communication',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testEngineToWebUIComm() {
        console.log(chalk.yellow('🌐 Testing Engine to Web UI Communication...'));
        
        try {
            const ClaudeLoopEngine = require('./lib/claude-loop-engine');
            
            // Test engine creating and communicating with WebUI
            const engine = new ClaudeLoopEngine({
                repoPath: process.cwd(),
                maxIterations: 1,
                ui: true
            });
            
            // Start WebUI manually to test communication
            const WebUI = require('./lib/web-ui');
            const webUI = new WebUI(this.getNextPort());
            await webUI.start();
            
            // Test session updates
            const testSessionData = {
                iterations: 1,
                currentPhase: 'Testing communication',
                isRunning: true,
                testData: 'Communication test'
            };
            
            webUI.updateSession(testSessionData);
            
            // Verify session data is stored
            const sessionData = webUI.sessionData;
            for (const [key, value] of Object.entries(testSessionData)) {
                if (sessionData[key] !== value) {
                    throw new Error(`Session data mismatch for ${key}: expected ${value}, got ${sessionData[key]}`);
                }
            }
            
            // Test output logging
            const testMessages = [
                { message: 'Test info message', type: 'info' },
                { message: 'Test success message', type: 'success' },
                { message: 'Test warning message', type: 'warning' },
                { message: 'Test error message', type: 'error' }
            ];
            
            for (const testMsg of testMessages) {
                webUI.addOutput(testMsg.message, testMsg.type);
            }
            
            // Verify output was added
            const outputEntries = webUI.sessionData.output;
            if (outputEntries.length < testMessages.length) {
                throw new Error('Not all output messages were added');
            }
            
            // Verify last messages match
            const lastEntries = outputEntries.slice(-testMessages.length);
            for (let i = 0; i < testMessages.length; i++) {
                const entry = lastEntries[i];
                const expected = testMessages[i];
                
                if (entry.message !== expected.message || entry.type !== expected.type) {
                    throw new Error(`Output message mismatch at index ${i}`);
                }
            }
            
            // Test WebUI stop
            await webUI.stop();
            
            console.log(chalk.green('✓ Engine to Web UI communication working correctly'));
            this.testResults.push({
                test: 'Engine to Web UI Communication',
                status: 'PASSED',
                details: 'Session updates and output logging working correctly',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ Engine to Web UI communication failed: ${error.message}`));
            this.testResults.push({
                test: 'Engine to Web UI Communication',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testWebUIToClientComm() {
        console.log(chalk.yellow('🔌 Testing Web UI to Client Communication...'));
        
        try {
            const WebUI = require('./lib/web-ui');
            const currentPort = this.getNextPort();
            const webUI = new WebUI(currentPort);
            await webUI.start();
            
            const token = webUI.sessionToken;
            
            // Test WebSocket connection and communication
            const clientMessages = [];
            
            const wsTest = new Promise((resolve, reject) => {
                const ws = new WebSocket(`ws://localhost:${currentPort}?token=${token}`, {
                    headers: {
                        'User-Agent': 'Claude-Loop-Test-Suite/1.0 (testing framework)'
                    }
                });
                
                ws.on('open', () => {
                    console.log(chalk.gray('WebSocket client connected'));
                    
                    // Send session update after connection
                    setTimeout(() => {
                        webUI.updateSession({
                            iterations: 2,
                            currentPhase: 'WebSocket test',
                            testTimestamp: Date.now()
                        });
                    }, 100);
                });
                
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        clientMessages.push(message);
                        
                        console.log(chalk.gray(`Received: ${message.type}`));
                        
                        if (message.type === 'session_data' || message.type === 'session_update') {
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
            
            await webUI.stop();
            
            console.log(chalk.green('✓ Web UI to client communication working correctly'));
            this.testResults.push({
                test: 'Web UI to Client Communication',
                status: 'PASSED',
                details: `Received ${clientMessages.length} WebSocket messages`,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ Web UI to client communication failed: ${error.message}`));
            this.testResults.push({
                test: 'Web UI to Client Communication',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testMCPIntegrationComm() {
        console.log(chalk.yellow('🔧 Testing MCP Integration Communication...'));
        
        try {
            const ClaudeLoopEngine = require('./lib/claude-loop-engine');
            const MCPInstaller = require('./lib/mcp-installer');
            
            // Test engine to MCP installer communication
            const engine = new ClaudeLoopEngine({ repoPath: process.cwd() });
            
            if (!engine.mcpInstaller) {
                throw new Error('MCP installer not available in engine');
            }
            
            if (!(engine.mcpInstaller instanceof MCPInstaller)) {
                throw new Error('MCP installer is not proper instance');
            }
            
            // Test MCP availability check
            try {
                const availability = await engine.mcpInstaller.checkMCPAvailability();
                
                if (typeof availability !== 'object') {
                    throw new Error('MCP availability check returned invalid type');
                }
                
                const requiredProps = ['hasVUDA', 'hasBrowserMCP', 'hasSequentialThinking', 'all'];
                for (const prop of requiredProps) {
                    if (!(prop in availability)) {
                        throw new Error(`MCP availability missing ${prop}`);
                    }
                }
                
                console.log(chalk.gray(`MCP Status: VUDA=${availability.hasVUDA}, Browser=${availability.hasBrowserMCP}, Sequential=${availability.hasSequentialThinking}`));
                
            } catch (error) {
                // Acceptable if config doesn't exist
                if (!error.message.includes('ENOENT') && !error.message.includes('JSON')) {
                    throw error;
                }
                console.log(chalk.gray('MCP config not found (acceptable for testing)'));
            }
            
            // Test MCP installer methods are callable
            const installerMethods = ['checkAndInstall', 'checkMCPAvailability', 'findSmitheryCredentials'];
            for (const method of installerMethods) {
                if (typeof engine.mcpInstaller[method] !== 'function') {
                    throw new Error(`MCP installer method ${method} not available`);
                }
            }
            
            console.log(chalk.green('✓ MCP integration communication working correctly'));
            this.testResults.push({
                test: 'MCP Integration Communication',
                status: 'PASSED',
                details: 'MCP installer properly integrated and accessible',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ MCP integration communication failed: ${error.message}`));
            this.testResults.push({
                test: 'MCP Integration Communication',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testErrorPropagationAndHandling() {
        console.log(chalk.yellow('🚨 Testing Error Propagation and Handling...'));
        
        try {
            const WebUI = require('./lib/web-ui');
            const currentPort = this.getNextPort();
            const webUI = new WebUI(currentPort);
            await webUI.start();
            
            // Test error logging through WebUI
            const errorMessages = [
                'Test error message 1',
                'Test error message 2',
                'Critical system error test'
            ];
            
            for (const errorMsg of errorMessages) {
                webUI.addOutput(errorMsg, 'error');
            }
            
            // Verify errors are in output
            const errorEntries = webUI.sessionData.output.filter(entry => entry.type === 'error');
            
            if (errorEntries.length < errorMessages.length) {
                throw new Error('Not all error messages were logged');
            }
            
            // Test WebSocket error broadcasting
            const token = webUI.sessionToken;
            let errorReceived = false;
            
            const errorTest = new Promise((resolve, reject) => {
                const ws = new WebSocket(`ws://localhost:${currentPort}?token=${token}`, {
                    headers: {
                        'User-Agent': 'Claude-Loop-Test-Suite/1.0 (testing framework)'
                    }
                });
                
                ws.on('open', () => {
                    // Trigger an error message
                    webUI.addOutput('WebSocket error test', 'error');
                });
                
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        if (message.type === 'new_output' && message.data.type === 'error') {
                            errorReceived = true;
                            ws.close();
                            resolve();
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
                
                ws.on('error', reject);
                
                setTimeout(() => {
                    ws.close();
                    if (!errorReceived) {
                        reject(new Error('Error message not received via WebSocket'));
                    }
                }, 5000);
            });
            
            await errorTest;
            
            // Test engine error handling
            const ClaudeLoopEngine = require('./lib/claude-loop-engine');
            const engine = new ClaudeLoopEngine({ repoPath: process.cwd() });
            
            // Test cleanup happens even with errors
            const tempFile = path.join(process.cwd(), 'test-error-cleanup.tmp');
            engine.tempFiles.add(tempFile);
            
            await engine.cleanup(); // Should not throw
            
            await webUI.stop();
            
            console.log(chalk.green('✓ Error propagation and handling working correctly'));
            this.testResults.push({
                test: 'Error Propagation and Handling',
                status: 'PASSED',
                details: 'Errors properly logged and broadcast to clients',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ Error propagation and handling failed: ${error.message}`));
            this.testResults.push({
                test: 'Error Propagation and Handling',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testSessionStateSynchronization() {
        console.log(chalk.yellow('🔄 Testing Session State Synchronization...'));
        
        try {
            const WebUI = require('./lib/web-ui');
            const currentPort = this.getNextPort();
            const webUI = new WebUI(currentPort);
            await webUI.start();
            
            const token = webUI.sessionToken;
            
            // Test multiple client synchronization
            const clients = [];
            const clientMessages = [];
            
            const syncTest = new Promise((resolve, reject) => {
                let connectedClients = 0;
                let receivedUpdates = 0;
                const expectedClients = 3;
                
                for (let i = 0; i < expectedClients; i++) {
                    const ws = new WebSocket(`ws://localhost:${currentPort}?token=${token}`, {
                        headers: {
                            'User-Agent': 'Claude-Loop-Test-Suite/1.0 (testing framework)'
                        }
                    });
                    clients.push(ws);
                    
                    ws.on('open', () => {
                        connectedClients++;
                        console.log(chalk.gray(`Client ${i + 1} connected`));
                        
                        if (connectedClients === expectedClients) {
                            // All clients connected, send session update
                            setTimeout(() => {
                                webUI.updateSession({
                                    iterations: 3,
                                    currentPhase: 'Multi-client sync test',
                                    syncTimestamp: Date.now()
                                });
                            }, 100);
                        }
                    });
                    
                    ws.on('message', (data) => {
                        try {
                            const message = JSON.parse(data);
                            clientMessages.push({ client: i, message });
                            
                            if (message.type === 'session_update' && message.data.syncTimestamp) {
                                receivedUpdates++;
                                console.log(chalk.gray(`Client ${i + 1} received sync update`));
                                
                                if (receivedUpdates === expectedClients) {
                                    // All clients received the update
                                    clients.forEach(client => client.close());
                                    resolve();
                                }
                            }
                        } catch (error) {
                            reject(error);
                        }
                    });
                    
                    ws.on('error', reject);
                }
                
                setTimeout(() => {
                    clients.forEach(client => client.close());
                    reject(new Error('Session synchronization test timeout'));
                }, 10000);
            });
            
            await syncTest;
            
            // Verify all clients received the same data
            const syncMessages = clientMessages.filter(cm => 
                cm.message.type === 'session_update' && cm.message.data.syncTimestamp
            );
            
            if (syncMessages.length < 3) {
                throw new Error(`Expected 3 sync messages, got ${syncMessages.length}`);
            }
            
            // Verify all messages have the same timestamp (same update)
            const timestamps = syncMessages.map(sm => sm.message.data.syncTimestamp);
            const uniqueTimestamps = new Set(timestamps);
            
            if (uniqueTimestamps.size !== 1) {
                throw new Error('Clients received different session data');
            }
            
            await webUI.stop();
            
            console.log(chalk.green('✓ Session state synchronization working correctly'));
            this.testResults.push({
                test: 'Session State Synchronization',
                status: 'PASSED',
                details: 'Multiple clients properly synchronized',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ Session state synchronization failed: ${error.message}`));
            this.testResults.push({
                test: 'Session State Synchronization',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testRealTimeProgressUpdates() {
        console.log(chalk.yellow('📊 Testing Real-Time Progress Updates...'));
        
        try {
            const WebUI = require('./lib/web-ui');
            const currentPort = this.getNextPort();
            const webUI = new WebUI(currentPort);
            await webUI.start();
            
            const token = webUI.sessionToken;
            
            // Test progressive updates
            const updates = [
                { iterations: 1, currentPhase: 'Phase 1', progress: 25 },
                { iterations: 2, currentPhase: 'Phase 2', progress: 50 },
                { iterations: 3, currentPhase: 'Phase 3', progress: 75 },
                { iterations: 4, currentPhase: 'Phase 4', progress: 100 }
            ];
            
            let receivedUpdates = 0;
            
            const progressTest = new Promise((resolve, reject) => {
                const ws = new WebSocket(`ws://localhost:${currentPort}?token=${token}`, {
                    headers: {
                        'User-Agent': 'Claude-Loop-Test-Suite/1.0 (testing framework)'
                    }
                });
                
                ws.on('open', () => {
                    console.log(chalk.gray('Progress monitoring client connected'));
                    
                    // Send updates with delays
                    let updateIndex = 0;
                    const sendNextUpdate = () => {
                        if (updateIndex < updates.length) {
                            const update = updates[updateIndex];
                            console.log(chalk.gray(`Sending update ${updateIndex + 1}: ${update.currentPhase}`));
                            webUI.updateSession(update);
                            updateIndex++;
                            setTimeout(sendNextUpdate, 200);
                        }
                    };
                    
                    setTimeout(sendNextUpdate, 100);
                });
                
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        if (message.type === 'session_update' && message.data.progress) {
                            receivedUpdates++;
                            console.log(chalk.gray(`Received progress update: ${message.data.progress}%`));
                            
                            if (receivedUpdates === updates.length) {
                                ws.close();
                                resolve();
                            }
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
                
                ws.on('error', reject);
                
                setTimeout(() => {
                    ws.close();
                    reject(new Error('Progress updates test timeout'));
                }, 10000);
            });
            
            await progressTest;
            
            if (receivedUpdates !== updates.length) {
                throw new Error(`Expected ${updates.length} progress updates, got ${receivedUpdates}`);
            }
            
            await webUI.stop();
            
            console.log(chalk.green('✓ Real-time progress updates working correctly'));
            this.testResults.push({
                test: 'Real-Time Progress Updates',
                status: 'PASSED',
                details: `Received ${receivedUpdates} sequential progress updates`,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ Real-time progress updates failed: ${error.message}`));
            this.testResults.push({
                test: 'Real-Time Progress Updates',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async testComponentLifecycleManagement() {
        console.log(chalk.yellow('🔄 Testing Component Lifecycle Management...'));
        
        try {
            const ClaudeLoopEngine = require('./lib/claude-loop-engine');
            const WebUI = require('./lib/web-ui');
            
            // Test proper startup order
            const engine = new ClaudeLoopEngine({
                repoPath: process.cwd(),
                maxIterations: 1,
                ui: true
            });
            
            // Test WebUI can be started and stopped independently
            const currentPort = this.getNextPort();
            const webUI = new WebUI(currentPort);
            await webUI.start();
            
            // Verify WebUI is running
            const token = webUI.sessionToken;
            if (!token) {
                throw new Error('WebUI token not generated');
            }
            
            // Test session management
            webUI.updateSession({ 
                isRunning: true,
                currentPhase: 'Lifecycle test'
            });
            
            // Test graceful shutdown
            await webUI.stop();
            
            // Test engine cleanup
            await engine.cleanup();
            
            // Test WebUI restart capability
            const webUI2 = new WebUI(this.getNextPort());
            await webUI2.start();
            
            // Verify new instance works
            const token2 = webUI2.sessionToken;
            if (!token2 || token2 === token) {
                throw new Error('WebUI restart did not generate new token');
            }
            
            await webUI2.stop();
            
            console.log(chalk.green('✓ Component lifecycle management working correctly'));
            this.testResults.push({
                test: 'Component Lifecycle Management',
                status: 'PASSED',
                details: 'Components start, stop, and restart correctly',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ Component lifecycle management failed: ${error.message}`));
            this.testResults.push({
                test: 'Component Lifecycle Management',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
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
            
            console.log(chalk.gray('✓ Test cleanup completed'));
        } catch (error) {
            console.log(chalk.yellow(`⚠️ Cleanup warning: ${error.message}`));
        }
    }

    generateReport() {
        console.log(chalk.cyan.bold('\n📊 Cross-Component Communication Integration Test Report\n'));
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
        const fs = require('fs').promises;
        const reportPath = './cross-component-communication-report.json';
        
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
    const tester = new CrossComponentCommunicationTest();
    tester.runTests().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error(chalk.red(`\n❌ Cross-component communication test suite failed: ${error.message}`));
        process.exit(1);
    });
}

module.exports = CrossComponentCommunicationTest;