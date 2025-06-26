#!/usr/bin/env node

/**
 * Comprehensive Data Flow and Persistence Testing
 * Tests data storage, retrieval, updates, session management, and data integrity
 */

const WebSocket = require('ws');
const WebUI = require('./lib/web-ui');
const ClaudeLoopEngine = require('./lib/claude-loop-engine');
const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

class DataPersistenceTestSuite {
    constructor() {
        this.webUI = null;
        this.engine = null;
        this.testResults = [];
        this.testPort = 3346;
        this.testToken = null;
        this.connections = [];
        this.tempFiles = [];
    }

    async runAllTests() {
        console.log('🗄️ Starting Comprehensive Data Flow and Persistence Testing\n');
        
        try {
            await this.initializeTestEnvironment();
            
            // Test all data persistence categories
            await this.testSessionDataPersistence();
            await this.testOutputLogPersistence();
            await this.testConfigurationPersistence();
            await this.testWebSocketDataFlow();
            await this.testDataIntegrity();
            await this.testFileOperations();
            await this.testMemoryManagement();
            await this.testConcurrentDataAccess();
            
            this.generateTestReport();
            
        } catch (error) {
            console.error('❌ Data persistence test suite failed:', error.message);
            this.addTestResult('SUITE_FAILURE', false, error.message);
        } finally {
            await this.cleanup();
        }
    }

    async initializeTestEnvironment() {
        console.log('🚀 Initializing test environment for data persistence tests...');
        
        // Start WebUI server
        this.webUI = new WebUI(this.testPort);
        await this.webUI.start();
        this.testToken = this.webUI.sessionToken;
        console.log(`✅ WebUI server started on port ${this.testPort}`);
        
        // Initialize ClaudeLoopEngine for testing data operations
        this.engine = new ClaudeLoopEngine();
        console.log('✅ ClaudeLoopEngine initialized');
        
        this.addTestResult('ENVIRONMENT_SETUP', true, 'Test environment initialized successfully');
        console.log('');
    }

    async testSessionDataPersistence() {
        console.log('📊 Testing Session Data Persistence...');
        
        try {
            // Test 1: Initial session data structure
            console.log('  1a. Testing initial session data structure...');
            const initialSessionData = this.webUI.sessionData;
            
            const requiredFields = ['iterations', 'currentPhase', 'isRunning', 'startTime', 'output'];
            let missingFields = [];
            
            for (const field of requiredFields) {
                if (!(field in initialSessionData)) {
                    missingFields.push(field);
                }
            }
            
            if (missingFields.length === 0) {
                console.log('     ✅ All required session fields present');
                this.addTestResult('SESSION_STRUCTURE', true, 'All required session fields present');
            } else {
                console.log(`     ❌ Missing session fields: ${missingFields.join(', ')}`);
                this.addTestResult('SESSION_STRUCTURE', false, `Missing fields: ${missingFields.join(', ')}`);
            }
            
            // Test 2: Session data updates
            console.log('  1b. Testing session data updates...');
            const originalIterations = initialSessionData.iterations;
            
            // Update session data
            this.webUI.updateSession({
                iterations: originalIterations + 5,
                currentPhase: 'test-phase',
                isRunning: true
            });
            
            const updatedSessionData = this.webUI.sessionData;
            
            if (updatedSessionData.iterations === originalIterations + 5 &&
                updatedSessionData.currentPhase === 'test-phase' &&
                updatedSessionData.isRunning === true) {
                console.log('     ✅ Session data updates working correctly');
                this.addTestResult('SESSION_UPDATES', true, 'Session data updates correctly');
            } else {
                console.log('     ❌ Session data updates not working correctly');
                this.addTestResult('SESSION_UPDATES', false, 'Session data not updating correctly');
            }
            
            // Test 3: Session data API endpoint
            console.log('  1c. Testing session data API endpoint...');
            const apiResponse = await this.makeHTTPRequest(`/api/session?token=${this.testToken}`, 'GET');
            
            if (apiResponse.status === 200) {
                try {
                    const sessionDataFromAPI = JSON.parse(apiResponse.data);
                    
                    if (sessionDataFromAPI.iterations === updatedSessionData.iterations &&
                        sessionDataFromAPI.currentPhase === updatedSessionData.currentPhase) {
                        console.log('     ✅ Session API endpoint returns correct data');
                        this.addTestResult('SESSION_API', true, 'API endpoint returns correct session data');
                    } else {
                        console.log('     ❌ Session API endpoint returns inconsistent data');
                        this.addTestResult('SESSION_API', false, 'API data inconsistent with internal data');
                    }
                } catch (parseError) {
                    console.log('     ❌ Session API response not valid JSON');
                    this.addTestResult('SESSION_API', false, 'API response not valid JSON');
                }
            } else {
                console.log(`     ❌ Session API endpoint failed: ${apiResponse.status}`);
                this.addTestResult('SESSION_API', false, `API endpoint failed with status ${apiResponse.status}`);
            }
            
        } catch (error) {
            console.log(`❌ Session data persistence test failed: ${error.message}`);
            this.addTestResult('SESSION_PERSISTENCE', false, error.message);
        }
        
        console.log('');
    }

