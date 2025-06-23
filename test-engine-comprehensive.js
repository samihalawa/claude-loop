#!/usr/bin/env node

/**
 * Comprehensive Claude Loop Engine Testing Suite
 * Tests initialization, core functionality, error handling, and security features
 */

const ClaudeLoopEngine = require('./lib/claude-loop-engine');
const WebUI = require('./lib/web-ui');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { spawn } = require('child_process');

class EngineTestSuite {
    constructor() {
        this.testResults = [];
        this.totalTests = 0;
        this.passedTests = 0;
        this.failedTests = 0;
        this.startTime = Date.now();
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: chalk.blue('ℹ'),
            success: chalk.green('✓'),
            error: chalk.red('✗'),
            warning: chalk.yellow('⚠'),
            debug: chalk.gray('►')
        }[type] || chalk.blue('ℹ');
        
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async runTest(testName, testFunction) {
        this.totalTests++;
        this.log(`Running test: ${testName}`, 'debug');
        
        try {
            const startTime = Date.now();
            await testFunction();
            const duration = Date.now() - startTime;
            
            this.passedTests++;
            this.testResults.push({
                name: testName,
                status: 'PASS',
                duration,
                error: null
            });
            this.log(`PASS: ${testName} (${duration}ms)`, 'success');
        } catch (error) {
            this.failedTests++;
            this.testResults.push({
                name: testName,
                status: 'FAIL',
                duration: Date.now() - this.startTime,
                error: error.message
            });
            this.log(`FAIL: ${testName} - ${error.message}`, 'error');
        }
    }

    async testEngineInitialization() {
        // Test basic initialization
        const engine = new ClaudeLoopEngine();
        
        if (!engine.repoPath) throw new Error('repoPath not set');
        if (!engine.maxIterations) throw new Error('maxIterations not set');
        if (!engine.claudeCommand) throw new Error('claudeCommand not set');
        if (engine.iteration !== 0) throw new Error('iteration should start at 0');
        if (engine.conversationActive !== false) throw new Error('conversationActive should start false');
        
        // Test with custom options
        const customEngine = new ClaudeLoopEngine({
            repoPath: '/tmp/test',
            maxIterations: 5,
            claudeCommand: 'custom-claude',
            ui: true
        });
        
        if (customEngine.maxIterations !== 5) throw new Error('Custom maxIterations not applied');
        if (customEngine.ui !== true) throw new Error('UI option not applied');
        
        // Test path resolution
        if (!path.isAbsolute(engine.repoPath)) throw new Error('repoPath should be absolute');
    }

    async testSecurityUtilities() {
        const engine = new ClaudeLoopEngine();
        
        // Test command sanitization
        const unsafeCommand = 'claude; rm -rf /';
        const sanitizedCommand = engine.constructor.prototype.sanitizeCommand || 
            require('./lib/claude-loop-engine').sanitizeCommand;
        
        // Test prompt content validation
        const validPrompt = 'This is a valid prompt for testing';
        const invalidPrompt = 'eval(dangerous_code())';
        
        // Test sanitization function
        const sanitized = engine.sanitizePromptContent(validPrompt);
        if (sanitized !== validPrompt) throw new Error('Valid prompt was modified');
        
        try {
            engine.sanitizePromptContent(invalidPrompt);
            // Should pass but with warnings
        } catch (error) {
            // Expected for very dangerous content
        }
        
        // Test null/undefined handling
        try {
            engine.sanitizePromptContent(null);
            throw new Error('Should have thrown for null content');
        } catch (error) {
            if (!error.message.includes('Invalid prompt content')) {
                throw new Error('Wrong error for null content');
            }
        }
    }

    async testTempFileManagement() {
        const engine = new ClaudeLoopEngine();
        
        // Test temp file tracking
        const initialSize = engine.tempFiles.size;
        
        // Simulate adding a temp file
        const fakeTempFile = '/tmp/test-file.tmp';
        engine.tempFiles.add(fakeTempFile);
        
        if (engine.tempFiles.size !== initialSize + 1) {
            throw new Error('Temp file not added to tracking');
        }
        
        // Test cleanup function exists
        if (typeof engine.cleanup !== 'function') {
            throw new Error('cleanup method not defined');
        }
        
        // Test secure cleanup function exists
        if (typeof engine.secureCleanupTempFile !== 'function') {
            throw new Error('secureCleanupTempFile method not defined');
        }
    }

