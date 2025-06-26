/**
 * Time-based filtering utility for rate limiting and connection tracking
 * Eliminates duplicate time-window filtering logic throughout the application
 */

const { TIME_CONSTANTS } = require('../config/constants');
const logger = require('./unified-logger');

class TimeBasedFilter {
    constructor() {
        this.trackedData = new Map();
        this.cleanupIntervals = new Map();
        this.defaultWindowMs = 60000; // 1 minute
    }

    /**
     * Track an event for a given identifier
     * @param {string} identifier - Unique identifier (e.g., IP address)
     * @param {string} eventType - Type of event being tracked
     * @param {number} windowMs - Time window in milliseconds (optional)
     * @returns {number} - Current count of events in the time window
     */
    trackEvent(identifier, eventType = 'default', windowMs = this.defaultWindowMs) {
        const key = `${identifier}:${eventType}`;
        const now = Date.now();
        
        if (!this.trackedData.has(key)) {
            this.trackedData.set(key, []);
            this.setupCleanup(key, windowMs);
        }
        
        const events = this.trackedData.get(key);
        
        // Filter to only recent events
        const recentEvents = events.filter(timestamp => now - timestamp < windowMs);
        
        // Add current event
        recentEvents.push(now);
        
        // Update the tracked data
        this.trackedData.set(key, recentEvents);
        
        return recentEvents.length;
    }

    /**
     * Get current count of events for an identifier within the time window
     * @param {string} identifier - Unique identifier
     * @param {string} eventType - Type of event being tracked
     * @param {number} windowMs - Time window in milliseconds (optional)
     * @returns {number} - Current count of events
     */
    getEventCount(identifier, eventType = 'default', windowMs = this.defaultWindowMs) {
        const key = `${identifier}:${eventType}`;
        const now = Date.now();
        
        if (!this.trackedData.has(key)) {
            return 0;
        }
        
        const events = this.trackedData.get(key);
        return events.filter(timestamp => now - timestamp < windowMs).length;
    }

    /**
     * Check if an identifier has exceeded the rate limit
     * @param {string} identifier - Unique identifier
     * @param {string} eventType - Type of event being tracked
     * @param {number} maxEvents - Maximum allowed events
     * @param {number} windowMs - Time window in milliseconds (optional)
     * @returns {boolean} - True if rate limit exceeded
     */
    isRateLimited(identifier, eventType = 'default', maxEvents = 10, windowMs = this.defaultWindowMs) {
        const currentCount = this.getEventCount(identifier, eventType, windowMs);
        return currentCount >= maxEvents;
    }

    /**
     * Track an event and check if rate limited in one operation
     * @param {string} identifier - Unique identifier
     * @param {string} eventType - Type of event being tracked
     * @param {number} maxEvents - Maximum allowed events
     * @param {number} windowMs - Time window in milliseconds (optional)
     * @returns {Object} - { allowed: boolean, currentCount: number }
     */
    trackAndCheck(identifier, eventType = 'default', maxEvents = 10, windowMs = this.defaultWindowMs) {
        const currentCount = this.trackEvent(identifier, eventType, windowMs);
        return {
            allowed: currentCount <= maxEvents,
            currentCount: currentCount,
            remaining: Math.max(0, maxEvents - currentCount),
            resetTime: Date.now() + windowMs
        };
    }

    /**
     * Get recent events for debugging/monitoring
     * @param {string} identifier - Unique identifier
     * @param {string} eventType - Type of event being tracked
     * @param {number} windowMs - Time window in milliseconds (optional)
     * @returns {Array} - Array of timestamps
     */
    getRecentEvents(identifier, eventType = 'default', windowMs = this.defaultWindowMs) {
        const key = `${identifier}:${eventType}`;
        const now = Date.now();
        
        if (!this.trackedData.has(key)) {
            return [];
        }
        
        const events = this.trackedData.get(key);
        return events.filter(timestamp => now - timestamp < windowMs);
    }

    /**
     * Clean up old data for a specific key
     * @param {string} key - The tracking key
     * @param {number} windowMs - Time window in milliseconds
     */
    cleanupKey(key, windowMs) {
        if (!this.trackedData.has(key)) {
            return;
        }
        
        const now = Date.now();
        const events = this.trackedData.get(key);
        const recentEvents = events.filter(timestamp => now - timestamp < windowMs);
        
        if (recentEvents.length === 0) {
            this.trackedData.delete(key);
            // Clear cleanup interval if no more data
            if (this.cleanupIntervals.has(key)) {
                clearInterval(this.cleanupIntervals.get(key));
                this.cleanupIntervals.delete(key);
            }
        } else {
            this.trackedData.set(key, recentEvents);
        }
    }

