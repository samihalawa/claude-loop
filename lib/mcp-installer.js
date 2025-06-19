const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const chalk = require('chalk');
const readline = require('readline');

class MCPInstaller {
    constructor() {
        this.configPath = path.join(
            os.homedir(),
            'Library/Application Support/Claude/claude_desktop_config.json'
        );
        this.requiredMCPs = {
            vuda: {
                name: 'Visual UI Debug Agent',
                package: '@samihalawa/visual-ui-debug-agent-mcp',
                description: 'AI vision debugging and UI automation for testing buttons, UI, and workflows',
                required: true
            },
            browsermcp: {
                name: 'Browser MCP',
                package: '@browsermcp/mcp',
                description: 'Browser automation and web interaction capabilities',
                required: false
            },
            'sequential-thinking': {
                name: 'Sequential Thinking',
                package: '@modelcontextprotocol/server-sequential-thinking',
                description: 'Helps Claude think through problems step by step',
                required: false
            }
        };
    }

    async checkAndInstall() {
        console.log(chalk.cyan('\n🔧 Checking MCP installations...\n'));
        
        // Check if Claude config exists
        try {
            await fs.access(this.configPath);
        } catch {
            console.log(chalk.yellow('⚠️  Claude desktop config not found. Please ensure Claude is installed.'));
            return false;
        }

        // Read current config
        const config = JSON.parse(await fs.readFile(this.configPath, 'utf8'));
        const installedMCPs = Object.keys(config.mcpServers || {});
        
        // Check which MCPs are missing
        const missingMCPs = [];
        for (const [key, mcp] of Object.entries(this.requiredMCPs)) {
            if (!installedMCPs.includes(key)) {
                missingMCPs.push({ key, ...mcp });
            }
        }

        if (missingMCPs.length === 0) {
            console.log(chalk.green('✅ All required MCPs are already installed!'));
            return true;
        }

        // Show missing MCPs
        console.log(chalk.yellow('Missing MCPs detected:\n'));
        missingMCPs.forEach(mcp => {
            const status = mcp.required ? chalk.red('[REQUIRED]') : chalk.gray('[OPTIONAL]');
            console.log(`  ${status} ${chalk.bold(mcp.name)}`);
            console.log(`  ${chalk.gray(mcp.description)}\n`);
        });

        // Get Smithery credentials if needed
        const needsSmithery = missingMCPs.some(mcp => 
            mcp.package.includes('@samihalawa/') || 
            mcp.package.includes('@smithery/')
        );

        let smitheryKey = null;
        let smitheryProfile = null;

        if (needsSmithery) {
            console.log(chalk.cyan('\n🔑 Smithery credentials required for some MCPs\n'));
            
            // Check if we can find existing credentials
            const existingSmithery = this.findSmitheryCredentials(config);
            if (existingSmithery) {
                console.log(chalk.green('✓ Found existing Smithery credentials'));
                smitheryKey = existingSmithery.key;
                smitheryProfile = existingSmithery.profile;
            } else {
                // Prompt for credentials
                const credentials = await this.promptSmitheryCredentials();
                smitheryKey = credentials.key;
                smitheryProfile = credentials.profile;
            }
        }

        // Prompt to install
        const shouldInstall = await this.promptYesNo(
            '\nWould you like to install the missing MCPs? (Y/n): '
        );

        if (!shouldInstall) {
            console.log(chalk.yellow('\n⚠️  Skipping MCP installation. Some features may not work.'));
            return false;
        }

        // Install MCPs
        console.log(chalk.cyan('\n📦 Installing MCPs...\n'));
        
        for (const mcp of missingMCPs) {
            await this.installMCP(mcp, config, smitheryKey, smitheryProfile);
        }

        // Save updated config
        await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
        
        console.log(chalk.green('\n✅ MCP installation complete!'));
        console.log(chalk.gray('\nRestart Claude to use the new MCPs.'));
        
        return true;
    }

    findSmitheryCredentials(config) {
        // Look for existing Smithery MCPs to extract credentials
        for (const [name, mcp] of Object.entries(config.mcpServers || {})) {
            if (mcp.args && mcp.args.includes('@smithery/cli@latest')) {
                const keyIndex = mcp.args.indexOf('--key');
                const profileIndex = mcp.args.indexOf('--profile');
                
                if (keyIndex !== -1 && profileIndex !== -1) {
                    return {
                        key: mcp.args[keyIndex + 1],
                        profile: mcp.args[profileIndex + 1]
                    };
                }
            }
        }
        return null;
    }

    async promptSmitheryCredentials() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question('Smithery API Key: ', (key) => {
                rl.question('Smithery Profile: ', (profile) => {
                    rl.close();
                    resolve({ key, profile });
                });
            });
        });
    }

    async promptYesNo(question) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question(question, (answer) => {
                rl.close();
                resolve(answer.toLowerCase() !== 'n');
            });
        });
    }

    async installMCP(mcp, config, smitheryKey, smitheryProfile) {
        console.log(`Installing ${chalk.bold(mcp.name)}...`);
        
        if (!config.mcpServers) {
            config.mcpServers = {};
        }

        // Configure based on package type
        if (mcp.package.includes('@samihalawa/') || mcp.package === '@smithery/toolbox') {
            // Smithery-based MCP
            config.mcpServers[mcp.key] = {
                description: mcp.description,
                command: "npx",
                args: [
                    "-y",
                    "@smithery/cli@latest",
                    "run",
                    mcp.package,
                    "--key",
                    smitheryKey,
                    "--profile",
                    smitheryProfile
                ]
            };
        } else {
            // Standard NPM MCP
            config.mcpServers[mcp.key] = {
                command: "npx",
                args: [
                    "-y",
                    mcp.package
                ]
            };
        }

        console.log(chalk.green(`✓ ${mcp.name} configured`));
    }

    // Check if specific MCPs are available
    async checkMCPAvailability() {
        try {
            const config = JSON.parse(await fs.readFile(this.configPath, 'utf8'));
            const installedMCPs = Object.keys(config.mcpServers || {});
            
            return {
                hasVUDA: installedMCPs.includes('vuda'),
                hasBrowserMCP: installedMCPs.includes('browsermcp'),
                hasSequentialThinking: installedMCPs.includes('sequential-thinking'),
                all: installedMCPs
            };
        } catch {
            return {
                hasVUDA: false,
                hasBrowserMCP: false,
                hasSequentialThinking: false,
                all: []
            };
        }
    }
}

module.exports = MCPInstaller;