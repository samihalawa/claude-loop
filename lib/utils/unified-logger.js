const chalk = require('chalk');
const config = require('../config');

/**
 * Unified logging service that provides consistent logging patterns
 * and automatic WebUI integration throughout the application
 */
class UnifiedLogger {
    constructor() {
        this.webUI = null;
        this.verbose = config.get('development.verbose');
        this.debugMode = config.get('development.debugMode');
    }

    setWebUI(webUIInstance) {
        this.webUI = webUIInstance;
    }

    // Core logging methods that handle both console and WebUI output
    info(message, details = null) {
        console.log(chalk.blue('ℹ'), message);
        if (details && this.verbose) {
            console.log(chalk.gray(`  ${details}`));
        }
        this.sendToWebUI(message, 'info');
    }

    success(message, details = null) {
        console.log(chalk.green('✓'), message);
        if (details && this.verbose) {
            console.log(chalk.gray(`  ${details}`));
        }
        this.sendToWebUI(`✓ ${message}`, 'success');
    }

    warn(message, details = null) {
        console.log(chalk.yellow('⚠'), message);
        if (details && this.verbose) {
            console.log(chalk.gray(`  ${details}`));
        }
        this.sendToWebUI(`⚠ ${message}`, 'warning');
    }

    error(message, details = null) {
        console.log(chalk.red('❌'), message);
        if (details && this.verbose) {
            console.log(chalk.red(`  ${details}`));
        }
        this.sendToWebUI(`❌ ${message}`, 'error');
    }

    debug(message, details = null) {
        if (this.debugMode) {
            console.log(chalk.gray('🔍'), chalk.gray(message));
            if (details) {
                console.log(chalk.gray(`  ${details}`));
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
        
        console.log(chalk.cyan('→'), progressMsg);
        this.sendToWebUI(`→ ${progressMsg}`, 'info');
    }

    phase(phaseName, description = null) {
        const message = description ? `${phaseName}: ${description}` : phaseName;
        console.log(chalk.magenta('🔄'), chalk.bold(message));
        this.sendToWebUI(`🔄 ${message}`, 'info');
    }

    // File operation specific logging
    fileOperation(operation, filePath, success = true) {
        const status = success ? chalk.green('✓') : chalk.red('❌');
        const message = `${operation}: ${filePath}`;
        console.log(status, chalk.gray(message));
        this.sendToWebUI(`${success ? '✓' : '❌'} ${message}`, success ? 'success' : 'error');
    }

    // Network operation specific logging
    networkOperation(operation, details, success = true) {
        const status = success ? chalk.green('✓') : chalk.red('❌');
        const message = `${operation}: ${details}`;
        console.log(status, message);
        this.sendToWebUI(`${success ? '✓' : '❌'} ${message}`, success ? 'success' : 'error');
    }

    // Process operation specific logging
    processOperation(operation, command, success = true) {
        const status = success ? chalk.green('✓') : chalk.red('❌');
        const message = `${operation}: ${command}`;
        console.log(status, chalk.gray(message));
        this.sendToWebUI(`${success ? '✓' : '❌'} ${message}`, success ? 'success' : 'error');
    }

    // Raw console output for cases where we need direct control
    raw(message, color = null) {
        if (color && chalk[color]) {
            console.log(chalk[color](message));
        } else {
            console.log(message);
        }
    }

    // Session and timing specific methods
    sessionStart(sessionInfo) {
        console.log(chalk.cyan.bold('🚀 Session Started'));
        console.log(chalk.gray(`Repository: ${sessionInfo.repoPath}`));
        console.log(chalk.gray(`Max Iterations: ${sessionInfo.maxIterations}`));
        this.sendToWebUI('🚀 Session Started', 'info');
        this.sendToWebUI(`Repository: ${sessionInfo.repoPath}`, 'info');
    }

    sessionEnd(sessionInfo) {
        console.log(chalk.cyan.bold('🏁 Session Completed'));
        console.log(chalk.gray(`Total Iterations: ${sessionInfo.iterations}`));
        console.log(chalk.gray(`Duration: ${sessionInfo.duration}`));
        this.sendToWebUI('🏁 Session Completed', 'success');
        this.sendToWebUI(`Total Iterations: ${sessionInfo.iterations}`, 'info');
    }

    // Iteration specific logging
    iterationStart(iteration, maxIterations, focus) {
        const progressBar = this.generateProgressBar(iteration, maxIterations);
        console.log(chalk.bold(`\n🔄 Iteration ${iteration}/${maxIterations}`));
        console.log('━'.repeat(50));
        console.log(`Progress: ${progressBar} ${Math.round((iteration / maxIterations) * 100)}%`);
        console.log(`Focus: ${focus}`);
        console.log('━'.repeat(50) + '\n');
        
        this.sendToWebUI(`🔄 Starting Iteration ${iteration}/${maxIterations}`, 'info');
        this.sendToWebUI(`Focus: ${focus}`, 'info');
    }

    // Helper methods
    generateProgressBar(current, total, width = null) {
        const barWidth = width || config.get('engine.progressBarWidth');
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
                console.error('WebUI logging failed:', error.message);
            }
        }
    }

    // Cleanup method
    cleanup() {
        this.webUI = null;
    }

    // Error handling with stack traces for debugging
    errorWithStack(message, error) {
        console.log(chalk.red('❌'), message);
        if (this.debugMode && error.stack) {
            console.log(chalk.red(error.stack));
        } else if (this.verbose) {
            console.log(chalk.red(`  Error: ${error.message}`));
        }
        this.sendToWebUI(`❌ ${message}: ${error.message}`, 'error');
    }

    // Configuration logging
    logConfiguration() {
        if (this.debugMode) {
            console.log(chalk.cyan('📋 Configuration:'));
            console.log(config.getEnvironmentVariablesDoc());
        }
    }
}

// Export singleton instance
module.exports = new UnifiedLogger();