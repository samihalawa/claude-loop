#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const os = require('os');

/**
 * Simple Data Persistence Testing
 * Basic file operations and data integrity checks
 */

class SimpleDataPersistenceTester {
    constructor() {
        this.testResults = [];
        this.testDir = path.join(os.tmpdir(), 'claude-loop-simple-data-test');
    }

    async runAllTests() {
        console.log(chalk.cyan.bold('\n🧪 Simple Data Persistence Testing'));
        console.log(chalk.gray('Testing basic file operations and data integrity\n'));

        const startTime = Date.now();

        try {
            await this.setupTestEnvironment();
            await this.testFileOperations();
            await this.testJSONPersistence();
            await this.testConcurrentWrites();
            await this.testErrorHandling();
            await this.testFileCleanup();

        } catch (error) {
            console.error(chalk.red('❌ Data persistence testing failed:'), error.message);
        } finally {
            await this.cleanup();
        }

        const duration = Date.now() - startTime;
        await this.generateReport(duration);
    }

    async setupTestEnvironment() {
        console.log(chalk.yellow('→ Setting up test environment...'));
        
        try {
            await fs.mkdir(this.testDir, { recursive: true });
            console.log(chalk.green('✓ Test directory created'));
        } catch (error) {
            throw new Error(`Failed to setup test environment: ${error.message}`);
        }
    }

    async testFileOperations() {
        const testName = 'Basic File Operations';
        console.log(chalk.yellow(`\n→ Testing ${testName}...`));
        
        try {
            const testFile = path.join(this.testDir, 'basic-test.txt');
            const testData = 'Hello World - Data Persistence Test';

            // Write file
            await fs.writeFile(testFile, testData);
            console.log(chalk.green('  ✓ File write successful'));

            // Read file
            const readData = await fs.readFile(testFile, 'utf8');
            if (readData === testData) {
                console.log(chalk.green('  ✓ File read successful'));
            } else {
                throw new Error('Data mismatch on read');
            }

            // Check file exists
            await fs.access(testFile);
            console.log(chalk.green('  ✓ File existence verified'));

            // Get file stats
            const stats = await fs.stat(testFile);
            console.log(chalk.gray(`  → File size: ${stats.size} bytes`));

            // Delete file
            await fs.unlink(testFile);
            console.log(chalk.green('  ✓ File deletion successful'));

            this.recordTest(testName, 'PASS');
        } catch (error) {
            this.recordTest(testName, 'FAIL', error.message);
        }
    }

    async testJSONPersistence() {
        const testName = 'JSON Data Persistence';
        console.log(chalk.yellow(`\n→ Testing ${testName}...`));
        
        try {
            const jsonFile = path.join(this.testDir, 'data-test.json');
            const testData = {
                sessionId: 'test-session-123',
                iterations: 5,
                currentPhase: 'Testing',
                output: [
                    { timestamp: new Date().toISOString(), type: 'info', message: 'Test message 1' },
                    { timestamp: new Date().toISOString(), type: 'success', message: 'Test message 2' }
                ],
                startTime: Date.now(),
                isRunning: true,
                metadata: {
                    version: '1.0.0',
                    testValue: 42,
                    nested: {
                        prop: 'value'
                    }
                }
            };

            // Write JSON data
            await fs.writeFile(jsonFile, JSON.stringify(testData, null, 2));
            console.log(chalk.green('  ✓ JSON data written successfully'));

            // Read and parse JSON data
            const rawData = await fs.readFile(jsonFile, 'utf8');
            const parsedData = JSON.parse(rawData);
            
            // Verify data integrity
            if (parsedData.sessionId !== testData.sessionId ||
                parsedData.iterations !== testData.iterations ||
                parsedData.output.length !== testData.output.length) {
                throw new Error('JSON data integrity check failed');
            }

            console.log(chalk.green('  ✓ JSON data integrity verified'));

            // Test data modification
            parsedData.iterations = 10;
            parsedData.currentPhase = 'Modified Phase';
            parsedData.output.push({
                timestamp: new Date().toISOString(),
                type: 'warning',
                message: 'Modified data test'
            });

            // Write modified data
            await fs.writeFile(jsonFile, JSON.stringify(parsedData, null, 2));
            console.log(chalk.green('  ✓ JSON data modification successful'));

            // Verify modifications persisted
            const modifiedRaw = await fs.readFile(jsonFile, 'utf8');
            const modifiedData = JSON.parse(modifiedRaw);
            
            if (modifiedData.iterations === 10 && 
                modifiedData.currentPhase === 'Modified Phase' &&
                modifiedData.output.length === 3) {
                console.log(chalk.green('  ✓ JSON modification persistence verified'));
            } else {
                throw new Error('JSON modification verification failed');
            }

            this.recordTest(testName, 'PASS');
        } catch (error) {
            this.recordTest(testName, 'FAIL', error.message);
        }
    }

