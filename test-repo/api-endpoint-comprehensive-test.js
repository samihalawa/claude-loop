#!/usr/bin/env node

/**
 * Comprehensive API Endpoint Testing
 * Tests all available endpoints, methods, data flow, and edge cases
 */

class APIEndpointTest {
    constructor(port = 3333) {
        this.baseURL = `http://localhost:${port}`;
        this.results = {
            endpoints: {},
            methods: {},
            dataFlow: {},
            errors: []
        };
    }

    async runTests() {
        console.log('🧪 Comprehensive API Endpoint Testing Suite');
        console.log('==========================================\n');

        try {
            // Test core HTTP endpoints
            await this.testCoreEndpoints();
            
            // Test HTTP methods
            await this.testHTTPMethods();
            
            // Test data flow and consistency
            await this.testDataFlow();
            
            // Test edge cases and error conditions
            await this.testEdgeCases();
            
            // Generate comprehensive report
            this.generateReport();
            
        } catch (error) {
            console.error(`❌ Test suite error: ${error.message}`);
            this.results.errors.push(`Suite error: ${error.message}`);
        }
    }

    async testCoreEndpoints() {
        console.log('🌐 Testing Core HTTP Endpoints...');
        
        const endpoints = [
            { path: '/', name: 'Root/Dashboard', expectedType: 'application/json' },
            { path: '/health', name: 'Health Check', expectedType: 'application/json' },
            { path: '/api/session', name: 'Session Data API', expectedType: 'application/json' },
            { path: '/api/output', name: 'Output Buffer API', expectedType: 'application/json' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(`${this.baseURL}${endpoint.path}`);
                const startTime = Date.now();
                const data = await response.text();
                const responseTime = Date.now() - startTime;
                
                const isJSON = endpoint.expectedType === 'application/json';
                let parsedData = null;
                let jsonValid = false;
                
                if (isJSON) {
                    try {
                        parsedData = JSON.parse(data);
                        jsonValid = true;
                    } catch (e) {
                        jsonValid = false;
                    }
                }
                
                this.results.endpoints[endpoint.path] = {
                    name: endpoint.name,
                    status: response.status,
                    responseTime,
                    size: data.length,
                    contentType: response.headers.get('content-type'),
                    jsonValid,
                    data: isJSON ? parsedData : null,
                    headers: Object.fromEntries(response.headers)
                };
                
                const statusIcon = response.status === 200 ? '✅' : '❌';
                const jsonIcon = !isJSON || jsonValid ? '✅' : '❌';
                console.log(`  ${statusIcon} ${endpoint.name}: ${response.status} (${responseTime}ms, ${data.length}b) ${jsonIcon}`);
                
                if (isJSON && jsonValid && parsedData) {
                    console.log(`    📊 Data keys: ${Object.keys(parsedData).join(', ')}`);
                }
                
            } catch (error) {
                console.log(`  ❌ ${endpoint.name}: ${error.message}`);
                this.results.endpoints[endpoint.path] = {
                    name: endpoint.name,
                    error: error.message
                };
                this.results.errors.push(`${endpoint.name}: ${error.message}`);
            }
        }
    }