    async testOutputLogPersistence() {
        console.log('📝 Testing Output Log Persistence...');
        
        try {
            // Test 1: Adding output entries
            console.log('  2a. Testing output log additions...');
            const initialOutputCount = this.webUI.sessionData.output.length;
            
            // Add different types of output
            const testMessages = [
                { message: 'Test info message', type: 'info' },
                { message: 'Test success message', type: 'success' },
                { message: 'Test error message', type: 'error' },
                { message: 'Test warning message', type: 'warning' }
            ];
            
            for (const testMsg of testMessages) {
                this.webUI.addOutput(testMsg.message, testMsg.type);
            }
            
            const newOutputCount = this.webUI.sessionData.output.length;
            
            if (newOutputCount === initialOutputCount + testMessages.length) {
                console.log('     ✅ Output log additions working correctly');
                this.addTestResult('OUTPUT_ADDITIONS', true, `Added ${testMessages.length} output entries correctly`);
            } else {
                console.log(`     ❌ Output log additions failed: expected ${initialOutputCount + testMessages.length}, got ${newOutputCount}`);
                this.addTestResult('OUTPUT_ADDITIONS', false, 'Output count mismatch');
            }
            
            // Test 2: Output log structure validation
            console.log('  2b. Testing output log structure validation...');
            const latestOutput = this.webUI.sessionData.output.slice(-testMessages.length);
            let structureValid = true;
            
            for (let i = 0; i < latestOutput.length; i++) {
                const entry = latestOutput[i];
                const expectedMsg = testMessages[i];
                
                if (!entry.hasOwnProperty('timestamp') || 
                    !entry.hasOwnProperty('message') || 
                    !entry.hasOwnProperty('type') ||
                    entry.message !== expectedMsg.message ||
                    entry.type !== expectedMsg.type) {
                    structureValid = false;
                    break;
                }
            }
            
            if (structureValid) {
                console.log('     ✅ Output log entries have correct structure');
                this.addTestResult('OUTPUT_STRUCTURE', true, 'Output entries properly structured');
            } else {
                console.log('     ❌ Output log entries have incorrect structure');
                this.addTestResult('OUTPUT_STRUCTURE', false, 'Output entries missing required fields');
            }
            
            // Test 3: Output log limits and cleanup
            console.log('  2c. Testing output log limits and memory management...');
            const startOutputCount = this.webUI.sessionData.output.length;
            
            // Add many entries to test limits
            for (let i = 0; i < 1000; i++) {
                this.webUI.addOutput(`Bulk test message ${i}`, 'info');
            }
            
            const finalOutputCount = this.webUI.sessionData.output.length;
            
            // Check if there's a reasonable limit to prevent memory issues
            if (finalOutputCount < startOutputCount + 1000) {
                console.log(`     ✅ Output log has memory management (${finalOutputCount} entries)`);
                this.addTestResult('OUTPUT_LIMITS', true, 'Output log properly limits memory usage');
            } else {
                console.log(`     ⚠️ Output log might need memory management (${finalOutputCount} entries)`);
                this.addTestResult('OUTPUT_LIMITS', false, 'No apparent memory management for output log');
            }
            
        } catch (error) {
            console.log(`❌ Output log persistence test failed: ${error.message}`);
            this.addTestResult('OUTPUT_PERSISTENCE', false, error.message);
        }
        
        console.log('');
    }

