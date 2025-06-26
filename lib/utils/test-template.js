#!/usr/bin/env node

/**
 * Modern Test Template for Claude Loop
 * Demonstrates best practices using consolidated test helpers
 * This template should be used for all new test files
 */

const { WebUITestHelper, TestRunner, portManager } = require('./test-helpers');
const logger = require('./unified-logger');

class ExampleTest {
    constructor() {
        this.testRunner = new TestRunner('Example Test Suite');
        this.webUIHelper = null;
    }

    async runAllTests() {
        try {
            await this.setupTests();
            
            // Run test methods
            await this.testRunner.runTest('Basic Functionality', () => this.testBasicFunctionality());
            await this.testRunner.runTest('WebUI Integration', () => this.testWebUIIntegration());
            await this.testRunner.runTest('Error Handling', () => this.testErrorHandling());
            
            // Generate report
            this.testRunner.generateReport();
            
        } catch (error) {
            logger.error(`Test suite failed: ${error.message}`);
        } finally {
            await this.cleanup();
        }
    }

    async setupTests() {
        // Initialize test helpers
        this.webUIHelper = new WebUITestHelper();
        logger.info('Test environment initialized');
    }

    async testBasicFunctionality() {
        // Example test implementation
        logger.info('Testing basic functionality...');
        // Test logic here
    }

    async testWebUIIntegration() {
        // Example WebUI test using helper
        await this.webUIHelper.startServer();
        
        const isHealthy = await this.webUIHelper.testHealthCheck();
        if (!isHealthy) {
            throw new Error('WebUI health check failed');
        }
        
        logger.info('WebUI integration test passed');
    }

    async testErrorHandling() {
        // Example error handling test
        logger.info('Testing error handling...');
        // Test logic here
    }

    async cleanup() {
        if (this.webUIHelper) {
            await this.webUIHelper.cleanup();
        }
        portManager.reset();
        logger.info('Test cleanup completed');
    }
}

// Run tests if called directly
if (require.main === module) {
    const test = new ExampleTest();
    test.runAllTests().then(() => {
        process.exit(0);
    }).catch((error) => {
        logger.error(`Test execution failed: ${error.message}`);
        process.exit(1);
    });
}

module.exports = ExampleTest;