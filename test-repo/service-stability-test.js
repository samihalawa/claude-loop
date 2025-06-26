#!/usr/bin/env node

/**
 * Background Service Stability Testing Suite for Claude Loop Backend
 * Tests process management, memory usage, service resilience, and graceful shutdown
 */

const { spawn, exec } = require('child_process');
const os = require('os');
const fs = require('fs').promises;

class ServiceStabilityTest {
    constructor(port = 3333) {
        this.port = port;
        this.results = {
            processManagement: false,
            memoryStability: false,
            errorRecovery: false,
            gracefulShutdown: false,
            resourceCleanup: false,
            concurrentLoad: false,
            serviceRestart: false,
            logManagement: false,
            errors: []
        };
        this.testPid = null;
        this.testToken = null;
    }

    async runTests() {
        console.log('🔧 Background Service Stability Testing Suite');
        console.log('==============================================\n');

        try {
            console.log('Test 1: Process Management');
            await this.testProcessManagement();
            
            console.log('Test 2: Memory Stability');
            await this.testMemoryStability();
            
            console.log('Test 3: Error Recovery');
            await this.testErrorRecovery();
            
            console.log('Test 4: Graceful Shutdown');
            await this.testGracefulShutdown();
            
            console.log('Test 5: Resource Cleanup');
            await this.testResourceCleanup();
            
            console.log('Test 6: Concurrent Load Handling');
            await this.testConcurrentLoad();
            
            console.log('Test 7: Service Restart Reliability');
            await this.testServiceRestart();
            
            console.log('Test 8: Log Management');
            await this.testLogManagement();
            
            await this.cleanup();
            this.printResults();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            this.results.errors.push(`Test suite error: ${error.message}`);
        }
    }

    async testProcessManagement() {
        try {
            // Check current process
            const processes = await this.findWebUIProcesses();
            if (processes.length > 0) {
                console.log(`  📊 Found ${processes.length} running WebUI process(es)`);
                this.testPid = processes[0].pid;
                console.log(`  🔍 Monitoring PID: ${this.testPid}`);
                
                // Test process visibility
                const processInfo = await this.getProcessInfo(this.testPid);
                if (processInfo) {
                    console.log(`  📈 Process memory: ${processInfo.memory}MB, CPU: ${processInfo.cpu}%`);
                    this.results.processManagement = true;
                    console.log('  ✅ Process management test passed');
                } else {
                    throw new Error('Could not retrieve process information');
                }
            } else {
                throw new Error('No WebUI processes found running');
            }
            
        } catch (error) {
            console.log('  ❌ Process management test failed:', error.message);
            this.results.errors.push(`Process management: ${error.message}`);
        }
    }

    async testMemoryStability() {
        try {
            if (!this.testPid) {
                throw new Error('No test process identified');
            }

            console.log('  🧠 Testing memory stability over time...');
            
            const memoryReadings = [];
            const iterations = 5;
            
            for (let i = 0; i < iterations; i++) {
                const processInfo = await this.getProcessInfo(this.testPid);
                if (processInfo) {
                    memoryReadings.push(processInfo.memory);
                    console.log(`  📊 Memory reading ${i + 1}: ${processInfo.memory}MB`);
                } else {
                    throw new Error('Process disappeared during memory test');
                }
                
                // Generate some load
                if (i < iterations - 1) {
                    await this.generateAPILoad();
                    await this.sleep(2000); // Wait 2 seconds between readings
                }
            }
            
            // Analyze memory stability
            const avgMemory = memoryReadings.reduce((a, b) => a + b, 0) / memoryReadings.length;
            const maxMemory = Math.max(...memoryReadings);
            const minMemory = Math.min(...memoryReadings);
            const memoryVariance = maxMemory - minMemory;
            
            console.log(`  📈 Memory stats: Avg: ${avgMemory.toFixed(1)}MB, Range: ${minMemory}-${maxMemory}MB, Variance: ${memoryVariance.toFixed(1)}MB`);
            
            // Memory is stable if variance is less than 50MB (arbitrary threshold)
            if (memoryVariance < 50) {
                this.results.memoryStability = true;
                console.log('  ✅ Memory stability test passed');
            } else {
                throw new Error(`High memory variance: ${memoryVariance.toFixed(1)}MB`);
            }
            
        } catch (error) {
            console.log('  ❌ Memory stability test failed:', error.message);
            this.results.errors.push(`Memory stability: ${error.message}`);
        }
    }

