const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const { glob } = require('glob');
const chalk = require('chalk');

class Scanner {
    constructor(repoPath, logger) {
        this.repoPath = repoPath;
        this.logger = logger;
        this.issues = {
            syntax: [],
            tests: [],
            dependencies: [],
            types: [],
            security: [],
            performance: []
        };
        this.config = this.detectProjectType();
    }

    async scan(issueTypes = null) {
        this.logger.info('Starting repository scan...');
        
        const scanners = {
            syntax: () => this.scanSyntax(),
            tests: () => this.scanTests(),
            dependencies: () => this.scanDependencies(),
            types: () => this.scanTypes(),
            security: () => this.scanSecurity(),
            performance: () => this.scanPerformance()
        };

        // Reset issues
        Object.keys(this.issues).forEach(key => this.issues[key] = []);

        // Run selected scanners
        for (const [type, scanner] of Object.entries(scanners)) {
            if (!issueTypes || issueTypes.includes(type)) {
                await scanner();
            }
        }
        
        return this.generateReport();
    }

    detectProjectType() {
        const configs = {
            'package.json': {
                type: 'javascript',
                linter: 'eslint',
                tester: 'npm test',
                installer: 'npm install',
                extensions: ['.js', '.jsx', '.mjs', '.cjs']
            },
            'tsconfig.json': {
                type: 'typescript',
                linter: 'eslint',
                tester: 'npm test',
                typeChecker: 'tsc --noEmit',
                installer: 'npm install',
                extensions: ['.ts', '.tsx', '.js', '.jsx']
            },
            'requirements.txt': {
                type: 'python',
                linter: 'pylint',
                tester: 'pytest',
                typeChecker: 'mypy',
                installer: 'pip install -r requirements.txt',
                extensions: ['.py']
            },
            'Pipfile': {
                type: 'python',
                linter: 'pylint',
                tester: 'pytest',
                typeChecker: 'mypy',
                installer: 'pipenv install',
                extensions: ['.py']
            },
            'go.mod': {
                type: 'go',
                linter: 'go vet',
                tester: 'go test ./...',
                installer: 'go mod download',
                extensions: ['.go']
            },
            'Cargo.toml': {
                type: 'rust',
                linter: 'cargo clippy',
                tester: 'cargo test',
                installer: 'cargo build',
                extensions: ['.rs']
            }
        };

        for (const [file, config] of Object.entries(configs)) {
            try {
                execSync(`test -f ${path.join(this.repoPath, file)}`, { stdio: 'ignore' });
                this.logger.info(`Detected ${config.type} project`);
                return config;
            } catch {}
        }

        this.logger.info('Using generic project configuration');
        return configs['package.json']; // Default to JS
    }

    async scanSyntax() {
        this.logger.info('Scanning for syntax issues...');
        
        try {
            if (this.config.linter === 'eslint') {
                await this.scanESLint();
            } else if (this.config.linter === 'pylint') {
                await this.scanPylint();
            } else if (this.config.linter === 'go vet') {
                await this.scanGoVet();
            } else if (this.config.linter === 'cargo clippy') {
                await this.scanCargoClippy();
            }
        } catch (error) {
            this.logger.warn(`Linting failed: ${error.message}`);
            // Try basic syntax check
            await this.basicSyntaxCheck();
        }
    }

    async scanESLint() {
        try {
            const result = this.runCommand('npx eslint . --format json', true);
            const issues = JSON.parse(result);
            
            for (const file of issues) {
                for (const message of file.messages) {
                    this.issues.syntax.push({
                        file: path.relative(this.repoPath, file.filePath),
                        line: message.line,
                        column: message.column,
                        severity: message.severity === 2 ? 'error' : 'warning',
                        message: message.message,
                        rule: message.ruleId
                    });
                }
            }
        } catch (error) {
            if (error.stdout) {
                try {
                    const issues = JSON.parse(error.stdout);
                    for (const file of issues) {
                        for (const message of file.messages) {
                            this.issues.syntax.push({
                                file: path.relative(this.repoPath, file.filePath),
                                line: message.line,
                                column: message.column,
                                severity: message.severity === 2 ? 'error' : 'warning',
                                message: message.message,
                                rule: message.ruleId
                            });
                        }
                    }
                } catch {}
            }
        }
    }

