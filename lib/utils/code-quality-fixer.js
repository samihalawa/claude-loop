/**
 * Code Quality Fixer Utility
 * Helps migrate hardcoded values to use constants and fixes common code quality issues
 */

const fs = require('fs').promises;
const path = require('path');
const { PORTS, URL_PATTERNS, TEST_PORTS } = require('../config/constants');
const logger = require('./unified-logger');

class CodeQualityFixer {
    constructor() {
        this.hardcodedValueReplacements = {
            // Port replacements
            '3000': 'PORTS.TEST_APP',
            '3333': 'PORTS.WEBUI_DEFAULT', 
            '3334': 'TEST_PORTS.WEBUI_STANDALONE',
            '3337': 'TEST_PORTS.WEBUI_COMPREHENSIVE',
            '3999': 'TEST_PORTS.WEBUI_QUICK_TEST',
            '4000': 'TEST_PORTS.ERROR_HANDLING_1',
            '4001': 'TEST_PORTS.ERROR_HANDLING_2',
            '4002': 'TEST_PORTS.ERROR_HANDLING_3',
            '4003': 'TEST_PORTS.ERROR_HANDLING_4',
            '8080': 'PORTS.HTTP_ALT',
            
            // URL patterns
            'localhost': 'URL_PATTERNS.LOCALHOST',
            '127.0.0.1': 'URL_PATTERNS.LOCAL_IP',
            'http://': 'URL_PATTERNS.HTTP_PREFIX',
            'https://': 'URL_PATTERNS.HTTPS_PREFIX',
            'ws://': 'URL_PATTERNS.WS_PREFIX',
            'wss://': 'URL_PATTERNS.WSS_PREFIX'
        };
        
        this.consoleReplacements = {
            'console.log': 'logger.info',
            'console.error': 'logger.error',
            'console.warn': 'logger.warn',
            'console.info': 'logger.info',
            'console.debug': 'logger.debug'
        };
    }

    /**
     * Fix console usage in a file
     */
    async fixConsoleUsage(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            let updatedContent = content;
            let hasChanges = false;

            // Skip if file already imports logger
            if (!content.includes('require(\'./utils/unified-logger\')') && 
                !content.includes('require(\'../utils/unified-logger\')') &&
                !content.includes('require(\'../../utils/unified-logger\')')) {
                
                // Add logger import at the top after existing requires
                const requireRegex = /(const .+ = require\(.+\);?\n)+/;
                const match = content.match(requireRegex);
                if (match) {
                    const loggerImport = this.getLoggerImport(filePath);
                    updatedContent = content.replace(
                        match[0], 
                        match[0] + loggerImport + '\n'
                    );
                    hasChanges = true;
                }
            }

            // Replace console calls (only in non-test files or keep test console.log)
            const isTestFile = filePath.includes('test-') || filePath.includes('.test.');
            
            for (const [oldPattern, newPattern] of Object.entries(this.consoleReplacements)) {
                if (isTestFile && oldPattern === 'console.log') {
                    continue; // Keep console.log in test files for output
                }
                
                const regex = new RegExp(oldPattern.replace('.', '\\.'), 'g');
                if (regex.test(updatedContent)) {
                    updatedContent = updatedContent.replace(regex, newPattern);
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                await fs.writeFile(filePath, updatedContent, 'utf8');
                logger.success(`Fixed console usage in ${path.basename(filePath)}`);
                return true;
            }
            
            return false;
        } catch (error) {
            logger.error(`Failed to fix console usage in ${filePath}: ${error.message}`);
            return false;
        }
    }

