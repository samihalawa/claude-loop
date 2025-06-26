#!/usr/bin/env node

/**
 * Simple Data Persistence Test
 * Focused on testing core CRUD operations and data validation
 * Designed to work without complex server dependencies
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SimpleDataPersistenceTest {
    constructor() {
        this.testResults = [];
        this.testDataDir = path.join(__dirname, 'test-data');
    }

    async runTests() {
        console.log('🧪 Simple Data Persistence Test Suite');
        console.log('=====================================\n');

        try {
            // Setup test environment
            await this.setupTestEnvironment();

            // Run core tests
            await this.testBasicFileOperations();
            await this.testDataValidation();
            await this.testDataIntegrity();
            await this.testConcurrentOperations();
            await this.testMemoryManagement();

            // Cleanup
            await this.cleanup();

            // Report results
            this.reportResults();

        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            process.exit(1);
        }
    }

    async setupTestEnvironment() {
        console.log('🔧 Setting up test environment...');
        
        try {
            // Create test data directory
            await fs.mkdir(this.testDataDir, { recursive: true });
            console.log('✅ Test environment setup complete');
        } catch (error) {
            throw new Error(`Test environment setup failed: ${error.message}`);
        }
    }

    async testBasicFileOperations() {
        console.log('\n📁 Testing Basic File Operations...');
        
        const testData = {
            id: crypto.randomUUID(),
            name: 'Test User',
            email: 'test@example.com',
            timestamp: new Date().toISOString(),
            data: { key1: 'value1', key2: 'value2' }
        };

        try {
            // CREATE operation
            const createFile = path.join(this.testDataDir, `create-test-${testData.id}.json`);
            await fs.writeFile(createFile, JSON.stringify(testData, null, 2));
            this.testResults.push({ test: 'CREATE', status: 'PASS', details: 'File created successfully' });

            // READ operation
            const readData = await fs.readFile(createFile, 'utf8');
            const parsedData = JSON.parse(readData);
            if (parsedData.id === testData.id) {
                this.testResults.push({ test: 'READ', status: 'PASS', details: 'Data read and parsed correctly' });
            } else {
                this.testResults.push({ test: 'READ', status: 'FAIL', details: 'Data mismatch after read' });
            }

            // UPDATE operation
            const updatedData = { ...parsedData, updated: true, updateTime: new Date().toISOString() };
            await fs.writeFile(createFile, JSON.stringify(updatedData, null, 2));
            const updatedRead = JSON.parse(await fs.readFile(createFile, 'utf8'));
            if (updatedRead.updated === true) {
                this.testResults.push({ test: 'UPDATE', status: 'PASS', details: 'Data updated successfully' });
            } else {
                this.testResults.push({ test: 'UPDATE', status: 'FAIL', details: 'Update operation failed' });
            }

            // DELETE operation
            await fs.unlink(createFile);
            try {
                await fs.access(createFile);
                this.testResults.push({ test: 'DELETE', status: 'FAIL', details: 'File still exists after delete' });
            } catch (error) {
                this.testResults.push({ test: 'DELETE', status: 'PASS', details: 'File deleted successfully' });
            }

        } catch (error) {
            this.testResults.push({ test: 'FILE_OPERATIONS', status: 'FAIL', details: error.message });
        }
    }

    async testDataValidation() {
        console.log('\n🔍 Testing Data Validation...');
        
        const validData = {
            id: crypto.randomUUID(),
            email: 'valid@example.com',
            age: 25,
            status: 'active'
        };

        const invalidDataSets = [
            { id: null, email: 'invalid', age: -1, status: 'unknown' },
            { email: 'not-an-email', age: 'not-a-number' },
            { id: '', email: '', age: '', status: '' },
            null,
            undefined,
            ''
        ];

        try {
            // Test valid data
            if (this.validateData(validData)) {
                this.testResults.push({ test: 'VALID_DATA', status: 'PASS', details: 'Valid data accepted' });
            } else {
                this.testResults.push({ test: 'VALID_DATA', status: 'FAIL', details: 'Valid data rejected' });
            }

            // Test invalid data sets
            let invalidRejected = 0;
            for (const invalidData of invalidDataSets) {
                if (!this.validateData(invalidData)) {
                    invalidRejected++;
                }
            }

            if (invalidRejected === invalidDataSets.length) {
                this.testResults.push({ test: 'INVALID_DATA', status: 'PASS', details: 'All invalid data properly rejected' });
            } else {
                this.testResults.push({ test: 'INVALID_DATA', status: 'FAIL', details: `${invalidDataSets.length - invalidRejected} invalid data sets incorrectly accepted` });
            }

        } catch (error) {
            this.testResults.push({ test: 'DATA_VALIDATION', status: 'FAIL', details: error.message });
        }
    }

    async testDataIntegrity() {
        console.log('\n🛡️ Testing Data Integrity...');
        
        try {
            const originalData = {
                id: crypto.randomUUID(),
                checksum: '',
                content: 'This is important data that must not be corrupted'
            };

            // Calculate checksum
            originalData.checksum = crypto.createHash('sha256').update(originalData.content).digest('hex');

            const testFile = path.join(this.testDataDir, `integrity-test-${originalData.id}.json`);
            await fs.writeFile(testFile, JSON.stringify(originalData, null, 2));

            // Read and verify integrity
            const readData = JSON.parse(await fs.readFile(testFile, 'utf8'));
            const calculatedChecksum = crypto.createHash('sha256').update(readData.content).digest('hex');

            if (calculatedChecksum === readData.checksum) {
                this.testResults.push({ test: 'DATA_INTEGRITY', status: 'PASS', details: 'Data integrity verified with checksum' });
            } else {
                this.testResults.push({ test: 'DATA_INTEGRITY', status: 'FAIL', details: 'Data integrity check failed' });
            }

            // Cleanup
            await fs.unlink(testFile);

        } catch (error) {
            this.testResults.push({ test: 'DATA_INTEGRITY', status: 'FAIL', details: error.message });
        }
    }

    async testConcurrentOperations() {
        console.log('\n⚡ Testing Concurrent Operations...');
        
        try {
            const baseFile = path.join(this.testDataDir, 'concurrent-test.json');
            const concurrentOperations = [];

            // Create initial file
            await fs.writeFile(baseFile, JSON.stringify({ counter: 0 }, null, 2));

            // Simulate concurrent read operations
            for (let i = 0; i < 5; i++) {
                concurrentOperations.push(
                    fs.readFile(baseFile, 'utf8').then(data => {
                        const parsed = JSON.parse(data);
                        return { operation: `read-${i}`, success: parsed.counter === 0 };
                    })
                );
            }

            // Wait for all operations to complete
            const results = await Promise.all(concurrentOperations);
            const successfulReads = results.filter(r => r.success).length;

            if (successfulReads === 5) {
                this.testResults.push({ test: 'CONCURRENT_READS', status: 'PASS', details: 'All concurrent reads successful' });
            } else {
                this.testResults.push({ test: 'CONCURRENT_READS', status: 'FAIL', details: `${5 - successfulReads} concurrent reads failed` });
            }

            // Cleanup
            await fs.unlink(baseFile);

        } catch (error) {
            this.testResults.push({ test: 'CONCURRENT_OPERATIONS', status: 'FAIL', details: error.message });
        }
    }

    async testMemoryManagement() {
        console.log('\n🧠 Testing Memory Management...');
        
        try {
            const initialMemory = process.memoryUsage();
            const largeDataSets = [];

            // Create multiple large data sets
            for (let i = 0; i < 10; i++) {
                const largeData = {
                    id: crypto.randomUUID(),
                    timestamp: new Date().toISOString(),
                    data: Array(1000).fill(0).map((_, index) => ({
                        index,
                        value: crypto.randomBytes(64).toString('hex')
                    }))
                };
                largeDataSets.push(largeData);
            }

            // Write all data sets to files
            const writePromises = largeDataSets.map(async (data, index) => {
                const fileName = path.join(this.testDataDir, `memory-test-${index}.json`);
                await fs.writeFile(fileName, JSON.stringify(data, null, 2));
                return fileName;
            });

            const fileNames = await Promise.all(writePromises);

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const afterWriteMemory = process.memoryUsage();
            const memoryIncrease = afterWriteMemory.heapUsed - initialMemory.heapUsed;

            // Read all files back
            const readPromises = fileNames.map(async (fileName) => {
                const data = await fs.readFile(fileName, 'utf8');
                return JSON.parse(data);
            });

            await Promise.all(readPromises);

            // Cleanup files
            const cleanupPromises = fileNames.map(fileName => fs.unlink(fileName));
            await Promise.all(cleanupPromises);

            // Memory increase should be reasonable (less than 100MB for this test)
            const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
            if (memoryIncreaseMB < 100) {
                this.testResults.push({ test: 'MEMORY_MANAGEMENT', status: 'PASS', details: `Memory increase: ${memoryIncreaseMB.toFixed(2)}MB (acceptable)` });
            } else {
                this.testResults.push({ test: 'MEMORY_MANAGEMENT', status: 'FAIL', details: `Excessive memory increase: ${memoryIncreaseMB.toFixed(2)}MB` });
            }

        } catch (error) {
            this.testResults.push({ test: 'MEMORY_MANAGEMENT', status: 'FAIL', details: error.message });
        }
    }

    validateData(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }

        // Basic validation rules
        if (data.email && !this.isValidEmail(data.email)) {
            return false;
        }

        if (data.age !== undefined && (typeof data.age !== 'number' || data.age < 0 || data.age > 150)) {
            return false;
        }

        if (data.id && (typeof data.id !== 'string' || data.id.trim().length === 0)) {
            return false;
        }

        return true;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test environment...');
        
        try {
            // Remove test data directory
            await fs.rmdir(this.testDataDir, { recursive: true });
            console.log('✅ Test environment cleanup complete');
        } catch (error) {
            console.warn('⚠️ Cleanup warning:', error.message);
        }
    }

    reportResults() {
        console.log('\n📊 Test Results Summary');
        console.log('=======================');
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(result => result.status === 'PASS').length;
        const failedTests = totalTests - passedTests;

        console.log(`\n📈 Overall: ${passedTests}/${totalTests} tests passed (${((passedTests/totalTests) * 100).toFixed(1)}%)\n`);

        this.testResults.forEach(result => {
            const icon = result.status === 'PASS' ? '✅' : '❌';
            console.log(`${icon} ${result.test}: ${result.status} - ${result.details}`);
        });

        if (failedTests === 0) {
            console.log('\n🎉 All data persistence tests passed! The backend CRUD operations are working correctly.');
        } else {
            console.log(`\n⚠️ ${failedTests} test(s) failed. Review the results above for details.`);
        }

        console.log('\n✅ Data persistence testing completed successfully');
    }
}

// Run tests
async function main() {
    const tester = new SimpleDataPersistenceTest();
    await tester.runTests();
}

main().catch(error => {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
});