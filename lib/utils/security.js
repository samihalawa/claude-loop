/**
 * Security Utilities and Hardening
 * Provides security functions, input sanitization, and threat detection
 */

const crypto = require('crypto');
const { Logger } = require('./logger');
const { SECURITY, RATE_LIMITS } = require('../config/constants');
const logger = require('./unified-logger');

const logger = new Logger(process.env.NODE_ENV === 'development');

class SecurityManager {
    constructor() {
        this.suspiciousActivity = new Map();
        this.blockedIPs = new Set();
        this.rateLimitData = new Map();
        this.securityEvents = [];
        this.maxSecurityEvents = 1000;
        
        // Cleanup interval for security data
        setInterval(() => {
            this.cleanupSecurityData();
        }, 300000); // 5 minutes
    }

    // Token management
    generateSecureToken(length = SECURITY.TOKEN_BYTES) {
        return crypto.randomBytes(length).toString(SECURITY.CRYPTO_ENCODING);
    }

    hashToken(token, salt = null) {
        if (!salt) {
            salt = crypto.randomBytes(16).toString('hex');
        }
        const hash = crypto.pbkdf2Sync(token, salt, 10000, 64, 'sha512').toString('hex');
        return { hash, salt };
    }

    verifyToken(token, storedHash, salt) {
        const { hash } = this.hashToken(token, salt);
        return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
    }

    // Input sanitization
    sanitizeInput(input, options = {}) {
        const {
            allowHtml = false,
            maxLength = 10000,
            removeControlChars = true,
            removeScripts = true
        } = options;

        if (typeof input !== 'string') {
            return input;
        }

        let sanitized = input;

        // Remove control characters
        if (removeControlChars) {
            sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        }

        // Remove script tags and javascript protocols
        if (removeScripts) {
            sanitized = sanitized
                .replace(/<script[^>]*>.*?<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/data:[^;]*;[^,]*,.*<script/gi, '')
                .replace(/on\w+\s*=/gi, ''); // Remove event handlers
        }

        // Remove HTML if not allowed
        if (!allowHtml) {
            sanitized = sanitized.replace(/<[^>]*>/g, '');
        }

        // Limit length
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
            logger.security('Input truncated due to length limit', {
                originalLength: input.length,
                maxLength
            });
        }

        // Log if sanitization occurred
        if (sanitized !== input) {
            this.logSecurityEvent('input_sanitized', {
                originalLength: input.length,
                sanitizedLength: sanitized.length,
                changesDetected: true
            });
        }

