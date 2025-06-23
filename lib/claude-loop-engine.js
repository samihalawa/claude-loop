const { spawn, execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');
const MCPInstaller = require('./mcp-installer');
const WebUI = require('./web-ui');

// Security utilities
function sanitizeCommand(command) {
    // Only allow known safe claude commands
    const allowedCommands = ['claude', '/usr/local/bin/claude', 'npx claude'];
    return allowedCommands.includes(command) ? command : 'claude';
}

function createSecureTempFile(baseDir, prefix) {
    const crypto = require('crypto');
    const random = crypto.randomBytes(16).toString('hex');
    return path.join(baseDir, `${prefix}-${random}.tmp`);
}

class ClaudeLoopEngine {
    constructor(options = {}) {
        this.repoPath = options.repoPath ? path.resolve(options.repoPath) : process.cwd();
        this.maxIterations = options.maxIterations || parseInt(process.env.CLAUDE_LOOP_MAX_ITERATIONS) || 10;
        this.claudeCommand = sanitizeCommand(options.claudeCommand || 'claude');
        this.ui = options.ui || false;
        this.iteration = 0;
        this.sessionId = null;
        this.conversationActive = false;
        this.currentPhase = 'Initializing';
        this.mcpInstaller = new MCPInstaller();
        this.startTime = Date.now();
        this.webUI = null;
        this.tempFiles = new Set(); // Track temp files for cleanup
        
        // Setup signal handlers for proper cleanup
        this.setupSignalHandlers();
        
        // ALL tools enabled for maximum autonomy
        this.allowedTools = [
            'Bash', 'Read', 'Write', 'Edit', 'MultiEdit', 
            'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch',
            'NotebookRead', 'NotebookEdit', 'Task'
        ];
    }

    setupSignalHandlers() {
        const cleanup = async () => {
            console.log(chalk.yellow('\n🧹 Cleaning up resources...'));
            await this.cleanup();
            process.exit(0);
        };
        
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('SIGQUIT', cleanup);
    }

    async cleanup() {
        // Clean up temp files
        for (const tempFile of this.tempFiles) {
            try {
                await fs.unlink(tempFile);
                console.log(chalk.gray(`✓ Cleaned up temp file: ${tempFile}`));
            } catch (error) {
                console.log(chalk.gray(`Note: Could not clean up temp file ${tempFile}: ${error.message}`));
            }
        }
        this.tempFiles.clear();
        
        // Stop WebUI
        if (this.webUI) {
            try {
                await this.webUI.stop();
            } catch (error) {
                console.error(chalk.red('Error stopping WebUI:'), error.message);
            }
        }
    }

    async run() {
        console.log(chalk.cyan.bold('\n🔄 Claude Loop - Real Iterative Debugging with Claude CLI\n'));
        
        // Start UI if requested
        if (this.ui) {
            try {
                this.webUI = new WebUI();
                await this.webUI.start();
                this.webUI.updateSession({
                    isRunning: true,
                    currentPhase: 'Initializing...',
                    iterations: 0,
                    startTime: this.startTime,
                    maxIterations: this.maxIterations,
                    repoPath: this.repoPath
                });
                this.webUI.addOutput('Claude Loop Engine starting...', 'info');
                console.log(chalk.green('✓ Web UI started successfully'));
            } catch (error) {
                console.error(chalk.red(`Failed to start Web UI: ${error.message}`));
                this.webUI = null;
            }
        }
        
        // Validate repository path and ensure it's absolute
        console.log(chalk.gray(`Working in repository: ${this.repoPath}`));
        console.log(chalk.gray(`Repository path is absolute: ${path.isAbsolute(this.repoPath)}`));
        console.log(chalk.gray(`Current working directory: ${process.cwd()}`));
        
        if (this.webUI) {
            this.webUI.addOutput(`Working in repository: ${this.repoPath}`, 'info');
        }
        
        try {
            await fs.access(this.repoPath);
            console.log(chalk.gray(`✓ Repository path validated: ${this.repoPath}`));
            if (this.webUI) {
                this.webUI.addOutput('✓ Repository path validated', 'success');
            }
        } catch (error) {
            console.error(chalk.red(`Repository path does not exist or is not accessible: ${this.repoPath}`));
            if (this.webUI) {
                this.webUI.addOutput(`❌ Repository path validation failed: ${error.message}`, 'error');
            }
            throw new Error(`Invalid repository path: ${this.repoPath}`);
        }
        
        // Check and install MCPs first
        if (this.webUI) {
            this.webUI.updateSession({ currentPhase: 'Installing MCPs...' });
            this.webUI.addOutput('Checking and installing MCP servers...', 'info');
        }
        await this.mcpInstaller.checkAndInstall();
        
        // Check which MCPs are available
        const mcpStatus = await this.mcpInstaller.checkMCPAvailability();
        if (mcpStatus.hasVUDA) {
            console.log(chalk.green('✓ VUDA (Visual UI Debug Agent) available'));
            if (this.webUI) {
                this.webUI.addOutput('✓ VUDA (Visual UI Debug Agent) available', 'success');
            }
        }
        if (mcpStatus.hasBrowserMCP) {
            console.log(chalk.green('✓ Browser MCP available'));
            if (this.webUI) {
                this.webUI.addOutput('✓ Browser MCP available', 'success');
            }
        }
        
        const initialPrompt = `**INFINITE REPOSITORY DEBUGGING LOOP**

You are about to embark on a sophisticated iterative debugging process. Think deeply about this infinite debugging task.

**PHASE 1: REPOSITORY RECONNAISSANCE**
Thoroughly analyze this repository to understand the current state:
- Get complete project structure (tree -I 'node_modules|.git|dist|build')
- Identify all endpoints and routes (grep -r "app\\.get\\|app\\.post\\|router\\.")
- Map all functions and classes (grep -r "function\\|const.*=.*=>\\|class")
- Find configuration files (find . -name "*.json" -not -path "*/node_modules/*")
- List all entry points and main files

**PHASE 2: ISSUE DISCOVERY STRATEGY**
Deploy multiple Task agents to analyze different aspects in parallel:

**Task Agent Distribution:**
- **Agent 1**: UI/UX Testing - Click every button, test every form, verify all navigation
- **Agent 2**: Backend Testing - Test all API endpoints, verify data persistence, check error handling  
- **Agent 3**: Integration Testing - Test full workflows end-to-end, verify all features work
- **Agent 4**: Code Quality - Find hardcoded values, unnecessary complexity, broken patterns
- **Agent 5**: Performance & Security - Check for bottlenecks, vulnerabilities, optimization opportunities

**PHASE 3: PARALLEL DEBUGGING EXECUTION**
Launch Task agents using this specification:

\`\`\`
TASK: Debug [AREA] in this repository

You are Debugging Agent [X] focusing on [AREA].

REQUIREMENTS:
1. Systematically test every aspect of [AREA]
2. Document all issues found with specific examples
3. Fix critical issues immediately
4. Report back with status and remaining issues
5. Use appropriate tools (Read, Edit, Bash, Grep, etc.)

FOCUS: [Specific area like "UI interactions", "API endpoints", "data flow", etc.]

DELIVERABLE: Working code with all [AREA] issues resolved
\`\`\`

**PHASE 4: ITERATIVE REFINEMENT**
After each wave of fixes:
- Re-test all areas to ensure no regressions
- Launch new Task agents for deeper analysis
- Focus on remaining edge cases and complex issues
- Ensure consistent user experience throughout

**EXECUTION START:**
Begin immediately by:
1. Analyzing the repository structure completely
2. Creating parallel Task agents for comprehensive debugging
3. Fixing issues systematically as they're discovered

Use the Task tool aggressively. Create multiple parallel debugging agents. Fix every broken button, every non-working feature, every UI inconsistency. Make this repository work perfectly.`;
        

        console.log(chalk.gray('Starting Claude session with full autonomy...\n'));
        
        if (this.webUI) {
            this.webUI.updateSession({ currentPhase: 'Starting Claude CLI session...' });
            this.webUI.addOutput('Starting Claude session with full autonomy...', 'info');
        }
        
        try {
            
            // Start the initial Claude session using correct CLI flags with temp file for prompt
            const allowedToolsStr = this.allowedTools.join(',');
            
            console.log(chalk.gray(`Running with full autonomy...\n`));
            
            // Show progress
            this.showProgress('Initializing Claude session...');
            if (this.webUI) {
                this.webUI.addOutput('Initializing Claude session...', 'info');
            }
            
            // Write prompt to temp file to avoid shell escaping issues
            const tempPromptFile = createSecureTempFile(this.repoPath, 'claude-loop-prompt');
            this.tempFiles.add(tempPromptFile); // Track for cleanup
            console.log(chalk.gray(`Creating temp file: ${tempPromptFile}`));
            console.log(chalk.gray(`Repository path: ${this.repoPath}`));
            console.log(chalk.gray(`Temp file is absolute: ${path.isAbsolute(tempPromptFile)}`));
            
            if (this.webUI) {
                this.webUI.addOutput(`Creating temp file: ${tempPromptFile}`, 'info');
            }
            
            try {
                // Create temp file with secure permissions
                await fs.writeFile(tempPromptFile, initialPrompt, { mode: 0o600 });
                console.log(chalk.gray(`Successfully created temp file at: ${tempPromptFile}`));
                if (this.webUI) {
                    this.webUI.addOutput('✓ Temp file created successfully', 'success');
                }
                
                // Verify file was created
                await fs.access(tempPromptFile);
                console.log(chalk.gray(`✓ Temp file exists and is accessible`));
            } catch (error) {
                console.error(chalk.red(`Failed to create temp file: ${error.message}`));
                console.error(chalk.red(`Attempted path: ${tempPromptFile}`));
                if (this.webUI) {
                    this.webUI.addOutput(`❌ Failed to create temp file: ${error.message}`, 'error');
                }
                this.tempFiles.delete(tempPromptFile); // Remove from tracking if failed
                throw error;
            }
            
            // Use array-based arguments to prevent injection
            const promptContent = await fs.readFile(tempPromptFile, 'utf8');
            
            // Run initial command with progress tracking
            console.log(chalk.blue('\n📡 Starting Claude session:'));
            console.log(chalk.gray(`Command: ${this.claudeCommand}`));
            console.log(chalk.gray(`Max turns: 30`));
            console.log(chalk.gray(`Mode: Full autonomy (--dangerously-skip-permissions)\n`));
            
            if (this.webUI) {
                this.webUI.updateSession({ currentPhase: 'Running initial Claude session...' });
                this.webUI.addOutput('📡 Starting Claude CLI session', 'info');
                this.webUI.addOutput(`Command: ${this.claudeCommand}`, 'info');
                this.webUI.addOutput('Max turns: 30', 'info');
                this.webUI.addOutput('Mode: Full autonomy', 'info');
            }
            
            // Use spawn instead of execSync for better security and non-blocking execution
            const args = ['-p', promptContent, '--max-turns', '30', '--dangerously-skip-permissions'];
            const childProcess = spawn(this.claudeCommand, args, {
                cwd: this.repoPath,
                stdio: 'inherit',
                env: process.env
            });
            
            // Wait for process to complete
            await new Promise((resolve, reject) => {
                childProcess.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Claude process exited with code ${code}`));
                    }
                });
                childProcess.on('error', reject);
            });
            
            // Clean up temp file
            try {
                await fs.unlink(tempPromptFile);
                this.tempFiles.delete(tempPromptFile);
                console.log(chalk.gray(`✓ Cleaned up temp file: ${tempPromptFile}`));
                if (this.webUI) {
                    this.webUI.addOutput('✓ Cleaned up temp file', 'success');
                }
            } catch (error) {
                console.log(chalk.gray(`Note: Could not clean up temp file ${tempPromptFile}: ${error.message}`));
                if (this.webUI) {
                    this.webUI.addOutput(`Note: Could not clean up temp file: ${error.message}`, 'warning');
                }
            }
            
            this.conversationActive = true;
            if (this.webUI) {
                this.webUI.updateSession({ currentPhase: 'Running iterative debugging...' });
            }
            
            // Continue the conversation iteratively
            while (this.iteration < this.maxIterations) {
                this.iteration++;
                console.log(chalk.bold(`\n🔄 Iteration ${this.iteration}/${this.maxIterations}`));
                console.log('━'.repeat(50));
                
                // Update WebUI with current iteration
                if (this.webUI) {
                    this.webUI.updateSession({
                        iterations: this.iteration,
                        currentPhase: `Iteration ${this.iteration} - ${this.getIterationFocus(this.iteration)}`
                    });
                    this.webUI.addOutput(`\n🔄 Starting Iteration ${this.iteration}/${this.maxIterations}`, 'info');
                }
                
                // Show iteration progress
                const progressBar = this.generateProgressBar(this.iteration, this.maxIterations);
                console.log(`Progress: ${progressBar} ${Math.round((this.iteration / this.maxIterations) * 100)}%`);
                console.log(`Elapsed: ${this.formatElapsedTime(this.startTime)}`);
                console.log('━'.repeat(50) + '\n');
                
                if (this.webUI) {
                    const progressPercent = Math.round((this.iteration / this.maxIterations) * 100);
                    const elapsed = this.formatElapsedTime(this.startTime);
                    this.webUI.addOutput(`Progress: ${progressPercent}% | Elapsed: ${elapsed}`, 'info');
                }
                
                
                // Wait a bit to let file changes settle
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Continue with focused prompts using -c flag
                const continueWorking = await this.continueSession();
                
                if (!continueWorking) {
                    console.log(chalk.green('\n✅ Claude reports all issues are fixed!'));
                    if (this.webUI) {
                        this.webUI.addOutput('✅ Claude reports all issues are fixed!', 'success');
                        this.webUI.updateSession({ currentPhase: 'Session completed successfully' });
                    }
                    break;
                }
            }
            
        } catch (error) {
            console.error(chalk.red('\n❌ Error:'), error.message);
            if (this.webUI) {
                this.webUI.addOutput(`❌ Error: ${error.message}`, 'error');
                this.webUI.updateSession({ 
                    currentPhase: 'Session ended with error',
                    isRunning: false 
                });
            }
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
                // Keep WebUI running for a bit so user can see final state
                setTimeout(async () => {
                    await this.webUI.stop();
                }, 10000); // Stop after 10 seconds
            } catch (error) {
                console.error(chalk.red('Error stopping WebUI:'), error.message);
            }
        }
    }

    async continueSession() {
        // Continuation prompts that focus on your specific concerns
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

        console.log(chalk.yellow('📡 Continuing conversation with Claude...'));
        console.log(chalk.gray(`Focus: ${this.getIterationFocus(this.iteration)}\n`));
        
        if (this.webUI) {
            this.webUI.addOutput('📡 Continuing conversation with Claude...', 'info');
            this.webUI.addOutput(`Focus: ${this.getIterationFocus(this.iteration)}`, 'info');
        }
        
        try {
            // Use claude -c to continue with full permissions using temp file for prompt
            const tempPromptFile = createSecureTempFile(this.repoPath, 'claude-loop-continue');
            this.tempFiles.add(tempPromptFile); // Track for cleanup
            console.log(chalk.gray(`Creating continue temp file: ${tempPromptFile}`));
            console.log(chalk.gray(`Continue temp file is absolute: ${path.isAbsolute(tempPromptFile)}`));
            
            try {
                await fs.writeFile(tempPromptFile, prompt, { mode: 0o600 });
                console.log(chalk.gray(`Successfully created continue temp file at: ${tempPromptFile}`));
                if (this.webUI) {
                    this.webUI.addOutput('✓ Continue temp file created', 'success');
                }
                
                // Verify file was created
                await fs.access(tempPromptFile);
                console.log(chalk.gray(`✓ Continue temp file exists and is accessible`));
            } catch (error) {
                console.error(chalk.red(`Failed to create continue temp file: ${error.message}`));
                console.error(chalk.red(`Attempted path: ${tempPromptFile}`));
                if (this.webUI) {
                    this.webUI.addOutput(`❌ Failed to create continue temp file: ${error.message}`, 'error');
                }
                this.tempFiles.delete(tempPromptFile); // Remove from tracking if failed
                throw error;
            }
            
            // Use spawn for secure execution
            const args = ['-c', '-p', prompt, '--max-turns', '30', '--dangerously-skip-permissions'];
            const childProcess = spawn(this.claudeCommand, args, {
                cwd: this.repoPath,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: process.env
            });
            
            let output = '';
            childProcess.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            childProcess.stderr.on('data', (data) => {
                output += data.toString();
            });
            
            await new Promise((resolve, reject) => {
                childProcess.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`Claude process exited with code ${code}`));
                    }
                });
                childProcess.on('error', reject);
            });
            
            // Clean up temp file
            try {
                await fs.unlink(tempPromptFile);
                this.tempFiles.delete(tempPromptFile);
                console.log(chalk.gray(`✓ Cleaned up continue temp file: ${tempPromptFile}`));
                if (this.webUI) {
                    this.webUI.addOutput('✓ Cleaned up continue temp file', 'success');
                }
            } catch (error) {
                console.log(chalk.gray(`Note: Could not clean up temp file ${tempPromptFile}: ${error.message}`));
                if (this.webUI) {
                    this.webUI.addOutput(`Note: Could not clean up temp file: ${error.message}`, 'warning');
                }
            }
            
            // Show output
            console.log(chalk.gray(output));
            
            // Stream output to WebUI
            if (this.webUI && output) {
                // Split output into lines and stream each line
                const lines = output.split('\n');
                lines.forEach(line => {
                    if (line.trim()) {
                        // Determine output type based on content
                        let outputType = 'info';
                        if (line.includes('Error') || line.includes('❌') || line.includes('failed')) {
                            outputType = 'error';
                        } else if (line.includes('✓') || line.includes('success') || line.includes('completed')) {
                            outputType = 'success';
                        } else if (line.includes('warning') || line.includes('⚠')) {
                            outputType = 'warning';
                        }
                        this.webUI.addOutput(line, outputType);
                    }
                });
            }
            
            // Check if Claude thinks it's done
            const donePatterns = [
                /all issues (have been |are )?fixed/i,
                /no (more |remaining )?issues found/i,
                /everything (is |appears to be )?working/i,
                /all (features|functionality) (are |is )?working/i,
                /completed all fixes/i,
                /no broken functionality/i
            ];
            
            const isDone = donePatterns.some(pattern => pattern.test(output));
            
            return !isDone;
        } catch (error) {
            // If error contains output, show it
            if (error.stdout) {
                console.log(chalk.gray(error.stdout));
                if (this.webUI) {
                    this.webUI.addOutput(error.stdout, 'error');
                }
            }
            console.error(chalk.red('Continuation error:'), error.message);
            if (this.webUI) {
                this.webUI.addOutput(`Continuation error: ${error.message}`, 'error');
            }
            return false;
        }
    }

    async generateReport() {
        console.log(chalk.cyan.bold('\n📊 Claude Loop Session Complete\n'));
        console.log('━'.repeat(50));
        console.log(`Total Iterations: ${this.iteration}`);
        console.log(`Total Time: ${this.formatElapsedTime(this.startTime)}`);
        console.log('━'.repeat(50));
        
        console.log('\nThe conversation with Claude has ended.');
        console.log('Check your repository for all the fixes that were applied.');
        
        if (this.webUI) {
            this.webUI.addOutput('\n📊 Claude Loop Session Complete', 'info');
            this.webUI.addOutput(`Total Iterations: ${this.iteration}`, 'info');
            this.webUI.addOutput(`Total Time: ${this.formatElapsedTime(this.startTime)}`, 'info');
            this.webUI.addOutput('The conversation with Claude has ended.', 'info');
            this.webUI.addOutput('Check your repository for all the fixes that were applied.', 'info');
        }
        
        const report = {
            session: {
                iterations: this.iteration,
                duration: Date.now() - this.startTime,
                timestamp: new Date().toISOString()
            },
            note: 'Claude has been working autonomously to fix issues. Check git diff to see all changes.'
        };
        
        const sessionFile = path.resolve(path.join(this.repoPath, 'claude-loop-session.json'));
        console.log(chalk.gray(`Creating session file: ${sessionFile}`));
        console.log(chalk.gray(`Session file is absolute: ${path.isAbsolute(sessionFile)}`));
        
        try {
            await fs.writeFile(
                sessionFile,
                JSON.stringify(report, null, 2)
            );
            console.log(chalk.gray(`✓ Successfully created session file at: ${sessionFile}`));
            if (this.webUI) {
                this.webUI.addOutput(`✓ Session report saved to: ${sessionFile}`, 'success');
            }
        } catch (error) {
            console.error(chalk.red(`Failed to create session file: ${error.message}`));
            console.error(chalk.red(`Attempted path: ${sessionFile}`));
            if (this.webUI) {
                this.webUI.addOutput(`❌ Failed to create session file: ${error.message}`, 'error');
            }
            throw error;
        }
    }

    showProgress(message) {
        console.log(chalk.gray(`→ ${message}`));
        if (this.webUI) {
            this.webUI.addOutput(`→ ${message}`, 'info');
        }
    }

    generateProgressBar(current, total, width = 30) {
        const percentage = current / total;
        const filled = Math.round(width * percentage);
        const empty = width - filled;
        return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    }

    formatElapsedTime(startTime) {
        const elapsed = Date.now() - startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }

    getIterationFocus(iteration) {
        const focuses = [
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
        return focuses[Math.min(iteration - 1, focuses.length - 1)];
    }

    async startUI() {
        try {
            console.log(chalk.cyan('🌐 Starting web UI...'));
            
            // Simple HTTP server for monitoring
            const http = require('http');
            const port = 3333;
            
            const server = http.createServer((req, res) => {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Claude Loop - Debug Monitor</title>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1">
                        <style>
                            body { font-family: system-ui, -apple-system, sans-serif; margin: 0; background: #1a1a1a; color: #fff; }
                            .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
                            .header { text-align: center; margin-bottom: 30px; }
                            .status { background: #2a2a2a; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
                            .progress { width: 100%; height: 20px; background: #333; border-radius: 10px; overflow: hidden; }
                            .progress-bar { height: 100%; background: linear-gradient(90deg, #00d4aa, #00b894); transition: width 0.3s; }
                            .metric { display: inline-block; margin: 10px 20px; text-align: center; }
                            .metric-value { font-size: 2em; font-weight: bold; color: #00d4aa; }
                            .metric-label { font-size: 0.9em; color: #888; }
                            .live { color: #00d4aa; animation: pulse 2s infinite; }
                            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                        </style>
                        <script>
                            let iteration = 0;
                            let maxIterations = ${this.maxIterations};
                            
                            function updateProgress() {
                                const progress = Math.min((iteration / maxIterations) * 100, 100);
                                document.getElementById('progress-bar').style.width = progress + '%';
                                document.getElementById('iteration').textContent = iteration;
                                document.getElementById('max-iterations').textContent = maxIterations;
                            }
                            
                            function simulateProgress() {
                                setInterval(() => {
                                    if (iteration < maxIterations) {
                                        iteration += 0.1;
                                        updateProgress();
                                    }
                                }, 5000);
                            }
                            
                            window.onload = () => {
                                updateProgress();
                                simulateProgress();
                            };
                        </script>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>🔄 Claude Loop Debug Monitor</h1>
                                <p>Real-time iterative debugging with Claude CLI</p>
                                <p class="live">● LIVE</p>
                            </div>
                            
                            <div class="status">
                                <h3>Debug Progress</h3>
                                <div class="progress">
                                    <div id="progress-bar" class="progress-bar" style="width: 0%"></div>
                                </div>
                                <br>
                                
                                <div class="metric">
                                    <div id="iteration" class="metric-value">0</div>
                                    <div class="metric-label">Current Iteration</div>
                                </div>
                                
                                <div class="metric">
                                    <div id="max-iterations" class="metric-value">${this.maxIterations}</div>
                                    <div class="metric-label">Max Iterations</div>
                                </div>
                                
                                <div class="metric">
                                    <div class="metric-value">${path.basename(this.repoPath)}</div>
                                    <div class="metric-label">Repository</div>
                                </div>
                            </div>
                            
                            <div class="status">
                                <h3>Repository Path</h3>
                                <code style="color: #00d4aa;">${this.repoPath}</code>
                            </div>
                            
                            <div class="status">
                                <h3>Claude CLI Status</h3>
                                <p>Command: <code>${this.claudeCommand}</code></p>
                                <p>Max turns per iteration: <strong>30</strong></p>
                            </div>
                        </div>
                    </body>
                    </html>
                `);
            });
            
            server.listen(port, () => {
                console.log(chalk.green(`✓ Web UI running at http://localhost:${port}`));
                console.log(chalk.gray('  Open this URL in your browser to monitor progress\n'));
            });
            
            this.uiServer = server;
            
        } catch (error) {
            console.log(chalk.yellow(`⚠ Could not start UI: ${error.message}`));
        }
    }
}

module.exports = ClaudeLoopEngine;