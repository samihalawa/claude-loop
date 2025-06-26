#!/usr/bin/env node

/**
 * Code Organization Improver
 * Identifies and fixes code organization issues including:
 * - Obsolete test files that can be removed
 * - Files that should use test-helpers but don't
 * - Inconsistent formatting and structure
 * - Missing documentation and proper exports
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const logger = require('./lib/utils/unified-logger');

class CodeOrganizationImprover {
    constructor() {
        this.issues = {
            obsoleteFiles: [],
            inconsistentFormatting: [],
            missingHelpers: [],
            improperExports: [],
            duplicateContent: []
        };
        this.improvements = [];
        this.consolidatedFiles = [
            'test-websocket-consolidated.js',
            'test-cli-consolidated.js',
            'test-webui-consolidated.js'
        ];
    }

    async improveCodeOrganization() {
        console.log(chalk.cyan('🛠️ Analyzing and Improving Code Organization\n'));
        
        try {
            // Step 1: Identify obsolete test files
            await this.identifyObsoleteFiles();
            
            // Step 2: Check for inconsistent formatting
            await this.checkFormattingConsistency();
            
            // Step 3: Identify files that should use helpers
            await this.identifyHelperOpportunities();
            
            // Step 4: Check export patterns
            await this.checkExportPatterns();
            
            // Step 5: Generate improvement plan
            await this.generateImprovementPlan();
            
            // Step 6: Execute safe improvements
            await this.executeSafeImprovements();
            
            // Step 7: Generate report
            this.generateReport();
            
        } catch (error) {
            logger.error(`Code organization improvement failed: ${error.message}`);
            throw error;
        }
    }

    async identifyObsoleteFiles() {
        console.log(chalk.yellow('🔍 Identifying obsolete test files...'));
        
        const testFiles = await this.getTestFiles();
        
        for (const file of testFiles) {
            try {
                const content = await fs.readFile(file, 'utf8');
                const stats = await fs.stat(file);
                
                // Criteria for obsolete files:
                // 1. Very small files (< 1KB)
                // 2. Files with minimal functionality
                // 3. Files that are superseded by consolidated versions
                
                if (stats.size < 1024) {
                    this.issues.obsoleteFiles.push({
                        file,
                        reason: 'Very small file (< 1KB)',
                        size: stats.size,
                        recommendation: 'Consider removing or expanding'
                    });
                }
                
                // Check for minimal functionality
                const lines = content.split('\n').filter(line => line.trim().length > 0);
                if (lines.length < 20) {
                    this.issues.obsoleteFiles.push({
                        file,
                        reason: 'Minimal functionality (< 20 lines)',
                        lines: lines.length,
                        recommendation: 'Merge into consolidated test or remove'
                    });
                }
                
                // Check for superseded functionality
                if (this.isSupersededByConsolidated(content, file)) {
                    this.issues.obsoleteFiles.push({
                        file,
                        reason: 'Functionality covered by consolidated test',
                        recommendation: 'Remove after verifying consolidated test coverage'
                    });
                }
                
            } catch (error) {
                logger.warn(`Could not analyze ${file}: ${error.message}`);
            }
        }
        
        console.log(chalk.green(`✓ Identified ${this.issues.obsoleteFiles.length} potentially obsolete files`));
    }

    async checkFormattingConsistency() {
        console.log(chalk.yellow('📐 Checking formatting consistency...'));
        
        const jsFiles = await this.getJavaScriptFiles();
        
        for (const file of jsFiles) {
            try {
                const content = await fs.readFile(file, 'utf8');
                const issues = this.analyzeFormatting(content, file);
                
                if (issues.length > 0) {
                    this.issues.inconsistentFormatting.push({
                        file,
                        issues
                    });
                }
            } catch (error) {
                // Skip files that can't be read
            }
        }
        
        console.log(chalk.green(`✓ Analyzed ${jsFiles.length} files for formatting consistency`));
    }

    async identifyHelperOpportunities() {
        console.log(chalk.yellow('🔧 Identifying test helper opportunities...'));
        
        const testFiles = await this.getTestFiles();
        
        for (const file of testFiles) {
            try {
                const content = await fs.readFile(file, 'utf8');
                
                // Skip consolidated files and files already using helpers
                if (this.consolidatedFiles.includes(path.basename(file)) || 
                    content.includes('test-helpers') || 
                    content.includes('WebUITestHelper')) {
                    continue;
                }
                
                // Check for patterns that could use helpers
                const opportunities = this.analyzeHelperOpportunities(content, file);
                
                if (opportunities.length > 0) {
                    this.issues.missingHelpers.push({
                        file,
                        opportunities
                    });
                }
            } catch (error) {
                // Skip files that can't be read
            }
        }
        
        console.log(chalk.green(`✓ Identified helper opportunities in ${this.issues.missingHelpers.length} files`));
    }

    async checkExportPatterns() {
        console.log(chalk.yellow('📦 Checking export patterns...'));
        
        const libFiles = await this.getLibraryFiles();
        
        for (const file of libFiles) {
            try {
                const content = await fs.readFile(file, 'utf8');
                const exportIssues = this.analyzeExportPatterns(content, file);
                
                if (exportIssues.length > 0) {
                    this.issues.improperExports.push({
                        file,
                        issues: exportIssues
                    });
                }
            } catch (error) {
                // Skip files that can't be read
            }
        }
        
        console.log(chalk.green(`✓ Analyzed export patterns in ${libFiles.length} library files`));
    }

    async generateImprovementPlan() {
        console.log(chalk.yellow('📋 Generating improvement plan...'));
        
        // Plan for obsolete file removal
        if (this.issues.obsoleteFiles.length > 0) {
            this.improvements.push({
                type: 'File Cleanup',
                priority: 'Medium',
                description: `Remove ${this.issues.obsoleteFiles.length} obsolete test files`,
                action: 'remove_obsolete_files',
                files: this.issues.obsoleteFiles.map(item => item.file),
                impact: 'Reduced code clutter and maintenance burden'
            });
        }
        
        // Plan for helper migration
        if (this.issues.missingHelpers.length > 0) {
            this.improvements.push({
                type: 'Test Modernization',
                priority: 'High',
                description: `Migrate ${this.issues.missingHelpers.length} files to use test helpers`,
                action: 'migrate_to_helpers',
                files: this.issues.missingHelpers.map(item => item.file),
                impact: 'Improved test consistency and maintainability'
            });
        }
        
        // Plan for formatting fixes
        if (this.issues.inconsistentFormatting.length > 0) {
            this.improvements.push({
                type: 'Formatting Standardization',
                priority: 'Low',
                description: `Fix formatting in ${this.issues.inconsistentFormatting.length} files`,
                action: 'fix_formatting',
                files: this.issues.inconsistentFormatting.map(item => item.file),
                impact: 'Improved code readability and consistency'
            });
        }
        
        console.log(chalk.green(`✓ Generated ${this.improvements.length} improvement recommendations`));
    }

    async executeSafeImprovements() {
        console.log(chalk.yellow('⚡ Executing safe improvements...'));
        
        let executedImprovements = 0;
        
        for (const improvement of this.improvements) {
            if (improvement.action === 'remove_obsolete_files' && improvement.priority !== 'High') {
                // Only remove files that are clearly obsolete and safe to remove
                const safeToRemove = improvement.files.filter(file => {
                    const item = this.issues.obsoleteFiles.find(obs => obs.file === file);
                    return item && (item.size < 500 || item.lines < 10); // Very small files only
                });
                
                if (safeToRemove.length > 0) {
                    await this.createObsoleteFilesList(safeToRemove);
                    executedImprovements++;
                }
            }
        }
        
        console.log(chalk.green(`✓ Executed ${executedImprovements} safe improvements`));
    }

    async createObsoleteFilesList(files) {
        const obsoleteList = {
            timestamp: new Date().toISOString(),
            description: 'List of obsolete test files identified for removal',
            files: files.map(file => ({
                path: file,
                reason: this.issues.obsoleteFiles.find(obs => obs.file === file)?.reason || 'Obsolete',
                consolidatedBy: this.getConsolidatedReplacement(file)
            })),
            instructions: [
                'Review each file before removal',
                'Ensure functionality is covered by consolidated tests',
                'Create backup if needed',
                'Remove files using: rm <file>'
            ]
        };
        
        await fs.writeFile('./obsolete-files-list.json', JSON.stringify(obsoleteList, null, 2));
        logger.info('Created obsolete-files-list.json for manual review');
    }

    // Helper methods
    async getTestFiles() {
        const files = await fs.readdir(process.cwd());
        return files.filter(file => 
            (file.startsWith('test-') || file.includes('test')) && file.endsWith('.js')
        ).map(file => path.join(process.cwd(), file));
    }

    async getJavaScriptFiles() {
        const files = await fs.readdir(process.cwd());
        return files.filter(file => file.endsWith('.js'))
                  .map(file => path.join(process.cwd(), file));
    }

    async getLibraryFiles() {
        try {
            const libPath = path.join(process.cwd(), 'lib');
            const files = await fs.readdir(libPath, { recursive: true });
            return files.filter(file => file.endsWith('.js'))
                       .map(file => path.join(libPath, file));
        } catch {
            return [];
        }
    }

    isSupersededByConsolidated(content, file) {
        const filename = path.basename(file);
        
        // Check if this is a WebSocket test superseded by consolidated
        if ((filename.includes('websocket') || content.includes('WebSocket')) && 
            !filename.includes('consolidated')) {
            return true;
        }
        
        // Check if this is a CLI test superseded by consolidated
        if ((filename.includes('cli') || content.includes('claude-loop.js')) && 
            !filename.includes('consolidated')) {
            return true;
        }
        
        return false;
    }

    analyzeFormatting(content, file) {
        const issues = [];
        const lines = content.split('\n');
        
        // Check for inconsistent indentation
        let spaceIndents = 0;
        let tabIndents = 0;
        
        lines.forEach(line => {
            if (line.startsWith('    ')) spaceIndents++;
            if (line.startsWith('\t')) tabIndents++;
        });
        
        if (spaceIndents > 0 && tabIndents > 0) {
            issues.push('Mixed indentation (spaces and tabs)');
        }
        
        // Check for missing shebang in executable files
        if (file.includes('test-') && !content.startsWith('#!/usr/bin/env node')) {
            issues.push('Missing shebang for executable test');
        }
        
        // Check for inconsistent quote usage
        const singleQuotes = (content.match(/'/g) || []).length;
        const doubleQuotes = (content.match(/"/g) || []).length;
        
        if (singleQuotes > 0 && doubleQuotes > 0 && Math.abs(singleQuotes - doubleQuotes) > 10) {
            issues.push('Inconsistent quote usage');
        }
        
        return issues;
    }

    analyzeHelperOpportunities(content, file) {
        const opportunities = [];
        
        // Check for WebSocket test patterns
        if (content.includes('new WebSocket') && !content.includes('WebUITestHelper')) {
            opportunities.push('Could use WebUITestHelper for WebSocket testing');
        }
        
        // Check for port management patterns
        if (content.match(/port.*=.*3\d{3}/)) {
            opportunities.push('Could use TestPortManager for port allocation');
        }
        
        // Check for duplicate test runner patterns
        if (content.includes('console.log') && content.includes('✓') && !content.includes('TestRunner')) {
            opportunities.push('Could use TestRunner for consistent test reporting');
        }
        
        // Check for manual WebUI setup
        if (content.includes('new WebUI') && !content.includes('WebUITestHelper')) {
            opportunities.push('Could use WebUITestHelper for WebUI setup');
        }
        
        return opportunities;
    }

    analyzeExportPatterns(content, file) {
        const issues = [];
        
        // Check for missing module.exports
        if (!content.includes('module.exports') && content.includes('class ')) {
            issues.push('Class defined but not exported');
        }
        
        // Check for inconsistent export patterns
        if (content.includes('module.exports') && content.includes('exports.')) {
            issues.push('Mixed export patterns (module.exports and exports)');
        }
        
        return issues;
    }

    getConsolidatedReplacement(file) {
        const filename = path.basename(file);
        
        if (filename.includes('websocket')) {
            return 'test-websocket-consolidated.js';
        } else if (filename.includes('cli')) {
            return 'test-cli-consolidated.js';
        } else if (filename.includes('webui') || filename.includes('ui')) {
            return 'test-webui-consolidated.js (when created)';
        }
        
        return 'Multiple consolidated test files';
    }

    generateReport() {
        console.log(chalk.cyan.bold('📊 Code Organization Improvement Report\n'));
        console.log('='.repeat(80));
        
        // Summary
        console.log(chalk.white.bold('ANALYSIS SUMMARY:'));
        console.log(`Obsolete files identified: ${this.issues.obsoleteFiles.length}`);
        console.log(`Formatting issues found: ${this.issues.inconsistentFormatting.length}`);
        console.log(`Helper opportunities: ${this.issues.missingHelpers.length}`);
        console.log(`Export pattern issues: ${this.issues.improperExports.length}`);
        
        // Improvements planned
        console.log('\n' + chalk.white.bold('IMPROVEMENTS PLANNED:'));
        this.improvements.forEach((improvement, index) => {
            const priorityColor = improvement.priority === 'High' ? chalk.red : 
                                improvement.priority === 'Medium' ? chalk.yellow : chalk.gray;
            
            console.log(`${index + 1}. ${chalk.cyan(improvement.type)} ${priorityColor(`[${improvement.priority}]`)}`);
            console.log(`   ${improvement.description}`);
            console.log(`   ${chalk.green('Impact:')} ${improvement.impact}`);
        });
        
        // Specific recommendations
        console.log('\n' + chalk.white.bold('SPECIFIC RECOMMENDATIONS:'));
        console.log(chalk.green('1.') + ' Review obsolete-files-list.json and remove identified files');
        console.log(chalk.green('2.') + ' Migrate remaining test files to use consolidated patterns');
        console.log(chalk.green('3.') + ' Apply consistent formatting using prettier/eslint');
        console.log(chalk.green('4.') + ' Ensure all library classes are properly exported');
        
        // Next steps
        console.log('\n' + chalk.white.bold('NEXT STEPS:'));
        console.log('• Use consolidated test files for new tests');
        console.log('• Gradually migrate existing tests to use test-helpers');
        console.log('• Remove obsolete files after verification');
        console.log('• Establish formatting standards and automation');
        
        console.log('\n' + '='.repeat(80));
        
        // Save detailed report
        const reportData = {
            timestamp: new Date().toISOString(),
            summary: {
                obsoleteFiles: this.issues.obsoleteFiles.length,
                formattingIssues: this.issues.inconsistentFormatting.length,
                helperOpportunities: this.issues.missingHelpers.length,
                exportIssues: this.issues.improperExports.length
            },
            issues: this.issues,
            improvements: this.improvements
        };
        
        fs.writeFile('./code-organization-report.json', JSON.stringify(reportData, null, 2))
          .then(() => console.log(chalk.gray('\\n📄 Detailed report saved to code-organization-report.json')))
          .catch(error => console.log(chalk.yellow(`⚠️ Could not save report: ${error.message}`)));
    }
}

// Run improvements if called directly
if (require.main === module) {
    const improver = new CodeOrganizationImprover();
    improver.improveCodeOrganization().then(() => {
        logger.info(chalk.green('🎉 Code organization analysis completed!'));
        process.exit(0);
    }).catch(error => {
        logger.error(chalk.red(`❌ Code organization improvement failed: ${error.message}`));
        process.exit(1);
    });
}

module.exports = CodeOrganizationImprover;