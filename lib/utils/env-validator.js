/**
 * Environment Variable Validator
 * Validates and sanitizes environment variables for security
 */

const logger = require('./unified-logger');
const { PORTS, URL_PATTERNS, TEST_PORTS } = require('../config/constants');

class EnvironmentValidator {
    constructor() {
        this.validationRules = {
            // Port validation
            port: {
                type: 'integer',
                min: 1024,
                max: 65535,
                default: null
            },
            
            // Boolean validation
            boolean: {
                type: 'boolean',
                validValues: ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'],
                default: false
            },
            
            // String validation
            string: {
                type: 'string',
                maxLength: 1000,
                allowEmpty: false,
                default: null
            },
            
            // Path validation
            path: {
                type: 'path',
                maxLength: 500,
                allowEmpty: false,
                default: null
            },
            
            // Token/Key validation
            token: {
                type: 'token',
                minLength: 16,
                maxLength: 128,
                pattern: /^[a-fA-F0-9]+$/,
                default: null
            },
            
            // URL validation
            url: {
                type: 'url',
                schemes: ['http', 'https'],
                default: null
            }
        };

        this.environmentSchema = {
            // WebUI Configuration
            'WEBUI_PORT': { ...this.validationRules.port, default: PORTS.WEBUI_DEFAULT },
            'WEBUI_MAX_CONNECTIONS': { type: 'integer', min: 1, max: 100, default: 5 },
            'WEBUI_TOKEN_EXPIRY_HOURS': { type: 'integer', min: 1, max: 168, default: 24 },
            'WEBUI_MAX_REQUESTS_PER_MINUTE': { type: 'integer', min: 1, max: 1000, default: 30 },
            'WEBUI_MAX_PAYLOAD': { type: 'integer', min: 1024, max: 50 * 1024 * 1024, default: 1024 * 1024 },
            'WEBUI_HANDSHAKE_TIMEOUT': { type: 'integer', min: 1000, max: 60000, default: 10000 },
            
            // Engine Configuration
            'CLAUDE_LOOP_MAX_ITERATIONS': { type: 'integer', min: 1, max: 100, default: 10 },
            'CLAUDE_MAX_TURNS': { type: 'integer', min: 1, max: 200, default: 30 },
            'CLAUDE_COMMAND': { ...this.validationRules.string, default: 'claude' },
            'CLAUDE_SKIP_PERMISSIONS': { ...this.validationRules.boolean, default: true },
            
            // Security Configuration
            'CLAUDE_LOOP_ENCRYPTION_KEY': { ...this.validationRules.token, minLength: 64, maxLength: 64, required: false },
            'CLAUDE_LOOP_CONFIG_PASSWORD': { type: 'string', minLength: 8, maxLength: 128, required: false },
            
            // Logging Configuration
            'LOG_LEVEL': { 
                type: 'enum', 
                validValues: ['error', 'warn', 'info', 'debug'], 
                default: 'info' 
            },
            'LOG_FILE': { ...this.validationRules.path, required: false },
            
            // Development Configuration
            'NODE_ENV': { 
                type: 'enum', 
                validValues: ['development', 'test', 'production'], 
                default: 'development' 
            },
            'CLAUDE_LOOP_VERBOSE': { ...this.validationRules.boolean, default: false },
            'CLAUDE_LOOP_DEBUG': { ...this.validationRules.boolean, default: false },
            
            // Test Configuration (for test files)
            'WEBUI_TEST_TOKEN': { ...this.validationRules.token, required: false },
            'TEST_SMITHERY_KEY': { type: 'string', maxLength: 100, required: false },
            'TEST_SMITHERY_PROFILE': { type: 'string', maxLength: 100, required: false },
        };
    }

