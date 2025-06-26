/**
 * Centralized configuration management for Claude Loop
 * Provides environment variable support with sensible defaults
 */

const logger = require('./utils/unified-logger');

class Config {
    constructor() {
        this.loadConfig();
        this.validateConfig();
    }

    loadConfig() {
        this.config = {
            // WebUI Configuration
            webUI: {
                port: this.getEnvInt('WEBUI_PORT', 3333),
                maxConnections: this.getEnvInt('WEBUI_CONNECTION_LIMIT', 10),
                connectionTimeout: this.getEnvInt('WEBUI_TIMEOUT_MS', 300000), // 5 minutes
                handshakeTimeout: this.getEnvInt('WEBUI_HANDSHAKE_TIMEOUT_MS', 10000), // 10 seconds
                maxPayload: this.getEnvInt('WEBUI_MAX_PAYLOAD_BYTES', 16 * 1024 * 1024), // 16MB
                messageMaxLength: this.getEnvInt('WEBUI_MESSAGE_MAX_LENGTH', 10000),
                maxOutputEntries: this.getEnvInt('WEBUI_MAX_OUTPUT_ENTRIES', 50),
                tokenExpiryHours: this.getEnvInt('WEBUI_TOKEN_EXPIRY_HOURS', 24),
                maxRequestsPerMinute: this.getEnvInt('WEBUI_MAX_REQUESTS_PER_MINUTE', 30)
            },

            // Claude Engine Configuration
            engine: {
                maxIterations: this.getEnvInt('CLAUDE_LOOP_MAX_ITERATIONS', 10),
                maxTurns: this.getEnvInt('CLAUDE_MAX_TURNS', 30),
                claudeCommand: this.getEnvString('CLAUDE_COMMAND', 'claude'),
                fileWaitDelay: this.getEnvInt('FILE_WAIT_DELAY_MS', 2000),
                cleanupDelay: this.getEnvInt('CLEANUP_DELAY_MS', 10000),
                progressBarWidth: this.getEnvInt('PROGRESS_BAR_WIDTH', 30),
                dangerouslySkipPermissions: this.getEnvBool('CLAUDE_SKIP_PERMISSIONS', true)
            },

            // File System Configuration
            fileSystem: {
                tempFileExtension: this.getEnvString('TEMP_FILE_EXTENSION', '.tmp'),
                tempFilePermissions: this.getEnvOctal('TEMP_FILE_PERMISSIONS', 0o600),
                claudeConfigPath: this.getEnvString('CLAUDE_CONFIG_PATH', 
                    'Library/Application Support/Claude/claude_desktop_config.json')
            },

            // Timing Configuration
            timing: {
                rateLimitWindow: this.getEnvInt('RATE_LIMIT_WINDOW_MS', 60000), // 1 minute
                cleanupInterval: this.getEnvInt('CLEANUP_INTERVAL_MS', 60000), // 1 minute
                pingInterval: this.getEnvInt('PING_INTERVAL_MS', 30000), // 30 seconds
                processTimeout: this.getEnvInt('PROCESS_TIMEOUT_MS', 600000) // 10 minutes
            },

            // Development Configuration
            development: {
                verbose: this.getEnvBool('CLAUDE_LOOP_VERBOSE', false),
                debugMode: this.getEnvBool('CLAUDE_LOOP_DEBUG', false),
                enableStressTest: this.getEnvBool('ENABLE_STRESS_TEST', false)
            }
        };
    }

    validateConfig() {
        // Validate port ranges
        if (this.config.webUI.port < 1024 || this.config.webUI.port > 65535) {
            throw new Error(`Invalid WEBUI_PORT: ${this.config.webUI.port}. Must be between 1024-65535`);
        }

        // Validate positive integers
        const positiveIntFields = [
            ['webUI.maxConnections', this.config.webUI.maxConnections],
            ['engine.maxIterations', this.config.engine.maxIterations],
            ['engine.maxTurns', this.config.engine.maxTurns]
        ];

        positiveIntFields.forEach(([field, value]) => {
            if (value <= 0) {
                throw new Error(`Invalid ${field}: ${value}. Must be a positive integer`);
            }
        });

        // Validate Claude command
        if (!this.config.engine.claudeCommand || this.config.engine.claudeCommand.trim() === '') {
            throw new Error('CLAUDE_COMMAND cannot be empty');
        }

        // Validate file permissions
        if (this.config.fileSystem.tempFilePermissions < 0o000 || 
            this.config.fileSystem.tempFilePermissions > 0o777) {
            throw new Error(`Invalid TEMP_FILE_PERMISSIONS: ${this.config.fileSystem.tempFilePermissions.toString(8)}`);
        }
    }