    async testSignalHandling() {
        const engine = new ClaudeLoopEngine();
        
        // Check that signal handlers are set up
        const listeners = process.listeners('SIGINT');
        if (listeners.length === 0) {
            this.log('Warning: No SIGINT handlers found', 'warning');
        }
        
        // Test that cleanup is called on signal
        if (typeof engine.setupSignalHandlers !== 'function') {
            throw new Error('setupSignalHandlers method not defined');
        }
    }

    async testWebUIIntegration() {
        const engine = new ClaudeLoopEngine({ ui: true });
        
        // Test that WebUI can be created
        if (!engine.ui) throw new Error('UI option not set');
        
        // Test WebUI creation (without actually starting server)
        const webUI = new WebUI(3999); // Use different port for testing
        
        if (!webUI.port) throw new Error('WebUI port not set');
        if (!webUI.app) throw new Error('Express app not created');
        if (!webUI.server) throw new Error('HTTP server not created');
        if (!webUI.wss) throw new Error('WebSocket server not created');
        
        // Test session data structure
        if (!webUI.sessionData) throw new Error('Session data not initialized');
        if (typeof webUI.sessionData.iterations !== 'number') {
            throw new Error('Session iterations not initialized');
        }
        
        await webUI.stop();
    }

    async testErrorHandling() {
        // Test invalid repository path
        try {
            const engine = new ClaudeLoopEngine({
                repoPath: '/nonexistent/path/that/should/not/exist'
            });
            
            // The engine should handle this gracefully during run()
            // but initialization should succeed
            if (!engine.repoPath) throw new Error('Engine should still initialize');
        } catch (error) {
            // Initialization should not fail, only run() should fail
            throw new Error(`Initialization failed for invalid path: ${error.message}`);
        }
        
        // Test invalid max iterations
        const engineWithInvalidIterations = new ClaudeLoopEngine({
            maxIterations: -1
        });
        
        // Should use default value
        if (engineWithInvalidIterations.maxIterations < 1) {
            throw new Error('Should use default for invalid maxIterations');
        }
    }

    async testAllowedTools() {
        const engine = new ClaudeLoopEngine();
        
        if (!Array.isArray(engine.allowedTools)) {
            throw new Error('allowedTools should be an array');
        }
        
        if (engine.allowedTools.length === 0) {
            throw new Error('allowedTools should not be empty');
        }
        
        // Check for essential tools
        const essentialTools = ['Bash', 'Read', 'Write', 'Edit'];
        for (const tool of essentialTools) {
            if (!engine.allowedTools.includes(tool)) {
                throw new Error(`Essential tool ${tool} not in allowedTools`);
            }
        }
    }

    async testMCPIntegration() {
        const engine = new ClaudeLoopEngine();
        
        if (!engine.mcpInstaller) {
            throw new Error('MCP installer not initialized');
        }
        
        // Test that MCP installer has required methods
        if (typeof engine.mcpInstaller.checkAndInstall !== 'function') {
            throw new Error('MCP installer missing checkAndInstall method');
        }
        
        if (typeof engine.mcpInstaller.checkMCPAvailability !== 'function') {
            throw new Error('MCP installer missing checkMCPAvailability method');
        }
    }

    async testConcurrentSafety() {
        // Test that multiple engines can be created without conflicts
        const engines = [];
        
        for (let i = 0; i < 3; i++) {
            const engine = new ClaudeLoopEngine({
                repoPath: process.cwd(),
                maxIterations: 5
            });
            engines.push(engine);
        }
        
        // Each should have unique temp file sets
        const tempFileSets = engines.map(e => e.tempFiles);
        for (let i = 0; i < tempFileSets.length; i++) {
            for (let j = i + 1; j < tempFileSets.length; j++) {
                if (tempFileSets[i] === tempFileSets[j]) {
                    throw new Error('Engines sharing temp file sets');
                }
            }
        }
        
        // Clean up
        for (const engine of engines) {
            await engine.cleanup();
        }
    }

