/**
 * Enhanced Security Middleware
 * Integrates advanced security measures with the existing web-ui.js implementation
 */

const AdvancedSecurity = require('./advanced-security');
const NetworkHelper = require('./network-helper');
const logger = require('./unified-logger');
const { PORTS, URL_PATTERNS, TEST_PORTS } = require('../config/constants');

class SecurityMiddleware {
    constructor() {
        this.advancedSecurity = new AdvancedSecurity();
        this.blockedIPs = new Set();
        this.suspiciousActivity = new Map();
        
        // Enhanced threat patterns specific to web applications
        this.webThreats = {
            suspiciousUserAgents: [
                /sqlmap/i,
                /nikto/i,
                /nmap/i,
                /masscan/i,
                /dirb/i,
                /dirbuster/i,
                /gobuster/i,
                /wfuzz/i,
                /burp/i,
                /owasp/i
            ],
            suspiciousHeaders: [
                'x-forwarded-host',
                'x-originating-ip',
                'x-remote-ip',
                'x-injected-by'
            ],
            maliciousIPs: [
                // Tor exit nodes and known malicious IPs would go here
                // For demo purposes, we'll use some placeholder patterns
                /^10\.0\.0\./,  // Demo: block certain private ranges
                /^192\.168\.0\.1$/ // Demo: block specific IPs
            ]
        };
    }

    /**
     * Create enhanced WebSocket verification middleware
     * @returns {Function} verifyClient function for WebSocket server
     */
    createWebSocketVerifier() {
        return (info) => {
            const ip = NetworkHelper.getClientIP(info.req);
            const userAgent = info.req.headers['user-agent'] || '';
            
            // Check if IP is blocked
            if (this.blockedIPs.has(ip)) {
                logger.info(`🚫 Blocked WebSocket connection from blacklisted IP: ${NetworkHelper.sanitizeIPForLogging(ip)}`);
                return false;
            }
            
            // Enhanced user agent validation
            if (!this.validateUserAgent(userAgent)) {
                logger.info(`🚫 Blocked WebSocket connection from suspicious user agent: ${NetworkHelper.sanitizeIPForLogging(ip)}`);
                this.trackSuspiciousActivity(ip, 'suspicious_user_agent');
                return false;
            }
            
            // Check for malicious IP patterns
            if (this.isMaliciousIP(ip)) {
                logger.info(`🚫 Blocked WebSocket connection from known malicious IP range: ${NetworkHelper.sanitizeIPForLogging(ip)}`);
                this.blockedIPs.add(ip);
                return false;
            }
            
            // Rate limiting check
            const rateLimitResult = this.advancedSecurity.checkRateLimit(ip, {
                windowMs: 300000, // 5 minutes
                maxRequests: 10,  // Lower limit for WebSocket connections
                burstLimit: 3,    // Very low burst limit
                burstWindowMs: 10000 // 10 seconds
            });
            
            if (!rateLimitResult.allowed) {
                logger.info(`🚫 Blocked WebSocket connection: ${rateLimitResult.reason} from ${NetworkHelper.sanitizeIPForLogging(ip)}`);
                if (rateLimitResult.riskScore > 100) {
                    this.blockedIPs.add(ip);
                }
                return false;
            }
            
            return true;
        };
    }

