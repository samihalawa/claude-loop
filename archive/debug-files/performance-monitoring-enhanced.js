#!/usr/bin/env node

/**
 * Enhanced Performance Monitoring and Optimization Analysis
 * Tests for memory leaks, connection efficiency, and resource usage
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { spawn } = require('child_process');

class PerformanceMonitor {
    constructor() {
        this.results = {
            memoryTests: [],
            performanceMetrics: [],
            optimizationRecommendations: [],
            timestamp: new Date().toISOString()
        };
        this.initialMemory = process.memoryUsage();
    }

    log(message, type = 'info') {
        const colors = {
            info: '\x1b[36m',
            success: '\x1b[32m', 
            warning: '\x1b[33m',
            error: '\x1b[31m',
            perf: '\x1b[35m'
        };
        console.log(`${colors[type] || ''}[${type.toUpperCase()}] ${message}\x1b[0m`);
    }

    async testMemoryUsage() {
        this.log('🧠 Testing memory usage patterns', 'perf');
        
        const startMemory = process.memoryUsage();
        const startTime = performance.now();
        
        // Simulate WebSocket connection management memory usage
        const connections = new Map();
        const ipTracking = new Map();
        const messageQueues = new Map();
        
        try {
            // Simulate 1000 connection/disconnection cycles
            for (let i = 0; i < 1000; i++) {
                const ip = `192.168.${Math.floor(i / 255)}.${i % 255}`;
                const connectionId = `conn_${i}`;
                
                // Simulate connection tracking
                connections.set(connectionId, {
                    ip,
                    connectedAt: Date.now(),
                    lastActivity: Date.now(),
                    messageCount: 0
                });
                
                // Simulate IP tracking
                if (!ipTracking.has(ip)) {
                    ipTracking.set(ip, []);
                }
                ipTracking.get(ip).push(Date.now());
                
                // Simulate message queue
                messageQueues.set(connectionId, []);
                
                // Simulate cleanup every 100 connections
                if (i % 100 === 0) {
                    const cutoff = Date.now() - 60000; // 1 minute ago
                    
                    // Clean up old IP tracking data
                    for (const [ip, attempts] of ipTracking.entries()) {
                        const recent = attempts.filter(time => time > cutoff);
                        if (recent.length === 0) {
                            ipTracking.delete(ip);
                        } else {
                            ipTracking.set(ip, recent);
                        }
                    }
                    
                    // Clean up old connections (simulate disconnections)
                    const oldConnections = Array.from(connections.entries())
                        .filter(([id, conn]) => conn.lastActivity < cutoff)
                        .slice(0, 10); // Remove 10 old connections
                    
                    oldConnections.forEach(([id]) => {
                        connections.delete(id);
                        messageQueues.delete(id);
                    });
                }
            }
            
            const endMemory = process.memoryUsage();
            const endTime = performance.now();
            
            const memoryDelta = {
                rss: endMemory.rss - startMemory.rss,
                heapUsed: endMemory.heapUsed - startMemory.heapUsed,
                heapTotal: endMemory.heapTotal - startMemory.heapTotal,
                external: endMemory.external - startMemory.external
            };
            
            const testResult = {
                test: 'connection_memory_management',
                duration: endTime - startTime,
                memoryDelta,
                finalMapSizes: {
                    connections: connections.size,
                    ipTracking: ipTracking.size,
                    messageQueues: messageQueues.size
                },
                memoryEfficiency: memoryDelta.heapUsed / (1024 * 1024) // MB
            };
            
            this.results.memoryTests.push(testResult);
            
            this.log(`Memory test completed in ${Math.round(testResult.duration)}ms`, 'success');
            this.log(`Memory usage: ${testResult.memoryEfficiency.toFixed(2)}MB increase`, 'info');
            this.log(`Final tracking sizes: ${JSON.stringify(testResult.finalMapSizes)}`, 'info');
            
            // Performance assessment
            if (testResult.memoryEfficiency < 10) {
                this.log('✓ Memory usage within acceptable limits', 'success');
            } else if (testResult.memoryEfficiency < 50) {
                this.log('⚠ Memory usage moderate, monitor for leaks', 'warning');
                this.results.optimizationRecommendations.push('Monitor memory usage patterns');
            } else {
                this.log('❌ High memory usage detected', 'error');
                this.results.optimizationRecommendations.push('Investigate memory leaks');
            }
            
        } catch (error) {
            this.log(`Memory test failed: ${error.message}`, 'error');
        }
    }

    async testConnectionEfficiency() {
        this.log('🔌 Testing connection handling efficiency', 'perf');
        
        const startTime = performance.now();
        
        // Simulate efficient connection pooling
        const connectionPool = {
            available: [],
            active: new Set(),
            maxSize: 5,
            
            acquire() {
                if (this.available.length > 0) {
                    const conn = this.available.pop();
                    this.active.add(conn);
                    return conn;
                }
                
                if (this.active.size < this.maxSize) {
                    const conn = { id: Date.now(), created: Date.now() };
                    this.active.add(conn);
                    return conn;
                }
                
                return null; // Pool exhausted
            },
            
            release(conn) {
                this.active.delete(conn);
                if (this.available.length < this.maxSize) {
                    this.available.push(conn);
                }
            }
        };
        
        let successfulAcquisitions = 0;
        let rejectedAcquisitions = 0;
        
        // Test pool efficiency
        for (let i = 0; i < 20; i++) {
            const conn = connectionPool.acquire();
            if (conn) {
                successfulAcquisitions++;
                // Simulate work
                setTimeout(() => connectionPool.release(conn), Math.random() * 100);
            } else {
                rejectedAcquisitions++;
            }
        }
        
        const endTime = performance.now();
        
        const efficiencyResult = {
            test: 'connection_pool_efficiency',
            duration: endTime - startTime,
            successfulAcquisitions,
            rejectedAcquisitions,
            poolUtilization: successfulAcquisitions / (successfulAcquisitions + rejectedAcquisitions),
            averagePoolSize: connectionPool.active.size
        };
        
        this.results.performanceMetrics.push(efficiencyResult);
        
        this.log(`Connection efficiency: ${(efficiencyResult.poolUtilization * 100).toFixed(1)}%`, 'info');
        
        if (efficiencyResult.poolUtilization > 0.8) {
            this.log('✓ High connection efficiency', 'success');
        } else {
            this.log('⚠ Connection efficiency could be improved', 'warning');
            this.results.optimizationRecommendations.push('Optimize connection pooling');
        }
    }

    async testRateLimitingEfficiency() {
        this.log('⏱️ Testing rate limiting efficiency', 'perf');
        
        const startTime = performance.now();
        
        // Simulate rate limiting with efficient cleanup
        const rateLimiter = {
            requests: new Map(),
            windowSize: 60000, // 1 minute
            maxRequests: 30,
            
            isAllowed(ip) {
                const now = Date.now();
                const windowStart = now - this.windowSize;
                
                if (!this.requests.has(ip)) {
                    this.requests.set(ip, []);
                }
                
                const requests = this.requests.get(ip);
                const recentRequests = requests.filter(time => time > windowStart);
                
                if (recentRequests.length >= this.maxRequests) {
                    return false;
                }
                
                recentRequests.push(now);
                this.requests.set(ip, recentRequests);
                return true;
            },
            
            cleanup() {
                const now = Date.now();
                const windowStart = now - this.windowSize;
                
                for (const [ip, requests] of this.requests.entries()) {
                    const recentRequests = requests.filter(time => time > windowStart);
                    if (recentRequests.length === 0) {
                        this.requests.delete(ip);
                    } else {
                        this.requests.set(ip, recentRequests);
                    }
                }
            }
        };
        
        let allowedRequests = 0;
        let blockedRequests = 0;
        
        // Test rate limiting with different IPs
        for (let i = 0; i < 100; i++) {
            const ip = `192.168.1.${i % 10}`; // 10 different IPs
            
            if (rateLimiter.isAllowed(ip)) {
                allowedRequests++;
            } else {
                blockedRequests++;
            }
            
            // Simulate cleanup every 20 requests
            if (i % 20 === 0) {
                rateLimiter.cleanup();
            }
        }
        
        const endTime = performance.now();
        
        const rateLimitResult = {
            test: 'rate_limiting_efficiency',
            duration: endTime - startTime,
            allowedRequests,
            blockedRequests,
            blockingEffectiveness: blockedRequests / (allowedRequests + blockedRequests),
            trackedIPs: rateLimiter.requests.size
        };
        
        this.results.performanceMetrics.push(rateLimitResult);
        
        this.log(`Rate limiting: ${allowedRequests} allowed, ${blockedRequests} blocked`, 'info');
        this.log(`Blocking effectiveness: ${(rateLimitResult.blockingEffectiveness * 100).toFixed(1)}%`, 'info');
        
        if (rateLimitResult.blockingEffectiveness > 0.3) {
            this.log('✓ Rate limiting working effectively', 'success');
        } else {
            this.log('⚠ Rate limiting may need tuning', 'warning');
            this.results.optimizationRecommendations.push('Fine-tune rate limiting parameters');
        }
    }

    async testFileOperationPerformance() {
        this.log('📁 Testing file operation efficiency', 'perf');
        
        const startTime = performance.now();
        const tempDir = path.join(__dirname, 'temp-perf-test');
        
        try {
            // Create temp directory if it doesn't exist
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const fileOperations = [];
            
            // Test file creation/deletion efficiency
            for (let i = 0; i < 50; i++) {
                const filePath = path.join(tempDir, `test-file-${i}.tmp`);
                const content = `Test content ${i} - ${Date.now()}`;
                
                const opStart = performance.now();
                
                // Create file
                fs.writeFileSync(filePath, content);
                
                // Read file
                const readContent = fs.readFileSync(filePath, 'utf8');
                
                // Delete file
                fs.unlinkSync(filePath);
                
                const opEnd = performance.now();
                
                fileOperations.push({
                    operation: `file_${i}`,
                    duration: opEnd - opStart,
                    contentMatch: content === readContent
                });
            }
            
            // Clean up temp directory
            fs.rmSync(tempDir, { recursive: true, force: true });
            
            const endTime = performance.now();
            
            const avgDuration = fileOperations.reduce((sum, op) => sum + op.duration, 0) / fileOperations.length;
            const allMatched = fileOperations.every(op => op.contentMatch);
            
            const fileResult = {
                test: 'file_operation_performance',
                totalDuration: endTime - startTime,
                averageOperationTime: avgDuration,
                operationsPerSecond: 1000 / avgDuration,
                dataIntegrity: allMatched
            };
            
            this.results.performanceMetrics.push(fileResult);
            
            this.log(`File operations: ${fileResult.operationsPerSecond.toFixed(1)} ops/sec`, 'info');
            this.log(`Data integrity: ${allMatched ? 'PASS' : 'FAIL'}`, allMatched ? 'success' : 'error');
            
            if (fileResult.operationsPerSecond > 100) {
                this.log('✓ File operations performing well', 'success');
            } else {
                this.log('⚠ File operations may be slow', 'warning');
                this.results.optimizationRecommendations.push('Optimize file I/O operations');
            }
            
        } catch (error) {
            this.log(`File operation test failed: ${error.message}`, 'error');
        }
    }

    async analyzeCurrentImplementation() {
        this.log('🔍 Analyzing current security and performance implementation', 'perf');
        
        const analysis = {
            securityFeatures: [],
            performanceFeatures: [],
            recommendations: []
        };
        
        // Check if critical files exist and analyze them
        const criticalFiles = [
            './lib/web-ui.js',
            './lib/utils/performance-optimizer.js',
            './lib/utils/network-helper.js',
            './lib/utils/temp-file-manager.js',
            './lib/config/constants.js'
        ];
        
        for (const file of criticalFiles) {
            try {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    const lines = content.split('\n').length;
                    
                    // Analyze security features
                    const securityPatterns = [
                        { pattern: /timingSafeEqual|timingSafeTokenCompare/g, feature: 'Timing-safe token comparison' },
                        { pattern: /sanitize|sanitization/g, feature: 'Input sanitization' },
                        { pattern: /Content-Security-Policy/g, feature: 'CSP headers' },
                        { pattern: /X-Frame-Options/g, feature: 'Clickjacking protection' },
                        { pattern: /rate.*limit/gi, feature: 'Rate limiting' },
                        { pattern: /crypto\.randomBytes/g, feature: 'Secure random generation' },
                        { pattern: /verifyClient/g, feature: 'WebSocket client verification' }
                    ];
                    
                    securityPatterns.forEach(({ pattern, feature }) => {
                        if (pattern.test(content)) {
                            analysis.securityFeatures.push(feature);
                        }
                    });
                    
                    // Analyze performance features
                    const performancePatterns = [
                        { pattern: /debounce|throttle/g, feature: 'Function throttling/debouncing' },
                        { pattern: /memoize|cache/g, feature: 'Caching/memoization' },
                        { pattern: /pool|pooling/g, feature: 'Object pooling' },
                        { pattern: /cleanup|clear/g, feature: 'Resource cleanup' },
                        { pattern: /performance|benchmark/g, feature: 'Performance monitoring' },
                        { pattern: /memory.*usage/g, feature: 'Memory usage tracking' }
                    ];
                    
                    performancePatterns.forEach(({ pattern, feature }) => {
                        if (pattern.test(content)) {
                            analysis.performanceFeatures.push(feature);
                        }
                    });
                    
                    this.log(`Analyzed ${file}: ${lines} lines`, 'info');
                } else {
                    this.log(`Missing critical file: ${file}`, 'warning');
                    analysis.recommendations.push(`Create missing file: ${file}`);
                }
            } catch (error) {
                this.log(`Error analyzing ${file}: ${error.message}`, 'error');
            }
        }
        
        this.results.implementationAnalysis = analysis;
        
        this.log(`Security features found: ${analysis.securityFeatures.length}`, 'info');
        this.log(`Performance features found: ${analysis.performanceFeatures.length}`, 'info');
        
        // Generate recommendations based on analysis
        if (analysis.securityFeatures.length < 5) {
            analysis.recommendations.push('Implement additional security measures');
        }
        if (analysis.performanceFeatures.length < 4) {
            analysis.recommendations.push('Add more performance optimizations');
        }
        
        this.results.optimizationRecommendations.push(...analysis.recommendations);
    }

    generateReport() {
        this.log('\n📊 PERFORMANCE AND OPTIMIZATION REPORT', 'perf');
        this.log('=' .repeat(60), 'info');
        
        const finalMemory = process.memoryUsage();
        const totalMemoryDelta = finalMemory.heapUsed - this.initialMemory.heapUsed;
        
        this.log(`\nMemory Analysis:`, 'info');
        this.log(`- Initial memory: ${Math.round(this.initialMemory.heapUsed / 1024 / 1024)}MB`, 'info');
        this.log(`- Final memory: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`, 'info');
        this.log(`- Total delta: ${Math.round(totalMemoryDelta / 1024)}KB`, 'info');
        
        this.log(`\nPerformance Tests Completed: ${this.results.performanceMetrics.length}`, 'info');
        this.log(`Memory Tests Completed: ${this.results.memoryTests.length}`, 'info');
        
        if (this.results.implementationAnalysis) {
            this.log(`\nImplementation Analysis:`, 'info');
            this.log(`- Security features: ${this.results.implementationAnalysis.securityFeatures.length}`, 'info');
            this.log(`- Performance features: ${this.results.implementationAnalysis.performanceFeatures.length}`, 'info');
        }
        
        if (this.results.optimizationRecommendations.length > 0) {
            this.log(`\n🔧 Optimization Recommendations:`, 'warning');
            this.results.optimizationRecommendations.forEach((rec, i) => {
                this.log(`${i + 1}. ${rec}`, 'warning');
            });
        } else {
            this.log(`\n✅ No optimization recommendations - system appears well optimized!`, 'success');
        }
        
        // Overall assessment
        const overallScore = this.calculateOverallScore();
        this.log(`\n🎯 Overall Performance Score: ${overallScore}/100`, overallScore > 80 ? 'success' : overallScore > 60 ? 'warning' : 'error');
        
        return this.results;
    }

    calculateOverallScore() {
        let score = 100;
        
        // Deduct points for recommendations
        score -= this.results.optimizationRecommendations.length * 10;
        
        // Deduct points for failed tests
        const failedMemoryTests = this.results.memoryTests.filter(test => test.memoryEfficiency > 20).length;
        score -= failedMemoryTests * 15;
        
        // Bonus points for good implementation
        if (this.results.implementationAnalysis) {
            score += Math.min(this.results.implementationAnalysis.securityFeatures.length * 2, 20);
            score += Math.min(this.results.implementationAnalysis.performanceFeatures.length * 3, 30);
        }
        
        return Math.max(0, Math.min(100, score));
    }

    async runAllTests() {
        this.log('🚀 Starting Enhanced Performance Monitoring Suite', 'perf');
        
        try {
            await this.testMemoryUsage();
            await this.testConnectionEfficiency();
            await this.testRateLimitingEfficiency();
            await this.testFileOperationPerformance();
            await this.analyzeCurrentImplementation();
            
            return this.generateReport();
            
        } catch (error) {
            this.log(`Performance test suite failed: ${error.message}`, 'error');
            throw error;
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const monitor = new PerformanceMonitor();
    
    monitor.runAllTests()
        .then(results => {
            console.log('\n✅ Performance monitoring completed');
            
            // Save results to file
            const resultsPath = path.join(__dirname, 'performance-analysis-results.json');
            fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
            console.log(`📄 Results saved to: ${resultsPath}`);
            
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Performance monitoring failed:', error.message);
            process.exit(1);
        });
}

module.exports = PerformanceMonitor;