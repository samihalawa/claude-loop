/**
 * Configuration Constants for Claude Loop
 * Centralized configuration to eliminate hardcoded values throughout the codebase
 */

// HTTP Status Codes
const HTTP_STATUS = {
    OK: 200,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
    TOO_MANY_REQUESTS: 429,
    SERVICE_UNAVAILABLE: 503
};

// WebSocket Close Codes
const WS_CLOSE_CODES = {
    NORMAL_CLOSURE: 1000,
    GOING_AWAY: 1001,
    PROTOCOL_ERROR: 1002,
    SERVER_OVERLOAD: 1013,
    INVALID_TOKEN: 1008
};

// Default Port Configuration
const PORTS = {
    WEBUI_DEFAULT: parseInt(process.env.WEBUI_PORT) || 3333,
    TEST_APP: parseInt(process.env.TEST_APP_PORT) || 3001,
    TEST_DATA_PERSISTENCE: parseInt(process.env.TEST_DATA_PORT) || 3334,
    TEST_STRESS: parseInt(process.env.TEST_STRESS_PORT) || 3335
};

// Timeout Configuration (in milliseconds)
const TIMEOUTS = {
    CONNECTION: parseInt(process.env.CONNECTION_TIMEOUT) || 300000, // 5 minutes
    HANDSHAKE: parseInt(process.env.HANDSHAKE_TIMEOUT) || 10000, // 10 seconds
    REQUEST: parseInt(process.env.REQUEST_TIMEOUT) || 5000, // 5 seconds
    PING_INTERVAL: parseInt(process.env.PING_INTERVAL) || 30000, // 30 seconds
    CLEANUP_INTERVAL: parseInt(process.env.CLEANUP_INTERVAL) || 60000, // 1 minute
    RECONNECT_BASE: parseInt(process.env.RECONNECT_BASE_DELAY) || 2000, // 2 seconds
    RECONNECT_MAX: parseInt(process.env.RECONNECT_MAX_DELAY) || 30000, // 30 seconds
    SESSION_SETTLE: parseInt(process.env.SESSION_SETTLE_TIME) || 2000, // 2 seconds
    WEBUI_STOP_DELAY: parseInt(process.env.WEBUI_STOP_DELAY) || 10000, // 10 seconds
    TEST_DURATION: parseInt(process.env.TEST_DURATION) || 5000, // 5 seconds
    TEST_TIMEOUT: parseInt(process.env.TEST_TIMEOUT) || 15000, // 15 seconds
    CLAUDE_PROCESS: parseInt(process.env.CLAUDE_PROCESS_TIMEOUT) || 1800000, // 30 minutes
    CLAUDE_CONTINUE_PROCESS: parseInt(process.env.CLAUDE_CONTINUE_TIMEOUT) || 900000 // 15 minutes
};

// Time Constants for Calculations
const TIME_CONSTANTS = {
    MILLISECONDS_PER_SECOND: 1000,
    MILLISECONDS_PER_MINUTE: 60000,
    SECONDS_PER_MINUTE: 60,
    HOURS_PER_DAY: 24
};

// File Size Constants
const FILE_SIZE_LIMITS = {
    TEMP_FILE_MAX: 100 * 1024 * 1024, // 100MB
    PROMPT_CONTENT_MAX: 100000, // 100KB
    WEBSOCKET_PAYLOAD_MAX: 16 * 1024 * 1024, // 16MB
    MESSAGE_LENGTH_MAX: 10000, // 10KB
    SECURE_OVERWRITE_MAX: 1024 * 1024, // 1MB
    LOG_ENTRY_MAX: 1000 // characters
};

// UI Constants
const UI_DISPLAY = {
    PROGRESS_BAR_WIDTH: 30,
    SEPARATOR_LENGTH: 50,
    MAX_OUTPUT_ENTRIES: 50,
    TRUNCATE_LENGTH: 100,
    MAX_CONTAINER_WIDTH: 1200,
    CARD_PADDING: 20,
    BORDER_RADIUS: 8,
    PERCENTAGE_SCALE: 100
};

// HTTP Response Constants
const HTTP_RESPONSES = {
    HTML_CONTENT_TYPE: 'text/html; charset=utf-8',
    JSON_CONTENT_TYPE: 'application/json',
    CSS_VARS_PREFIX: '--claude-',
    NONCE_LENGTH: 32
};

// Rate Limiting Configuration
const RATE_LIMITS = {
    REQUESTS_PER_MINUTE: parseInt(process.env.REQUESTS_PER_MINUTE) || 60,
    CONNECTION_ATTEMPTS_PER_IP: parseInt(process.env.CONNECTION_ATTEMPTS_PER_IP) || 10,
    RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000 // 1 minute
};

// Connection Limits
const CONNECTION_LIMITS = {
    MAX_CONNECTIONS: parseInt(process.env.WEBUI_MAX_CONNECTIONS) || 5,
    MAX_PAYLOAD_SIZE: parseInt(process.env.MAX_PAYLOAD_SIZE) || 16 * 1024 * 1024, // 16MB
    MAX_OUTPUT_ENTRIES: parseInt(process.env.WEBUI_MAX_OUTPUT_ENTRIES) || 50,
    MAX_MESSAGE_LENGTH: parseInt(process.env.MAX_MESSAGE_LENGTH) || 10000
};

