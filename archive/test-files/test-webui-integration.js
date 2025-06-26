#!/usr/bin/env node

const http = require('http');
const WebSocket = require('ws');
const { URL } = require('url');

console.log('🧪 Testing Web UI Integration...\n');

// Test configuration
const TEST_PORT = parseInt(process.env.TEST_WEBUI_PORT) || 3350;
const TEST_TOKEN = 'test-token-123';

// Test 1: Web UI Server Startup
function testWebUIStartup() {
    return new Promise((resolve) => {
        console.log('1. Testing Web UI server startup...');
        
        const WebUI = require('./lib/web-ui');
        const webUI = new WebUI(TEST_PORT);
        
        // Set a test token for authentication
        webUI.sessionToken = TEST_TOKEN;
        webUI.tokenExpiry = Date.now() + 3600000; // 1 hour
        
        webUI.start().then(() => {
            console.log('   ✓ Web UI server started successfully');
            
            // Stop the server after test
            webUI.stop().then(() => {
                console.log('   ✓ Web UI server stopped successfully');
                resolve(true);
            }).catch((error) => {
                console.log('   ❌ Web UI stop failed:', error.message);
                resolve(false);
            });
        }).catch((error) => {
            console.log('   ❌ Web UI startup failed:', error.message);
            resolve(false);
        });
    });
}

// Test 2: HTTP Endpoints
function testHTTPEndpoints() {
    return new Promise(async (resolve) => {
        console.log('2. Testing HTTP endpoints...');
        
        const WebUI = require('./lib/web-ui');
        const webUI = new WebUI(TEST_PORT + 1);
        
        // Set test token
        webUI.sessionToken = TEST_TOKEN;
        webUI.tokenExpiry = Date.now() + 3600000;
        
        try {
            await webUI.start();
            
            // Test endpoints
            const baseUrl = `http://localhost:${TEST_PORT + 1}`;
            const results = {};
            
            // Test dashboard endpoint
            try {
                const dashboardResponse = await makeRequest(`${baseUrl}/?token=${TEST_TOKEN}`);
                results.dashboard = dashboardResponse.statusCode === 200 && 
                                  dashboardResponse.data.includes('Claude Loop');
            } catch (error) {
                results.dashboard = false;
            }
            
            // Test API session endpoint
            try {
                const sessionResponse = await makeRequest(`${baseUrl}/api/session?token=${TEST_TOKEN}`);
                results.session = sessionResponse.statusCode === 200;
            } catch (error) {
                results.session = false;
            }
            
            // Test health endpoint
            try {
                const healthResponse = await makeRequest(`${baseUrl}/health?token=${TEST_TOKEN}`);
                results.health = healthResponse.statusCode === 200;
            } catch (error) {
                results.health = false;
            }
            
            // Test unauthorized access
            try {
                const unauthorizedResponse = await makeRequest(`${baseUrl}/`);
                results.unauthorized = unauthorizedResponse.statusCode === 401;
            } catch (error) {
                results.unauthorized = true; // Expected to fail
            }
            
            await webUI.stop();
            
            const allPassed = Object.values(results).every(result => result);
            if (allPassed) {
                console.log('   ✓ All HTTP endpoints working correctly');
                console.log(`     - Dashboard: ${results.dashboard ? '✓' : '❌'}`);
                console.log(`     - Session API: ${results.session ? '✓' : '❌'}`);
                console.log(`     - Health check: ${results.health ? '✓' : '❌'}`);
                console.log(`     - Auth protection: ${results.unauthorized ? '✓' : '❌'}`);
                resolve(true);
            } else {
                console.log('   ❌ Some HTTP endpoints failed');
                console.log(`     - Dashboard: ${results.dashboard ? '✓' : '❌'}`);
                console.log(`     - Session API: ${results.session ? '✓' : '❌'}`);
                console.log(`     - Health check: ${results.health ? '✓' : '❌'}`);
                console.log(`     - Auth protection: ${results.unauthorized ? '✓' : '❌'}`);
                resolve(false);
            }
            
        } catch (error) {
            console.log('   ❌ HTTP endpoints test failed:', error.message);
            try {
                await webUI.stop();
            } catch (stopError) {
                // Ignore stop errors
            }
            resolve(false);
        }
    });
}

