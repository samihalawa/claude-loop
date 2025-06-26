#!/usr/bin/env node

const WebSocket = require('ws');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

async function comprehensiveUITest() {
        const testPort1 = await aiConfig.allocatePort('test-service-1');
    console.log(chalk.cyan('🧪 Comprehensive UI/UX Testing Report\n'));
    
    const results = {
        passed: 0,
        failed: 0,
        warnings: 0,
        tests: []
    };
    
    const token = process.env.WEBUI_TEST_TOKEN || require('crypto').randomBytes(48).toString('hex');
    const port = process.env.TEST_BROWSER_UI_PORT || 3997;
    const baseUrl = `http://localhost:${port}`;
    
    // Test 1: Basic Server Response
    console.log(chalk.blue('Test 1: Basic Server Response'));
    try {
        const { spawn } = require('child_process');
        const response = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        if (response.includes('Claude Loop') && response.includes('AI-Powered Repository Debugger')) {
            console.log(chalk.green('✅ Server responds with correct HTML'));
            results.passed++;
            results.tests.push({ name: 'Basic Server Response', status: 'PASS', details: 'HTML contains expected title and branding' });
        } else {
            console.log(chalk.red('❌ Server response missing expected content'));
            results.failed++;
            results.tests.push({ name: 'Basic Server Response', status: 'FAIL', details: 'HTML missing title or branding' });
        }
    } catch (error) {
        console.log(chalk.red('❌ Server not responding:', error.message));
        results.failed++;
        results.tests.push({ name: 'Basic Server Response', status: 'FAIL', details: error.message });
    }
    
    // Test 2: Required UI Elements Present
    console.log(chalk.blue('\nTest 2: Required UI Elements Present'));
    try {
        const { spawn } = require('child_process');
        const response = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        const requiredElements = [
            { id: 'status', name: 'Session Status' },
            { id: 'iterations', name: 'Iterations Counter' },
            { id: 'currentPhase', name: 'Current Phase' },
            { id: 'runtime', name: 'Runtime Display' },
            { id: 'output', name: 'Output Container' },
            { id: 'connectionStatus', name: 'Connection Status' },
            { id: 'autoScroll', name: 'Auto-scroll Checkbox' }
        ];
        
        let missingElements = [];
        for (const element of requiredElements) {
            if (!response.includes(`id="${element.id}"`)) {
                missingElements.push(element.name);
            }
        }
        
        if (missingElements.length === 0) {
            console.log(chalk.green('✅ All required UI elements present'));
            results.passed++;
            results.tests.push({ name: 'Required UI Elements', status: 'PASS', details: 'All 7 required elements found' });
        } else {
            console.log(chalk.red(`❌ Missing elements: ${missingElements.join(', ')}`));
            results.failed++;
            results.tests.push({ name: 'Required UI Elements', status: 'FAIL', details: `Missing: ${missingElements.join(', ')}` });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error checking UI elements:', error.message));
        results.failed++;
        results.tests.push({ name: 'Required UI Elements', status: 'FAIL', details: error.message });
    }
    
    // Test 3: CSS Styling and Responsive Design
    console.log(chalk.blue('\nTest 3: CSS Styling and Responsive Design'));
    try {
        const { spawn } = require('child_process');
        const response = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        const cssFeatures = [
            { pattern: '--claude-primary:', name: 'CSS Custom Properties' },
            { pattern: 'grid-template-columns:', name: 'CSS Grid Layout' },
            { pattern: 'flex:', name: 'Flexbox Layout' },
            { pattern: '@media (max-width:', name: 'Responsive Media Queries' },
            { pattern: 'transition:', name: 'CSS Transitions' },
            { pattern: 'border-radius:', name: 'Modern Border Radius' },
            { pattern: 'box-shadow:', name: 'Modern Shadows' },
            { pattern: '@keyframes', name: 'CSS Animations' }
        ];
        
        let foundFeatures = [];
        let missingFeatures = [];
        
        for (const feature of cssFeatures) {
            if (response.includes(feature.pattern)) {
                foundFeatures.push(feature.name);
            } else {
                missingFeatures.push(feature.name);
            }
        }
        
        if (missingFeatures.length === 0) {
            console.log(chalk.green('✅ All modern CSS features present'));
            console.log(chalk.gray(`   Features: ${foundFeatures.join(', ')}`));
            results.passed++;
            results.tests.push({ name: 'CSS Styling', status: 'PASS', details: `Found: ${foundFeatures.join(', ')}` });
        } else if (missingFeatures.length <= 2) {
            console.log(chalk.yellow(`⚠️ Most CSS features present, missing: ${missingFeatures.join(', ')}`));
            results.warnings++;
            results.tests.push({ name: 'CSS Styling', status: 'WARNING', details: `Missing: ${missingFeatures.join(', ')}` });
        } else {
            console.log(chalk.red(`❌ Missing several CSS features: ${missingFeatures.join(', ')}`));
            results.failed++;
            results.tests.push({ name: 'CSS Styling', status: 'FAIL', details: `Missing: ${missingFeatures.join(', ')}` });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error checking CSS features:', error.message));
        results.failed++;
        results.tests.push({ name: 'CSS Styling', status: 'FAIL', details: error.message });
    }
    
    // Test 4: API Endpoints
    console.log(chalk.blue('\nTest 4: API Endpoints'));
    try {
        const { spawn } = require('child_process');
        
        // Test health endpoint
        const healthResponse = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}/health?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        // Test session endpoint
        const sessionResponse = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}/api/session?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        const healthData = JSON.parse(healthResponse);
        const sessionData = JSON.parse(sessionResponse);
        
        if (healthData.status === 'ok' && sessionData.iterations !== undefined && sessionData.currentPhase) {
            console.log(chalk.green('✅ All API endpoints working correctly'));
            console.log(chalk.gray(`   Health: ${healthData.status}, Session iterations: ${sessionData.iterations}`));
            results.passed++;
            results.tests.push({ name: 'API Endpoints', status: 'PASS', details: `Health: ${healthData.status}, Session data present` });
        } else {
            console.log(chalk.red('❌ API endpoints not responding correctly'));
            results.failed++;
            results.tests.push({ name: 'API Endpoints', status: 'FAIL', details: 'Health or session endpoint failed' });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error testing API endpoints:', error.message));
        results.failed++;
        results.tests.push({ name: 'API Endpoints', status: 'FAIL', details: error.message });
    }
    
    // Test 5: WebSocket Real-time Communication
    console.log(chalk.blue('\nTest 5: WebSocket Real-time Communication'));
    try {
        const ws = new WebSocket(`ws://localhost:${testPort1}?token=${token}`);
        
        const wsTest = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('WebSocket timeout'));
            }, 5000);
            
            let messagesReceived = 0;
            let sessionDataReceived = false;
            
            ws.on('open', () => {
                console.log(chalk.gray('   WebSocket connected'));
                ws.send(JSON.stringify({ type: 'ping' }));
            });
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    messagesReceived++;
                    
                    if (message.type === 'session_data') {
                        sessionDataReceived = true;
                    }
                    
                    if (messagesReceived >= 2) {
                        clearTimeout(timeout);
                        ws.close();
                        resolve({ messagesReceived, sessionDataReceived });
                    }
                } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
        
        if (wsTest.messagesReceived >= 2 && wsTest.sessionDataReceived) {
            console.log(chalk.green('✅ WebSocket communication working correctly'));
            console.log(chalk.gray(`   Messages received: ${wsTest.messagesReceived}, Session data: ${wsTest.sessionDataReceived}`));
            results.passed++;
            results.tests.push({ name: 'WebSocket Communication', status: 'PASS', details: `${wsTest.messagesReceived} messages, session data received` });
        } else {
            console.log(chalk.yellow('⚠️ WebSocket partially working'));
            results.warnings++;
            results.tests.push({ name: 'WebSocket Communication', status: 'WARNING', details: `${wsTest.messagesReceived} messages, session data: ${wsTest.sessionDataReceived}` });
        }
    } catch (error) {
        console.log(chalk.red('❌ WebSocket test failed:', error.message));
        results.failed++;
        results.tests.push({ name: 'WebSocket Communication', status: 'FAIL', details: error.message });
    }
    
    // Test 6: Security Features
    console.log(chalk.blue('\nTest 6: Security Features'));
    try {
        const { spawn } = require('child_process');
const aiConfig = require('./lib/utils/ai-config-manager');
        
        // Test without token
        const noTokenResponse = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', '-w', '%{http_code}', baseUrl]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        // Test with invalid token
        const invalidTokenResponse = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', '-w', '%{http_code}', `${baseUrl}?token=invalid`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        const noTokenStatus = noTokenResponse.slice(-3);
        const invalidTokenStatus = invalidTokenResponse.slice(-3);
        
        if (noTokenStatus === '401' && invalidTokenStatus === '401') {
            console.log(chalk.green('✅ Token authentication working correctly'));
            console.log(chalk.gray(`   No token: ${noTokenStatus}, Invalid token: ${invalidTokenStatus}`));
            results.passed++;
            results.tests.push({ name: 'Security Features', status: 'PASS', details: 'Token authentication enforced' });
        } else {
            console.log(chalk.red(`❌ Security issues: No token: ${noTokenStatus}, Invalid token: ${invalidTokenStatus}`));
            results.failed++;
            results.tests.push({ name: 'Security Features', status: 'FAIL', details: `Security bypass possible` });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error testing security:', error.message));
        results.failed++;
        results.tests.push({ name: 'Security Features', status: 'FAIL', details: error.message });
    }
    
    // Test 7: HTML Test File Functionality
    console.log(chalk.blue('\nTest 7: HTML Test File Analysis'));
    try {
        const htmlPath = '/Users/samihalawa/git/claude-loop/test-broken-ui.html';
        if (fs.existsSync(htmlPath)) {
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');
            
            const htmlFeatures = [
                { pattern: 'addEventListener', name: 'Modern Event Handling' },
                { pattern: 'aria-', name: 'Accessibility Attributes' },
                { pattern: 'fetch(', name: 'Modern AJAX' },
                { pattern: 'async function', name: 'Modern JavaScript' },
                { pattern: 'preventDefault', name: 'Form Handling' },
                { pattern: 'CSS Grid', name: 'CSS Grid Layout' },
                { pattern: 'flexbox', name: 'Flexbox Layout' }
            ];
            
            let foundFeatures = [];
            for (const feature of htmlFeatures) {
                if (htmlContent.includes(feature.pattern)) {
                    foundFeatures.push(feature.name);
                }
            }
            
            if (foundFeatures.length >= 5) {
                console.log(chalk.green('✅ HTML test file has modern features'));
                console.log(chalk.gray(`   Features: ${foundFeatures.join(', ')}`));
                results.passed++;
                results.tests.push({ name: 'HTML Test File', status: 'PASS', details: `${foundFeatures.length} modern features found` });
            } else {
                console.log(chalk.yellow(`⚠️ HTML test file could use more modern features (${foundFeatures.length} found)`));
                results.warnings++;
                results.tests.push({ name: 'HTML Test File', status: 'WARNING', details: `Only ${foundFeatures.length} modern features` });
            }
        } else {
            console.log(chalk.red('❌ HTML test file not found'));
            results.failed++;
            results.tests.push({ name: 'HTML Test File', status: 'FAIL', details: 'File not found' });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error analyzing HTML test file:', error.message));
        results.failed++;
        results.tests.push({ name: 'HTML Test File', status: 'FAIL', details: error.message });
    }
    
    // Generate Report
    console.log(chalk.cyan('\n📊 UI/UX Testing Summary Report'));
    console.log(chalk.cyan('=' .repeat(50)));
    console.log(chalk.green(`✅ Passed: ${results.passed}`));
    console.log(chalk.yellow(`⚠️ Warnings: ${results.warnings}`));
    console.log(chalk.red(`❌ Failed: ${results.failed}`));
    console.log(chalk.cyan(`📋 Total Tests: ${results.tests.length}`));
    
    const successRate = ((results.passed + results.warnings * 0.5) / results.tests.length * 100).toFixed(1);
    console.log(chalk.cyan(`📈 Success Rate: ${successRate}%`));
    
    console.log(chalk.cyan('\n📋 Detailed Test Results:'));
    results.tests.forEach((test, index) => {
        const statusColor = test.status === 'PASS' ? chalk.green : 
                           test.status === 'WARNING' ? chalk.yellow : chalk.red;
        console.log(`${index + 1}. ${statusColor(test.status)} ${test.name}: ${test.details}`);
    });
    
    // Save report to file
    const reportPath = '/Users/samihalawa/git/claude-loop/ui-test-report.json';
    fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: {
            passed: results.passed,
            warnings: results.warnings,
            failed: results.failed,
            total: results.tests.length,
            successRate: successRate
        },
        tests: results.tests
    }, null, 2));
    
    console.log(chalk.cyan(`\n💾 Report saved to: ${reportPath}`));
    
    return results;
}

comprehensiveUITest()
    .then((results) => {
        if (results.failed === 0) {
            console.log(chalk.green('\n🎉 All critical UI/UX tests passed!'));
            process.exit(0);
        } else {
            console.log(chalk.yellow('\n⚠️ Some UI/UX issues detected - see report above'));
            process.exit(1);
        }
    })
    .catch((error) => {
        console.error(chalk.red('\n❌ UI/UX testing failed:'), error.message);
        process.exit(1);
    });