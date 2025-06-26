#!/usr/bin/env node

/**
 * Performance Bottleneck Analysis Tool
 * Comprehensive performance assessment for claude-loop
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class PerformanceBottleneckAnalyzer {
    constructor() {
        this.findings = [];
        this.metrics = {};
        
        this.performancePatterns = {
            synchronousOperations: [
                {
                    pattern: /fs\.readFileSync|fs\.writeFileSync|fs\.existsSync/gi,
                    description: 'Synchronous file operations - potential blocking',
                    impact: 'high',
                    suggestion: 'Use async alternatives (fs.promises or fs.readFile with callbacks)'
                },
                {
                    pattern: /execSync\(/gi,
                    description: 'Synchronous process execution - blocks event loop',
                    impact: 'high',
                    suggestion: 'Use spawn() or exec() with callbacks/promises'
                },
                {
                    pattern: /JSON\.parse.*large|JSON\.stringify.*large/gi,
                    description: 'Large JSON operations without streaming',
                    impact: 'medium',
                    suggestion: 'Consider streaming JSON parsers for large data'
                }
            ],
            memoryLeaks: [
                {
                    pattern: /setInterval\(/gi,
                    description: 'setInterval usage - potential memory leak if not cleared',
                    impact: 'medium',
                    suggestion: 'Ensure clearInterval() is called or use managed intervals'
                },
                {
                    pattern: /setTimeout\(/gi,
                    description: 'setTimeout usage - check for proper cleanup',
                    impact: 'low',
                    suggestion: 'Ensure clearTimeout() is called when needed'
                },
                {
                    pattern: /new Array\(\d{4,}\)|Array\(\d{4,}\)/gi,
                    description: 'Large array allocation',
                    impact: 'medium',
                    suggestion: 'Consider lazy loading or chunking for large arrays'
                },
                {
                    pattern: /\.push\(.*\)/gi,
                    description: 'Array push operations - check for unbounded growth',
                    impact: 'low',
                    suggestion: 'Implement size limits or cleanup for growing arrays'
                }
            ],
            inefficientAlgorithms: [
                {
                    pattern: /for.*for.*for/gi,
                    description: 'Nested loops (O(n³) complexity)',
                    impact: 'high',
                    suggestion: 'Consider algorithm optimization or data structure changes'
                },
                {
                    pattern: /\.find\(.*\.find\(/gi,
                    description: 'Nested array searches',
                    impact: 'medium',
                    suggestion: 'Use Map/Set or index for faster lookups'
                },
                {
                    pattern: /\.forEach\(.*\.forEach\(/gi,
                    description: 'Nested forEach loops',
                    impact: 'medium',
                    suggestion: 'Consider flattening or using more efficient iterations'
                },
                {
                    pattern: /\.sort\(\).*\.sort\(\)/gi,
                    description: 'Multiple sort operations',
                    impact: 'medium',
                    suggestion: 'Sort once or use pre-sorted data structures'
                }
            ],
            resourceIntensive: [
                {
                    pattern: /crypto\.pbkdf2Sync|crypto\.scryptSync/gi,
                    description: 'Synchronous cryptographic operations',
                    impact: 'high',
                    suggestion: 'Use async versions (pbkdf2/scrypt) to avoid blocking'
                },
                {
                    pattern: /Buffer\.alloc\(\d{6,}\)|Buffer\.allocUnsafe\(\d{6,}\)/gi,
                    description: 'Large buffer allocation',
                    impact: 'medium',
                    suggestion: 'Consider streaming or chunked processing'
                },
                {
                    pattern: /RegExp.*global.*multiline|\/.*\/gm/gi,
                    description: 'Complex regular expressions',
                    impact: 'low',
                    suggestion: 'Optimize regex patterns or cache compiled expressions'
                }
            ],
            databaseOperations: [
                {
                    pattern: /SELECT \* FROM|select \* from/gi,
                    description: 'SELECT * queries - inefficient data retrieval',
                    impact: 'medium',
                    suggestion: 'Select only needed columns'
                },
                {
                    pattern: /\.query\(.*\).*\.query\(/gi,
                    description: 'Sequential database queries',
                    impact: 'high',
                    suggestion: 'Use batch operations or transactions'
                }
            ],
            networkOperations: [
                {
                    pattern: /fetch\(.*\).*fetch\(/gi,
                    description: 'Sequential network requests',
                    impact: 'high',
                    suggestion: 'Use Promise.all() for parallel requests'
                },
                {
                    pattern: /axios\.get.*axios\.get|request\(.*request\(/gi,
                    description: 'Sequential HTTP requests',
                    impact: 'high',
                    suggestion: 'Implement concurrent requests where possible'
                }
            ]
        };
    }

    async analyze() {
        console.log('🔍 Starting performance bottleneck analysis...\n');
        
        // Analyze source files
        await this.analyzeSourceFiles();
        
        // Analyze package.json scripts
        await this.analyzePackageScripts();
        
        // Check for performance monitoring
        await this.checkPerformanceMonitoring();
        
        // Analyze WebSocket and server performance
        await this.analyzeServerPerformance();
        
        // Check memory usage patterns
        await this.analyzeMemoryPatterns();
        
        // Generate recommendations
        await this.generatePerformanceRecommendations();
        
        // Generate report
        await this.generateReport();
        
        return this.findings;
    }

    async analyzeSourceFiles() {
        console.log('📁 Analyzing source files for performance issues...');
        
        const libDir = path.join(process.cwd(), 'lib');
        const files = await this.getJavaScriptFiles(libDir);
        
        for (const file of files) {
            await this.analyzeFile(file);
        }
        
        console.log(`  Analyzed ${files.length} files`);
    }

    async getJavaScriptFiles(dir) {
        const files = [];
        
        async function walkDir(currentDir) {
            const entries = await fs.readdir(currentDir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                
                if (entry.isDirectory() && entry.name !== 'node_modules') {
                    await walkDir(fullPath);
                } else if (entry.isFile() && entry.name.endsWith('.js')) {
                    files.push(fullPath);
                }
            }
        }
        
        await walkDir(dir);
        return files;
    }

    async analyzeFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n');
            const fileSize = content.length;
            
            // Track file metrics
            const relativeFile = path.relative(process.cwd(), filePath);
            this.metrics[relativeFile] = {
                size: fileSize,
                lines: lines.length,
                issues: 0
            };
            
            // Check for performance patterns
            for (const [category, patterns] of Object.entries(this.performancePatterns)) {
                for (const { pattern, description, impact, suggestion } of patterns) {
                    const matches = content.match(pattern);
                    if (matches) {
                        // Find specific line numbers
                        lines.forEach((line, index) => {
                            if (pattern.test(line)) {
                                this.addFinding({
                                    type: 'PERFORMANCE_ISSUE',
                                    category,
                                    impact,
                                    description,
                                    suggestion,
                                    file: relativeFile,
                                    line: index + 1,
                                    code: line.trim(),
                                    pattern: pattern.toString()
                                });
                                this.metrics[relativeFile].issues++;
                            }
                        });
                    }
                }
            }
            
            // Additional file-specific analysis
            await this.analyzeFileSpecificPerformance(filePath, content, lines);
            
        } catch (error) {
            this.addFinding({
                type: 'ERROR',
                category: 'analysis',
                impact: 'low',
                description: `Failed to analyze file: ${error.message}`,
                file: path.relative(process.cwd(), filePath)
            });
        }
    }

    async analyzeFileSpecificPerformance(filePath, content, lines) {
        const relativeFile = path.relative(process.cwd(), filePath);
        
        // Check for large files
        if (content.length > 100000) { // 100KB
            this.addFinding({
                type: 'PERFORMANCE_ISSUE',
                category: 'fileSize',
                impact: 'medium',
                description: `Large file size (${Math.round(content.length / 1024)}KB) - consider splitting`,
                file: relativeFile,
                suggestion: 'Split into smaller, focused modules'
            });
        }
        
        // Check for excessive line count
        if (lines.length > 1000) {
            this.addFinding({
                type: 'PERFORMANCE_ISSUE',
                category: 'fileSize',
                impact: 'low',
                description: `Large file (${lines.length} lines) - consider refactoring`,
                file: relativeFile,
                suggestion: 'Break into smaller modules for better maintainability'
            });
        }
        
        // Check for deep nesting
        let maxIndentation = 0;
        lines.forEach((line, index) => {
            const indentation = line.search(/\S/);
            if (indentation > maxIndentation) {
                maxIndentation = indentation;
            }
            
            if (indentation > 24) { // More than 6 levels of nesting (4 spaces each)
                this.addFinding({
                    type: 'PERFORMANCE_ISSUE',
                    category: 'complexity',
                    impact: 'low',
                    description: 'Deep nesting detected - impacts readability and performance',
                    file: relativeFile,
                    line: index + 1,
                    suggestion: 'Consider extracting functions or early returns'
                });
            }
        });
        
        // Check for excessive function length
        const functionLengths = this.analyzeFunctionLengths(content);
        for (const func of functionLengths) {
            if (func.length > 100) {
                this.addFinding({
                    type: 'PERFORMANCE_ISSUE',
                    category: 'complexity',
                    impact: 'medium',
                    description: `Long function (${func.length} lines) - ${func.name}`,
                    file: relativeFile,
                    line: func.startLine,
                    suggestion: 'Break into smaller functions for better performance and readability'
                });
            }
        }
        
        // WebSocket-specific analysis
        if (filePath.includes('web-ui.js')) {
            await this.analyzeWebSocketPerformance(content, relativeFile);
        }
        
        // Engine-specific analysis
        if (filePath.includes('claude-loop-engine.js')) {
            await this.analyzeEnginePerformance(content, relativeFile);
        }
    }

    analyzeFunctionLengths(content) {
        const functions = [];
        const lines = content.split('\n');
        
        // Simple function detection (can be improved)
        const functionRegex = /^\s*(async\s+)?function\s+(\w+)|(\w+)\s*[=:]\s*(async\s+)?function|(\w+)\s*\([^)]*\)\s*{/;
        
        let currentFunction = null;
        let braceCount = 0;
        
        lines.forEach((line, index) => {
            const functionMatch = line.match(functionRegex);
            if (functionMatch && !currentFunction) {
                currentFunction = {
                    name: functionMatch[2] || functionMatch[3] || functionMatch[5] || 'anonymous',
                    startLine: index + 1,
                    length: 0
                };
                braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
            } else if (currentFunction) {
                currentFunction.length++;
                braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
                
                if (braceCount <= 0) {
                    functions.push(currentFunction);
                    currentFunction = null;
                    braceCount = 0;
                }
            }
        });
        
        return functions;
    }

    async analyzeWebSocketPerformance(content, file) {
        // Check for WebSocket-specific performance issues
        if (content.includes('ws.on(\'message\')') && !content.includes('rate limiting')) {
            this.addFinding({
                type: 'PERFORMANCE_ISSUE',
                category: 'websocket',
                impact: 'high',
                description: 'WebSocket message handling without rate limiting',
                file,
                suggestion: 'Implement message rate limiting to prevent abuse'
            });
        }
        
        if (content.includes('JSON.stringify') && content.includes('ws.send')) {
            const jsonMatches = (content.match(/JSON\.stringify/g) || []).length;
            const sendMatches = (content.match(/ws\.send/g) || []).length;
            
            if (jsonMatches > sendMatches * 2) {
                this.addFinding({
                    type: 'PERFORMANCE_ISSUE',
                    category: 'websocket',
                    impact: 'medium',
                    description: 'Excessive JSON serialization - consider caching',
                    file,
                    suggestion: 'Cache serialized JSON for repeated sends'
                });
            }
        }
        
        if (content.includes('.forEach') && content.includes('clients')) {
            this.addFinding({
                type: 'PERFORMANCE_ISSUE',
                category: 'websocket',
                impact: 'medium',
                description: 'Broadcasting to clients using forEach - consider batching',
                file,
                suggestion: 'Use for...of or batch operations for better performance'
            });
        }
    }

    async analyzeEnginePerformance(content, file) {
        // Check for engine-specific performance issues
        if (content.includes('spawn') && !content.includes('timeout')) {
            this.addFinding({
                type: 'PERFORMANCE_ISSUE',
                category: 'process',
                impact: 'medium',
                description: 'Process spawning without timeout - potential hanging',
                file,
                suggestion: 'Add timeout and proper cleanup for spawned processes'
            });
        }
        
        if (content.includes('fs.writeFile') && content.includes('temp')) {
            const tempFileMatches = (content.match(/temp.*file/gi) || []).length;
            if (tempFileMatches > 3) {
                this.addFinding({
                    type: 'PERFORMANCE_ISSUE',
                    category: 'fileSystem',
                    impact: 'medium',
                    description: 'Frequent temporary file operations',
                    file,
                    suggestion: 'Consider using in-memory operations or file pooling'
                });
            }
        }
    }

    async analyzePackageScripts() {
        console.log('📦 Analyzing package.json scripts...');
        
        try {
            const packagePath = path.join(process.cwd(), 'package.json');
            const packageContent = await fs.readFile(packagePath, 'utf8');
            const packageInfo = JSON.parse(packageContent);
            
            if (packageInfo.scripts) {
                for (const [scriptName, scriptCommand] of Object.entries(packageInfo.scripts)) {
                    // Check for performance-related script issues
                    if (scriptCommand.includes('--watch') && scriptCommand.includes('--polling')) {
                        this.addFinding({
                            type: 'PERFORMANCE_ISSUE',
                            category: 'scripts',
                            impact: 'medium',
                            description: `Script "${scriptName}" uses polling - high CPU usage`,
                            suggestion: 'Use filesystem events instead of polling when possible'
                        });
                    }
                    
                    if (scriptCommand.includes('node') && !scriptCommand.includes('--max-old-space-size')) {
                        this.addFinding({
                            type: 'PERFORMANCE_SUGGESTION',
                            category: 'scripts',
                            impact: 'low',
                            description: `Script "${scriptName}" could benefit from memory limit`,
                            suggestion: 'Consider adding --max-old-space-size for memory management'
                        });
                    }
                }
            }
        } catch (error) {
            this.addFinding({
                type: 'ERROR',
                category: 'scripts',
                impact: 'low',
                description: `Failed to analyze package scripts: ${error.message}`
            });
        }
    }

    async checkPerformanceMonitoring() {
        console.log('📊 Checking performance monitoring capabilities...');
        
        // Check if performance monitoring utilities exist
        const performanceFiles = [
            'lib/utils/performance-monitor.js',
            'lib/utils/performance-optimizer.js'
        ];
        
        let monitoringCapabilities = 0;
        
        for (const file of performanceFiles) {
            try {
                await fs.access(path.join(process.cwd(), file));
                monitoringCapabilities++;
                
                const content = await fs.readFile(path.join(process.cwd(), file), 'utf8');
                
                // Check for specific monitoring features
                if (content.includes('memory') && content.includes('usage')) {
                    this.addFinding({
                        type: 'PERFORMANCE_FEATURE',
                        category: 'monitoring',
                        impact: 'info',
                        description: `Memory monitoring found in ${file}`,
                        suggestion: 'Good - memory monitoring is implemented'
                    });
                }
                
                if (content.includes('performance') && content.includes('now')) {
                    this.addFinding({
                        type: 'PERFORMANCE_FEATURE',
                        category: 'monitoring',
                        impact: 'info',
                        description: `Performance timing found in ${file}`,
                        suggestion: 'Good - performance timing is implemented'
                    });
                }
                
            } catch (error) {
                // File doesn't exist
            }
        }
        
        if (monitoringCapabilities === 0) {
            this.addFinding({
                type: 'PERFORMANCE_ISSUE',
                category: 'monitoring',
                impact: 'medium',
                description: 'No performance monitoring utilities found',
                suggestion: 'Implement performance monitoring for better insights'
            });
        } else {
            this.addFinding({
                type: 'PERFORMANCE_FEATURE',
                category: 'monitoring',
                impact: 'info',
                description: `Found ${monitoringCapabilities} performance monitoring utilities`,
                suggestion: 'Good - performance monitoring capabilities exist'
            });
        }
    }

    async analyzeServerPerformance() {
        console.log('🌐 Analyzing server performance patterns...');
        
        // Analyze main server files
        const serverFiles = [
            'lib/web-ui.js',
            'lib/claude-loop-engine.js'
        ];
        
        for (const file of serverFiles) {
            try {
                const filePath = path.join(process.cwd(), file);
                const content = await fs.readFile(filePath, 'utf8');
                
                // Check for server-specific performance patterns
                if (content.includes('express()')) {
                    // Express.js performance checks
                    if (!content.includes('compression') && !content.includes('gzip')) {
                        this.addFinding({
                            type: 'PERFORMANCE_ISSUE',
                            category: 'server',
                            impact: 'medium',
                            description: 'Express server without compression middleware',
                            file: path.relative(process.cwd(), filePath),
                            suggestion: 'Add compression middleware for better response times'
                        });
                    }
                    
                    if (!content.includes('helmet') && !content.includes('security')) {
                        this.addFinding({
                            type: 'PERFORMANCE_SUGGESTION',
                            category: 'server',
                            impact: 'low',
                            description: 'Express server could benefit from security middleware',
                            file: path.relative(process.cwd(), filePath),
                            suggestion: 'Consider adding helmet.js for security headers'
                        });
                    }
                }
                
                if (content.includes('WebSocket')) {
                    // WebSocket performance checks
                    if (!content.includes('perMessageDeflate')) {
                        this.addFinding({
                            type: 'PERFORMANCE_SUGGESTION',
                            category: 'websocket',
                            impact: 'medium',
                            description: 'WebSocket without compression',
                            file: path.relative(process.cwd(), filePath),
                            suggestion: 'Enable perMessageDeflate for better bandwidth usage'
                        });
                    } else {
                        this.addFinding({
                            type: 'PERFORMANCE_FEATURE',
                            category: 'websocket',
                            impact: 'info',
                            description: 'WebSocket compression is enabled',
                            file: path.relative(process.cwd(), filePath),
                            suggestion: 'Good - WebSocket compression helps with performance'
                        });
                    }
                }
                
            } catch (error) {
                // File might not exist
            }
        }
    }

    async analyzeMemoryPatterns() {
        console.log('💾 Analyzing memory usage patterns...');
        
        const allFiles = await this.getJavaScriptFiles(path.join(process.cwd(), 'lib'));
        let totalSize = 0;
        let largeFiles = 0;
        
        for (const file of allFiles) {
            try {
                const content = await fs.readFile(file, 'utf8');
                const size = content.length;
                totalSize += size;
                
                if (size > 50000) { // 50KB
                    largeFiles++;
                }
                
                // Check for memory-intensive patterns
                if (content.includes('Buffer.alloc') || content.includes('Buffer.allocUnsafe')) {
                    const bufferMatches = content.match(/Buffer\.alloc\w*\(\d+/g);
                    if (bufferMatches) {
                        for (const match of bufferMatches) {
                            const sizeMatch = match.match(/\((\d+)/);
                            if (sizeMatch && parseInt(sizeMatch[1]) > 1000000) { // 1MB
                                this.addFinding({
                                    type: 'PERFORMANCE_ISSUE',
                                    category: 'memory',
                                    impact: 'high',
                                    description: `Large buffer allocation (${Math.round(parseInt(sizeMatch[1]) / 1024)}KB)`,
                                    file: path.relative(process.cwd(), file),
                                    suggestion: 'Consider streaming or chunked processing'
                                });
                            }
                        }
                    }
                }
                
            } catch (error) {
                // Skip files that can't be read
            }
        }
        
        this.addFinding({
            type: 'PERFORMANCE_METRIC',
            category: 'memory',
            impact: 'info',
            description: `Total codebase size: ${Math.round(totalSize / 1024)}KB across ${allFiles.length} files`,
            suggestion: `${largeFiles} files are larger than 50KB - consider splitting if needed`
        });
    }

    async generatePerformanceRecommendations() {
        console.log('💡 Generating performance recommendations...');
        
        const recommendations = [
            {
                category: 'General',
                priority: 'high',
                title: 'Async Operations',
                description: 'Use asynchronous operations to prevent blocking the event loop'
            },
            {
                category: 'Memory',
                priority: 'medium',
                title: 'Memory Management',
                description: 'Implement proper memory cleanup and avoid memory leaks'
            },
            {
                category: 'Network',
                priority: 'medium',
                title: 'Connection Pooling',
                description: 'Use connection pooling for database and HTTP connections'
            },
            {
                category: 'Caching',
                priority: 'medium',
                title: 'Implement Caching',
                description: 'Cache frequently accessed data and computed results'
            },
            {
                category: 'Monitoring',
                priority: 'low',
                title: 'Performance Monitoring',
                description: 'Implement comprehensive performance monitoring and alerting'
            }
        ];
        
        this.addFinding({
            type: 'RECOMMENDATIONS',
            category: 'performance',
            impact: 'info',
            description: 'Performance optimization recommendations',
            recommendations
        });
    }

    addFinding(finding) {
        finding.timestamp = new Date().toISOString();
        finding.id = Math.random().toString(36).substr(2, 9);
        this.findings.push(finding);
    }

    async generateReport() {
        console.log('\n📊 Generating performance analysis report...\n');
        
        const summary = this.generateSummary();
        
        const report = {
            timestamp: new Date().toISOString(),
            summary,
            metrics: this.metrics,
            findings: this.findings.sort((a, b) => {
                const impactOrder = { high: 3, medium: 2, low: 1, info: 0 };
                return (impactOrder[b.impact] || 0) - (impactOrder[a.impact] || 0);
            }),
            recommendations: this.generateActionableRecommendations()
        };
        
        const reportPath = path.join(process.cwd(), 'performance-bottleneck-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        this.printSummary(summary);
        
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
        
        return report;
    }

    generateSummary() {
        const summary = {
            total: this.findings.length,
            highImpact: 0,
            mediumImpact: 0,
            lowImpact: 0,
            info: 0,
            categories: {},
            filesAnalyzed: Object.keys(this.metrics).length,
            totalCodeSize: 0,
            averageFileSize: 0
        };
        
        // Calculate totals
        for (const finding of this.findings) {
            switch (finding.impact) {
                case 'high':
                    summary.highImpact++;
                    break;
                case 'medium':
                    summary.mediumImpact++;
                    break;
                case 'low':
                    summary.lowImpact++;
                    break;
                default:
                    summary.info++;
            }
            
            summary.categories[finding.category] = (summary.categories[finding.category] || 0) + 1;
        }
        
        // Calculate file metrics
        const fileSizes = Object.values(this.metrics).map(m => m.size);
        summary.totalCodeSize = fileSizes.reduce((a, b) => a + b, 0);
        summary.averageFileSize = summary.totalCodeSize / fileSizes.length;
        
        return summary;
    }

    generateActionableRecommendations() {
        const recommendations = [];
        const categoryIssues = {};
        
        // Group issues by category
        for (const finding of this.findings) {
            if (finding.type === 'PERFORMANCE_ISSUE') {
                if (!categoryIssues[finding.category]) {
                    categoryIssues[finding.category] = [];
                }
                categoryIssues[finding.category].push(finding);
            }
        }
        
        // Generate specific recommendations based on findings
        for (const [category, issues] of Object.entries(categoryIssues)) {
            const highImpactIssues = issues.filter(i => i.impact === 'high').length;
            const mediumImpactIssues = issues.filter(i => i.impact === 'medium').length;
            
            if (highImpactIssues > 0) {
                recommendations.push({
                    priority: 'HIGH',
                    category,
                    title: `Fix ${highImpactIssues} high-impact ${category} issues`,
                    description: `Address ${category} performance bottlenecks immediately`,
                    issuesCount: highImpactIssues
                });
            }
            
            if (mediumImpactIssues > 2) {
                recommendations.push({
                    priority: 'MEDIUM',
                    category,
                    title: `Optimize ${category} performance`,
                    description: `${mediumImpactIssues} medium-impact issues found`,
                    issuesCount: mediumImpactIssues
                });
            }
        }
        
        return recommendations;
    }

    printSummary(summary) {
        console.log('⚡ PERFORMANCE BOTTLENECK ANALYSIS SUMMARY');
        console.log('='.repeat(50));
        console.log(`Total findings: ${summary.total}`);
        console.log(`High impact issues: ${summary.highImpact}`);
        console.log(`Medium impact issues: ${summary.mediumImpact}`);
        console.log(`Low impact issues: ${summary.lowImpact}`);
        console.log(`Info items: ${summary.info}`);
        
        console.log('\nIssues by category:');
        for (const [category, count] of Object.entries(summary.categories)) {
            console.log(`  ${category}: ${count}`);
        }
        
        console.log('\nCode metrics:');
        console.log(`  Files analyzed: ${summary.filesAnalyzed}`);
        console.log(`  Total code size: ${Math.round(summary.totalCodeSize / 1024)}KB`);
        console.log(`  Average file size: ${Math.round(summary.averageFileSize / 1024)}KB`);
        
        // Performance score
        const performanceScore = Math.max(0, 100 - (summary.highImpact * 10) - (summary.mediumImpact * 5) - (summary.lowImpact * 2));
        let scoreLevel;
        
        if (performanceScore >= 90) {
            scoreLevel = '🟢 EXCELLENT';
        } else if (performanceScore >= 70) {
            scoreLevel = '🟡 GOOD';
        } else if (performanceScore >= 50) {
            scoreLevel = '🟠 NEEDS IMPROVEMENT';
        } else {
            scoreLevel = '🔴 POOR';
        }
        
        console.log(`\nPerformance Score: ${scoreLevel} (${performanceScore}/100)`);
    }
}

// Main execution
async function main() {
    try {
        const analyzer = new PerformanceBottleneckAnalyzer();
        await analyzer.analyze();
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = PerformanceBottleneckAnalyzer;