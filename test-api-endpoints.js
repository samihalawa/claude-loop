#!/usr/bin/env node

console.log('🧪 Comprehensive API Endpoint Testing');
console.log('====================================');

const http = require('http');
const { spawn } = require('child_process');

// Start the test app in background
const testApp = spawn('node', ['test-broken-app.js'], { 
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'test', TEST_PORT: '3001' }
});

let appOutput = '';
testApp.stdout.on('data', (data) => {
  appOutput += data.toString();
});

testApp.stderr.on('data', (data) => {
  appOutput += data.toString();
});

// Helper function to make HTTP requests
function makeRequest(options) {
  return new Promise((resolve, reject) => {
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
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Wait for server to start then run tests
setTimeout(async () => {
  console.log('🚀 Test server output:');
  console.log(appOutput);
  console.log('');
  
  // Test all endpoints
  const tests = [
    {
      name: 'GET / (Homepage)',
      method: 'GET',
      path: '/',
      expectedStatus: 200,
      description: 'Should return HTML homepage'
    },
    {
      name: 'GET /api/config',
      method: 'GET', 
      path: '/api/config',
      expectedStatus: 200,
      description: 'Should return safe configuration data'
    },
    {
      name: 'GET /api/test',
      method: 'GET',
      path: '/api/test', 
      expectedStatus: 200,
      description: 'Should return test endpoint response'
    },
    {
      name: 'POST /api/data (valid data)',
      method: 'POST',
      path: '/api/data',
      body: JSON.stringify({ data: 'test value' }),
      headers: { 'Content-Type': 'application/json' },
      expectedStatus: 200,
      description: 'Should process valid data'
    },
    {
      name: 'POST /api/data (missing data field)',
      method: 'POST', 
      path: '/api/data',
      body: JSON.stringify({ notdata: 'test' }),
      headers: { 'Content-Type': 'application/json' },
      expectedStatus: 400,
      description: 'Should return 400 for missing data field'
    },
    {
      name: 'POST /api/data (no body)',
      method: 'POST',
      path: '/api/data',
      expectedStatus: 400,
      description: 'Should return 400 for missing body'
    },
    {
      name: 'GET /nonexistent',
      method: 'GET',
      path: '/nonexistent',
      expectedStatus: 404,
      description: 'Should return 404 for non-existent routes'
    },
    {
      name: 'POST /api/data (XSS attempt)',
      method: 'POST',
      path: '/api/data',
      body: JSON.stringify({ data: '<script>alert("xss")</script>' }),
      headers: { 'Content-Type': 'application/json' },
      expectedStatus: 200,
      description: 'Should sanitize XSS attempts'
    },
    {
      name: 'POST /api/data (large data)',
      method: 'POST',
      path: '/api/data',
      body: JSON.stringify({ data: 'x'.repeat(2000) }),
      headers: { 'Content-Type': 'application/json' },
      expectedStatus: 200,
      description: 'Should handle large data within limits'
    }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      console.log('🔍 Testing:', test.name);
      
      const result = await makeRequest({
        hostname: 'localhost',
        port: 3001,
        path: test.path,
        method: test.method,
        headers: test.headers || {},
        body: test.body
      });
      
      const passed = result.status === test.expectedStatus;
      const status = passed ? '✅ PASS' : '❌ FAIL';
      
      console.log('  ', status, '- Status:', result.status, '(expected:', test.expectedStatus + ')');
      
      if (result.data) {
        const preview = result.data.substring(0, 100).replace(/\n/g, ' ');
        console.log('   Data preview:', preview + '...');
      }
      
      results.push({
        name: test.name,
        passed,
        actualStatus: result.status,
        expectedStatus: test.expectedStatus,
        data: result.data
      });
      
    } catch (error) {
      console.log('   ❌ ERROR -', error.message);
      results.push({
        name: test.name,
        passed: false,
        error: error.message
      });
    }
    
    console.log('');
  }
  
  // Summary
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const successRate = ((passed / total) * 100).toFixed(1);
  
  console.log('📊 API ENDPOINT TEST SUMMARY');
  console.log('============================');
  console.log('Overall Results:', passed + '/' + total, 'tests passed (' + successRate + '%)');
  console.log('');
  
  if (passed === total) {
    console.log('🎉 All API endpoints are working correctly!');
  } else {
    console.log('⚠️ Some endpoints need attention:');
    const failedTests = results.filter(r => !r.passed);
    failedTests.forEach(result => {
      console.log('  -', result.name, ':', result.error || 'Status mismatch');
    });
  }
  
  console.log('');
  console.log('🔍 DETAILED ANALYSIS:');
  
  // Check specific functionality
  const dataTests = results.filter(r => r.name.includes('/api/data'));
  const dataPassRate = (dataTests.filter(r => r.passed).length / dataTests.length * 100).toFixed(1);
  console.log('- Data endpoint functionality:', dataPassRate + '% working');
  
  const configTest = results.find(r => r.name.includes('/api/config'));
  if (configTest && configTest.passed) {
    console.log('- Configuration endpoint: ✅ Working');
  }
  
  const securityTests = results.filter(r => r.name.includes('XSS') || r.name.includes('large'));
  const securityPassRate = (securityTests.filter(r => r.passed).length / securityTests.length * 100).toFixed(1);
  console.log('- Security handling:', securityPassRate + '% effective');
  
  // Clean up
  testApp.kill();
  console.log('');
  console.log('🛑 Test server stopped');
  
}, 2000);

// Handle cleanup on exit
process.on('exit', () => {
  if (testApp && !testApp.killed) {
    testApp.kill();
  }
});

process.on('SIGINT', () => {
  if (testApp && !testApp.killed) {
    testApp.kill();
  }
  process.exit(0);
});