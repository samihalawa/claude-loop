const { spawn, execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');
const MCPInstaller = require('./mcp-installer');
const WebUI = require('./web-ui');
const logger = require('./utils/unified-logger');
const {
    CLAUDE_LOOP,
    TIMEOUTS,
    TIME_CONSTANTS,
    FILE_SYSTEM,
    UI_CONFIG,
    UI_DISPLAY,
    FILE_SIZE_LIMITS,
    HTTP_RESPONSES,
    PORTS,
    SECURITY
} = require('./config/constants');

// Enhanced security utilities
function sanitizeCommand(command) {
    const allowedCommands = ['claude', '/usr/local/bin/claude', 'npx claude'];
    
    if (!command || typeof command !== 'string') {
        return CLAUDE_LOOP.DEFAULT_CLAUDE_COMMAND;
    }
    
    if (/[;&|`$(){}[\]\\]/.test(command)) {
        logger.warn(`Suspicious command detected: ${command}`);
        return CLAUDE_LOOP.DEFAULT_CLAUDE_COMMAND;
    }
    
    return allowedCommands.includes(command) ? command : CLAUDE_LOOP.DEFAULT_CLAUDE_COMMAND;
}

function createSecureTempFile(baseDir, prefix) {
    const crypto = require('crypto');
    const os = require('os');
    
    const resolvedBaseDir = path.resolve(baseDir);
    const safeDirs = [process.cwd(), os.tmpdir()];
    const isSafeDir = safeDirs.some(safeDir => 
        resolvedBaseDir.startsWith(path.resolve(safeDir))
    );
    
    if (!isSafeDir) {
        throw new Error(`Unsafe directory for temp file: ${resolvedBaseDir}`);
    }
    
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const filename = `${prefix}-${randomSuffix}.tmp`;
    return path.join(resolvedBaseDir, filename);
}

function validateFilePath(filePath) {
    try {
        const resolved = path.resolve(filePath);
        const cwd = process.cwd();
        const tmpDir = require('os').tmpdir();
        
        if (!resolved.startsWith(cwd) && !resolved.startsWith(tmpDir)) {
            throw new Error(`File path outside allowed directories: ${resolved}`);
        }
        
        if (resolved.startsWith(tmpDir)) {
            const basename = path.basename(resolved);
            if (!/^[a-zA-Z0-9_-]+\.(tmp|temp)$/.test(basename)) {
                logger.warn(`Suspicious temp file name: ${basename}`);
            }
        }
        
        return resolved;
    } catch (error) {
        throw new Error(`File path validation failed: ${error.message}`);
    }
}

function validatePromptContent(content) {
    if (!content || typeof content !== 'string') {
        return false;
    }
    
    if (content.length > FILE_SIZE_LIMITS.PROMPT_CONTENT_MAX) {
        logger.warn(`Prompt content exceeds size limit: ${content.length} characters`);
        return false;
    }
    
    return true;
}

class ClaudeLoopEngine {
    constructor(options = {}) {
        this.repoPath = options.repoPath ? path.resolve(options.repoPath) : process.cwd();
        
        const providedIterations = options.maxIterations;
        if (providedIterations !== undefined && (typeof providedIterations !== 'number' || providedIterations < 1 || !Number.isInteger(providedIterations))) {
            logger.warn(`Invalid maxIterations: ${providedIterations}, using default: ${CLAUDE_LOOP.MAX_ITERATIONS}`);
            this.maxIterations = CLAUDE_LOOP.MAX_ITERATIONS;
        } else {
            this.maxIterations = providedIterations || CLAUDE_LOOP.MAX_ITERATIONS;
        }
        
        this.claudeCommand = sanitizeCommand(options.claudeCommand || CLAUDE_LOOP.DEFAULT_CLAUDE_COMMAND);
        this.ui = options.ui || false;
        this.iteration = 0;
        this.sessionId = null;
        this.conversationActive = false;
        this.currentPhase = 'Initializing';
        this.mcpInstaller = new MCPInstaller();
        this.startTime = Date.now();
        this.webUI = null;
        this.tempFiles = new Set();
        this.signalHandlersSetup = false;
        this.progressInterval = null; // For real-time progress updates
        
        this.setupSignalHandlers();
        
        this.allowedTools = [
            'Bash', 'Read', 'Write', 'Edit', 'MultiEdit', 
            'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch',
            'NotebookRead', 'NotebookEdit', 'Task'
        ];
    }

    setupSignalHandlers() {
        if (this.signalHandlersSetup) {
            return;
        }
        
        const currentIntListeners = process.listenerCount('SIGINT');
        if (currentIntListeners >= 10) {
            logger.warn('Too many SIGINT listeners, skipping signal handler setup');
            return;
        }
        
        this.cleanup = this.cleanup.bind(this);
        const cleanup = async () => {
            logger.warn('Cleaning up resources...');
            await this.cleanup();
            process.exit(0);
        };
        
        this.cleanupHandler = cleanup;
        
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('SIGQUIT', cleanup);
        
        this.signalHandlersSetup = true;
    }

    sanitizePromptContent(content) {
        if (!content || typeof content !== 'string') {
            throw new Error('Invalid prompt content');
        }
        
        if (content.length > FILE_SIZE_LIMITS.PROMPT_CONTENT_MAX) {
            throw new Error(`Prompt content too large: ${content.length} characters`);
        }
        
        return content;
    }

    // NEW: Real-time progress display
    startProgressDisplay() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }
        
        this.progressInterval = setInterval(() => {
            const elapsed = this.formatElapsedTime(this.startTime);
            const progressBar = this.generateProgressBar(this.iteration, this.maxIterations);
            const progressPercent = Math.round((this.iteration / this.maxIterations) * 100);
            
            // Clear current line and show progress
            process.stdout.write('\r\x1b[K'); // Clear line
            process.stdout.write(chalk.cyan(`🔄 Iteration ${this.iteration}/${this.maxIterations} | Progress: ${progressBar} ${progressPercent}% | Elapsed: ${elapsed}`));
            
            if (this.webUI) {
                this.webUI.updateSession({
                    iterations: this.iteration,
                    currentPhase: `Iteration ${this.iteration} - ${this.getIterationFocus(this.iteration)}`,
                    progress: progressPercent,
                    elapsed: elapsed
                });
            }
        }, 1000); // Update every second
    }

    stopProgressDisplay() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
            process.stdout.write('\n'); // New line after progress
        }
    }

    // NEW: Non-blocking Claude execution with real-time output
    async executeClaudeNonBlocking(args, prompt, timeoutMs = 1800000) {
        return new Promise((resolve, reject) => {
            logger.info(chalk.blue('\n📡 Starting Claude session (non-blocking)...'));
            logger.info(chalk.gray(`Command: ${this.claudeCommand} ${args.join(' ')}`));
            
            const childProcess = spawn(this.claudeCommand, args, {
                cwd: this.repoPath,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: process.env
            });

            let outputBuffer = '';
            let hasOutput = false;

            // Real-time output streaming
            childProcess.stdout.on('data', (data) => {
                const chunk = data.toString();
                outputBuffer += chunk;
                hasOutput = true;
                
                // Show output immediately (non-blocking)
                process.stdout.write(chunk);
                
                if (this.webUI) {
                    this.webUI.addOutput(chunk, 'info');
                }
            });

            childProcess.stderr.on('data', (data) => {
                const errorText = data.toString();
                outputBuffer += errorText;
                hasOutput = true;
                
                // Show errors immediately
                process.stderr.write(chalk.red(errorText));
                
                if (this.webUI) {
                    this.webUI.addOutput(errorText, 'error');
                }
            });

            // Set up timeout
            const timeout = setTimeout(() => {
                logger.info(chalk.yellow('\n⏰ Claude process timeout, terminating...'));
                childProcess.kill('SIGTERM');
                
                setTimeout(() => {
                    if (!childProcess.killed) {
                        childProcess.kill('SIGKILL');
                    }
                }, 5000);
                
                reject(new Error(`Claude process timeout after ${timeoutMs/1000} seconds`));
            }, timeoutMs);

            childProcess.on('close', (code) => {
                clearTimeout(timeout);
                
                if (code === 0 || code === null) {
                    resolve({ output: outputBuffer, hasOutput });
                } else {
                    reject(new Error(`Claude process exited with code ${code}`));
                }
            });

            childProcess.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });

            // Send prompt after small delay
            setTimeout(() => {
                if (prompt) {
                    childProcess.stdin.write(prompt);
                }
                childProcess.stdin.end();
            }, 100);
        });
    }

    async run() {
        try {
            logger.info(chalk.cyan(`
   _____ _                 _        _                       
  / ____| |               | |      | |                      
 | |    | | __ _ _   _  __| | ___  | |     ___   ___  _ __  
 | |    | |/ _\` | | | |/ _\` |/ _ \\ | |    / _ \\ / _ \\| '_ \\ 
 | |____| | (_| | |_| | (_| |  __/ | |___| (_) | (_) | |_) |
  \\_____|_|\\__,_|\\__,_|\\__,_|\\___| |______\\___/ \\___/| .__/ 
                                                      | |    
                                                      |_|    
            `));
            logger.info(chalk.gray('  🔄 Real Iterative AI-powered debugging\n'));

            // Start WebUI if requested
            if (this.ui) {
                this.webUI = new WebUI();
                await this.webUI.start();
                logger.info(chalk.green(`🌐 Web UI started at http://localhost:${this.webUI.port}`));
                
                this.webUI.updateSession({
                    repoPath: this.repoPath,
                    maxIterations: this.maxIterations,
                    iterations: 0,
                    currentPhase: 'Initializing...',
                    isRunning: true,
                    startTime: new Date().toISOString()
                });
            }

            // Check MCP installations
            logger.info(chalk.blue('🔧 Checking MCP installations...'));
            if (this.webUI) {
                this.webUI.updateSession({ currentPhase: 'Checking MCP installations...' });
                this.webUI.addOutput('🔧 Checking MCP installations...', 'info');
            }

            const mcpStatus = await this.mcpInstaller.checkAndInstall();
            
            Object.entries(mcpStatus).forEach(([name, status]) => {
                const icon = status ? '✓' : '✗';
                const color = status ? chalk.green : chalk.red;
                logger.info(color(`${icon} ${name}`));
                
                if (this.webUI) {
                    this.webUI.addOutput(`${icon} ${name}`, status ? 'success' : 'error');
                }
            });

            // Generate initial comprehensive prompt
            logger.info(chalk.blue('\n📝 Generating comprehensive debugging prompt...'));
            if (this.webUI) {
                this.webUI.updateSession({ currentPhase: 'Generating debugging prompt...' });
                this.webUI.addOutput('📝 Generating comprehensive debugging prompt...', 'info');
            }

            const promptContent = await this.generateInitialPrompt();
            
            if (!validatePromptContent(promptContent)) {
                throw new Error('Prompt content failed security validation');
            }

            // Start real-time progress display
            this.startProgressDisplay();

            // Run initial Claude session with non-blocking execution
            const args = ['--print', '--max-turns', '50', '--dangerously-skip-permissions'];
            
            try {
                const result = await this.executeClaudeNonBlocking(args, promptContent, TIMEOUTS.CLAUDE_PROCESS || 1800000);
                logger.info(chalk.green('\n✅ Initial Claude session completed'));
                
                if (this.webUI) {
                    this.webUI.addOutput('✅ Initial Claude session completed', 'success');
                }
            } catch (error) {
                logger.error(chalk.red(`❌ Initial session error: ${error.message}`));
                if (this.webUI) {
                    this.webUI.addOutput(`❌ Initial session error: ${error.message}`, 'error');
                }
            }

            this.conversationActive = true;
            if (this.webUI) {
                this.webUI.updateSession({ currentPhase: 'Running iterative debugging...' });
            }

            // Continue the conversation iteratively with non-blocking execution
            while (this.iteration < this.maxIterations) {
                this.iteration++;
                
                logger.info(chalk.cyan(`\n🔄 Starting Iteration ${this.iteration}/${this.maxIterations}`));
                logger.info(chalk.gray(`Focus: ${this.getIterationFocus(this.iteration)}`));
                logger.info('━'.repeat(50));
                
                if (this.webUI) {
                    this.webUI.updateSession({
                        iterations: this.iteration,
                        currentPhase: `Iteration ${this.iteration} - ${this.getIterationFocus(this.iteration)}`
                    });
                    this.webUI.addOutput(`\n🔄 Starting Iteration ${this.iteration}/${this.maxIterations}`, 'info');
                    this.webUI.addOutput(`Focus: ${this.getIterationFocus(this.iteration)}`, 'info');
                }
                
                // Small delay to let file changes settle
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Continue with focused prompts using non-blocking execution
                const continueWorking = await this.continueSessionNonBlocking();
                
                if (!continueWorking) {
                    logger.info(chalk.green('\n✅ Claude reports all issues are fixed!'));
                    if (this.webUI) {
                        this.webUI.addOutput('✅ Claude reports all issues are fixed!', 'success');
                        this.webUI.updateSession({ currentPhase: 'Session completed successfully' });
                    }
                    break;
                }
            }

        } catch (error) {
            logger.error(chalk.red('\n❌ Error:'), error.message);
            if (this.webUI) {
                this.webUI.addOutput(`❌ Error: ${error.message}`, 'error');
                this.webUI.updateSession({ 
                    currentPhase: 'Session ended with error',
                    isRunning: false 
                });
            }
        } finally {
            // Stop progress display
            this.stopProgressDisplay();
        }

        await this.generateReport();
        
        // Stop WebUI when done
        if (this.webUI) {
            try {
                this.webUI.updateSession({ 
                    isRunning: false,
                    currentPhase: 'Session completed'
                });
                this.webUI.addOutput('🏁 Claude Loop session completed', 'info');
                
                setTimeout(async () => {
                    await this.webUI.stop();
                }, TIMEOUTS.WEBUI_STOP_DELAY || 5000);
            } catch (error) {
                logger.error(`Error stopping WebUI: ${error.message}`);
            }
        }
    }

    // NEW: Non-blocking continue session
    async continueSessionNonBlocking() {
        const prompts = [
            `Continue checking for more issues. Use the Task tool to create parallel subtasks for complex analysis.

Specifically:
- Click every button and verify it does something
- Check if forms actually submit and save data
- Verify navigation works (no 404s, no broken links)
- Look for UI elements that seem broken or inconsistent
- Find any functionality that doesn't work as expected

Use Task tool to delegate complex checks. Fix the next issue you find. Show me what you're fixing.`,

            `Keep debugging. Focus on:
- Testing user workflows from start to finish
- Finding places where the UI doesn't respond properly
- Checking if data persists when it should
- Looking for hardcoded values that should be dynamic (use AI instead)
- Ensuring consistent behavior across the app

What's broken? Fix it.`,

            `Continue the systematic review:
- Are there any buttons that don't have click handlers?
- Any forms that don't validate or submit?
- Any API calls that fail?
- Any UI components that render incorrectly?
- Any workflows that get stuck?

Find and fix the next issue.`,

            `Look deeper:
- Check error handling - does the app handle failures gracefully?
- Test edge cases - empty states, error states, loading states
- Verify all CRUD operations work (Create, Read, Update, Delete)
- Check responsive behavior on different screen sizes
- Ensure accessibility basics work

Fix whatever you find that's broken.`,

            `Final checks:
- Does every feature actually work when you try to use it?
- Is the user experience consistent throughout?
- Are there any console errors?
- Do all the promised features actually function?
- Is there unnecessary complexity that could be simplified?

Fix any remaining issues.`
        ];

        const promptIndex = Math.min(this.iteration - 1, prompts.length - 1);
        const prompt = prompts[promptIndex];

        logger.info(chalk.yellow('📡 Continuing conversation with Claude (non-blocking)...'));
        
        if (this.webUI) {
            this.webUI.addOutput('📡 Continuing conversation with Claude...', 'info');
        }
        
        try {
            if (!validatePromptContent(prompt)) {
                throw new Error('Continue prompt content failed security validation');
            }
            
            // Use non-blocking execution for continue sessions
            const args = ['--continue', '--print', '--max-turns', '30', '--dangerously-skip-permissions'];
            
            const result = await this.executeClaudeNonBlocking(args, prompt, TIMEOUTS.CLAUDE_CONTINUE_PROCESS || 900000);
            
            // Check if Claude thinks it's done
            const donePatterns = [
                /all issues (have been |are )?fixed/i,
                /no (more |remaining )?issues found/i,
                /everything (is |appears to be )?working/i,
                /all (features|functionality) (are |is )?working/i,
                /completed all fixes/i,
                /no broken functionality/i
            ];
            
            const isDone = donePatterns.some(pattern => pattern.test(result.output));
            
            return !isDone;
        } catch (error) {
            logger.error(chalk.red(`Continue session error: ${error.message}`));
            if (this.webUI) {
                this.webUI.addOutput(`❌ Continue session error: ${error.message}`, 'error');
            }
            return false; // Stop on error
        }
    }

    async generateInitialPrompt() {
        // Generate comprehensive initial prompt
        const prompt = `You are an AI debugging agent with complete autonomy to fix this repository. Your goal is to systematically find and fix ALL broken functionality.

IMPORTANT INSTRUCTIONS:
- Use the Task tool extensively to create parallel debugging agents
- Test EVERY button, form, and interactive element
- Fix issues immediately when you find them
- Use AI-first approaches instead of hardcoded patterns
- Remove placeholder/mock data - make everything production-ready
- Run commands in background using node, pm2, nohup, & (never blocking commands)
- Take screenshots before clicking anything (use VUDA/BrowserMCP)
- Use cloudflare tunnel for remote UI testing: cloudflare tunnel --url http://localhost:PORT

SYSTEMATIC APPROACH:
1. Analyze repository structure (tree, grep, find)
2. Deploy Task agents for parallel debugging
3. Test all UI components and interactions
4. Verify data persistence and API functionality
5. Fix broken features and remove complexity
6. Ensure production readiness

START DEBUGGING NOW. Show me what you find and fix.`;

        return prompt;
    }

    generateProgressBar(current, total) {
        const width = 30;
        const progress = Math.round((current / total) * width);
        const filled = '█'.repeat(progress);
        const empty = '░'.repeat(width - progress);
        return filled + empty;
    }

    getIterationFocus(iteration) {
        const focuses = [
            'Initial analysis and setup',
            'Button functionality and click handlers',
            'Form validation and submission',
            'Navigation and routing',
            'Data persistence and API calls',
            'Error handling and edge cases',
            'UI consistency and responsiveness',
            'Performance and optimization',
            'Security and input validation',
            'Accessibility and user experience',
            'Final cleanup and polish'
        ];
        
        return focuses[Math.min(iteration - 1, focuses.length - 1)] || 'General debugging';
    }

    formatElapsedTime(startTime) {
        const elapsed = Date.now() - startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }

    async generateReport() {
        logger.info(chalk.green('\n📊 Generating final report...'));
        
        const report = {
            sessionId: this.sessionId,
            repoPath: this.repoPath,
            iterations: this.iteration,
            maxIterations: this.maxIterations,
            duration: this.formatElapsedTime(this.startTime),
            timestamp: new Date().toISOString()
        };
        
        logger.info(chalk.cyan('\n🏁 Claude Loop Session Complete'));
        logger.info(chalk.gray(`Repository: ${report.repoPath}`));
        logger.info(chalk.gray(`Iterations: ${report.iterations}/${report.maxIterations}`));
        logger.info(chalk.gray(`Duration: ${report.duration}`));
        
        if (this.webUI) {
            this.webUI.addOutput('📊 Final report generated', 'success');
            this.webUI.addOutput(`Iterations: ${report.iterations}/${report.maxIterations}`, 'info');
            this.webUI.addOutput(`Duration: ${report.duration}`, 'info');
        }
    }

    async cleanup() {
        logger.info('🧹 Cleaning up resources...');
        
        // Stop progress display
        this.stopProgressDisplay();
        
        // Clean up temp files
        for (const tempFile of this.tempFiles) {
            try {
                await fs.unlink(tempFile);
                logger.info(`✓ Cleaned up temp file: ${tempFile}`);
            } catch (error) {
                logger.warn(`Could not clean up temp file ${tempFile}: ${error.message}`);
            }
        }
        this.tempFiles.clear();
        
        // Stop WebUI
        if (this.webUI) {
            try {
                await this.webUI.stop();
                logger.info('✓ WebUI stopped');
            } catch (error) {
                logger.warn(`Error stopping WebUI: ${error.message}`);
            }
        }
        
        logger.info('✅ Cleanup completed');
    }

    async secureCleanupTempFile(filePath) {
        try {
            await fs.unlink(filePath);
            this.tempFiles.delete(filePath);
            return true;
        } catch (error) {
            logger.warn(`Could not clean up temp file ${filePath}: ${error.message}`);
            return false;
        }
    }
}

module.exports = ClaudeLoopEngine;