    /**
     * Validate all environment variables
     * @returns {object} - Validation results and sanitized values
     */
    validateEnvironment() {
        const results = {
            valid: true,
            errors: [],
            warnings: [],
            sanitized: {}
        };

        // Check for required variables in production
        if (process.env.NODE_ENV === 'production') {
            this.checkProductionRequirements(results);
        }

        // Validate each known environment variable
        for (const [envVar, rules] of Object.entries(this.environmentSchema)) {
            const value = process.env[envVar];
            
            try {
                const validationResult = this.validateVariable(envVar, value, rules);
                
                if (validationResult.valid) {
                    results.sanitized[envVar] = validationResult.value;
                } else {
                    results.valid = false;
                    results.errors.push(...validationResult.errors);
                }
                
                results.warnings.push(...validationResult.warnings);
            } catch (error) {
                results.valid = false;
                results.errors.push(`Error validating ${envVar}: ${error.message}`);
            }
        }

        // Check for unknown environment variables that might be sensitive
        this.checkUnknownVariables(results);

        return results;
    }

    /**
     * Validate a single environment variable
     * @param {string} name - Variable name
     * @param {string} value - Variable value
     * @param {object} rules - Validation rules
     * @returns {object} - Validation result
     */
    validateVariable(name, value, rules) {
        const result = {
            valid: true,
            value: value,
            errors: [],
            warnings: []
        };

        // Handle undefined values
        if (value === undefined || value === null) {
            if (rules.required) {
                result.valid = false;
                result.errors.push(`${name} is required but not set`);
                return result;
            }
            
            result.value = rules.default;
            return result;
        }

        // Handle empty strings
        if (value === '' && !rules.allowEmpty) {
            if (rules.required) {
                result.valid = false;
                result.errors.push(`${name} cannot be empty`);
                return result;
            }
            
            result.value = rules.default;
            return result;
        }

        // Type-specific validation
        switch (rules.type) {
            case 'integer':
                result.value = this.validateInteger(name, value, rules, result);
                break;
            case 'boolean':
                result.value = this.validateBoolean(name, value, rules, result);
                break;
            case 'string':
                result.value = this.validateString(name, value, rules, result);
                break;
            case 'path':
                result.value = this.validatePath(name, value, rules, result);
                break;
            case 'token':
                result.value = this.validateToken(name, value, rules, result);
                break;
            case 'url':
                result.value = this.validateUrl(name, value, rules, result);
                break;
            case 'enum':
                result.value = this.validateEnum(name, value, rules, result);
                break;
        }

        return result;
    }

    validateInteger(name, value, rules, result) {
        const parsed = parseInt(value, 10);
        
        if (isNaN(parsed)) {
            result.valid = false;
            result.errors.push(`${name} must be a valid integer, got: ${value}`);
            return rules.default;
        }
        
        if (rules.min !== undefined && parsed < rules.min) {
            result.valid = false;
            result.errors.push(`${name} must be at least ${rules.min}, got: ${parsed}`);
            return rules.default;
        }
        
        if (rules.max !== undefined && parsed > rules.max) {
            result.valid = false;
            result.errors.push(`${name} must be at most ${rules.max}, got: ${parsed}`);
            return rules.default;
        }
        
        return parsed;
    }

    validateBoolean(name, value, rules, result) {
        const lowerValue = value.toLowerCase();
        
        if (['true', '1', 'yes', 'on'].includes(lowerValue)) {
            return true;
        }
        
        if (['false', '0', 'no', 'off'].includes(lowerValue)) {
            return false;
        }
        
        result.warnings.push(`${name} has invalid boolean value "${value}", using default: ${rules.default}`);
        return rules.default;
    }

    validateString(name, value, rules, result) {
        if (typeof value !== 'string') {
            result.valid = false;
            result.errors.push(`${name} must be a string`);
            return rules.default;
        }
        
        if (rules.maxLength && value.length > rules.maxLength) {
            result.warnings.push(`${name} exceeds maximum length of ${rules.maxLength}, truncating`);
            return value.substring(0, rules.maxLength);
        }
        
        if (rules.minLength && value.length < rules.minLength) {
            result.valid = false;
            result.errors.push(`${name} must be at least ${rules.minLength} characters`);
            return rules.default;
        }
        
        // Basic sanitization
        return value.trim();
    }

