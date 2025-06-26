/**
 * Network utility helper functions
 * Centralized network-related operations to eliminate code duplication
 */

const { URL_PATTERNS } = require('../config/constants');

class NetworkHelper {
    /**
     * Extract client IP address from request object with proper header precedence
     * @param {Object} req - Express request object or WebSocket request
     * @returns {string} Client IP address
     */
    static getClientIP(req) {
        // Priority order for IP extraction
        const ipSources = [
            req.headers['x-forwarded-for']?.split(',')[0]?.trim(),
            req.headers['x-real-ip'],
            req.headers['cf-connecting-ip'], // Cloudflare
            req.headers['x-client-ip'],
            req.connection?.remoteAddress,
            req.socket?.remoteAddress,
            req.connection?.socket?.remoteAddress,
            req.ip
        ];

        // Return first valid IP found
        for (const ip of ipSources) {
            if (ip && ip !== '::1' && ip !== URL_PATTERNS.LOCAL_IP) {
                return ip;
            }
        }

        // Fallback to localhost indicators or unknown
        return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               req.connection?.remoteAddress || 
               'unknown';
    }

    /**
     * Validate if IP address is in a safe format
     * @param {string} ip - IP address to validate
     * @returns {boolean} True if IP is valid format
     */
    static isValidIP(ip) {
        if (!ip || typeof ip !== 'string') return false;
        
        // IPv4 pattern
        const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        // IPv6 pattern (simplified)
        const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        
        return ipv4Pattern.test(ip) || ipv6Pattern.test(ip) || ip === '::1' || ip === URL_PATTERNS.LOCALHOST;
    }

    /**
     * Check if IP is from localhost/loopback
     * @param {string} ip - IP address to check
     * @returns {boolean} True if localhost
     */
    static isLocalhost(ip) {
        const localhostPatterns = [URL_PATTERNS.LOCAL_IP, '::1', URL_PATTERNS.LOCALHOST, '0.0.0.0'];
        return localhostPatterns.includes(ip) || ip.startsWith('127.');
    }

    /**
     * Sanitize IP for logging (mask sensitive parts)
     * @param {string} ip - IP address to sanitize
     * @returns {string} Sanitized IP for safe logging
     */
    static sanitizeIPForLogging(ip) {
        if (!ip || this.isLocalhost(ip)) return ip;
        
        // For IPv4, mask last octet: 192.168.1.xxx
        if (ip.includes('.')) {
            const parts = ip.split('.');
            if (parts.length === 4) {
                return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
            }
        }
        
        // For IPv6, mask last part
        if (ip.includes(':')) {
            const parts = ip.split(':');
            if (parts.length > 1) {
                return parts.slice(0, -1).join(':') + ':xxxx';
            }
        }
        
        return 'xxx.xxx.xxx.xxx';
    }

    /**
     * Generate a network-safe user agent validation pattern
     * @param {string} userAgent - User agent string to validate
     * @returns {boolean} True if user agent appears legitimate
     */
    static isValidUserAgent(userAgent) {
        if (!userAgent || typeof userAgent !== 'string') return false;
        
        // Check length constraints
        if (userAgent.length > 500 || userAgent.length < 5) return false;
        
        // In development mode, be more permissive to allow testing tools
        const isDevelopment = process.env.NODE_ENV === 'development' || 
                             process.env.NODE_ENV === 'test';
        
        if (isDevelopment) {
            // Only block obviously malicious patterns in development
            const maliciousPatterns = [
                /<script[^>]*>/i,
                /javascript:/i,
                /vbscript:/i,
                /data:/i,
                /<iframe/i,
                /<object/i,
                /<embed/i,
                /eval\(/i,
                /expression\(/i
            ];
            
            return !maliciousPatterns.some(pattern => pattern.test(userAgent));
        }
        
        // Production mode: stricter validation
        const suspiciousPatterns = [
            /curl/i,
            /wget/i,
            /python(?!.*mozilla)/i, // Allow Python-based browsers but not raw Python
            /scanner/i,
            /bot(?!.*mobile)/i, // Allow mobile bots but not server bots
            /<script/i,
            /\.\./,
            /[<>{}]/
        ];
        
        return !suspiciousPatterns.some(pattern => pattern.test(userAgent));
    }

    /**
     * Parse and validate WebSocket URL parameters
     * @param {string} url - WebSocket URL with parameters
     * @returns {Object} Parsed parameters object
     */
    static parseWebSocketURL(url) {
        try {
            const urlObj = new URL(url, 'ws://localhost');
            const params = {};
            
            urlObj.searchParams.forEach((value, key) => {
                // Sanitize parameter values
                if (key && value && key.length < 50 && value.length < 1000) {
                    params[key] = value;
                }
            });
            
            return params;
        } catch (error) {
            return {};
        }
    }
}

module.exports = NetworkHelper;