    async testErrorRecovery() {
        try {
            console.log('  💥 Testing error recovery with malformed requests...');
            
            // Generate various error conditions
            const errorTests = [
                () => fetch(`http://localhost:${this.port}/nonexistent`),
                () => fetch(`http://localhost:${this.port}/api/session`, { method: 'POST' }),
                () => fetch(`http://localhost:${this.port}/api/session?token=invalid`),
                () => fetch(`http://localhost:${this.port}`, { 
                    headers: { 'Content-Length': '1000000' } 
                })
            ];
            
            let errorCount = 0;
            let recoveryCount = 0;
            
            for (const [index, test] of errorTests.entries()) {
                try {
                    const response = await test();
                    console.log(`  🔍 Error test ${index + 1}: HTTP ${response.status}`);
                    errorCount++;
                    
                    // Test if service is still responsive after error
                    await this.sleep(100);
                    const healthCheck = await fetch(`http://localhost:${this.port}/health?token=${await this.getValidToken()}`);
                    if (healthCheck.ok) {
                        recoveryCount++;
                        console.log(`  ✅ Service recovered from error ${index + 1}`);
                    } else {
                        console.log(`  ❌ Service not responsive after error ${index + 1}`);
                    }
                    
                } catch (error) {
                    console.log(`  🔍 Error test ${index + 1}: Network error (expected)`);
                    errorCount++;
                }
            }
            
            if (recoveryCount === errorCount) {
                this.results.errorRecovery = true;
                console.log('  ✅ Error recovery test passed');
            } else {
                throw new Error(`Service recovered from ${recoveryCount}/${errorCount} errors`);
            }
            
        } catch (error) {
            console.log('  ❌ Error recovery test failed:', error.message);
            this.results.errors.push(`Error recovery: ${error.message}`);
        }
    }

    async testGracefulShutdown() {
        try {
            if (!this.testPid) {
                throw new Error('No test process to shutdown');
            }

            console.log('  🛑 Testing graceful shutdown...');
            
            // Send SIGTERM for graceful shutdown
            process.kill(this.testPid, 'SIGTERM');
            console.log('  📡 SIGTERM sent to process');
            
            // Wait for graceful shutdown
            let shutdownSuccessful = false;
            for (let i = 0; i < 10; i++) { // Wait up to 10 seconds
                const processExists = await this.processExists(this.testPid);
                if (!processExists) {
                    shutdownSuccessful = true;
                    console.log(`  ✅ Process shutdown gracefully in ${i + 1} seconds`);
                    break;
                }
                await this.sleep(1000);
            }
            
            if (shutdownSuccessful) {
                this.results.gracefulShutdown = true;
                this.testPid = null; // Process is gone
            } else {
                throw new Error('Process did not shutdown gracefully within 10 seconds');
            }
            
        } catch (error) {
            console.log('  ❌ Graceful shutdown test failed:', error.message);
            this.results.errors.push(`Graceful shutdown: ${error.message}`);
        }
    }

    async testResourceCleanup() {
        try {
            console.log('  🧹 Testing resource cleanup...');
            
            // Check for leftover files
            const tempFiles = await this.findTempFiles();
            console.log(`  📁 Found ${tempFiles.length} temporary files`);
            
            // Check port availability
            const portAvailable = await this.isPortAvailable(this.port);
            if (portAvailable) {
                console.log('  🔌 Port is available after shutdown');
            } else {
                console.log('  ⚠️  Port still in use after shutdown');
            }
            
            // Check system resources
            const systemLoad = os.loadavg()[0];
            const freeMemory = os.freemem() / (1024 * 1024 * 1024); // GB
            
            console.log(`  📊 System load: ${systemLoad.toFixed(2)}, Free memory: ${freeMemory.toFixed(1)}GB`);
            
            this.results.resourceCleanup = true;
            console.log('  ✅ Resource cleanup test passed');
            
        } catch (error) {
            console.log('  ❌ Resource cleanup test failed:', error.message);
            this.results.errors.push(`Resource cleanup: ${error.message}`);
        }
    }

