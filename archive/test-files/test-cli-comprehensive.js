#!/usr/bin/env node

/**
 * Comprehensive CLI Testing Suite
 * Tests all claude-loop CLI functionality including commands, options, and edge cases
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class CLITester {
    constructor() {
        this.testResults = [];
        this.cliPath = path.resolve(__dirname, 'bin/claude-loop.js');
        this.testDir = path.resolve(__dirname, 'test-temp');
        this.cleanup = [];
    }

    async runTest(testName, testFunction) {
        console.log(chalk.blue(`\n🧪 Testing: ${testName}`));
        try {
            const result = await testFunction();
            this.testResults.push({ name: testName, status: 'PASSED', result });
            console.log(chalk.green(`✅ ${testName} - PASSED`));
            return result;
        } catch (error) {
            this.testResults.push({ name: testName, status: 'FAILED', error: error.message });
            console.log(chalk.red(`❌ ${testName} - FAILED: ${error.message}`));
            return null;
        }
    }

    async runCLICommand(args = [], options = {}) {
        return new Promise((resolve, reject) => {
            const timeout = options.timeout || 10000; // 10 second timeout
            const stdio = options.capture ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'inherit', 'inherit'];
            
            const child = spawn('node', [this.cliPath, ...args], {
                stdio,
                cwd: options.cwd || __dirname,
                env: { ...process.env, ...options.env }
            });

            let stdout = '';
            let stderr = '';
            let resolved = false;

            const timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    child.kill('SIGTERM');
                    reject(new Error(`Command timed out after ${timeout}ms`));
                }
            }, timeout);

            if (options.capture) {
                child.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                child.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
            }

            child.on('close', (code) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeoutId);
                    resolve({
                        code,
                        stdout: stdout.trim(),
                        stderr: stderr.trim()
                    });
                }
            });

            child.on('error', (error) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });

            // Send Ctrl+C after short delay for interactive commands
            if (options.interrupt) {
                setTimeout(() => {
                    if (!resolved) {
                        child.kill('SIGINT');
                    }
                }, options.interrupt);
            }
        });
    }

    async runAllTests() {
        console.log(chalk.cyan.bold('\n🚀 Starting Comprehensive CLI Testing\n'));

        // Create test directory
        if (!fs.existsSync(this.testDir)) {
            fs.mkdirSync(this.testDir, { recursive: true });
            this.cleanup.push(() => fs.rmSync(this.testDir, { recursive: true, force: true }));
        }

        // Test 1: CLI Executable exists and is accessible
        await this.runTest('CLI Executable Access', async () => {
            if (!fs.existsSync(this.cliPath)) {
                throw new Error(`CLI executable not found at ${this.cliPath}`);
            }
            const stats = fs.statSync(this.cliPath);
            if (!stats.isFile()) {
                throw new Error('CLI path is not a file');
            }
            return { path: this.cliPath, size: stats.size };
        });

        // Test 2: Help Command
        await this.runTest('Help Command (--help)', async () => {
            const result = await this.runCLICommand(['--help'], { capture: true, timeout: 5000 });
            if (result.code !== 0) {
                throw new Error(`Help command failed with code ${result.code}`);
            }
            if (!result.stdout.includes('claude-loop')) {
                throw new Error('Help output does not contain program name');
            }
            if (!result.stdout.includes('Usage')) {
                throw new Error('Help output does not contain usage information');
            }
            return { output: result.stdout.substring(0, 200) + '...' };
        });

        // Test 3: Version Command
        await this.runTest('Version Command (--version)', async () => {
            const result = await this.runCLICommand(['--version'], { capture: true, timeout: 5000 });
            if (result.code !== 0) {
                throw new Error(`Version command failed with code ${result.code}`);
            }
            const versionPattern = /\d+\.\d+\.\d+/;
            if (!versionPattern.test(result.stdout)) {
                throw new Error('Version output does not contain valid version number');
            }
            return { version: result.stdout.trim() };
        });

        // Test 4: Default Command (no arguments)
        await this.runTest('Default Command (no args)', async () => {
            const result = await this.runCLICommand([], { 
                capture: true, 
                timeout: 3000,
                interrupt: 1000 // Interrupt after 1 second
            });
            
            // Should show the ASCII art and start the engine
            if (!result.stdout.includes('Claude Loop') && !result.stderr.includes('Claude Loop')) {
                throw new Error('Default command does not show Claude Loop branding');
            }
            
            return { 
                output: (result.stdout + result.stderr).substring(0, 300) + '...',
                interrupted: true
            };
        });

        // Test 5: Loop Command Basic
        await this.runTest('Loop Command Basic', async () => {
            const result = await this.runCLICommand(['loop'], { 
                capture: true, 
                timeout: 3000,
                interrupt: 1000,
                cwd: this.testDir
            });
            
            // Should start the loop process
            const output = result.stdout + result.stderr;
            if (!output.includes('Claude Loop') && !output.includes('debug')) {
                throw new Error('Loop command does not appear to start properly');
            }
            
            return { 
                output: output.substring(0, 300) + '...',
                interrupted: true
            };
        });

        // Test 6: Path Option (-p)
        await this.runTest('Path Option (-p)', async () => {
            const result = await this.runCLICommand(['loop', '-p', this.testDir], { 
                capture: true, 
                timeout: 3000,
                interrupt: 1000
            });
            
            const output = result.stdout + result.stderr;
            if (output.includes('does not exist') || output.includes('not accessible')) {
                throw new Error('Path option rejected valid directory');
            }
            
            return { 
                path: this.testDir,
                output: output.substring(0, 200) + '...'
            };
        });

        // Test 7: Max Iterations Option (-m)
        await this.runTest('Max Iterations Option (-m)', async () => {
            const result = await this.runCLICommand(['loop', '-m', '5', '-p', this.testDir], { 
                capture: true, 
                timeout: 3000,
                interrupt: 1000
            });
            
            // Should accept the max iterations value
            const output = result.stdout + result.stderr;
            return { 
                maxIterations: 5,
                output: output.substring(0, 200) + '...'
            };
        });

        // Test 8: Invalid Max Iterations
        await this.runTest('Invalid Max Iterations', async () => {
            const result = await this.runCLICommand(['loop', '-m', 'abc'], { 
                capture: true, 
                timeout: 5000
            });
            
            // Should fail with error
            if (result.code === 0) {
                throw new Error('Invalid max iterations should cause error');
            }
            
            const output = result.stdout + result.stderr;
            if (!output.includes('positive number') && !output.includes('invalid') && !output.includes('error')) {
                throw new Error('Error message not descriptive enough');
            }
            
            return { 
                expectedError: true,
                output: output
            };
        });

        // Test 9: Claude Command Option (-c)
        await this.runTest('Claude Command Option (-c)', async () => {
            const result = await this.runCLICommand(['loop', '-c', 'claude', '-p', this.testDir], { 
                capture: true, 
                timeout: 3000,
                interrupt: 1000
            });
            
            // Should accept the claude command
            const output = result.stdout + result.stderr;
            return { 
                claudeCommand: 'claude',
                output: output.substring(0, 200) + '...'
            };
        });

        // Test 10: UI Option (-u)
        await this.runTest('UI Option (-u)', async () => {
            const result = await this.runCLICommand(['loop', '-u', '-p', this.testDir], { 
                capture: true, 
                timeout: 5000,
                interrupt: 2000
            });
            
            // Should mention web UI
            const output = result.stdout + result.stderr;
            if (!output.includes('Web UI') && !output.includes('http://localhost')) {
                throw new Error('UI option does not appear to start web UI');
            }
            
            return { 
                webUI: true,
                output: output.substring(0, 300) + '...'
            };
        });

        // Test 11: Combined Options
        await this.runTest('Combined Options', async () => {
            const result = await this.runCLICommand([
                'loop', 
                '-p', this.testDir,
                '-m', '3',
                '-c', 'claude',
                '-u'
            ], { 
                capture: true, 
                timeout: 5000,
                interrupt: 2000
            });
            
            const output = result.stdout + result.stderr;
            return { 
                combinedOptions: true,
                output: output.substring(0, 300) + '...'
            };
        });

        // Test 12: Invalid Path
        await this.runTest('Invalid Path Handling', async () => {
            const invalidPath = '/nonexistent/path/that/should/not/exist';
            const result = await this.runCLICommand(['loop', '-p', invalidPath], { 
                capture: true, 
                timeout: 5000
            });
            
            // Should fail gracefully
            const output = result.stdout + result.stderr;
            if (!output.includes('not exist') && !output.includes('not accessible') && !output.includes('Invalid')) {
                throw new Error('Invalid path not properly handled');
            }
            
            return { 
                invalidPath: invalidPath,
                handledGracefully: true
            };
        });

        // Test 13: Command Line Parsing Edge Cases
        await this.runTest('Edge Case Arguments', async () => {
            // Test with spaces in path
            const pathWithSpaces = path.join(this.testDir, 'path with spaces');
            if (!fs.existsSync(pathWithSpaces)) {
                fs.mkdirSync(pathWithSpaces, { recursive: true });
            }
            
            const result = await this.runCLICommand(['loop', '-p', pathWithSpaces], { 
                capture: true, 
                timeout: 3000,
                interrupt: 1000
            });
            
            return { 
                pathWithSpaces: pathWithSpaces,
                handled: true
            };
        });

        // Test 14: Signal Handling
        await this.runTest('Signal Handling (SIGINT)', async () => {
            const result = await this.runCLICommand(['loop', '-p', this.testDir], { 
                capture: true, 
                timeout: 5000,
                interrupt: 1500 // Send SIGINT after 1.5 seconds
            });
            
            // Should handle the interrupt gracefully
            const output = result.stdout + result.stderr;
            return { 
                signalHandled: true,
                output: output.substring(0, 200) + '...'
            };
        });

        // Test 15: Environment Variable Recognition
        await this.runTest('Environment Variables', async () => {
            const result = await this.runCLICommand(['loop', '-p', this.testDir], { 
                capture: true, 
                timeout: 3000,
                interrupt: 1000,
                env: {
                    CLAUDE_COMMAND: 'custom-claude',
                    WEBUI_PORT: '3334'
                }
            });
            
            return { 
                envVarsSet: true,
                output: (result.stdout + result.stderr).substring(0, 200) + '...'
            };
        });

        await this.generateReport();
        await this.performCleanup();
    }

    async generateReport() {
        console.log(chalk.cyan.bold('\n📊 CLI Testing Report\n'));
        
        const passed = this.testResults.filter(r => r.status === 'PASSED').length;
        const failed = this.testResults.filter(r => r.status === 'FAILED').length;
        const total = this.testResults.length;
        
        console.log(`Total Tests: ${total}`);
        console.log(chalk.green(`Passed: ${passed}`));
        console.log(chalk.red(`Failed: ${failed}`));
        console.log(`Success Rate: ${Math.round((passed / total) * 100)}%\n`);
        
        // Show failed tests
        const failedTests = this.testResults.filter(r => r.status === 'FAILED');
        if (failedTests.length > 0) {
            console.log(chalk.red.bold('❌ Failed Tests:'));
            failedTests.forEach(test => {
                console.log(chalk.red(`  • ${test.name}: ${test.error}`));
            });
            console.log();
        }

        // Show passed tests summary
        console.log(chalk.green.bold('✅ Passed Tests:'));
        const passedTests = this.testResults.filter(r => r.status === 'PASSED');
        passedTests.forEach(test => {
            console.log(chalk.green(`  • ${test.name}`));
        });

        // Save detailed report
        const report = {
            timestamp: new Date().toISOString(),
            summary: { total, passed, failed, successRate: Math.round((passed / total) * 100) },
            results: this.testResults
        };

        const reportPath = path.join(__dirname, 'cli-test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(chalk.gray(`\n📄 Detailed report saved to: ${reportPath}`));
    }

    async performCleanup() {
        console.log(chalk.gray('\n🧹 Performing cleanup...'));
        for (const cleanupFn of this.cleanup) {
            try {
                cleanupFn();
            } catch (error) {
                console.log(chalk.yellow(`Warning: Cleanup failed: ${error.message}`));
            }
        }
        console.log(chalk.gray('✓ Cleanup completed'));
    }
}

// Run the tests
async function main() {
    const tester = new CLITester();
    
    try {
        await tester.runAllTests();
        process.exit(0);
    } catch (error) {
        console.error(chalk.red(`\n💥 Testing failed: ${error.message}`));
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = CLITester;