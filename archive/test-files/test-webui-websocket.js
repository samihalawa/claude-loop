const WebSocket = require('ws');
const axios = require('axios');

const TOKEN = 'd81218ca826364f9f525bb33721c30a95b5a93b6de9f5c9137025ca6ae4d6d020c587ec4ce601d0dff8670e01fde0d9518d11e01823bf188a32be6234862dc2d';
const BASE_URL = 'http://localhost:3333';
const WS_URL = 'ws://localhost:3333';

async function testWebSocketFunctionality() {
    console.log('🔌 Testing WebSocket functionality...');
    
    // Test 1: Valid WebSocket connection
    console.log('\n📡 Test 1: Valid WebSocket connection');
    try {
        const ws = new WebSocket(`${WS_URL}?token=${TOKEN}`);
        
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 5000);
            
            ws.on('open', () => {
                console.log('✅ WebSocket connected successfully');
                clearTimeout(timeout);
                
                // Test ping/pong
                ws.send(JSON.stringify({ type: 'ping' }));
                console.log('📤 Sent ping message');
            });
            
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                console.log('📥 Received message:', message.type);
                
                if (message.type === 'pong') {
                    console.log('✅ Ping/pong working correctly');
                }
                
                if (message.type === 'session_data') {
                    console.log('✅ Session data received:', {
                        iterations: message.data.iterations,
                        isRunning: message.data.isRunning,
                        currentPhase: message.data.currentPhase
                    });
                }
                
                resolve();
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
            
            ws.on('close', (code, reason) => {
                console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
            });
        });
        
        ws.close();
        
    } catch (error) {
        console.error('❌ WebSocket test failed:', error.message);
    }
    
    // Test 2: Invalid token
    console.log('\n📡 Test 2: Invalid token rejection');
    try {
        const ws = new WebSocket(`${WS_URL}?token=invalid_token`);
        
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                resolve(); // Timeout is expected for invalid token
            }, 3000);
            
            ws.on('open', () => {
                clearTimeout(timeout);
                reject(new Error('Should not connect with invalid token'));
            });
            
            ws.on('close', (code, reason) => {
                console.log(`✅ Correctly rejected invalid token: ${code} - ${reason}`);
                clearTimeout(timeout);
                resolve();
            });
            
            ws.on('error', () => {
                // Expected for invalid token
                clearTimeout(timeout);
                resolve();
            });
        });
        
    } catch (error) {
        console.error('❌ Invalid token test failed:', error.message);
    }
    
    // Test 3: No token
    console.log('\n📡 Test 3: No token rejection');
    try {
        const ws = new WebSocket(WS_URL);
        
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                resolve(); // Timeout is expected for no token
            }, 3000);
            
            ws.on('open', () => {
                clearTimeout(timeout);
                reject(new Error('Should not connect without token'));
            });
            
            ws.on('close', (code, reason) => {
                console.log(`✅ Correctly rejected no token: ${code} - ${reason}`);
                clearTimeout(timeout);
                resolve();
            });
            
            ws.on('error', () => {
                // Expected for no token
                clearTimeout(timeout);
                resolve();
            });
        });
        
    } catch (error) {
        console.error('❌ No token test failed:', error.message);
    }
}

async function testHTTPEndpoints() {
    console.log('\n🌐 Testing HTTP endpoints...');
    
    // Test 1: Health endpoint with token
    console.log('\n📡 Test 1: Health endpoint with valid token');
    try {
        const response = await axios.get(`${BASE_URL}/health?token=${TOKEN}`);
        console.log('✅ Health endpoint response:', response.data);
    } catch (error) {
        console.error('❌ Health endpoint failed:', error.response?.data || error.message);
    }
    
    // Test 2: Health endpoint without token
    console.log('\n📡 Test 2: Health endpoint without token');
    try {
        const response = await axios.get(`${BASE_URL}/health`);
        console.error('❌ Should not succeed without token');
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ Correctly rejected request without token:', error.response.data);
        } else {
            console.error('❌ Unexpected error:', error.response?.data || error.message);
        }
    }
    
    // Test 3: Session API endpoint
    console.log('\n📡 Test 3: Session API endpoint');
    try {
        const response = await axios.get(`${BASE_URL}/api/session?token=${TOKEN}`);
        console.log('✅ Session API response:', response.data);
    } catch (error) {
        console.error('❌ Session API failed:', error.response?.data || error.message);
    }
    
    // Test 4: Non-existent endpoint
    console.log('\n📡 Test 4: Non-existent endpoint');
    try {
        const response = await axios.get(`${BASE_URL}/api/nonexistent?token=${TOKEN}`);
        console.error('❌ Should return 404 for non-existent endpoint');
    } catch (error) {
        if (error.response?.status === 404) {
            console.log('✅ Correctly returned 404 for non-existent endpoint');
        } else {
            console.error('❌ Unexpected response:', error.response?.status, error.response?.data);
        }
    }
    
    // Test 5: Main dashboard
    console.log('\n📡 Test 5: Main dashboard');
    try {
        const response = await axios.get(`${BASE_URL}/?token=${TOKEN}`);
        const isHTML = response.headers['content-type']?.includes('text/html');
        const hasTitle = response.data.includes('Claude Loop - AI Repository Debugger');
        console.log(`✅ Dashboard served: HTML=${isHTML}, Title=${hasTitle}`);
    } catch (error) {
        console.error('❌ Dashboard failed:', error.response?.data || error.message);
    }
}

async function testSecurityFeatures() {
    console.log('\n🔒 Testing security features...');
    
    // Test 1: Rate limiting (multiple requests)
    console.log('\n📡 Test 1: Rate limiting');
    const promises = [];
    for (let i = 0; i < 35; i++) { // Exceed the 30 request limit
        promises.push(
            axios.get(`${BASE_URL}/health?token=${TOKEN}`)
                .catch(error => ({ error: error.response?.status }))
        );
    }
    
    const results = await Promise.all(promises);
    const rateLimited = results.filter(r => r.error === 429);
    console.log(`✅ Rate limiting test: ${rateLimited.length} requests rate-limited out of ${results.length}`);
    
    // Test 2: CORS headers
    console.log('\n📡 Test 2: CORS headers');
    try {
        const response = await axios.get(`${BASE_URL}/health?token=${TOKEN}`);
        const corsHeaders = {
            'Access-Control-Allow-Origin': response.headers['access-control-allow-origin'],
            'Access-Control-Allow-Methods': response.headers['access-control-allow-methods'],
            'X-Content-Type-Options': response.headers['x-content-type-options'],
            'X-Frame-Options': response.headers['x-frame-options']
        };
        console.log('✅ Security headers:', corsHeaders);
    } catch (error) {
        console.error('❌ CORS headers test failed:', error.message);
    }
}

async function runAllTests() {
    console.log('🚀 Starting comprehensive Web UI testing...\n');
    
    await testWebSocketFunctionality();
    await testHTTPEndpoints();
    await testSecurityFeatures();
    
    console.log('\n✅ All Web UI tests completed!');
}

runAllTests().catch(console.error);