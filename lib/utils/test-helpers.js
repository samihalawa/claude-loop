/**
 * Test Helper Utilities for Claude Loop
 * Consolidates duplicate test patterns and provides reusable test functions
 */

const chalk = require('chalk');
const WebUI = require('../web-ui');
const config = require('../config');
const logger = require('./unified-logger');
const { PORTS, URL_PATTERNS, TEST_PORTS } = require('../config/constants');

/**
 * Test port allocation to avoid conflicts
 */
class TestPortManager {
    constructor() {
        this.basePort = TEST_PORTS.ERROR_HANDLING_1;
        this.usedPorts = new Set();
    }

    getAvailablePort() {
        let port = this.basePort;
        while (this.usedPorts.has(port)) {
            port++;
        }
        this.usedPorts.add(port);
        return port;
    }

    releasePort(port) {
        this.usedPorts.delete(port);
    }

    reset() {
        this.usedPorts.clear();
    }
}

const portManager = new TestPortManager();

/**
 * Common WebUI test patterns
 */
class WebUITestHelper {
    constructor(port = null) {
        this.port = port || portManager.getAvailablePort();
        this.webUI = null;
    }

    async createWebUI() {
        if (this.webUI) {
            throw new Error('WebUI already created. Call cleanup() first.');
        }
        this.webUI = new WebUI(this.port);
        return this.webUI;
    }

    async startWebUI() {
        if (!this.webUI) {
            await this.createWebUI();
        }
        await this.webUI.start();
        logger.success(`WebUI started on port ${this.port}`);
        return this.webUI;
    }

    async stopWebUI() {
        if (this.webUI) {
            await this.webUI.stop();
            logger.success(`WebUI stopped on port ${this.port}`);
        }
    }

    async cleanup() {
        await this.stopWebUI();
        if (this.port) {
            portManager.releasePort(this.port);
        }
        this.webUI = null;
    }

    // Common test data patterns
    getTestSessionData() {
        return {
            iterations: 3,
            currentPhase: 'Testing UI Components',
            isRunning: true,
            startTime: Date.now() - 30000
        };
    }

    addTestMessages() {
        if (!this.webUI) {
            throw new Error('WebUI not initialized. Call startWebUI() first.');
        }
        
        this.webUI.addOutput('Test info message', 'info');
        this.webUI.addOutput('Test success message', 'success');
        this.webUI.addOutput('Test warning message', 'warning');
        this.webUI.addOutput('Test error message', 'error');
        
        logger.success('Test messages added to WebUI');
    }

    testBroadcast() {
        if (!this.webUI) {
            throw new Error('WebUI not initialized. Call startWebUI() first.');
        }
        
        this.webUI.broadcast({
            type: 'test_message',
            data: { test: 'broadcast working' }
        });
        
        logger.success('Broadcast test completed');
    }

    getAccessUrl(includeToken = true) {
        if (!this.webUI) {
            throw new Error('WebUI not initialized');
        }
        
        const baseUrl = `http://localhost:${this.port}`;
        return includeToken ? `${baseUrl}?token=${this.webUI.sessionToken}` : baseUrl;
    }
}

/**
 * Common test execution patterns
 */
class TestRunner {
    constructor(testName) {
        this.testName = testName;
        this.results = {
            passed: 0,
            failed: 0,
            total: 0,
            errors: []
        };
    }

    async runTest(testDescription, testFunction) {
        this.results.total++;
        
        try {
            console.log(chalk.blue(`\nTest ${this.results.total}: ${testDescription}`));
            await testFunction();
            console.log(chalk.green(`✓ ${testDescription}`));
            this.results.passed++;
        } catch (error) {
            console.log(chalk.red(`❌ ${testDescription}`));
            console.log(chalk.red(`  Error: ${error.message}`));
            this.results.failed++;
            this.results.errors.push({
                test: testDescription,
                error: error.message
            });
        }
    }

    printResults() {
        console.log(chalk.cyan(`\n📊 ${this.testName} Results:`));
        console.log(chalk.green(`✓ Passed: ${this.results.passed}`));
        console.log(chalk.red(`❌ Failed: ${this.results.failed}`));
        console.log(chalk.blue(`📊 Total: ${this.results.total}`));
        
        if (this.results.errors.length > 0) {
            console.log(chalk.red('\n❌ Failed Tests:'));
            this.results.errors.forEach(error => {
                console.log(chalk.red(`  - ${error.test}: ${error.error}`));
            });
        }
        
        return this.results.failed === 0;
    }

    getResults() {
        return this.results;
    }
}

/**
 * Process management utilities for tests
 */
class ProcessTestHelper {
    static setupGracefulShutdown(cleanupFunction) {
        const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
        
        signals.forEach(signal => {
            process.on(signal, async () => {
                logger.info(`${signal} received, cleaning up...`);
                try {
                    await cleanupFunction();
                    process.exit(0);
                } catch (error) {
                    logger.error('Cleanup failed', error.message);
                    process.exit(1);
                }
            });
        });
    }

    static async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static async withTimeout(promise, timeoutMs, errorMessage = 'Operation timed out') {
        const timeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
        });
        
        return Promise.race([promise, timeout]);
    }
}

/**
 * Configuration utilities for tests
 */
class TestConfig {
    static getTestPort(offset = 0) {
        const basePort = config.get('webUI.port') || PORTS.WEBUI_DEFAULT;
        return basePort + 1000 + offset; // Use 4333+ range for tests
    }

    static getTestConfig() {
        return {
            maxConnections: 2,
            timeout: 5000,
            verbose: true,
            debug: process.env.NODE_ENV === 'development'
        };
    }
}

module.exports = {
    TestPortManager,
    WebUITestHelper,
    TestRunner,
    ProcessTestHelper,
    TestConfig,
    portManager
};