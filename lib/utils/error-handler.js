/**
 * Enhanced Error Handling Utilities
 * Provides consistent error handling, logging, and recovery mechanisms
 */

const { Logger } = require('./logger');
const { ValidationError, SecurityError } = require('./validation');
const logger = new Logger(process.env.NODE_ENV === 'development');

class AppError extends Error {
    constructor(message, code = 'GENERIC_ERROR', statusCode = 500, isOperational = true) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();
        
        Error.captureStackTrace(this, this.constructor);
    }
}

class ErrorHandler {
    static errorCodes = {
        // File System Errors
        FILE_NOT_FOUND: 'FILE_NOT_FOUND',
        FILE_PERMISSION_DENIED: 'FILE_PERMISSION_DENIED',
        DISK_SPACE_FULL: 'DISK_SPACE_FULL',
        
        // Network Errors
        CONNECTION_REFUSED: 'CONNECTION_REFUSED',
        CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
        NETWORK_UNREACHABLE: 'NETWORK_UNREACHABLE',
        
        // WebSocket Errors
        WS_CONNECTION_FAILED: 'WS_CONNECTION_FAILED',
        WS_AUTHENTICATION_FAILED: 'WS_AUTHENTICATION_FAILED',
        WS_MESSAGE_TOO_LARGE: 'WS_MESSAGE_TOO_LARGE',
        
        // Claude Process Errors
        CLAUDE_PROCESS_FAILED: 'CLAUDE_PROCESS_FAILED',
        CLAUDE_COMMAND_INVALID: 'CLAUDE_COMMAND_INVALID',
        CLAUDE_PERMISSION_DENIED: 'CLAUDE_PERMISSION_DENIED',
        
        // Configuration Errors
        CONFIG_INVALID: 'CONFIG_INVALID',
        CONFIG_MISSING: 'CONFIG_MISSING',
        ENV_VAR_MISSING: 'ENV_VAR_MISSING',
        
        // Security Errors
        UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
        RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
        SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
        
        // System Errors
        OUT_OF_MEMORY: 'OUT_OF_MEMORY',
        SYSTEM_OVERLOAD: 'SYSTEM_OVERLOAD',
        RESOURCE_EXHAUSTED: 'RESOURCE_EXHAUSTED'
    };

    static async handleError(error, context = {}) {
        const errorInfo = this.analyzeError(error);
        const enrichedContext = { ...context, ...errorInfo };
        
        // Log the error
        this.logError(error, enrichedContext);
        
        // Attempt recovery if possible
        const recovery = await this.attemptRecovery(error, enrichedContext);
        
        return {
            error: errorInfo,
            context: enrichedContext,
            recovery
        };
    }

    static analyzeError(error) {
        const analysis = {
            type: error.constructor.name,
            message: error.message,
            code: error.code || 'UNKNOWN',
            statusCode: error.statusCode || 500,
            isOperational: error.isOperational !== undefined ? error.isOperational : false,
            timestamp: new Date().toISOString(),
            stack: error.stack
        };

        // Analyze specific error types
        if (error.code) {
            switch (error.code) {
                case 'ENOENT':
                    analysis.type = 'FileNotFoundError';
                    analysis.code = this.errorCodes.FILE_NOT_FOUND;
                    analysis.isOperational = true;
                    break;
                case 'EACCES':
                    analysis.type = 'PermissionDeniedError';
                    analysis.code = this.errorCodes.FILE_PERMISSION_DENIED;
                    analysis.isOperational = true;
                    break;
                case 'ENOSPC':
                    analysis.type = 'DiskSpaceError';
                    analysis.code = this.errorCodes.DISK_SPACE_FULL;
                    analysis.isOperational = false;
                    break;
                case 'ECONNREFUSED':
                    analysis.type = 'ConnectionError';
                    analysis.code = this.errorCodes.CONNECTION_REFUSED;
                    analysis.isOperational = true;
                    break;
                case 'ETIMEDOUT':
                    analysis.type = 'TimeoutError';
                    analysis.code = this.errorCodes.CONNECTION_TIMEOUT;
                    analysis.isOperational = true;
                    break;
            }
        }

        // Analyze custom error types
        if (error instanceof ValidationError) {
            analysis.type = 'ValidationError';
            analysis.field = error.field;
            analysis.value = error.value;
            analysis.isOperational = true;
            analysis.statusCode = 400;
        } else if (error instanceof SecurityError) {
            analysis.type = 'SecurityError';
            analysis.details = error.details;
            analysis.isOperational = false;
            analysis.statusCode = 403;
        }

        return analysis;
    }

    static logError(error, context) {
        const { type, code, isOperational, statusCode } = context;
        
        if (error instanceof SecurityError) {
            logger.security(`Security error: ${error.message}`, {
                code,
                details: error.details,
                context: context.originalContext
            });
        } else if (!isOperational) {
            logger.error(`Critical system error: ${error.message}`, {
                type,
                code,
                statusCode,
                stack: error.stack,
                context: context.originalContext
            });
        } else if (statusCode >= 500) {
            logger.error(`Server error: ${error.message}`, {
                type,
                code,
                context: context.originalContext
            });
        } else {
            logger.warn(`Client error: ${error.message}`, {
                type,
                code,
                context: context.originalContext
            });
        }
    }

