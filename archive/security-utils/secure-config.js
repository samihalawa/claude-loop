/**
 * Secure Configuration Management Utility
 * Handles sensitive configuration data with proper encryption and validation
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');
const logger = require('./unified-logger');
const { PORTS, URL_PATTERNS, TEST_PORTS } = require('../config/constants');

class SecureConfig {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32; // 256 bits
        this.ivLength = 16;  // 128 bits
        this.tagLength = 16; // 128 bits
        this.saltLength = 32; // 256 bits
        
        // Initialize encryption key from environment or generate one
        this.initializeKey();
    }

    /**
     * Initialize the encryption key from environment or derive from password
     */
    initializeKey() {
        const envKey = process.env.CLAUDE_LOOP_ENCRYPTION_KEY;
        const envPassword = process.env.CLAUDE_LOOP_CONFIG_PASSWORD;
        
        if (envKey) {
            // Use provided key (must be 64 hex characters = 32 bytes)
            if (!/^[0-9a-f]{64}$/i.test(envKey)) {
                throw new Error('CLAUDE_LOOP_ENCRYPTION_KEY must be 64 hexadecimal characters');
            }
            this.key = Buffer.from(envKey, 'hex');
            logger.security('Using encryption key from environment');
        } else if (envPassword) {
            // Derive key from password using PBKDF2
            const salt = this.getOrCreateSalt();
            this.key = crypto.pbkdf2Sync(envPassword, salt, 100000, this.keyLength, 'sha512');
            logger.security('Derived encryption key from password');
        } else {
            // For development/testing only - generate a session key
            if (process.env.NODE_ENV === 'production') {
                throw new Error('Either CLAUDE_LOOP_ENCRYPTION_KEY or CLAUDE_LOOP_CONFIG_PASSWORD must be set in production');
            }
            this.key = crypto.randomBytes(this.keyLength);
            logger.warn('Using temporary encryption key for development. Set CLAUDE_LOOP_ENCRYPTION_KEY for production.');
        }
    }

    /**
     * Get or create a salt for key derivation
     */
    getOrCreateSalt() {
        const saltPath = path.join(process.cwd(), '.claude-loop-salt');
        
        try {
            if (fs.existsSync(saltPath)) {
                const salt = fs.readFileSync(saltPath);
                if (salt.length === this.saltLength) {
                    return salt;
                }
            }
        } catch (error) {
            logger.warn('Could not read existing salt file');
        }
        
        // Generate new salt
        const salt = crypto.randomBytes(this.saltLength);
        try {
            fs.writeFileSync(saltPath, salt, { mode: 0o600 });
            logger.security('Generated new encryption salt');
        } catch (error) {
            logger.warn('Could not save salt file, using temporary salt');
        }
        
        return salt;
    }

    /**
     * Encrypt sensitive data
     * @param {string} plaintext - Data to encrypt
     * @returns {string} - Base64 encoded encrypted data with IV and tag
     */
    encrypt(plaintext) {
        if (!plaintext || typeof plaintext !== 'string') {
            throw new Error('Invalid input for encryption');
        }

        const iv = crypto.randomBytes(this.ivLength);
        const cipher = crypto.createCipher(this.algorithm, this.key, iv);
        
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const tag = cipher.getAuthTag();
        
        // Combine IV + tag + encrypted data
        const result = Buffer.concat([iv, tag, Buffer.from(encrypted, 'hex')]);
        return result.toString('base64');
    }

    /**
     * Decrypt sensitive data
     * @param {string} encryptedData - Base64 encoded encrypted data
     * @returns {string} - Decrypted plaintext
     */
    decrypt(encryptedData) {
        if (!encryptedData || typeof encryptedData !== 'string') {
            throw new Error('Invalid input for decryption');
        }

        try {
            const data = Buffer.from(encryptedData, 'base64');
            
            if (data.length < this.ivLength + this.tagLength) {
                throw new Error('Invalid encrypted data format');
            }
            
            const iv = data.subarray(0, this.ivLength);
            const tag = data.subarray(this.ivLength, this.ivLength + this.tagLength);
            const encrypted = data.subarray(this.ivLength + this.tagLength);
            
            const decipher = crypto.createDecipher(this.algorithm, this.key, iv);
            decipher.setAuthTag(tag);
            
            let decrypted = decipher.update(encrypted, null, 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            throw new Error('Decryption failed: ' + error.message);
        }
    }

    /**
     * Generate a secure API key
     * @param {number} length - Key length in bytes (default: 32)
     * @returns {string} - Hex-encoded API key
     */
    generateApiKey(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Generate a secure session token
     * @param {number} length - Token length in bytes (default: 48)
     * @returns {string} - Hex-encoded session token
     */
    generateSessionToken(length = 48) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Hash a password securely using bcrypt-style scrypt
     * @param {string} password - Password to hash
     * @param {string} salt - Optional salt (will generate if not provided)
     * @returns {string} - Hashed password with salt
     */
    hashPassword(password, salt = null) {
        if (!password || typeof password !== 'string') {
            throw new Error('Invalid password');
        }

        const useSalt = salt || crypto.randomBytes(16).toString('hex');
        const hash = crypto.scryptSync(password, useSalt, 64).toString('hex');
        return `${useSalt}:${hash}`;
    }

    /**
     * Verify a password against a hash
     * @param {string} password - Password to verify
     * @param {string} hashedPassword - Stored hash with salt
     * @returns {boolean} - True if password matches
     */
    verifyPassword(password, hashedPassword) {
        if (!password || !hashedPassword) {
            return false;
        }

        try {
            const [salt, hash] = hashedPassword.split(':');
            const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
            return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
        } catch (error) {
            logger.error('Password verification error', error.message);
            return false;
        }
    }

    /**
     * Validate and sanitize configuration values
     * @param {object} config - Configuration object to validate
     * @returns {object} - Sanitized configuration
     */
    sanitizeConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new Error('Invalid configuration object');
        }

        const sanitized = {};
        
        for (const [key, value] of Object.entries(config)) {
            // Skip prototype pollution keys
            if (['__proto__', 'constructor', 'prototype'].includes(key)) {
                continue;
            }
            
            // Sanitize string values
            if (typeof value === 'string') {
                // Remove potentially dangerous characters
                sanitized[key] = value
                    .replace(/[<>\"'&]/g, '') // Basic XSS prevention
                    .trim()
                    .substring(0, 1000); // Limit length
            } else if (typeof value === 'number') {
                // Validate numbers
                if (isFinite(value)) {
                    sanitized[key] = value;
                }
            } else if (typeof value === 'boolean') {
                sanitized[key] = value;
            } else if (Array.isArray(value)) {
                // Recursively sanitize arrays
                sanitized[key] = value.map(item => 
                    typeof item === 'object' ? this.sanitizeConfig(item) : item
                ).slice(0, 100); // Limit array size
            } else if (typeof value === 'object' && value !== null) {
                // Recursively sanitize objects
                sanitized[key] = this.sanitizeConfig(value);
            }
        }
        
        return sanitized;
    }

    /**
     * Create a secure configuration template
     * @returns {object} - Template with secure defaults
     */
    createSecureTemplate() {
        return {
            encryption: {
                enabled: true,
                algorithm: this.algorithm,
                keyDerivationIterations: 100000
            },
            security: {
                maxConnectionAttempts: 10,
                rateLimitWindow: 60000,
                sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
                requireHttps: process.env.NODE_ENV === 'production',
                enableCSP: true,
                enableHSTS: true
            },
            logging: {
                level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
                includeStack: process.env.NODE_ENV !== 'production',
                enableFileLogging: true,
                maxLogFileSize: 10 * 1024 * 1024 // 10MB
            }
        };
    }

    /**
     * Mask sensitive values for logging
     * @param {string} value - Value to mask
     * @param {number} visibleChars - Number of characters to show (default: 4)
     * @returns {string} - Masked value
     */
    maskSensitive(value, visibleChars = 4) {
        if (!value || typeof value !== 'string') {
            return '[INVALID]';
        }
        
        if (value.length <= visibleChars) {
            return '*'.repeat(value.length);
        }
        
        return value.substring(0, visibleChars) + '*'.repeat(value.length - visibleChars);
    }

    /**
     * Clean up sensitive data from memory
     */
    cleanup() {
        if (this.key) {
            this.key.fill(0);
            this.key = null;
        }
        logger.security('Secure configuration cleaned up');
    }
}

// Export singleton instance
const secureConfig = new SecureConfig();

// Clean up on process exit
process.on('exit', () => secureConfig.cleanup());
process.on('SIGINT', () => {
    secureConfig.cleanup();
    process.exit(0);
});
process.on('SIGTERM', () => {
    secureConfig.cleanup();
    process.exit(0);
});

module.exports = { SecureConfig, secureConfig };