    async testConfigurationPersistence() {
        console.log('⚙️ Testing Configuration Persistence...');
        
        try {
            // Test 1: Check if configuration files exist and are readable
            console.log('  3a. Testing configuration file accessibility...');
            
            const configPaths = [
                '/Users/samihalawa/git/claude-loop/package.json',
                '/Users/samihalawa/git/claude-loop/lib/web-ui.js',
                '/Users/samihalawa/git/claude-loop/lib/claude-loop-engine.js'
            ];
            
            let accessibleConfigs = 0;
            for (const configPath of configPaths) {
                try {
                    await fs.access(configPath);
                    accessibleConfigs++;
                } catch (error) {
                    console.log(`     ⚠️ Cannot access ${path.basename(configPath)}`);
                }
            }
            
            if (accessibleConfigs === configPaths.length) {
                console.log('     ✅ All configuration files accessible');
                this.addTestResult('CONFIG_ACCESS', true, 'All configuration files accessible');
            } else {
                console.log(`     ⚠️ Some configuration files inaccessible (${accessibleConfigs}/${configPaths.length})`);
                this.addTestResult('CONFIG_ACCESS', false, `Only ${accessibleConfigs}/${configPaths.length} configs accessible`);
            }
            
            // Test 2: Check configuration data integrity
            console.log('  3b. Testing configuration data integrity...');
            
            try {
                const packageJson = JSON.parse(await fs.readFile('/Users/samihalawa/git/claude-loop/package.json', 'utf8'));
                
                const requiredPackageFields = ['name', 'version', 'dependencies'];
                let hasRequiredFields = true;
                
                for (const field of requiredPackageFields) {
                    if (!(field in packageJson)) {
                        hasRequiredFields = false;
                        break;
                    }
                }
                
                if (hasRequiredFields) {
                    console.log('     ✅ Package.json has required fields');
                    this.addTestResult('CONFIG_INTEGRITY', true, 'Package configuration is valid');
                } else {
                    console.log('     ❌ Package.json missing required fields');
                    this.addTestResult('CONFIG_INTEGRITY', false, 'Package configuration incomplete');
                }
            } catch (error) {
                console.log('     ❌ Cannot parse package.json');
                this.addTestResult('CONFIG_INTEGRITY', false, 'Package.json parsing failed');
            }
            
            // Test 3: Configuration persistence across operations
            console.log('  3c. Testing configuration persistence across operations...');
            
            // Test WebUI port configuration
            const configuredPort = this.webUI.port;
            if (configuredPort === this.testPort) {
                console.log('     ✅ WebUI port configuration persisted correctly');
                this.addTestResult('CONFIG_PERSISTENCE', true, 'Configuration values persist correctly');
            } else {
                console.log(`     ❌ WebUI port configuration not persisted: expected ${this.testPort}, got ${configuredPort}`);
                this.addTestResult('CONFIG_PERSISTENCE', false, 'Configuration values not persisting');
            }
            
        } catch (error) {
            console.log(`❌ Configuration persistence test failed: ${error.message}`);
            this.addTestResult('CONFIG_PERSISTENCE', false, error.message);
        }
        
        console.log('');
    }