    /**
     * Setup automatic cleanup for a tracking key
     * @param {string} key - The tracking key
     * @param {number} windowMs - Time window in milliseconds
     */
    setupCleanup(key, windowMs) {
        // Don't setup multiple intervals for the same key
        if (this.cleanupIntervals.has(key)) {
            return;
        }
        
        // Cleanup every window period or every minute, whichever is smaller
        const cleanupInterval = Math.min(windowMs, TIME_CONSTANTS.MILLISECONDS_PER_MINUTE);
        
        const intervalId = setInterval(() => {
            this.cleanupKey(key, windowMs);
        }, cleanupInterval);
        
        this.cleanupIntervals.set(key, intervalId);
    }

    /**
     * Clean up all expired data
     */
    cleanupAll() {
        const now = Date.now();
        const keysToDelete = [];
        
        for (const [key, events] of this.trackedData.entries()) {
            // Extract window from key or use default
            const [, eventType] = key.split(':');
            const windowMs = this.getWindowForEventType(eventType);
            
            const recentEvents = events.filter(timestamp => now - timestamp < windowMs);
            
            if (recentEvents.length === 0) {
                keysToDelete.push(key);
            } else {
                this.trackedData.set(key, recentEvents);
            }
        }
        
        keysToDelete.forEach(key => {
            this.trackedData.delete(key);
            if (this.cleanupIntervals.has(key)) {
                clearInterval(this.cleanupIntervals.get(key));
                this.cleanupIntervals.delete(key);
            }
        });
        
        return {
            cleanedKeys: keysToDelete.length,
            remainingKeys: this.trackedData.size
        };
    }

    /**
     * Get appropriate window size for event type
     * @param {string} eventType - Event type
     * @returns {number} - Window size in milliseconds
     */
    getWindowForEventType(eventType) {
        const windows = {
            'request': TIME_CONSTANTS.MILLISECONDS_PER_MINUTE, // 1 minute
            'connection': 5 * TIME_CONSTANTS.MILLISECONDS_PER_MINUTE, // 5 minutes
            'websocket': TIME_CONSTANTS.MILLISECONDS_PER_MINUTE, // 1 minute
            'default': this.defaultWindowMs
        };
        
        return windows[eventType] || windows['default'];
    }

    /**
     * Get statistics about tracked data
     * @returns {Object} - Statistics object
     */
    getStatistics() {
        const stats = {
            totalKeys: this.trackedData.size,
            totalEvents: 0,
            eventsByType: {},
            keysByIdentifier: {}
        };
        
        for (const [key, events] of this.trackedData.entries()) {
            const [identifier, eventType] = key.split(':');
            
            stats.totalEvents += events.length;
            
            if (!stats.eventsByType[eventType]) {
                stats.eventsByType[eventType] = 0;
            }
            stats.eventsByType[eventType] += events.length;
            
            if (!stats.keysByIdentifier[identifier]) {
                stats.keysByIdentifier[identifier] = 0;
            }
            stats.keysByIdentifier[identifier]++;
        }
        
        return stats;
    }

    /**
     * Reset all tracking data (useful for testing)
     */
    reset() {
        // Clear all intervals
        for (const intervalId of this.cleanupIntervals.values()) {
            clearInterval(intervalId);
        }
        
        this.trackedData.clear();
        this.cleanupIntervals.clear();
    }

    /**
     * Common rate limiting patterns
     */
    static patterns = {
        // HTTP requests per minute
        HTTP_REQUESTS: { maxEvents: 60, windowMs: TIME_CONSTANTS.MILLISECONDS_PER_MINUTE },
        
        // WebSocket connections per 5 minutes
        WS_CONNECTIONS: { maxEvents: 10, windowMs: 5 * TIME_CONSTANTS.MILLISECONDS_PER_MINUTE },
        
        // WebSocket messages per minute
        WS_MESSAGES: { maxEvents: 30, windowMs: TIME_CONSTANTS.MILLISECONDS_PER_MINUTE },
        
        // Login attempts per 15 minutes
        LOGIN_ATTEMPTS: { maxEvents: 5, windowMs: 15 * TIME_CONSTANTS.MILLISECONDS_PER_MINUTE }
    };
}

// Export singleton instance
module.exports = new TimeBasedFilter();