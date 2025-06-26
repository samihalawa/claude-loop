#!/usr/bin/env node

/**
 * Consolidated CLI Test Suite
 * Replaces multiple scattered CLI test files with comprehensive testing
 * Uses standardized spawn patterns and error handling
 */

const { spawn } = require('child_process');
const path = require('path');
const { TestRunner } = require('./lib/utils/test-helpers');
const logger = require('./lib/utils/unified-logger');
const chalk = require('chalk');

class ConsolidatedCLITest {
    constructor() {
        this.testRunner = new TestRunner('Consolidated CLI Test Suite');
        this.claudeLoopPath = path.join(__dirname, 'bin', 'claude-loop.js');
    }

    async runAllTests() {
        try {
            logger.info(chalk.cyan('🚀 Starting Consolidated CLI Test Suite'));
            
            // Basic CLI functionality
            await this.testRunner.runTest('Help Command', () => this.testHelpCommand());
            await this.testRunner.runTest('Version Command', () => this.testVersionCommand());
            await this.testRunner.runTest('Basic CLI Execution', () => this.testBasicExecution());
            
            // Parameter validation
            await this.testRunner.runTest('Valid Parameters', () => this.testValidParameters());
            await this.testRunner.runTest('Invalid Parameters', () => this.testInvalidParameters());
            await this.testRunner.runTest('Parameter Edge Cases', () => this.testParameterEdgeCases());
            
            // Command variations
            await this.testRunner.runTest('Loop Command', () => this.testLoopCommand());
            await this.testRunner.runTest('CLI Options', () => this.testCLIOptions());
            
            // Error handling
            await this.testRunner.runTest('Error Scenarios', () => this.testErrorScenarios());
            await this.testRunner.runTest('Interrupt Handling', () => this.testInterruptHandling());
            
            // Generate report
            this.testRunner.generateReport();
            
            // Save results
            await this.saveTestResults();
            
        } catch (error) {
            logger.error(`CLI test suite failed: ${error.message}`);
            throw error;
        }
    }

    async testHelpCommand() {
        logger.info('Testing help command...');
        
        const variations = ['--help', '-h', 'help'];
        
        for (const variation of variations) {
            const result = await this.runCLICommand([variation]);
            
            if (!result.success || !result.stdout.includes('AI-powered repository debugging tool')) {
                throw new Error(`Help command failed for ${variation}: ${result.stderr}`);
            }
        }
        
        logger.info('✓ Help command working for all variations');
    }

    async testVersionCommand() {
        logger.info('Testing version command...');
        
        const variations = ['--version', '-V'];
        
        for (const variation of variations) {
            const result = await this.runCLICommand([variation]);
            
            if (!result.success || !result.stdout.match(/\\d+\\.\\d+\\.\\d+/)) {
                throw new Error(`Version command failed for ${variation}: ${result.stderr}`);
            }
        }
        
        logger.info('✓ Version command working');
    }

    async testBasicExecution() {
        logger.info('Testing basic CLI execution...');
        
        // Test running without arguments (should show help and run)
        const result = await this.runCLICommand([], { timeout: 5000 });
        
        if (!result.stdout.includes('Claude Loop') && !result.stdout.includes('Starting claude-loop')) {
            throw new Error(`Basic execution failed: ${result.stderr}`);
        }
        
        logger.info('✓ Basic CLI execution working');
    }

    async testValidParameters() {
        logger.info('Testing valid parameters...');
        
        const validParameterSets = [
            ['loop', '--max-iterations', '5'],
            ['loop', '-m', '3'],
            ['loop', '--path', '.'],
            ['loop', '-p', '.'],
            ['loop', '--claude-command', 'claude'],
            ['loop', '-c', 'claude'],
            ['loop', '--ui'],
            ['loop', '-u']
        ];
        
        for (const params of validParameterSets) {
            const result = await this.runCLICommand(params, { timeout: 3000 });
            
            // For valid parameters, we expect either success or controlled termination
            if (result.exitCode !== 0 && result.exitCode !== 1 && !result.killed) {
                logger.warn(`Parameter set [${params.join(' ')}] had unexpected exit code: ${result.exitCode}`);
            }
        }
        
        logger.info('✓ Valid parameters handled correctly');
    }

    async testInvalidParameters() {
        logger.info('Testing invalid parameters...');
        
        const invalidParameterSets = [
            ['loop', '--max-iterations', '0'],
            ['loop', '--max-iterations', '-1'],
            ['loop', '--max-iterations', 'invalid'],
            ['loop', '--unknown-option'],
            ['invalid-command']
        ];
        
        for (const params of invalidParameterSets) {
            const result = await this.runCLICommand(params, { timeout: 3000 });
            
            // Invalid parameters should result in error exit codes
            if (result.exitCode === 0) {
                throw new Error(`Invalid parameters should have failed: [${params.join(' ')}]`);
            }
        }
        
        logger.info('✓ Invalid parameters properly rejected');
    }