    /**
     * Create enhanced HTTP request middleware
     * @returns {Function} Express middleware function
     */
    createHTTPMiddleware() {
        return (req, res, next) => {
            const ip = NetworkHelper.getClientIP(req);
            const startTime = Date.now();
            
            // Check if IP is blocked
            if (this.blockedIPs.has(ip)) {
                logger.info(`🚫 Blocked HTTP request from blacklisted IP: ${NetworkHelper.sanitizeIPForLogging(ip)}`);
                return res.status(403).json({ error: 'Access denied' });
            }
            
            // Enhanced threat analysis
            const threatAnalysis = this.advancedSecurity.analyzeThreat(req);
            if (threatAnalysis.riskLevel === 'critical') {
                logger.info(`🚨 CRITICAL THREAT detected from ${NetworkHelper.sanitizeIPForLogging(ip)}: ${threatAnalysis.threats.join(', ')}`);
                this.blockedIPs.add(ip);
                return res.status(403).json({ error: 'Security violation detected' });
            }
            
            // Enhanced input validation for request parameters
            if (req.query) {
                for (const [key, value] of Object.entries(req.query)) {
                    const validation = this.advancedSecurity.validateInput(value, { 
                        maxLength: 1000,
                        htmlEncode: true,
                        preventSql: true,
                        preventCommands: true
                    });
                    
                    if (!validation.isValid && validation.riskLevel === 'critical') {
                        logger.info(`🚨 Malicious query parameter detected from ${NetworkHelper.sanitizeIPForLogging(ip)}: ${key}`);
                        this.trackSuspiciousActivity(ip, 'malicious_input');
                        return res.status(400).json({ error: 'Invalid request parameters' });
                    }
                    
                    // Update sanitized value
                    req.query[key] = validation.sanitized;
                }
            }
            
            // Enhanced body validation
            if (req.body && typeof req.body === 'object') {
                const bodyValidation = this.validateObjectRecursively(req.body);
                if (!bodyValidation.isValid) {
                    logger.info(`🚨 Malicious request body detected from ${NetworkHelper.sanitizeIPForLogging(ip)}`);
                    this.trackSuspiciousActivity(ip, 'malicious_body');
                    return res.status(400).json({ error: 'Invalid request body' });
                }
                req.body = bodyValidation.sanitized;
            }
            
            // Rate limiting
            const rateLimitResult = this.advancedSecurity.checkRateLimit(ip);
            if (!rateLimitResult.allowed) {
                logger.info(`🚫 Rate limit exceeded for ${NetworkHelper.sanitizeIPForLogging(ip)}: ${rateLimitResult.reason}`);
                
                // Add rate limiting headers
                res.set({
                    'X-RateLimit-Limit': '30',
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': new Date(rateLimitResult.retryAfter + Date.now()).toISOString(),
                    'Retry-After': Math.ceil(rateLimitResult.retryAfter / 1000)
                });
                
                if (rateLimitResult.riskScore > 100) {
                    this.blockedIPs.add(ip);
                }
                
                return res.status(429).json({ 
                    error: 'Rate limit exceeded',
                    retryAfter: rateLimitResult.retryAfter
                });
            }
            
            // Add security headers
            this.addSecurityHeaders(res);
            
            // Add request timing for monitoring
            res.on('finish', () => {
                const duration = Date.now() - startTime;
                if (duration > 5000) { // Log slow requests
                    logger.info(`⚠️  Slow request detected: ${duration}ms from ${NetworkHelper.sanitizeIPForLogging(ip)}`);
                }
            });
            
            next();
        };
    }

