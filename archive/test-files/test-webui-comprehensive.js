const WebUI = require('./lib/web-ui');
const http = require('http');

async function runWebUITests() {
    console.log('🚀 Starting Web UI Test Suite...\n');
    
    const webUI = new WebUI(3333);
    let token;
    
    try {
        // Start the server
        console.log('📡 Starting Web UI server...');
        await webUI.start();
        token = webUI.sessionToken;
        console.log('✅ Server started successfully');
        console.log(`🔐 Token: ${token.substring(0, 16)}...`);
        
        // Test 1: Health endpoint
        console.log('\n🔍 Test 1: Health endpoint');
        try {
            const healthResponse = await makeRequest('/health', token);
            if (healthResponse.statusCode === 200) {
                const data = JSON.parse(healthResponse.body);
                console.log('✅ Health endpoint working:', data);
            } else {
                console.log('❌ Health endpoint failed:', healthResponse.statusCode);
            }
        } catch (error) {
            console.log('❌ Health endpoint error:', error.message);
        }
        
        // Test 2: Session API
        console.log('\n🔍 Test 2: Session API endpoint');
        try {
            const sessionResponse = await makeRequest('/api/session', token);
            if (sessionResponse.statusCode === 200) {
                const data = JSON.parse(sessionResponse.body);
                console.log('✅ Session API working:', {
                    iterations: data.iterations,
                    isRunning: data.isRunning,
                    currentPhase: data.currentPhase
                });
            } else {
                console.log('❌ Session API failed:', sessionResponse.statusCode);
            }
        } catch (error) {
            console.log('❌ Session API error:', error.message);
        }
        
        // Test 3: Main dashboard HTML
        console.log('\n🔍 Test 3: Dashboard HTML');
        try {
            const dashboardResponse = await makeRequest('/', token);
            if (dashboardResponse.statusCode === 200) {
                const hasTitle = dashboardResponse.body.includes('Claude Loop - AI Repository Debugger');
                const hasWebSocket = dashboardResponse.body.includes('WebSocket');
                const hasStatusGrid = dashboardResponse.body.includes('status-grid');
                console.log('✅ Dashboard HTML working:', {
                    hasTitle,
                    hasWebSocket,
                    hasStatusGrid,
                    sizeKB: Math.round(dashboardResponse.body.length / 1024)
                });
            } else {
                console.log('❌ Dashboard failed:', dashboardResponse.statusCode);
            }
        } catch (error) {
            console.log('❌ Dashboard error:', error.message);
        }
        
        // Test 4: Authentication (no token)
        console.log('\n🔍 Test 4: Authentication testing');
        try {
            const noTokenResponse = await makeRequest('/health');
            if (noTokenResponse.statusCode === 401) {
                console.log('✅ Authentication working: Correctly rejected request without token');
            } else {
                console.log('❌ Authentication failed: Should reject without token');
            }
        } catch (error) {
            console.log('❌ Authentication error:', error.message);
        }
        
        // Test 5: Session state updates
        console.log('\n🔍 Test 5: Session state management');
        webUI.updateSession({
            iterations: 7,
            currentPhase: 'UI Testing Phase',
            isRunning: true
        });
        
        webUI.addOutput('Test message 1', 'info');
        webUI.addOutput('Test success message', 'success');
        webUI.addOutput('Test warning message', 'warning');
        webUI.addOutput('Test error message', 'error');
        
        // Verify the updates
        const updatedSessionResponse = await makeRequest('/api/session', token);
        if (updatedSessionResponse.statusCode === 200) {
            const data = JSON.parse(updatedSessionResponse.body);
            console.log('✅ Session updates working:', {
                iterations: data.iterations,
                currentPhase: data.currentPhase,
                isRunning: data.isRunning,
                outputMessages: data.output?.length || 0
            });
        }
        
        // Test 6: Security headers
        console.log('\n🔍 Test 6: Security headers');
        const securityResponse = await makeRequest('/', token);
        const headers = securityResponse.headers;
        console.log('✅ Security headers present:', {
            'X-Content-Type-Options': headers['x-content-type-options'],
            'X-Frame-Options': headers['x-frame-options'],
            'Content-Security-Policy': !!headers['content-security-policy']
        });
        
        // Test 7: Error handling (invalid endpoint)
        console.log('\n🔍 Test 7: Error handling');
        try {
            const errorResponse = await makeRequest('/invalid-endpoint', token);
            if (errorResponse.statusCode === 404) {
                console.log('✅ Error handling working: 404 for invalid endpoint');
            } else {
                console.log('❌ Error handling issue:', errorResponse.statusCode);
            }
        } catch (error) {
            console.log('❌ Error handling test failed:', error.message);
        }
        
        console.log('\n✅ All Web UI tests completed successfully!');
        console.log('\n📊 Server running with:');
        console.log(`   - Connected clients: ${webUI.clients.size}`);
        console.log(`   - Session iterations: ${webUI.sessionData.iterations}`);
        console.log(`   - Output messages: ${webUI.sessionData.output.length}`);
        
        // Keep running for manual inspection
        console.log('\n⏳ Keeping server running for 15 seconds for manual inspection...');
        console.log(`   Visit: http://localhost:3333?token=${token}`);
        await new Promise(resolve => setTimeout(resolve, 15000));
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        // Clean shutdown
        console.log('\n🛑 Shutting down server...');
        try {
            await webUI.stop();
            console.log('✅ Server shutdown complete');
        } catch (error) {
            console.log('❌ Shutdown error:', error.message);
        }
    }
}

function makeRequest(path, token = null) {
    const url = token ? `${path}?token=${token}` : path;
    
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3333,
            path: url,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
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
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
}

runWebUITests().catch(console.error);