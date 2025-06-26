#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 Testing CLI Edge Cases...\n');

// Test 1: Invalid repository path
function testInvalidRepoPath() {
    return new Promise((resolve) => {
        console.log('1. Testing invalid repository path...');
        const child = spawn('node', ['bin/claude-loop.js', 'loop', '--path=/non/existent/path', '--max-iterations=1'], {
            stdio: 'pipe'
        });

        let output = '';
        let errorCaught = false;

        child.stderr.on('data', (data) => {
            output += data.toString();
            if (output.includes('Invalid repository path') || output.includes('does not exist')) {
                errorCaught = true;
                child.kill('SIGTERM');
                console.log('   ✓ Invalid path error handling working');
                resolve(true);
            }
        });

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.on('close', (code) => {
            if (!errorCaught && code !== 0) {
                console.log('   ✓ Invalid path error handling working (exit code)');
                resolve(true);
            } else if (!errorCaught) {
                console.log('   ❌ Invalid path error handling failed');
                console.log('   Output:', output.substring(0, 300));
                resolve(false);
            }
        });

        setTimeout(() => {
            if (!errorCaught) {
                child.kill('SIGTERM');
                console.log('   ❌ Invalid path test timeout');
                resolve(false);
            }
        }, 8000);
    });
}

// Test 2: Custom claude command and security validation
function testCustomClaudeCommand() {
    return new Promise((resolve) => {
        console.log('2. Testing custom claude command and security validation...');
        const child = spawn('node', ['bin/claude-loop.js', 'loop', '--claude-command=whoami', '--max-iterations=1', '--path=/tmp'], {
            stdio: 'pipe'
        });

        let output = '';
        let commandOrSecurityDetected = false;

        child.stdout.on('data', (data) => {
            output += data.toString();
            // Look for security validation or command detection
            if (output.includes('Prompt content failed security validation') || 
                output.includes('Command: whoami') ||
                output.includes('Potentially dangerous content detected')) {
                commandOrSecurityDetected = true;
                child.kill('SIGTERM');
                console.log('   ✓ Custom claude command with security validation working');
                resolve(true);
            }
        });

        child.stderr.on('data', (data) => {
            output += data.toString();
            // Check stderr for security validation
            if (output.includes('Prompt content failed security validation') || 
                output.includes('Potentially dangerous content detected')) {
                commandOrSecurityDetected = true;
                child.kill('SIGTERM');
                console.log('   ✓ Security validation working correctly');
                resolve(true);
            }
        });

        child.on('close', (code) => {
            if (!commandOrSecurityDetected) {
                console.log('   ❌ Custom claude command/security test failed');
                console.log('   Output:', output.substring(0, 400));
                resolve(false);
            }
        });

        setTimeout(() => {
            if (!commandOrSecurityDetected) {
                child.kill('SIGTERM');
                console.log('   ❌ Custom command/security test timeout');
                resolve(false);
            }
        }, 8000);
    });
}

// Test 3: Different max iterations
function testMaxIterations() {
    return new Promise((resolve) => {
        console.log('3. Testing max iterations configuration...');
        const child = spawn('node', ['bin/claude-loop.js', 'loop', '--max-iterations=5', '--path=/tmp'], {
            stdio: 'pipe'
        });

        let output = '';
        let maxIterationsDetected = false;

        child.stdout.on('data', (data) => {
            output += data.toString();
            // Look for evidence that max iterations is configured
            if (output.includes('Max Iterations: 5')) {
                maxIterationsDetected = true;
                child.kill('SIGTERM');
                console.log('   ✓ Max iterations configuration working');
                resolve(true);
            }
        });

        child.stderr.on('data', (data) => {
            output += data.toString();
        });

        child.on('close', (code) => {
            if (!maxIterationsDetected) {
                console.log('   ❌ Max iterations configuration failed');
                console.log('   Output:', output.substring(0, 400));
                resolve(false);
            }
        });

        setTimeout(() => {
            if (!maxIterationsDetected) {
                child.kill('SIGTERM');
                console.log('   ❌ Max iterations test timeout');
                resolve(false);
            }
        }, 8000);
    });
}