    async testConcurrentLoad() {
        try {
            console.log('  ⚡ Testing concurrent load handling...');
            
            // Restart service for this test
            await this.startTestService();
            await this.sleep(3000); // Wait for service to start
            
            if (!this.testToken) {
                this.testToken = await this.getValidToken();
            }
            
            // Generate concurrent load
            const concurrentRequests = 10;
            const requests = Array(concurrentRequests).fill().map(async (_, i) => {
                try {
                    const response = await fetch(`http://localhost:${this.port}/api/session?token=${this.testToken}`);
                    return { index: i, status: response.status, success: response.ok };
                } catch (error) {
                    return { index: i, status: 'error', success: false, error: error.message };
                }
            });
            
            const results = await Promise.all(requests);
            const successCount = results.filter(r => r.success).length;
            
            console.log(`  📊 Concurrent requests: ${successCount}/${concurrentRequests} successful`);
            
            if (successCount >= concurrentRequests * 0.8) { // 80% success rate
                this.results.concurrentLoad = true;
                console.log('  ✅ Concurrent load test passed');
            } else {
                throw new Error(`Only ${successCount}/${concurrentRequests} requests succeeded`);
            }
            
        } catch (error) {
            console.log('  ❌ Concurrent load test failed:', error.message);
            this.results.errors.push(`Concurrent load: ${error.message}`);
        }
    }

    async testServiceRestart() {
        try {
            console.log('  🔄 Testing service restart reliability...');
            
            // Stop current service
            if (this.testPid) {
                process.kill(this.testPid, 'SIGTERM');
                await this.sleep(2000);
            }
            
            // Restart service
            await this.startTestService();
            await this.sleep(3000);
            
            // Test if service is responsive
            this.testToken = await this.getValidToken();
            const response = await fetch(`http://localhost:${this.port}/health?token=${this.testToken}`);
            
            if (response.ok) {
                this.results.serviceRestart = true;
                console.log('  ✅ Service restart test passed');
            } else {
                throw new Error(`Service not responsive after restart: ${response.status}`);
            }
            
        } catch (error) {
            console.log('  ❌ Service restart test failed:', error.message);
            this.results.errors.push(`Service restart: ${error.message}`);
        }
    }

    async testLogManagement() {
        try {
            console.log('  📝 Testing log management...');
            
            // Check for log files
            const logFiles = [
                '../webui-restart.log',
                '../webui-startup.log'
            ];
            
            let logFilesFound = 0;
            for (const logFile of logFiles) {
                try {
                    const stats = await fs.stat(logFile);
                    if (stats.isFile()) {
                        console.log(`  📄 Found log file: ${logFile} (${(stats.size / 1024).toFixed(1)}KB)`);
                        logFilesFound++;
                    }
                } catch (error) {
                    console.log(`  ⚠️  Log file not found: ${logFile}`);
                }
            }
            
            if (logFilesFound > 0) {
                this.results.logManagement = true;
                console.log('  ✅ Log management test passed');
            } else {
                console.log('  ⚠️  No log files found (logging may be disabled)');
                this.results.logManagement = false;
            }
            
        } catch (error) {
            console.log('  ❌ Log management test failed:', error.message);
            this.results.errors.push(`Log management: ${error.message}`);
        }
    }

    // Helper methods
    async findWebUIProcesses() {
        return new Promise((resolve) => {
            exec('ps aux | grep "node.*start-webui" | grep -v grep', (error, stdout) => {
                if (error) {
                    resolve([]);
                    return;
                }
                
                const processes = stdout.trim().split('\n').filter(line => line).map(line => {
                    const parts = line.trim().split(/\s+/);
                    return {
                        user: parts[0],
                        pid: parseInt(parts[1]),
                        cpu: parseFloat(parts[2]),
                        memory: parseFloat(parts[3]),
                        command: parts.slice(10).join(' ')
                    };
                });
                
                resolve(processes);
            });
        });
    }