    async scanTests() {
        this.logger.info('Scanning for test failures...');
        
        try {
            // Check if test script exists first
            if (this.config.type === 'javascript' || this.config.type === 'typescript') {
                try {
                    const packageJson = JSON.parse(
                        await fs.readFile(path.join(this.repoPath, 'package.json'), 'utf8')
                    );
                    if (!packageJson.scripts || !packageJson.scripts.test || 
                        packageJson.scripts.test === 'echo "Error: no test specified" && exit 1' ||
                        packageJson.scripts.test.includes('no test')) {
                        this.logger.info('No test script configured');
                        return;
                    }
                } catch {
                    this.logger.info('No package.json found');
                    return;
                }
            }
            
            const result = this.runCommand(this.config.tester);
            this.logger.success('All tests passing');
        } catch (error) {
            // Check if it's just a missing script error
            if (error.message && error.message.includes('Missing script')) {
                this.logger.info('No test script configured');
                return;
            }
            
            // Parse test failures from error output
            const output = error.stdout || error.stderr || error.message;
            const lines = output.split('\n');
            
            for (const line of lines) {
                if (line.includes('FAIL') || line.includes('✗') || line.includes('failed')) {
                    this.issues.tests.push({
                        message: line.trim(),
                        severity: 'error',
                        type: 'test_failure'
                    });
                }
            }
        }
    }

    async scanDependencies() {
        this.logger.info('Scanning dependencies...');
        
        if (this.config.installer.includes('npm')) {
            await this.scanNpmDependencies();
        } else if (this.config.installer.includes('pip')) {
            await this.scanPipDependencies();
        } else if (this.config.installer.includes('go')) {
            await this.scanGoDependencies();
        }
    }

    async scanNpmDependencies() {
        // Check for outdated packages
        try {
            const outdated = this.runCommand('npm outdated --json', true);
            const packages = JSON.parse(outdated || '{}');
            
            for (const [name, info] of Object.entries(packages)) {
                if (info.wanted !== info.current) {
                    this.issues.dependencies.push({
                        type: 'outdated',
                        package: name,
                        current: info.current,
                        wanted: info.wanted,
                        latest: info.latest,
                        severity: 'warning'
                    });
                }
            }
        } catch {}

        // Check for vulnerabilities
        try {
            const audit = this.runCommand('npm audit --json', true);
            const auditData = JSON.parse(audit);
            
            if (auditData.vulnerabilities) {
                for (const [pkg, vuln] of Object.entries(auditData.vulnerabilities)) {
                    this.issues.security.push({
                        type: 'vulnerability',
                        package: pkg,
                        severity: vuln.severity,
                        via: Array.isArray(vuln.via) ? vuln.via[0].title : vuln.via
                    });
                }
            }
        } catch {}
    }

    async scanTypes() {
        if (!this.config.typeChecker) {
            this.logger.info('No type checker configured');
            return;
        }

        this.logger.info('Scanning for type errors...');
        
        try {
            this.runCommand(this.config.typeChecker);
            this.logger.success('No type errors found');
        } catch (error) {
            const output = error.stdout || error.stderr || '';
            const lines = output.split('\n');
            
            for (const line of lines) {
                if (line.includes('error TS') || line.includes('Type error')) {
                    const match = line.match(/(.+?)\((\d+),(\d+)\): (.+)/);
                    if (match) {
                        this.issues.types.push({
                            file: match[1],
                            line: parseInt(match[2]),
                            column: parseInt(match[3]),
                            message: match[4],
                            severity: 'error'
                        });
                    } else {
                        this.issues.types.push({
                            message: line,
                            severity: 'error'
                        });
                    }
                }
            }
        }
    }

    async scanSecurity() {
        this.logger.info('Scanning for security issues...');
        
        const patterns = [
            { pattern: /api[_-]?key\s*=\s*["'][^"']+["']/gi, type: 'exposed_api_key' },
            { pattern: /password\s*=\s*["'][^"']+["']/gi, type: 'hardcoded_password' },
            { pattern: /eval\s*\(/g, type: 'dangerous_eval' },
            { pattern: /innerHTML\s*=/g, type: 'potential_xss' },
            { pattern: /private[_-]?key\s*=\s*["'][^"']+["']/gi, type: 'exposed_private_key' }
        ];

        const files = await this.getSourceFiles();
        
        for (const file of files) {
            try {
                const content = await fs.readFile(file, 'utf8');
                const lines = content.split('\n');
                
                patterns.forEach(({ pattern, type }) => {
                    lines.forEach((line, index) => {
                        if (pattern.test(line)) {
                            this.issues.security.push({
                                file: path.relative(this.repoPath, file),
                                line: index + 1,
                                type,
                                severity: 'critical'
                            });
                        }
                    });
                });
            } catch {}
        }
    }

    async scanPerformance() {
        this.logger.info('Scanning for performance issues...');
        
        const patterns = [
            { pattern: /for\s*\([^)]*\)\s*{[^}]*for\s*\([^)]*\)/g, type: 'nested_loops' },
            { pattern: /JSON\.parse.*JSON\.stringify/g, type: 'inefficient_clone' },
            { pattern: /\.\s*filter\s*\([^)]*\)\s*\.\s*map\s*\(/g, type: 'multiple_iterations' },
            { pattern: /new\s+Date\(\)\.getTime\(\)/g, type: 'inefficient_timestamp' }
        ];

