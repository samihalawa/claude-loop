#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const packageJson = require('../package.json');
const ClaudeLoopEngine = require('../lib/claude-loop-engine');

program
  .name('claude-loop')
  .description('AI-powered repository debugging tool using Claude CLI')
  .version(packageJson.version);

program
  .command('loop')
  .description('Run real iterative Claude loop')
  .option('-p, --path <path>', 'Repository path (default: current directory)')
  .option('-m, --max-iterations <n>', 'Maximum iterations', '10')
  .option('-c, --claude-command <cmd>', 'Claude CLI command', 'claude')
  .option('-u, --ui', 'Enable web UI to monitor progress')
  .action(async (options) => {
    try {
      const maxIterations = parseInt(options.maxIterations);
      if (isNaN(maxIterations) || maxIterations < 1) {
        console.error(chalk.red('Error: max-iterations must be a positive number'));
        process.exit(1);
      }
      
      const engine = new ClaudeLoopEngine({
        repoPath: options.path || process.cwd(),
        maxIterations: maxIterations,
        claudeCommand: options.claudeCommand,
        ui: options.ui
      });
      
      await engine.run();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Show help or run default
if (process.argv.length === 2) {
  console.log(chalk.cyan(`
   _____ _                 _        _                       
  / ____| |               | |      | |                      
 | |    | | __ _ _   _  __| | ___  | |     ___   ___  _ __  
 | |    | |/ _\` | | | |/ _\` |/ _ \\ | |    / _ \\ / _ \\| '_ \\ 
 | |____| | (_| | |_| | (_| |  __/ | |___| (_) | (_) | |_) |
  \\_____|_|\\__,_|\\__,_|\\__,_|\\___| |______\\___/ \\___/| .__/ 
                                                      | |    
                                                      |_|    
  `));
  console.log(chalk.gray('  Real iterative AI-powered debugging\\n'));
  console.log(chalk.bold('  Usage:'));
  console.log(chalk.cyan('  claude-loop         ') + chalk.gray('# Run iterative debugging (default)'));
  console.log(chalk.cyan('  claude-loop loop    ') + chalk.gray('# Same as above with options\\n'));
  
  // Run by default
  console.log(chalk.cyan('Starting claude-loop in current directory...\\n'));
  const engine = new ClaudeLoopEngine({
    repoPath: process.cwd(),
    maxIterations: 10,
    claudeCommand: 'claude'
  });
  engine.run().catch(error => {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  });
  return; // Prevent continuing to program.parse()
}

program.parse(process.argv);