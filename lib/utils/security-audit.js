/**
 * Security Audit Utility
 * Scans codebase for security vulnerabilities and hardcoded values
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { logger } = require('./logger');
const logger = require('./unified-logger');
const { PORTS, URL_PATTERNS, TEST_PORTS } = require('../config/constants');

class SecurityAudit {
    constructor() {
        this.auditResults = {
            hardcodedSecrets: [],
            insecurePatterns: [],
            vulnerableFiles: [],
            recommendations: [],
            score: 100 // Start with perfect score, deduct for issues
        };

        // Patterns to detect hardcoded secrets and security issues
        this.secretPatterns = [
            {
                name: 'Hardcoded API Key',
                pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['"][a-zA-Z0-9]{16,}['"]/gi,
                severity: 'high',
                points: -20
            },
            {
                name: 'Hardcoded Password',
                pattern: /(?:password|pwd|pass)\s*[=:]\s*['"][^'"]{8,}['"]/gi,
                severity: 'high',
                points: -25
            },
            {
                name: 'Hardcoded Token',
                pattern: /(?:token|auth[_-]?token)\s*[=:]\s*['"][a-fA-F0-9]{32,}['"]/gi,
                severity: 'high',
                points: -20
            },
            {
                name: 'Hardcoded Secret',
                pattern: /(?:secret|client[_-]?secret)\s*[=:]\s*['"][^'"]{16,}['"]/gi,
                severity: 'high',
                points: -20
            },
            {
                name: 'Private Key',
                pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi,
                severity: 'critical',
                points: -50
            },
            {
                name: 'AWS Access Key',
                pattern: /AKIA[0-9A-Z]{16}/gi,
                severity: 'critical',
                points: -30
            },
            {
                name: 'GitHub Token',
                pattern: /ghp_[a-zA-Z0-9]{36}/gi,
                severity: 'critical',
                points: -30
            }
        ];

        this.vulnerabilityPatterns = [
            {
                name: 'SQL Injection Risk',
                pattern: /query\s*\+\s*['"]/gi,
                severity: 'high',
                points: -15,
                description: 'Potential SQL injection vulnerability from string concatenation'
            },
            {
                name: 'Command Injection Risk',
                pattern: /exec\s*\(\s*[^)]*\+/gi,
                severity: 'high',
                points: -20,
                description: 'Potential command injection from string concatenation'
            },
            {
                name: 'Path Traversal Risk',
                pattern: /\.\.\//g,
                severity: 'medium',
                points: -10,
                description: 'Potential path traversal vulnerability'
            },
            {
                name: 'Unsafe eval Usage',
                pattern: /eval\s*\(/gi,
                severity: 'critical',
                points: -25,
                description: 'Use of eval() can lead to code injection'
            },
            {
                name: 'Hardcoded Port',
                pattern: /:\s*\d{4,5}(?!\s*[,\]])/g,
                severity: 'low',
                points: -5,
                description: 'Hardcoded port number should be configurable'
            },
            {
                name: 'logger.info in Production',
                pattern: /console\.log\s*\(/gi,
                severity: 'low',
                points: -2,
                description: 'logger.info should be replaced with proper logging'
            },
            {
                name: 'Weak Random Generator',
                pattern: /Math\.random\s*\(/gi,
                severity: 'medium',
                points: -10,
                description: 'Math.random() is not cryptographically secure'
            }
        ];

        this.allowedTestPatterns = [
            // Allow test patterns that are intentionally insecure for testing
            /test.*broken/i,
            /test.*invalid/i,
            /test.*fake/i,
            /\.test\./,
            /test-.*\.js$/,
            /-test\.js$/
        ];
    }

    /**
     * Run complete security audit on the project
     * @param {string} projectPath - Path to project root
     * @returns {object} - Audit results
     */
    async auditProject(projectPath = process.cwd()) {
        logger.info('Starting security audit...');
        
        try {
            const files = await this.getJavaScriptFiles(projectPath);
            logger.info(`Scanning ${files.length} JavaScript files`);

            for (const file of files) {
                await this.auditFile(file);
            }

            this.generateRecommendations();
            this.calculateFinalScore();
            
            logger.info('Security audit completed');
            return this.auditResults;
        } catch (error) {
            logger.error('Security audit failed:', error.message);
            throw error;
        }
    }

    /**
     * Get all JavaScript files in project
     * @param {string} projectPath - Project root path
     * @returns {Array<string>} - Array of file paths
     */
    async getJavaScriptFiles(projectPath) {
        const files = [];
        const ignoreDirs = ['node_modules', '.git', 'coverage', 'dist', 'build'];
        
        async function scan(dir) {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    
                    if (entry.isDirectory() && !ignoreDirs.includes(entry.name)) {
                        await scan(fullPath);
                    } else if (entry.isFile() && entry.name.endsWith('.js')) {
                        files.push(fullPath);
                    }
                }
            } catch (error) {
                // Skip directories we can't read
                logger.debug(`Skipping directory ${dir}: ${error.message}`);
            }
        }
        
        await scan(projectPath);
        return files;
    }

    /**
     * Audit a single file for security issues
     * @param {string} filePath - Path to file
     */
    async auditFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const relativePath = path.relative(process.cwd(), filePath);
            
            // Check if this is a test file (more lenient rules)
            const isTestFile = this.isTestFile(filePath);
            
            // Scan for hardcoded secrets
            this.scanForSecrets(content, relativePath, isTestFile);
            
            // Scan for vulnerability patterns
            this.scanForVulnerabilities(content, relativePath, isTestFile);
            
        } catch (error) {
            logger.debug(`Could not audit file ${filePath}: ${error.message}`);
        }
    }

    /**
     * Check if file is a test file
     * @param {string} filePath - File path to check
     * @returns {boolean} - True if test file
     */
    isTestFile(filePath) {
        return this.allowedTestPatterns.some(pattern => pattern.test(filePath));
    }

    /**
     * Scan content for hardcoded secrets
     * @param {string} content - File content
     * @param {string} filePath - Relative file path
     * @param {boolean} isTestFile - Whether this is a test file
     */
    scanForSecrets(content, filePath, isTestFile) {
        for (const secretPattern of this.secretPatterns) {
            const matches = content.match(secretPattern.pattern);
            
            if (matches) {
                for (const match of matches) {
                    // For test files, only flag if it looks like a real secret
                    if (isTestFile && this.looksLikeTestData(match)) {
                        continue;
                    }
                    
                    this.auditResults.hardcodedSecrets.push({
                        type: secretPattern.name,
                        file: filePath,
                        match: this.maskSecret(match),
                        severity: secretPattern.severity,
                        line: this.getLineNumber(content, match)
                    });
                    
                    this.auditResults.score += secretPattern.points;
                }
            }
        }
    }

    /**
     * Scan content for vulnerability patterns
     * @param {string} content - File content
     * @param {string} filePath - Relative file path
     * @param {boolean} isTestFile - Whether this is a test file
     */
    scanForVulnerabilities(content, filePath, isTestFile) {
        for (const vulnPattern of this.vulnerabilityPatterns) {
            const matches = content.match(vulnPattern.pattern);
            
            if (matches) {
                // For test files, be more lenient with certain patterns
                if (isTestFile && vulnPattern.name === 'Hardcoded Port') {
                    continue;
                }
                
                for (const match of matches) {
                    this.auditResults.insecurePatterns.push({
                        type: vulnPattern.name,
                        file: filePath,
                        match: match.substring(0, 50) + (match.length > 50 ? '...' : ''),
                        severity: vulnPattern.severity,
                        description: vulnPattern.description,
                        line: this.getLineNumber(content, match)
                    });
                    
                    this.auditResults.score += vulnPattern.points;
                }
            }
        }
    }

    /**
     * Check if a match looks like test data
     * @param {string} match - Matched string
     * @returns {boolean} - True if looks like test data
     */
    looksLikeTestData(match) {
        const testKeywords = ['test', 'fake', 'mock', 'dummy', 'example', 'invalid'];
        return testKeywords.some(keyword => match.toLowerCase().includes(keyword));
    }

    /**
     * Mask sensitive parts of detected secrets
     * @param {string} secret - Secret to mask
     * @returns {string} - Masked secret
     */
    maskSecret(secret) {
        if (secret.length <= 8) {
            return '*'.repeat(secret.length);
        }
        
        const visibleStart = secret.substring(0, 4);
        const visibleEnd = secret.substring(secret.length - 4);
        const maskedMiddle = '*'.repeat(secret.length - 8);
        
        return visibleStart + maskedMiddle + visibleEnd;
    }

    /**
     * Get line number of a match in content
     * @param {string} content - File content
     * @param {string} match - Matched string
     * @returns {number} - Line number
     */
    getLineNumber(content, match) {
        const index = content.indexOf(match);
        if (index === -1) return 1;
        
        return content.substring(0, index).split('\n').length;
    }

    /**
     * Generate security recommendations
     */
    generateRecommendations() {
        const recs = this.auditResults.recommendations;
        
        if (this.auditResults.hardcodedSecrets.length > 0) {
            recs.push({
                priority: 'high',
                category: 'secrets',
                message: 'Move hardcoded secrets to environment variables or secure key management',
                action: 'Use process.env.SECRET_NAME or encrypted configuration files'
            });
        }
        
        if (this.auditResults.insecurePatterns.some(p => p.type === 'logger.info in Production')) {
            recs.push({
                priority: 'medium',
                category: 'logging',
                message: 'Replace logger.info with structured logging library',
                action: 'Use the Logger class in lib/utils/logger.js throughout the codebase'
            });
        }
        
        if (this.auditResults.insecurePatterns.some(p => p.severity === 'critical')) {
            recs.push({
                priority: 'critical',
                category: 'vulnerability',
                message: 'Critical security vulnerabilities detected',
                action: 'Review and fix critical issues immediately before deployment'
            });
        }
        
        if (this.auditResults.score < 80) {
            recs.push({
                priority: 'high',
                category: 'general',
                message: 'Security score is below acceptable threshold',
                action: 'Address security issues to improve score above 80'
            });
        }
        
        // Always recommend using the security utilities
        recs.push({
            priority: 'medium',
            category: 'improvement',
            message: 'Use provided security utilities for consistent security practices',
            action: 'Implement SecureConfig and EnvironmentValidator throughout the application'
        });
    }

    /**
     * Calculate final security score
     */
    calculateFinalScore() {
        // Ensure score doesn't go below 0
        this.auditResults.score = Math.max(0, this.auditResults.score);
        
        // Add bonus points for good practices
        if (this.auditResults.hardcodedSecrets.length === 0) {
            this.auditResults.score += 10;
        }
        
        // Cap score at 100
        this.auditResults.score = Math.min(100, this.auditResults.score);
    }

    /**
     * Generate audit report
     * @returns {string} - Formatted report
     */
    generateReport() {
        const results = this.auditResults;
        const scoreColor = results.score >= 90 ? 'green' : 
                          results.score >= 70 ? 'yellow' : 'red';
        
        let report = `\n🔒 Security Audit Report\n`;
        report += `${'='.repeat(50)}\n\n`;
        
        report += `Overall Security Score: ${results.score}/100\n`;
        report += `Score Status: ${this.getScoreStatus(results.score)}\n\n`;
        
        if (results.hardcodedSecrets.length > 0) {
            report += `🚨 Hardcoded Secrets Found: ${results.hardcodedSecrets.length}\n`;
            results.hardcodedSecrets.forEach(secret => {
                report += `  - ${secret.type} in ${secret.file}:${secret.line} (${secret.severity})\n`;
                report += `    Pattern: ${secret.match}\n`;
            });
            report += '\n';
        }
        
        if (results.insecurePatterns.length > 0) {
            report += `⚠️  Security Issues Found: ${results.insecurePatterns.length}\n`;
            const criticalIssues = results.insecurePatterns.filter(p => p.severity === 'critical');
            const highIssues = results.insecurePatterns.filter(p => p.severity === 'high');
            const mediumIssues = results.insecurePatterns.filter(p => p.severity === 'medium');
            const lowIssues = results.insecurePatterns.filter(p => p.severity === 'low');
            
            if (criticalIssues.length > 0) {
                report += `  Critical: ${criticalIssues.length}\n`;
            }
            if (highIssues.length > 0) {
                report += `  High: ${highIssues.length}\n`;
            }
            if (mediumIssues.length > 0) {
                report += `  Medium: ${mediumIssues.length}\n`;
            }
            if (lowIssues.length > 0) {
                report += `  Low: ${lowIssues.length}\n`;
            }
            report += '\n';
        }
        
        if (results.recommendations.length > 0) {
            report += `💡 Recommendations:\n`;
            results.recommendations.forEach((rec, index) => {
                report += `  ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}\n`;
                report += `     Action: ${rec.action}\n`;
            });
            report += '\n';
        }
        
        if (results.score >= 90) {
            report += `✅ Excellent security posture! Keep up the good work.\n`;
        } else if (results.score >= 70) {
            report += `✨ Good security practices, but room for improvement.\n`;
        } else {
            report += `🚨 Security improvements needed before production deployment.\n`;
        }
        
        return report;
    }

    /**
     * Get score status description
     * @param {number} score - Security score
     * @returns {string} - Status description
     */
    getScoreStatus(score) {
        if (score >= 95) return 'Excellent';
        if (score >= 85) return 'Good';
        if (score >= 70) return 'Acceptable';
        if (score >= 50) return 'Needs Improvement';
        return 'Critical Issues';
    }

    /**
     * Save audit results to file
     * @param {string} outputPath - Path to save results
     */
    async saveResults(outputPath) {
        const report = {
            timestamp: new Date().toISOString(),
            results: this.auditResults,
            report: this.generateReport()
        };
        
        await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
        logger.info(`Security audit results saved to ${outputPath}`);
    }
}

module.exports = SecurityAudit;