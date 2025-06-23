/**
 * Performance Monitoring and Optimization Utilities
 * Tracks performance metrics, identifies bottlenecks, and provides optimization insights
 */

const { Logger } = require('./logger');
const logger = new Logger(process.env.NODE_ENV === 'development');

class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.timers = new Map();
        this.counters = new Map();
        this.thresholds = {
            slowOperation: 1000, // 1 second
            memoryWarning: 100 * 1024 * 1024, // 100MB
            cpuWarning: 80, // 80% CPU usage
            connectionWarning: 50 // 50 connections
        };
        this.startTime = Date.now();
        this.intervalId = null;
        
        // Start periodic monitoring
        this.startMonitoring();
    }

    startTimer(label) {
        this.timers.set(label, {
            start: performance.now(),
            timestamp: Date.now()
        });
    }

    endTimer(label) {
        const timer = this.timers.get(label);
        if (!timer) {
            logger.warn(`Timer '${label}' not found`);
            return null;
        }

        const duration = performance.now() - timer.start;
        this.timers.delete(label);

        // Record the metric
        this.recordMetric(label, duration);

        // Log slow operations
        if (duration > this.thresholds.slowOperation) {
            logger.performance(`Slow operation detected: ${label}`, duration.toFixed(2));
        }

        return duration;
    }

    recordMetric(name, value, unit = 'ms') {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, {
                values: [],
                unit,
                total: 0,
                count: 0,
                min: Infinity,
                max: -Infinity,
                avg: 0
            });
        }

        const metric = this.metrics.get(name);
        metric.values.push({
            value,
            timestamp: Date.now()
        });

        // Keep only last 1000 values for memory efficiency
        if (metric.values.length > 1000) {
            metric.values.shift();
        }

        metric.total += value;
        metric.count++;
        metric.min = Math.min(metric.min, value);
        metric.max = Math.max(metric.max, value);
        metric.avg = metric.total / metric.count;
    }

    incrementCounter(name, amount = 1) {
        const current = this.counters.get(name) || 0;
        this.counters.set(name, current + amount);
    }

    getMetrics() {
        const systemMetrics = this.getSystemMetrics();
        const customMetrics = Object.fromEntries(this.metrics);
        const counters = Object.fromEntries(this.counters);

        return {
            system: systemMetrics,
            custom: customMetrics,
            counters,
            uptime: Date.now() - this.startTime
        };
    }

    getSystemMetrics() {
        const process = require('process');
        const os = require('os');
        
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        return {
            memory: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external,
                arrayBuffers: memUsage.arrayBuffers
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            system: {
                platform: os.platform(),
                arch: os.arch(),
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                loadAverage: os.loadavg(),
                cpuCount: os.cpus().length
            },
            process: {
                pid: process.pid,
                version: process.version,
                uptime: process.uptime()
            }
        };
    }

    checkMemoryUsage() {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        
        if (heapUsedMB > this.thresholds.memoryWarning) {
            logger.warn(`High memory usage detected: ${heapUsedMB.toFixed(2)}MB`);
            
            // Trigger garbage collection if available
            if (global.gc) {
                global.gc();
                logger.info('Garbage collection triggered');
            }
        }

        return {
            heapUsedMB,
            isWarning: heapUsedMB > this.thresholds.memoryWarning
        };
    }

    analyzePerformance() {
        const analysis = {
            slowOperations: [],
            memoryIssues: [],
            recommendations: []
        };

        // Analyze slow operations
        for (const [name, metric] of this.metrics.entries()) {
            if (metric.avg > this.thresholds.slowOperation) {
                analysis.slowOperations.push({
                    operation: name,
                    averageDuration: metric.avg,
                    maxDuration: metric.max,
                    count: metric.count
                });
            }
        }

        // Check memory usage
        const memCheck = this.checkMemoryUsage();
        if (memCheck.isWarning) {
            analysis.memoryIssues.push({
                type: 'high_heap_usage',
                value: memCheck.heapUsedMB,
                threshold: this.thresholds.memoryWarning / 1024 / 1024
            });
        }

        // Generate recommendations
        if (analysis.slowOperations.length > 0) {
            analysis.recommendations.push(
                'Consider optimizing slow operations or implementing caching'
            );
        }

        if (analysis.memoryIssues.length > 0) {
            analysis.recommendations.push(
                'Monitor memory usage and consider implementing memory cleanup routines'
            );
        }

        // Check for frequent errors
        const errorCount = this.counters.get('errors') || 0;
        if (errorCount > 10) {
            analysis.recommendations.push(
                'High error rate detected - review error handling and root causes'
            );
        }

        return analysis;
    }

    startMonitoring(intervalMs = 30000) { // 30 seconds
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }

        this.intervalId = setInterval(() => {
            this.checkMemoryUsage();
            this.recordSystemMetrics();
        }, intervalMs);
    }

    stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    recordSystemMetrics() {
        const metrics = this.getSystemMetrics();
        
        // Record key system metrics
        this.recordMetric('memory_heap_used', metrics.memory.heapUsed, 'bytes');
        this.recordMetric('memory_rss', metrics.memory.rss, 'bytes');
        this.recordMetric('system_free_memory', metrics.system.freeMemory, 'bytes');
        
        // Record load average (Unix systems)
        if (metrics.system.loadAverage && metrics.system.loadAverage[0] !== undefined) {
            this.recordMetric('system_load_1min', metrics.system.loadAverage[0], 'load');
        }
    }

    // Decorator function for timing method execution
    static timeOperation(label) {
        return function(target, propertyName, descriptor) {
            const method = descriptor.value;
            
            descriptor.value = async function(...args) {
                const monitor = this.performanceMonitor || globalMonitor;
                
                monitor.startTimer(label || `${target.constructor.name}.${propertyName}`);
                try {
                    const result = await method.apply(this, args);
                    return result;
                } finally {
                    monitor.endTimer(label || `${target.constructor.name}.${propertyName}`);
                }
            };
            
            return descriptor;
        };
    }

    // Wrapper for timing async functions
    static wrapAsyncFunction(fn, label) {
        return async function(...args) {
            const monitor = globalMonitor;
            const timerLabel = label || fn.name || 'anonymous_function';
            
            monitor.startTimer(timerLabel);
            try {
                return await fn.apply(this, args);
            } finally {
                monitor.endTimer(timerLabel);
            }
        };
    }

    // Memory leak detection
    detectMemoryLeaks() {
        const currentMetrics = this.getSystemMetrics();
        const heapHistory = this.metrics.get('memory_heap_used');
        
        if (!heapHistory || heapHistory.values.length < 10) {
            return { suspected: false, reason: 'Insufficient data' };
        }

        // Check if memory is consistently growing
        const recent = heapHistory.values.slice(-10);
        const isGrowing = recent.every((point, index) => {
            return index === 0 || point.value >= recent[index - 1].value;
        });

        const growthRate = (recent[recent.length - 1].value - recent[0].value) / recent.length;
        const suspectedLeak = isGrowing && growthRate > 1024 * 1024; // 1MB per sample

        return {
            suspected: suspectedLeak,
            reason: suspectedLeak ? `Consistent memory growth detected (${(growthRate / 1024 / 1024).toFixed(2)}MB per sample)` : 'No leak detected',
            currentHeap: currentMetrics.memory.heapUsed,
            growthRate
        };
    }

    generateReport() {
        const metrics = this.getMetrics();
        const analysis = this.analyzePerformance();
        const memoryLeakCheck = this.detectMemoryLeaks();

        const report = {
            timestamp: new Date().toISOString(),
            uptime: metrics.uptime,
            system: metrics.system,
            performance: {
                slowOperations: analysis.slowOperations,
                averageResponseTime: this.getAverageResponseTime(),
                operationCounts: metrics.counters
            },
            memory: {
                current: metrics.system.memory,
                leakDetection: memoryLeakCheck,
                issues: analysis.memoryIssues
            },
            recommendations: analysis.recommendations
        };

        logger.performance('Performance report generated', {
            slowOperations: analysis.slowOperations.length,
            memoryIssues: analysis.memoryIssues.length,
            recommendations: analysis.recommendations.length
        });

        return report;
    }

    getAverageResponseTime() {
        // Calculate average response time from HTTP-related metrics
        const httpMetrics = Array.from(this.metrics.entries())
            .filter(([name]) => name.includes('http') || name.includes('request'))
            .map(([, metric]) => metric.avg);
            
        if (httpMetrics.length === 0) return null;
        
        return httpMetrics.reduce((sum, avg) => sum + avg, 0) / httpMetrics.length;
    }

    cleanup() {
        this.stopMonitoring();
        this.metrics.clear();
        this.timers.clear();
        this.counters.clear();
    }
}

// Global instance
const globalMonitor = new PerformanceMonitor();

// Graceful shutdown
process.on('SIGTERM', () => {
    globalMonitor.cleanup();
});

process.on('SIGINT', () => {
    globalMonitor.cleanup();
});

module.exports = {
    PerformanceMonitor,
    monitor: globalMonitor
};