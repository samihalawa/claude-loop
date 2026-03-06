const { spawn } = require('child_process');
const chalk = require('chalk');
const logger = require('./utils/unified-logger');

class ClaudeChatIntegration {
    constructor(webUI) {
        this.webUI = webUI;
        this.claudeProcess = null;
        this.conversationHistory = [];
        this.settings = {
            defaultModel: 'sonnet',
            maxTurns: 5,
            allowedTools: '',
            disallowedTools: '',
            claudeCliPath: '/opt/homebrew/bin/claude',
            systemPrompt: '',
            mcpServers: []
        };
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        logger.info(chalk.cyan(`🔧 Claude integration settings updated`));
    }

    // Integrate with actual Claude Code CLI
    async sendToClaudeCode(message, context = {}) {
        try {
            logger.info(chalk.blue(`🤖 Sending to Claude CLI: ${message.substring(0, 50)}...`));
            
            // Use the configured claude command or default
            const settings = context.settings || this.settings;
            const claudeCommand = settings.claudeCliPath || '/opt/homebrew/bin/claude';
            
            // Build CLI arguments based on settings
            const args = [];
            
            // Add print mode for non-interactive usage
            args.push('-p');
            
            // Add max turns if specified
            if (settings.maxTurns > 0) {
                args.push('--max-turns', settings.maxTurns.toString());
            }
            
            // Add model selection if different from default
            if (context.model && context.model !== 'sonnet') {
                args.push('--model', context.model);
            }
            
            // Add allowed tools if specified
            if (settings.allowedTools && settings.allowedTools.trim()) {
                args.push('--allowedTools', settings.allowedTools);
            }
            
            // Add disallowed tools if specified
            if (settings.disallowedTools && settings.disallowedTools.trim()) {
                args.push('--disallowedTools', settings.disallowedTools);
            }
            
            // Add system prompt if specified
            if (settings.systemPrompt && settings.systemPrompt.trim()) {
                args.push('--append-system-prompt', settings.systemPrompt);
            }
            
            // Add MCP servers if configured
            if (settings.mcpServers && settings.mcpServers.length > 0) {
                // Create a temporary MCP config file
                const mcpConfig = await this.createMcpConfig(settings.mcpServers);
                if (mcpConfig) {
                    args.push('--mcp-config', mcpConfig);
                }
            }
            
            // Prepare the message for Claude
            let fullMessage = message;
            
            // Add file context if provided
            if (context.files && context.files.length > 0) {
                const fileContext = await this.readFileContents(context.files);
                if (fileContext) {
                    fullMessage = `Context files:\n${fileContext}\n\nUser message: ${message}`;
                }
            }
            
            // Add the message as the final argument
            args.push(fullMessage);
            
            logger.info(chalk.gray(`🔧 Claude CLI args: ${args.slice(0, -1).join(' ')}`));
            
            return new Promise((resolve, reject) => {
                const claude = spawn(claudeCommand, args, {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    shell: false,
                    cwd: process.cwd()
                });
                
                let response = '';
                let errorOutput = '';
                
                claude.stdout.on('data', (data) => {
                    const chunk = data.toString();
                    response += chunk;
                    
                    // Stream response back in real-time if possible
                    if (this.webUI && chunk.trim()) {
                        this.webUI.broadcast({
                            type: 'chat_stream',
                            data: {
                                chunk: chunk,
                                timestamp: Date.now()
                            }
                        });
                    }
                });
                
                claude.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });
                
                claude.on('close', (code) => {
                    if (code === 0 && response.trim()) {
                        this.conversationHistory.push({
                            user: message,
                            claude: response.trim(),
                            timestamp: Date.now(),
                            model: context.model || 'default'
                        });
                        
                        logger.info(chalk.green(`✅ Claude CLI response received (${response.length} chars)`));
                        resolve(response.trim());
                    } else {
                        const error = errorOutput.trim() || 'Claude CLI returned empty response';
                        logger.error(`Claude CLI failed (code ${code}): ${error}`);
                        
                        // Return a helpful error message instead of falling back
                        resolve(`**Claude CLI Error (code ${code})**\n\n${error}\n\n*Make sure Claude CLI is properly configured with your API key.*\n\nTo set up Claude CLI:\n1. Run \`claude auth\` to authenticate\n2. Verify with \`claude --version\`\n3. Try again!`);
                    }
                });
                
                claude.on('error', (error) => {
                    logger.error(`Failed to start Claude CLI: ${error.message}`);
                    resolve(`**Claude CLI Not Available**\n\nError: ${error.message}\n\nPlease ensure Claude CLI is installed:\n\`\`\`bash\nnpm install -g @anthropic/claude-cli\n# or\nbrew install claude-cli\n\`\`\`\n\nThen authenticate with: \`claude auth\``);
                });
                
                // Send the message to Claude's stdin
                claude.stdin.write(fullMessage);
                claude.stdin.end();
                
                // Set timeout
                setTimeout(() => {
                    if (!claude.killed) {
                        claude.kill();
                        reject(new Error('Claude CLI timeout after 30 seconds'));
                    }
                }, 30000);
            });
            
        } catch (error) {
            logger.error(`Claude Code integration error: ${error.message}`);
            return `**Integration Error**\n\n${error.message}\n\nFalling back to offline mode.`;
        }
    }

    // Read file contents for context
    async readFileContents(files) {
        const fs = require('fs');
        const path = require('path');
        
        let context = '';
        
        for (const file of files) {
            try {
                // Remove @ symbol if present
                const cleanFileName = file.replace('@', '');
                
                // Try to find the file in current directory and subdirectories
                const foundFile = await this.findFile(cleanFileName);
                
                if (foundFile) {
                    const content = fs.readFileSync(foundFile, 'utf8');
                    context += `\n--- ${foundFile} ---\n${content.substring(0, 5000)}${content.length > 5000 ? '\n... (truncated)' : ''}\n`;
                }
            } catch (error) {
                context += `\n--- ${file} (Error: ${error.message}) ---\n`;
            }
        }
        
        return context;
    }

    // Find file in project directory
    async findFile(filename) {
        const fs = require('fs');
        const path = require('path');
        
        // Check if it's already a full path
        if (fs.existsSync(filename)) {
            return filename;
        }
        
        // Search in common directories
        const searchPaths = [
            path.join(process.cwd(), filename),
            path.join(process.cwd(), 'lib', filename),
            path.join(process.cwd(), 'src', filename),
            path.join(process.cwd(), 'bin', filename),
            path.join(process.cwd(), 'templates', filename)
        ];
        
        for (const searchPath of searchPaths) {
            if (fs.existsSync(searchPath)) {
                return searchPath;
            }
        }
        
        return null;
    }
    
    // Parse file references from message (e.g., @filename)
    parseFileReferences(message) {
        const filePattern = /@([^\s]+)/g;
        const matches = [];
        let match;
        
        while ((match = filePattern.exec(message)) !== null) {
            matches.push(match[1]);
        }
        
        return matches;
    }
    
    // Parse slash commands from message (e.g., /help)
    parseSlashCommands(message) {
        const commandPattern = /^\/(\w+)(?:\s+(.*))?$/;
        const match = message.match(commandPattern);
        
        if (match) {
            return {
                command: match[1],
                args: match[2] || ''
            };
        }
        
        return null;
    }
    
    // Handle slash commands
    async handleSlashCommand(command, args, webUI = null) {
        switch (command) {
            case 'help':
                return await this.executeClaudeCommand(['--help']);
            case 'model':
                if (args && args.trim()) {
                    return this.handleModelCommand(args, webUI);
                } else {
                    return await this.executeClaudeCommand(['--help']);
                }
            case 'version':
                return await this.executeClaudeCommand(['--version']);
            case 'files':
                return this.listProjectFiles();
            case 'clear':
                this.conversationHistory = [];
                return 'Conversation history cleared.';
            case 'history':
                return this.getConversationSummary();
            case 'settings':
                return this.getSettingsInfo();
            case 'mcp':
                return this.getMcpInfo();
            default:
                // Try to pass unknown commands directly to Claude CLI
                return await this.executeClaudeCommand([`--${command}`].concat(args ? args.split(' ') : []));
        }
    }
    
    // Handle model command with switching capability
    async handleModelCommand(args, webUI = null) {
        if (!args || args.trim() === '') {
            return this.getModelInfo();
        }

        const modelName = args.trim().toLowerCase();
        const validModels = ['sonnet', 'opus', 'haiku'];
        
        if (!validModels.includes(modelName)) {
            return `❌ **Invalid model**: \`${args}\`\n\nAvailable models: **sonnet**, **opus**, **haiku**\n\nUsage: \`/model sonnet\` or \`/model opus\``;
        }

        // Update settings
        this.settings.defaultModel = modelName;
        
        // Notify WebUI if available
        if (webUI) {
            webUI.settings.defaultModel = modelName;
            webUI.broadcast({
                type: 'model_switched',
                data: {
                    model: modelName,
                    timestamp: Date.now()
                }
            });
        }

        logger.info(chalk.cyan(`🔄 Model switched to: ${modelName}`));
        
        return `✅ **Model switched to**: **${modelName.charAt(0).toUpperCase() + modelName.slice(1)}**\n\nNext messages will use Claude 3.5 ${modelName.charAt(0).toUpperCase() + modelName.slice(1)}.`;
    }

    getHelpText() {
        return `# Claude Code Chat Commands

**Slash Commands (pass-through to Claude CLI):**
- \`/help\` - Show actual Claude CLI help
- \`/version\` - Show Claude CLI version
- \`/model [name]\` - Switch models (sonnet|opus|haiku)

**Chat-specific Commands:**
- \`/files\` - List project files
- \`/clear\` - Clear conversation history
- \`/history\` - Show conversation summary
- \`/settings\` - Show current settings
- \`/mcp\` - Show MCP server status

**File References:**
- Use \`@filename\` to reference files in your message
- Example: "Can you review @web-ui.js for security issues?"

**Any Claude CLI flag as slash command:**
- \`/max-turns 10\` → \`claude --max-turns 10\`
- \`/tools\` → \`claude --tools\`
- All Claude CLI flags work as slash commands!

**Tips:**
- Use **Ctrl+Enter** to send messages
- Click files in sidebar to add them to your message
- Configure settings using the ⚙️ settings panel`;
    }
    
    getModelInfo() {
        const currentModel = this.settings.defaultModel || 'sonnet';
        return `# Model Information

**Current Model:** **${currentModel.charAt(0).toUpperCase() + currentModel.slice(1)}**

**Available Models:**
- **Claude 3.5 Sonnet** - Best balance of intelligence and speed
- **Claude 3 Opus** - Most capable for complex tasks  
- **Claude 3 Haiku** - Fastest responses

**Current Capabilities:**
- Code analysis and generation
- File understanding and modification
- Debugging assistance
- Architecture recommendations
- Security analysis

**Switch models:** Use \`/model opus\` or \`/model haiku\` or \`/model sonnet\``;
    }

    getSettingsInfo() {
        return `# Current Settings

**Model Configuration:**
- Default Model: **${this.settings.defaultModel || 'sonnet'}**
- Max Turns: **${this.settings.maxTurns || 5}**

**Tool Configuration:**
- Allowed Tools: ${this.settings.allowedTools || '*none specified*'}
- Disallowed Tools: ${this.settings.disallowedTools || '*none specified*'}

**Claude CLI:**
- CLI Path: \`${this.settings.claudeCliPath || '/opt/homebrew/bin/claude'}\`
- System Prompt: ${this.settings.systemPrompt ? '*configured*' : '*none*'}

**MCP Servers:** ${this.settings.mcpServers?.length || 0} configured

💡 **Tip:** Use the ⚙️ settings panel in the UI to modify these settings interactively.`;
    }

    getMcpInfo() {
        const mcpServers = this.settings.mcpServers || [];
        if (mcpServers.length === 0) {
            return `# MCP Server Status

No MCP servers configured.

**What are MCP Servers?**
Model Context Protocol (MCP) servers extend Claude's capabilities with custom tools and data sources.

**Configure MCP:**
1. Open the ⚙️ settings panel
2. Go to the "MCP Servers" section  
3. Add server configurations
4. Restart the chat session

**Example MCP Servers:**
- File system access
- Database connections
- Web scraping tools
- Custom APIs`;
        }

        let status = `# MCP Server Status\n\n**Configured Servers (${mcpServers.length}):**\n\n`;
        
        mcpServers.forEach((server, index) => {
            status += `**${index + 1}. ${server.name || 'Unnamed Server'}**\n`;
            status += `- Command: \`${server.command || 'Not specified'}\`\n`;
            status += `- Args: ${server.args?.join(' ') || 'None'}\n`;
            status += `- Env: ${Object.keys(server.env || {}).length} variables\n\n`;
        });

        return status + `💡 **Tip:** Modify MCP servers in the ⚙️ settings panel.`;
    }

    // Execute Claude CLI command and return raw output
    async executeClaudeCommand(args) {
        try {
            const claudeCommand = this.settings.claudeCliPath || '/opt/homebrew/bin/claude';
            
            logger.info(chalk.gray(`🔧 Executing Claude CLI: ${claudeCommand} ${args.join(' ')}`));
            
            return new Promise((resolve, reject) => {
                const claude = spawn(claudeCommand, args, {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    shell: false,
                    cwd: process.cwd()
                });
                
                let output = '';
                let errorOutput = '';
                
                claude.stdout.on('data', (data) => {
                    output += data.toString();
                });
                
                claude.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });
                
                claude.on('close', (code) => {
                    if (code === 0 || output.trim()) {
                        // Format the output as a code block for better display
                        const formattedOutput = `\`\`\`\n${output.trim() || errorOutput.trim()}\n\`\`\``;
                        resolve(formattedOutput);
                    } else {
                        const error = errorOutput.trim() || 'Command returned no output';
                        resolve(`**Claude CLI Error (code ${code})**\n\n\`\`\`\n${error}\n\`\`\`\n\n*Make sure Claude CLI is properly configured.*`);
                    }
                });
                
                claude.on('error', (error) => {
                    logger.error(`Failed to execute Claude CLI: ${error.message}`);
                    resolve(`**Claude CLI Not Available**\n\nError: ${error.message}\n\nPlease ensure Claude CLI is installed and accessible.`);
                });
                
                // Close stdin immediately for help/version commands
                claude.stdin.end();
                
                // Set timeout for help commands
                setTimeout(() => {
                    if (!claude.killed) {
                        claude.kill();
                        resolve('**Command Timeout**\n\nClaude CLI command timed out after 10 seconds.');
                    }
                }, 10000);
            });
            
        } catch (error) {
            logger.error(`Claude CLI execution error: ${error.message}`);
            return `**Execution Error**\n\n${error.message}`;
        }
    }

    // Create temporary MCP config file
    async createMcpConfig(mcpServers) {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        
        try {
            const mcpConfig = {
                mcpServers: {}
            };
            
            // Convert server array to Claude CLI format
            mcpServers.forEach((server, index) => {
                const serverName = server.name || `server_${index + 1}`;
                mcpConfig.mcpServers[serverName] = {
                    command: server.command || '',
                    args: server.args || [],
                    env: server.env || {}
                };
            });
            
            // Write to temporary file
            const tempDir = os.tmpdir();
            const configPath = path.join(tempDir, `claude-mcp-${Date.now()}.json`);
            
            fs.writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));
            logger.info(chalk.gray(`📝 Created MCP config: ${configPath}`));
            
            return configPath;
            
        } catch (error) {
            logger.error(`Failed to create MCP config: ${error.message}`);
            return null;
        }
    }
    
    async listProjectFiles() {
        const fs = require('fs');
        const path = require('path');
        
        try {
            const rootPath = process.cwd();
            const files = this.getAllFiles(rootPath, [], 2);
            
            return `# Project Files

\`\`\`
${files.join('\n')}
\`\`\`

Use \`@filename\` to reference any of these files in your messages.`;
        } catch (error) {
            return `Error listing files: ${error.message}`;
        }
    }
    
    getAllFiles(dirPath, fileList = [], maxDepth = 2, currentDepth = 0) {
        const fs = require('fs');
        const path = require('path');
        
        if (currentDepth >= maxDepth) return fileList;
        
        try {
            const items = fs.readdirSync(dirPath);
            
            for (const item of items) {
                if (item.startsWith('.') || item === 'node_modules' || item === 'archive') continue;
                
                const fullPath = path.join(dirPath, item);
                const relativePath = path.relative(process.cwd(), fullPath);
                const stats = fs.statSync(fullPath);
                
                if (stats.isDirectory()) {
                    fileList.push(`📁 ${relativePath}/`);
                    this.getAllFiles(fullPath, fileList, maxDepth, currentDepth + 1);
                } else {
                    fileList.push(`📄 ${relativePath}`);
                }
            }
        } catch (error) {
            // Ignore errors for individual files/directories
        }
        
        return fileList;
    }
    
    getConversationSummary() {
        if (this.conversationHistory.length === 0) {
            return 'No conversation history yet.';
        }
        
        const summary = this.conversationHistory.map((item, index) => {
            const timestamp = new Date(item.timestamp).toLocaleTimeString();
            return `**${index + 1}.** [${timestamp}] (${item.model})\n**User:** ${item.user.substring(0, 100)}...\n**Claude:** ${item.claude.substring(0, 100)}...\n`;
        }).join('\n');
        
        return `# Conversation History (${this.conversationHistory.length} messages)\n\n${summary}`;
    }
    
    generateFallbackResponse(message) {
        const responses = [
            `I understand you're asking about: "${message}"\n\nSince I can't connect to Claude Code CLI right now, here's what I would typically help with:\n\n- **Code Analysis**: Review and suggest improvements\n- **Debugging**: Help identify and fix issues\n- **Architecture**: Recommend best practices\n- **Documentation**: Explain complex code sections\n\nPlease make sure Claude Code CLI is installed and accessible.`,
            
            `I see your message: "${message}"\n\nTo get the full Claude Code experience:\n\n1. Install Claude Code CLI: \`npm install -g claude-code\`\n2. Set up your API key\n3. Restart this interface\n\nFor now, I can provide general coding assistance based on your message.`,
            
            `Thanks for your question: "${message}"\n\n**Fallback Mode Active** 🔄\n\nI'm currently running in demo mode. To unlock full capabilities:\n\n- Ensure Claude Code CLI is installed\n- Check your API configuration\n- Verify network connectivity\n\nHow can I help you with general coding questions in the meantime?`
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    }
}

module.exports = ClaudeChatIntegration;