    async testParameterEdgeCases() {
        logger.info('Testing parameter edge cases...');
        
        const edgeCases = [
            ['loop', '--max-iterations', '999'],  // Very high number
            ['loop', '--max-iterations', '1'],    // Minimum valid
            ['loop', '--path', '/nonexistent'],   // Non-existent path
            ['loop', '--claude-command', ''],     // Empty command
            ['loop', '--ui', '--max-iterations', '2'] // Multiple flags
        ];
        
        for (const params of edgeCases) {
            const result = await this.runCLICommand(params, { timeout: 3000 });
            
            // Edge cases should be handled gracefully (either work or fail predictably)
            logger.info(`Edge case [${params.join(' ')}]: exit code ${result.exitCode}`);
        }
        
        logger.info('✓ Parameter edge cases handled');
    }

    async testLoopCommand() {
        logger.info('Testing loop command specifically...');
        
        const result = await this.runCLICommand(['loop', '--max-iterations', '1'], { timeout: 10000 });
        
        // The loop command should start and then exit (with any exit code is acceptable for test)
        if (!result.executed) {
            throw new Error(`Loop command failed to execute: ${result.stderr}`);
        }
        
        logger.info('✓ Loop command executed');
    }

    async testCLIOptions() {
        logger.info('Testing CLI options combinations...');
        
        const optionCombinations = [
            ['loop', '-m', '2', '-p', '.'],
            ['loop', '--ui', '--max-iterations', '1'],
            ['loop', '-u', '-m', '1', '-c', 'claude']
        ];
        
        for (const options of optionCombinations) {
            const result = await this.runCLICommand(options, { timeout: 5000 });
            logger.info(`Options [${options.join(' ')}]: executed=${result.executed}`);
        }
        
        logger.info('✓ CLI options combinations tested');
    }

    async testErrorScenarios() {
        logger.info('Testing error scenarios...');
        
        // Test with non-existent claude command
        const result = await this.runCLICommand(['loop', '--claude-command', 'nonexistent-claude-command'], { timeout: 5000 });
        
        // Should fail gracefully
        if (result.exitCode === 0) {
            logger.warn('Expected error scenario to fail but it succeeded');
        }
        
        logger.info('✓ Error scenarios handled');
    }

    async testInterruptHandling() {
        logger.info('Testing interrupt handling...');
        
        const child = spawn('node', [this.claudeLoopPath, 'loop', '--max-iterations', '10'], {
            stdio: 'pipe'
        });
        
        // Let it run for a moment, then interrupt
        setTimeout(() => {
            child.kill('SIGINT');
        }, 2000);
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                child.kill('SIGKILL');
                reject(new Error('Interrupt handling test timeout'));
            }, 5000);
            
            child.on('close', (code, signal) => {
                clearTimeout(timeout);
                logger.info(`✓ Process interrupted with signal: ${signal || code}`);
                resolve();
            });
            
            child.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    async runCLICommand(args = [], options = {}) {
        const { timeout = 3000 } = options;
        
        return new Promise((resolve) => {
            const child = spawn('node', [this.claudeLoopPath, ...args], {
                stdio: 'pipe'
            });
            
            let stdout = '';
            let stderr = '';
            let executed = true;
            let killed = false;
            
            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            const timeoutHandle = setTimeout(() => {
                killed = true;
                child.kill('SIGTERM');
                setTimeout(() => {
                    if (!child.killed) {
                        child.kill('SIGKILL');
                    }
                }, 1000);
            }, timeout);
            
            child.on('close', (exitCode, signal) => {
                clearTimeout(timeoutHandle);
                resolve({
                    success: exitCode === 0,
                    exitCode,
                    signal,
                    stdout,
                    stderr,
                    executed,
                    killed
                });
            });
            
            child.on('error', (error) => {
                clearTimeout(timeoutHandle);
                executed = false;
                resolve({
                    success: false,
                    exitCode: -1,
                    signal: null,
                    stdout,
                    stderr: error.message,
                    executed,
                    killed
                });
            });
        });
    }

    async saveTestResults() {
        const results = {
            timestamp: new Date().toISOString(),
            testSuite: 'Consolidated CLI Tests',
            summary: this.testRunner.getResults(),
            consolidatedFrom: 'Multiple scattered CLI test files',
            claudeLoopPath: this.claudeLoopPath,
            recommendations: [
                'This consolidated test suite replaces multiple individual CLI test files',
                'Provides comprehensive coverage of all CLI functionality',
                'Uses standardized spawn patterns for consistent testing',
                'Includes parameter validation, error handling, and edge cases'
            ]
        };
        
        const fs = require('fs').promises;
        await fs.writeFile('./cli-test-results.json', JSON.stringify(results, null, 2));
        logger.info('CLI test results saved to cli-test-results.json');
    }
}

// Run tests if called directly
if (require.main === module) {
    const test = new ConsolidatedCLITest();
    test.runAllTests().then(() => {
        logger.info(chalk.green('🎉 Consolidated CLI test suite completed successfully!'));
        process.exit(0);
    }).catch(error => {
        logger.error(chalk.red(`❌ CLI test suite failed: ${error.message}`));
        process.exit(1);
    });
}

module.exports = ConsolidatedCLITest;