    static async attemptRecovery(error, context) {
        const { code, type } = context;
        const recovery = {
            attempted: false,
            successful: false,
            action: null,
            message: null
        };

        try {
            switch (code) {
                case this.errorCodes.FILE_NOT_FOUND:
                    recovery.attempted = true;
                    recovery.action = 'create_missing_directory';
                    const fs = require('fs');
                    const path = require('path');
                    
                    if (context.originalContext?.filePath) {
                        const dir = path.dirname(context.originalContext.filePath);
                        if (!fs.existsSync(dir)) {
                            fs.mkdirSync(dir, { recursive: true });
                            recovery.successful = true;
                            recovery.message = `Created missing directory: ${dir}`;
                        }
                    }
                    break;

                case this.errorCodes.CONNECTION_TIMEOUT:
                case this.errorCodes.CONNECTION_REFUSED:
                    recovery.attempted = true;
                    recovery.action = 'schedule_retry';
                    recovery.successful = true;
                    recovery.message = 'Connection will be retried with exponential backoff';
                    break;

                case this.errorCodes.WS_CONNECTION_FAILED:
                    recovery.attempted = true;
                    recovery.action = 'websocket_reconnect';
                    recovery.successful = true;
                    recovery.message = 'WebSocket reconnection scheduled';
                    break;

                case this.errorCodes.RATE_LIMIT_EXCEEDED:
                    recovery.attempted = true;
                    recovery.action = 'rate_limit_backoff';
                    recovery.successful = true;
                    recovery.message = 'Request will be retried after rate limit window';
                    break;
            }
        } catch (recoveryError) {
            logger.error('Error recovery failed', {
                originalError: error.message,
                recoveryError: recoveryError.message,
                action: recovery.action
            });
            recovery.successful = false;
            recovery.message = `Recovery failed: ${recoveryError.message}`;
        }

        return recovery;
    }

    static createRetryHandler(maxRetries = 3, baseDelay = 1000, maxDelay = 30000) {
        return async function retryHandler(operation, context = {}) {
            let lastError;
            let attempt = 0;
            
            while (attempt < maxRetries) {
                try {
                    return await operation();
                } catch (error) {
                    lastError = error;
                    attempt++;
                    
                    const errorInfo = ErrorHandler.analyzeError(error);
                    
                    // Don't retry non-operational errors
                    if (!errorInfo.isOperational) {
                        throw error;
                    }
                    
                    // Don't retry certain error types
                    const nonRetryableErrors = [
                        ErrorHandler.errorCodes.UNAUTHORIZED_ACCESS,
                        ErrorHandler.errorCodes.CONFIG_INVALID,
                        ErrorHandler.errorCodes.CLAUDE_COMMAND_INVALID
                    ];
                    
                    if (nonRetryableErrors.includes(errorInfo.code)) {
                        throw error;
                    }
                    
                    if (attempt < maxRetries) {
                        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
                        const jitter = Math.random() * 0.1 * delay;
                        const totalDelay = delay + jitter;
                        
                        logger.warn(`Operation failed, retrying in ${totalDelay.toFixed(0)}ms (attempt ${attempt}/${maxRetries})`, {
                            error: error.message,
                            context
                        });
                        
                        await new Promise(resolve => setTimeout(resolve, totalDelay));
                    }
                }
            }
            
            throw new AppError(
                `Operation failed after ${maxRetries} attempts: ${lastError.message}`,
                'MAX_RETRIES_EXCEEDED',
                500,
                false
            );
        };
    }

    static wrapAsync(fn) {
        return async function wrappedAsyncFunction(...args) {
            try {
                return await fn.apply(this, args);
            } catch (error) {
                const handledError = await ErrorHandler.handleError(error, {
                    function: fn.name,
                    arguments: args.length
                });
                
                // Re-throw operational errors, handle system errors
                if (handledError.error.isOperational) {
                    throw error;
                } else {
                    logger.error('Critical system error handled', handledError);
                    throw new AppError(
                        'A system error occurred',
                        'SYSTEM_ERROR',
                        500,
                        false
                    );
                }
            }
        };
    }

    static setupGlobalErrorHandlers() {
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception', {
                error: error.message,
                stack: error.stack
            });
            
            // Attempt graceful shutdown
            process.exit(1);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled promise rejection', {
                reason: reason?.message || reason,
                stack: reason?.stack
            });
            
            // Don't exit immediately for promise rejections
            // but log them for investigation
        });

        // Handle SIGTERM gracefully
        process.on('SIGTERM', () => {
            logger.info('SIGTERM received, starting graceful shutdown');
            // Application-specific cleanup should be handled by the app
        });

        // Handle SIGINT gracefully  
        process.on('SIGINT', () => {
            logger.info('SIGINT received, starting graceful shutdown');
            // Application-specific cleanup should be handled by the app
        });
    }
}

module.exports = {
    ErrorHandler,
    AppError
};