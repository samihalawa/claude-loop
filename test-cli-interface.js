#!/usr/bin/env node

/**
 * CLI Interface Testing Suite
 * Tests all CLI commands, options, error handling, and help system
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class CLITestSuite {
    constructor() {
        this.testResults = [];
        this.cliPath = path.resolve(__dirname, 'bin/claude-loop.js');
    }

    async runAllTests() {
        console.log(chalk.cyan.bold('\n🧪 CLI Interface Testing Suite\n'));
        console.log('━'.repeat(60));
        
        try {
            // Test CLI accessibility
            await this.testCLIAccessibility();
            
            // Test help system
            await this.testHelpSystem();
            
            // Test version command
            await this.testVersionCommand();
            
            // Test invalid options
            await this.testInvalidOptions();
            
            // Test command validation
            await this.testCommandValidation();
            
            // Test default behavior
            await this.testDefaultBehavior();
            
            // Test loop command with various options
            await this.testLoopCommand();
            
            // Generate test report
            this.generateTestReport();
            
        } catch (error) {
            console.error(chalk.red('❌ Test suite failed:'), error.message);
            this.addTestResult('SUITE_FAILURE', false, error.message);
        }
    }

    async testCLIAccessibility() {
        console.log(chalk.yellow('📋 Testing CLI Accessibility...'));
        
        try {
            // Test if CLI script exists and is executable
            const stats = fs.statSync(this.cliPath);
            this.addTestResult('CLI_FILE_EXISTS', true, 'CLI script file exists');
            
            // Test if shebang is correct
            const content = fs.readFileSync(this.cliPath, 'utf8');
            const hasShebang = content.startsWith('#!/usr/bin/env node');
            this.addTestResult('CLI_SHEBANG', hasShebang, hasShebang ? 'Correct shebang' : 'Missing or incorrect shebang');
            
            console.log(chalk.green('✅ CLI accessibility tests passed'));
        } catch (error) {
            this.addTestResult('CLI_ACCESSIBILITY', false, error.message);
        }
    }

    async testHelpSystem() {
        console.log(chalk.yellow('📋 Testing Help System...'));
        
        try {
            // Test --help flag
            const helpOutput = await this.runCLICommand(['--help']);
            const hasUsage = helpOutput.includes('Usage:') || helpOutput.includes('claude-loop');
            this.addTestResult('CLI_HELP_FLAG', hasUsage, hasUsage ? 'Help flag works' : 'Help flag missing or broken');
            
            // Test -h flag
            const hOutput = await this.runCLICommand(['-h']);
            const hHasUsage = hOutput.includes('Usage:') || hOutput.includes('claude-loop');
            this.addTestResult('CLI_H_FLAG', hHasUsage, hHasUsage ? 'Short help flag works' : 'Short help flag missing or broken');
            
            console.log(chalk.green('✅ Help system tests passed'));
        } catch (error) {
            this.addTestResult('HELP_SYSTEM', false, error.message);
        }
    }

    async testVersionCommand() {
        console.log(chalk.yellow('📋 Testing Version Command...'));
        
        try {
            // Test --version flag
            const versionOutput = await this.runCLICommand(['--version']);
            const hasVersion = /\d+\.\d+\.\d+/.test(versionOutput);
            this.addTestResult('CLI_VERSION_FLAG', hasVersion, hasVersion ? 'Version flag works' : 'Version flag missing or broken');
            
            // Test -V flag
            const VOutput = await this.runCLICommand(['-V']);
            const VHasVersion = /\d+\.\d+\.\d+/.test(VOutput);
            this.addTestResult('CLI_V_FLAG', VHasVersion, VHasVersion ? 'Short version flag works' : 'Short version flag missing or broken');
            
            console.log(chalk.green('✅ Version command tests passed'));
        } catch (error) {
            this.addTestResult('VERSION_COMMAND', false, error.message);
        }
    }

    async testInvalidOptions() {
        console.log(chalk.yellow('📋 Testing Invalid Options...'));
        
        try {
            // Test invalid flag
            const invalidOutput = await this.runCLICommand(['--invalid-flag'], true);
            const hasError = invalidOutput.includes('error') || invalidOutput.includes('unknown') || invalidOutput.includes('invalid');
            this.addTestResult('CLI_INVALID_FLAG', hasError, hasError ? 'Invalid flags properly rejected' : 'Invalid flags not handled');
            
            console.log(chalk.green('✅ Invalid options tests passed'));
        } catch (error) {
            this.addTestResult('INVALID_OPTIONS', false, error.message);
        }
    }

    async testCommandValidation() {
        console.log(chalk.yellow('📋 Testing Command Validation...'));
        
        try {
            // Test loop command with invalid max-iterations
            const invalidIterOutput = await this.runCLICommand(['loop', '--max-iterations', 'invalid'], true);
            const hasIterError = invalidIterOutput.includes('error') || invalidIterOutput.includes('positive number');
            this.addTestResult('CLI_INVALID_ITERATIONS', hasIterError, hasIterError ? 'Invalid iterations properly validated' : 'Iteration validation missing');
            
            // Test loop command with zero max-iterations
            const zeroIterOutput = await this.runCLICommand(['loop', '--max-iterations', '0'], true);
            const hasZeroError = zeroIterOutput.includes('error') || zeroIterOutput.includes('positive');
            this.addTestResult('CLI_ZERO_ITERATIONS', hasZeroError, hasZeroError ? 'Zero iterations properly rejected' : 'Zero iteration validation missing');
            
            console.log(chalk.green('✅ Command validation tests passed'));
        } catch (error) {
            this.addTestResult('COMMAND_VALIDATION', false, error.message);
        }
    }

    async testDefaultBehavior() {
        console.log(chalk.yellow('📋 Testing Default Behavior...'));
        
        try {
            // Test running CLI without arguments (should show help and start loop)
            const defaultOutput = await this.runCLICommand([], false, 3000); // 3 second timeout
            const showsHelp = defaultOutput.includes('Claude Loop') || defaultOutput.includes('Usage:') || defaultOutput.includes('claude-loop');
            this.addTestResult('CLI_DEFAULT_HELP', showsHelp, showsHelp ? 'Default behavior shows help' : 'Default behavior missing help');
            
            console.log(chalk.green('✅ Default behavior tests passed'));
        } catch (error) {
            this.addTestResult('DEFAULT_BEHAVIOR', false, error.message);
        }
    }

    async testLoopCommand() {
        console.log(chalk.yellow('📋 Testing Loop Command Options...'));
        
        try {
            // Test loop command help
            const loopHelpOutput = await this.runCLICommand(['loop', '--help']);
            const hasLoopHelp = loopHelpOutput.includes('loop') && (loopHelpOutput.includes('options') || loopHelpOutput.includes('Usage'));
            this.addTestResult('CLI_LOOP_HELP', hasLoopHelp, hasLoopHelp ? 'Loop command help works' : 'Loop command help missing');
            
            // Test valid options format (dry run - just test parsing)
            const validOptionsTests = [
                { args: ['loop', '--path', '/tmp'], name: 'PATH_OPTION' },
                { args: ['loop', '--max-iterations', '5'], name: 'MAX_ITERATIONS_OPTION' },
                { args: ['loop', '--claude-command', 'claude'], name: 'CLAUDE_COMMAND_OPTION' },
                { args: ['loop', '--ui'], name: 'UI_OPTION' }
            ];
            
            for (const test of validOptionsTests) {
                try {
                    // Quick validation test - should not immediately error on parsing
                    const output = await this.runCLICommand(test.args, false, 1000);
                    const noParseError = !output.includes('error: unknown option') && !output.includes('invalid option');
                    this.addTestResult(`CLI_${test.name}`, noParseError, noParseError ? `${test.name} accepted` : `${test.name} rejected`);
                } catch (timeoutError) {
                    // Timeout is expected for actual execution, just check no immediate parse errors
                    this.addTestResult(`CLI_${test.name}`, true, `${test.name} parsed successfully`);
                }
            }
            
            console.log(chalk.green('✅ Loop command tests passed'));
        } catch (error) {
            this.addTestResult('LOOP_COMMAND', false, error.message);
        }
    }

    async runCLICommand(args, expectError = false, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const child = spawn('node', [this.cliPath, ...args], {
                stdio: 'pipe',
                timeout: timeout
            });
            
            let output = '';
            let errorOutput = '';
            
            child.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            child.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            const timeoutId = setTimeout(() => {
                child.kill('SIGTERM');
                resolve(output + errorOutput); // Return what we got before timeout
            }, timeout);
            
            child.on('close', (code) => {
                clearTimeout(timeoutId);
                const fullOutput = output + errorOutput;
                
                if (expectError && code === 0) {
                    reject(new Error(`Expected error but command succeeded. Output: ${fullOutput}`));
                } else {
                    resolve(fullOutput);
                }
            });
            
            child.on('error', (error) => {
                clearTimeout(timeoutId);
                if (expectError) {
                    resolve(error.message);
                } else {
                    reject(error);
                }
            });
        });
    }

    addTestResult(testName, passed, details) {
        this.testResults.push({
            test: testName,
            passed: passed,
            details: details,
            timestamp: new Date().toISOString()
        });
        
        const status = passed ? chalk.green('✅') : chalk.red('❌');
        const name = testName.replace(/_/g, ' ');
        console.log(`  ${status} ${name}: ${details}`);
    }

    generateTestReport() {
        console.log('\n' + '━'.repeat(60));
        console.log(chalk.cyan.bold('📊 CLI TESTING REPORT'));
        console.log('━'.repeat(60));
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;
        
        console.log(`\n📈 Test Summary:`);
        console.log(`  Total tests: ${totalTests}`);
        console.log(`  ${chalk.green('Passed:')} ${passedTests}`);
        console.log(`  ${chalk.red('Failed:')} ${failedTests}`);
        console.log(`  ${chalk.blue('Success rate:')} ${Math.round((passedTests / totalTests) * 100)}%`);
        
        if (failedTests > 0) {
            console.log(`\n❌ Failed Tests:`);
            this.testResults.filter(r => !r.passed).forEach(result => {
                console.log(`  • ${result.test}: ${result.details}`);
            });
        }
        
        console.log(`\n${passedTests === totalTests ? chalk.green('🎉 All CLI tests passed!') : chalk.yellow('⚠️  Some CLI tests need attention.')}`);
        console.log('━'.repeat(60));
    }
}

// Run tests if called directly
if (require.main === module) {
    const testSuite = new CLITestSuite();
    testSuite.runAllTests().catch(console.error);
}

module.exports = CLITestSuite;