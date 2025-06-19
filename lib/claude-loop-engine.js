const { spawn, execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

class ClaudeLoopEngine {
    constructor(options = {}) {
        this.repoPath = options.repoPath || process.cwd();
        this.maxIterations = options.maxIterations || 10;
        this.claudeCommand = options.claudeCommand || 'claude';
        this.iteration = 0;
        this.sessionId = null;
        this.conversationActive = false;
        this.allowedTools = options.allowedTools || [
            'Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob', 'LS'
        ];
    }

    async run() {
        console.log(chalk.cyan.bold('\n🔄 Claude Loop - Real Iterative Debugging with Claude CLI\n'));
        
        // Your style of prompt
        const initialPrompt = `systematically debug and fix this repository so all functionality works as expected without adding complexity and leveraging existing logic

Update Todos:
  ⎿  ☐ Analyze current application structure and identify all components
     ☐ Test ALL buttons and verify they work (click handlers, navigation)
     ☐ Check all links and routes for broken connections
     ☐ Find UI inconsistencies (content, styling, behavior)
     ☐ Identify unnecessary complexity (hardcoded values that could be dynamic)
     ☐ Test all workflows end-to-end
     ☐ Fix any non-functional features
     ☐ Ensure consistent user experience

Start by exploring the codebase and identifying issues. Fix them one by one. Focus on making things WORK.`;

        console.log(chalk.gray('Starting Claude session with full autonomy...\n'));
        
        try {
            // Start the initial Claude session with proper flags
            const startCmd = `${this.claudeCommand} "${initialPrompt}" --max-turns 20 --allowedTools ${this.allowedTools.map(t => `"${t}"`).join(' ')}`;
            
            console.log(chalk.gray(`Running: ${startCmd}\n`));
            
            // Run initial command
            execSync(startCmd, {
                cwd: this.repoPath,
                stdio: 'inherit'
            });
            
            this.conversationActive = true;
            
            // Continue the conversation iteratively
            while (this.iteration < this.maxIterations) {
                this.iteration++;
                console.log(chalk.bold(`\n🔄 Iteration ${this.iteration}/${this.maxIterations}`));
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
            `Continue checking for more issues. Specifically:
- Click every button and verify it does something
- Check if forms actually submit and save data
- Verify navigation works (no 404s, no broken links)
- Look for UI elements that seem broken or inconsistent
- Find any functionality that doesn't work as expected

Fix the next issue you find. Show me what you're fixing.`,

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
            // Use claude -c to continue the conversation
            const continueCmd = `${this.claudeCommand} -c -p "${prompt}" --max-turns 20`;
            
            const output = execSync(continueCmd, {
                cwd: this.repoPath,
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
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
    }
}

module.exports = ClaudeLoopEngine;