    validatePath(name, value, rules, result) {
        const sanitized = this.validateString(name, value, rules, result);
        
        if (!result.valid) {
            return sanitized;
        }
        
        // Check for path traversal attempts
        if (sanitized.includes('../') || sanitized.includes('..\\')) {
            result.valid = false;
            result.errors.push(`${name} contains path traversal sequences`);
            return rules.default;
        }
        
        return sanitized;
    }

    validateToken(name, value, rules, result) {
        const sanitized = this.validateString(name, value, rules, result);
        
        if (!result.valid) {
            return sanitized;
        }
        
        if (rules.pattern && !rules.pattern.test(sanitized)) {
            result.valid = false;
            result.errors.push(`${name} has invalid format`);
            return rules.default;
        }
        
        return sanitized;
    }

    validateUrl(name, value, rules, result) {
        try {
            const url = new URL(value);
            
            if (rules.schemes && !rules.schemes.includes(url.protocol.slice(0, -1))) {
                result.valid = false;
                result.errors.push(`${name} must use one of these schemes: ${rules.schemes.join(', ')}`);
                return rules.default;
            }
            
            return value;
        } catch (error) {
            result.valid = false;
            result.errors.push(`${name} is not a valid URL: ${error.message}`);
            return rules.default;
        }
    }

    validateEnum(name, value, rules, result) {
        if (!rules.validValues.includes(value)) {
            result.warnings.push(`${name} has invalid value "${value}", using default: ${rules.default}`);
            return rules.default;
        }
        
        return value;
    }

    /**
     * Check for production-specific requirements
     */
    checkProductionRequirements(results) {
        const productionRequirements = [
            'CLAUDE_LOOP_ENCRYPTION_KEY',
            'CLAUDE_LOOP_CONFIG_PASSWORD'
        ];

        let hasSecureAuth = false;
        for (const req of productionRequirements) {
            if (process.env[req]) {
                hasSecureAuth = true;
                break;
            }
        }

        if (!hasSecureAuth) {
            results.warnings.push(
                'Production environment detected but no secure authentication configured. ' +
                'Set either CLAUDE_LOOP_ENCRYPTION_KEY or CLAUDE_LOOP_CONFIG_PASSWORD.'
            );
        }
    }

    /**
     * Check for unknown environment variables that might contain sensitive data
     */
    checkUnknownVariables(results) {
        const sensitivePatterns = [
            /password/i,
            /secret/i,
            /key$/i,
            /token$/i,
            /auth/i,
            /credential/i
        ];

        for (const [key, value] of Object.entries(process.env)) {
            // Skip known variables
            if (this.environmentSchema[key]) {
                continue;
            }

            // Check if it looks sensitive
            const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
            
            if (isSensitive && value && value.length > 0) {
                results.warnings.push(
                    `Unknown environment variable "${key}" appears to contain sensitive data. ` +
                    'Consider adding it to the validation schema.'
                );
            }
        }
    }

    /**
     * Generate a report of the validation results
     */
    generateReport(results) {
        logger.info('Environment validation completed');
        
        if (results.errors.length > 0) {
            logger.error('Environment validation errors:');
            results.errors.forEach(error => logger.error(`  - ${error}`));
        }
        
        if (results.warnings.length > 0) {
            logger.warn('Environment validation warnings:');
            results.warnings.forEach(warning => logger.warn(`  - ${warning}`));
        }
        
        if (results.valid) {
            logger.success(`Environment validation passed with ${results.warnings.length} warnings`);
        } else {
            logger.error(`Environment validation failed with ${results.errors.length} errors`);
        }
        
        return results;
    }

    /**
     * Create a secure environment template
     */
    createTemplate() {
        const template = {};
        
        for (const [key, rules] of Object.entries(this.environmentSchema)) {
            let comment = `# ${key}`;
            
            if (rules.type) {
                comment += ` (${rules.type})`;
            }
            
            if (rules.default !== undefined && rules.default !== null) {
                comment += ` - Default: ${rules.default}`;
            }
            
            if (rules.required) {
                comment += ' - REQUIRED';
            }
            
            template[key] = {
                comment,
                value: rules.default || '',
                required: rules.required || false
            };
        }
        
        return template;
    }
}

module.exports = new EnvironmentValidator();