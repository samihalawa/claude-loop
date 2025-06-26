#!/usr/bin/env node

/**
 * Dependency Security Analysis Tool
 * Comprehensive security assessment for dependencies
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

class DependencySecurityAnalyzer {
    constructor() {
        this.findings = [];
        this.packageInfo = {};
        this.vulnerabilities = {};
        this.outdatedPackages = {};
    }

    async analyze() {
        console.log('🔍 Starting dependency security analysis...\n');
        
        // Load package.json
        await this.loadPackageInfo();
        
        // Run npm audit
        await this.runNpmAudit();
        
        // Check for outdated packages
        await this.checkOutdatedPackages();
        
        // Analyze package licenses
        await this.analyzeLicenses();
        
        // Check dependency tree depth
        await this.analyzeDependencyTree();
        
        // Security recommendations
        await this.generateSecurityRecommendations();
        
        // Generate report
        await this.generateReport();
        
        return this.findings;
    }

    async loadPackageInfo() {
        try {
            const packagePath = path.join(process.cwd(), 'package.json');
            const packageContent = await fs.readFile(packagePath, 'utf8');
            this.packageInfo = JSON.parse(packageContent);
            
            console.log('📦 Package Information:');
            console.log(`  Name: ${this.packageInfo.name}`);
            console.log(`  Version: ${this.packageInfo.version}`);
            console.log(`  Production dependencies: ${Object.keys(this.packageInfo.dependencies || {}).length}`);
            console.log(`  Development dependencies: ${Object.keys(this.packageInfo.devDependencies || {}).length}\n`);
            
        } catch (error) {
            this.addFinding({
                type: 'ERROR',
                category: 'package',
                severity: 'low',
                description: `Failed to load package.json: ${error.message}`
            });
        }
    }

    async runNpmAudit() {
        console.log('🛡️  Running npm audit...');
        
        try {
            const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
            const audit = JSON.parse(auditResult);
            
            this.vulnerabilities = audit.vulnerabilities || {};
            
            if (Object.keys(this.vulnerabilities).length === 0) {
                this.addFinding({
                    type: 'SUCCESS',
                    category: 'vulnerabilities',
                    severity: 'info',
                    description: 'No known vulnerabilities found in dependencies'
                });
                console.log('  ✅ No vulnerabilities found');
            } else {
                console.log(`  ⚠️  Found ${Object.keys(this.vulnerabilities).length} vulnerable packages`);
                
                for (const [pkg, vuln] of Object.entries(this.vulnerabilities)) {
                    this.addFinding({
                        type: 'VULNERABILITY',
                        category: 'dependencies',
                        severity: vuln.severity || 'unknown',
                        description: `${pkg}: ${vuln.title || 'Unknown vulnerability'}`,
                        package: pkg,
                        details: vuln
                    });
                }
            }
        } catch (error) {
            if (error.status === 0) {
                this.addFinding({
                    type: 'SUCCESS',
                    category: 'vulnerabilities',
                    severity: 'info',
                    description: 'No vulnerabilities found (npm audit exited with code 0)'
                });
                console.log('  ✅ No vulnerabilities found');
            } else {
                this.addFinding({
                    type: 'ERROR',
                    category: 'audit',
                    severity: 'medium',
                    description: `npm audit failed: ${error.message}`
                });
                console.log(`  ❌ npm audit failed: ${error.message}`);
            }
        }
        console.log();
    }

    async checkOutdatedPackages() {
        console.log('📊 Checking for outdated packages...');
        
        try {
            const outdatedResult = execSync('npm outdated --json', { encoding: 'utf8' });
            this.outdatedPackages = JSON.parse(outdatedResult);
        } catch (error) {
            // npm outdated returns non-zero exit code when packages are outdated
            if (error.stdout) {
                try {
                    this.outdatedPackages = JSON.parse(error.stdout);
                } catch (parseError) {
                    console.log('  ❌ Failed to parse outdated packages output');
                    return;
                }
            }
        }
        
        if (Object.keys(this.outdatedPackages).length === 0) {
            this.addFinding({
                type: 'SUCCESS',
                category: 'updates',
                severity: 'info',
                description: 'All packages are up to date'
            });
            console.log('  ✅ All packages are up to date');
        } else {
            console.log(`  📋 Found ${Object.keys(this.outdatedPackages).length} outdated packages:`);
            
            for (const [pkg, info] of Object.entries(this.outdatedPackages)) {
                const severity = this.getOutdatedSeverity(info);
                
                this.addFinding({
                    type: 'OUTDATED',
                    category: 'updates',
                    severity,
                    description: `${pkg}: ${info.current} → ${info.latest}`,
                    package: pkg,
                    currentVersion: info.current,
                    latestVersion: info.latest,
                    wantedVersion: info.wanted
                });
                
                console.log(`    ${pkg}: ${info.current} → ${info.latest} (${severity})`);
            }
        }
        console.log();
    }

    getOutdatedSeverity(info) {
        const current = this.parseVersion(info.current);
        const latest = this.parseVersion(info.latest);
        
        if (latest.major > current.major) {
            return 'high'; // Major version difference
        } else if (latest.minor > current.minor) {
            return 'medium'; // Minor version difference
        } else {
            return 'low'; // Patch version difference
        }
    }

    parseVersion(version) {
        const cleaned = version.replace(/[^0-9.]/g, '');
        const parts = cleaned.split('.').map(Number);
        return {
            major: parts[0] || 0,
            minor: parts[1] || 0,
            patch: parts[2] || 0
        };
    }

    async analyzeLicenses() {
        console.log('⚖️  Analyzing dependency licenses...');
        
        try {
            // Get license information
            const licenseResult = execSync('npx license-checker --json --production', { 
                encoding: 'utf8',
                stdio: ['inherit', 'pipe', 'pipe']
            });
            
            const licenses = JSON.parse(licenseResult);
            const licenseCounts = {};
            const problematicLicenses = ['GPL-2.0', 'GPL-3.0', 'AGPL-1.0', 'AGPL-3.0'];
            
            for (const [pkg, info] of Object.entries(licenses)) {
                const license = info.license || 'Unknown';
                licenseCounts[license] = (licenseCounts[license] || 0) + 1;
                
                if (problematicLicenses.includes(license)) {
                    this.addFinding({
                        type: 'LICENSE_ISSUE',
                        category: 'licensing',
                        severity: 'high',
                        description: `Potentially problematic license: ${pkg} (${license})`,
                        package: pkg,
                        license: license
                    });
                }
            }
            
            this.addFinding({
                type: 'INFO',
                category: 'licensing',
                severity: 'info',
                description: `License distribution: ${JSON.stringify(licenseCounts, null, 2)}`,
                licenseCounts
            });
            
            console.log('  License summary:');
            for (const [license, count] of Object.entries(licenseCounts)) {
                console.log(`    ${license}: ${count}`);
            }
            
        } catch (error) {
            this.addFinding({
                type: 'WARNING',
                category: 'licensing',
                severity: 'low',
                description: `License analysis failed: ${error.message}`
            });
            console.log(`  ⚠️  License analysis failed: ${error.message}`);
        }
        console.log();
    }

    async analyzeDependencyTree() {
        console.log('🌳 Analyzing dependency tree...');
        
        try {
            const listResult = execSync('npm list --json --all', { 
                encoding: 'utf8',
                stdio: ['inherit', 'pipe', 'pipe']
            });
            
            const tree = JSON.parse(listResult);
            const analysis = this.analyzeDependencyDepth(tree);
            
            this.addFinding({
                type: 'INFO',
                category: 'tree_analysis',
                severity: 'info',
                description: `Dependency tree analysis: max depth ${analysis.maxDepth}, total packages ${analysis.totalPackages}`,
                maxDepth: analysis.maxDepth,
                totalPackages: analysis.totalPackages,
                duplicates: analysis.duplicates
            });
            
            console.log(`  Max dependency depth: ${analysis.maxDepth}`);
            console.log(`  Total packages: ${analysis.totalPackages}`);
            console.log(`  Potential duplicates: ${analysis.duplicates.length}`);
            
            if (analysis.maxDepth > 10) {
                this.addFinding({
                    type: 'WARNING',
                    category: 'tree_analysis',
                    severity: 'medium',
                    description: `Very deep dependency tree (${analysis.maxDepth} levels) - potential performance impact`
                });
            }
            
            if (analysis.duplicates.length > 0) {
                this.addFinding({
                    type: 'WARNING',
                    category: 'tree_analysis',
                    severity: 'low',
                    description: `Found ${analysis.duplicates.length} potential duplicate dependencies`,
                    duplicates: analysis.duplicates
                });
            }
            
        } catch (error) {
            this.addFinding({
                type: 'WARNING',
                category: 'tree_analysis',
                severity: 'low',
                description: `Dependency tree analysis failed: ${error.message}`
            });
            console.log(`  ⚠️  Tree analysis failed: ${error.message}`);
        }
        console.log();
    }

    analyzeDependencyDepth(tree, depth = 0, visited = new Set(), packages = new Set()) {
        const result = {
            maxDepth: depth,
            totalPackages: 0,
            duplicates: []
        };
        
        if (!tree.dependencies) {
            return result;
        }
        
        for (const [name, info] of Object.entries(tree.dependencies)) {
            const packageId = `${name}@${info.version}`;
            
            if (packages.has(name) && !visited.has(packageId)) {
                result.duplicates.push(name);
            }
            packages.add(name);
            
            if (!visited.has(packageId)) {
                visited.add(packageId);
                result.totalPackages++;
                
                const childResult = this.analyzeDependencyDepth(info, depth + 1, visited, packages);
                result.maxDepth = Math.max(result.maxDepth, childResult.maxDepth);
                result.totalPackages += childResult.totalPackages;
                result.duplicates.push(...childResult.duplicates);
            }
        }
        
        return result;
    }

    async generateSecurityRecommendations() {
        console.log('💡 Generating security recommendations...');
        
        const recommendations = [];
        
        // Check for specific package recommendations
        const deps = { ...this.packageInfo.dependencies, ...this.packageInfo.devDependencies };
        
        for (const [pkg, version] of Object.entries(deps)) {
            const recommendation = this.getPackageRecommendation(pkg, version);
            if (recommendation) {
                recommendations.push(recommendation);
            }
        }
        
        // General recommendations
        recommendations.push({
            type: 'GENERAL',
            priority: 'high',
            title: 'Regular Updates',
            description: 'Regularly update dependencies to get security patches and bug fixes'
        });
        
        recommendations.push({
            type: 'GENERAL',
            priority: 'medium',
            title: 'Dependency Pinning',
            description: 'Consider using exact versions for critical dependencies in production'
        });
        
        recommendations.push({
            type: 'GENERAL',
            priority: 'medium',
            title: 'Security Monitoring',
            description: 'Set up automated security monitoring for new vulnerabilities'
        });
        
        this.addFinding({
            type: 'RECOMMENDATIONS',
            category: 'security',
            severity: 'info',
            description: 'Security recommendations generated',
            recommendations
        });
        
        console.log('  Generated security recommendations');
        console.log();
    }

    getPackageRecommendation(pkg, version) {
        const recommendations = {
            'express': {
                priority: 'high',
                description: 'Consider updating to Express 5.x for better performance and security features'
            },
            'chalk': {
                priority: 'medium',
                description: 'Chalk 5.x is available with ES modules support'
            },
            'commander': {
                priority: 'low',
                description: 'Commander has newer versions available with improved features'
            }
        };
        
        if (recommendations[pkg]) {
            return {
                type: 'PACKAGE_SPECIFIC',
                package: pkg,
                currentVersion: version,
                ...recommendations[pkg]
            };
        }
        
        return null;
    }

    addFinding(finding) {
        finding.timestamp = new Date().toISOString();
        this.findings.push(finding);
    }

    async generateReport() {
        console.log('📊 Generating dependency security report...\n');
        
        const summary = this.generateSummary();
        
        const report = {
            timestamp: new Date().toISOString(),
            package: {
                name: this.packageInfo.name,
                version: this.packageInfo.version,
                dependencies: Object.keys(this.packageInfo.dependencies || {}).length,
                devDependencies: Object.keys(this.packageInfo.devDependencies || {}).length
            },
            summary,
            findings: this.findings,
            vulnerabilities: this.vulnerabilities,
            outdatedPackages: this.outdatedPackages
        };
        
        const reportPath = path.join(process.cwd(), 'dependency-security-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        this.printSummary(summary);
        
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
        
        return report;
    }

    generateSummary() {
        const summary = {
            total: this.findings.length,
            vulnerabilities: 0,
            outdated: 0,
            licenseIssues: 0,
            recommendations: 0,
            errors: 0,
            warnings: 0,
            success: 0,
            severityBreakdown: {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                info: 0
            }
        };
        
        for (const finding of this.findings) {
            const severity = finding.severity || 'unknown';
            summary.severityBreakdown[severity] = (summary.severityBreakdown[severity] || 0) + 1;
            
            switch (finding.type) {
                case 'VULNERABILITY':
                    summary.vulnerabilities++;
                    break;
                case 'OUTDATED':
                    summary.outdated++;
                    break;
                case 'LICENSE_ISSUE':
                    summary.licenseIssues++;
                    break;
                case 'RECOMMENDATIONS':
                    summary.recommendations++;
                    break;
                case 'ERROR':
                    summary.errors++;
                    break;
                case 'WARNING':
                    summary.warnings++;
                    break;
                case 'SUCCESS':
                    summary.success++;
                    break;
            }
        }
        
        return summary;
    }

    printSummary(summary) {
        console.log('🛡️  DEPENDENCY SECURITY ASSESSMENT SUMMARY');
        console.log('='.repeat(50));
        console.log(`Total findings: ${summary.total}`);
        console.log(`Vulnerabilities: ${summary.vulnerabilities}`);
        console.log(`Outdated packages: ${summary.outdated}`);
        console.log(`License issues: ${summary.licenseIssues}`);
        console.log(`Recommendations: ${summary.recommendations}`);
        console.log(`Errors: ${summary.errors}`);
        console.log(`Warnings: ${summary.warnings}`);
        console.log(`Success items: ${summary.success}`);
        
        console.log('\nSeverity breakdown:');
        for (const [severity, count] of Object.entries(summary.severityBreakdown)) {
            if (count > 0) {
                console.log(`  ${severity}: ${count}`);
            }
        }
        
        // Risk assessment
        const riskScore = (summary.severityBreakdown.critical * 4) + 
                         (summary.severityBreakdown.high * 3) + 
                         (summary.severityBreakdown.medium * 2) + 
                         (summary.severityBreakdown.low * 1);
        
        let riskLevel;
        if (riskScore >= 15) {
            riskLevel = '🔴 HIGH RISK';
        } else if (riskScore >= 8) {
            riskLevel = '🟡 MEDIUM RISK';
        } else {
            riskLevel = '🟢 LOW RISK';
        }
        
        console.log(`\nOverall Risk Level: ${riskLevel} (Score: ${riskScore})`);
    }
}

// Main execution
async function main() {
    try {
        const analyzer = new DependencySecurityAnalyzer();
        await analyzer.analyze();
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = DependencySecurityAnalyzer;