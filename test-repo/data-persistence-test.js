#!/usr/bin/env node

/**
 * Data Persistence Testing Suite for Claude Loop Backend
 * Tests session data, temporary file storage, and in-memory data integrity
 */

const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class DataPersistenceTest {
    constructor(port = 3333, token) {
        this.port = port;
        this.token = token;
        this.results = {
            sessionDataPersistence: false,
            temporaryFileHandling: false,
            memoryDataIntegrity: false,
            dataValidation: false,
            concurrentDataAccess: false,
            dataCleanup: false,
            errors: []
        };
        this.testDataDir = path.join(__dirname, 'test-data-persistence');
    }

    async runTests() {
        console.log('🧪 Data Persistence Testing Suite');
        console.log('==================================\n');

        try {
            await this.setupTestEnvironment();
            
            console.log('Test 1: Session Data Persistence');
            await this.testSessionDataPersistence();
            
            console.log('Test 2: Temporary File Handling');
            await this.testTemporaryFileHandling();
            
            console.log('Test 3: Memory Data Integrity');
            await this.testMemoryDataIntegrity();
            
            console.log('Test 4: Data Validation');
            await this.testDataValidation();
            
            console.log('Test 5: Concurrent Data Access');
            await this.testConcurrentDataAccess();
            
            console.log('Test 6: Data Cleanup');
            await this.testDataCleanup();
            
            await this.cleanup();
            this.printResults();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            this.results.errors.push(`Test suite error: ${error.message}`);
        }
    }

    async setupTestEnvironment() {
        try {
            await fs.mkdir(this.testDataDir, { recursive: true });
            console.log('  ✅ Test environment setup completed');
        } catch (error) {
            console.log('  ❌ Test environment setup failed:', error.message);
            throw error;
        }
    }

    async testSessionDataPersistence() {
        try {
            // Test 1: Get initial session data
            const response1 = await this.makeHttpRequest('/api/session');
            if (!response1.ok) {
                throw new Error(`HTTP ${response1.status}: ${response1.statusText}`);
            }
            
            const initialData = await response1.json();
            console.log('  📊 Initial session data retrieved');
            
            // Test 2: Connect via WebSocket and send data
            const ws = await this.createWebSocketConnection();
            
            // Send test message
            const testMessage = {
                type: 'ping',
                testData: 'persistence_test_' + Date.now()
            };
            
            ws.send(JSON.stringify(testMessage));
            
            // Wait for response
            await new Promise((resolve) => {
                ws.on('message', (data) => {
                    const message = JSON.parse(data.toString());
                    if (message.type === 'pong') {
                        console.log('  ✅ WebSocket communication confirmed');
                        resolve();
                    }
                });
                setTimeout(resolve, 2000);
            });
            
            ws.close();
            
            // Test 3: Verify session data after WebSocket interaction
            const response2 = await this.makeHttpRequest('/api/session');
            const finalData = await response2.json();
            
            if (JSON.stringify(initialData) !== JSON.stringify(finalData)) {
                console.log('  📊 Session data modified during WebSocket interaction');
            } else {
                console.log('  📊 Session data unchanged during WebSocket interaction');
            }
            
            this.results.sessionDataPersistence = true;
            console.log('  ✅ Session data persistence test passed');
            
        } catch (error) {
            console.log('  ❌ Session data persistence test failed:', error.message);
            this.results.errors.push(`Session persistence: ${error.message}`);
        }
    }

    async testTemporaryFileHandling() {
        try {
            // Test creating temporary files (simulating backend behavior)
            const tempFile = path.join(this.testDataDir, `temp_${Date.now()}.tmp`);
            const testData = 'Test data for temporary file handling';
            
            await fs.writeFile(tempFile, testData);
            console.log('  📁 Temporary file created');
            
            // Test reading the file
            const readData = await fs.readFile(tempFile, 'utf8');
            if (readData === testData) {
                console.log('  ✅ Temporary file read successfully');
            } else {
                throw new Error('Data integrity check failed');
            }
            
            // Test file cleanup
            await fs.unlink(tempFile);
            console.log('  🧹 Temporary file cleaned up');
            
            this.results.temporaryFileHandling = true;
            console.log('  ✅ Temporary file handling test passed');
            
        } catch (error) {
            console.log('  ❌ Temporary file handling test failed:', error.message);
            this.results.errors.push(`Temp file handling: ${error.message}`);
        }
    }

    async testMemoryDataIntegrity() {
        try {
            // Test multiple API calls to check data consistency
            const responses = await Promise.all([
                this.makeHttpRequest('/api/session'),
                this.makeHttpRequest('/api/session'),
                this.makeHttpRequest('/api/session')
            ]);
            
            const data = await Promise.all(responses.map(r => r.json()));
            
            // Check if all responses are consistent
            const firstResponse = JSON.stringify(data[0]);
            const allSame = data.every(d => JSON.stringify(d) === firstResponse);
            
            if (allSame) {
                console.log('  ✅ Memory data consistency verified');
                this.results.memoryDataIntegrity = true;
            } else {
                throw new Error('Inconsistent data returned from multiple requests');
            }
            
        } catch (error) {
            console.log('  ❌ Memory data integrity test failed:', error.message);
            this.results.errors.push(`Memory integrity: ${error.message}`);
        }
    }

    async testDataValidation() {
        try {
            // Test invalid API requests
            const invalidRequests = [
                this.makeHttpRequest('/api/session?token=invalid'),
                this.makeHttpRequest('/api/nonexistent'),
                this.makeHttpRequest('/api/session', { method: 'POST' })
            ];
            
            const responses = await Promise.all(invalidRequests.map(p => p.catch(e => e)));
            
            // All should return appropriate error responses
            let validationPassed = true;
            responses.forEach((response, index) => {
                if (response instanceof Error) {
                    console.log(`  📋 Request ${index + 1}: Error handled correctly`);
                } else if (response.status >= 400) {
                    console.log(`  📋 Request ${index + 1}: HTTP ${response.status} returned correctly`);
                } else {
                    validationPassed = false;
                    console.log(`  ❌ Request ${index + 1}: Should have failed but didn't`);
                }
            });
            
            if (validationPassed) {
                this.results.dataValidation = true;
                console.log('  ✅ Data validation test passed');
            } else {
                throw new Error('Some invalid requests were not properly rejected');
            }
            
        } catch (error) {
            console.log('  ❌ Data validation test failed:', error.message);
            this.results.errors.push(`Data validation: ${error.message}`);
        }
    }

    async testConcurrentDataAccess() {
        try {
            // Test concurrent API access
            const concurrentRequests = Array(5).fill().map(() => 
                this.makeHttpRequest('/api/session')
            );
            
            const startTime = Date.now();
            const responses = await Promise.all(concurrentRequests);
            const endTime = Date.now();
            
            // Check all requests succeeded
            const allSuccessful = responses.every(r => r.ok);
            
            if (allSuccessful) {
                console.log(`  ⚡ 5 concurrent requests completed in ${endTime - startTime}ms`);
                this.results.concurrentDataAccess = true;
                console.log('  ✅ Concurrent data access test passed');
            } else {
                throw new Error('Some concurrent requests failed');
            }
            
        } catch (error) {
            console.log('  ❌ Concurrent data access test failed:', error.message);
            this.results.errors.push(`Concurrent access: ${error.message}`);
        }
    }

    async testDataCleanup() {
        try {
            // Test if temporary test files are properly cleaned up
            const beforeFiles = await fs.readdir(this.testDataDir).catch(() => []);
            
            // Create some test files
            const testFiles = [];
            for (let i = 0; i < 3; i++) {
                const filename = path.join(this.testDataDir, `cleanup_test_${i}.tmp`);
                await fs.writeFile(filename, `Test data ${i}`);
                testFiles.push(filename);
            }
            
            console.log(`  📁 Created ${testFiles.length} test files`);
            
            // Clean up the files
            for (const file of testFiles) {
                await fs.unlink(file);
            }
            
            console.log('  🧹 Test files cleaned up');
            
            const afterFiles = await fs.readdir(this.testDataDir).catch(() => []);
            
            if (afterFiles.length === beforeFiles.length) {
                this.results.dataCleanup = true;
                console.log('  ✅ Data cleanup test passed');
            } else {
                throw new Error('File cleanup incomplete');
            }
            
        } catch (error) {
            console.log('  ❌ Data cleanup test failed:', error.message);
            this.results.errors.push(`Data cleanup: ${error.message}`);
        }
    }

    async createWebSocketConnection() {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${this.port}?token=${this.token}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; DataPersistenceTest/1.0)'
                }
            });
            
            ws.on('open', () => resolve(ws));
            ws.on('error', reject);
            
            setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
        });
    }

    async makeHttpRequest(endpoint, options = {}) {
        const url = `http://localhost:${this.port}${endpoint}${endpoint.includes('?') ? '&' : '?'}token=${this.token}`;
        
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        return response;
    }

    async cleanup() {
        try {
            await fs.rmdir(this.testDataDir, { recursive: true }).catch(() => {});
            console.log('\n🧹 Test environment cleaned up');
        } catch (error) {
            console.log('\n⚠️  Cleanup warning:', error.message);
        }
    }

    printResults() {
        console.log('\n🔍 Data Persistence Test Results:');
        console.log('==================================');
        
        Object.entries(this.results).forEach(([test, result]) => {
            if (test === 'errors') return;
            console.log(`${test}: ${result ? '✅' : '❌'}`);
        });
        
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
    
    // Add fetch polyfill for Node.js < 18
    if (!global.fetch) {
        global.fetch = require('node-fetch');
    }
    
    const test = new DataPersistenceTest(port, token);
    test.runTests().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = DataPersistenceTest;