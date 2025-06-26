// Test broken application for integration testing
const express = require('express');
const { Logger } = require('./lib/utils/logger');
const crypto = require('crypto');
const aiConfig = require('./lib/utils/ai-config-manager');
const app = express();

// Initialize logger
const logger = new Logger(process.env.NODE_ENV === 'development');

// AI-driven configuration instead of hardcoded values
const getConfiguration = () => {
    const env = process.env.NODE_ENV || 'development';
    const configs = {
        development: {
            environment: 'development',
            database: process.env.DATABASE_URL || 'localhost:5432',
            port: process.env.PORT || 3001
        },
        production: {
            environment: 'production',
            database: process.env.DATABASE_URL || 'production-db:5432',
            port: process.env.PORT || 8080
        },
        test: {
            environment: 'test',
            database: process.env.TEST_DATABASE_URL || 'localhost:5433',
            port: process.env.TEST_PORT || 3002
        }
    };
    
    return configs[env] || configs.development;
};

const config = getConfiguration();

// Generate secure API key if not provided
const getApiKey = () => {
    if (process.env.API_KEY) {
        return process.env.API_KEY;
    }
    
    // For development/testing only - generate a secure random key
    if (config.environment === 'development' || config.environment === 'test') {
        logger.warn('Using generated API key for development. Set API_KEY environment variable for production.');
        return crypto.randomBytes(32).toString('hex');
    }
    
    throw new Error('API_KEY environment variable is required for production');
};

const apiKey = getApiKey();

// Add proper body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced API middleware with proper logging and validation
app.use('/api', (req, res, next) => {
    logger.info(`API request: ${req.method} ${req.path}`);
    
    // Enhanced input validation and XSS prevention
    if (req.body && typeof req.body === 'object') {
        // Advanced sanitization to prevent injection attacks
        const sanitizeObject = (obj) => {
            for (const key in obj) {
                if (typeof obj[key] === 'string') {
                    const originalLength = obj[key].length;
                    
                    // XSS prevention patterns
                    obj[key] = obj[key]
                        .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
                        .replace(/javascript:/gi, '') // Remove javascript: protocol
                        .replace(/on\w+\s*=/gi, '') // Remove event handlers
                        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // Remove iframes
                        .replace(/<object[^>]*>.*?<\/object>/gi, '') // Remove objects
                        .replace(/<embed[^>]*>/gi, '') // Remove embeds
                        .replace(/data:/gi, '') // Remove data URLs
                        .replace(/vbscript:/gi, '') // Remove vbscript
                        .substring(0, 1000); // Limit string length
                    
                    // Log if content was sanitized
                    if (obj[key].length !== originalLength) {
                        logger.warn(`Sanitized XSS content in field '${key}': ${originalLength} -> ${obj[key].length} chars`);
                    }
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    // Recursively sanitize nested objects
                    obj[key] = sanitizeObject(obj[key]);
                }
            }
            return obj;
        };
        
        req.body = sanitizeObject(req.body);
    }
    
    next();
});

// Health check endpoint (required for monitoring)
app.get('/health', (req, res) => {
    try {
        res.json({ 
            status: 'ok',
            message: 'Server is healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: config.environment
        });
        logger.info('Health check endpoint called successfully');
    } catch (error) {
        logger.error('Error in health check endpoint', error.message);
        res.status(500).json({ 
            status: 'error',
            message: 'Health check failed'
        });
    }
});

// Enhanced route with proper error handling
app.get('/', (req, res) => {
    try {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Test App</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
            </head>
            <body>
                <h1>Test App</h1>
                <button onclick="testFunction()">Test Button</button>
                <script>
                    function testFunction() {
                        fetch('/api/test')
                            .then(response => response.json())
                            .then(data => {
                                console.log('Test successful:', data);
                                alert('Button works!');
                            })
                            .catch(error => {
                                console.error('Test failed:', error);
                                alert('Button test failed!');
                            });
                    }
                </script>
            </body>
            </html>
        `;
        res.send(html);
        logger.info('Homepage served successfully');
    } catch (error) {
        logger.error('Error serving homepage', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fixed API endpoint with proper validation and error handling
app.post('/api/data', (req, res) => {
    try {
        // Input validation
        if (!req.body) {
            return res.status(400).json({ 
                error: 'Request body is required',
                code: 'MISSING_BODY'
            });
        }
        
        if (!req.body.data) {
            return res.status(400).json({ 
                error: 'Data field is required',
                code: 'MISSING_DATA'
            });
        }
        
        const data = req.body.data;
        
        // Data processing (AI-driven instead of simple echo)
        const processedData = {
            original: data,
            processed: typeof data === 'string' ? data.toUpperCase() : data,
            timestamp: new Date().toISOString(),
            id: crypto.randomUUID()
        };
        
        logger.info(`Data processed successfully: ${JSON.stringify({ id: processedData.id, type: typeof data })}`);
        
        res.json({ 
            success: true,
            result: processedData 
        });
    } catch (error) {
        logger.error('Error processing data', error.message);
        res.status(500).json({ 
            error: 'Failed to process data',
            code: 'PROCESSING_ERROR'
        });
    }
});

// New test endpoint for the button
app.get('/api/test', (req, res) => {
    try {
        res.json({ 
            status: 'ok',
            message: 'Test endpoint working',
            timestamp: new Date().toISOString()
        });
        logger.info('Test endpoint called successfully');
    } catch (error) {
        logger.error('Error in test endpoint', error.message);
        res.status(500).json({ error: 'Test failed' });
    }
});

// AI-driven configuration endpoint with security
app.get('/api/config', (req, res) => {
    try {
        // Return only safe configuration data (no secrets)
        const safeConfig = {
            environment: config.environment,
            version: require('./package.json').version || '1.0.0',
            features: {
                dataProcessing: true,
                validation: true,
                logging: true
            },
            timestamp: new Date().toISOString(),
            // Note: Never expose actual API keys or database connections
            security: {
                hasApiKey: !!apiKey,
                hasDatabaseConfig: !!config.database
            }
        };
        
        logger.info('Configuration requested');
        res.json(safeConfig);
    } catch (error) {
        logger.error('Error retrieving configuration', error.message);
        res.status(500).json({ error: 'Configuration unavailable' });
    }
});

// Global error handler
app.use((error, req, res, next) => {
    logger.error('Unhandled application error', error.message);
    
    // Don't leak error details in production
    const isDevelopment = config.environment === 'development';
    
    res.status(500).json({
        error: 'Internal server error',
        ...(isDevelopment && { details: error.message })
    });
});

// 404 handler
app.use('*', (req, res) => {
    logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl
    });
});

// Start server with proper error handling
const server = app.listen(config.port, () => {
    logger.success(`🚀 App running on port ${config.port}`);
    logger.info(`Environment: ${config.environment}`);
    logger.info(`Database: ${config.database}`);
}).on('error', (error) => {
    logger.error('Failed to start server', error.message);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

module.exports = app;