    /**
     * Fix hardcoded values in a file
     */
    async fixHardcodedValues(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            let updatedContent = content;
            let hasChanges = false;

            // Add constants import if not present
            if (!content.includes('require(\'./config/constants\')') && 
                !content.includes('require(\'../config/constants\')') &&
                !content.includes('require(\'../../config/constants\')')) {
                
                const constantsImport = this.getConstantsImport(filePath);
                const requireRegex = /(const .+ = require\(.+\);?\n)+/;
                const match = content.match(requireRegex);
                if (match) {
                    updatedContent = content.replace(
                        match[0], 
                        match[0] + constantsImport + '\n'
                    );
                    hasChanges = true;
                }
            }

            // Replace hardcoded values
            for (const [hardcoded, constant] of Object.entries(this.hardcodedValueReplacements)) {
                // Be careful with port numbers - only replace standalone numbers
                if (/^\d+$/.test(hardcoded)) {
                    const regex = new RegExp(`\\b${hardcoded}\\b`, 'g');
                    if (regex.test(updatedContent)) {
                        updatedContent = updatedContent.replace(regex, constant);
                        hasChanges = true;
                    }
                } else {
                    // For strings, be more careful about context
                    const quotedRegex = new RegExp(`['"]${hardcoded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g');
                    if (quotedRegex.test(updatedContent)) {
                        updatedContent = updatedContent.replace(quotedRegex, constant);
                        hasChanges = true;
                    }
                }
            }

            if (hasChanges) {
                await fs.writeFile(filePath, updatedContent, 'utf8');
                logger.success(`Fixed hardcoded values in ${path.basename(filePath)}`);
                return true;
            }
            
            return false;
        } catch (error) {
            logger.error(`Failed to fix hardcoded values in ${filePath}: ${error.message}`);
            return false;
        }
    }

    /**
     * Get appropriate logger import path based on file location
     */
    getLoggerImport(filePath) {
        const relativePath = path.relative(process.cwd(), filePath);
        
        if (relativePath.startsWith('lib/utils/')) {
            return "const logger = require('./unified-logger');";
        } else if (relativePath.startsWith('lib/')) {
            return "const logger = require('./utils/unified-logger');";
        } else {
            return "const logger = require('./lib/utils/unified-logger');";
        }
    }

    /**
     * Get appropriate constants import path based on file location
     */
    getConstantsImport(filePath) {
        const relativePath = path.relative(process.cwd(), filePath);
        
        if (relativePath.startsWith('lib/utils/')) {
            return "const { PORTS, URL_PATTERNS, TEST_PORTS } = require('../config/constants');";
        } else if (relativePath.startsWith('lib/')) {
            return "const { PORTS, URL_PATTERNS, TEST_PORTS } = require('./config/constants');";
        } else {
            return "const { PORTS, URL_PATTERNS, TEST_PORTS } = require('./lib/config/constants');";
        }
    }

    /**
     * Process multiple files for code quality fixes
     */
    async fixMultipleFiles(filePaths, fixTypes = ['console', 'hardcoded']) {
        const results = {
            processed: 0,
            fixed: 0,
            errors: 0
        };

        for (const filePath of filePaths) {
            try {
                results.processed++;
                let fileFixed = false;

                if (fixTypes.includes('console')) {
                    const consoleFixed = await this.fixConsoleUsage(filePath);
                    fileFixed = fileFixed || consoleFixed;
                }

                if (fixTypes.includes('hardcoded')) {
                    const hardcodedFixed = await this.fixHardcodedValues(filePath);
                    fileFixed = fileFixed || hardcodedFixed;
                }

                if (fileFixed) {
                    results.fixed++;
                }
            } catch (error) {
                logger.error(`Error processing ${filePath}: ${error.message}`);
                results.errors++;
            }
        }

        return results;
    }

    /**
     * Consolidate duplicate test patterns
     */
    async consolidateTestFiles(testFiles) {
        // This would consolidate test files to use test-helpers.js
        // Implementation would be complex, so for now we'll report on opportunities
        
        const duplicatePatterns = {
            webuiRequires: 0,
            duplicateSetup: 0,
            duplicateCleanup: 0
        };

        for (const filePath of testFiles) {
            try {
                const content = await fs.readFile(filePath, 'utf8');
                
                if (content.includes("const WebUI = require('./lib/web-ui')")) {
                    duplicatePatterns.webuiRequires++;
                }
                
                if (content.includes('webUI.start()')) {
                    duplicatePatterns.duplicateSetup++;
                }
                
                if (content.includes('webUI.stop()')) {
                    duplicatePatterns.duplicateCleanup++;
                }
            } catch (error) {
                logger.error(`Error analyzing ${filePath}: ${error.message}`);
            }
        }

        logger.info(`Test consolidation opportunities:`);
        logger.info(`- ${duplicatePatterns.webuiRequires} files could use WebUITestHelper`);
        logger.info(`- ${duplicatePatterns.duplicateSetup} files have duplicate setup patterns`);
        logger.info(`- ${duplicatePatterns.duplicateCleanup} files have duplicate cleanup patterns`);

        return duplicatePatterns;
    }
}

module.exports = CodeQualityFixer;