/**
 * Performance Optimization Utilities
 * Provides common performance optimization patterns used throughout the codebase
 */

const util = require('util');
const logger = require('./unified-logger');
const { PORTS, URL_PATTERNS, TEST_PORTS } = require('../config/constants');

class PerformanceOptimizer {
    constructor() {
        this.cacheMap = new Map();
        this.objectPool = new Map();
        this.managedIntervals = new Map();
    }

    /**
     * Efficient deep cloning for objects
     * @param {*} obj - Object to clone
     * @returns {*} Deep cloned object
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }

        if (obj instanceof Array) {
            return obj.map(item => this.deepClone(item));
        }

        if (typeof obj === 'object') {
            const cloned = {};
            for (const [key, value] of Object.entries(obj)) {
                // Prevent prototype pollution during cloning
                if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                    continue;
                }
                cloned[key] = this.deepClone(value);
            }
            return cloned;
        }

        return obj;
    }

    /**
     * Managed array operations with size limits
     * @param {Array} array - Target array
     * @param {*} item - Item to add
     * @param {number} maxSize - Maximum array size
     */
    managedArrayPush(array, item, maxSize = 100) {
        if (!Array.isArray(array)) {
            throw new Error('First argument must be an array');
        }

        array.push(item);

        // Efficiently trim array when it exceeds maxSize
        if (array.length > maxSize) {
            const removeCount = array.length - maxSize;
            array.splice(0, removeCount);
        }
    }

    /**
     * Memory-efficient string operations
     * @param {string} str - Input string
     * @param {number} maxLength - Maximum length
     * @returns {string} Truncated string
     */
    safeStringTruncate(str, maxLength = 1000) {
        if (typeof str !== 'string') {
            return String(str).substring(0, maxLength);
        }
        return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
    }

    /**
     * Efficient object pooling for reusable objects
     * @param {string} type - Object type
     * @param {Function} factory - Factory function to create new objects
     * @returns {*} Pooled object
     */
    getPooledObject(type, factory) {
        if (!this.objectPool.has(type)) {
            this.objectPool.set(type, []);
        }

        const pool = this.objectPool.get(type);
        return pool.length > 0 ? pool.pop() : factory();
    }

    /**
     * Return object to pool
     * @param {string} type - Object type
     * @param {*} obj - Object to return
     */
    returnToPool(type, obj) {
        if (!this.objectPool.has(type)) {
            this.objectPool.set(type, []);
        }

        const pool = this.objectPool.get(type);
        if (pool.length < 10) { // Limit pool size
            // Reset object state if it has a reset method
            if (obj && typeof obj.reset === 'function') {
                obj.reset();
            }
            pool.push(obj);
        }
    }

    /**
     * Memoization for expensive function calls
     * @param {Function} fn - Function to memoize
     * @param {number} maxCacheSize - Maximum cache size
     * @returns {Function} Memoized function
     */
    memoize(fn, maxCacheSize = 100) {
        const cache = new Map();

        return (...args) => {
            const key = JSON.stringify(args);

            if (cache.has(key)) {
                return cache.get(key);
            }

            const result = fn.apply(this, args);

            // Implement LRU cache behavior
            if (cache.size >= maxCacheSize) {
                const firstKey = cache.keys().next().value;
                cache.delete(firstKey);
            }

            cache.set(key, result);
            return result;
        };
    }

    /**
     * Debounce function calls for performance
     * @param {Function} fn - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(fn, delay = 300) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    /**
     * Throttle function calls
     * @param {Function} fn - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    throttle(fn, limit = 100) {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Efficient array operations
     * @param {Array} array - Input array
     * @param {Function} predicate - Filter predicate
     * @returns {Array} Filtered array
     */
    efficientFilter(array, predicate) {
        const result = [];
        for (let i = 0; i < array.length; i++) {
            if (predicate(array[i], i, array)) {
                result.push(array[i]);
            }
        }
        return result;
    }

    /**
     * Memory usage monitoring
     * @returns {Object} Memory usage statistics
     */
    getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            rss: Math.round(usage.rss / 1024 / 1024), // MB
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
            external: Math.round(usage.external / 1024 / 1024) // MB
        };
    }


    /**
     * Set a managed interval that can be cleaned up automatically
     * @param {Function} fn - Function to execute
     * @param {number} interval - Interval in milliseconds
     * @param {string} id - Unique identifier for the interval
     * @returns {NodeJS.Timeout} The interval ID
     */
    setManagedInterval(fn, interval, id) {
        // Clear existing interval if it exists
        if (this.managedIntervals.has(id)) {
            clearInterval(this.managedIntervals.get(id));
        }
        
        const intervalId = setInterval(fn, interval);
        this.managedIntervals.set(id, intervalId);
        return intervalId;
    }

    /**
     * Clear a managed interval
     * @param {string} id - Interval identifier
     */
    clearManagedInterval(id) {
        if (this.managedIntervals.has(id)) {
            clearInterval(this.managedIntervals.get(id));
            this.managedIntervals.delete(id);
        }
    }

    /**
     * Cleanup method to free resources
     */
    cleanup() {
        this.cacheMap.clear();
        this.objectPool.clear();
        
        // Clear all managed intervals
        for (const [id, intervalId] of this.managedIntervals.entries()) {
            clearInterval(intervalId);
        }
        this.managedIntervals.clear();
    }
}

// Export singleton instance
const performanceOptimizer = new PerformanceOptimizer();

module.exports = { PerformanceOptimizer, performanceOptimizer };