// Claude Loop Configuration
const CLAUDE_LOOP = {
    MAX_ITERATIONS: parseInt(process.env.CLAUDE_LOOP_MAX_ITERATIONS) || 10,
    MAX_TURNS_PER_ITERATION: parseInt(process.env.CLAUDE_LOOP_MAX_TURNS) || 30,
    DEFAULT_CLAUDE_COMMAND: process.env.CLAUDE_COMMAND || 'claude'
};

// File System Configuration
const FILE_SYSTEM = {
    TEMP_FILE_MODE: 0o600, // Secure file permissions
    CONFIG_PATH: process.env.CLAUDE_CONFIG_PATH || '~/Library/Application Support/Claude/claude_desktop_config.json'
};

// Security Configuration
const SECURITY = {
    TOKEN_EXPIRY_HOURS: parseInt(process.env.WEBUI_TOKEN_EXPIRY_HOURS) || 24,
    TOKEN_BYTES: 32,
    CRYPTO_ENCODING: 'hex'
};

// UI Configuration
const UI_CONFIG = {
    PROGRESS_BAR_WIDTH: 30,
    SEPARATOR_LENGTH: 50,
    TRUNCATE_OUTPUT_LENGTH: 100,
    MAX_CONTAINER_WIDTH: 1200,
    CARD_PADDING: 20,
    BORDER_RADIUS: 8
};

// Test Configuration
const TEST_CONFIG = {
    STRESS_TEST_CYCLES: parseInt(process.env.STRESS_TEST_CYCLES) || 10,
    CONCURRENT_CLIENTS: parseInt(process.env.CONCURRENT_CLIENTS) || 5,
    MESSAGE_VOLUME: parseInt(process.env.MESSAGE_VOLUME) || 100,
    MEMORY_TEST_ITERATIONS: parseInt(process.env.MEMORY_TEST_ITERATIONS) || 1000
};

// Environment Types
const ENVIRONMENTS = {
    DEVELOPMENT: 'development',
    PRODUCTION: 'production',
    TEST: 'test'
};

// Log Levels
const LOG_LEVELS = {
    ERROR: 'error',
    WARN: 'warning', 
    INFO: 'info',
    SUCCESS: 'success',
    DEBUG: 'debug'
};

// URL Patterns
const URL_PATTERNS = {
    LOCALHOST: 'localhost',
    LOCAL_IP: '127.0.0.1',
    HTTP_PREFIX: 'http://',
    HTTPS_PREFIX: 'https://',
    WS_PREFIX: 'ws://',
    WSS_PREFIX: 'wss://'
};

// Hardcoded Test Ports (should be migrated to dynamic allocation)
const TEST_PORTS = {
    WEBUI_STANDALONE: parseInt(process.env.TEST_WEBUI_STANDALONE_PORT) || 3334,
    WEBUI_QUICK_TEST: parseInt(process.env.TEST_WEBUI_QUICK_PORT) || 3999,
    WEBUI_COMPREHENSIVE: parseInt(process.env.TEST_WEBUI_COMPREHENSIVE_PORT) || 3337,
    ERROR_HANDLING_1: parseInt(process.env.TEST_ERROR_1_PORT) || 4000,
    ERROR_HANDLING_2: parseInt(process.env.TEST_ERROR_2_PORT) || 4001,
    ERROR_HANDLING_3: parseInt(process.env.TEST_ERROR_3_PORT) || 4002,
    ERROR_HANDLING_4: parseInt(process.env.TEST_ERROR_4_PORT) || 4003,
    BROWSER_UI_TEST: parseInt(process.env.TEST_BROWSER_UI_PORT) || 3997
};

// File Extensions and Patterns
const FILE_PATTERNS = {
    TEMP_EXTENSION: '.tmp',
    LOG_EXTENSION: '.log',
    JSON_EXTENSION: '.json',
    PROMPT_PREFIX: 'claude-loop-prompt-',
    SESSION_FILENAME: 'claude-loop-session.json',
    REPORT_SUFFIX: '-report.json'
};

// Process Configuration
const PROCESS_CONFIG = {
    KILL_TIMEOUT: 5000, // 5 seconds before force kill
    MAX_PROMPT_SIZE: 100000, // 100KB limit for prompt content
    TEMP_FILE_CLEANUP_RETRIES: 3,
    SIGNAL_GRACE_PERIOD: 2000 // 2 seconds grace period for cleanup
};

// Common Retry Patterns
const RETRY_CONFIG = {
    MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || 3,
    BACKOFF_MULTIPLIER: parseFloat(process.env.BACKOFF_MULTIPLIER) || 2,
    JITTER_FACTOR: parseFloat(process.env.JITTER_FACTOR) || 0.1
};

// Export all constants
module.exports = {
    HTTP_STATUS,
    WS_CLOSE_CODES,
    PORTS,
    TIMEOUTS,
    TIME_CONSTANTS,
    RATE_LIMITS,
    CONNECTION_LIMITS,
    CLAUDE_LOOP,
    FILE_SYSTEM,
    SECURITY,
    UI_CONFIG,
    TEST_CONFIG,
    ENVIRONMENTS,
    LOG_LEVELS,
    URL_PATTERNS,
    FILE_SIZE_LIMITS,
    UI_DISPLAY,
    HTTP_RESPONSES,
    TEST_PORTS,
    FILE_PATTERNS,
    PROCESS_CONFIG,
    RETRY_CONFIG
};