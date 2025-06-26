#!/usr/bin/env node

const WebSocket = require('ws');
const chalk = require('chalk');
const fs = require('fs');
const { spawn } = require('child_process');

async function testDashboardInteractivity() {
    console.log(chalk.cyan('🧪 Testing Dashboard Interactive Elements\n'));
    
    const results = {
        passed: 0,
        failed: 0,
        warnings: 0,
        tests: []
    };
    
    const token = process.env.WEBUI_TEST_TOKEN || require('crypto').randomBytes(48).toString('hex');
    const port = process.env.TEST_BROWSER_UI_PORT || 3998;
    const baseUrl = `http://localhost:${port}`;
    
    // Test 1: Basic Server Response
    console.log(chalk.blue('Test 1: Basic Server Response and HTML Content'));
    try {
        const response = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        if (response.includes('Claude Loop') && response.includes('AI-Powered Repository Debugger')) {
            console.log(chalk.green('✅ Server responds with correct HTML title and branding'));
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
    
    // Test 3: CSS Styling and Modern Features
    console.log(chalk.blue('\nTest 3: CSS Styling and Modern Features'));
    try {
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
            { pattern: 'display: flex', name: 'Flexbox Layout' },
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
            results.tests.push({ name: 'CSS Features', status: 'PASS', details: `All ${foundFeatures.length} CSS features found` });
        } else if (missingFeatures.length <= 2) {
            console.log(chalk.yellow(`⚠️ Most CSS features present, missing: ${missingFeatures.join(', ')}`));
            results.warnings++;
            results.tests.push({ name: 'CSS Features', status: 'WARNING', details: `Missing: ${missingFeatures.join(', ')}` });
        } else {
            console.log(chalk.red(`❌ Missing several CSS features: ${missingFeatures.join(', ')}`));
            results.failed++;
            results.tests.push({ name: 'CSS Features', status: 'FAIL', details: `Missing: ${missingFeatures.join(', ')}` });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error checking CSS features:', error.message));
        results.failed++;
        results.tests.push({ name: 'CSS Features', status: 'FAIL', details: error.message });
    }
    
    // Test 4: API Endpoints Functionality
    console.log(chalk.blue('\nTest 4: API Endpoints Functionality'));
    try {
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
            console.log(chalk.gray(`   Health: ${healthData.status}, Session iterations: ${sessionData.iterations}, Phase: ${sessionData.currentPhase}`));
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
    
    // Test 5: WebSocket Connectivity
    console.log(chalk.blue('\nTest 5: WebSocket Real-time Communication'));
    try {
        const ws = new WebSocket(`ws://localhost:${port}?token=${token}`);
        
        const wsTest = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('WebSocket timeout'));
            }, 5000);
            
            ws.on('open', () => {
                console.log(chalk.gray('   WebSocket connection opened'));
                ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            });
            
            ws.on('message', (data) => {
                clearTimeout(timeout);
                const message = JSON.parse(data);
                console.log(chalk.gray(`   Received: ${message.type}`));
                ws.close();
                resolve('success');
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
        
        if (wsTest === 'success') {
            console.log(chalk.green('✅ WebSocket communication working'));
            results.passed++;
            results.tests.push({ name: 'WebSocket Communication', status: 'PASS', details: 'Connection and message exchange successful' });
        }
    } catch (error) {
        console.log(chalk.red('❌ WebSocket connection failed:', error.message));
        results.failed++;
        results.tests.push({ name: 'WebSocket Communication', status: 'FAIL', details: error.message });
    }
    
    // Test 6: Security Features
    console.log(chalk.blue('\nTest 6: Security Features'));
    try {
        const response = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        const securityFeatures = [
            { pattern: 'Content-Security-Policy', name: 'CSP Headers' },
            { pattern: 'X-Content-Type-Options', name: 'MIME Type Protection' },
            { pattern: 'X-Frame-Options', name: 'Clickjacking Protection' },
            { pattern: 'X-XSS-Protection', name: 'XSS Protection' },
            { pattern: 'textContent =', name: 'XSS Safe Text Insertion' }
        ];
        
        let foundSecurity = [];
        
        // Test with and without token to check authentication
        const unauthorizedResponse = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', '-i', baseUrl]); // No token
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        for (const feature of securityFeatures) {
            if (response.includes(feature.pattern) || unauthorizedResponse.includes(feature.pattern)) {
                foundSecurity.push(feature.name);
            }
        }
        
        const hasAuth = unauthorizedResponse.includes('401') || unauthorizedResponse.includes('Invalid');
        
        if (foundSecurity.length >= 3 && hasAuth) {
            console.log(chalk.green('✅ Good security implementation'));
            console.log(chalk.gray(`   Security features: ${foundSecurity.join(', ')}`));
            console.log(chalk.gray(`   Token authentication: Working`));
            results.passed++;
            results.tests.push({ name: 'Security Features', status: 'PASS', details: `${foundSecurity.length} security features + auth` });
        } else if (foundSecurity.length >= 2) {
            console.log(chalk.yellow(`⚠️ Basic security features present (${foundSecurity.length})`));
            results.warnings++;
            results.tests.push({ name: 'Security Features', status: 'WARNING', details: `${foundSecurity.length} security features found` });
        } else {
            console.log(chalk.red(`❌ Limited security features (${foundSecurity.length})`));
            results.failed++;
            results.tests.push({ name: 'Security Features', status: 'FAIL', details: `Only ${foundSecurity.length} features found` });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error testing security features:', error.message));
        results.failed++;
        results.tests.push({ name: 'Security Features', status: 'FAIL', details: error.message });
    }
    
    // Test 7: HTML Test File
    console.log(chalk.blue('\nTest 7: HTML Test File Analysis'));
    try {
        const htmlPath = '/Users/samihalawa/git/claude-loop/test-broken-ui.html';
        if (fs.existsSync(htmlPath)) {
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');
            
            const htmlFeatures = [
                { pattern: '<form', name: 'Form Elements' },
                { pattern: 'addEventListener', name: 'Event Listeners' },
                { pattern: 'function ', name: 'JavaScript Functions' },
                { pattern: 'aria-label', name: 'Accessibility Features' },
                { pattern: 'transition:', name: 'CSS Transitions' },
                { pattern: 'flex', name: 'Modern Layout' }
            ];
            
            let foundHtmlFeatures = [];
            for (const feature of htmlFeatures) {
                if (htmlContent.includes(feature.pattern)) {
                    foundHtmlFeatures.push(feature.name);
                }
            }
            
            if (foundHtmlFeatures.length >= 5) {
                console.log(chalk.green('✅ HTML test file has comprehensive features'));
                console.log(chalk.gray(`   Features: ${foundHtmlFeatures.join(', ')}`));
                results.passed++;
                results.tests.push({ name: 'HTML Test File', status: 'PASS', details: `${foundHtmlFeatures.length} features found` });
            } else if (foundHtmlFeatures.length >= 3) {
                console.log(chalk.yellow(`⚠️ HTML test file has basic features (${foundHtmlFeatures.length})`));
                results.warnings++;
                results.tests.push({ name: 'HTML Test File', status: 'WARNING', details: `${foundHtmlFeatures.length} features found` });
            } else {
                console.log(chalk.red(`❌ HTML test file lacks features (${foundHtmlFeatures.length})`));
                results.failed++;
                results.tests.push({ name: 'HTML Test File', status: 'FAIL', details: `Only ${foundHtmlFeatures.length} features` });
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
    console.log(chalk.cyan('\n📊 Dashboard Interactive Testing Summary'));
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
    
    // Save report
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
        tests: results.tests,
        assessment: results.passed >= 5 ? 'Excellent' : 
                   results.passed + results.warnings >= 5 ? 'Good' : 'Needs Improvement'
    }, null, 2));
    
    console.log(chalk.cyan(`\n💾 Test report saved to: ${reportPath}`));
    
    return results;
}

testDashboardInteractivity()
    .then((results) => {
        if (results.failed <= 1) {
            console.log(chalk.green('\n🎉 Dashboard testing completed successfully!'));
            process.exit(0);
        } else {
            console.log(chalk.yellow('\n⚠️ Some issues detected - see report above'));
            process.exit(1);
        }
    })
    .catch((error) => {
        console.error(chalk.red('\n❌ Dashboard testing failed:'), error.message);
        process.exit(1);
    });