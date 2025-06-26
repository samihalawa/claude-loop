#!/usr/bin/env node

const WebSocket = require('ws');

class WebSocketTestClient {
    constructor(port = 3333, token) {
        this.port = port;
        this.token = token;
        this.ws = null;
        this.connected = false;
        this.results = {
            connection: false,
            authentication: false,
            messageReceiving: false,
            messageSending: false,
            ping: false,
            sessionData: false,
            errors: []
        };
    }

    async testWebSocket() {
        console.log('🔌 Starting WebSocket Tests...\n');
        
        try {
            // Test 1: Connection without token (should fail)
            console.log('Test 1: Connection without token');
            await this.testConnectionWithoutToken();
            
            // Test 2: Connection with invalid token (should fail)
            console.log('Test 2: Connection with invalid token');
            await this.testConnectionWithInvalidToken();
            
            // Test 3: Valid connection
            console.log('Test 3: Valid connection with token');
            await this.testValidConnection();
            
            // Test 4: Message handling
            console.log('Test 4: Message sending and receiving');
            await this.testMessageHandling();
            
            // Test 5: Ping/Pong
            console.log('Test 5: Ping/Pong functionality');
            await this.testPingPong();
            
            // Test 6: Session data retrieval
            console.log('Test 6: Session data request');
            await this.testSessionDataRequest();
            
            // Clean up
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.close();
            }
            
        } catch (error) {
            this.results.errors.push(`Test suite error: ${error.message}`);
            console.error('❌ Test suite error:', error.message);
        }
        
