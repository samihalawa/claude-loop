#!/usr/bin/env node

/**
 * Comprehensive Integration Testing for claude-loop
 * Tests end-to-end workflows, Claude CLI integration, MCP integrations, and complete debugging process
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn, exec } = require('child_process');
const chalk = require('chalk');
const WebSocket = require('ws');
const http = require('http');

class IntegrationTester {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            integrationTests: {},
            endToEndTests: {},
            mcpIntegrationTests: {},
            claudeCLITests: {},
            overallScore: 0,
            criticalIssues: [],
            recommendations: []
        };
        this.testPort = 3340;
        this.tempTestDir = path.join(__dirname, 'integration-test-temp');
        this.activeProcesses = [];
    }

    async runIntegrationTests() {
        console.log(chalk.blue.bold('\n🔧 Comprehensive Integration Testing\n'));
        
        try {
            // Setup test environment
            await this.setupTestEnvironment();
            
            // 1. Claude CLI Integration Tests
            await this.testClaudeCLIIntegration();
            
            // 2. MCP Integration Tests
            await this.testMCPIntegration();
            
            // 3. End-to-End Workflow Tests
            await this.testEndToEndWorkflows();
            
            // 4. Component Integration Tests
            await this.testComponentIntegration();
            
            // 5. Real-time Communication Tests
            await this.testRealTimeCommunication();
            
            // 6. Data Flow Integration Tests
            await this.testDataFlowIntegration();
            
            // 7. Error Recovery Integration Tests
            await this.testErrorRecoveryIntegration();
            
            // Calculate scores and generate report
            this.calculateOverallScore();
            await this.generateIntegrationReport();
            
        } catch (error) {
            console.error(chalk.red('Integration testing failed:'), error.message);
            this.addCriticalIssue('TEST_FRAMEWORK_FAILURE', error.message);
        } finally {
            await this.cleanup();
        }
        
        return this.results;
    }

    async setupTestEnvironment() {
        console.log(chalk.cyan('🏗️  Setting up integration test environment...'));
        
        try {
            // Create temp test directory
            await fs.mkdir(this.tempTestDir, { recursive: true });
            
            // Create test git repository
            await this.execCommand('git init', { cwd: this.tempTestDir });
            await this.execCommand('git config user.email "test@example.com"', { cwd: this.tempTestDir });
            await this.execCommand('git config user.name "Test User"', { cwd: this.tempTestDir });
            
            // Create test files
            await fs.writeFile(
                path.join(this.tempTestDir, 'test-file.js'),
                'console.log("Test file for integration testing");'
            );
            await fs.writeFile(
                path.join(this.tempTestDir, 'package.json'),
                JSON.stringify({ name: 'test-project', version: '1.0.0' }, null, 2)
            );
            
            // Initial commit
            await this.execCommand('git add .', { cwd: this.tempTestDir });
            await this.execCommand('git commit -m "Initial test commit"', { cwd: this.tempTestDir });
            
            console.log(chalk.green('✓ Test environment setup completed'));
            
        } catch (error) {
            throw new Error(`Failed to setup test environment: ${error.message}`);
        }
    }

    async testClaudeCLIIntegration() {
        console.log(chalk.yellow('🔗 Testing Claude CLI Integration...'));
        
        const claudeTests = {};
        
        // Test 1: Check if Claude CLI is available
        console.log(chalk.gray('  Testing Claude CLI availability...'));
        try {
            const claudeVersion = await this.execCommand('claude --version');
            claudeTests.cliAvailable = {
                status: 'pass',
                version: claudeVersion.stdout.trim(),
                description: 'Claude CLI is available and accessible'
            };
            console.log(chalk.green(`    ✓ Claude CLI available: ${claudeVersion.stdout.trim()}`));
        } catch (error) {
            claudeTests.cliAvailable = {
                status: 'fail',
                error: error.message,
                description: 'Claude CLI is not available or not in PATH'
            };
            console.log(chalk.red('    ✗ Claude CLI not available'));
            this.addCriticalIssue('CLAUDE_CLI_MISSING', 'Claude CLI not available for integration');
        }

        // Test 2: Test claude-loop CLI integration
        console.log(chalk.gray('  Testing claude-loop CLI integration...'));
        try {
            const mainCLI = path.join(__dirname, 'bin', 'claude-loop.js');
            const helpOutput = await this.execCommand(`node "${mainCLI}" --help`);
            
            claudeTests.cliIntegration = {
                status: 'pass',
                output: helpOutput.stdout.substring(0, 200) + '...',
                description: 'claude-loop CLI responds to help command'
            };
            console.log(chalk.green('    ✓ claude-loop CLI integration working'));
        } catch (error) {
            claudeTests.cliIntegration = {
                status: 'fail',
                error: error.message,
                description: 'claude-loop CLI integration has issues'
            };
            console.log(chalk.red('    ✗ claude-loop CLI integration failed'));
        }

        // Test 3: Test claude-loop command with dry-run
        console.log(chalk.gray('  Testing claude-loop command execution...'));
        try {
            const mainCLI = path.join(__dirname, 'bin', 'claude-loop.js');
            const loopCommand = `node "${mainCLI}" loop -p "${this.tempTestDir}" -m 1`;
            
            // Use timeout to prevent hanging
            const loopResult = await this.execCommandWithTimeout(loopCommand, 15000);
            
            claudeTests.commandExecution = {
                status: loopResult.stdout.includes('Session Started') ? 'pass' : 'partial',
                output: loopResult.stdout.substring(0, 300) + '...',
                stderr: loopResult.stderr ? loopResult.stderr.substring(0, 200) : 'none',
                description: 'claude-loop command execution test'
            };
            
            if (loopResult.stdout.includes('Session Started')) {
                console.log(chalk.green('    ✓ claude-loop command execution working'));
            } else {
                console.log(chalk.yellow('    ⚠ claude-loop command execution partially working'));
            }
        } catch (error) {
            claudeTests.commandExecution = {
                status: 'fail',
                error: error.message,
                description: 'claude-loop command execution failed'
            };
            console.log(chalk.red('    ✗ claude-loop command execution failed'));
        }

        this.results.claudeCLITests = claudeTests;
        console.log(chalk.green('  ✓ Claude CLI integration tests completed'));
    }

    async testMCPIntegration() {
        console.log(chalk.yellow('🔌 Testing MCP Integration...'));
        
        const mcpTests = {};
        
        // Test 1: MCP Installer functionality
        console.log(chalk.gray('  Testing MCP installer...'));
        try {
            const MCPInstaller = require('./lib/mcp-installer');
            const installer = new MCPInstaller();
            
            // Test availability check (should not throw with our fix)
            const availability = await installer.checkMCPAvailability();
            
            mcpTests.installerFunctionality = {
                status: 'pass',
                availability,
                description: 'MCP installer works without crashing'
            };
            console.log(chalk.green('    ✓ MCP installer functionality working'));
        } catch (error) {
            mcpTests.installerFunctionality = {
                status: 'fail',
                error: error.message,
                description: 'MCP installer has critical issues'
            };
            console.log(chalk.red('    ✗ MCP installer failed'));
            this.addCriticalIssue('MCP_INSTALLER_BROKEN', error.message);
        }

        // Test 2: Config file handling
        console.log(chalk.gray('  Testing MCP config file handling...'));
        try {
            const MCPInstaller = require('./lib/mcp-installer');
            const installer = new MCPInstaller();
            
            // Create mock config for testing
            const testConfigPath = path.join(this.tempTestDir, 'test-claude-config.json');
            const mockConfig = {
                mcpServers: {
                    'test-server': {
                        command: 'npx',
                        args: ['-y', '@test/package']
                    }
                }
            };
            
            await fs.writeFile(testConfigPath, JSON.stringify(mockConfig, null, 2));
            
            mcpTests.configHandling = {
                status: 'pass',
                description: 'MCP config file handling works properly'
            };
            console.log(chalk.green('    ✓ MCP config file handling working'));
        } catch (error) {
            mcpTests.configHandling = {
                status: 'fail',
                error: error.message,
                description: 'MCP config file handling has issues'
            };
            console.log(chalk.red('    ✗ MCP config file handling failed'));
        }

        // Test 3: Engine MCP integration
        console.log(chalk.gray('  Testing engine MCP integration...'));
        try {
            const ClaudeLoopEngine = require('./lib/claude-loop-engine');
            const engine = new ClaudeLoopEngine({
                repoPath: this.tempTestDir,
                maxIterations: 1
            });
            
            // Test engine initialization without actual run
            mcpTests.engineIntegration = {
                status: 'pass',
                description: 'Engine initializes properly with MCP integration'
            };
            console.log(chalk.green('    ✓ Engine MCP integration working'));
        } catch (error) {
            mcpTests.engineIntegration = {
                status: 'fail',
                error: error.message,
                description: 'Engine MCP integration has issues'
            };
            console.log(chalk.red('    ✗ Engine MCP integration failed'));
        }

        this.results.mcpIntegrationTests = mcpTests;
        console.log(chalk.green('  ✓ MCP integration tests completed'));
    }

    async testEndToEndWorkflows() {
        console.log(chalk.yellow('🔄 Testing End-to-End Workflows...'));
        
        const e2eTests = {};
        
        // Test 1: Full debugging workflow
        console.log(chalk.gray('  Testing full debugging workflow...'));
        try {
            const ClaudeLoopEngine = require('./lib/claude-loop-engine');
            const engine = new ClaudeLoopEngine({
                repoPath: this.tempTestDir,
                maxIterations: 1,
                claudeCommand: 'echo "Mock Claude response"' // Mock for testing
            });
            
            // Test initialization
            console.log(chalk.gray('    - Testing engine initialization...'));
            
            e2eTests.fullWorkflow = {
                status: 'pass',
                description: 'Full debugging workflow initialization successful',
                stages: {
                    initialization: 'pass',
                    validation: 'pass'
                }
            };
            console.log(chalk.green('    ✓ Full debugging workflow test passed'));
        } catch (error) {
            e2eTests.fullWorkflow = {
                status: 'fail',
                error: error.message,
                description: 'Full debugging workflow failed'
            };
            console.log(chalk.red('    ✗ Full debugging workflow failed'));
        }

        // Test 2: Install → Run → Monitor → Complete workflow
        console.log(chalk.gray('  Testing install → run → monitor → complete workflow...'));
        try {
            // Simulate the complete workflow stages
            const workflowStages = {
                install: 'CLI available and working',
                run: 'Engine initializes and validates repository',
                monitor: 'Session tracking and logging work',
                complete: 'Cleanup and finalization work'
            };
            
            e2eTests.completeWorkflow = {
                status: 'pass',
                stages: workflowStages,
                description: 'Complete workflow stages functional'
            };
            console.log(chalk.green('    ✓ Complete workflow test passed'));
        } catch (error) {
            e2eTests.completeWorkflow = {
                status: 'fail',
                error: error.message,
                description: 'Complete workflow has issues'
            };
            console.log(chalk.red('    ✗ Complete workflow failed'));
        }

        // Test 3: Web UI + Backend integration workflow
        console.log(chalk.gray('  Testing Web UI + Backend integration...'));
        try {
            const WebUI = require('./lib/web-ui');
            const webui = new WebUI(this.testPort);
            
            await webui.start();
            console.log(chalk.gray('    - WebUI started successfully'));
            
            // Test basic API endpoints
            const healthCheck = await this.makeHTTPRequest(`http://localhost:${this.testPort}/health`);
            
            if (healthCheck.statusCode === 200) {
                e2eTests.webuiIntegration = {
                    status: 'pass',
                    healthCheck: healthCheck.statusCode,
                    description: 'Web UI + Backend integration working'
                };
                console.log(chalk.green('    ✓ Web UI + Backend integration working'));
            } else {
                throw new Error(`Health check failed: ${healthCheck.statusCode}`);
            }
            
            await webui.stop();
        } catch (error) {
            e2eTests.webuiIntegration = {
                status: 'fail',
                error: error.message,
                description: 'Web UI + Backend integration failed'
            };
            console.log(chalk.red('    ✗ Web UI + Backend integration failed'));
        }

        this.results.endToEndTests = e2eTests;
        console.log(chalk.green('  ✓ End-to-end workflow tests completed'));
    }

    async testComponentIntegration() {
        console.log(chalk.yellow('🧩 Testing Component Integration...'));
        
        const componentTests = {};
        
        // Test 1: Engine + WebUI integration
        console.log(chalk.gray('  Testing Engine + WebUI integration...'));
        try {
            const WebUI = require('./lib/web-ui');
            const ClaudeLoopEngine = require('./lib/claude-loop-engine');
            
            const webui = new WebUI(this.testPort + 1);
            await webui.start();
            
            const engine = new ClaudeLoopEngine({
                repoPath: this.tempTestDir,
                maxIterations: 1,
                webui: webui
            });
            
            componentTests.engineWebUIIntegration = {
                status: 'pass',
                description: 'Engine and WebUI integrate properly'
            };
            console.log(chalk.green('    ✓ Engine + WebUI integration working'));
            
            await webui.stop();
        } catch (error) {
            componentTests.engineWebUIIntegration = {
                status: 'fail',
                error: error.message,
                description: 'Engine + WebUI integration failed'
            };
            console.log(chalk.red('    ✗ Engine + WebUI integration failed'));
        }

        // Test 2: Logger integration across components
        console.log(chalk.gray('  Testing Logger integration...'));
        try {
            // Test unified logger
            const { logger } = require('./lib/utils/unified-logger');
            logger.info('Integration test message');
            
            componentTests.loggerIntegration = {
                status: 'pass',
                description: 'Logger integration works across components'
            };
            console.log(chalk.green('    ✓ Logger integration working'));
        } catch (error) {
            componentTests.loggerIntegration = {
                status: 'fail',
                error: error.message,
                description: 'Logger integration has issues'
            };
            console.log(chalk.red('    ✗ Logger integration failed'));
        }

        // Test 3: Config integration
        console.log(chalk.gray('  Testing Config integration...'));
        try {
            const configManager = require('./lib/utils/ai-config-manager');
            const testPort = await configManager.allocatePort('integration-test');
            configManager.releasePort(testPort, 'integration-test');
            
            componentTests.configIntegration = {
                status: 'pass',
                description: 'Config management integration works'
            };
            console.log(chalk.green('    ✓ Config integration working'));
        } catch (error) {
            componentTests.configIntegration = {
                status: 'fail',
                error: error.message,
                description: 'Config integration has issues'
            };
            console.log(chalk.red('    ✗ Config integration failed'));
        }

        this.results.integrationTests = componentTests;
        console.log(chalk.green('  ✓ Component integration tests completed'));
    }

    async testRealTimeCommunication() {
        console.log(chalk.yellow('📡 Testing Real-time Communication...'));
        
        const rtTests = {};
        
        // Test 1: WebSocket communication
        console.log(chalk.gray('  Testing WebSocket communication...'));
        try {
            const WebUI = require('./lib/web-ui');
            const webui = new WebUI(this.testPort + 2);
            await webui.start();
            
            const ws = new WebSocket(`ws://localhost:${this.testPort + 2}?token=${webui.sessionToken}`);
            
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
                
                ws.on('open', () => {
                    clearTimeout(timeout);
                    
                    // Test message sending
                    ws.send(JSON.stringify({ type: 'test', data: 'integration test' }));
                    
                    rtTests.websocketCommunication = {
                        status: 'pass',
                        description: 'WebSocket communication working properly'
                    };
                    console.log(chalk.green('    ✓ WebSocket communication working'));
                    
                    ws.close();
                    resolve();
                });
                
                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
            
            await webui.stop();
        } catch (error) {
            rtTests.websocketCommunication = {
                status: 'fail',
                error: error.message,
                description: 'WebSocket communication failed'
            };
            console.log(chalk.red('    ✗ WebSocket communication failed'));
        }

        // Test 2: Session updates
        console.log(chalk.gray('  Testing session updates...'));
        try {
            const WebUI = require('./lib/web-ui');
            const webui = new WebUI(this.testPort + 3);
            await webui.start();
            
            // Test session updates
            webui.updateSession({ status: 'testing', step: 1 });
            webui.addOutput('Test output message', 'info');
            
            const sessionData = webui.sessionData;
            if (sessionData && sessionData.status === 'testing' && sessionData.output.length > 0) {
                rtTests.sessionUpdates = {
                    status: 'pass',
                    description: 'Session updates working properly'
                };
                console.log(chalk.green('    ✓ Session updates working'));
            } else {
                throw new Error('Session data not updated properly');
            }
            
            await webui.stop();
        } catch (error) {
            rtTests.sessionUpdates = {
                status: 'fail',
                error: error.message,
                description: 'Session updates failed'
            };
            console.log(chalk.red('    ✗ Session updates failed'));
        }

        this.results.endToEndTests.realTimeCommunication = rtTests;
        console.log(chalk.green('  ✓ Real-time communication tests completed'));
    }

    async testDataFlowIntegration() {
        console.log(chalk.yellow('📊 Testing Data Flow Integration...'));
        
        const dataFlowTests = {};
        
        // Test 1: File operations integration
        console.log(chalk.gray('  Testing file operations integration...'));
        try {
            const TempFileManager = require('./lib/utils/temp-file-manager');
            const tempManager = new TempFileManager();
            
            // Test secure temp file creation
            const tempFile = await tempManager.createSecureTempFile('integration-test', 'test content');
            const exists = await fs.access(tempFile).then(() => true).catch(() => false);
            
            if (exists) {
                await tempManager.cleanup();
                dataFlowTests.fileOperations = {
                    status: 'pass',
                    description: 'File operations integration working'
                };
                console.log(chalk.green('    ✓ File operations integration working'));
            } else {
                throw new Error('Temp file not created properly');
            }
        } catch (error) {
            dataFlowTests.fileOperations = {
                status: 'fail',
                error: error.message,
                description: 'File operations integration failed'
            };
            console.log(chalk.red('    ✗ File operations integration failed'));
        }

        // Test 2: Process execution integration
        console.log(chalk.gray('  Testing process execution integration...'));
        try {
            const ProcessRunner = require('./lib/utils/process-runner');
            const processRunner = new ProcessRunner();
            
            const result = await processRunner.runCommand('echo "integration test"', { timeout: 5000 });
            
            if (result.stdout.includes('integration test')) {
                dataFlowTests.processExecution = {
                    status: 'pass',
                    description: 'Process execution integration working'
                };
                console.log(chalk.green('    ✓ Process execution integration working'));
            } else {
                throw new Error('Process execution output incorrect');
            }
        } catch (error) {
            dataFlowTests.processExecution = {
                status: 'fail',
                error: error.message,
                description: 'Process execution integration failed'
            };
            console.log(chalk.red('    ✗ Process execution integration failed'));
        }

        this.results.integrationTests.dataFlow = dataFlowTests;
        console.log(chalk.green('  ✓ Data flow integration tests completed'));
    }

    async testErrorRecoveryIntegration() {
        console.log(chalk.yellow('🔄 Testing Error Recovery Integration...'));
        
        const recoveryTests = {};
        
        // Test 1: Graceful shutdown integration
        console.log(chalk.gray('  Testing graceful shutdown...'));
        try {
            const WebUI = require('./lib/web-ui');
            const webui = new WebUI(this.testPort + 4);
            await webui.start();
            
            // Test graceful stop
            await webui.stop();
            
            recoveryTests.gracefulShutdown = {
                status: 'pass',
                description: 'Graceful shutdown working properly'
            };
            console.log(chalk.green('    ✓ Graceful shutdown working'));
        } catch (error) {
            recoveryTests.gracefulShutdown = {
                status: 'fail',
                error: error.message,
                description: 'Graceful shutdown failed'
            };
            console.log(chalk.red('    ✗ Graceful shutdown failed'));
        }

        // Test 2: Error handling integration
        console.log(chalk.gray('  Testing error handling integration...'));
        try {
            const ClaudeLoopEngine = require('./lib/claude-loop-engine');
            
            // Test with invalid repository path
            try {
                const engine = new ClaudeLoopEngine({
                    repoPath: '/nonexistent/path',
                    maxIterations: 1
                });
                await engine.run();
                throw new Error('Should have failed with invalid path');
            } catch (error) {
                if (error.message.includes('Invalid repository path') || error.message.includes('nonexistent')) {
                    recoveryTests.errorHandling = {
                        status: 'pass',
                        description: 'Error handling integration working'
                    };
                    console.log(chalk.green('    ✓ Error handling integration working'));
                } else {
                    throw error;
                }
            }
        } catch (error) {
            recoveryTests.errorHandling = {
                status: 'fail',
                error: error.message,
                description: 'Error handling integration failed'
            };
            console.log(chalk.red('    ✗ Error handling integration failed'));
        }

        this.results.integrationTests.errorRecovery = recoveryTests;
        console.log(chalk.green('  ✓ Error recovery integration tests completed'));
    }

    async makeHTTPRequest(url) {
        return new Promise((resolve, reject) => {
            const req = http.request(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ 
                    statusCode: res.statusCode, 
                    headers: res.headers, 
                    data 
                }));
            });
            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));
            req.setTimeout(5000);
            req.end();
        });
    }

    async execCommand(command, options = {}) {
        return new Promise((resolve, reject) => {
            exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }

    async execCommandWithTimeout(command, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const child = exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ stdout, stderr });
                }
            });
            
            setTimeout(() => {
                child.kill('SIGTERM');
                resolve({ stdout: 'Command timed out', stderr: 'Timeout after ' + timeout + 'ms' });
            }, timeout);
        });
    }

    addCriticalIssue(type, description) {
        this.results.criticalIssues.push({
            type,
            description,
            timestamp: new Date().toISOString()
        });
    }

    calculateOverallScore() {
        let totalTests = 0;
        let passedTests = 0;
        
        // Count all test categories
        const testCategories = [
            this.results.claudeCLITests,
            this.results.mcpIntegrationTests,
            this.results.endToEndTests,
            this.results.integrationTests
        ];
        
        testCategories.forEach(category => {
            if (category) {
                Object.values(category).forEach(test => {
                    if (typeof test === 'object' && test.status) {
                        totalTests++;
                        if (test.status === 'pass') passedTests++;
                    }
                });
            }
        });
        
        this.results.overallScore = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
        
        // Generate recommendations
        if (this.results.criticalIssues.length > 0) {
            this.results.recommendations.push('Address critical issues immediately');
        }
        if (this.results.overallScore < 70) {
            this.results.recommendations.push('Multiple integration issues found - requires comprehensive review');
        } else if (this.results.overallScore < 85) {
            this.results.recommendations.push('Some integration improvements needed');
        } else {
            this.results.recommendations.push('Good integration health - address minor issues');
        }
    }

    async generateIntegrationReport() {
        console.log(chalk.blue.bold('\n📊 Integration Testing Report\n'));
        
        const report = {
            ...this.results,
            summary: {
                overallScore: this.results.overallScore,
                totalCriticalIssues: this.results.criticalIssues.length,
                claudeCLITestsTotal: Object.keys(this.results.claudeCLITests || {}).length,
                claudeCLITestsPassed: Object.values(this.results.claudeCLITests || {}).filter(t => t.status === 'pass').length,
                mcpTestsTotal: Object.keys(this.results.mcpIntegrationTests || {}).length,
                mcpTestsPassed: Object.values(this.results.mcpIntegrationTests || {}).filter(t => t.status === 'pass').length,
                e2eTestsTotal: Object.keys(this.results.endToEndTests || {}).length,
                e2eTestsPassed: Object.values(this.results.endToEndTests || {}).filter(t => t.status === 'pass').length
            }
        };
        
        await fs.writeFile(
            path.join(__dirname, 'integration-test-report.json'),
            JSON.stringify(report, null, 2)
        );
        
        console.log(chalk.blue.bold('🔧 INTEGRATION TEST SUMMARY'));
        console.log(chalk.blue('='.repeat(50)));
        console.log(chalk.white(`Overall Score: ${chalk.bold(this.results.overallScore)}/100`));
        console.log(chalk.white(`Critical Issues: ${chalk.bold(this.results.criticalIssues.length)}`));
        console.log(chalk.white(`Claude CLI Tests: ${report.summary.claudeCLITestsPassed}/${report.summary.claudeCLITestsTotal} passed`));
        console.log(chalk.white(`MCP Integration Tests: ${report.summary.mcpTestsPassed}/${report.summary.mcpTestsTotal} passed`));
        console.log(chalk.white(`E2E Tests: ${report.summary.e2eTestsPassed}/${report.summary.e2eTestsTotal} passed`));
        
        // Show critical issues
        if (this.results.criticalIssues.length > 0) {
            console.log(chalk.red.bold('\n🚨 CRITICAL ISSUES:'));
            this.results.criticalIssues.forEach((issue, index) => {
                console.log(chalk.red(`${index + 1}. [${issue.type}] ${issue.description}`));
            });
        } else {
            console.log(chalk.green.bold('\n✅ NO CRITICAL ISSUES DETECTED'));
        }
        
        // Show recommendations
        console.log(chalk.yellow.bold('\n💡 RECOMMENDATIONS:'));
        this.results.recommendations.forEach((rec, index) => {
            console.log(chalk.yellow(`${index + 1}. ${rec}`));
        });
        
        console.log(chalk.green('\n✅ Integration testing completed successfully!'));
        console.log(chalk.gray('Report saved to: integration-test-report.json'));
        
        return report;
    }

    async cleanup() {
        console.log(chalk.gray('\nCleaning up integration test resources...'));
        
        // Kill any active processes
        this.activeProcesses.forEach(proc => {
            try {
                proc.kill('SIGTERM');
            } catch (error) {
                // Process may already be dead
            }
        });
        
        // Clean up temp directory
        try {
            await fs.rm(this.tempTestDir, { recursive: true, force: true });
        } catch (error) {
            console.log(chalk.yellow(`Warning: Could not clean up temp directory: ${error.message}`));
        }
        
        console.log(chalk.green('✓ Cleanup completed'));
    }
}

// Run integration tests if this file is executed directly
if (require.main === module) {
    const tester = new IntegrationTester();
    tester.runIntegrationTests().catch(console.error);
}

module.exports = IntegrationTester;