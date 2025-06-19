const { spawn, execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');
const MCPInstaller = require('./mcp-installer');

class ClaudeLoopEngine {
    constructor(options = {}) {
        this.repoPath = options.repoPath || process.cwd();
        this.maxIterations = options.maxIterations || 10;
        this.claudeCommand = options.claudeCommand || 'claude';
        this.iteration = 0;
        this.sessionId = null;
        this.conversationActive = false;
        this.currentPhase = '';
        this.mcpInstaller = new MCPInstaller();
        this.startTime = Date.now();
        
        // ALL tools enabled for maximum autonomy
        this.allowedTools = [
            'Bash', 'Read', 'Write', 'Edit', 'MultiEdit', 
            'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch',
            'NotebookRead', 'NotebookEdit', 'Task'
        ];
    }

    async run() {
        console.log(chalk.cyan.bold('\n🔄 Claude Loop - Real Iterative Debugging with Claude CLI\n'));
        
        // Check and install MCPs first
        await this.mcpInstaller.checkAndInstall();
        
        // Check which MCPs are available
        const mcpStatus = await this.mcpInstaller.checkMCPAvailability();
        if (mcpStatus.hasVUDA) {
            console.log(chalk.green('✓ VUDA (Visual UI Debug Agent) available'));
        }
        if (mcpStatus.hasBrowserMCP) {
            console.log(chalk.green('✓ Browser MCP available'));
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
        
        try {
            
            // Start the initial Claude session using correct CLI flags with temp file for prompt
            const allowedToolsStr = this.allowedTools.join(',');
            
            console.log(chalk.gray(`Running with full autonomy...\n`));
            
            // Show progress
            this.showProgress('Initializing Claude session...');
            
            // Write prompt to temp file to avoid shell escaping issues
            const tempPromptFile = path.join(this.repoPath, '.claude-loop-prompt.tmp');
            await fs.writeFile(tempPromptFile, initialPrompt);
            
            const startCmd = `${this.claudeCommand} -p "$(cat ${tempPromptFile})" --max-turns 30 --dangerously-skip-permissions --allowedTools "${allowedToolsStr}"`;
            
            // Run initial command with progress tracking
            console.log(chalk.blue('\n📡 Starting Claude session:'));
            console.log(chalk.gray(`Command: ${this.claudeCommand}`));
            console.log(chalk.gray(`Max turns: 30`));
            console.log(chalk.gray(`Tools: ${this.allowedTools.join(', ')}`));
            console.log(chalk.gray('Mode: Full autonomy (--dangerously-skip-permissions)\n'));
            
            execSync(startCmd, {
                cwd: this.repoPath,
                stdio: 'inherit',
                shell: '/bin/bash',
                env: process.env
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
                console.log('━'.repeat(50));
                
                // Show iteration progress
                const progressBar = this.generateProgressBar(this.iteration, this.maxIterations);
                console.log(`Progress: ${progressBar} ${Math.round((this.iteration / this.maxIterations) * 100)}%`);
                console.log(`Elapsed: ${this.formatElapsedTime(this.startTime)}`);
                console.log('━'.repeat(50) + '\n');
                
                
                // Wait a bit to let file changes settle
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Continue with focused prompts using -c flag
                const continueWorking = await this.continueSession();
                
                if (!continueWorking) {
                    console.log(chalk.green('\n✅ Claude reports all issues are fixed!'));
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

        console.log(chalk.yellow('📡 Continuing conversation with Claude...'));
        console.log(chalk.gray(`Focus: ${this.getIterationFocus(this.iteration)}\n`));
        
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
                env: process.env
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

    async generateReport() {
        console.log(chalk.cyan.bold('\n📊 Claude Loop Session Complete\n'));
        console.log('━'.repeat(50));
        console.log(`Total Iterations: ${this.iteration}`);
        console.log(`Total Time: ${this.formatElapsedTime(this.startTime)}`);
        console.log('━'.repeat(50));
        
        console.log('\nThe conversation with Claude has ended.');
        console.log('Check your repository for all the fixes that were applied.');
        
        const report = {
            session: {
                iterations: this.iteration,
                duration: Date.now() - this.startTime,
                timestamp: new Date().toISOString()
            },
            note: 'Claude has been working autonomously to fix issues. Check git diff to see all changes.'
        };
        
        await fs.writeFile(
            path.join(this.repoPath, 'claude-loop-session.json'),
            JSON.stringify(report, null, 2)
        );
    }

    showProgress(message) {
        console.log(chalk.gray(`→ ${message}`));
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
}

module.exports = ClaudeLoopEngine;