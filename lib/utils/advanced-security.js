/**
 * Advanced Security Utilities
 * Enhanced security measures for comprehensive protection
 */

const crypto = require('crypto');
const { performance } = require('perf_hooks');
const logger = require('./unified-logger');
const { PORTS, URL_PATTERNS, TEST_PORTS } = require('../config/constants');

class AdvancedSecurity {
    constructor() {
        this.suspiciousPatterns = new Map();
        this.threatIntelligence = new Map();
        this.securityEvents = [];
        this.maxSecurityEvents = 1000;
        
        // Initialize threat detection patterns
        this.initializeThreatPatterns();
    }

    /**
     * Initialize threat detection patterns
     */
    initializeThreatPatterns() {
        this.threatPatterns = {
            xss: [
                /<script[^>]*>.*?<\/script>/gi,
                /javascript:/gi,
                /on\w+\s*=/gi,
                /<iframe[^>]*>.*?<\/iframe>/gi,
                /data:text\/html/gi,
                /vbscript:/gi
            ],
            sqlInjection: [
                /(\bunion\b.*\bselect\b)|(\bselect\b.*\bunion\b)/gi,
                /\b(select|insert|update|delete|drop|create|alter)\b.*\b(from|into|table|database)\b/gi,
                /['"]\s*(or|and)\s*['"]\s*['"]/gi,
                /\b(or|and)\b\s*['"]\s*\w+\s*['"]\s*=\s*['"]\s*\w+/gi
            ],
            commandInjection: [
                /[;&|`$()]/g,
                /\b(cat|ls|pwd|whoami|id|uname)\b/gi,
                /\.\.\//g,
                /\/etc\/passwd/gi,
                /\/proc\/self\/environ/gi
            ],
            pathTraversal: [
                /\.\.\//g,
                /\/etc\/|\/proc\/|\/sys\//gi,
                /C:\\Windows\\|C:\\Program Files\\/gi
            ],
            csrf: [
                /\bcsrf\b.*\btoken\b/gi,
                /\bx-csrf-token\b/gi,
                /\b_token\b/gi
            ]
        };
    }

    /**
     * Comprehensive input validation and sanitization
     * @param {*} input - Input to validate
     * @param {Object} options - Validation options
     * @returns {Object} Validation result
     */
    validateInput(input, options = {}) {
        const result = {
            isValid: true,
            sanitized: input,
            threats: [],
            riskLevel: 'low'
        };

        if (input === null || input === undefined) {
            return result;
        }

        const inputStr = String(input);
        
        // Check input length
        const maxLength = options.maxLength || 10000;
        if (inputStr.length > maxLength) {
            result.isValid = false;
            result.threats.push(`Input exceeds maximum length: ${inputStr.length} > ${maxLength}`);
            result.riskLevel = 'high';
            result.sanitized = inputStr.substring(0, maxLength);
        }

        // Check for various threats
        for (const [threatType, patterns] of Object.entries(this.threatPatterns)) {
            for (const pattern of patterns) {
                if (pattern.test(inputStr)) {
                    result.threats.push(`${threatType.toUpperCase()} pattern detected`);
                    result.isValid = false;
                    result.riskLevel = this.escalateRiskLevel(result.riskLevel);
                }
            }
        }

        // Advanced sanitization
        if (options.sanitize !== false) {
            result.sanitized = this.sanitizeInput(inputStr, options);
        }

        // Log security event if threats detected
        if (result.threats.length > 0) {
            this.logSecurityEvent('input_validation', {
                threats: result.threats,
                riskLevel: result.riskLevel,
                originalLength: inputStr.length,
                sanitizedLength: result.sanitized.length
            });
        }

        return result;
    }

    /**
     * Advanced input sanitization
     * @param {string} input - Input to sanitize
     * @param {Object} options - Sanitization options
     * @returns {string} Sanitized input
     */
    sanitizeInput(input, options = {}) {
        let sanitized = input;

        // Remove null bytes and control characters
        sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

        // HTML entity encoding for XSS prevention
        const htmlEntities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };

        if (options.htmlEncode !== false) {
            sanitized = sanitized.replace(/[&<>"'/]/g, (char) => htmlEntities[char] || char);
        }

        // Remove dangerous protocols
        sanitized = sanitized.replace(/(javascript|vbscript|data):/gi, '');

        // Remove SQL injection patterns
        if (options.preventSql !== false) {
            sanitized = sanitized.replace(/(\bunion\b|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b)/gi, '');
        }

        // Remove command injection patterns
        if (options.preventCommands !== false) {
            sanitized = sanitized.replace(/[;&|`$()]/g, '');
        }

        // Path traversal prevention
        sanitized = sanitized.replace(/\.\.\//g, '');

        return sanitized;
    }

    /**
     * Generate secure CSRF token
     * @returns {string} CSRF token
     */
    generateCSRFToken() {
        const token = crypto.randomBytes(32).toString('hex');
        const timestamp = Date.now();
        const signature = crypto.createHmac('sha256', process.env.CSRF_SECRET || 'default-secret')
            .update(`${token}-${timestamp}`)
            .digest('hex');
        
        return `${token}.${timestamp}.${signature}`;
    }

    /**
     * Validate CSRF token
     * @param {string} token - Token to validate
     * @param {number} maxAge - Maximum age in milliseconds
     * @returns {boolean} True if valid
     */
    validateCSRFToken(token, maxAge = 3600000) { // 1 hour default
        if (!token || typeof token !== 'string') {
            return false;
        }

        const parts = token.split('.');
        if (parts.length !== 3) {
            return false;
        }

        const [tokenPart, timestampPart, signaturePart] = parts;
        const timestamp = parseInt(timestampPart, 10);

        if (isNaN(timestamp) || Date.now() - timestamp > maxAge) {
            return false;
        }

        const expectedSignature = crypto.createHmac('sha256', process.env.CSRF_SECRET || 'default-secret')
            .update(`${tokenPart}-${timestamp}`)
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(signaturePart, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
    }

    /**
     * Advanced rate limiting with adaptive thresholds
     * @param {string} identifier - Request identifier (IP, user, etc.)
     * @param {Object} limits - Rate limiting configuration
     * @returns {Object} Rate limiting result
     */
    checkRateLimit(identifier, limits = {}) {
        const now = Date.now();
        const {
            windowMs = 60000, // 1 minute
            maxRequests = 30,
            burstLimit = 10,
            burstWindowMs = 10000 // 10 seconds
        } = limits;

        if (!this.suspiciousPatterns.has(identifier)) {
            this.suspiciousPatterns.set(identifier, {
                requests: [],
                violations: 0,
                firstSeen: now,
                riskScore: 0
            });
        }

        const pattern = this.suspiciousPatterns.get(identifier);
        
        // Clean old requests
        pattern.requests = pattern.requests.filter(time => now - time < windowMs);
        
        // Check burst limit
        const recentRequests = pattern.requests.filter(time => now - time < burstWindowMs);
        if (recentRequests.length >= burstLimit) {
            pattern.violations++;
            pattern.riskScore += 10;
            
            this.logSecurityEvent('burst_limit_exceeded', {
                identifier,
                requests: recentRequests.length,
                limit: burstLimit,
                riskScore: pattern.riskScore
            });

            return {
                allowed: false,
                reason: 'burst_limit_exceeded',
                retryAfter: burstWindowMs,
                riskScore: pattern.riskScore
            };
        }

        // Check regular rate limit
        if (pattern.requests.length >= maxRequests) {
            pattern.violations++;
            pattern.riskScore += 5;
            
            this.logSecurityEvent('rate_limit_exceeded', {
                identifier,
                requests: pattern.requests.length,
                limit: maxRequests,
                riskScore: pattern.riskScore
            });

            return {
                allowed: false,
                reason: 'rate_limit_exceeded',
                retryAfter: windowMs,
                riskScore: pattern.riskScore
            };
        }

        // Add current request
        pattern.requests.push(now);
        
        // Calculate adaptive limits based on risk score
        const adaptiveMaxRequests = Math.max(5, maxRequests - Math.floor(pattern.riskScore / 10));
        
        return {
            allowed: true,
            remaining: adaptiveMaxRequests - pattern.requests.length,
            resetTime: now + windowMs,
            riskScore: pattern.riskScore
        };
    }

    /**
     * Detect and analyze security threats
     * @param {Object} request - Request object to analyze
     * @returns {Object} Threat analysis result
     */
    analyzeThreat(request) {
        const analysis = {
            riskLevel: 'low',
            threats: [],
            recommendations: [],
            score: 0
        };

        // Analyze headers
        const suspiciousHeaders = [
            'x-forwarded-for',
            'x-real-ip',
            'user-agent',
            'referer'
        ];

        for (const header of suspiciousHeaders) {
            if (request.headers[header]) {
                const validation = this.validateInput(request.headers[header], { maxLength: 500 });
                if (!validation.isValid) {
                    analysis.threats.push(`Malicious ${header} header`);
                    analysis.score += 20;
                }
            }
        }

        // Analyze user agent
        if (request.headers['user-agent']) {
            const ua = request.headers['user-agent'];
            
            // Check for bot patterns
            const botPatterns = [
                /bot|crawler|spider|scraper/i,
                /curl|wget|python|ruby|perl/i,
                /scanner|nikto|sqlmap|nmap/i
            ];

            for (const pattern of botPatterns) {
                if (pattern.test(ua)) {
                    analysis.threats.push('Suspicious user agent detected');
                    analysis.score += 15;
                    break;
                }
            }

            // Check for missing or too short user agent
            if (!ua || ua.length < 10) {
                analysis.threats.push('Missing or suspicious user agent');
                analysis.score += 10;
            }
        }

        // Analyze request patterns
        const clientIP = this.extractClientIP(request);
        if (this.suspiciousPatterns.has(clientIP)) {
            const pattern = this.suspiciousPatterns.get(clientIP);
            analysis.score += pattern.riskScore;
            
            if (pattern.violations > 5) {
                analysis.threats.push('Repeated security violations');
                analysis.score += 30;
            }
        }

        // Determine risk level
        if (analysis.score >= 50) {
            analysis.riskLevel = 'critical';
        } else if (analysis.score >= 30) {
            analysis.riskLevel = 'high';
        } else if (analysis.score >= 15) {
            analysis.riskLevel = 'medium';
        }

        // Generate recommendations
        if (analysis.score > 0) {
            analysis.recommendations = this.generateSecurityRecommendations(analysis);
        }

        return analysis;
    }

    /**
     * Extract client IP from request
     * @param {Object} request - Request object
     * @returns {string} Client IP
     */
    extractClientIP(request) {
        return request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               request.headers['x-real-ip'] ||
               request.connection?.remoteAddress ||
               request.socket?.remoteAddress ||
               'unknown';
    }

    /**
     * Generate security recommendations based on analysis
     * @param {Object} analysis - Threat analysis
     * @returns {Array} Recommendations
     */
    generateSecurityRecommendations(analysis) {
        const recommendations = [];

        if (analysis.riskLevel === 'critical') {
            recommendations.push('Immediately block this IP address');
            recommendations.push('Review and enhance input validation');
            recommendations.push('Enable additional monitoring');
        } else if (analysis.riskLevel === 'high') {
            recommendations.push('Increase monitoring for this client');
            recommendations.push('Apply stricter rate limiting');
            recommendations.push('Log all requests for analysis');
        } else if (analysis.riskLevel === 'medium') {
            recommendations.push('Monitor request patterns');
            recommendations.push('Consider CAPTCHA verification');
        }

        return recommendations;
    }

    /**
     * Log security events
     * @param {string} eventType - Type of security event
     * @param {Object} details - Event details
     */
    logSecurityEvent(eventType, details) {
        const event = {
            timestamp: new Date().toISOString(),
            type: eventType,
            details,
            id: crypto.randomBytes(8).toString('hex')
        };

        this.securityEvents.push(event);

        // Maintain event log size
        if (this.securityEvents.length > this.maxSecurityEvents) {
            this.securityEvents.splice(0, this.securityEvents.length - this.maxSecurityEvents);
        }

        // Log critical events to console
        if (details.riskLevel === 'critical' || details.riskScore > 50) {
            logger.warn(`[SECURITY ALERT] ${eventType}:`, details);
        }
    }

    /**
     * Get security event statistics
     * @returns {Object} Security statistics
     */
    getSecurityStats() {
        const stats = {
            totalEvents: this.securityEvents.length,
            eventsByType: {},
            riskLevels: { low: 0, medium: 0, high: 0, critical: 0 },
            recentEvents: this.securityEvents.slice(-10),
            topThreats: this.getTopThreats()
        };

        // Count events by type
        this.securityEvents.forEach(event => {
            stats.eventsByType[event.type] = (stats.eventsByType[event.type] || 0) + 1;
            
            if (event.details.riskLevel) {
                stats.riskLevels[event.details.riskLevel]++;
            }
        });

        return stats;
    }

    /**
     * Get top security threats
     * @returns {Array} Top threats
     */
    getTopThreats() {
        const threatCounts = {};
        
        this.securityEvents.forEach(event => {
            if (event.details.threats) {
                event.details.threats.forEach(threat => {
                    threatCounts[threat] = (threatCounts[threat] || 0) + 1;
                });
            }
        });

        return Object.entries(threatCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([threat, count]) => ({ threat, count }));
    }

    /**
     * Escalate risk level
     * @param {string} currentLevel - Current risk level
     * @returns {string} Escalated risk level
     */
    escalateRiskLevel(currentLevel) {
        const levels = ['low', 'medium', 'high', 'critical'];
        const currentIndex = levels.indexOf(currentLevel);
        return levels[Math.min(currentIndex + 1, levels.length - 1)];
    }

    /**
     * Clean up old data
     */
    cleanup() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        // Clean up suspicious patterns
        for (const [identifier, pattern] of this.suspiciousPatterns.entries()) {
            if (now - pattern.firstSeen > maxAge && pattern.riskScore < 10) {
                this.suspiciousPatterns.delete(identifier);
            }
        }

        // Clean up old security events
        this.securityEvents = this.securityEvents.filter(
            event => now - new Date(event.timestamp).getTime() < maxAge
        );
    }
}

module.exports = AdvancedSecurity;