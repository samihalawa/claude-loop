# Claude Loop Utilities

This directory contains enhanced utility modules that provide robust error handling, validation, security, and performance monitoring for the Claude Loop application.

## 📁 Modules Overview

### 🪵 logger.js
Enhanced logging utility with multiple levels, file output, and structured logging.

**Features:**
- Multiple log levels (ERROR, WARN, INFO, SUCCESS, DEBUG)
- File logging with automatic directory creation
- Color-coded console output
- Performance and security-specific logging methods
- Configurable verbosity

**Usage:**
```javascript
const { Logger, logger } = require('./utils/logger');

// Use default logger
logger.info('Application started');
logger.error('Critical error occurred', errorDetails);
logger.security('Security event detected', { ip: '192.168.1.1' });

// Create custom logger
const customLogger = new Logger(true, './logs/app.log');
```

### 🔒 validation.js
Comprehensive input validation and sanitization utilities.

**Features:**
- Type-safe validation for ports, timeouts, strings, emails, URLs, file paths
- Schema-based object validation
- Security-focused sanitization (XSS prevention, command injection protection)
- Custom error types (ValidationError, SecurityError)
- Detailed validation logging

**Usage:**
```javascript
const { Validator, ValidationError } = require('./utils/validation');

// Validate and sanitize inputs
const port = Validator.validatePort(process.env.PORT, 'webui_port');
const email = Validator.validateEmail(userInput.email);
const safePath = Validator.validateFilePath(filePath, { mustExist: true });

// Schema validation
const config = Validator.validateConnectionConfig({
    port: 3333,
    maxConnections: 10,
    timeout: 30000
});
```

### 🚨 error-handler.js
Advanced error handling with recovery mechanisms and categorization.

**Features:**
- Structured error analysis and categorization
- Automatic recovery attempts for operational errors
- Retry mechanisms with exponential backoff
- Global error handler setup
- Error logging with context preservation
- Custom error types (AppError)

**Usage:**
```javascript
const { ErrorHandler, AppError } = require('./utils/error-handler');

// Handle errors with automatic recovery
const result = await ErrorHandler.handleError(error, { operation: 'file_read' });

// Create retry handler
const retryHandler = ErrorHandler.createRetryHandler(3, 1000, 30000);
const result = await retryHandler(async () => {
    return await riskyOperation();
});

// Wrap functions for automatic error handling
const safeFunction = ErrorHandler.wrapAsync(myAsyncFunction);
```

### ⚡ performance-monitor.js
Real-time performance monitoring and optimization insights.

**Features:**
- Timer-based performance tracking
- System metrics monitoring (memory, CPU, load)
- Memory leak detection
- Performance bottleneck identification
- Automatic garbage collection triggers
- Performance reports and recommendations

**Usage:**
```javascript
const { PerformanceMonitor, monitor } = require('./utils/performance-monitor');

// Time operations
monitor.startTimer('database_query');
await performDatabaseQuery();
const duration = monitor.endTimer('database_query');

// Record custom metrics
monitor.recordMetric('api_response_time', responseTime);
monitor.incrementCounter('api_requests');

// Generate performance report
const report = monitor.generateReport();
```

### 🛡️ security.js
Comprehensive security utilities and threat detection.

**Features:**
- Secure token generation and verification
- Input sanitization and command validation
- Rate limiting and suspicious activity tracking
- IP blocking and threat detection
- Security event logging and reporting
- Content Security Policy headers
- Path traversal protection

**Usage:**
```javascript
const { SecurityManager, security } = require('./utils/security');

// Generate and verify tokens
const token = security.generateSecureToken();
const { hash, salt } = security.hashToken(token);
const isValid = security.verifyToken(inputToken, hash, salt);

// Sanitize inputs
const safeInput = security.sanitizeInput(userInput, { allowHtml: false });
const safeCommand = security.validateCommand(commandInput);

// Rate limiting
const allowed = security.checkRateLimit(clientIP, 60, 60000);

// Track suspicious activity
const result = security.trackSuspiciousActivity(clientIP, 'multiple_failed_logins', 'high');
```

## 🔧 Configuration

All utilities respect environment variables for configuration:

### Environment Variables
```bash
# Logging
NODE_ENV=development
LOG_FILE=/path/to/logfile.log

# Performance Monitoring  
PERFORMANCE_MONITORING_INTERVAL=30000
MEMORY_WARNING_THRESHOLD=104857600

# Security
SECURITY_TOKEN_EXPIRY=86400000
RATE_LIMIT_WINDOW=60000
MAX_REQUESTS_PER_MINUTE=60

# Validation
MAX_STRING_LENGTH=10000
MAX_FILE_PATH_LENGTH=4096
```

## 🚀 Integration

These utilities are designed to work together and integrate seamlessly with the Claude Loop application:

### Error Handling Chain
```javascript
// validation.js throws ValidationError
// error-handler.js catches and processes it
// logger.js logs the structured error
// security.js tracks security-related validation failures
```

### Performance Integration
```javascript
// performance-monitor.js tracks operation timing
// error-handler.js reports error rates
// logger.js provides performance logging
// security.js monitors for resource exhaustion attacks
```

### Security Integration
```javascript
// security.js validates and sanitizes inputs
// validation.js provides type-safe validation
// error-handler.js prevents information leakage
// logger.js provides security audit trails
```

## 🎯 Best Practices

1. **Always validate inputs** using the validation utilities before processing
2. **Use structured error handling** with the error-handler utilities
3. **Monitor performance** in production using the performance monitor
4. **Log security events** using the security-aware logging features
5. **Sanitize all user inputs** to prevent security vulnerabilities
6. **Use retry mechanisms** for transient failures
7. **Track performance metrics** to identify bottlenecks

## 🔍 Security Considerations

- All utilities implement defense-in-depth security principles
- Input validation prevents injection attacks
- Rate limiting prevents abuse
- Security logging provides audit trails
- Error handling prevents information disclosure
- Performance monitoring detects resource exhaustion attacks

## 📊 Monitoring and Alerting

The utilities provide comprehensive monitoring capabilities:

- **Performance metrics** for response times and resource usage
- **Security events** for threat detection and compliance
- **Error rates** for reliability monitoring
- **System health** for operational awareness

## 🛠️ Development

When adding new utilities:

1. Follow the established patterns for error handling and logging
2. Implement comprehensive input validation
3. Add security considerations and sanitization
4. Include performance monitoring where appropriate
5. Provide clear documentation and usage examples
6. Add appropriate tests for all functionality

## 📝 License

These utilities are part of the Claude Loop project and follow the same MIT license.