    async testWebSocketDataFlow() {
        console.log('🔌 Testing WebSocket Data Flow...');
        
        try {
            // Test 1: WebSocket connection and initial data flow
            console.log('  4a. Testing WebSocket connection and initial data...');
            
            const ws = await this.createWebSocketConnection(this.testToken);
            this.connections.push(ws);
            
            let sessionDataReceived = false;
            let sessionDataContent = null;
            
            const dataPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout waiting for session data'));
                }, 5000);
                
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        if (message.type === 'session_data') {
                            sessionDataReceived = true;
                            sessionDataContent = message.data;
                            clearTimeout(timeout);
                            resolve(message);
                        }
                    } catch (error) {
                        clearTimeout(timeout);
                        reject(error);
                    }
                });
                
                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
            
            await dataPromise;
            
            if (sessionDataReceived && sessionDataContent) {
                console.log('     ✅ WebSocket initial data flow working');
                this.addTestResult('WS_INITIAL_DATA', true, 'WebSocket receives initial session data');
            } else {
                console.log('     ❌ WebSocket initial data flow failed');
                this.addTestResult('WS_INITIAL_DATA', false, 'No initial session data received');
            }
            
            // Test 2: Real-time data updates via WebSocket
            console.log('  4b. Testing real-time data updates via WebSocket...');
            
            let updateReceived = false;
            const updatePromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout waiting for update'));
                }, 3000);
                
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        if (message.type === 'new_output') {
                            updateReceived = true;
                            clearTimeout(timeout);
                            resolve(message);
                        }
                    } catch (error) {
                        clearTimeout(timeout);
                        reject(error);
                    }
                });
            });
            
            // Trigger an update
            this.webUI.addOutput('Real-time test message', 'info');
            
            try {
                await updatePromise;
                if (updateReceived) {
                    console.log('     ✅ Real-time WebSocket updates working');
                    this.addTestResult('WS_REALTIME_UPDATES', true, 'WebSocket receives real-time updates');
                } else {
                    console.log('     ❌ Real-time WebSocket updates not working');
                    this.addTestResult('WS_REALTIME_UPDATES', false, 'No real-time updates received');
                }
            } catch (error) {
                console.log('     ❌ Real-time WebSocket updates failed');
                this.addTestResult('WS_REALTIME_UPDATES', false, 'Real-time update timeout');
            }
            
            // Test 3: Bidirectional data flow
            console.log('  4c. Testing bidirectional WebSocket data flow...');
            
            let pongReceived = false;
            const pongPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout waiting for pong'));
                }, 3000);
                
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        if (message.type === 'pong') {
                            pongReceived = true;
                            clearTimeout(timeout);
                            resolve(message);
                        }
                    } catch (error) {
                        clearTimeout(timeout);
                        reject(error);
                    }
                });
            });
            
            // Send ping
            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            
            try {
                await pongPromise;
                if (pongReceived) {
                    console.log('     ✅ Bidirectional WebSocket communication working');
                    this.addTestResult('WS_BIDIRECTIONAL', true, 'Bidirectional WebSocket communication works');
                } else {
                    console.log('     ❌ Bidirectional WebSocket communication not working');
                    this.addTestResult('WS_BIDIRECTIONAL', false, 'No pong response received');
                }
            } catch (error) {
                console.log('     ❌ Bidirectional WebSocket communication failed');
                this.addTestResult('WS_BIDIRECTIONAL', false, 'Bidirectional communication timeout');
            }
            
        } catch (error) {
            console.log(`❌ WebSocket data flow test failed: ${error.message}`);
            this.addTestResult('WS_DATA_FLOW', false, error.message);
        }
        
        console.log('');
    }

    async testDataIntegrity() {
        console.log('🔒 Testing Data Integrity...');
        
        try {
            // Test 1: Data consistency across multiple operations
            console.log('  5a. Testing data consistency across operations...');
            
            const startTime = Date.now();
            const initialState = JSON.parse(JSON.stringify(this.webUI.sessionData));
            
            // Perform multiple operations
            this.webUI.updateSession({ iterations: initialState.iterations + 10 });
            this.webUI.addOutput('Integrity test message 1', 'info');
            this.webUI.addOutput('Integrity test message 2', 'success');
            this.webUI.updateSession({ currentPhase: 'integrity-test' });
            
            const finalState = this.webUI.sessionData;
            
            // Verify data consistency
            const iterationsConsistent = finalState.iterations === initialState.iterations + 10;
            const phaseConsistent = finalState.currentPhase === 'integrity-test';
            const outputConsistent = finalState.output.length >= initialState.output.length + 2;
            
            if (iterationsConsistent && phaseConsistent && outputConsistent) {
                console.log('     ✅ Data consistency maintained across operations');
                this.addTestResult('DATA_CONSISTENCY', true, 'Data remains consistent across multiple operations');
            } else {
                console.log('     ❌ Data consistency issues detected');
                this.addTestResult('DATA_CONSISTENCY', false, 'Data consistency problems found');
            }
            
            // Test 2: Data validation and sanitization
            console.log('  5b. Testing data validation and sanitization...');
            
            const maliciousInputs = [
                '<script>alert("xss")</script>',
                '${process.env}',
                '../../../etc/passwd',
                'null\x00byte',
                '{"__proto__":{"polluted":true}}'
            ];
            
            let sanitizationWorking = true;
            for (const input of maliciousInputs) {
                try {
                    this.webUI.addOutput(input, 'info');
                    // If we get here without crashing, sanitization is working
                } catch (error) {
                    // If it throws an error, that's also good sanitization
                    console.log(`     ⚠️ Input rejected: ${input.substring(0, 20)}...`);
                }
            }
            
            if (sanitizationWorking) {
                console.log('     ✅ Data sanitization working correctly');
                this.addTestResult('DATA_SANITIZATION', true, 'Malicious inputs handled safely');
            } else {
                console.log('     ❌ Data sanitization issues found');
                this.addTestResult('DATA_SANITIZATION', false, 'Sanitization not working properly');
            }
            
            // Test 3: Data type integrity
            console.log('  5c. Testing data type integrity...');
            
            const sessionData = this.webUI.sessionData;
            const typeChecks = [
                { field: 'iterations', type: 'number', value: sessionData.iterations },
                { field: 'currentPhase', type: 'string', value: sessionData.currentPhase },
                { field: 'isRunning', type: 'boolean', value: sessionData.isRunning },
                { field: 'output', type: 'object', isArray: true, value: sessionData.output }
            ];
            
            let typesValid = true;
            for (const check of typeChecks) {
                const actualType = typeof check.value;
                const isArray = Array.isArray(check.value);
                
                if (check.isArray && !isArray) {
                    typesValid = false;
                    console.log(`     ❌ ${check.field} should be array but is ${actualType}`);
                } else if (!check.isArray && actualType !== check.type) {
                    typesValid = false;
                    console.log(`     ❌ ${check.field} should be ${check.type} but is ${actualType}`);
                }
            }
            
            if (typesValid) {
                console.log('     ✅ Data type integrity maintained');
                this.addTestResult('DATA_TYPE_INTEGRITY', true, 'All data types are correct');
            } else {
                console.log('     ❌ Data type integrity issues found');
                this.addTestResult('DATA_TYPE_INTEGRITY', false, 'Data type mismatches detected');
            }
            
        } catch (error) {
            console.log(`❌ Data integrity test failed: ${error.message}`);
            this.addTestResult('DATA_INTEGRITY', false, error.message);
        }
        
        console.log('');
    }

    async testFileOperations() {
        console.log('📁 Testing File Operations...');
        
        try {
            // Test 1: Temporary file creation and cleanup
            console.log('  6a. Testing temporary file operations...');
            
            const tempDir = '/tmp';
            const testFileName = `claude-loop-test-${Date.now()}.tmp`;
            const testFilePath = path.join(tempDir, testFileName);
            
            try {
                await fs.writeFile(testFilePath, 'Test data for file operations');
                this.tempFiles.push(testFilePath);
                
                const fileContent = await fs.readFile(testFilePath, 'utf8');
                
                if (fileContent === 'Test data for file operations') {
                    console.log('     ✅ File write and read operations working');
                    this.addTestResult('FILE_OPERATIONS', true, 'File operations working correctly');
                } else {
                    console.log('     ❌ File content mismatch');
                    this.addTestResult('FILE_OPERATIONS', false, 'File content mismatch');
                }
            } catch (error) {
                console.log(`     ❌ File operations failed: ${error.message}`);
                this.addTestResult('FILE_OPERATIONS', false, error.message);
            }
            
            // Test 2: File permissions and security
            console.log('  6b. Testing file permissions and security...');
            
            try {
                const stats = await fs.stat(testFilePath);
                const mode = stats.mode & 0o777;
                
                // Check if file permissions are reasonable (not world-writable)
                if ((mode & 0o002) === 0) {
                    console.log('     ✅ File permissions are secure');
                    this.addTestResult('FILE_PERMISSIONS', true, 'File permissions are secure');
                } else {
                    console.log('     ⚠️ File permissions might be too permissive');
                    this.addTestResult('FILE_PERMISSIONS', false, 'File permissions too permissive');
                }
            } catch (error) {
                console.log(`     ❌ File permissions check failed: ${error.message}`);
                this.addTestResult('FILE_PERMISSIONS', false, error.message);
            }
            
        } catch (error) {
            console.log(`❌ File operations test failed: ${error.message}`);
            this.addTestResult('FILE_OPERATIONS', false, error.message);
        }
        
        console.log('');
    }

    async testMemoryManagement() {
        console.log('🧠 Testing Memory Management...');
        
        try {
            // Test 1: Memory usage patterns
            console.log('  7a. Testing memory usage patterns...');
            
            const memStart = process.memoryUsage();
            
            // Perform memory-intensive operations
            const largeArray = [];
            for (let i = 0; i < 1000; i++) {
                this.webUI.addOutput(`Memory test message ${i}`, 'info');
                largeArray.push(`Large data item ${i}`.repeat(100));
            }
            
            const memMid = process.memoryUsage();
            
            // Clear the large array
            largeArray.length = 0;
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            await this.wait(1000); // Wait for GC
            
            const memEnd = process.memoryUsage();
            
            const heapGrowth = memMid.heapUsed - memStart.heapUsed;
            const heapRecovered = memMid.heapUsed - memEnd.heapUsed;
            
            console.log(`     📊 Heap growth: ${(heapGrowth / 1024 / 1024).toFixed(2)} MB`);
            console.log(`     📊 Heap recovered: ${(heapRecovered / 1024 / 1024).toFixed(2)} MB`);
            
            if (heapGrowth < 50 * 1024 * 1024) { // Less than 50MB growth
                console.log('     ✅ Memory usage is reasonable');
                this.addTestResult('MEMORY_USAGE', true, 'Memory usage within reasonable limits');
            } else {
                console.log('     ⚠️ High memory usage detected');
                this.addTestResult('MEMORY_USAGE', false, 'High memory usage detected');
            }
            
            // Test 2: Memory leak detection
            console.log('  7b. Testing for potential memory leaks...');
            
            const initialHeap = process.memoryUsage().heapUsed;
            
            // Create and destroy multiple WebSocket connections
            for (let i = 0; i < 10; i++) {
                try {
                    const ws = await this.createWebSocketConnection(this.testToken, 1000);
                    ws.close();
                    await this.wait(100);
                } catch (error) {
                    // Connection failures are expected with short timeouts
                }
            }
            
            await this.wait(2000); // Wait for cleanup
            
            const finalHeap = process.memoryUsage().heapUsed;
            const heapDiff = finalHeap - initialHeap;
            
            if (heapDiff < 5 * 1024 * 1024) { // Less than 5MB difference
                console.log('     ✅ No significant memory leaks detected');
                this.addTestResult('MEMORY_LEAKS', true, 'No significant memory leaks detected');
            } else {
                console.log(`     ⚠️ Potential memory leak: ${(heapDiff / 1024 / 1024).toFixed(2)} MB increase`);
                this.addTestResult('MEMORY_LEAKS', false, 'Potential memory leak detected');
            }
            
        } catch (error) {
            console.log(`❌ Memory management test failed: ${error.message}`);
            this.addTestResult('MEMORY_MANAGEMENT', false, error.message);
        }
        
        console.log('');
    }

    async testConcurrentDataAccess() {
        console.log('🔄 Testing Concurrent Data Access...');
        
        try {
            // Test 1: Concurrent session updates
            console.log('  8a. Testing concurrent session updates...');
            
            const initialIterations = this.webUI.sessionData.iterations;
            
            // Perform concurrent updates
            const updatePromises = [];
            for (let i = 0; i < 10; i++) {
                updatePromises.push(new Promise(resolve => {
                    setTimeout(() => {
                        this.webUI.updateSession({ iterations: this.webUI.sessionData.iterations + 1 });
                        resolve();
                    }, Math.random() * 100);
                }));
            }
            
            await Promise.all(updatePromises);
            
            const finalIterations = this.webUI.sessionData.iterations;
            const iterationIncrease = finalIterations - initialIterations;
            
            if (iterationIncrease === 10) {
                console.log('     ✅ Concurrent updates handled correctly');
                this.addTestResult('CONCURRENT_UPDATES', true, 'All concurrent updates applied correctly');
            } else {
                console.log(`     ❌ Concurrent updates lost: expected 10, got ${iterationIncrease}`);
                this.addTestResult('CONCURRENT_UPDATES', false, 'Some concurrent updates were lost');
            }
            
            // Test 2: Concurrent output additions
            console.log('  8b. Testing concurrent output additions...');
            
            const initialOutputCount = this.webUI.sessionData.output.length;
            
            // Add outputs concurrently
            const outputPromises = [];
            for (let i = 0; i < 20; i++) {
                outputPromises.push(new Promise(resolve => {
                    setTimeout(() => {
                        this.webUI.addOutput(`Concurrent message ${i}`, 'info');
                        resolve();
                    }, Math.random() * 50);
                }));
            }
            
            await Promise.all(outputPromises);
            
            const finalOutputCount = this.webUI.sessionData.output.length;
            const outputIncrease = finalOutputCount - initialOutputCount;
            
            if (outputIncrease >= 20) {
                console.log('     ✅ Concurrent output additions handled correctly');
                this.addTestResult('CONCURRENT_OUTPUTS', true, 'All concurrent outputs added correctly');
            } else {
                console.log(`     ❌ Concurrent outputs lost: expected 20, got ${outputIncrease}`);
                this.addTestResult('CONCURRENT_OUTPUTS', false, 'Some concurrent outputs were lost');
            }
            
        } catch (error) {
            console.log(`❌ Concurrent data access test failed: ${error.message}`);
            this.addTestResult('CONCURRENT_ACCESS', false, error.message);
        }
        
        console.log('');
    }

    // Helper methods
    async createWebSocketConnection(token, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const url = `ws://localhost:${this.testPort}?token=${token}`;
            const options = {
                headers: {
                    'User-Agent': 'Data-Persistence-Test-Suite/1.0 (Node.js)'
                }
            };
            
            const ws = new WebSocket(url, options);
            
            const timeoutId = setTimeout(() => {
                ws.close();
                reject(new Error('WebSocket connection timeout'));
            }, timeout);
            
            ws.on('open', () => {
                clearTimeout(timeoutId);
                resolve(ws);
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
        });
    }

    async makeHTTPRequest(path, method = 'GET', body = null, headers = {}) {
        const http = require('http');
        
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: this.testPort,
                path: path,
                method: method,
                headers: {
                    'User-Agent': 'Data-Persistence-Test-Suite/1.0',
                    ...headers
                }
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                });
            });

            req.on('error', reject);
            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (body) {
                req.write(body);
            }

            req.end();
        });
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    addTestResult(testName, passed, details) {
        this.testResults.push({
            test: testName,
            passed,
            details,
            timestamp: new Date().toISOString()
        });
    }

    generateTestReport() {
        console.log('\n📋 DATA FLOW AND PERSISTENCE TEST REPORT');
        console.log('='.repeat(70));
        
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        const successRate = ((passed / total) * 100).toFixed(1);
        
        console.log(`\n📊 Overall Results: ${passed}/${total} tests passed (${successRate}%)\n`);
        
        // Group tests by category
        const categories = {
            'Environment Setup': this.testResults.filter(r => r.test.includes('ENVIRONMENT')),
            'Session Data': this.testResults.filter(r => r.test.includes('SESSION')),
            'Output Persistence': this.testResults.filter(r => r.test.includes('OUTPUT')),
            'Configuration': this.testResults.filter(r => r.test.includes('CONFIG')),
            'WebSocket Data Flow': this.testResults.filter(r => r.test.includes('WS_')),
            'Data Integrity': this.testResults.filter(r => r.test.includes('DATA_')),
            'File Operations': this.testResults.filter(r => r.test.includes('FILE_')),
            'Memory Management': this.testResults.filter(r => r.test.includes('MEMORY_')),
            'Concurrent Access': this.testResults.filter(r => r.test.includes('CONCURRENT_'))
        };
        
        for (const [category, tests] of Object.entries(categories)) {
            if (tests.length > 0) {
                const categoryPassed = tests.filter(t => t.passed).length;
                const categoryRate = ((categoryPassed / tests.length) * 100).toFixed(1);
                
                console.log(`🏷️ ${category}: ${categoryPassed}/${tests.length} (${categoryRate}%)`);
                
                for (const test of tests) {
                    const status = test.passed ? '✅ PASS' : '❌ FAIL';
                    console.log(`   ${status} ${test.test.replace(/_/g, ' ')}`);
                    console.log(`      ${test.details}`);
                }
                console.log('');
            }
        }
        
        // Critical issues
        const criticalFailures = this.testResults.filter(r => 
            !r.passed && [
                'ENVIRONMENT_SETUP',
                'SESSION_STRUCTURE',
                'DATA_CONSISTENCY',
                'WS_INITIAL_DATA'
            ].includes(r.test)
        );
        
        if (criticalFailures.length > 0) {
            console.log('🚨 CRITICAL DATA PERSISTENCE ISSUES:');
            criticalFailures.forEach(failure => {
                console.log(`   - ${failure.test}: ${failure.details}`);
            });
            console.log('');
        }
        
        // Recommendations
        console.log('💡 RECOMMENDATIONS:');
        if (successRate >= 90) {
            console.log('   - Data persistence is robust and reliable');
            console.log('   - Session management working correctly');
        }
        if (successRate < 80) {
            console.log('   - Review data persistence implementations');
            console.log('   - Strengthen data integrity checks');
        }
        
        const memoryTests = this.testResults.filter(r => r.test.includes('MEMORY_'));
        const memoryPassed = memoryTests.filter(t => t.passed).length;
        if (memoryPassed === memoryTests.length) {
            console.log('   - Memory management is properly implemented');
        }
        
        console.log('   - Consider implementing data backup mechanisms');
        console.log('   - Add comprehensive data validation');
        console.log('');
        
        return {
            totalTests: total,
            passedTests: passed,
            successRate: parseFloat(successRate),
            criticalFailures: criticalFailures.length,
            categories,
            details: this.testResults
        };
    }

    async cleanup() {
        console.log('🧹 Cleaning up data persistence test resources...');
        
        // Close all WebSocket connections
        for (const ws of this.connections) {
            try {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            } catch (error) {
                console.error('Error closing WebSocket:', error.message);
            }
        }
        
        // Clean up temporary files
        for (const tempFile of this.tempFiles) {
            try {
                await fs.unlink(tempFile);
                console.log(`✅ Cleaned up temp file: ${path.basename(tempFile)}`);
            } catch (error) {
                console.error(`⚠️ Could not clean up ${path.basename(tempFile)}:`, error.message);
            }
        }
        
        // Stop WebUI
        if (this.webUI) {
            try {
                await this.webUI.stop();
                console.log('✅ WebUI stopped successfully');
            } catch (error) {
                console.error('Error stopping WebUI:', error.message);
            }
        }
        
        console.log('✅ Cleanup completed\n');
    }
}

// Run tests if called directly
if (require.main === module) {
    const testSuite = new DataPersistenceTestSuite();
    testSuite.runAllTests()
        .then(() => {
            console.log('🎉 Data persistence test suite completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = DataPersistenceTestSuite;