// Test 4: Port conflicts for Web UI
function testPortConflicts() {
    return new Promise((resolve) => {
        console.log('4. Testing Web UI port conflict handling...');
        
        // First start a simple server on port 3343
        const http = require('http');
        const server = http.createServer();
        server.listen(3343, () => {
            // Now try to start claude-loop with the same port
            const child = spawn('node', ['bin/claude-loop.js', 'loop', '--ui', '--path=/tmp', '--max-iterations=1'], {
                stdio: 'pipe',
                env: { ...process.env, WEBUI_PORT: '3343' }
            });

            let output = '';
            let errorHandled = false;

            child.stderr.on('data', (data) => {
                output += data.toString();
                if (output.includes('EADDRINUSE') || output.includes('address already in use')) {
                    errorHandled = true;
                    child.kill('SIGTERM');
                    server.close();
                    console.log('   ✓ Port conflict error handling working');
                    resolve(true);
                }
            });

            child.stdout.on('data', (data) => {
                output += data.toString();
            });

            child.on('close', (code) => {
                if (!errorHandled) {
                    server.close();
                    console.log('   ❌ Port conflict error handling failed');
                    console.log('   Output:', output.substring(output.length - 300));
                    resolve(false);
                }
            });

            setTimeout(() => {
                if (!errorHandled) {
                    child.kill('SIGTERM');
                    server.close();
                    console.log('   ❌ Port conflict test timeout');
                    resolve(false);
                }
            }, 10000);
        });
    });
}

// Test 5: MCP integration check
function testMCPIntegration() {
    return new Promise((resolve) => {
        console.log('5. Testing MCP integration check...');
        const child = spawn('node', ['bin/claude-loop.js', 'loop', '--path=/tmp', '--max-iterations=1'], {
            stdio: 'pipe'
        });

        let output = '';
        let mcpChecked = false;

        child.stdout.on('data', (data) => {
            output += data.toString();
            if (output.includes('Checking MCP installations') || output.includes('MCP')) {
                mcpChecked = true;
                child.kill('SIGTERM');
                console.log('   ✓ MCP integration check working');
                resolve(true);
            }
        });

        child.stderr.on('data', (data) => {
            output += data.toString();
        });

        child.on('close', (code) => {
            if (!mcpChecked) {
                console.log('   ❌ MCP integration check failed');
                console.log('   Output:', output.substring(0, 400));
                resolve(false);
            }
        });

        setTimeout(() => {
            if (!mcpChecked) {
                child.kill('SIGTERM');
                console.log('   ❌ MCP integration test timeout');
                resolve(false);
            }
        }, 8000);
    });
}

// Run all edge case tests
async function runEdgeCaseTests() {
    const results = [];
    
    results.push(await testInvalidRepoPath());
    results.push(await testCustomClaudeCommand());
    results.push(await testMaxIterations());
    results.push(await testPortConflicts());
    results.push(await testMCPIntegration());
    
    console.log('\n📊 CLI Edge Case Test Results:');
    console.log('==============================');
    console.log(`Invalid Repository Path: ${results[0] ? '✓ PASS' : '❌ FAIL'}`);
    console.log(`Custom Claude Command: ${results[1] ? '✓ PASS' : '❌ FAIL'}`);
    console.log(`Max Iterations Config: ${results[2] ? '✓ PASS' : '❌ FAIL'}`);
    console.log(`Port Conflict Handling: ${results[3] ? '✓ PASS' : '❌ FAIL'}`);
    console.log(`MCP Integration Check: ${results[4] ? '✓ PASS' : '❌ FAIL'}`);
    
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log(`\nSummary: ${passed}/${total} edge case tests passed`);
    
    if (passed === total) {
        console.log('🎉 All CLI edge case tests passed!');
        process.exit(0);
    } else {
        console.log('⚠️  Some CLI edge case tests failed');
        process.exit(1);
    }
}

runEdgeCaseTests().catch((error) => {
    console.error('Edge case test runner error:', error);
    process.exit(1);
});