    async testConcurrentWrites() {
        const testName = 'Concurrent Write Operations';
        console.log(chalk.yellow(`\n→ Testing ${testName}...`));
        
        try {
            const operations = [];
            
            // Create 5 concurrent write operations
            for (let i = 0; i < 5; i++) {
                const file = path.join(this.testDir, `concurrent-${i}.txt`);
                const data = `Concurrent operation ${i} - ${Date.now()}`;
                operations.push(fs.writeFile(file, data));
            }

            // Execute all operations concurrently
            await Promise.all(operations);
            console.log(chalk.green('  ✓ All concurrent writes completed'));

            // Verify all files were created
            for (let i = 0; i < 5; i++) {
                const file = path.join(this.testDir, `concurrent-${i}.txt`);
                await fs.access(file);
                const content = await fs.readFile(file, 'utf8');
                
                if (!content.includes(`Concurrent operation ${i}`)) {
                    throw new Error(`Concurrent file ${i} content verification failed`);
                }
            }
            console.log(chalk.green('  ✓ All concurrent files verified'));

            this.recordTest(testName, 'PASS');
        } catch (error) {
            this.recordTest(testName, 'FAIL', error.message);
        }
    }

    async testErrorHandling() {
        const testName = 'Error Handling';
        console.log(chalk.yellow(`\n→ Testing ${testName}...`));
        
        try {
            const nonExistentFile = path.join(this.testDir, 'non-existent.txt');
            
            // Test reading non-existent file
            try {
                await fs.readFile(nonExistentFile, 'utf8');
                throw new Error('Should have failed reading non-existent file');
            } catch (error) {
                if (error.code === 'ENOENT') {
                    console.log(chalk.green('  ✓ Non-existent file error handled correctly'));
                } else {
                    throw error;
                }
            }

            // Test invalid JSON handling
            const invalidJsonFile = path.join(this.testDir, 'invalid.json');
            await fs.writeFile(invalidJsonFile, '{ invalid json content');
            
            try {
                const content = await fs.readFile(invalidJsonFile, 'utf8');
                JSON.parse(content);
                throw new Error('Should have failed parsing invalid JSON');
            } catch (error) {
                if (error instanceof SyntaxError) {
                    console.log(chalk.green('  ✓ Invalid JSON error handled correctly'));
                } else {
                    throw error;
                }
            }

            // Test permission error simulation (write to non-writable directory)
            try {
                const invalidPath = '/root/test-file.txt'; // This should fail on most systems
                await fs.writeFile(invalidPath, 'test');
                console.log(chalk.yellow('  ⚠ Permission test skipped (running with elevated privileges)'));
            } catch (error) {
                if (error.code === 'EACCES' || error.code === 'EPERM') {
                    console.log(chalk.green('  ✓ Permission error handled correctly'));
                } else {
                    console.log(chalk.yellow(`  ⚠ Permission test resulted in: ${error.code}`));
                }
            }

            this.recordTest(testName, 'PASS');
        } catch (error) {
            this.recordTest(testName, 'FAIL', error.message);
        }
    }

