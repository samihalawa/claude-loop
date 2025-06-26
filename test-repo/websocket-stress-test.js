#!/usr/bin/env node

const WebSocket = require('ws');

class WebSocketStressTest {
    constructor(port = 3333, token) {
        this.port = port;
        this.token = token;
        this.connections = [];
        this.messagesSent = 0;
        this.messagesReceived = 0;
        this.errors = [];
    }

    async runStressTest(numConnections = 3, messagesPerConnection = 5) {
        console.log(`🔥 WebSocket Stress Test: ${numConnections} connections, ${messagesPerConnection} messages each\n`);
        
        const promises = [];
        
        for (let i = 0; i < numConnections; i++) {
            promises.push(this.createTestConnection(i, messagesPerConnection));
        }
        
        try {
            await Promise.all(promises);
            this.printResults();
        } catch (error) {
            console.error('Stress test failed:', error);
            this.errors.push(error.message);
        }
        
        // Clean up
        this.connections.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        });
    }

    createTestConnection(connectionId, messageCount) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.port}?token=${this.token}`, {
                headers: {
                    'User-Agent': `Mozilla/5.0 (compatible; StressTestClient/${connectionId})`
                }
            });
            
            let messagesReceived = 0;
            let messagesSent = 0;
            
            ws.on('open', () => {
                console.log(`  ✅ Connection ${connectionId} established`);
                this.connections.push(ws);
                
                // Send test messages
                const sendMessage = () => {
                    if (messagesSent < messageCount) {
                        const message = JSON.stringify({
                            type: 'ping',
                            connectionId: connectionId,
                            messageId: messagesSent + 1,
                            timestamp: Date.now()
                        });
                        
                        ws.send(message);
                        messagesSent++;
                        this.messagesSent++;
                        
                        setTimeout(sendMessage, 100); // Send next message after 100ms
                    }
                };
                
                setTimeout(sendMessage, 100); // Start sending after connection is stable
            });
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    messagesReceived++;
                    this.messagesReceived++;
                    
                    if (messagesReceived >= messageCount) {
                        console.log(`  ✅ Connection ${connectionId} completed (${messagesReceived} messages received)`);
                        setTimeout(resolve, 100); // Small delay to ensure all processing is done
                    }
                } catch (error) {
                    this.errors.push(`Connection ${connectionId}: Invalid JSON - ${error.message}`);
                }
            });
            
            ws.on('close', (code, reason) => {
                if (messagesReceived < messageCount) {
                    console.log(`  ⚠️  Connection ${connectionId} closed early: ${code} - ${reason}`);
                }
            });
            
            ws.on('error', (error) => {
                console.log(`  ❌ Connection ${connectionId} error:`, error.message);
                this.errors.push(`Connection ${connectionId}: ${error.message}`);
                reject(error);
            });
            
            // Timeout after 10 seconds
            setTimeout(() => {
                if (messagesReceived < messageCount) {
                    console.log(`  ⏰ Connection ${connectionId} timeout`);
                    this.errors.push(`Connection ${connectionId}: Timeout`);
                    resolve(); // Don't reject on timeout, just complete
                }
            }, 10000);
        });
    }

    printResults() {
        console.log('\n🔍 Stress Test Results:');
        console.log('=======================');
        console.log(`Total Connections: ${this.connections.length}`);
        console.log(`Messages Sent: ${this.messagesSent}`);
        console.log(`Messages Received: ${this.messagesReceived}`);
        console.log(`Success Rate: ${this.messagesReceived > 0 ? Math.round((this.messagesReceived / this.messagesSent) * 100) : 0}%`);
        
        if (this.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.errors.forEach(error => console.log(`  - ${error}`));
        } else {
            console.log('\n✅ No errors detected');
        }
    }
}

// Run stress test if called directly
if (require.main === module) {
    const token = process.argv[2] || '69007e1afca27db9569ee7124c0dbd0aea792007c205b4df3555b6b3cbeb8d787c0760cd62f7c0b725d62f1e9950c7a09fb34bf8c462a9f9fe7c05213e2041c3';
    const numConnections = parseInt(process.argv[3]) || 3;
    const messagesPerConnection = parseInt(process.argv[4]) || 5;
    
    const stressTest = new WebSocketStressTest(3333, token);
    stressTest.runStressTest(numConnections, messagesPerConnection).then(() => {
        console.log('\n🏁 Stress test completed');
        process.exit(0);
    }).catch(error => {
        console.error('Stress test failed:', error);
        process.exit(1);
    });
}

module.exports = WebSocketStressTest;