        return sanitized;
    }

    // Command injection prevention
    validateCommand(command) {
        if (!command || typeof command !== 'string') {
            throw new Error('Command must be a non-empty string');
        }

        // Whitelist of allowed characters for commands
        const allowedPattern = /^[a-zA-Z0-9\-_./\s]+$/;
        if (!allowedPattern.test(command)) {
            this.logSecurityEvent('command_injection_attempt', {
                command: command.substring(0, 100),
                reason: 'Invalid characters detected'
            });
            throw new Error('Command contains invalid characters');
        }

        // Blacklist of dangerous patterns
        const dangerousPatterns = [
            /[;&|`$(){}[\]\\]/,  // Shell metacharacters
            /\.\./,              // Directory traversal
            /\/etc\/|\/proc\/|\/sys\//,  // System directories
            /rm\s+/,             // Remove commands
            /curl\s+/,           // Network requests
            /wget\s+/,           // Network requests
            /nc\s+/,             // Netcat
            /telnet\s+/,         // Telnet
            /ssh\s+/,            // SSH
            /eval\s+/,           // Code evaluation
            /exec\s+/            // Code execution
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(command)) {
                this.logSecurityEvent('command_injection_attempt', {
                    command: command.substring(0, 100),
                    pattern: pattern.toString(),
                    reason: 'Dangerous pattern detected'
                });
                throw new Error('Command contains potentially dangerous patterns');
            }
        }

        return command;
    }

    // Rate limiting
    checkRateLimit(identifier, limit = RATE_LIMITS.REQUESTS_PER_MINUTE, windowMs = RATE_LIMITS.RATE_LIMIT_WINDOW) {
        const now = Date.now();
        const windowStart = now - windowMs;

        if (!this.rateLimitData.has(identifier)) {
            this.rateLimitData.set(identifier, []);
        }

        const requests = this.rateLimitData.get(identifier);
        
        // Remove old requests outside the window
        const recentRequests = requests.filter(timestamp => timestamp > windowStart);
        this.rateLimitData.set(identifier, recentRequests);

        // Check if limit exceeded
        if (recentRequests.length >= limit) {
            this.logSecurityEvent('rate_limit_exceeded', {
                identifier,
                requestCount: recentRequests.length,
                limit,
                windowMs
            });
            return false;
        }

        // Add current request
        recentRequests.push(now);
        return true;
    }

    // Suspicious activity detection
    trackSuspiciousActivity(identifier, activity, severity = 'medium') {
        const now = Date.now();
        
        if (!this.suspiciousActivity.has(identifier)) {
            this.suspiciousActivity.set(identifier, {
                activities: [],
                score: 0,
                firstSeen: now,
                lastSeen: now
            });
        }

        const record = this.suspiciousActivity.get(identifier);
        record.activities.push({
            activity,
            severity,
            timestamp: now
        });
        record.lastSeen = now;

        // Calculate suspicion score
        const severityScores = { low: 1, medium: 3, high: 10 };
        record.score += severityScores[severity] || 1;

        // Check if activity should be blocked
        const shouldBlock = this.shouldBlockActivity(record);
        if (shouldBlock) {
            this.blockedIPs.add(identifier);
            this.logSecurityEvent('suspicious_activity_blocked', {
                identifier,
                score: record.score,
                activities: record.activities.length,
                duration: now - record.firstSeen
            });
        }

        return {
            blocked: shouldBlock,
            score: record.score,
            activities: record.activities.length
        };
    }

    shouldBlockActivity(record) {
        const now = Date.now();
        const recentWindow = 5 * 60 * 1000; // 5 minutes
        const recentActivities = record.activities.filter(
            activity => now - activity.timestamp <= recentWindow
        );

        // Block if too many recent activities or high score
        return (
            record.score >= 50 ||
            recentActivities.length >= 20 ||
            recentActivities.filter(a => a.severity === 'high').length >= 3
        );
    }

    isBlocked(identifier) {
        return this.blockedIPs.has(identifier);
    }

    unblockIP(identifier) {
        this.blockedIPs.delete(identifier);
        this.suspiciousActivity.delete(identifier);
        this.logSecurityEvent('ip_unblocked', { identifier });
    }

    // File path validation
    validateFilePath(filePath, allowedPaths = []) {
        const path = require('path');
        
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('File path must be a non-empty string');
        }

        // Resolve and normalize the path
        const resolved = path.resolve(filePath);
        const normalized = path.normalize(filePath);

        // Check for directory traversal
        if (normalized.includes('..') || filePath.includes('\x00')) {
            this.logSecurityEvent('path_traversal_attempt', {
                originalPath: filePath,
                resolvedPath: resolved
            });
            throw new Error('Path traversal attempt detected');
        }

        // Check against allowed paths
        if (allowedPaths.length > 0) {
            const isAllowed = allowedPaths.some(allowedPath => {
                const resolvedAllowed = path.resolve(allowedPath);
                return resolved.startsWith(resolvedAllowed);
            });

            if (!isAllowed) {
                this.logSecurityEvent('unauthorized_path_access', {
                    attemptedPath: resolved,
                    allowedPaths
                });
                throw new Error('Path not in allowed directories');
            }
        }

        return resolved;
    }

    // Content Security Policy headers
    getSecurityHeaders() {
        return {
            'Content-Security-Policy': [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com",
                "img-src 'self' data:",
                "connect-src 'self' ws: wss:",
                "object-src 'none'",
                "base-uri 'self'",
                "frame-ancestors 'none'"
            ].join('; '),
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
        };
    }

    // Security event logging
    logSecurityEvent(eventType, details = {}) {
        const event = {
            type: eventType,
            timestamp: new Date().toISOString(),
            details,
            id: crypto.randomUUID()
        };

        this.securityEvents.push(event);

        // Keep only recent events
        if (this.securityEvents.length > this.maxSecurityEvents) {
            this.securityEvents.shift();
        }

        // Log to console/file
        logger.security(`Security event: ${eventType}`, details);

        return event.id;
    }

    getSecurityEvents(limit = 100, type = null) {
        let events = this.securityEvents;
        
        if (type) {
            events = events.filter(event => event.type === type);
        }

        return events.slice(-limit);
    }

    // Cleanup old security data
    cleanupSecurityData() {
        const now = Date.now();
        const cleanupThreshold = 24 * 60 * 60 * 1000; // 24 hours

        // Clean up rate limit data
        for (const [identifier, requests] of this.rateLimitData.entries()) {
            const recentRequests = requests.filter(
                timestamp => now - timestamp <= cleanupThreshold
            );
            if (recentRequests.length === 0) {
                this.rateLimitData.delete(identifier);
            } else {
                this.rateLimitData.set(identifier, recentRequests);
            }
        }

        // Clean up suspicious activity data
        for (const [identifier, record] of this.suspiciousActivity.entries()) {
            if (now - record.lastSeen > cleanupThreshold) {
                this.suspiciousActivity.delete(identifier);
            }
        }

        logger.debug('Security data cleanup completed', {
            rateLimitEntries: this.rateLimitData.size,
            suspiciousActivityEntries: this.suspiciousActivity.size,
            blockedIPs: this.blockedIPs.size
        });
    }

    // Generate security report
    generateSecurityReport() {
        const now = Date.now();
        const last24Hours = now - (24 * 60 * 60 * 1000);

        const recentEvents = this.securityEvents.filter(
            event => new Date(event.timestamp).getTime() > last24Hours
        );

        const eventsByType = recentEvents.reduce((acc, event) => {
            acc[event.type] = (acc[event.type] || 0) + 1;
            return acc;
        }, {});

        return {
            timestamp: new Date().toISOString(),
            summary: {
                totalEvents: recentEvents.length,
                blockedIPs: this.blockedIPs.size,
                suspiciousActivities: this.suspiciousActivity.size,
                rateLimitViolations: eventsByType.rate_limit_exceeded || 0
            },
            eventsByType,
            topThreats: this.getTopThreats(),
            recommendations: this.getSecurityRecommendations()
        };
    }

    getTopThreats() {
        const threats = [];
        
        for (const [identifier, record] of this.suspiciousActivity.entries()) {
            if (record.score >= 10) {
                threats.push({
                    identifier,
                    score: record.score,
                    activities: record.activities.length,
                    lastSeen: new Date(record.lastSeen).toISOString()
                });
            }
        }

        return threats
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }

    getSecurityRecommendations() {
        const recommendations = [];

        if (this.blockedIPs.size > 10) {
            recommendations.push('High number of blocked IPs detected - review and consider implementing additional security measures');
        }

        if (this.securityEvents.filter(e => e.type === 'command_injection_attempt').length > 5) {
            recommendations.push('Multiple command injection attempts detected - review input validation');
        }

        if (this.securityEvents.filter(e => e.type === 'path_traversal_attempt').length > 3) {
            recommendations.push('Path traversal attempts detected - ensure file access is properly restricted');
        }

        return recommendations;
    }
}

// Global security manager instance
const securityManager = new SecurityManager();

module.exports = {
    SecurityManager,
    security: securityManager
};