        return this.results;
    }

    testConnectionWithoutToken() {
        return new Promise((resolve) => {
            const ws = new WebSocket(`ws://localhost:${this.port}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; WebSocketTestClient/1.0)'
                }
            });
            
            ws.on('close', (code, reason) => {
                if (code === 1008) {
                    console.log('  ✅ Connection correctly rejected without token');
                } else {
                    console.log(`  ❌ Unexpected close code: ${code}`);
                    this.results.errors.push(`Expected close code 1008, got ${code}`);
                }
                resolve();
            });
            
            ws.on('error', (error) => {
                console.log('  ❌ Connection error:', error.message);
                resolve();
            });
            
            setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                    console.log('  ❌ Connection should have been rejected');
                    this.results.errors.push('Connection without token was not rejected');
                }
                resolve();
            }, 2000);
        });
    }

    testConnectionWithInvalidToken() {
        return new Promise((resolve) => {
            const ws = new WebSocket(`ws://localhost:${this.port}?token=invalid_token`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; WebSocketTestClient/1.0)'
                }
            });
            
            ws.on('close', (code, reason) => {
                if (code === 1008) {
                    console.log('  ✅ Connection correctly rejected with invalid token');
                } else {
                    console.log(`  ❌ Unexpected close code: ${code}`);
                    this.results.errors.push(`Expected close code 1008 for invalid token, got ${code}`);
                }
                resolve();
            });
            
            ws.on('error', (error) => {
                console.log('  ❌ Connection error:', error.message);
                resolve();
            });
            
            setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                    console.log('  ❌ Connection with invalid token should have been rejected');
                    this.results.errors.push('Connection with invalid token was not rejected');
                }
                resolve();
            }, 2000);
        });
    }

    testValidConnection() {
        return new Promise((resolve) => {
            this.ws = new WebSocket(`ws://localhost:${this.port}?token=${this.token}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; WebSocketTestClient/1.0)'
                }
            });
            
            this.ws.on('open', () => {
                console.log('  ✅ WebSocket connection established');
                this.connected = true;
                this.results.connection = true;
                this.results.authentication = true;
                resolve();
            });
            
            this.ws.on('close', (code, reason) => {
                console.log(`  ❌ Connection closed unexpectedly: ${code} - ${reason}`);
                this.results.errors.push(`Connection closed unexpectedly: ${code} - ${reason}`);
                resolve();
            });
            
            this.ws.on('error', (error) => {
                console.log('  ❌ Connection error:', error.message);
                this.results.errors.push(`Connection error: ${error.message}`);
                resolve();
            });
            
            setTimeout(() => {
                if (!this.connected) {
                    console.log('  ❌ Connection timeout');
                    this.results.errors.push('Connection timeout');
                    resolve();
                }
            }, 5000);
        });
    }

    testMessageHandling() {
        return new Promise((resolve) => {
            if (!this.connected || !this.ws) {
                console.log('  ❌ No active connection for message test');
                this.results.errors.push('No active connection for message test');
                resolve();
                return;
            }

            let messageReceived = false;
            
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    console.log('  ✅ Message received:', message.type);
                    messageReceived = true;
                    this.results.messageReceiving = true;
                } catch (error) {
                    console.log('  ❌ Invalid JSON received:', error.message);
                    this.results.errors.push(`Invalid JSON received: ${error.message}`);
                }
            });

            // Send a test message
            try {
                const testMessage = JSON.stringify({ type: 'ping', timestamp: Date.now() });
                this.ws.send(testMessage);
                console.log('  ✅ Test message sent');
                this.results.messageSending = true;
            } catch (error) {
                console.log('  ❌ Error sending message:', error.message);
                this.results.errors.push(`Error sending message: ${error.message}`);
            }

            setTimeout(() => {
                if (!messageReceived) {
                    console.log('  ⚠️  No message received (this might be expected)');
                }
                resolve();
            }, 2000);
        });
    }

    testPingPong() {
        return new Promise((resolve) => {
            if (!this.connected || !this.ws) {
                console.log('  ❌ No active connection for ping test');
                resolve();
                return;
            }

            let pongReceived = false;
            
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.type === 'pong') {
                        console.log('  ✅ Pong received');
                        pongReceived = true;
                        this.results.ping = true;
                    }
                } catch (error) {
                    // Ignore non-JSON messages for this test
                }
            });

            // Send ping
            try {
                const pingMessage = JSON.stringify({ type: 'ping' });
                this.ws.send(pingMessage);
                console.log('  📡 Ping sent');
            } catch (error) {
                console.log('  ❌ Error sending ping:', error.message);
                this.results.errors.push(`Error sending ping: ${error.message}`);
            }

            setTimeout(() => {
                if (!pongReceived) {
                    console.log('  ⚠️  No pong received');
                }
                resolve();
            }, 2000);
        });
    }

    testSessionDataRequest() {
        return new Promise((resolve) => {
            if (!this.connected || !this.ws) {
                console.log('  ❌ No active connection for session test');
                resolve();
                return;
            }

            let sessionDataReceived = false;
            
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.type === 'session_data' || message.type === 'session_update') {
                        console.log('  ✅ Session data received:', Object.keys(message.data || {}));
                        sessionDataReceived = true;
                        this.results.sessionData = true;
                    }
                } catch (error) {
                    // Ignore non-JSON messages for this test
                }
            });

            // Request session data
            try {
                const requestMessage = JSON.stringify({ type: 'request_session' });
                this.ws.send(requestMessage);
                console.log('  📡 Session data requested');
            } catch (error) {
                console.log('  ❌ Error requesting session data:', error.message);
                this.results.errors.push(`Error requesting session data: ${error.message}`);
            }

            setTimeout(() => {
                if (!sessionDataReceived) {
                    console.log('  ⚠️  No session data received');
                }
                resolve();
            }, 3000);
        });
    }

    printResults() {
        console.log('\n🔍 WebSocket Test Results:');
        console.log('=============================');
        console.log(`Connection: ${this.results.connection ? '✅' : '❌'}`);
        console.log(`Authentication: ${this.results.authentication ? '✅' : '❌'}`);
        console.log(`Message Sending: ${this.results.messageSending ? '✅' : '❌'}`);
        console.log(`Message Receiving: ${this.results.messageReceiving ? '✅' : '❌'}`);
        console.log(`Ping/Pong: ${this.results.ping ? '✅' : '❌'}`);
        console.log(`Session Data: ${this.results.sessionData ? '✅' : '❌'}`);
        
        if (this.results.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.results.errors.forEach(error => console.log(`  - ${error}`));
        }
        
        const passedTests = Object.values(this.results).filter(Boolean).length - 1; // -1 for errors array
        const totalTests = Object.keys(this.results).length - 1; // -1 for errors array
        console.log(`\n📊 Tests Passed: ${passedTests}/${totalTests}`);
    }
}

// Run tests if called directly
if (require.main === module) {
    const token = process.argv[2] || '69007e1afca27db9569ee7124c0dbd0aea792007c205b4df3555b6b3cbeb8d787c0760cd62f7c0b725d62f1e9950c7a09fb34bf8c462a9f9fe7c05213e2041c3';
    const port = process.argv[3] || 3333;
    
    const client = new WebSocketTestClient(port, token);
    client.testWebSocket().then(() => {
        client.printResults();
        process.exit(0);
    }).catch(error => {
        console.error('Test suite failed:', error);
        process.exit(1);
    });
}

module.exports = WebSocketTestClient;