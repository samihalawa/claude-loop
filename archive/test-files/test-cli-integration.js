#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing CLI Integration...\n');

// Test 1: Basic CLI functionality
function testBasicCLI() {
    return new Promise((resolve) => {
        console.log('1. Testing basic CLI functionality...');
        const child = spawn('node', ['bin/claude-loop.js', '--help'], {
            stdio: 'pipe'
        });

        let output = '';
        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.on('close', (code) => {
            if (output.includes('AI-powered repository debugging tool') && code === 0) {
                console.log('   ✓ Basic CLI help working');
                resolve(true);
            } else {
                console.log('   ❌ Basic CLI help failed');
                resolve(false);
            }
        });
    });
}

// Test 2: Parameter validation
function testParameterValidation() {
    return new Promise((resolve) => {
        console.log('2. Testing parameter validation...');
        const child = spawn('node', ['bin/claude-loop.js', 'loop', '--max-iterations=0'], {
            stdio: 'pipe'
        });

        let output = '';
        child.stderr.on('data', (data) => {
            output += data.toString();
        });

        child.on('close', (code) => {
            if (output.includes('max-iterations must be a positive number') && code === 1) {
                console.log('   ✓ Parameter validation working');
                resolve(true);
            } else {
                console.log('   ❌ Parameter validation failed');
                console.log('   Output:', output);
                resolve(false);
            }
        });
    });
}

// Test 3: Engine integration
function testEngineIntegration() {
    return new Promise((resolve) => {
        console.log('3. Testing engine integration...');
        const child = spawn('node', ['bin/claude-loop.js', 'loop', '--path=/tmp', '--max-iterations=1'], {
            stdio: 'pipe',
            env: { ...process.env, WEBUI_PORT: '3341' }
        });

        let output = '';
        let engineStarted = false;

        child.stdout.on('data', (data) => {
            output += data.toString();
            if (output.includes('Claude Loop - Real Iterative Debugging') && !engineStarted) {
                engineStarted = true;
                console.log('   ✓ Engine integration working');
                child.kill('SIGTERM');
                resolve(true);
            }
        });

        child.stderr.on('data', (data) => {
            output += data.toString();
        });

        child.on('close', (code) => {
            if (!engineStarted) {
                console.log('   ❌ Engine integration failed');
                console.log('   Output:', output.substring(0, 500));
                resolve(false);
            }
        });

        setTimeout(() => {
            if (!engineStarted) {
                child.kill('SIGTERM');
                console.log('   ❌ Engine integration timeout');
                resolve(false);
            }
        }, 10000);
    });
}

// Test 4: Web UI integration
function testWebUIIntegration() {
    return new Promise((resolve) => {
        console.log('4. Testing Web UI integration...');
        const child = spawn('node', ['bin/claude-loop.js', 'loop', '--ui', '--path=/tmp', '--max-iterations=1'], {
            stdio: 'pipe',
            env: { ...process.env, WEBUI_PORT: '3342' }
        });

        let output = '';
        let uiStarted = false;

        child.stdout.on('data', (data) => {
            output += data.toString();
            if (output.includes('Web UI started') && !uiStarted) {
                uiStarted = true;
                console.log('   ✓ Web UI integration working');
                child.kill('SIGTERM');
                resolve(true);
            }
        });

        child.stderr.on('data', (data) => {
            output += data.toString();
        });

        child.on('close', (code) => {
            if (!uiStarted) {
                console.log('   ❌ Web UI integration failed');
                console.log('   Output:', output.substring(output.length - 300));
                resolve(false);
            }
        });

        setTimeout(() => {
            if (!uiStarted) {
                child.kill('SIGTERM');
                console.log('   ❌ Web UI integration timeout');
                resolve(false);
            }
        }, 15000);
    });
}

// Run all tests
async function runTests() {
    const results = [];
    
    results.push(await testBasicCLI());
    results.push(await testParameterValidation());
    results.push(await testEngineIntegration());
    results.push(await testWebUIIntegration());
    
    console.log('\n📊 CLI Integration Test Results:');
    console.log('================================');
    console.log(`Basic CLI: ${results[0] ? '✓ PASS' : '❌ FAIL'}`);
    console.log(`Parameter Validation: ${results[1] ? '✓ PASS' : '❌ FAIL'}`);
    console.log(`Engine Integration: ${results[2] ? '✓ PASS' : '❌ FAIL'}`);
    console.log(`Web UI Integration: ${results[3] ? '✓ PASS' : '❌ FAIL'}`);
    
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log(`\nSummary: ${passed}/${total} tests passed`);
    
    if (passed === total) {
        console.log('🎉 All CLI integration tests passed!');
        process.exit(0);
    } else {
        console.log('⚠️  Some CLI integration tests failed');
        process.exit(1);
    }
}

runTests().catch((error) => {
    console.error('Test runner error:', error);
    process.exit(1);
});