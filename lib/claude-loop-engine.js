const { spawn, execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const http = require('http');
const WebSocket = require('ws');

class ClaudeLoopEngine {
    constructor(options = {}) {
        this.repoPath = options.repoPath || process.cwd();
        this.maxIterations = options.maxIterations || 10;
        this.claudeCommand = options.claudeCommand || 'claude';
        this.iteration = 0;
        this.sessionId = null;
        this.conversationActive = false;
        this.enableUI = options.ui || false;
        this.wsClients = new Set();
        // ALL tools enabled for maximum autonomy
        this.allowedTools = [
            'Bash', 'Read', 'Write', 'Edit', 'MultiEdit', 
            'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch',
            'NotebookRead', 'NotebookEdit', 'Task'
        ];
    }

    async run() {
        console.log(chalk.cyan.bold('\n🔄 Claude Loop - Real Iterative Debugging with Claude CLI\n'));
        
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
        
        try {
            // Start UI server if requested
            if (this.enableUI) {
                await this.startUIServer();
            }
            
            // Start the initial Claude session using correct CLI flags with temp file for prompt
            const allowedToolsStr = this.allowedTools.join(',');
            
            console.log(chalk.gray(`Running with full autonomy...\n`));
            
            // Write prompt to temp file to avoid shell escaping issues
            const tempPromptFile = path.join(this.repoPath, '.claude-loop-prompt.tmp');
            await fs.writeFile(tempPromptFile, initialPrompt);
            
            const startCmd = `${this.claudeCommand} -p "$(cat ${tempPromptFile})" --max-turns 30 --dangerously-skip-permissions --allowedTools "${allowedToolsStr}"`;
            
            // Run initial command
            execSync(startCmd, {
                cwd: this.repoPath,
                stdio: 'inherit',
                shell: '/bin/bash',
                env: { ...process.env, CLAUDE_LOOP_UI: this.enableUI ? 'true' : 'false' }
            });
            
            // Clean up temp file
            try {
                await fs.unlink(tempPromptFile);
            } catch {}
            
            this.conversationActive = true;
            
            // Continue the conversation iteratively
            while (this.iteration < this.maxIterations) {
                this.iteration++;
                console.log(chalk.bold(`\n🔄 Iteration ${this.iteration}/${this.maxIterations}`));
                console.log('━'.repeat(50) + '\n');
                
                // Update UI
                if (this.enableUI) {
                    this.broadcast({ 
                        type: 'iteration', 
                        iteration: this.iteration,
                        maxIterations: this.maxIterations 
                    });
                    this.broadcast({ 
                        type: 'status', 
                        status: `Running iteration ${this.iteration}...` 
                    });
                }
                
                // Wait a bit to let file changes settle
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Continue with focused prompts using -c flag
                const continueWorking = await this.continueSession();
                
                if (!continueWorking) {
                    console.log(chalk.green('\n✅ Claude reports all issues are fixed!'));
                    if (this.enableUI) {
                        this.broadcast({ 
                            type: 'log', 
                            message: 'All issues fixed!', 
                            level: 'success' 
                        });
                    }
                    break;
                }
            }
            
        } catch (error) {
            console.error(chalk.red('\n❌ Error:'), error.message);
        }
        
        await this.generateReport();
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

        console.log(chalk.yellow('Continuing conversation with Claude...\n'));
        
        try {
            // Use claude -c to continue with full permissions using temp file for prompt
            const tempPromptFile = path.join(this.repoPath, '.claude-loop-continue.tmp');
            await fs.writeFile(tempPromptFile, prompt);
            
            const continueCmd = `${this.claudeCommand} -c -p "$(cat ${tempPromptFile})" --max-turns 30 --dangerously-skip-permissions`;
            
            const output = execSync(continueCmd, {
                cwd: this.repoPath,
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: '/bin/bash',
                env: { ...process.env, CLAUDE_LOOP_UI: this.enableUI ? 'true' : 'false' }
            });
            
            // Clean up temp file
            try {
                await fs.unlink(tempPromptFile);
            } catch {}
            
            // Show output
            console.log(chalk.gray(output));
            
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
            }
            console.error(chalk.red('Continuation error:'), error.message);
            return false;
        }
    }


    async startUIServer() {
        const port = 3456;
        
        // Create simple HTTP server for UI
        this.server = http.createServer(async (req, res) => {
            if (req.url === '/') {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(this.getUIHTML());
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });

        // WebSocket server for real-time updates
        this.wss = new WebSocket.Server({ server: this.server });
        
        this.wss.on('connection', (ws) => {
            this.wsClients.add(ws);
            ws.on('close', () => this.wsClients.delete(ws));
            
            // Send initial state
            ws.send(JSON.stringify({
                type: 'init',
                iteration: this.iteration,
                status: 'Starting...'
            }));
        });

        await new Promise(resolve => {
            this.server.listen(port, () => {
                console.log(chalk.green(`\n✨ UI running at: http://localhost:${port}\n`));
                resolve();
            });
        });
    }

    broadcast(data) {
        const message = JSON.stringify(data);
        this.wsClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    getUIHTML() {
        return `<!DOCTYPE html>
<html>
<head>
    <title>Claude Loop Monitor</title>
    <style>
        body {
            font-family: -apple-system, monospace;
            background: #0a0a0a;
            color: #e0e0e0;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            background: linear-gradient(45deg, #00ff88, #00aaff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .status {
            background: #1a1a1a;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #2a2a2a;
        }
        .iteration {
            font-size: 2rem;
            color: #00ff88;
        }
        .log {
            background: #111;
            padding: 20px;
            border-radius: 8px;
            height: 500px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 14px;
            line-height: 1.6;
        }
        .log-entry {
            margin: 5px 0;
            padding: 5px;
        }
        .log-entry.info { color: #00aaff; }
        .log-entry.success { color: #00ff88; }
        .log-entry.error { color: #ff4444; }
        .progress {
            width: 100%;
            height: 20px;
            background: #2a2a2a;
            border-radius: 10px;
            overflow: hidden;
            margin: 20px 0;
        }
        .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #00ff88, #00aaff);
            transition: width 0.5s ease;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Claude Loop Monitor</h1>
        <div class="status">
            <div>Iteration: <span class="iteration" id="iteration">0</span></div>
            <div>Status: <span id="status">Initializing...</span></div>
            <div class="progress">
                <div class="progress-bar" id="progress" style="width: 0%"></div>
            </div>
        </div>
        <div class="log" id="log">
            <div class="log-entry info">Claude Loop UI started...</div>
        </div>
    </div>
    <script>
        const ws = new WebSocket('ws://localhost:3456');
        const log = document.getElementById('log');
        const iteration = document.getElementById('iteration');
        const status = document.getElementById('status');
        const progress = document.getElementById('progress');
        
        function addLog(message, type = 'info') {
            const entry = document.createElement('div');
            entry.className = 'log-entry ' + type;
            entry.textContent = new Date().toLocaleTimeString() + ' - ' + message;
            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
        }
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch(data.type) {
                case 'init':
                    iteration.textContent = data.iteration;
                    status.textContent = data.status;
                    break;
                case 'iteration':
                    iteration.textContent = data.iteration;
                    progress.style.width = (data.iteration / 10 * 100) + '%';
                    addLog('Starting iteration ' + data.iteration, 'info');
                    break;
                case 'log':
                    addLog(data.message, data.level || 'info');
                    break;
                case 'status':
                    status.textContent = data.status;
                    break;
            }
        };
        
        ws.onclose = () => {
            addLog('Connection closed', 'error');
            status.textContent = 'Disconnected';
        };
    </script>
</body>
</html>`;
    }

    async generateReport() {
        console.log(chalk.cyan.bold('\n📊 Claude Loop Session Complete\n'));
        console.log('━'.repeat(50));
        
        console.log(chalk.bold(`Total Iterations: ${this.iteration}`));
        console.log('\nThe conversation with Claude has ended.');
        console.log('Check your repository for all the fixes that were applied.');
        
        // Save summary
        const report = {
            session: {
                start: new Date().toISOString(),
                iterations: this.iteration,
                repository: this.repoPath
            },
            note: 'Claude has been working autonomously to fix issues. Check git diff to see all changes.'
        };
        
        await fs.writeFile(
            path.join(this.repoPath, 'claude-loop-session.json'),
            JSON.stringify(report, null, 2)
        );
        
        // Close UI server if running
        if (this.server) {
            this.broadcast({ type: 'status', status: 'Session complete!' });
            setTimeout(() => {
                this.server.close();
                this.wss.close();
            }, 5000);
        }
    }
}

module.exports = ClaudeLoopEngine;