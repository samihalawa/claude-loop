/**
 * Input Validation and Sanitization Utilities
 * Centralized validation logic to prevent security vulnerabilities and ensure data integrity
 */

const { Logger } = require('./logger');
const logger = require('./unified-logger');
const { PORTS, URL_PATTERNS, TEST_PORTS } = require('../config/constants');
const logger = new Logger(process.env.NODE_ENV === 'development');

class ValidationError extends Error {
    constructor(message, field = null, value = null) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
        this.value = value;
    }
}

class SecurityError extends Error {
    constructor(message, details = null) {
        super(message);
        this.name = 'SecurityError';
        this.details = details;
    }
}

class Validator {
    static validatePort(port, fieldName = 'port') {
        const portNum = parseInt(port);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            throw new ValidationError(`Invalid port number: must be between 1-65535`, fieldName, port);
        }
        return portNum;
    }

    static validateTimeout(timeout, fieldName = 'timeout') {
        const timeoutNum = parseInt(timeout);
        if (isNaN(timeoutNum) || timeoutNum < 0 || timeoutNum > 3600000) { // Max 1 hour
            throw new ValidationError(`Invalid timeout: must be between 0-3600000ms`, fieldName, timeout);
        }
        return timeoutNum;
    }

    static validateString(str, options = {}) {
        const {
            fieldName = 'string',
            minLength = 0,
            maxLength = 10000,
            allowEmpty = true,
            pattern = null,
            sanitize = true
        } = options;

        if (str === null || str === undefined) {
            if (!allowEmpty) {
                throw new ValidationError(`${fieldName} is required`, fieldName, str);
            }
            return '';
        }

        if (typeof str !== 'string') {
            throw new ValidationError(`${fieldName} must be a string`, fieldName, str);
        }

        if (str.length < minLength) {
            throw new ValidationError(`${fieldName} must be at least ${minLength} characters`, fieldName, str);
        }

        if (str.length > maxLength) {
            throw new ValidationError(`${fieldName} exceeds maximum length of ${maxLength}`, fieldName, str);
        }

        if (pattern && !pattern.test(str)) {
            throw new ValidationError(`${fieldName} does not match required pattern`, fieldName, str);
        }

        // Sanitize if requested
        if (sanitize) {
            return this.sanitizeString(str);
        }

        return str;
    }

    static validateEmail(email, fieldName = 'email') {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const validatedEmail = this.validateString(email, {
            fieldName,
            minLength: 5,
            maxLength: 320, // RFC 5321 limit
            allowEmpty: false,
            pattern: emailPattern
        });
        return validatedEmail.toLowerCase();
    }

    static validateUrl(url, fieldName = 'url', allowedSchemes = ['http', 'https']) {
        try {
            const urlObj = new URL(url);
            if (!allowedSchemes.includes(urlObj.protocol.slice(0, -1))) {
                throw new ValidationError(`${fieldName} must use allowed scheme: ${allowedSchemes.join(', ')}`, fieldName, url);
            }
            return urlObj.toString();
        } catch (error) {
            throw new ValidationError(`Invalid URL format`, fieldName, url);
        }
    }

    static validateFilePath(filePath, options = {}) {
        const {
            fieldName = 'filePath',
            mustExist = false,
            allowedExtensions = null,
            maxLength = 4096
        } = options;

        const path = require('path');
        const fs = require('fs');

        if (!filePath || typeof filePath !== 'string') {
            throw new ValidationError(`${fieldName} must be a non-empty string`, fieldName, filePath);
        }

        if (filePath.length > maxLength) {
            throw new ValidationError(`${fieldName} exceeds maximum length`, fieldName, filePath);
        }

        // Check for path traversal attempts
        const resolved = path.resolve(filePath);
        const normalized = path.normalize(filePath);
        
        if (normalized.includes('..') || filePath.includes('\x00')) {
            throw new SecurityError(`Path traversal attempt detected`, { path: filePath });
        }

        // Validate file extension if specified
        if (allowedExtensions) {
            const ext = path.extname(filePath).toLowerCase();
            if (!allowedExtensions.includes(ext)) {
                throw new ValidationError(`${fieldName} must have allowed extension: ${allowedExtensions.join(', ')}`, fieldName, filePath);
            }
        }

        // Check existence if required
        if (mustExist) {
            try {
                fs.accessSync(resolved, fs.constants.F_OK);
            } catch (error) {
                throw new ValidationError(`${fieldName} does not exist`, fieldName, filePath);
            }
        }

        return resolved;
    }

    static validateObject(obj, schema, fieldName = 'object') {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
            throw new ValidationError(`${fieldName} must be an object`, fieldName, obj);
        }

        const validated = {};
        for (const [key, rules] of Object.entries(schema)) {
            const value = obj[key];
            
            if (rules.required && (value === undefined || value === null)) {
                throw new ValidationError(`${key} is required`, key, value);
            }

            if (value !== undefined && value !== null) {
                try {
                    if (rules.validator) {
                        validated[key] = rules.validator(value, key);
                    } else {
                        validated[key] = value;
                    }
                } catch (error) {
                    throw new ValidationError(`Validation failed for ${key}: ${error.message}`, key, value);
                }
            } else if (rules.default !== undefined) {
                validated[key] = rules.default;
            }
        }

        return validated;
    }

    static sanitizeString(str) {
        if (typeof str !== 'string') return str;

        return str
            // Remove null bytes and control characters
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            // Remove potential script tags
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            // Remove potential javascript: protocols
            .replace(/javascript:/gi, '')
            // Remove potential data: urls with script
            .replace(/data:[^;]*;[^,]*,.*<script/gi, '')
            // Normalize whitespace
            .replace(/\s+/g, ' ')
            .trim();
    }

    static sanitizeCommand(command) {
        if (!command || typeof command !== 'string') {
            throw new SecurityError('Command must be a non-empty string');
        }

        // Only allow alphanumeric characters, hyphens, underscores, forward slashes, and periods
        if (!/^[a-zA-Z0-9\-_./]+$/.test(command)) {
            throw new SecurityError('Command contains invalid characters');
        }

        // Prevent common injection patterns
        const dangerousPatterns = [
            /[;&|`$(){}[\]\\]/,
            /\.\./,
            /\/etc\//,
            /\/proc\//,
            /\/sys\//
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(command)) {
                throw new SecurityError('Command contains potentially dangerous patterns');
            }
        }

        return command;
    }

    static validateConnectionConfig(config) {
        const schema = {
            port: { 
                required: true, 
                validator: (value) => this.validatePort(value, 'port') 
            },
            maxConnections: { 
                required: false, 
                default: 5,
                validator: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 1 || num > 1000) {
                        throw new ValidationError('maxConnections must be between 1-1000');
                    }
                    return num;
                }
            },
            timeout: { 
                required: false, 
                default: 300000,
                validator: (value) => this.validateTimeout(value, 'timeout') 
            }
        };

        return this.validateObject(config, schema, 'connectionConfig');
    }

    static validateSessionData(data) {
        const schema = {
            iterations: {
                required: false,
                default: 0,
                validator: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 0) {
                        throw new ValidationError('iterations must be a non-negative number');
                    }
                    return num;
                }
            },
            currentPhase: {
                required: false,
                default: 'Starting...',
                validator: (value) => this.validateString(value, {
                    fieldName: 'currentPhase',
                    maxLength: 200,
                    allowEmpty: true
                })
            },
            isRunning: {
                required: false,
                default: false,
                validator: (value) => {
                    if (typeof value !== 'boolean') {
                        throw new ValidationError('isRunning must be a boolean');
                    }
                    return value;
                }
            }
        };

        return this.validateObject(data, schema, 'sessionData');
    }

    static logValidationError(error, context = {}) {
        if (error instanceof ValidationError) {
            logger.warn(`Validation error: ${error.message}`, {
                field: error.field,
                value: error.value,
                context
            });
        } else if (error instanceof SecurityError) {
            logger.security(`Security validation failed: ${error.message}`, {
                details: error.details,
                context
            });
        } else {
            logger.error(`Unexpected validation error: ${error.message}`, context);
        }
    }
}

module.exports = {
    Validator,
    ValidationError,
    SecurityError
};