#!/usr/bin/env node

/**
 * Test Consolidation Analyzer
 * Analyzes test files to identify consolidation opportunities and duplicate patterns
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

class TestConsolidationAnalyzer {
    constructor() {
        this.testFiles = [];
        this.patterns = {
            webSocketTests: [],
            cliTests: [],
            webuiTests: [],
            integrationTests: [],
            duplicatePatterns: []
        };
        this.consolidationOpportunities = [];
    }

    async analyzeAllTests() {
        console.log(chalk.cyan('🔍 Analyzing Test Files for Consolidation Opportunities\n'));
        
        try {
            // Find all test files
            await this.findTestFiles();
            
            // Analyze patterns
            await this.analyzePatterns();
            
            // Generate consolidation recommendations
            await this.generateRecommendations();
            
            // Create summary report
            this.generateReport();
            
        } catch (error) {
            console.error(chalk.red(`❌ Analysis failed: ${error.message}`));
        }
    }

    async findTestFiles() {
        const files = await fs.readdir(process.cwd());
        this.testFiles = files.filter(file => 
            file.startsWith('test-') && file.endsWith('.js')
        );
        
        console.log(chalk.yellow(`📂 Found ${this.testFiles.length} test files to analyze`));
    }

    async analyzePatterns() {
        console.log(chalk.yellow('🔍 Analyzing code patterns...\n'));
        
        for (const file of this.testFiles) {
            try {
                const content = await fs.readFile(file, 'utf8');
                const analysis = await this.analyzeFilePatterns(file, content);
                
                // Categorize by test type
                if (analysis.hasWebSocket) this.patterns.webSocketTests.push(file);
                if (analysis.hasCLI) this.patterns.cliTests.push(file);
                if (analysis.hasWebUI) this.patterns.webuiTests.push(file);
                if (analysis.hasIntegration) this.patterns.integrationTests.push(file);
                
                // Track duplicate patterns
                if (analysis.duplicatePatterns.length > 0) {
                    this.patterns.duplicatePatterns.push({
                        file,
                        patterns: analysis.duplicatePatterns
                    });
                }
                
            } catch (error) {
                console.log(chalk.red(`   ❌ Error analyzing ${file}: ${error.message}`));
            }
        }
    }

    async analyzeFilePatterns(file, content) {
        const analysis = {
            hasWebSocket: false,
            hasCLI: false,
            hasWebUI: false,
            hasIntegration: false,
            duplicatePatterns: [],
            size: content.length,
            lines: content.split('\n').length
        };

        // Check for WebSocket patterns
        if (content.includes('WebSocket') || content.includes('ws://')) {
            analysis.hasWebSocket = true;
        }

        // Check for CLI patterns
        if (content.includes('spawn') && content.includes('claude-loop.js')) {
            analysis.hasCLI = true;
        }

        // Check for WebUI patterns
        if (content.includes('WebUI') || content.includes('localhost:3')) {
            analysis.hasWebUI = true;
        }

        // Check for integration patterns
        if (content.includes('integration') || content.includes('end-to-end')) {
            analysis.hasIntegration = true;
        }

        // Look for common duplicate patterns
        const duplicatePatterns = [
            { pattern: /console\.log\(['"]✅/g, name: 'Success logging' },
            { pattern: /console\.log\(['"]❌/g, name: 'Error logging' },
            { pattern: /new Promise\(\(resolve\)/g, name: 'Promise creation' },
            { pattern: /setTimeout\(\(\)/g, name: 'Timeout patterns' },
            { pattern: /child\.on\('close'/g, name: 'Process close handlers' },
            { pattern: /port.*=.*3\d{3}/g, name: 'Hardcoded ports' }
        ];

        duplicatePatterns.forEach(({ pattern, name }) => {
            const matches = content.match(pattern);
            if (matches && matches.length > 0) {
                analysis.duplicatePatterns.push({
                    name,
                    count: matches.length
                });
            }
        });

        return analysis;
    }

    async generateRecommendations() {
        console.log(chalk.yellow('💡 Generating consolidation recommendations...\n'));

        // Recommendation 1: WebSocket test consolidation
        if (this.patterns.webSocketTests.length > 3) {
            this.consolidationOpportunities.push({
                type: 'WebSocket Tests',
                files: this.patterns.webSocketTests,
                recommendation: 'Create consolidated WebSocket test suite using WebUITestHelper',
                priority: 'High',
                savings: `Reduce ${this.patterns.webSocketTests.length} files to 1-2 comprehensive files`
            });
        }

        // Recommendation 2: CLI test consolidation
        if (this.patterns.cliTests.length > 2) {
            this.consolidationOpportunities.push({
                type: 'CLI Tests',
                files: this.patterns.cliTests,
                recommendation: 'Create consolidated CLI test suite with standardized spawn patterns',
                priority: 'Medium',
                savings: `Reduce ${this.patterns.cliTests.length} files to 1 comprehensive file`
            });
        }

        // Recommendation 3: WebUI test consolidation
        if (this.patterns.webuiTests.length > 3) {
            this.consolidationOpportunities.push({
                type: 'WebUI Tests',
                files: this.patterns.webuiTests,
                recommendation: 'Migrate to WebUITestHelper pattern for consistent testing',
                priority: 'High',
                savings: `Standardize ${this.patterns.webuiTests.length} files with shared utilities`
            });
        }

        // Recommendation 4: Remove obsolete test files
        const smallFiles = this.testFiles.filter(async (file) => {
            try {
                const content = await fs.readFile(file, 'utf8');
                return content.length < 500; // Very small test files
            } catch {
                return false;
            }
        });

        if (smallFiles.length > 0) {
            this.consolidationOpportunities.push({
                type: 'Obsolete/Small Tests',
                files: smallFiles,
                recommendation: 'Review and either expand or remove minimal test files',
                priority: 'Low',
                savings: `Clean up ${smallFiles.length} minimal test files`
            });
        }
    }

    generateReport() {
        console.log(chalk.cyan.bold('📊 Test Consolidation Analysis Report\n'));
        console.log('='.repeat(80));
        
        // Summary
        console.log(chalk.white.bold('SUMMARY:'));
        console.log(`Total test files analyzed: ${this.testFiles.length}`);
        console.log(`WebSocket tests: ${this.patterns.webSocketTests.length}`);
        console.log(`CLI tests: ${this.patterns.cliTests.length}`);
        console.log(`WebUI tests: ${this.patterns.webuiTests.length}`);
        console.log(`Integration tests: ${this.patterns.integrationTests.length}`);
        
        // Duplicate patterns
        console.log('\n' + chalk.white.bold('DUPLICATE PATTERNS FOUND:'));
        const allPatterns = {};
        this.patterns.duplicatePatterns.forEach(({ file, patterns }) => {
            patterns.forEach(({ name, count }) => {
                if (!allPatterns[name]) allPatterns[name] = { files: 0, total: 0 };
                allPatterns[name].files++;
                allPatterns[name].total += count;
            });
        });

        Object.entries(allPatterns).forEach(([pattern, data]) => {
            const color = data.total > 10 ? chalk.red : data.total > 5 ? chalk.yellow : chalk.gray;
            console.log(color(`  ${pattern}: ${data.total} occurrences across ${data.files} files`));
        });

        // Consolidation opportunities
        console.log('\n' + chalk.white.bold('CONSOLIDATION OPPORTUNITIES:'));
        this.consolidationOpportunities.forEach((opportunity, index) => {
            const priorityColor = opportunity.priority === 'High' ? chalk.red : 
                                opportunity.priority === 'Medium' ? chalk.yellow : chalk.gray;
            
            console.log(`\n${index + 1}. ${chalk.cyan(opportunity.type)} ${priorityColor(`[${opportunity.priority} Priority]`)}`);
            console.log(`   ${opportunity.recommendation}`);
            console.log(`   ${chalk.green('Savings:')} ${opportunity.savings}`);
            console.log(`   ${chalk.gray('Files:')} ${opportunity.files.slice(0, 5).join(', ')}${opportunity.files.length > 5 ? '...' : ''}`);
        });

        // Implementation steps
        console.log('\n' + chalk.white.bold('RECOMMENDED IMPLEMENTATION STEPS:'));
        console.log(chalk.green('1.') + ' Create consolidated test suites using test-helpers.js');
        console.log(chalk.green('2.') + ' Migrate WebSocket tests to use WebUITestHelper');
        console.log(chalk.green('3.') + ' Standardize CLI tests with shared spawn utilities');
        console.log(chalk.green('4.') + ' Remove or consolidate minimal test files');
        console.log(chalk.green('5.') + ' Update remaining tests to use unified logging');

        console.log('\n' + '='.repeat(80));
        
        // Save report
        const reportPath = './test-consolidation-report.json';
        const reportData = {
            timestamp: new Date().toISOString(),
            summary: {
                totalFiles: this.testFiles.length,
                webSocketTests: this.patterns.webSocketTests.length,
                cliTests: this.patterns.cliTests.length,
                webuiTests: this.patterns.webuiTests.length,
                integrationTests: this.patterns.integrationTests.length
            },
            patterns: this.patterns,
            opportunities: this.consolidationOpportunities
        };

        fs.writeFile(reportPath, JSON.stringify(reportData, null, 2)).then(() => {
            console.log(chalk.gray(`\n📄 Detailed report saved to: ${reportPath}`));
        }).catch(error => {
            console.log(chalk.yellow(`⚠️ Could not save report: ${error.message}`));
        });
    }
}

// Run analysis if called directly
if (require.main === module) {
    const analyzer = new TestConsolidationAnalyzer();
    analyzer.analyzeAllTests().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error(chalk.red(`❌ Analysis failed: ${error.message}`));
        process.exit(1);
    });
}

module.exports = TestConsolidationAnalyzer;