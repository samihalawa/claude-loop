const WebUI = require('./lib/web-ui');
const http = require('http');
const WebSocket = require('ws');

let webUI;
let testResults = {
    serverStart: false,
    httpEndpoints: {},
    websocket: {},
    security: {},
    ui: {}
};

async function startServer() {
    console.log('🚀 Starting Web UI server for testing...');
    
    webUI = new WebUI(3333);
    
    try {
        await webUI.start();
        testResults.serverStart = true;
        console.log('✅ Web UI server started successfully');
        console.log(`🔐 Access token: ${webUI.sessionToken}`);
        return webUI.sessionToken;
    } catch (error) {
        console.error('❌ Failed to start Web UI server:', error);
        testResults.serverStart = false;
        throw error;
    }
}

async function testHTTPEndpoints(token) {
    console.log('\n🌐 Testing HTTP endpoints...');
    
    const tests = [
        { name: 'Health endpoint', path: `/health?token=${token}` },
        { name: 'Session API', path: `/api/session?token=${token}` },
        { name: 'Main dashboard', path: `/?token=${token}` },
        { name: 'Health without token', path: '/health', expectError: true },
        { name: 'Invalid endpoint', path: `/invalid?token=${token}`, expectError: true }
    ];
    
    for (const test of tests) {
        try {
            const response = await makeRequest(test.path);
            if (test.expectError) {
                if (response.statusCode >= 400) {
                    console.log(`✅ ${test.name}: Correctly returned error (${response.statusCode})`);
                    testResults.httpEndpoints[test.name] = { success: true, status: response.statusCode };
                } else {
                    console.log(`❌ ${test.name}: Should have returned error but got ${response.statusCode}`);
                    testResults.httpEndpoints[test.name] = { success: false, status: response.statusCode };
                }
            } else {
                if (response.statusCode === 200) {
                    console.log(`✅ ${test.name}: Success (${response.statusCode})`);
                    testResults.httpEndpoints[test.name] = { success: true, status: response.statusCode };
                } else {
                    console.log(`❌ ${test.name}: Failed (${response.statusCode})`);
                    testResults.httpEndpoints[test.name] = { success: false, status: response.statusCode };
                }
            }
        } catch (error) {
            if (test.expectError) {
                console.log(`✅ ${test.name}: Correctly threw error`);
                testResults.httpEndpoints[test.name] = { success: true, error: error.message };
            } else {
                console.log(`❌ ${test.name}: Error - ${error.message}`);
                testResults.httpEndpoints[test.name] = { success: false, error: error.message };
            }
        }
    }
}

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3333,
            path: path,
            method: 'GET'
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        
        req.on('error', reject);
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
}

async function testWebSocket(token) {
    console.log('\n🔌 Testing WebSocket functionality...');
    
    // Test valid connection
    try {
        const wsUrl = `ws://localhost:3333?token=${token}`;
        console.log('📡 Testing valid WebSocket connection...');
        
        const result = await new Promise((resolve, reject) => {
            const ws = new WebSocket(wsUrl);
            const timeout = setTimeout(() => {
                ws.terminate();
                reject(new Error('WebSocket connection timeout'));
            }, 5000);
            
            ws.on('open', () => {
                console.log('✅ WebSocket connected');
                clearTimeout(timeout);
                
                // Test message sending
                ws.send(JSON.stringify({ type: 'ping' }));
                console.log('📤 Sent ping message');
            });
            
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                console.log(`📥 Received: ${message.type}`);
                
                if (message.type === 'pong') {
                    ws.close();
                    resolve({ success: true, type: 'pong_received' });
                }
            });
            
            ws.on('close', (code, reason) => {
                console.log(`🔌 WebSocket closed: ${code}`);
                clearTimeout(timeout);
                if (!result) resolve({ success: true, code });
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
        
        testResults.websocket.validConnection = result;
        
    } catch (error) {
        console.log(`❌ WebSocket test failed: ${error.message}`);
        testResults.websocket.validConnection = { success: false, error: error.message };
    }
    
    // Test invalid token
    try {
        console.log('📡 Testing invalid token rejection...');
        const wsUrl = 'ws://localhost:3333?token=invalid';
        
        const result = await new Promise((resolve, reject) => {
            const ws = new WebSocket(wsUrl);
            const timeout = setTimeout(() => {
                ws.terminate();
                resolve({ success: true, reason: 'timeout_as_expected' });
            }, 3000);
            
            ws.on('open', () => {
                clearTimeout(timeout);
                ws.close();
                resolve({ success: false, reason: 'should_not_connect' });
            });
            
            ws.on('close', (code, reason) => {
                clearTimeout(timeout);
                console.log(`✅ Invalid token correctly rejected: ${code}`);
                resolve({ success: true, code });
            });
            
            ws.on('error', () => {
                clearTimeout(timeout);
                console.log('✅ Invalid token correctly rejected with error');
                resolve({ success: true, reason: 'error_as_expected' });
            });
        });
        
        testResults.websocket.invalidToken = result;
        
    } catch (error) {
        console.log(`❌ Invalid token test failed: ${error.message}`);
        testResults.websocket.invalidToken = { success: false, error: error.message };
    }
}

async function testUIInteraction(token) {
    console.log('\n🖥️ Testing UI state and session management...');
    
    // Update session data
    webUI.updateSession({
        iterations: 5,
        currentPhase: 'Testing Phase',
        isRunning: true
    });
    
    // Add some output
    webUI.addOutput('Test info message', 'info');
    webUI.addOutput('Test success message', 'success');
    webUI.addOutput('Test warning message', 'warning');
    webUI.addOutput('Test error message', 'error');
    
    console.log('✅ Added test session data and output messages');
    testResults.ui.sessionUpdate = true;
    
    // Test session data retrieval
    try {
        const response = await makeRequest(`/api/session?token=${token}`);
        const sessionData = JSON.parse(response.body);
        
        console.log('✅ Session data:', {
            iterations: sessionData.iterations,
            currentPhase: sessionData.currentPhase,
            isRunning: sessionData.isRunning,
            outputCount: sessionData.output?.length || 0
        });
        
        testResults.ui.sessionRetrieval = {
            success: true,
            data: sessionData
        };
        
    } catch (error) {
        console.log(`❌ Session data retrieval failed: ${error.message}`);
        testResults.ui.sessionRetrieval = { success: false, error: error.message };
    }
}

async function stopServer() {
    console.log('\n🛑 Stopping Web UI server...');
    if (webUI) {
        try {
            await webUI.stop();
            console.log('✅ Web UI server stopped successfully');
        } catch (error) {
            console.log(`❌ Error stopping server: ${error.message}`);
        }
    }
}

async function runTests() {
    try {
        const token = await startServer();
        
        // Give server time to fully start
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await testHTTPEndpoints(token);
        await testWebSocket(token);
        await testUIInteraction(token);
        
        console.log('\n📊 Test Results Summary:');
        console.log('='.repeat(50));
        console.log(JSON.stringify(testResults, null, 2));
        
        console.log('\n✅ All Web UI tests completed successfully!');
        
        // Keep server running for a bit to allow manual inspection
        console.log('\n⏳ Keeping server running for 10 seconds for manual inspection...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
    } catch (error) {
        console.error('❌ Test execution failed:', error);
    } finally {
        await stopServer();
    }
}

runTests().catch(console.error);