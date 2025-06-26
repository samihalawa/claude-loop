#!/usr/bin/env node

const { spawn } = require('child_process');
const chalk = require('chalk');

async function testProcessManagement() {
    console.log(chalk.cyan('🧪 Testing Process Management functionality...\n'));
    
    try {
        // Test 1: Basic process spawning
        console.log(chalk.blue('Test 1: Basic process spawning'));
        const testProcess = spawn('echo', ['Hello Process Test'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        testProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        await new Promise((resolve, reject) => {
            testProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Process exited with code ${code}`));
                }
            });
            testProcess.on('error', reject);
        });
        
        if (output.trim() === 'Hello Process Test') {
            console.log(chalk.green('✓ Basic process spawning working'));
        } else {
            console.log(chalk.red(`✗ Unexpected output: ${output.trim()}`));
        }
        
        // Test 2: Process with arguments (simulating Claude CLI)
        console.log(chalk.blue('\nTest 2: Process with arguments'));
        const nodeProcess = spawn('node', ['--version'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let nodeOutput = '';
        nodeProcess.stdout.on('data', (data) => {
            nodeOutput += data.toString();
        });
        
        await new Promise((resolve, reject) => {
            nodeProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Node process exited with code ${code}`));
                }
            });
            nodeProcess.on('error', reject);
        });
        
        if (nodeOutput.trim().startsWith('v')) {
            console.log(chalk.green('✓ Process with arguments working'));
            console.log(chalk.gray(`  - Node version: ${nodeOutput.trim()}`));
        } else {
            console.log(chalk.red(`✗ Unexpected node output: ${nodeOutput.trim()}`));
        }
        
        // Test 3: Process timeout and termination
        console.log(chalk.blue('\nTest 3: Process timeout and termination'));
        const longProcess = spawn('sleep', ['10'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        // Kill after 1 second
        setTimeout(() => {
            longProcess.kill('SIGTERM');
        }, 1000);
        
        const startTime = Date.now();
        await new Promise((resolve) => {
            longProcess.on('close', (code, signal) => {
                const duration = Date.now() - startTime;
                if (signal === 'SIGTERM' && duration < 2000) {
                    console.log(chalk.green('✓ Process termination working'));
                    console.log(chalk.gray(`  - Terminated with signal: ${signal}`));
                    console.log(chalk.gray(`  - Duration: ${duration}ms`));
                } else {
                    console.log(chalk.yellow(`⚠ Process termination unexpected: code=${code}, signal=${signal}, duration=${duration}ms`));
                }
                resolve();
            });
        });
        
        // Test 4: Process error handling
        console.log(chalk.blue('\nTest 4: Process error handling'));
        try {
            const invalidProcess = spawn('non-existent-command', [], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            await new Promise((resolve, reject) => {
                invalidProcess.on('error', (error) => {
                    if (error.code === 'ENOENT') {
                        console.log(chalk.green('✓ Process error handling working'));
                        console.log(chalk.gray(`  - Error: ${error.message}`));
                        resolve();
                    } else {
                        reject(error);
                    }
                });
                
                invalidProcess.on('close', (code) => {
                    reject(new Error(`Process should have failed but closed with code ${code}`));
                });
            });
        } catch (error) {
            console.log(chalk.red(`✗ Unexpected error handling: ${error.message}`));
        }
        
        // Test 5: Environment variable passing
        console.log(chalk.blue('\nTest 5: Environment variable passing'));
        const envProcess = spawn('node', ['-e', 'console.log(process.env.TEST_VAR)'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, TEST_VAR: 'TestValue123' }
        });
        
        let envOutput = '';
        envProcess.stdout.on('data', (data) => {
            envOutput += data.toString();
        });
        
        await new Promise((resolve, reject) => {
            envProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Env process exited with code ${code}`));
                }
            });
            envProcess.on('error', reject);
        });
        
        if (envOutput.trim() === 'TestValue123') {
            console.log(chalk.green('✓ Environment variable passing working'));
        } else {
            console.log(chalk.red(`✗ Environment variable not passed: ${envOutput.trim()}`));
        }
        
        // Test 6: Working directory setting
        console.log(chalk.blue('\nTest 6: Working directory setting'));
        const cwdProcess = spawn('pwd', [], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: __dirname
        });
        
        let cwdOutput = '';
        cwdProcess.stdout.on('data', (data) => {
            cwdOutput += data.toString();
        });
        
        await new Promise((resolve, reject) => {
            cwdProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`CWD process exited with code ${code}`));
                }
            });
            cwdProcess.on('error', reject);
        });
        
        if (cwdOutput.trim() === __dirname) {
            console.log(chalk.green('✓ Working directory setting working'));
            console.log(chalk.gray(`  - CWD: ${cwdOutput.trim()}`));
        } else {
            console.log(chalk.yellow(`⚠ Working directory mismatch: expected ${__dirname}, got ${cwdOutput.trim()}`));
        }
        
        // Test 7: Signal handling simulation
        console.log(chalk.blue('\nTest 7: Signal handling simulation'));
        const signalProcess = spawn('node', ['-e', 'process.on("SIGTERM", () => { console.log("SIGTERM received"); process.exit(0); }); setTimeout(() => {}, 10000);'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let signalOutput = '';
        signalProcess.stdout.on('data', (data) => {
            signalOutput += data.toString();
        });
        
        // Send SIGTERM after 500ms
        setTimeout(() => {
            signalProcess.kill('SIGTERM');
        }, 500);
        
        await new Promise((resolve) => {
            signalProcess.on('close', (code, signal) => {
                if (signalOutput.includes('SIGTERM received') || signal === 'SIGTERM') {
                    console.log(chalk.green('✓ Signal handling working'));
                    console.log(chalk.gray(`  - Output: ${signalOutput.trim()}`));
                    console.log(chalk.gray(`  - Exit signal: ${signal}`));
                } else {
                    console.log(chalk.yellow(`⚠ Signal handling unexpected: code=${code}, signal=${signal}`));
                }
                resolve();
            });
        });
        
        console.log(chalk.cyan('\n🎉 All process management tests completed!'));
        
    } catch (error) {
        console.error(chalk.red('\n❌ Process management test failed:'), error.message);
        console.error(chalk.gray(error.stack));
        process.exit(1);
    }
}

// Run tests
testProcessManagement().catch(console.error);