// Test 3: WebSocket Connection
function testWebSocketConnection() {
    return new Promise(async (resolve) => {
        console.log('3. Testing WebSocket connection...');
        
        const WebUI = require('./lib/web-ui');
        const webUI = new WebUI(TEST_PORT + 2);
        
        // Set test token
        webUI.sessionToken = TEST_TOKEN;
        webUI.tokenExpiry = Date.now() + 3600000;
        
        try {
            await webUI.start();
            
            // Test WebSocket connection
            const wsUrl = `ws://localhost:${TEST_PORT + 2}?token=${TEST_TOKEN}`;
            const ws = new WebSocket(wsUrl);
            
            let connectionSuccess = false;
            let messageReceived = false;
            
            ws.on('open', () => {
                connectionSuccess = true;
                
                // Send a test message
                ws.send(JSON.stringify({ type: 'ping' }));
            });
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    if (message.type === 'pong' || message.type === 'session_data') {
                        messageReceived = true;
                    }
                } catch (error) {
                    // Ignore parse errors
                }
            });
            
            // Wait for connection and message exchange
            setTimeout(async () => {
                ws.close();
                await webUI.stop();
                
                if (connectionSuccess && messageReceived) {
                    console.log('   ✓ WebSocket connection working correctly');
                    resolve(true);
                } else {
                    console.log('   ❌ WebSocket connection failed');
                    console.log(`     - Connection: ${connectionSuccess ? '✓' : '❌'}`);
                    console.log(`     - Message exchange: ${messageReceived ? '✓' : '❌'}`);
                    resolve(false);
                }
            }, 3000);
            
        } catch (error) {
            console.log('   ❌ WebSocket test failed:', error.message);
            try {
                await webUI.stop();
            } catch (stopError) {
                // Ignore stop errors
            }
            resolve(false);
        }
    });
}

// Test 4: Session Management
function testSessionManagement() {
    return new Promise(async (resolve) => {
        console.log('4. Testing session management...');
        
        const WebUI = require('./lib/web-ui');
        const webUI = new WebUI(TEST_PORT + 3);
        
        // Set test token
        webUI.sessionToken = TEST_TOKEN;
        webUI.tokenExpiry = Date.now() + 3600000;
        
        try {
            await webUI.start();
            
            // Test session data updates
            const testSessionData = {
                isRunning: true,
                iterations: 5,
                currentPhase: 'Testing phase',
                startTime: Date.now()
            };
            
            webUI.updateSession(testSessionData);
            
            // Test output addition
            webUI.addOutput('Test output message', 'info');
            webUI.addOutput('Test success message', 'success');
            webUI.addOutput('Test error message', 'error');
            
            // Verify session data
            const sessionDataValid = webUI.sessionData.isRunning === true &&
                                   webUI.sessionData.iterations === 5 &&
                                   webUI.sessionData.currentPhase === 'Testing phase';
            
            const outputValid = webUI.sessionData.output.length >= 3;
            
            await webUI.stop();
            
            if (sessionDataValid && outputValid) {
                console.log('   ✓ Session management working correctly');
                console.log('     - Session updates: ✓');
                console.log('     - Output management: ✓');
                resolve(true);
            } else {
                console.log('   ❌ Session management failed');
                console.log(`     - Session updates: ${sessionDataValid ? '✓' : '❌'}`);
                console.log(`     - Output management: ${outputValid ? '✓' : '❌'}`);
                resolve(false);
            }
            
        } catch (error) {
            console.log('   ❌ Session management test failed:', error.message);
            try {
                await webUI.stop();
            } catch (stopError) {
                // Ignore stop errors
            }
            resolve(false);
        }
    });
}

