#!/usr/bin/env node

/**
 * Simple WebSocket Authentication Test
 * Tests specific authentication scenarios without hitting rate limits
 */

const WebSocket = require('ws');
const WebUI = require('./lib/web-ui');

class SimpleAuthTest {
    constructor() {
        this.webUI = null;
        this.testPort = 3343;
        this.results = [];
    }

    async run() {
        console.log('🔐 Simple WebSocket Authentication Test\n');
        
        try {
            // Start server
            this.webUI = new WebUI(this.testPort);
            await this.webUI.start();
            const validToken = this.webUI.sessionToken;
            console.log(`✅ Server started with token: ${validToken.substring(0, 8)}...\n`);
            
            // Test 1: Valid token should connect
            console.log('1️⃣ Testing valid token...');
            try {
                const validWs = await this.createConnection(validToken);
                console.log('✅ Valid token: Connection successful');
                validWs.close();
                this.results.push({ test: 'Valid Token', result: 'PASS' });
            } catch (error) {
                console.log(`❌ Valid token failed: ${error.message}`);
                this.results.push({ test: 'Valid Token', result: 'FAIL', error: error.message });
            }
            
            await this.wait(1000); // Wait between tests
            
            // Test 2: Invalid token should be rejected
            console.log('\n2️⃣ Testing invalid token...');
            try {
                const invalidWs = await this.createConnection('invalid_token_123', 3000);
                console.log('❌ Invalid token: Connection was accepted (SECURITY ISSUE!)');
                invalidWs.close();
                this.results.push({ test: 'Invalid Token', result: 'FAIL', error: 'Invalid token was accepted' });
            } catch (error) {
                if (error.message.includes('1008') || error.message.includes('Invalid token')) {
                    console.log('✅ Invalid token: Properly rejected');
                    this.results.push({ test: 'Invalid Token', result: 'PASS' });
                } else {
                    console.log(`⚠️ Invalid token: Unexpected error: ${error.message}`);
                    this.results.push({ test: 'Invalid Token', result: 'PARTIAL', error: error.message });
                }
            }
            
            await this.wait(1000); // Wait between tests
            
            // Test 3: Missing token should be rejected
            console.log('\n3️⃣ Testing missing token...');
            try {
                const noTokenWs = await this.createConnection(null, 3000);
                console.log('❌ Missing token: Connection was accepted (SECURITY ISSUE!)');
                noTokenWs.close();
                this.results.push({ test: 'Missing Token', result: 'FAIL', error: 'Missing token was accepted' });
            } catch (error) {
                if (error.message.includes('1008') || error.message.includes('Invalid token')) {
                    console.log('✅ Missing token: Properly rejected');
                    this.results.push({ test: 'Missing Token', result: 'PASS' });
                } else {
                    console.log(`⚠️ Missing token: Unexpected error: ${error.message}`);
                    this.results.push({ test: 'Missing Token', result: 'PARTIAL', error: error.message });
                }
            }
            
            await this.wait(1000); // Wait between tests
            
            // Test 4: Empty token should be rejected
            console.log('\n4️⃣ Testing empty token...');
            try {
                const emptyTokenWs = await this.createConnection('', 3000);
                console.log('❌ Empty token: Connection was accepted (SECURITY ISSUE!)');
                emptyTokenWs.close();
                this.results.push({ test: 'Empty Token', result: 'FAIL', error: 'Empty token was accepted' });
            } catch (error) {
                if (error.message.includes('1008') || error.message.includes('Invalid token')) {
                    console.log('✅ Empty token: Properly rejected');
                    this.results.push({ test: 'Empty Token', result: 'PASS' });
                } else {
                    console.log(`⚠️ Empty token: Unexpected error: ${error.message}`);
                    this.results.push({ test: 'Empty Token', result: 'PARTIAL', error: error.message });
                }
            }
            
            this.printResults();
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
        } finally {
            if (this.webUI) {
                await this.webUI.stop();
                console.log('✅ Server stopped');
            }
        }
    }

    async createConnection(token, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const url = token !== null 
                ? `ws://localhost:${this.testPort}?token=${encodeURIComponent(token)}`
                : `ws://localhost:${this.testPort}`;
                
            const options = {
                headers: {
                    'User-Agent': 'WebSocket-Auth-Test/1.0 (Node.js)'
                }
            };
                
            const ws = new WebSocket(url, options);
            
            const timeoutId = setTimeout(() => {
                if (ws.readyState !== WebSocket.CLOSED) {
                    ws.close();
                }
                reject(new Error('WebSocket connection timeout'));
            }, timeout);
            
            ws.on('open', () => {
                clearTimeout(timeoutId);
                resolve(ws);
            });
            
            ws.on('close', (code, reason) => {
                clearTimeout(timeoutId);
                reject(new Error(`WebSocket close: code=${code}, reason=${reason}`));
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
        });
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    printResults() {
        console.log('\n📋 AUTHENTICATION TEST RESULTS');
        console.log('='.repeat(40));
        
        const passed = this.results.filter(r => r.result === 'PASS').length;
        const total = this.results.length;
        
        this.results.forEach(result => {
            const status = result.result === 'PASS' ? '✅ PASS' : 
                          result.result === 'FAIL' ? '❌ FAIL' : '⚠️ PARTIAL';
            console.log(`${status} ${result.test}`);
            if (result.error) {
                console.log(`      ${result.error}`);
            }
        });
        
        console.log(`\n📊 Results: ${passed}/${total} tests passed (${(passed/total*100).toFixed(1)}%)`);
        
        if (passed === total) {
            console.log('🎉 All authentication tests passed! WebSocket security is working correctly.');
        } else {
            console.log('⚠️ Some authentication tests failed. Review security implementation.');
        }
    }
}

// Run test
if (require.main === module) {
    const test = new SimpleAuthTest();
    test.run().then(() => {
        console.log('\n✅ Authentication testing completed');
        process.exit(0);
    }).catch(error => {
        console.error('💥 Test failed:', error);
        process.exit(1);
    });
}

module.exports = SimpleAuthTest;