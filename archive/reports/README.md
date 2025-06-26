# claude-loop

Pure Claude CLI autonomy - iteratively fixes your repo until everything works. No hardcoded patterns, just raw AI power.

## What It Does

claude-loop gives Claude complete freedom to:
- 🔄 **Iteratively debug** your entire repository
- 🧪 **Test every button**, form, and feature
- 🔧 **Fix broken functionality** automatically
- 🚀 **Deploy Task agents** for parallel debugging
- ✨ **Simplify complexity** by leveraging AI instead of hardcoded patterns

## Installation

```bash
npm install -g claude-loop
```

## Usage

```bash
# Just run it - auto-installs MCPs and starts debugging
claude-loop

# Or use the loop command with options
claude-loop loop --max-iterations 20
```

## Features

### 🔌 Auto-installs MCPs
On first run, automatically detects and installs:
- **VUDA** - Visual UI Debug Agent for testing UI
- **BrowserMCP** - Browser automation capabilities
- **Sequential Thinking** - Step-by-step problem solving

### 📊 Enhanced Progress Tracking
```
🔄 Iteration 3/10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Progress: ████████████░░░░░░░░░░░░░░░░░░ 30%
Elapsed: 2m 15s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📡 Continuing conversation with Claude...
Focus: Form validation and submission
```

### 🤖 Full Claude Autonomy
- Uses `--dangerously-skip-permissions` for complete freedom
- All tools enabled: Bash, Read, Write, Edit, Task, etc.
- Creates parallel Task agents for complex debugging

### 🎯 Smart Focus Areas
Each iteration focuses on specific aspects:
1. Button functionality and click handlers
2. Form validation and submission  
3. Navigation and routing
4. Data persistence and API calls
5. Error handling and edge cases
6. UI consistency and responsiveness
7. Performance and optimization
8. Security and input validation
9. Accessibility and user experience
10. Final cleanup and polish

## How It Works

1. **Analyzes your repository** - Runs tree, grep, and other commands to understand structure
2. **Deploys Task agents** - Creates parallel agents to debug different areas
3. **Fixes issues iteratively** - Each iteration focuses on specific problems
4. **Continues until done** - Uses `claude -c` to maintain context across iterations

## Example Output

```bash
$ claude-loop

🔄 Claude Loop - Real Iterative Debugging with Claude CLI

🔧 Checking MCP installations...

✓ VUDA (Visual UI Debug Agent) available
✓ Browser MCP available

📡 Starting Claude session:
Command: claude
Max turns: 30
Tools: Bash, Read, Write, Edit, MultiEdit, Grep, Glob, LS, WebFetch, WebSearch, NotebookRead, NotebookEdit, Task
Mode: Full autonomy (--dangerously-skip-permissions)

[Claude begins debugging your repository...]
```

## Requirements

- Claude CLI installed (`pip install claude`)
- Node.js >= 14.0.0
- Git repository to debug

## What Gets Fixed

- 🔘 Broken buttons without click handlers
- 📝 Forms that don't validate or submit
- 🔗 Dead links and 404 routes
- 💾 Data that doesn't persist
- 🎨 UI inconsistencies
- 🐛 Unhandled errors
- 📱 Responsive issues
- ♿ Accessibility problems
- 🔧 Unnecessary complexity

## License

MIT