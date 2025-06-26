const chalk = require('chalk');
const { PORTS, URL_PATTERNS, TEST_PORTS } = require('../config/constants');

// Simple logger interface that fallback to console if no external logger is available
const logger = {
    info: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
};

/**
 * Unified logging service that provides consistent logging patterns
 * and automatic WebUI integration throughout the application
 */
class UnifiedLogger {
    constructor() {
        this.webUI = null;
        this.verbose = process.env.NODE_ENV === 'development';
        this.debugMode = process.env.DEBUG === 'true';
    }

    setWebUI(webUIInstance) {
        this.webUI = webUIInstance;
    }

    // Core logging methods that handle both console and WebUI output
    info(message, details = null) {
        logger.info(chalk.blue('ℹ'), message);
        if (details && this.verbose) {
            logger.info(chalk.gray(`  ${details}`));
        }
        this.sendToWebUI(message, 'info');
    }

    success(message, details = null) {
        logger.info(chalk.green('✓'), message);
        if (details && this.verbose) {
            logger.info(chalk.gray(`  ${details}`));
        }
        this.sendToWebUI(`✓ ${message}`, 'success');
    }

    warn(message, details = null) {
        logger.info(chalk.yellow('⚠'), message);
        if (details && this.verbose) {
            logger.info(chalk.gray(`  ${details}`));
        }
        this.sendToWebUI(`⚠ ${message}`, 'warning');
    }

    error(message, details = null) {
        logger.info(chalk.red('❌'), message);
        if (details && this.verbose) {
            logger.info(chalk.red(`  ${details}`));
        }
        this.sendToWebUI(`❌ ${message}`, 'error');
    }

    debug(message, details = null) {
        if (this.debugMode) {
            logger.info(chalk.gray('🔍'), chalk.gray(message));
            if (details) {
                logger.info(chalk.gray(`  ${details}`));
            }
            this.sendToWebUI(`🔍 ${message}`, 'info');
        }
    }

    // Progress and status specific methods
    progress(message, current = null, total = null) {
        let progressMsg = message;
        if (current !== null && total !== null) {
            const percentage = Math.round((current / total) * 100);
            progressMsg = `${message} (${current}/${total} - ${percentage}%)`;
        }
        
        logger.info(chalk.cyan('→'), progressMsg);
        this.sendToWebUI(`→ ${progressMsg}`, 'info');
    }

    phase(phaseName, description = null) {
        const message = description ? `${phaseName}: ${description}` : phaseName;
        logger.info(chalk.magenta('🔄'), chalk.bold(message));
        this.sendToWebUI(`🔄 ${message}`, 'info');
    }

    // File operation specific logging
    fileOperation(operation, filePath, success = true) {
        const status = success ? chalk.green('✓') : chalk.red('❌');
        const message = `${operation}: ${filePath}`;
        logger.info(status, chalk.gray(message));
        this.sendToWebUI(`${success ? '✓' : '❌'} ${message}`, success ? 'success' : 'error');
    }

    // Network operation specific logging
    networkOperation(operation, details, success = true) {
        const status = success ? chalk.green('✓') : chalk.red('❌');
        const message = `${operation}: ${details}`;
        logger.info(status, message);
        this.sendToWebUI(`${success ? '✓' : '❌'} ${message}`, success ? 'success' : 'error');
    }

    // Process operation specific logging
    processOperation(operation, command, success = true) {
        const status = success ? chalk.green('✓') : chalk.red('❌');
        const message = `${operation}: ${command}`;
        logger.info(status, chalk.gray(message));
        this.sendToWebUI(`${success ? '✓' : '❌'} ${message}`, success ? 'success' : 'error');
    }

    // Raw console output for cases where we need direct control
    raw(message, color = null) {
        if (color && chalk[color]) {
            logger.info(chalk[color](message));
        } else {
            logger.info(message);
        }
    }

    // Session and timing specific methods
    sessionStart(sessionInfo) {
        logger.info(chalk.cyan.bold('🚀 Session Started'));
        logger.info(chalk.gray(`Repository: ${sessionInfo.repoPath}`));
        logger.info(chalk.gray(`Max Iterations: ${sessionInfo.maxIterations}`));
        this.sendToWebUI('🚀 Session Started', 'info');
        this.sendToWebUI(`Repository: ${sessionInfo.repoPath}`, 'info');
    }

    sessionEnd(sessionInfo) {
        logger.info(chalk.cyan.bold('🏁 Session Completed'));
        logger.info(chalk.gray(`Total Iterations: ${sessionInfo.iterations}`));
        logger.info(chalk.gray(`Duration: ${sessionInfo.duration}`));
        this.sendToWebUI('🏁 Session Completed', 'success');
        this.sendToWebUI(`Total Iterations: ${sessionInfo.iterations}`, 'info');
    }

    // Iteration specific logging
    iterationStart(iteration, maxIterations, focus) {
        const progressBar = this.generateProgressBar(iteration, maxIterations);
        logger.info(chalk.bold(`\n🔄 Iteration ${iteration}/${maxIterations}`));
        logger.info('━'.repeat(50));
        logger.info(`Progress: ${progressBar} ${Math.round((iteration / maxIterations) * 100)}%`);
        logger.info(`Focus: ${focus}`);
        logger.info('━'.repeat(50) + '\n');
        
        this.sendToWebUI(`🔄 Starting Iteration ${iteration}/${maxIterations}`, 'info');
        this.sendToWebUI(`Focus: ${focus}`, 'info');
    }

    // Helper methods
    generateProgressBar(current, total, width = null) {
        const barWidth = width || 50;
        const percentage = current / total;
        const filled = Math.round(barWidth * percentage);
        const empty = barWidth - filled;
        return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    }

    formatElapsedTime(startTime) {
        const elapsed = Date.now() - startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }

    // WebUI integration
    sendToWebUI(message, type = 'info') {
        if (this.webUI && this.webUI.addOutput) {
            try {
                this.webUI.addOutput(message, type);
            } catch (error) {
                // Fallback to console if WebUI fails
                logger.error('WebUI logging failed:', error.message);
            }
        }
    }

    // Cleanup method
    cleanup() {
        this.webUI = null;
    }

    // Error handling with stack traces for debugging
    errorWithStack(message, error) {
        logger.info(chalk.red('❌'), message);
        if (this.debugMode && error.stack) {
            logger.info(chalk.red(error.stack));
        } else if (this.verbose) {
            logger.info(chalk.red(`  Error: ${error.message}`));
        }
        this.sendToWebUI(`❌ ${message}: ${error.message}`, 'error');
    }

    // Configuration logging
    logConfiguration() {
        if (this.debugMode) {
            logger.info(chalk.cyan('📋 Configuration:'));
            logger.info('Environment:', process.env.NODE_ENV);
        }
    }
}

// Export singleton instance
module.exports = new UnifiedLogger();