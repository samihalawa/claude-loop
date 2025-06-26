#!/usr/bin/env node

/**
 * Fix Critical Backend Issues
 * Addresses the key problems identified during comprehensive backend testing
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

class BackendIssueFixer {
    constructor() {
        this.fixes = {
            applied: 0,
            skipped: 0,
            failed: 0,
            issues: []
        };
    }

    async fixAllIssues() {
        console.log('🔧 Starting Critical Backend Issues Fixes\n');
        
        try {
            // Fix all identified critical issues
            await this.fixConcurrentOutputHandling();
            await this.improveErrorResponseFormat();
            await this.enhanceWebSocketErrorHandling();
            await this.improveCORSImplementation();
            await this.enhanceTokenSecurity();
            await this.addRateLimitHeaders();
            
            this.generateFixReport();
            
        } catch (error) {
            console.error('❌ Backend fix suite failed:', error.message);
            this.addFixResult('SUITE_FAILURE', false, error.message);
        }
    }

    async fixConcurrentOutputHandling() {
        console.log('🔄 Fixing Concurrent Output Handling...');
        
        try {
            // Read the current web-ui.js file
            const webUIPath = '/Users/samihalawa/git/claude-loop/lib/web-ui.js';
            const webUIContent = await fs.readFile(webUIPath, 'utf8');
            
            // Check if concurrent output handling is already improved
            if (webUIContent.includes('outputMutex') || webUIContent.includes('addOutputSafe')) {
                console.log('  ✅ Concurrent output handling already improved');
                this.addFixResult('CONCURRENT_OUTPUT_FIX', true, 'Already implemented', true);
                return;
            }
            
            // Create improved addOutput method with mutex-like handling
            const concurrentOutputFix = `
    // Thread-safe output addition with mutex-like behavior
    async addOutputSafe(message, type = 'info') {
        return new Promise((resolve) => {
            // Use setImmediate to ensure atomic operation
            setImmediate(() => {
                try {
                    this.addOutput(message, type);
                    resolve();
                } catch (error) {
                    console.error('Error adding output:', error.message);
                    resolve();
                }
            });
        });
    }

    // Enhanced addOutput with better concurrent handling
    addOutput(message, type = 'info') {
        // Input validation and sanitization
        if (message === null || message === undefined) {
            console.warn('Attempting to add null/undefined output, skipping');
            return;
        }
        
        // Convert non-string inputs to strings safely
        let processedMessage;
        try {
            if (typeof message === 'object') {
                processedMessage = JSON.stringify(message);
            } else {
                processedMessage = String(message);
            }
        } catch (error) {
            processedMessage = '[Object - could not stringify]';
        }
        
        // Sanitize message content
        processedMessage = this.sanitizeOutputMessage(processedMessage);
        
        const outputEntry = {
            timestamp: new Date().toISOString(),
            message: processedMessage,
            type: type
        };

        // Atomic operation to prevent race conditions
        const currentOutput = [...this.sessionData.output];
        currentOutput.push(outputEntry);
        
        // Memory management - keep only last 1000 entries
        if (currentOutput.length > 1000) {
            currentOutput.splice(0, currentOutput.length - 1000);
        }
        
        // Update session data atomically
        this.sessionData.output = currentOutput;

        // Broadcast to all connected clients
        this.broadcast({
            type: 'new_output',
            data: outputEntry
        });
    }

    // Enhanced message sanitization
    sanitizeOutputMessage(message) {
        if (typeof message !== 'string') {
            return String(message);
        }
        
        // Remove potential XSS content while preserving readability
        return message
            .replace(/<script[^>]*>.*?<\\/script>/gi, '[SCRIPT_REMOVED]')
            .replace(/<iframe[^>]*>.*?<\\/iframe>/gi, '[IFRAME_REMOVED]')
            .replace(/javascript:/gi, 'javascript_removed:')
            .replace(/on\\w+\\s*=/gi, 'event_removed=')
            .substring(0, 10000); // Limit message length
    }`;

            // Find the location to insert the fix
            const addOutputMatch = webUIContent.match(/addOutput\([^{]*\{[^}]+\}/s);
            
            if (addOutputMatch) {
                console.log('  🔧 Implementing concurrent output handling fix...');
                
                // Create backup
                await fs.writeFile(webUIPath + '.backup', webUIContent);
                
                // Apply the fix by replacing the addOutput method
                const fixedContent = webUIContent.replace(
                    /\/\/ Enhanced addOutput[\s\S]*?(?=\n    [a-zA-Z]|\n\})/,
                    concurrentOutputFix
                );
                
                await fs.writeFile(webUIPath, fixedContent);
                
                console.log('  ✅ Concurrent output handling fix applied');
                this.addFixResult('CONCURRENT_OUTPUT_FIX', true, 'Implemented atomic output operations with race condition prevention');
            } else {
                console.log('  ⚠️ Could not locate addOutput method for fixing');
                this.addFixResult('CONCURRENT_OUTPUT_FIX', false, 'Could not locate addOutput method');
            }
            
        } catch (error) {
            console.log(`  ❌ Failed to fix concurrent output handling: ${error.message}`);
            this.addFixResult('CONCURRENT_OUTPUT_FIX', false, error.message);
        }
        
        console.log('');
    }

    async improveErrorResponseFormat() {
        console.log('📝 Improving Error Response Format...');
        
        try {
            const webUIPath = '/Users/samihalawa/git/claude-loop/lib/web-ui.js';
            const webUIContent = await fs.readFile(webUIPath, 'utf8');
            
            // Check if error response format is already improved
            if (webUIContent.includes('sendErrorResponse') || webUIContent.includes('standardized error')) {
                console.log('  ✅ Error response format already improved');
                this.addFixResult('ERROR_RESPONSE_FORMAT', true, 'Already implemented', true);
                return;
            }
            
            // Create standardized error response method
            const errorResponseFix = `
    // Standardized error response method
    sendErrorResponse(res, statusCode, errorMessage, errorCode = null) {
        const errorResponse = {
            error: true,
            message: errorMessage,
            statusCode: statusCode,
            timestamp: new Date().toISOString()
        };
        
        if (errorCode) {
            errorResponse.code = errorCode;
        }
        
        // Add retry information for rate limiting
        if (statusCode === 429) {
            errorResponse.retryAfter = 60; // seconds
        }
        
        res.status(statusCode).json(errorResponse);
    }`;

            // Find middleware setup section to add the method
            const middlewareMatch = webUIContent.match(/setupMiddleware\(\)\s*\{/);
            
            if (middlewareMatch) {
                console.log('  🔧 Implementing standardized error response format...');
                
                // Insert the error response method before setupMiddleware
                const fixedContent = webUIContent.replace(
                    /setupMiddleware\(\)\s*\{/,
                    errorResponseFix + '\n\n    setupMiddleware() {'
                );
                
                // Also update 404 handler to use standardized format
                const finalContent = fixedContent.replace(
                    /res\.status\(404\)\.send\('Not Found'\)/g,
                    'this.sendErrorResponse(res, 404, "Not Found", "ROUTE_NOT_FOUND")'
                );
                
                await fs.writeFile(webUIPath, finalContent);
                
                console.log('  ✅ Error response format improvement applied');
                this.addFixResult('ERROR_RESPONSE_FORMAT', true, 'Implemented standardized JSON error responses');
            } else {
                console.log('  ⚠️ Could not locate middleware setup for error response fix');
                this.addFixResult('ERROR_RESPONSE_FORMAT', false, 'Could not locate middleware setup');
            }
            
        } catch (error) {
            console.log(`  ❌ Failed to improve error response format: ${error.message}`);
            this.addFixResult('ERROR_RESPONSE_FORMAT', false, error.message);
        }
        
        console.log('');
    }

    async enhanceWebSocketErrorHandling() {
        console.log('🔌 Enhancing WebSocket Error Handling...');
        
        try {
            const webUIPath = '/Users/samihalawa/git/claude-loop/lib/web-ui.js';
            const webUIContent = await fs.readFile(webUIPath, 'utf8');
            
            // Check if WebSocket error handling is already enhanced
            if (webUIContent.includes('handleLargeMessage') || webUIContent.includes('message size limit')) {
                console.log('  ✅ WebSocket error handling already enhanced');
                this.addFixResult('WEBSOCKET_ERROR_HANDLING', true, 'Already implemented', true);
                return;
            }
            
            // Create enhanced WebSocket message handling
            const wsErrorHandlingFix = `
            ws.on('message', (data) => {
                try {
                    // Check message size before processing
                    if (data.length > 1000000) { // 1MB limit
                        console.log(chalk.red(\`🚫 Message too large from \${clientIP}: \${data.length} bytes\`));
                        ws.close(1009, 'Message too large');
                        return;
                    }
                    
                    // Parse and validate JSON with size limits
                    let message;
                    try {
                        const messageStr = data.toString();
                        message = JSON.parse(messageStr);
                        
                        // Validate message structure
                        if (typeof message !== 'object' || message === null) {
                            throw new Error('Invalid message format');
                        }
                        
                        // Sanitize message content
                        message = sanitizeJSON(message, 5); // Limit nesting depth
                        
                    } catch (parseError) {
                        console.log(chalk.yellow(\`Invalid JSON message from \${clientIP}: \${parseError.message}\`));
                        // Send error response but don't close connection
                        this.sendToClient(ws, {
                            type: 'error',
                            message: 'Invalid message format'
                        });
                        return;
                    }
                    
                    // Handle different message types
                    switch (message.type) {
                        case 'ping':
                            this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
                            break;
                            
                        case 'request_session':
                            this.sendToClient(ws, {
                                type: 'session_data',
                                data: this.sessionData
                            });
                            break;
                            
                        default:
                            // Unknown message type - log but don't error
                            console.log(chalk.gray(\`Unknown message type from \${clientIP}: \${message.type}\`));
                            break;
                    }
                    
                } catch (error) {
                    console.error(chalk.red(\`WebSocket message error from \${clientIP}:\`), error.message);
                    // Don't close connection for recoverable errors
                    this.sendToClient(ws, {
                        type: 'error',
                        message: 'Message processing error'
                    });
                }
            });`;

            // Find WebSocket message handler to replace
            const messageHandlerMatch = webUIContent.match(/ws\.on\('message'[^}]+\}\);/s);
            
            if (messageHandlerMatch) {
                console.log('  🔧 Implementing enhanced WebSocket error handling...');
                
                const fixedContent = webUIContent.replace(
                    /ws\.on\('message'[^}]+\}\);/s,
                    wsErrorHandlingFix
                );
                
                await fs.writeFile(webUIPath, fixedContent);
                
                console.log('  ✅ WebSocket error handling enhancement applied');
                this.addFixResult('WEBSOCKET_ERROR_HANDLING', true, 'Implemented message size limits and better error recovery');
            } else {
                console.log('  ⚠️ Could not locate WebSocket message handler');
                this.addFixResult('WEBSOCKET_ERROR_HANDLING', false, 'Could not locate WebSocket message handler');
            }
            
        } catch (error) {
            console.log(`  ❌ Failed to enhance WebSocket error handling: ${error.message}`);
            this.addFixResult('WEBSOCKET_ERROR_HANDLING', false, error.message);
        }
        
        console.log('');
    }

    async improveCORSImplementation() {
        console.log('🌐 Improving CORS Implementation...');
        
        try {
            const webUIPath = '/Users/samihalawa/git/claude-loop/lib/web-ui.js';
            const webUIContent = await fs.readFile(webUIPath, 'utf8');
            
            // Check if CORS is already properly implemented
            if (webUIContent.includes('Access-Control-Allow-Origin') || webUIContent.includes('cors')) {
                console.log('  ✅ CORS implementation already present');
                this.addFixResult('CORS_IMPLEMENTATION', true, 'Already implemented', true);
                return;
            }
            
            // Create CORS middleware
            const corsMiddlewareFix = `
        // Enhanced CORS middleware with security considerations
        this.app.use((req, res, next) => {
            const origin = req.headers.origin;
            const allowedOrigins = [
                'http://localhost:3000',
                'http://localhost:3001',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:3001'
            ];
            
            // Allow localhost origins for development
            if (origin && (allowedOrigins.includes(origin) || /^http:\\/\\/localhost:\\d+$/.test(origin))) {
                res.setHeader('Access-Control-Allow-Origin', origin);
            }
            
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
            res.setHeader('Access-Control-Allow-Credentials', 'false'); // Security: don't allow credentials
            
            // Handle preflight requests
            if (req.method === 'OPTIONS') {
                res.status(204).send();
                return;
            }
            
            next();
        });`;

            // Find middleware setup section
            const middlewareMatch = webUIContent.match(/setupMiddleware\(\)\s*\{([^}]+)/s);
            
            if (middlewareMatch) {
                console.log('  🔧 Implementing CORS middleware...');
                
                const fixedContent = webUIContent.replace(
                    /setupMiddleware\(\)\s*\{/,
                    'setupMiddleware() {' + corsMiddlewareFix
                );
                
                await fs.writeFile(webUIPath, fixedContent);
                
                console.log('  ✅ CORS implementation improvement applied');
                this.addFixResult('CORS_IMPLEMENTATION', true, 'Implemented secure CORS with origin validation');
            } else {
                console.log('  ⚠️ Could not locate middleware setup for CORS fix');
                this.addFixResult('CORS_IMPLEMENTATION', false, 'Could not locate middleware setup');
            }
            
        } catch (error) {
            console.log(`  ❌ Failed to improve CORS implementation: ${error.message}`);
            this.addFixResult('CORS_IMPLEMENTATION', false, error.message);
        }
        
        console.log('');
    }

    async enhanceTokenSecurity() {
        console.log('🔑 Enhancing Token Security...');
        
        try {
            const webUIPath = '/Users/samihalawa/git/claude-loop/lib/web-ui.js';
            const webUIContent = await fs.readFile(webUIPath, 'utf8');
            
            // Check if token security is already enhanced
            if (webUIContent.includes('crypto.randomBytes(64)') || webUIContent.includes('token entropy')) {
                console.log('  ✅ Token security already enhanced');
                this.addFixResult('TOKEN_SECURITY', true, 'Already implemented', true);
                return;
            }
            
            // Check if we can improve token generation
            const tokenMatch = webUIContent.match(/this\.sessionToken = crypto\.randomBytes\((\d+)\)/);
            
            if (tokenMatch) {
                console.log('  🔧 Enhancing token security...');
                
                // Increase token entropy and add expiration validation
                const tokenSecurityFix = webUIContent.replace(
                    /this\.sessionToken = crypto\.randomBytes\(\d+\)\.toString\('hex'\);/,
                    `// Generate high-entropy session token (512 bits)
        this.sessionToken = crypto.randomBytes(64).toString('hex');`
                );
                
                // Add token validation method
                const tokenValidationMethod = `
    // Enhanced token validation with timing-safe comparison and expiration
    isValidToken(providedToken) {
        if (!providedToken || typeof providedToken !== 'string') {
            return false;
        }
        
        // Check token expiration
        if (Date.now() > this.tokenExpiry) {
            console.log(chalk.yellow('🔐 Token expired, generating new token'));
            this.regenerateToken();
            return false;
        }
        
        // Timing-safe comparison to prevent timing attacks
        const expectedBuffer = Buffer.from(this.sessionToken, 'hex');
        const providedBuffer = Buffer.from(providedToken, 'hex');
        
        // Ensure same length to prevent timing leaks
        if (expectedBuffer.length !== providedBuffer.length) {
            return false;
        }
        
        return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
    }
    
    // Token regeneration method
    regenerateToken() {
        this.sessionToken = crypto.randomBytes(64).toString('hex');
        this.tokenExpiry = Date.now() + (parseInt(process.env.WEBUI_TOKEN_EXPIRY_HOURS) || 24) * 60 * 60 * 1000;
        
        const maskedToken = this.sessionToken.substring(0, 8) + '...';
        console.log(chalk.cyan(\`🔐 New WebUI Access Token: \${maskedToken}\`));
        console.log(chalk.gray(\`Token expires: \${new Date(this.tokenExpiry).toLocaleString()}\`));
    }`;
                
                const finalContent = tokenSecurityFix + tokenValidationMethod;
                
                await fs.writeFile(webUIPath, finalContent);
                
                console.log('  ✅ Token security enhancement applied');
                this.addFixResult('TOKEN_SECURITY', true, 'Increased token entropy to 512 bits and added expiration validation');
            } else {
                console.log('  ⚠️ Could not locate token generation for enhancement');
                this.addFixResult('TOKEN_SECURITY', false, 'Could not locate token generation code');
            }
            
        } catch (error) {
            console.log(`  ❌ Failed to enhance token security: ${error.message}`);
            this.addFixResult('TOKEN_SECURITY', false, error.message);
        }
        
        console.log('');
    }

    async addRateLimitHeaders() {
        console.log('📊 Adding Rate Limit Headers...');
        
        try {
            const webUIPath = '/Users/samihalawa/git/claude-loop/lib/web-ui.js';
            const webUIContent = await fs.readFile(webUIPath, 'utf8');
            
            // Check if rate limit headers are already added
            if (webUIContent.includes('X-RateLimit-Limit') || webUIContent.includes('rate limit headers')) {
                console.log('  ✅ Rate limit headers already implemented');
                this.addFixResult('RATE_LIMIT_HEADERS', true, 'Already implemented', true);
                return;
            }
            
            // Create rate limit header middleware
            const rateLimitHeadersFix = `
        // Add rate limit headers to all responses
        this.app.use((req, res, next) => {
            const clientIP = this.getClientIP(req);
            const requests = this.requestCounts.get(clientIP) || [];
            const rateLimitWindow = 60; // 1 minute
            const rateLimitMax = 60; // Max requests per minute
            
            // Add rate limit headers
            res.setHeader('X-RateLimit-Limit', rateLimitMax);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimitMax - requests.length));
            res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + rateLimitWindow * 1000) / 1000));
            res.setHeader('X-RateLimit-Window', rateLimitWindow);
            
            next();
        });`;

            // Find rate limiting middleware section
            const rateLimitMatch = webUIContent.match(/\/\/ Rate limiting middleware/);
            
            if (rateLimitMatch) {
                console.log('  🔧 Adding rate limit headers...');
                
                const fixedContent = webUIContent.replace(
                    /\/\/ Rate limiting middleware/,
                    '// Rate limiting middleware' + rateLimitHeadersFix
                );
                
                await fs.writeFile(webUIPath, fixedContent);
                
                console.log('  ✅ Rate limit headers addition applied');
                this.addFixResult('RATE_LIMIT_HEADERS', true, 'Added standard rate limit headers to all responses');
            } else {
                console.log('  ⚠️ Could not locate rate limiting section for header addition');
                this.addFixResult('RATE_LIMIT_HEADERS', false, 'Could not locate rate limiting middleware');
            }
            
        } catch (error) {
            console.log(`  ❌ Failed to add rate limit headers: ${error.message}`);
            this.addFixResult('RATE_LIMIT_HEADERS', false, error.message);
        }
        
        console.log('');
    }

    addFixResult(fixName, applied, details, skipped = false) {
        if (skipped) {
            this.fixes.skipped++;
        } else if (applied) {
            this.fixes.applied++;
        } else {
            this.fixes.failed++;
        }
        
        this.fixes.issues.push({
            fix: fixName,
            status: skipped ? 'SKIPPED' : (applied ? 'APPLIED' : 'FAILED'),
            details: details,
            timestamp: new Date().toISOString()
        });
    }

    generateFixReport() {
        console.log('\n📋 CRITICAL BACKEND ISSUES FIX REPORT');
        console.log('='.repeat(70));
        
        const total = this.fixes.applied + this.fixes.skipped + this.fixes.failed;
        
        console.log(`\n📊 Fix Results: ${this.fixes.applied} applied, ${this.fixes.skipped} skipped, ${this.fixes.failed} failed\n`);
        
        // Group fixes by status
        const appliedFixes = this.fixes.issues.filter(f => f.status === 'APPLIED');
        const skippedFixes = this.fixes.issues.filter(f => f.status === 'SKIPPED');
        const failedFixes = this.fixes.issues.filter(f => f.status === 'FAILED');
        
        if (appliedFixes.length > 0) {
            console.log('✅ FIXES APPLIED:');
            appliedFixes.forEach(fix => {
                console.log(`   ✅ ${fix.fix.replace(/_/g, ' ')}`);
                console.log(`      ${fix.details}`);
            });
            console.log('');
        }
        
        if (skippedFixes.length > 0) {
            console.log('⏭️ FIXES SKIPPED:');
            skippedFixes.forEach(fix => {
                console.log(`   ⏭️ ${fix.fix.replace(/_/g, ' ')}`);
                console.log(`      ${fix.details}`);
            });
            console.log('');
        }
        
        if (failedFixes.length > 0) {
            console.log('❌ FIXES FAILED:');
            failedFixes.forEach(fix => {
                console.log(`   ❌ ${fix.fix.replace(/_/g, ' ')}`);
                console.log(`      ${fix.details}`);
            });
            console.log('');
        }
        
        // Overall assessment
        console.log('🎯 FIX ASSESSMENT:');
        if (this.fixes.applied >= 4) {
            console.log('   🎉 Excellent - Most critical issues addressed');
            console.log('   ✓ Backend stability significantly improved');
            console.log('   ✓ Security enhancements implemented');
            console.log('   ✓ Error handling strengthened');
        } else if (this.fixes.applied >= 2) {
            console.log('   ⚡ Good - Key issues addressed');
            console.log('   ✓ Important improvements implemented');
            console.log('   ⚠ Some issues may need manual attention');
        } else {
            console.log('   🔧 Manual intervention may be required');
            console.log('   ✗ Limited automatic fixes applied');
            console.log('   ✗ Review failed fixes and implement manually');
        }
        
        // Next steps
        console.log('\n💡 NEXT STEPS:');
        console.log('   1. Restart the WebUI server to apply fixes');
        console.log('   2. Run comprehensive backend tests to verify fixes');
        console.log('   3. Monitor error logs for any remaining issues');
        console.log('   4. Consider implementing additional monitoring');
        console.log('');
        
        // Save fix report
        const fixReportPath = '/Users/samihalawa/git/claude-loop/backend-fix-report.json';
        const reportData = {
            timestamp: new Date().toISOString(),
            summary: {
                applied: this.fixes.applied,
                skipped: this.fixes.skipped,
                failed: this.fixes.failed,
                total: total
            },
            fixes: this.fixes.issues,
            assessment: this.fixes.applied >= 4 ? 'Excellent' : 
                       this.fixes.applied >= 2 ? 'Good' : 'Needs Manual Intervention'
        };
        
        require('fs').writeFileSync(fixReportPath, JSON.stringify(reportData, null, 2));
        console.log(`💾 Fix report saved to: ${fixReportPath}`);
        
        return {
            appliedFixes: this.fixes.applied,
            totalFixes: total,
            criticalIssuesResolved: this.fixes.applied >= 3
        };
    }
}

// Run fixes if called directly
if (require.main === module) {
    const fixer = new BackendIssueFixer();
    fixer.fixAllIssues()
        .then(() => {
            console.log('🎉 Critical backend issues fix suite completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Fix suite failed:', error);
            process.exit(1);
        });
}

module.exports = BackendIssueFixer;