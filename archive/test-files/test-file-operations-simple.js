#!/usr/bin/env node

/**
 * Simple File Operations Testing
 * Tests temp file creation, management, and cleanup
 */

const ClaudeLoopEngine = require('./lib/claude-loop-engine');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

class FileOperationsTest {
    constructor() {
        this.testResults = [];
        this.passedTests = 0;
        this.failedTests = 0;
    }

    log(message, type = 'info') {
        const prefix = {
            info: chalk.blue('ℹ'),
            success: chalk.green('✓'),
            error: chalk.red('✗'),
            warning: chalk.yellow('⚠')
        }[type];
        console.log(`${prefix} ${message}`);
    }

    async runTest(name, testFn) {
        try {
            await testFn();
            this.passedTests++;
            this.testResults.push({ name, status: 'PASS' });
            this.log(`${name}: PASS`, 'success');
        } catch (error) {
            this.failedTests++;
            this.testResults.push({ name, status: 'FAIL', error: error.message });
            this.log(`${name}: FAIL - ${error.message}`, 'error');
        }
    }

    async testTempFileCreation() {
        const engine = new ClaudeLoopEngine();
        
        // Test that temp files set is initialized
        if (!engine.tempFiles || typeof engine.tempFiles.add !== 'function') {
            throw new Error('Temp files set not properly initialized');
        }

        // Test adding a fake temp file
        const fakePath = '/fake/temp/file.tmp';
        engine.tempFiles.add(fakePath);
        
        if (!engine.tempFiles.has(fakePath)) {
            throw new Error('Temp file not added to tracking set');
        }

        await engine.cleanup();
    }

    async testActualTempFiles() {
        // Check if there are any actual temp files
        const files = await fs.readdir('.');
        const tempFiles = files.filter(f => f.endsWith('.tmp') && f.includes('claude-loop-prompt'));
        
        this.log(`Found ${tempFiles.length} existing temp files`, 'info');
        
        if (tempFiles.length > 0) {
            // Test reading one temp file
            const tempFile = tempFiles[0];
            try {
                const stats = await fs.stat(tempFile);
                if (stats.size === 0) {
                    throw new Error('Temp file is empty');
                }
                this.log(`Temp file ${tempFile} has ${stats.size} bytes`, 'info');
            } catch (error) {
                throw new Error(`Cannot read temp file: ${error.message}`);
            }
        }
    }

    async testSessionDataStructure() {
        const engine = new ClaudeLoopEngine({ ui: true });
        
        try {
            // Test basic session data structure
            if (engine.iteration !== 0) {
                throw new Error('Initial iteration should be 0');
            }
            
            if (engine.conversationActive !== false) {
                throw new Error('Initial conversation state should be false');
            }
            
            if (!engine.startTime || typeof engine.startTime !== 'number') {
                throw new Error('Start time not properly initialized');
            }
            
            if (!engine.currentPhase || typeof engine.currentPhase !== 'string') {
                throw new Error('Current phase not properly initialized');
            }
            
        } finally {
            await engine.cleanup();
        }
    }

    async testCleanupMechanism() {
        const engine = new ClaudeLoopEngine();
        
        // Add some fake temp files
        const fakeFiles = [
            '/fake/file1.tmp',
            '/fake/file2.tmp',
            '/fake/file3.tmp'
        ];
        
        fakeFiles.forEach(file => engine.tempFiles.add(file));
        
        if (engine.tempFiles.size !== 3) {
            throw new Error('Temp files not added correctly');
        }
        
        // Test cleanup
        await engine.cleanup();
        
        if (engine.tempFiles.size !== 0) {
            throw new Error('Cleanup did not clear temp files set');
        }
    }

    async testFilePermissions() {
        // Check if we can create files in current directory
        const testFile = 'test-permissions.tmp';
        
        try {
            await fs.writeFile(testFile, 'test content', { mode: 0o600 });
            const stats = await fs.stat(testFile);
            
            // Check file exists and has content
            if (stats.size === 0) {
                throw new Error('Test file is empty');
            }
            
            await fs.unlink(testFile);
        } catch (error) {
            throw new Error(`File permission test failed: ${error.message}`);
        }
    }

    async testSessionFileOperations() {
        // Test if session file operations would work
        const sessionData = {
            timestamp: new Date().toISOString(),
            iteration: 0,
            currentPhase: 'testing',
            isRunning: false
        };
        
        const sessionFile = 'test-session.json';
        
        try {
            // Write session data
            await fs.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));
            
            // Read it back
            const readData = JSON.parse(await fs.readFile(sessionFile, 'utf8'));
            
            if (readData.iteration !== sessionData.iteration) {
                throw new Error('Session data not preserved correctly');
            }
            
            if (readData.currentPhase !== sessionData.currentPhase) {
                throw new Error('Session phase not preserved correctly');
            }
            
            await fs.unlink(sessionFile);
        } catch (error) {
            throw new Error(`Session file operations failed: ${error.message}`);
        }
    }

    async runAllTests() {
        console.log(chalk.cyan.bold('\n💾 Starting File Operations & Data Persistence Tests\n'));
        
        await this.runTest('Temp File Creation', () => this.testTempFileCreation());
        await this.runTest('Actual Temp Files Check', () => this.testActualTempFiles());
        await this.runTest('Session Data Structure', () => this.testSessionDataStructure());
        await this.runTest('Cleanup Mechanism', () => this.testCleanupMechanism());
        await this.runTest('File Permissions', () => this.testFilePermissions());
        await this.runTest('Session File Operations', () => this.testSessionFileOperations());
        
        this.generateReport();
    }

    generateReport() {
        const total = this.passedTests + this.failedTests;
        const successRate = total > 0 ? (this.passedTests / total * 100).toFixed(2) : 0;
        
        console.log('\n' + chalk.cyan('='.repeat(50)));
        console.log(chalk.cyan.bold('   FILE OPERATIONS TEST REPORT'));
        console.log(chalk.cyan('='.repeat(50)));
        
        console.log(chalk.blue(`📊 Total Tests: ${total}`));
        console.log(chalk.green(`✅ Passed: ${this.passedTests}`));
        console.log(chalk.red(`❌ Failed: ${this.failedTests}`));
        console.log(chalk.yellow(`📈 Success Rate: ${successRate}%`));
        
        if (this.failedTests > 0) {
            console.log('\n' + chalk.red.bold('FAILED TESTS:'));
            this.testResults
                .filter(result => result.status === 'FAIL')
                .forEach(result => {
                    console.log(chalk.red(`❌ ${result.name}: ${result.error}`));
                });
        }
        
        console.log('\n' + chalk.cyan('='.repeat(50)));
        
        return this.failedTests === 0;
    }
}

// Run tests if called directly
if (require.main === module) {
    const testSuite = new FileOperationsTest();
    testSuite.runAllTests()
        .then(() => {
            process.exit(0);
        })
        .catch(error => {
            console.error(chalk.red('Test suite crashed:'), error);
            process.exit(1);
        });
}

module.exports = FileOperationsTest;