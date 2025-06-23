const { spawn } = require('child_process');
const config = require('../config');
const logger = require('./unified-logger');

/**
 * Centralized process runner utility
 * Handles child process spawning with consistent patterns and error handling
 */
class ProcessRunner {
    constructor() {
        this.activeProcesses = new Set();
        this.setupCleanupHandlers();
    }

    /**
     * Run Claude CLI command with specified options
     * @param {Object} options - Configuration options
     * @returns {Promise<Object>} - Result object with success, output, and error info
     */
    async runClaudeCommand(options = {}) {
        const {
            prompt = '',
            promptFile = null,
            maxTurns = config.get('engine.maxTurns'),
            continueSession = false,
            stdio = 'inherit',
            cwd = process.cwd(),
            timeout = config.get('timing.processTimeout'),
            dangerouslySkipPermissions = config.get('engine.dangerouslySkipPermissions')
        } = options;

        const claudeCommand = config.get('engine.claudeCommand');
        const args = this.buildClaudeArgs({
            prompt,
            promptFile,
            maxTurns,
            continueSession,
            dangerouslySkipPermissions
        });

        logger.processOperation('Starting Claude CLI', `${claudeCommand} ${args.join(' ')}`, true);

        return this.runProcess({
            command: claudeCommand,
            args,
            stdio,
            cwd,
            timeout
        });
    }

    /**
     * Run a generic process with timeout and error handling
     * @param {Object} options - Process configuration
     * @returns {Promise<Object>} - Result object
     */
    async runProcess(options = {}) {
        const {
            command,
            args = [],
            stdio = 'inherit',
            cwd = process.cwd(),
            timeout = config.get('timing.processTimeout'),
            env = process.env
        } = options;

        return new Promise((resolve, reject) => {
            let output = '';
            let errorOutput = '';
            let timeoutId = null;
            let processCompleted = false;

            logger.debug(`Spawning process: ${command} ${args.join(' ')}`);

            const childProcess = spawn(command, args, {
                cwd,
                stdio,
                env
            });

            // Track the process for cleanup
            this.activeProcesses.add(childProcess);

            // Set up timeout if specified
            if (timeout > 0) {
                timeoutId = setTimeout(() => {
                    if (!processCompleted) {
                        logger.warn(`Process timeout after ${timeout}ms: ${command}`);
                        childProcess.kill('SIGTERM');
                        
                        // Force kill after additional 5 seconds
                        setTimeout(() => {
                            if (!processCompleted) {
                                childProcess.kill('SIGKILL');
                            }
                        }, 5000);
                    }
                }, timeout);
            }

            // Handle process output for pipe mode
            if (stdio === 'pipe' || stdio[1] === 'pipe') {
                childProcess.stdout?.on('data', (data) => {
                    output += data.toString();
                });

                childProcess.stderr?.on('data', (data) => {
                    errorOutput += data.toString();
                });
            }

            // Handle process completion
            childProcess.on('close', (code, signal) => {
                processCompleted = true;
                if (timeoutId) clearTimeout(timeoutId);
                this.activeProcesses.delete(childProcess);

                const result = {
                    success: code === 0,
                    code,
                    signal,
                    output: output.trim(),
                    error: errorOutput.trim(),
                    command: `${command} ${args.join(' ')}`
                };

                if (code === 0) {
                    logger.processOperation('Process completed successfully', command, true);
                    resolve(result);
                } else {
                    const errorMsg = signal ? 
                        `Process killed with signal ${signal}` : 
                        `Process exited with code ${code}`;
                    
                    logger.processOperation('Process failed', `${command}: ${errorMsg}`, false);
                    reject(new Error(errorMsg));
                }
            });

            // Handle process errors
            childProcess.on('error', (error) => {
                processCompleted = true;
                if (timeoutId) clearTimeout(timeoutId);
                this.activeProcesses.delete(childProcess);

                logger.error(`Process error: ${command}`, error.message);
                reject(error);
            });

            // Handle unexpected exits
            childProcess.on('exit', (code, signal) => {
                if (signal === 'SIGTERM' || signal === 'SIGKILL') {
                    logger.debug(`Process terminated: ${command} (${signal})`);
                }
            });
        });
    }

    /**
     * Build Claude CLI arguments based on options
     * @param {Object} options - Argument options
     * @returns {Array<string>} - Array of CLI arguments
     */
    buildClaudeArgs(options) {
        const {
            prompt,
            promptFile,
            maxTurns,
            continueSession,
            dangerouslySkipPermissions
        } = options;

        const args = [];

        // Add continue session flag if needed
        if (continueSession) {
            args.push('-c');
        }

        // Add prompt or prompt file
        if (promptFile) {
            args.push('-f', promptFile);
        } else if (prompt) {
            args.push('-p', prompt);
        }

        // Add max turns
        args.push('--max-turns', maxTurns.toString());

        // Add dangerous skip permissions if enabled
        if (dangerouslySkipPermissions) {
            args.push('--dangerously-skip-permissions');
        }

        return args;
    }

    /**
     * Kill all active processes
     * @param {string} signal - Signal to send (default: SIGTERM)
     * @returns {Promise<void>}
     */
    async killAllProcesses(signal = 'SIGTERM') {
        if (this.activeProcesses.size === 0) {
            return;
        }

        logger.warn(`Killing ${this.activeProcesses.size} active processes with ${signal}`);

        const killPromises = Array.from(this.activeProcesses).map(process => {
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    // Force kill if process doesn't respond to SIGTERM
                    process.kill('SIGKILL');
                    resolve();
                }, 5000);

                process.on('exit', () => {
                    clearTimeout(timeout);
                    resolve();
                });

                process.kill(signal);
            });
        });

        await Promise.all(killPromises);
        this.activeProcesses.clear();
    }

    /**
     * Get statistics about active processes
     * @returns {Object} - Process statistics
     */
    getStats() {
        return {
            activeProcesses: this.activeProcesses.size,
            processes: Array.from(this.activeProcesses).map(p => ({
                pid: p.pid,
                command: p.spawnargs.join(' ')
            }))
        };
    }

    /**
     * Setup cleanup handlers for process termination
     */
    setupCleanupHandlers() {
        const cleanup = async () => {
            logger.info('🧹 Cleaning up active processes...');
            await this.killAllProcesses();
        };

        // Handle various process termination signals
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('SIGQUIT', cleanup);
        process.on('exit', cleanup);
    }

    /**
     * Run Claude with prompt file (common pattern)
     * @param {string} promptFilePath - Path to prompt file
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} - Result object
     */
    async runClaudeWithPromptFile(promptFilePath, options = {}) {
        return this.runClaudeCommand({
            promptFile: promptFilePath,
            stdio: options.stdio || 'inherit',
            cwd: options.cwd || process.cwd(),
            maxTurns: options.maxTurns || config.get('engine.maxTurns'),
            continueSession: options.continueSession || false
        });
    }

    /**
     * Run Claude continue session (common pattern)
     * @param {string} prompt - Continuation prompt
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} - Result object
     */
    async runClaudeContinueSession(prompt, options = {}) {
        return this.runClaudeCommand({
            prompt,
            continueSession: true,
            stdio: options.stdio || ['pipe', 'pipe', 'pipe'],
            cwd: options.cwd || process.cwd(),
            maxTurns: options.maxTurns || config.get('engine.maxTurns')
        });
    }

    /**
     * Shutdown method for cleanup
     */
    async shutdown() {
        await this.killAllProcesses();
    }
}

// Export singleton instance
module.exports = new ProcessRunner();