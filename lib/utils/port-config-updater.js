/**
 * Port Configuration Updater
 * Updates test files to use AI-driven configuration instead of hardcoded ports
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('./unified-logger');
const { PORTS, URL_PATTERNS, TEST_PORTS } = require('../config/constants');

class PortConfigUpdater {
    constructor() {
        this.hardcodedPorts = [
            PORTS.WEBUI_DEFAULT, TEST_PORTS.WEBUI_STANDALONE, 3335, 3336, TEST_PORTS.WEBUI_COMPREHENSIVE, 3997, 3998, TEST_PORTS.WEBUI_QUICK_TEST,
            TEST_PORTS.ERROR_HANDLING_1, TEST_PORTS.ERROR_HANDLING_2, TEST_PORTS.ERROR_HANDLING_3, TEST_PORTS.ERROR_HANDLING_4, 5000, PORTS.HTTP_ALT, 8000
        ];
        
        this.portMappings = new Map();
        this.updatedFiles = [];
    }

    /**
     * Update all test files to use AI-driven configuration
     * @param {string} projectPath - Path to project root
     */
    async updateProjectFiles(projectPath = process.cwd()) {
        logger.info('Starting port configuration update...');
        
        try {
            const testFiles = await this.findTestFiles(projectPath);
            logger.info(`Found ${testFiles.length} test files to update`);
            
            for (const file of testFiles) {
                await this.updateFile(file);
            }
            
            await this.generateMappingReport();
            
            logger.success(`Updated ${this.updatedFiles.length} files with AI-driven configuration`);
            return this.updatedFiles;
            
        } catch (error) {
            logger.error('Port configuration update failed:', error.message);
            throw error;
        }
    }

    /**
     * Find all test files in the project
     * @param {string} projectPath - Project root path
     * @returns {Array<string>} - Array of test file paths
     */
    async findTestFiles(projectPath) {
        const testFiles = [];
        const testPatterns = [
            /^test-.*\.js$/,
            /.*-test\.js$/,
            /.*\.test\.js$/,
            /.*test.*\.js$/
        ];
        
        async function scanDirectory(dir) {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    
                    if (entry.isDirectory() && entry.name !== 'node_modules') {
                        await scanDirectory(fullPath);
                    } else if (entry.isFile() && testPatterns.some(pattern => pattern.test(entry.name))) {
                        testFiles.push(fullPath);
                    }
                }
            } catch (error) {
                // Skip directories we can't read
                logger.debug(`Skipping directory ${dir}: ${error.message}`);
            }
        }
        
        await scanDirectory(projectPath);
        return testFiles;
    }

    /**
     * Update a single file to use AI-driven configuration
     * @param {string} filePath - Path to file to update
     */
    async updateFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            let updatedContent = content;
            let hasChanges = false;
            
            // Check if file already uses AI config
            if (content.includes('ai-config-manager') || content.includes('aiConfig')) {
                logger.debug(`File ${filePath} already uses AI config, skipping`);
                return;
            }
            
            // Add AI config import if needed
            const needsAIConfig = this.needsAIConfigImport(content);
            if (needsAIConfig) {
                updatedContent = this.addAIConfigImport(updatedContent, filePath);
                hasChanges = true;
            }
            
            // Replace hardcoded ports
            const portUpdates = this.replaceHardcodedPorts(updatedContent, filePath);
            if (portUpdates.updated) {
                updatedContent = portUpdates.content;
                hasChanges = true;
            }
            
            // Add port cleanup if needed
            if (portUpdates.portsAllocated && portUpdates.portsAllocated.length > 0) {
                updatedContent = this.addPortCleanup(updatedContent, portUpdates.portsAllocated);
                hasChanges = true;
            }
            
            if (hasChanges) {
                await fs.writeFile(filePath, updatedContent);
                this.updatedFiles.push({
                    file: filePath,
                    portsReplaced: portUpdates.portsAllocated || [],
                    changes: portUpdates.changes || []
                });
                logger.info(`Updated ${path.basename(filePath)}`);
            }
            
        } catch (error) {
            logger.warn(`Could not update file ${filePath}: ${error.message}`);
        }
    }

    /**
     * Check if file needs AI config import
     * @param {string} content - File content
     * @returns {boolean} - True if needs import
     */
    needsAIConfigImport(content) {
        // Check for hardcoded ports or localhost references
        const hasHardcodedPorts = this.hardcodedPorts.some(port => 
            content.includes(`:${port}`) || content.includes(`(${port})`)
        );
        
        const hasLocalhostPorts = /localhost:\d{4,5}/.test(content);
        
        return hasHardcodedPorts || hasLocalhostPorts;
    }

    /**
     * Add AI config import to file
     * @param {string} content - File content
     * @param {string} filePath - File path for relative import
     * @returns {string} - Updated content
     */
    addAIConfigImport(content, filePath) {
        // Determine relative path to AI config
        const relativePath = path.relative(path.dirname(filePath), path.join(process.cwd(), 'lib', 'utils', 'ai-config-manager'));
        const importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
        
        // Find existing requires
        const requireRegex = /const\s+.*?\s*=\s*require\([^)]+\);/g;
        const matches = content.match(requireRegex);
        
        if (matches && matches.length > 0) {
            // Add after last require
            const lastRequire = matches[matches.length - 1];
            const lastRequireIndex = content.lastIndexOf(lastRequire);
            const insertIndex = lastRequireIndex + lastRequire.length;
            
            const aiConfigImport = `\nconst aiConfig = require('${importPath}');`;
            
            return content.slice(0, insertIndex) + aiConfigImport + content.slice(insertIndex);
        } else {
            // Add at the top after shebang if present
            const lines = content.split('\n');
            let insertIndex = 0;
            
            if (lines[0].startsWith('#!')) {
                insertIndex = 1;
            }
            
            lines.splice(insertIndex, 0, `const aiConfig = require('${importPath}');`);
            return lines.join('\n');
        }
    }

    /**
     * Replace hardcoded ports with AI-driven allocation
     * @param {string} content - File content
     * @param {string} filePath - File path for context
     * @returns {object} - Update result
     */
    replaceHardcodedPorts(content, filePath) {
        let updatedContent = content;
        const portsAllocated = [];
        const changes = [];
        let portCounter = 1;
        
        // Replace new WebUI(port) patterns
        const webuiPattern = /new\s+WebUI\s*\(\s*(\d{4,5})\s*\)/g;
        updatedContent = updatedContent.replace(webuiPattern, (match, port) => {
            const serviceName = `test-service-${portCounter++}`;
            const variableName = `testPort${portCounter - 1}`;
            
            portsAllocated.push({ port: parseInt(port), serviceName, variableName });
            changes.push(`Replaced WebUI port ${port} with dynamic allocation`);
            
            return `new WebUI(${variableName})`;
        });
        
        // Replace localhost:port patterns
        const localhostPattern = /localhost:(\d{4,5})/g;
        updatedContent = updatedContent.replace(localhostPattern, (match, port) => {
            if (this.hardcodedPorts.includes(parseInt(port))) {
                const serviceName = `test-service-${portCounter++}`;
                const variableName = `testPort${portCounter - 1}`;
                
                if (!portsAllocated.find(p => p.port === parseInt(port))) {
                    portsAllocated.push({ port: parseInt(port), serviceName, variableName });
                    changes.push(`Replaced localhost:${port} with dynamic port`);
                }
                
                return `localhost:\${${variableName}}`;
            }
            return match;
        });
        
        // Add port allocation code if needed
        if (portsAllocated.length > 0) {
            updatedContent = this.addPortAllocationCode(updatedContent, portsAllocated);
        }
        
        return {
            content: updatedContent,
            updated: portsAllocated.length > 0,
            portsAllocated,
            changes
        };
    }

    /**
     * Add port allocation code to async function
     * @param {string} content - File content
     * @param {Array} portsAllocated - Array of port allocations
     * @returns {string} - Updated content
     */
    addPortAllocationCode(content, portsAllocated) {
        // Find the main async function
        const asyncFunctionPattern = /async\s+function\s+\w+\s*\([^)]*\)\s*{/;
        const match = content.match(asyncFunctionPattern);
        
        if (match) {
            const insertIndex = content.indexOf(match[0]) + match[0].length;
            
            // Generate allocation code
            const allocationCode = portsAllocated.map(({ serviceName, variableName }) => 
                `        const ${variableName} = await aiConfig.allocatePort('${serviceName}');`
            ).join('\n');
            
            return content.slice(0, insertIndex) + '\n' + allocationCode + content.slice(insertIndex);
        }
        
        return content;
    }

    /**
     * Add port cleanup code before function end
     * @param {string} content - File content
     * @param {Array} portsAllocated - Array of port allocations
     * @returns {string} - Updated content
     */
    addPortCleanup(content, portsAllocated) {
        // Find common cleanup patterns
        const cleanupPatterns = [
            /console\.log\(.*completed.*\);/g,
            /console\.log\(.*finished.*\);/g,
            /console\.log\(.*done.*\);/g
        ];
        
        let insertIndex = -1;
        let pattern = null;
        
        for (const p of cleanupPatterns) {
            const matches = Array.from(content.matchAll(p));
            if (matches.length > 0) {
                const lastMatch = matches[matches.length - 1];
                insertIndex = lastMatch.index;
                pattern = lastMatch[0];
                break;
            }
        }
        
        if (insertIndex !== -1) {
            // Generate cleanup code
            const cleanupCode = '\n        // Clean up allocated ports\n' +
                portsAllocated.map(({ serviceName, variableName }) => 
                    `        aiConfig.releasePort(${variableName}, '${serviceName}');`
                ).join('\n') + '\n        ';
            
            return content.slice(0, insertIndex) + cleanupCode + content.slice(insertIndex);
        }
        
        return content;
    }

    /**
     * Generate mapping report
     */
    async generateMappingReport() {
        const report = {
            timestamp: new Date().toISOString(),
            totalFilesUpdated: this.updatedFiles.length,
            portMappings: this.portMappings,
            updatedFiles: this.updatedFiles,
            summary: {
                commonPorts: this.hardcodedPorts,
                filesWithChanges: this.updatedFiles.map(f => path.basename(f.file))
            }
        };
        
        const reportPath = path.join(process.cwd(), 'port-config-update-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        logger.info(`Port configuration update report saved to: ${reportPath}`);
    }
}

module.exports = PortConfigUpdater;