    // Helper methods for environment variable parsing
    getEnvString(key, defaultValue) {
        const value = process.env[key];
        return value !== undefined ? value : defaultValue;
    }

    getEnvInt(key, defaultValue) {
        const value = process.env[key];
        if (value === undefined) return defaultValue;
        
        const parsed = parseInt(value, 10);
        if (isNaN(parsed)) {
            logger.warn(`Invalid integer for ${key}: "${value}". Using default: ${defaultValue}`);
            return defaultValue;
        }
        return parsed;
    }

    getEnvBool(key, defaultValue) {
        const value = process.env[key];
        if (value === undefined) return defaultValue;
        
        const lowerValue = value.toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(lowerValue)) return true;
        if (['false', '0', 'no', 'off'].includes(lowerValue)) return false;
        
        logger.warn(`Invalid boolean for ${key}: "${value}". Using default: ${defaultValue}`);
        return defaultValue;
    }

    getEnvOctal(key, defaultValue) {
        const value = process.env[key];
        if (value === undefined) return defaultValue;
        
        const parsed = parseInt(value, 8);
        if (isNaN(parsed)) {
            logger.warn(`Invalid octal for ${key}: "${value}". Using default: ${defaultValue.toString(8)}`);
            return defaultValue;
        }
        return parsed;
    }

    // Getter methods for easy access
    get(path) {
        return this.getNestedValue(this.config, path);
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    // Print configuration for debugging
    printConfig() {
        logger.info('Current Configuration:');
        logger.info(JSON.stringify(this.config, null, 2));
    }

    // Environment variables documentation
    getEnvironmentVariablesDoc() {
        return `
Claude Loop Environment Variables:

WebUI Configuration:
  WEBUI_PORT=${this.config.webUI.port}                           # Web UI server port
  WEBUI_CONNECTION_LIMIT=${this.config.webUI.maxConnections}     # Max concurrent WebSocket connections
  WEBUI_TIMEOUT_MS=${this.config.webUI.connectionTimeout}        # WebSocket connection timeout
  WEBUI_MESSAGE_MAX_LENGTH=${this.config.webUI.messageMaxLength} # Max message length in characters
  WEBUI_MAX_OUTPUT_ENTRIES=${this.config.webUI.maxOutputEntries} # Max output entries to keep
  WEBUI_MAX_REQUESTS_PER_MINUTE=${this.config.webUI.maxRequestsPerMinute} # Rate limiting

Engine Configuration:
  CLAUDE_LOOP_MAX_ITERATIONS=${this.config.engine.maxIterations} # Max debugging iterations
  CLAUDE_MAX_TURNS=${this.config.engine.maxTurns}                # Max turns per Claude session
  CLAUDE_COMMAND="${this.config.engine.claudeCommand}"           # Claude CLI command
  CLAUDE_SKIP_PERMISSIONS=${this.config.engine.dangerouslySkipPermissions} # Skip permission prompts

File System Configuration:
  TEMP_FILE_EXTENSION="${this.config.fileSystem.tempFileExtension}" # Temporary file extension
  TEMP_FILE_PERMISSIONS=${this.config.fileSystem.tempFilePermissions.toString(8)} # File permissions (octal)
  CLAUDE_CONFIG_PATH="${this.config.fileSystem.claudeConfigPath}" # Claude config file path

Development Configuration:
  CLAUDE_LOOP_VERBOSE=${this.config.development.verbose}         # Enable verbose logging
  CLAUDE_LOOP_DEBUG=${this.config.development.debugMode}         # Enable debug mode
  ENABLE_STRESS_TEST=${this.config.development.enableStressTest} # Enable stress testing
`;
    }
}

// Export singleton instance
module.exports = new Config();