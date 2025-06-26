#!/usr/bin/env node

/**
 * Corrected Route Testing - Tests with proper authentication and expectations
 */

const http = require('http');
const WebUI = require('./lib/web-ui');

class CorrectedRouteTest {
    constructor() {
        this.webUI = null;
        this.testPort = 3341;
        this.testToken = null;
        this.results = [];
    }

    async run() {
        console.log('🔍 Corrected Route Testing\n');
        
        try {
            // Start server
            this.webUI = new WebUI(this.testPort);
            await this.webUI.start();
            this.testToken = this.webUI.sessionToken;
            console.log('✅ Server started\n');
            
            // Test routes with proper authentication expectations
            await this.testRoute('Dashboard HTML', '/', 'GET', 200, 'text/html', true);
            await this.wait(2000);
            
            await this.testRoute('Health API', '/health', 'GET', 200, 'application/json', true);
            await this.wait(2000);
            
            await this.testRoute('Session API', '/api/session', 'GET', 200, 'application/json', true);
            await this.wait(2000);
            
            // Test non-existent route WITH auth (should be 404 since token is valid)
            await this.testRoute('Non-existent Route (Auth)', '/nonexistent', 'GET', 404, null, true);
            await this.wait(2000);
            
            // Test auth failure
            await this.testRoute('No Auth Test', '/health', 'GET', 401, null, false);
            await this.wait(2000);
            
            // Test invalid token
            await this.testRoute('Invalid Token Test', '/health?token=invalid', 'GET', 401, null, false);
            await this.wait(2000);
            
            // Test different HTTP methods
            await this.testRoute('POST to Health (Not Allowed)', '/health', 'POST', 404, null, true);
            
            this.printResults();
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
        } finally {
            if (this.webUI) {
                await this.webUI.stop();
                console.log('✅ Server stopped');
            }
        }
    }

    async testRoute(name, path, method, expectedStatus, expectedContentType, useAuth = true) {
        try {
            const fullPath = useAuth ? `${path}?token=${this.testToken}` : path;
            const result = await this.makeRequest(fullPath, method);
            
            const statusOK = result.status === expectedStatus;
            const contentTypeOK = !expectedContentType || 
                (result.headers['content-type'] && result.headers['content-type'].includes(expectedContentType));
            
            const passed = statusOK && contentTypeOK;
            
            console.log(`${passed ? '✅' : '❌'} ${name}:`);
            console.log(`   Status: ${result.status} (expected ${expectedStatus}) ${statusOK ? '✅' : '❌'}`);
            
            if (expectedContentType) {
                const actualContentType = result.headers['content-type'] || 'none';
                console.log(`   Content-Type: ${actualContentType} ${contentTypeOK ? '✅' : '❌'}`);
            }
            
            // Show response preview for debugging
            if (result.data && result.data.length > 0) {
                const preview = result.data.substring(0, 100).replace(/\n/g, ' ');
                console.log(`   Response preview: ${preview}...`);
            }
            
            this.results.push({ name, passed, status: result.status, expectedStatus });
            
        } catch (error) {
            console.log(`❌ ${name}: ${error.message}`);
            this.results.push({ name, passed: false, error: error.message });
        }
        
        console.log('');
    }

    async makeRequest(path, method = 'GET') {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: this.testPort,
                path: path,
                method: method,
                timeout: 5000
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    printResults() {
        const passed = this.results.filter(r => r.passed).length;
        const total = this.results.length;
        
        console.log('📊 SUMMARY');
        console.log('='.repeat(40));
        console.log(`Results: ${passed}/${total} tests passed (${(passed/total*100).toFixed(1)}%)`);
        
        console.log('\n📋 Detailed Results:');
        this.results.forEach(test => {
            const status = test.passed ? '✅ PASS' : '❌ FAIL';
            console.log(`   ${status} ${test.name}`);
            if (!test.passed && test.status) {
                console.log(`      Expected: ${test.expectedStatus}, Got: ${test.status}`);
            }
            if (!test.passed && test.error) {
                console.log(`      Error: ${test.error}`);
            }
        });
        
        const failed = this.results.filter(r => !r.passed);
        if (failed.length === 0) {
            console.log('\n🎉 All route tests passed!');
            console.log('✅ Express.js routes are working correctly');
        } else {
            console.log(`\n⚠️ ${failed.length} test(s) need attention`);
        }
    }
}

// Run test
if (require.main === module) {
    const test = new CorrectedRouteTest();
    test.run().then(() => {
        console.log('\n✅ Corrected route testing completed');
        process.exit(0);
    }).catch(error => {
        console.error('💥 Test failed:', error);
        process.exit(1);
    });
}

module.exports = CorrectedRouteTest;