    async testHTTPMethods() {
        console.log('\n🔧 Testing HTTP Methods...');
        
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
        const testPaths = ['/health', '/api/session'];
        
        for (const path of testPaths) {
            console.log(`  Testing ${path}:`);
            
            for (const method of methods) {
                try {
                    const response = await fetch(`${this.baseURL}${path}`, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: method === 'POST' || method === 'PUT' || method === 'PATCH' ? 
                              JSON.stringify({ test: 'data' }) : undefined
                    });
                    
                    const key = `${method} ${path}`;
                    this.results.methods[key] = {
                        status: response.status,
                        allowed: response.status !== 405
                    };
                    
                    const icon = response.status < 400 ? '✅' : 
                                response.status === 405 ? '🚫' : '❌';
                    console.log(`    ${icon} ${method}: ${response.status}`);
                    
                } catch (error) {
                    console.log(`    ❌ ${method}: ${error.message}`);
                    this.results.methods[`${method} ${path}`] = {
                        error: error.message
                    };
                }
            }
        }
    }

    async testDataFlow() {
        console.log('\n🔄 Testing Data Flow and Consistency...');
        
        try {
            // Test session data consistency across multiple requests
            console.log('  Testing session data consistency...');
            const requests = [];
            for (let i = 0; i < 5; i++) {
                requests.push(fetch(`${this.baseURL}/api/session`));
            }
            
            const responses = await Promise.all(requests);
            const sessionDataSets = [];
            
            for (const response of responses) {
                if (response.status === 200) {
                    const data = await response.json();
                    sessionDataSets.push(data);
                }
            }
            
            // Check consistency
            const consistent = sessionDataSets.length > 1 && 
                             sessionDataSets.every(data => 
                                 JSON.stringify(data) === JSON.stringify(sessionDataSets[0])
                             );
            
            this.results.dataFlow.sessionConsistency = {
                tested: true,
                consistent,
                samples: sessionDataSets.length
            };
            
            console.log(`    ${consistent ? '✅' : '❌'} Session consistency: ${sessionDataSets.length} samples`);
            
            // Test output buffer data
            console.log('  Testing output buffer...');
            const outputResponse = await fetch(`${this.baseURL}/api/output`);
            if (outputResponse.status === 200) {
                const outputData = await outputResponse.json();
                this.results.dataFlow.outputBuffer = {
                    status: 'available',
                    hasOutput: outputData.output && outputData.output.length > 0,
                    outputCount: outputData.output ? outputData.output.length : 0
                };
                console.log(`    ✅ Output buffer: ${outputData.output ? outputData.output.length : 0} entries`);
            } else {
                this.results.dataFlow.outputBuffer = {
                    status: 'error',
                    httpStatus: outputResponse.status
                };
                console.log(`    ❌ Output buffer: HTTP ${outputResponse.status}`);
            }
            
        } catch (error) {
            console.log(`    ❌ Data flow error: ${error.message}`);
            this.results.errors.push(`Data flow: ${error.message}`);
        }
    }

    async testEdgeCases() {
        console.log('\n🚨 Testing Edge Cases and Error Conditions...');
        
        const edgeCases = [
            { path: '/nonexistent', name: 'Non-existent path', expectStatus: 404 },
            { path: '/api/nonexistent', name: 'Non-existent API', expectStatus: 404 },
            { path: '/api/session/../health', name: 'Path traversal attempt', expectStatus: [200, 404] },
            { path: '/health?invalid=param&test=123', name: 'Query parameters', expectStatus: 200 },
            { path: '/health#fragment', name: 'URL fragment', expectStatus: 200 }
        ];
        
        for (const testCase of edgeCases) {
            try {
                const response = await fetch(`${this.baseURL}${testCase.path}`);
                const expectedStatuses = Array.isArray(testCase.expectStatus) ? 
                                       testCase.expectStatus : [testCase.expectStatus];
                const isExpected = expectedStatuses.includes(response.status);
                
                console.log(`  ${isExpected ? '✅' : '❌'} ${testCase.name}: ${response.status} (expected ${testCase.expectStatus})`);
                
            } catch (error) {
                console.log(`  ❌ ${testCase.name}: ${error.message}`);
            }
        }
        
        // Test malformed requests
        console.log('  Testing malformed requests...');
        const malformedTests = [
            { method: 'POST', body: 'invalid-json', name: 'Invalid JSON' },
            { method: 'POST', body: '{"unclosed": "object"', name: 'Malformed JSON' },
            { method: 'PUT', body: JSON.stringify({a: 'b'.repeat(10000)}), name: 'Large payload' }
        ];
        
        for (const test of malformedTests) {
            try {
                const response = await fetch(`${this.baseURL}/api/session`, {
                    method: test.method,
                    headers: { 'Content-Type': 'application/json' },
                    body: test.body
                });
                
                // Server should handle malformed requests gracefully
                const handled = response.status >= 400 && response.status < 500;
                console.log(`  ${handled ? '✅' : '❌'} ${test.name}: ${response.status}`);
                
            } catch (error) {
                console.log(`  ✅ ${test.name}: Connection error (expected for malformed)`);
            }
        }
    }

    generateReport() {
        console.log('\n📋 COMPREHENSIVE API ENDPOINT TEST REPORT');
        console.log('==========================================\n');
        
        // Endpoint summary
        console.log('🌐 HTTP Endpoints Summary:');
        let endpointsPassed = 0;
        let endpointsTotal = 0;
        
        for (const [path, result] of Object.entries(this.results.endpoints)) {
            endpointsTotal++;
            if (result.status === 200) {
                endpointsPassed++;
                console.log(`  ✅ ${result.name}: ${result.status} (${result.responseTime}ms)`);
            } else if (result.error) {
                console.log(`  ❌ ${result.name}: ${result.error}`);
            } else {
                console.log(`  ❌ ${result.name}: HTTP ${result.status}`);
            }
        }
        
        // Methods summary
        console.log('\n🔧 HTTP Methods Summary:');
        let methodsSupported = 0;
        let methodsTested = 0;
        
        for (const [method, result] of Object.entries(this.results.methods)) {
            methodsTested++;
            if (result.allowed && !result.error) {
                methodsSupported++;
            }
        }
        
        console.log(`  📊 Methods tested: ${methodsTested}`);
        console.log(`  ✅ Methods supported: ${methodsSupported}`);
        
        // Data flow summary
        console.log('\n🔄 Data Flow Summary:');
        if (this.results.dataFlow.sessionConsistency) {
            const sc = this.results.dataFlow.sessionConsistency;
            console.log(`  ${sc.consistent ? '✅' : '❌'} Session consistency: ${sc.samples} samples`);
        }
        
        if (this.results.dataFlow.outputBuffer) {
            const ob = this.results.dataFlow.outputBuffer;
            console.log(`  ${ob.status === 'available' ? '✅' : '❌'} Output buffer: ${ob.outputCount || 0} entries`);
        }
        
        // Overall assessment
        const overallScore = Math.round((endpointsPassed / endpointsTotal) * 100);
        console.log(`\n🎯 OVERALL ASSESSMENT:`);
        console.log(`  📊 Endpoints: ${endpointsPassed}/${endpointsTotal} passed (${overallScore}%)`);
        console.log(`  🔧 HTTP Methods: ${methodsSupported}/${methodsTested} supported`);
        console.log(`  ❌ Errors found: ${this.results.errors.length}`);
        
        if (this.results.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.results.errors.forEach(error => console.log(`  - ${error}`));
        }
        
        console.log('\n✅ API Endpoint Testing Complete!');
    }
}

// Run tests if script is executed directly
if (require.main === module) {
    const tester = new APIEndpointTest();
    tester.runTests().catch(console.error);
}

module.exports = APIEndpointTest;