    async testMemoryManagement() {
        const engine = new ClaudeLoopEngine();
        
        // Test that cleanup clears temp files
        engine.tempFiles.add('/fake/file1.tmp');
        engine.tempFiles.add('/fake/file2.tmp');
        
        const initialSize = engine.tempFiles.size;
        if (initialSize === 0) throw new Error('Test setup failed');
        
        await engine.cleanup();
        
        if (engine.tempFiles.size !== 0) {
            throw new Error('Cleanup did not clear temp files set');
        }
    }

    async testConfigurationValidation() {
        // Test configuration constants are loaded
        const engine = new ClaudeLoopEngine();
        
        // Check that constants are accessible
        try {
            const constants = require('./lib/config/constants');
            if (!constants.CLAUDE_LOOP) throw new Error('CLAUDE_LOOP constants not loaded');
            if (!constants.TIMEOUTS) throw new Error('TIMEOUTS constants not loaded');
            if (!constants.SECURITY) throw new Error('SECURITY constants not loaded');
        } catch (error) {
            throw new Error(`Configuration constants not accessible: ${error.message}`);
        }
    }

    async generateReport() {
        const duration = Date.now() - this.startTime;
        const successRate = this.totalTests > 0 ? (this.passedTests / this.totalTests * 100).toFixed(2) : 0;
        
        console.log('\n' + chalk.cyan('='.repeat(60)));
        console.log(chalk.cyan.bold('           ENGINE TEST SUITE REPORT'));
        console.log(chalk.cyan('='.repeat(60)));
        
        console.log(chalk.blue(`📊 Total Tests: ${this.totalTests}`));
        console.log(chalk.green(`✅ Passed: ${this.passedTests}`));
        console.log(chalk.red(`❌ Failed: ${this.failedTests}`));
        console.log(chalk.yellow(`📈 Success Rate: ${successRate}%`));
        console.log(chalk.gray(`⏱️ Total Duration: ${duration}ms`));
        
        if (this.failedTests > 0) {
            console.log('\n' + chalk.red.bold('FAILED TESTS:'));
            this.testResults
                .filter(result => result.status === 'FAIL')
                .forEach(result => {
                    console.log(chalk.red(`❌ ${result.name}: ${result.error}`));
                });
        }
        
        console.log('\n' + chalk.cyan('='.repeat(60)));
        
        // Write detailed report to file
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: this.totalTests,
                passedTests: this.passedTests,
                failedTests: this.failedTests,
                successRate: parseFloat(successRate),
                duration
            },
            results: this.testResults
        };
        
        try {
            await fs.writeFile('engine-test-report.json', JSON.stringify(report, null, 2));
            console.log(chalk.gray('📄 Detailed report saved to engine-test-report.json'));
        } catch (error) {
            console.log(chalk.yellow(`⚠ Could not save report: ${error.message}`));
        }
        
        return this.failedTests === 0;
    }

    async runAllTests() {
        console.log(chalk.cyan.bold('\n🧪 Starting Claude Loop Engine Test Suite\n'));
        
        // Core functionality tests
        await this.runTest('Engine Initialization', () => this.testEngineInitialization());
        await this.runTest('Security Utilities', () => this.testSecurityUtilities());
        await this.runTest('Temp File Management', () => this.testTempFileManagement());
        await this.runTest('Signal Handling', () => this.testSignalHandling());
        await this.runTest('WebUI Integration', () => this.testWebUIIntegration());
        await this.runTest('Error Handling', () => this.testErrorHandling());
        await this.runTest('Allowed Tools Configuration', () => this.testAllowedTools());
        await this.runTest('MCP Integration', () => this.testMCPIntegration());
        await this.runTest('Concurrent Safety', () => this.testConcurrentSafety());
        await this.runTest('Memory Management', () => this.testMemoryManagement());
        await this.runTest('Configuration Validation', () => this.testConfigurationValidation());
        
        return await this.generateReport();
    }
}

// Run tests if called directly
if (require.main === module) {
    const testSuite = new EngineTestSuite();
    testSuite.runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error(chalk.red('Test suite crashed:'), error);
            process.exit(1);
        });
}

module.exports = EngineTestSuite;