    /**
     * Enhanced security headers
     * @param {Object} res - Express response object
     */
    addSecurityHeaders(res) {
        res.set({
            // Prevent MIME type sniffing
            'X-Content-Type-Options': 'nosniff',
            
            // Prevent clickjacking
            'X-Frame-Options': 'DENY',
            
            // XSS protection
            'X-XSS-Protection': '1; mode=block',
            
            // Referrer policy
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            
            // HSTS (if HTTPS)
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
            
            // Hide server information
            'Server': 'Secure-WebServer/1.0',
            
            // Enhanced CSP with stricter policies
            'Content-Security-Policy': [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com",
                "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://cdnjs.cloudflare.com",
                "connect-src 'self' ws: wss:",
                "img-src 'self' data: https:",
                "object-src 'none'",
                "base-uri 'self'",
                "frame-ancestors 'none'",
                "form-action 'self'",
                "upgrade-insecure-requests",
                "block-all-mixed-content"
            ].join('; '),
            
            // Additional security headers
            'Permissions-Policy': [
                "accelerometer=()",
                "camera=()",
                "geolocation=()",
                "gyroscope=()",
                "magnetometer=()",
                "microphone=()",
                "payment=()",
                "usb=()",
                "interest-cohort=()"
            ].join(', '),
            
            // CSRF protection
            'X-CSRF-Protection': 'enabled',
            
            // Cache control for sensitive data
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
    }

    /**
     * Validate user agent against suspicious patterns
     * @param {string} userAgent - User agent string
     * @returns {boolean} True if valid
     */
    validateUserAgent(userAgent) {
        if (!userAgent || typeof userAgent !== 'string') {
            return false;
        }
        
        // Check length
        if (userAgent.length < 10 || userAgent.length > 500) {
            return false;
        }
        
        // Check against suspicious patterns
        for (const pattern of this.webThreats.suspiciousUserAgents) {
            if (pattern.test(userAgent)) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Check if IP is in known malicious ranges
     * @param {string} ip - IP address
     * @returns {boolean} True if malicious
     */
    isMaliciousIP(ip) {
        for (const pattern of this.webThreats.maliciousIPs) {
            if (pattern.test(ip)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Recursively validate object properties
     * @param {Object} obj - Object to validate
     * @param {number} depth - Current recursion depth
     * @returns {Object} Validation result
     */
    validateObjectRecursively(obj, depth = 0) {
        if (depth > 10) {
            return { isValid: false, sanitized: obj };
        }
        
        if (obj === null || typeof obj !== 'object') {
            const validation = this.advancedSecurity.validateInput(obj);
            return { isValid: validation.isValid, sanitized: validation.sanitized };
        }
        
        if (Array.isArray(obj)) {
            const sanitizedArray = [];
            for (const item of obj) {
                const validation = this.validateObjectRecursively(item, depth + 1);
                if (!validation.isValid) {
                    return { isValid: false, sanitized: obj };
                }
                sanitizedArray.push(validation.sanitized);
            }
            return { isValid: true, sanitized: sanitizedArray };
        }
        
        const sanitizedObj = {};
        for (const [key, value] of Object.entries(obj)) {
            // Prevent prototype pollution
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                continue;
            }
            
            const validation = this.validateObjectRecursively(value, depth + 1);
            if (!validation.isValid) {
                return { isValid: false, sanitized: obj };
            }
            sanitizedObj[key] = validation.sanitized;
        }
        
        return { isValid: true, sanitized: sanitizedObj };
    }

    /**
     * Track suspicious activity
     * @param {string} ip - IP address
     * @param {string} activityType - Type of suspicious activity
     */
    trackSuspiciousActivity(ip, activityType) {
        if (!this.suspiciousActivity.has(ip)) {
            this.suspiciousActivity.set(ip, {
                activities: [],
                riskScore: 0,
                firstSeen: Date.now()
            });
        }
        
        const activity = this.suspiciousActivity.get(ip);
        activity.activities.push({
            type: activityType,
            timestamp: Date.now()
        });
        activity.riskScore += 10;
        
        // Auto-block if risk score is too high
        if (activity.riskScore >= 50) {
            logger.info(`🚨 Auto-blocking IP ${NetworkHelper.sanitizeIPForLogging(ip)} due to high risk score: ${activity.riskScore}`);
            this.blockedIPs.add(ip);
        }
    }

    /**
     * Get security statistics
     * @returns {Object} Security statistics
     */
    getSecurityStats() {
        const stats = this.advancedSecurity.getSecurityStats();
        
        return {
            ...stats,
            blockedIPs: this.blockedIPs.size,
            suspiciousActivities: this.suspiciousActivity.size,
            middleware: {
                webSocketVerifier: 'active',
                httpMiddleware: 'active',
                rateLimiting: 'active',
                inputValidation: 'active'
            }
        };
    }

    /**
     * Cleanup old data
     */
    cleanup() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        // Clean up suspicious activity tracking
        for (const [ip, activity] of this.suspiciousActivity.entries()) {
            if (now - activity.firstSeen > maxAge && activity.riskScore < 30) {
                this.suspiciousActivity.delete(ip);
            }
        }
        
        // Clean up advanced security
        this.advancedSecurity.cleanup();
        
        logger.info(`🧹 Security middleware cleanup completed: ${this.blockedIPs.size} IPs blocked, ${this.suspiciousActivity.size} activities tracked`);
    }

    /**
     * Generate CSRF token for forms
     * @returns {string} CSRF token
     */
    generateCSRFToken() {
        return this.advancedSecurity.generateCSRFToken();
    }

    /**
     * Validate CSRF token
     * @param {string} token - Token to validate
     * @returns {boolean} True if valid
     */
    validateCSRFToken(token) {
        return this.advancedSecurity.validateCSRFToken(token);
    }
}

module.exports = SecurityMiddleware;