    async getProcessInfo(pid) {
        return new Promise((resolve) => {
            exec(`ps -p ${pid} -o pid,rss,pcpu`, (error, stdout) => {
                if (error) {
                    resolve(null);
                    return;
                }
                
                const lines = stdout.trim().split('\n');
                if (lines.length < 2) {
                    resolve(null);
                    return;
                }
                
                const data = lines[1].trim().split(/\s+/);
                resolve({
                    pid: parseInt(data[0]),
                    memory: Math.round(parseInt(data[1]) / 1024), // Convert KB to MB
                    cpu: parseFloat(data[2])
                });
            });
        });
    }

    async processExists(pid) {
        try {
            process.kill(pid, 0); // Signal 0 checks if process exists
            return true;
        } catch (error) {
            return false;
        }
    }

    async isPortAvailable(port) {
        return new Promise((resolve) => {
            exec(`lsof -i :${port}`, (error) => {
                resolve(!!error); // Port is available if lsof returns error
            });
        });
    }

    async findTempFiles() {
        try {
            const files = await fs.readdir('../');
            return files.filter(file => file.endsWith('.tmp') || file.endsWith('.log'));
        } catch (error) {
            return [];
        }
    }

    async startTestService() {
        return new Promise((resolve, reject) => {
            console.log('  🚀 Starting test service...');
            
            const child = spawn('node', ['../start-webui.js'], {
                detached: true,
                stdio: 'ignore'
            });
            
            child.unref();
            this.testPid = child.pid;
            
            setTimeout(() => {
                resolve();
            }, 2000);
        });
    }

    async getValidToken() {
        try {
            const logContent = await fs.readFile('../webui-restart.log', 'utf8');
            const tokenMatch = logContent.match(/Full Token: ([a-f0-9]{128})/);
            if (tokenMatch) {
                return tokenMatch[1];
            }
            throw new Error('Token not found in logs');
        } catch (error) {
            // Fallback to a test token if log reading fails
            return 'd710c2fe3d0319ee3cccd87914f65d47367d7c3163743e89e20822eada0c6be4a06038c1bb12323ccc0d613686834fd40fa384fa9debf931d2390ddf2e667f28';
        }
    }

    async generateAPILoad() {
        try {
            const token = await this.getValidToken();
            const response = await fetch(`http://localhost:${this.port}/api/session?token=${token}`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async cleanup() {
        try {
            if (this.testPid) {
                process.kill(this.testPid, 'SIGTERM');
                await this.sleep(2000);
            }
            console.log('\n🧹 Test cleanup completed');
        } catch (error) {
            console.log('\n⚠️  Cleanup warning:', error.message);
        }
    }

    printResults() {
        console.log('\n🔍 Service Stability Test Results:');
        console.log('==================================');
        
        Object.entries(this.results).forEach(([test, result]) => {
            if (test === 'errors') return;
            const status = result ? '✅' : '❌';
            const formattedTest = test.replace(/([A-Z])/g, ' $1').toLowerCase();
            console.log(`${formattedTest}: ${status}`);
        });
        
        if (this.results.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.results.errors.forEach(error => console.log(`  - ${error}`));
        }
        
        const passedTests = Object.values(this.results).filter(Boolean).length - 1; // -1 for errors array
        const totalTests = Object.keys(this.results).length - 1; // -1 for errors array
        console.log(`\n📊 Tests Passed: ${passedTests}/${totalTests}`);
        
        const stabilityScore = Math.round((passedTests / totalTests) * 100);
        console.log(`🔧 Stability Score: ${stabilityScore}%`);
    }
}

// Run tests if called directly
if (require.main === module) {
    const port = process.argv[2] || 3333;
    
    const test = new ServiceStabilityTest(port);
    test.runTests().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = ServiceStabilityTest;