        const files = await this.getSourceFiles();
        
        for (const file of files) {
            try {
                const content = await fs.readFile(file, 'utf8');
                
                patterns.forEach(({ pattern, type }) => {
                    const matches = [...content.matchAll(pattern)];
                    if (matches.length > 0) {
                        this.issues.performance.push({
                            file: path.relative(this.repoPath, file),
                            type,
                            occurrences: matches.length,
                            severity: 'medium'
                        });
                    }
                });
            } catch {}
        }
    }

    async getSourceFiles() {
        const pattern = `**/*{${this.config.extensions.join(',')}}`;
        const options = {
            cwd: this.repoPath,
            ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**']
        };
        
        try {
            const files = await glob(pattern, options);
            return files.map(f => path.join(this.repoPath, f));
        } catch (err) {
            this.logger.warn(`Failed to glob files: ${err.message}`);
            return [];
        }
    }

    async basicSyntaxCheck() {
        const files = await this.getSourceFiles();
        
        for (const file of files) {
            try {
                const content = await fs.readFile(file, 'utf8');
                
                // Basic JS/TS syntax checks
                if (file.endsWith('.js') || file.endsWith('.ts')) {
                    // Check for unclosed brackets
                    const openBrackets = (content.match(/\{/g) || []).length;
                    const closeBrackets = (content.match(/\}/g) || []).length;
                    if (openBrackets !== closeBrackets) {
                        this.issues.syntax.push({
                            file: path.relative(this.repoPath, file),
                            message: 'Mismatched brackets',
                            severity: 'error'
                        });
                    }
                }
            } catch {}
        }
    }

    runCommand(command, returnOutput = false) {
        try {
            const result = execSync(command, { 
                cwd: this.repoPath,
                encoding: 'utf8',
                stdio: returnOutput ? 'pipe' : 'inherit'
            });
            return result;
        } catch (error) {
            if (returnOutput) {
                error.stdout = error.stdout?.toString() || '';
                error.stderr = error.stderr?.toString() || '';
            }
            throw error;
        }
    }

    generateReport() {
        const totalIssues = Object.values(this.issues).reduce((sum, arr) => sum + arr.length, 0);
        
        const report = {
            timestamp: new Date().toISOString(),
            projectType: this.config.type,
            summary: {
                total: totalIssues,
                bySeverity: this.countBySeverity(),
                byCategory: this.countByCategory()
            },
            issues: this.issues,
            recommendations: this.getRecommendations()
        };

        return report;
    }

    countBySeverity() {
        const severity = { critical: 0, error: 0, warning: 0, medium: 0 };
        
        for (const category of Object.values(this.issues)) {
            for (const issue of category) {
                const level = issue.severity || 'error';
                severity[level] = (severity[level] || 0) + 1;
            }
        }
        
        return severity;
    }

    countByCategory() {
        const counts = {};
        
        for (const [category, issues] of Object.entries(this.issues)) {
            counts[category] = issues.length;
        }
        
        return counts;
    }

    getRecommendations() {
        const recommendations = [];
        
        if (this.issues.syntax.length > 0) {
            recommendations.push({
                priority: 'critical',
                action: 'Fix syntax errors first - they block execution',
                command: this.config.linter === 'eslint' ? 'npx eslint --fix' : this.config.linter
            });
        }
        
        if (this.issues.tests.length > 0) {
            recommendations.push({
                priority: 'high',
                action: 'Fix failing tests to ensure functionality',
                command: this.config.tester
            });
        }
        
        if (this.issues.security.length > 0) {
            recommendations.push({
                priority: 'critical',
                action: 'Address security vulnerabilities immediately',
                command: this.config.installer.includes('npm') ? 'npm audit fix' : null
            });
        }

        if (this.issues.types.length > 0) {
            recommendations.push({
                priority: 'high',
                action: 'Fix type errors for better code reliability',
                command: this.config.typeChecker
            });
        }
        
        return recommendations;
    }
}

module.exports = Scanner;