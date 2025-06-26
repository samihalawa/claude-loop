#!/usr/bin/env node

/**
 * Code Quality Fix Script
 * Automatically fixes console usage and hardcoded values across the codebase
 */

const fs = require('fs').promises;
const path = require('path');
const CodeQualityFixer = require('./lib/utils/code-quality-fixer');
const logger = require('./lib/utils/unified-logger');

// Helper function to find files with pattern
async function findFiles(dir, pattern) {
    const files = [];
    try {
        const items = await fs.readdir(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = await fs.stat(fullPath);
            if (stat.isFile() && item.match(pattern)) {
                files.push(fullPath);
            }
        }
    } catch (error) {
        // Directory might not exist
    }
    return files;
}

async function main() {
    logger.info('Starting code quality fixes...');
    
    const fixer = new CodeQualityFixer();
    
    try {
        // 1. Fix main library files (highest priority)
        logger.info('Fixing main library files...');
        const libFiles = [
            './lib/claude-loop-engine.js',
            './lib/web-ui.js',
            './lib/mcp-installer.js'
        ];
        
        const libResults = await fixer.fixMultipleFiles(libFiles, ['console']);
        logger.info(`Library files: ${libResults.fixed}/${libResults.processed} fixed`);
        
        // 2. Fix utility files
        logger.info('Fixing utility files...');
        const utilFiles = (await findFiles('./lib/utils', /\.js$/))
            .filter(file => !file.includes('code-quality-fixer.js'));
        const utilResults = await fixer.fixMultipleFiles(utilFiles, ['console', 'hardcoded']);
        logger.info(`Utility files: ${utilResults.fixed}/${utilResults.processed} fixed`);
        
        // 3. Analyze test files for consolidation opportunities
        logger.info('Analyzing test files...');
        const testFiles = await findFiles('.', /^test-.*\.js$/);
        const testAnalysis = await fixer.consolidateTestFiles(testFiles);
        
        // 4. Fix a sample of test files (not all due to volume)
        logger.info('Fixing critical test files...');
        const criticalTestFiles = [
            './test-webui-integration.js',
            './test-webui-consolidated.js',
            './test-backend-comprehensive.js',
            './test-comprehensive-integration.js'
        ].filter(file => testFiles.includes(file));
        
        const testResults = await fixer.fixMultipleFiles(criticalTestFiles, ['hardcoded']);
        logger.info(`Critical test files: ${testResults.fixed}/${testResults.processed} fixed`);
        
        // 5. Summary
        const totalProcessed = libResults.processed + utilResults.processed + testResults.processed;
        const totalFixed = libResults.fixed + utilResults.fixed + testResults.fixed;
        const totalErrors = libResults.errors + utilResults.errors + testResults.errors;
        
        logger.success(`Code quality fixes completed:`);
        logger.info(`- ${totalFixed}/${totalProcessed} files fixed`);
        logger.info(`- ${totalErrors} errors encountered`);
        logger.info(`- ${testFiles.length} test files analyzed for consolidation`);
        
        if (totalErrors === 0) {
            logger.success('All fixes applied successfully!');
        } else {
            logger.warn(`${totalErrors} files had errors - review manually`);
        }
        
    } catch (error) {
        logger.error(`Code quality fix failed: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = main;