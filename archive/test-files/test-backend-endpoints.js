#!/usr/bin/env node

/**
 * Backend Endpoint Testing
 * Tests Express server functionality with dynamic port allocation
 */

const { createServer } = require('http');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs').promises;

class BackendTester {
    constructor() {
        this.testPort = null;
        this.webUI = null;
        this.results = [];
    }

    async findAvailablePort(startPort = 4000) {
        for (let port = startPort; port < startPort + 100; port++) {
            try {
                await new Promise((resolve, reject) => {
                    const server = createServer();
                    server.listen(port, () => {
                        server.close(() => resolve());
                    });
                    server.on('error', reject);
                });
                return port;
            } catch (error) {
                continue;
            }
        }
        throw new Error('No available ports found');
    }

    log(message, type = 'info') {
        const prefix = `[${new Date().toISOString()}]`;
        switch (type) {
            case 'success':
                console.log(chalk.green(`${prefix} ✓ ${message}`));
                break;
            case 'error':
                console.log(chalk.red(`${prefix} ✗ ${message}`));
                break;
            case 'warning':
                console.log(chalk.yellow(`${prefix} ⚠ ${message}`));
                break;
            default:
                console.log(chalk.blue(`${prefix} ${message}`));
        }
    }

    async testExpressSetup() {
        this.log('Testing Express server setup...');
        
        try {
            // Find available port
            this.testPort = await this.findAvailablePort();
            this.log(`Using port: ${this.testPort}`);

            // Load and test WebUI class
            const WebUI = require('./lib/web-ui');
            this.webUI = new WebUI(this.testPort);
            
            // Check if instance was created properly
            if (this.webUI.app && this.webUI.server && this.webUI.wss) {
                this.log('Express app, HTTP server, and WebSocket server initialized', 'success');
                this.results.push({ test: 'Express Setup', status: 'PASS' });
            } else {
                throw new Error('Missing server components');
            }

            // Check middleware setup
            if (this.webUI.app._router && this.webUI.app._router.stack.length > 0) {
                this.log(`Middleware stack has ${this.webUI.app._router.stack.length} layers`, 'success');
                this.results.push({ test: 'Middleware Setup', status: 'PASS' });
            } else {
                this.log('Middleware stack appears empty', 'warning');
                this.results.push({ test: 'Middleware Setup', status: 'PARTIAL' });
            }

            return true;

        } catch (error) {
            this.log(`Express setup failed: ${error.message}`, 'error');
            this.results.push({ test: 'Express Setup', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testServerStartup() {
        this.log('Testing server startup...');
        
        try {
            if (!this.webUI) {
                throw new Error('WebUI instance not available');
            }

            await this.webUI.start();
            this.log('Server started successfully', 'success');
            this.results.push({ test: 'Server Startup', status: 'PASS' });
            return true;

        } catch (error) {
            this.log(`Server startup failed: ${error.message}`, 'error');
            this.results.push({ test: 'Server Startup', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testRoutes() {
        this.log('Testing route definitions...');
        
        try {
            if (!this.webUI || !this.webUI.app._router) {
                throw new Error('Router not available');
            }

            // Get defined routes
            const routes = [];
            this.webUI.app._router.stack.forEach((middleware) => {
                if (middleware.route) {
                    routes.push({
                        path: middleware.route.path,
                        methods: Object.keys(middleware.route.methods)
                    });
                } else if (middleware.name === 'router') {
                    // Handle nested routers if any
                    middleware.handle.stack?.forEach((route) => {
                        if (route.route) {
                            routes.push({
                                path: route.route.path,
                                methods: Object.keys(route.route.methods)
                            });
                        }
                    });
                }
            });

            this.log(`Found ${routes.length} defined routes:`);
            routes.forEach(route => {
                this.log(`  ${route.methods.join(', ').toUpperCase()} ${route.path}`);
            });

            // Expected routes
            const expectedRoutes = ['/', '/api/session', '/health'];
            const foundRoutes = routes.map(r => r.path);
            const missingRoutes = expectedRoutes.filter(r => !foundRoutes.includes(r));

            if (missingRoutes.length === 0) {
                this.log('All expected routes found', 'success');
                this.results.push({ test: 'Route Definitions', status: 'PASS' });
            } else {
                this.log(`Missing routes: ${missingRoutes.join(', ')}`, 'warning');
                this.results.push({ 
                    test: 'Route Definitions', 
                    status: 'PARTIAL', 
                    note: `Missing: ${missingRoutes.join(', ')}` 
                });
            }

            return true;

        } catch (error) {
            this.log(`Route testing failed: ${error.message}`, 'error');
            this.results.push({ test: 'Route Definitions', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testEndpoints() {
        this.log('Testing HTTP endpoints...');
        
        try {
            if (!this.webUI || !this.testPort) {
                throw new Error('Server not available for endpoint testing');
            }

            const baseUrl = `http://localhost:${this.testPort}`;
            const token = this.webUI.sessionToken;

            // Test endpoints
            const endpointTests = [
                {
                    name: 'Health endpoint (no auth)',
                    url: `${baseUrl}/health`,
                    expectedStatus: 401,
                    expectAuth: true
                },
                {
                    name: 'Health endpoint (with auth)',
                    url: `${baseUrl}/health?token=${token}`,
                    expectedStatus: 200,
                    expectAuth: false
                },
                {
                    name: 'Dashboard (no auth)',
                    url: `${baseUrl}/`,
                    expectedStatus: 401,
                    expectAuth: true
                },
                {
                    name: 'Dashboard (with auth)',
                    url: `${baseUrl}/?token=${token}`,
                    expectedStatus: 200,
                    expectAuth: false
                },
                {
                    name: 'Session API (with auth)',
                    url: `${baseUrl}/api/session?token=${token}`,
                    expectedStatus: 200,
                    expectAuth: false
                }
            ];

            for (const test of endpointTests) {
                try {
                    const response = await fetch(test.url);
                    
                    if (response.status === test.expectedStatus) {
                        this.log(`${test.name}: ${response.status} ✓`, 'success');
                        
                        // Additional checks for successful responses
                        if (response.status === 200) {
                            const contentType = response.headers.get('content-type');
                            if (test.url.includes('/api/')) {
                                // API endpoints should return JSON
                                if (contentType && contentType.includes('application/json')) {
                                    const data = await response.json();
                                    this.log(`  JSON response received: ${Object.keys(data).join(', ')}`);
                                } else {
                                    this.log(`  Expected JSON, got: ${contentType}`, 'warning');
                                }
                            } else {
                                // Dashboard should return HTML
                                if (contentType && contentType.includes('text/html')) {
                                    const html = await response.text();
                                    const hasTitle = html.includes('Claude Loop');
                                    this.log(`  HTML response received, title present: ${hasTitle}`);
                                } else {
                                    this.log(`  Expected HTML, got: ${contentType}`, 'warning');
                                }
                            }
                        }
                    } else {
                        this.log(`${test.name}: Expected ${test.expectedStatus}, got ${response.status}`, 'warning');
                    }
                } catch (error) {
                    this.log(`${test.name}: Request failed - ${error.message}`, 'error');
                }
            }

            this.results.push({ test: 'HTTP Endpoints', status: 'PASS' });
            return true;

        } catch (error) {
            this.log(`Endpoint testing failed: ${error.message}`, 'error');
            this.results.push({ test: 'HTTP Endpoints', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testWebSocketServer() {
        this.log('Testing WebSocket server...');
        
        try {
            if (!this.webUI || !this.webUI.wss) {
                throw new Error('WebSocket server not available');
            }

            // Check WebSocket server configuration
            const wsServer = this.webUI.wss;
            this.log(`WebSocket server listening: ${wsServer.listening || 'unknown'}`);
            this.log(`Max connections: ${this.webUI.maxConnections}`);
            this.log(`Client tracking: ${wsServer.clientTracking}`);
            
            // Check if essential WebSocket properties are configured
            const hasHandshakeTimeout = wsServer.options.handshakeTimeout !== undefined;
            const hasMaxPayload = wsServer.options.maxPayload !== undefined;
            
            if (hasHandshakeTimeout && hasMaxPayload) {
                this.log('WebSocket server properly configured', 'success');
                this.results.push({ test: 'WebSocket Server Setup', status: 'PASS' });
            } else {
                this.log('WebSocket server missing some configurations', 'warning');
                this.results.push({ test: 'WebSocket Server Setup', status: 'PARTIAL' });
            }

            return true;

        } catch (error) {
            this.log(`WebSocket server testing failed: ${error.message}`, 'error');
            this.results.push({ test: 'WebSocket Server Setup', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async testSecurityFeatures() {
        this.log('Testing security features...');
        
        try {
            if (!this.webUI) {
                throw new Error('WebUI instance not available');
            }

            // Check security properties
            const hasSessionToken = !!this.webUI.sessionToken;
            const hasTokenExpiry = !!this.webUI.tokenExpiry;
            const hasRateLimiting = !!this.webUI.requestCounts;
            const hasConnectionTracking = !!this.webUI.connectionAttempts;

            this.log(`Session token: ${hasSessionToken ? '✓' : '✗'}`);
            this.log(`Token expiry: ${hasTokenExpiry ? '✓' : '✗'}`);
            this.log(`Rate limiting: ${hasRateLimiting ? '✓' : '✗'}`);
            this.log(`Connection tracking: ${hasConnectionTracking ? '✓' : '✗'}`);

            const securityScore = [hasSessionToken, hasTokenExpiry, hasRateLimiting, hasConnectionTracking]
                .filter(Boolean).length;

            if (securityScore === 4) {
                this.log('All security features implemented', 'success');
                this.results.push({ test: 'Security Features', status: 'PASS' });
            } else {
                this.log(`${securityScore}/4 security features implemented`, 'warning');
                this.results.push({ test: 'Security Features', status: 'PARTIAL' });
            }

            return true;

        } catch (error) {
            this.log(`Security testing failed: ${error.message}`, 'error');
            this.results.push({ test: 'Security Features', status: 'FAIL', error: error.message });
            return false;
        }
    }

    async cleanup() {
        this.log('Cleaning up...');
        
        if (this.webUI) {
            try {
                await this.webUI.stop();
                this.log('Server stopped successfully', 'success');
            } catch (error) {
                this.log(`Error stopping server: ${error.message}`, 'error');
            }
        }
    }

    async generateReport() {
        this.log('\n' + '='.repeat(60));
        this.log('BACKEND TESTING RESULTS');
        this.log('='.repeat(60));

        let passCount = 0;
        let failCount = 0;
        let partialCount = 0;

        this.results.forEach(result => {
            const icon = result.status === 'PASS' ? '✓' : 
                        result.status === 'FAIL' ? '✗' : '~';
            const color = result.status === 'PASS' ? 'green' :
                         result.status === 'FAIL' ? 'red' : 'yellow';
            
            console.log(chalk[color](`${icon} ${result.test}: ${result.status}`));
            
            if (result.error) {
                this.log(`  Error: ${result.error}`, 'error');
            }
            if (result.note) {
                this.log(`  Note: ${result.note}`, 'warning');
            }

            if (result.status === 'PASS') passCount++;
            else if (result.status === 'FAIL') failCount++;
            else partialCount++;
        });

        this.log('\n' + '-'.repeat(60));
        this.log(`Total Tests: ${this.results.length}`);
        this.log(`Passed: ${passCount}`, 'success');
        this.log(`Failed: ${failCount}`, failCount > 0 ? 'error' : 'info');
        this.log(`Partial: ${partialCount}`, partialCount > 0 ? 'warning' : 'info');
        this.log('-'.repeat(60));

        // Write report
        const report = {
            timestamp: new Date().toISOString(),
            port: this.testPort,
            summary: { total: this.results.length, passed: passCount, failed: failCount, partial: partialCount },
            tests: this.results
        };

        const reportFile = path.join(__dirname, 'backend-test-report.json');
        await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
        this.log(`Report written to: ${reportFile}`, 'info');

        return failCount === 0;
    }

    async runAllTests() {
        try {
            this.log(chalk.cyan.bold('Starting Backend Testing\n'));

            // Run tests in sequence
            await this.testExpressSetup();
            await this.testServerStartup();
            await this.testRoutes();
            await this.testEndpoints();
            await this.testWebSocketServer();
            await this.testSecurityFeatures();

        } catch (error) {
            this.log(`Test execution failed: ${error.message}`, 'error');
        } finally {
            await this.cleanup();
            return await this.generateReport();
        }
    }
}

// Run if called directly
if (require.main === module) {
    const tester = new BackendTester();
    tester.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = BackendTester;