    async testFileCleanup() {
        const testName = 'File Cleanup';
        console.log(chalk.yellow(`\n→ Testing ${testName}...`));
        
        try {
            // Create test files
            const files = [];
            for (let i = 0; i < 3; i++) {
                const file = path.join(this.testDir, `cleanup-test-${i}.txt`);
                await fs.writeFile(file, `Cleanup test file ${i}`);
                files.push(file);
            }
            console.log(chalk.green(`  ✓ Created ${files.length} test files`));

            // Verify files exist
            for (const file of files) {
                await fs.access(file);
            }
            console.log(chalk.green('  ✓ All test files verified to exist'));

            // Clean up files
            for (const file of files) {
                await fs.unlink(file);
            }
            console.log(chalk.green('  ✓ All test files deleted'));

            // Verify files no longer exist
            for (const file of files) {
                try {
                    await fs.access(file);
                    throw new Error(`File ${file} still exists after cleanup`);
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        throw error;
                    }
                }
            }
            console.log(chalk.green('  ✓ File cleanup verified'));

            this.recordTest(testName, 'PASS');
        } catch (error) {
            this.recordTest(testName, 'FAIL', error.message);
        }
    }

    recordTest(name, status, error = null) {
        const result = {
            name,
            status,
            timestamp: new Date().toISOString(),
            error
        };
        
        this.testResults.push(result);
        
        const statusColor = status === 'PASS' ? 'green' : 'red';
        const statusIcon = status === 'PASS' ? '✓' : '❌';
        console.log(chalk[statusColor](`${statusIcon} ${name}: ${status}`));
        
        if (error) {
            console.log(chalk.red(`  Error: ${error}`));
        }
    }

    async cleanup() {
        console.log(chalk.gray('\n→ Cleaning up test environment...'));
        
        try {
            await fs.rm(this.testDir, { recursive: true, force: true });
            console.log(chalk.green('✓ Test directory cleaned up'));
        } catch (error) {
            console.log(chalk.yellow(`⚠ Cleanup warning: ${error.message}`));
        }
    }

    async generateReport(duration) {
        const passedTests = this.testResults.filter(t => t.status === 'PASS').length;
        const failedTests = this.testResults.filter(t => t.status === 'FAIL').length;
        const successRate = this.testResults.length > 0 ? ((passedTests / this.testResults.length) * 100).toFixed(2) : 0;

        const report = {
            timestamp: new Date().toISOString(),
            testType: 'Simple Data Persistence',
            summary: {
                totalTests: this.testResults.length,
                passedTests,
                failedTests,
                successRate: parseFloat(successRate),
                duration,
                testDirectory: this.testDir
            },
            results: this.testResults
        };

        // Save report
        const reportPath = '/Users/samihalawa/git/claude-loop/simple-data-persistence-report.json';
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        // Display summary
        console.log(chalk.cyan.bold('\n📊 Simple Data Persistence Test Summary'));
        console.log(chalk.gray('=' .repeat(50)));
        console.log(chalk.white(`Total Tests: ${this.testResults.length}`));
        console.log(chalk.green(`Passed: ${passedTests}`));
        console.log(chalk.red(`Failed: ${failedTests}`));
        console.log(chalk.cyan(`Success Rate: ${successRate}%`));
        console.log(chalk.gray(`Duration: ${duration}ms`));
        console.log(chalk.gray(`Report saved: ${reportPath}`));
        
        if (failedTests > 0) {
            console.log(chalk.yellow('\n⚠ Failed Tests:'));
            this.testResults
                .filter(t => t.status === 'FAIL')
                .forEach(test => {
                    console.log(chalk.red(`  - ${test.name}: ${test.error}`));
                });
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new SimpleDataPersistenceTester();
    tester.runAllTests()
        .then(() => {
            console.log(chalk.green('\n✅ Simple data persistence testing completed'));
            process.exit(0);
        })
        .catch((error) => {
            console.error(chalk.red('\n❌ Simple data persistence testing failed:'), error);
            process.exit(1);
        });
}

module.exports = SimpleDataPersistenceTester;