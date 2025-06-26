/**
 * Security Headers middleware utility
 * Centralizes security header configuration to eliminate duplication
 */

const { HTTP_RESPONSES } = require('../config/constants');
const logger = require('./unified-logger');

class SecurityHeaders {
    constructor() {
        this.defaultConfig = {
            // Content Security Policy
            csp: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    process.env.CSP_SCRIPT_UNSAFE_INLINE === 'true' ? "'unsafe-inline'" : null,
                    process.env.CDN_JSDELIVR || 'https://cdn.jsdelivr.net',
                    process.env.CDN_CLOUDFLARE || 'https://cdnjs.cloudflare.com'
                ].filter(Boolean),
                styleSrc: [
                    "'self'",
                    process.env.CSP_STYLE_UNSAFE_INLINE !== 'false' ? "'unsafe-inline'" : null,
                    process.env.CDN_JSDELIVR || 'https://cdn.jsdelivr.net',
                    process.env.CDN_CLOUDFLARE || 'https://cdnjs.cloudflare.com',
                    process.env.CDN_FONTS || 'https://fonts.googleapis.com'
                ].filter(Boolean),
                fontSrc: [
                    "'self'",
                    process.env.CDN_FONTS || 'https://fonts.googleapis.com',
                    process.env.CDN_FONTS_STATIC || 'https://fonts.gstatic.com',
                    process.env.CDN_CLOUDFLARE || 'https://cdnjs.cloudflare.com'
                ],
                connectSrc: ["'self'", "ws:", "wss:"],
                imgSrc: ["'self'", "data:", "https:"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                frameAncestors: ["'none'"],
                formAction: ["'self'"],
                upgradeInsecureRequests: process.env.HTTPS_ONLY !== 'false'
            },
            
            // Other security headers
            headers: {
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': process.env.X_FRAME_OPTIONS || 'DENY',
                'X-XSS-Protection': '1; mode=block',
                'Referrer-Policy': process.env.REFERRER_POLICY || 'strict-origin-when-cross-origin',
                'X-DNS-Prefetch-Control': 'off',
                'Permissions-Policy': this.getPermissionsPolicy()
            },
            
            // HSTS (only in production and HTTPS)
            hsts: {
                enabled: process.env.NODE_ENV === 'production' && process.env.HTTPS_ENABLED === 'true',
                maxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000, // 1 year
                includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false',
                preload: process.env.HSTS_PRELOAD === 'true'
            }
        };
    }

    /**
     * Generate Content Security Policy string
     * @param {Object} cspConfig - CSP configuration object
     * @returns {string} - CSP header value
     */
    generateCSP(cspConfig = this.defaultConfig.csp) {
        const directives = [];
        
        // Process each CSP directive
        for (const [directive, sources] of Object.entries(cspConfig)) {
            if (directive === 'upgradeInsecureRequests') {
                if (sources) {
                    directives.push('upgrade-insecure-requests');
                }
                continue;
            }
            
            // Convert camelCase to kebab-case
            const kebabDirective = directive.replace(/([A-Z])/g, '-$1').toLowerCase();
            
            if (Array.isArray(sources) && sources.length > 0) {
                directives.push(`${kebabDirective} ${sources.join(' ')}`);
            }
        }
        
        return directives.join('; ');
    }

    /**
     * Generate Permissions Policy string
     * @returns {string} - Permissions Policy header value
     */
    getPermissionsPolicy() {
        const policies = [
            'accelerometer=()',
            'camera=()',
            'geolocation=()',
            'gyroscope=()',
            'magnetometer=()',
            'microphone=()',
            'payment=()',
            'usb=()'
        ];
        
        // Allow customization via environment variables
        if (process.env.PERMISSIONS_POLICY_CAMERA === 'allow') {
            policies[1] = 'camera=*';
        }
        
        if (process.env.PERMISSIONS_POLICY_MICROPHONE === 'allow') {
            policies[5] = 'microphone=*';
        }
        
        return policies.join(', ');
    }

    /**
     * Generate HSTS header value
     * @param {Object} hstsConfig - HSTS configuration
     * @returns {string} - HSTS header value
     */
    generateHSTS(hstsConfig = this.defaultConfig.hsts) {
        if (!hstsConfig.enabled) {
            return null;
        }
        
        let hstsValue = `max-age=${hstsConfig.maxAge}`;
        
        if (hstsConfig.includeSubDomains) {
            hstsValue += '; includeSubDomains';
        }
        
        if (hstsConfig.preload) {
            hstsValue += '; preload';
        }
        
        return hstsValue;
    }

    /**
     * Create Express middleware for security headers
     * @param {Object} customConfig - Custom configuration to override defaults
     * @returns {Function} - Express middleware function
     */
    middleware(customConfig = {}) {
        const config = this.mergeConfig(this.defaultConfig, customConfig);
        
        return (req, res, next) => {
            // Set basic security headers
            for (const [header, value] of Object.entries(config.headers)) {
                res.setHeader(header, value);
            }
            
            // Set Content Security Policy
            const cspValue = this.generateCSP(config.csp);
            res.setHeader('Content-Security-Policy', cspValue);
            
            // Set HSTS if enabled
            const hstsValue = this.generateHSTS(config.hsts);
            if (hstsValue) {
                res.setHeader('Strict-Transport-Security', hstsValue);
            }
            
            // Remove server information
            res.removeHeader('X-Powered-By');
            
            next();
        };
    }

    /**
     * Create WebSocket-specific security headers
     * @param {Object} customConfig - Custom configuration
     * @returns {Object} - Headers object for WebSocket responses
     */
    getWebSocketHeaders(customConfig = {}) {
        const config = this.mergeConfig(this.defaultConfig, customConfig);
        const headers = { ...config.headers };
        
        // WebSocket specific CSP (more restrictive)
        const wsCSP = {
            ...config.csp,
            connectSrc: ["'self'", "ws:", "wss:"],
            scriptSrc: ["'self'"] // Remove unsafe-inline for WebSocket connections
        };
        
        headers['Content-Security-Policy'] = this.generateCSP(wsCSP);
        
        return headers;
    }

    /**
     * Merge configuration objects
     * @param {Object} defaultConfig - Default configuration
     * @param {Object} customConfig - Custom configuration
     * @returns {Object} - Merged configuration
     */
    mergeConfig(defaultConfig, customConfig) {
        const merged = JSON.parse(JSON.stringify(defaultConfig)); // Deep clone
        
        if (customConfig.csp) {
            merged.csp = { ...merged.csp, ...customConfig.csp };
        }
        
        if (customConfig.headers) {
            merged.headers = { ...merged.headers, ...customConfig.headers };
        }
        
        if (customConfig.hsts) {
            merged.hsts = { ...merged.hsts, ...customConfig.hsts };
        }
        
        return merged;
    }

    /**
     * Validate CSP configuration
     * @param {Object} cspConfig - CSP configuration to validate
     * @returns {Array} - Array of validation errors
     */
    validateCSP(cspConfig) {
        const errors = [];
        const validDirectives = [
            'defaultSrc', 'scriptSrc', 'styleSrc', 'fontSrc', 'connectSrc',
            'imgSrc', 'objectSrc', 'baseUri', 'frameAncestors', 'formAction'
        ];
        
        for (const directive of Object.keys(cspConfig)) {
            if (directive === 'upgradeInsecureRequests') continue;
            
            if (!validDirectives.includes(directive)) {
                errors.push(`Unknown CSP directive: ${directive}`);
            }
        }
        
        // Check for potentially unsafe configurations
        if (cspConfig.scriptSrc && cspConfig.scriptSrc.includes("'unsafe-eval'")) {
            errors.push("WARNING: 'unsafe-eval' in script-src poses security risks");
        }
        
        if (cspConfig.styleSrc && cspConfig.styleSrc.includes("'unsafe-inline'")) {
            errors.push("INFO: 'unsafe-inline' in style-src reduces XSS protection");
        }
        
        return errors;
    }

    /**
     * Get configuration for different environments
     * @param {string} environment - Environment name (development, production, test)
     * @returns {Object} - Environment-specific configuration
     */
    getEnvironmentConfig(environment = process.env.NODE_ENV) {
        switch (environment) {
            case 'development':
                return {
                    csp: {
                        ...this.defaultConfig.csp,
                        scriptSrc: [...this.defaultConfig.csp.scriptSrc, "'unsafe-eval'"], // Allow dev tools
                        connectSrc: [...this.defaultConfig.csp.connectSrc, "*"] // Allow any connections for dev
                    },
                    hsts: { enabled: false }
                };
                
            case 'test':
                return {
                    headers: {
                        ...this.defaultConfig.headers,
                        'X-Frame-Options': 'SAMEORIGIN' // Allow framing in tests
                    },
                    hsts: { enabled: false }
                };
                
            case 'production':
            default:
                return this.defaultConfig;
        }
    }
}

// Export singleton instance
module.exports = new SecurityHeaders();