// Test 5: Security Features
function testSecurityFeatures() {
    return new Promise(async (resolve) => {
        console.log('5. Testing security features...');
        
        const WebUI = require('./lib/web-ui');
        const webUI = new WebUI(TEST_PORT + 4);
        
        // Set test token
        webUI.sessionToken = TEST_TOKEN;
        webUI.tokenExpiry = Date.now() + 3600000;
        
        try {
            await webUI.start();
            
            const baseUrl = `http://localhost:${TEST_PORT + 4}`;
            const results = {};
            
            // Test invalid token
            try {
                const invalidTokenResponse = await makeRequest(`${baseUrl}/?token=invalid-token`);
                results.invalidToken = invalidTokenResponse.statusCode === 401;
            } catch (error) {
                results.invalidToken = true; // Expected to fail
            }
            
            // Test missing token
            try {
                const missingTokenResponse = await makeRequest(`${baseUrl}/`);
                results.missingToken = missingTokenResponse.statusCode === 401;
            } catch (error) {
                results.missingToken = true; // Expected to fail
            }
            
            // Test WebSocket with invalid token
            try {
                const wsUrl = `ws://localhost:${TEST_PORT + 4}?token=invalid-token`;
                const ws = new WebSocket(wsUrl);
                
                results.wsInvalidToken = await new Promise((wsResolve) => {
                    ws.on('close', (code) => {
                        wsResolve(code === 1008); // Invalid token close code
                    });
                    
                    ws.on('open', () => {
                        wsResolve(false); // Should not open
                    });
                    
                    setTimeout(() => wsResolve(false), 2000);
                });
            } catch (error) {
                results.wsInvalidToken = true; // Expected to fail
            }
            
            await webUI.stop();
            
            const allSecurityPassed = Object.values(results).every(result => result);
            if (allSecurityPassed) {
                console.log('   ✓ Security features working correctly');
                console.log(`     - Invalid token rejection: ${results.invalidToken ? '✓' : '❌'}`);
                console.log(`     - Missing token rejection: ${results.missingToken ? '✓' : '❌'}`);
                console.log(`     - WebSocket token validation: ${results.wsInvalidToken ? '✓' : '❌'}`);
                resolve(true);
            } else {
                console.log('   ❌ Some security features failed');
                console.log(`     - Invalid token rejection: ${results.invalidToken ? '✓' : '❌'}`);
                console.log(`     - Missing token rejection: ${results.missingToken ? '✓' : '❌'}`);
                console.log(`     - WebSocket token validation: ${results.wsInvalidToken ? '✓' : '❌'}`);
                resolve(false);
            }
            
        } catch (error) {
            console.log('   ❌ Security features test failed:', error.message);
            try {
                await webUI.stop();
            } catch (stopError) {
                // Ignore stop errors
            }
            resolve(false);
        }
    });
}

// Helper function to make HTTP requests
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            timeout: 5000
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

// Run all Web UI integration tests
async function runWebUITests() {
    const results = [];
    
    results.push(await testWebUIStartup());
    results.push(await testHTTPEndpoints());
    results.push(await testWebSocketConnection());
    results.push(await testSessionManagement());
    results.push(await testSecurityFeatures());
    
    console.log('\n📊 Web UI Integration Test Results:');
    console.log('===================================');
    console.log(`Server Startup/Shutdown: ${results[0] ? '✓ PASS' : '❌ FAIL'}`);
    console.log(`HTTP Endpoints: ${results[1] ? '✓ PASS' : '❌ FAIL'}`);
    console.log(`WebSocket Connection: ${results[2] ? '✓ PASS' : '❌ FAIL'}`);
    console.log(`Session Management: ${results[3] ? '✓ PASS' : '❌ FAIL'}`);
    console.log(`Security Features: ${results[4] ? '✓ PASS' : '❌ FAIL'}`);
    
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log(`\nSummary: ${passed}/${total} tests passed`);
    
    if (passed === total) {
        console.log('🎉 All Web UI integration tests passed!');
        process.exit(0);
    } else {
        console.log('⚠️  Some Web UI integration tests failed');
        process.exit(1);
    }
}

runWebUITests().catch((error) => {
    console.error('Web UI test runner error:', error);
    process.exit(1);
});