#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const packageJson = require('../package.json');
const ClaudeLoop = require('../lib');

program
  .name('claude-loop')
  .description('AI-powered repository debugging tool using Claude CLI')
  .version(packageJson.version);

program
  .command('scan')
  .description('Scan repository for issues without fixing')
  .option('-p, --path <path>', 'Repository path (default: current directory)')
  .option('-o, --output <file>', 'Output report file', 'claude-loop-report.json')
  .option('-t, --types <types>', 'Issue types to scan (comma-separated)', 'all')
  .action(async (options) => {
    try {
      const loop = new ClaudeLoop({
        repoPath: options.path || process.cwd(),
        scanOnly: true,
        outputFile: options.output,
        issueTypes: options.types === 'all' ? null : options.types.split(',')
      });
      
      await loop.scan();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('debug')
  .description('Run full debug cycle with automatic fixing')
  .option('-p, --path <path>', 'Repository path (default: current directory)')
  .option('-m, --max-iterations <n>', 'Maximum debug iterations', '10')
  .option('-a, --agents <n>', 'Concurrent agents', '3')
  .option('-c, --claude-command <cmd>', 'Claude CLI command', 'claude')
  .option('--no-interactive', 'Skip confirmation prompts')
  .option('--dry-run', 'Show what would be fixed without applying')
  .option('-f, --focus <area>', 'Focus on specific area (syntax,tests,deps,types,security,perf)')
  .option('--engine <type>', 'Debug engine: iterative (default) or legacy', 'iterative')
  .option('--legacy', 'Use legacy static analysis mode')
  .action(async (options) => {
    try {
      const loop = new ClaudeLoop({
        repoPath: options.path || process.cwd(),
        maxIterations: parseInt(options.maxIterations),
        concurrentAgents: parseInt(options.agents),
        claudeCommand: options.claudeCommand,
        interactive: options.interactive,
        dryRun: options.dryRun,
        focus: options.focus,
        engine: options.engine,
        legacy: options.legacy
      });
      
      await loop.debug();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('loop')
  .description('Run real iterative Claude loop (your style)')
  .option('-p, --path <path>', 'Repository path (default: current directory)')
  .option('-m, --max-iterations <n>', 'Maximum iterations', '10')
  .option('-c, --claude-command <cmd>', 'Claude CLI command', 'claude')
  .action(async (options) => {
    try {
      // Direct to iterative engine
      const ClaudeLoopEngine = require('../lib/claude-loop-engine');
      const engine = new ClaudeLoopEngine({
        repoPath: options.path || process.cwd(),
        maxIterations: parseInt(options.maxIterations),
        claudeCommand: options.claudeCommand
      });
      
      await engine.run();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('monitor')
  .description('Open real-time monitoring interface')
  .option('-p, --port <port>', 'Port for monitoring server', '8080')
  .action(async (options) => {
    try {
      const loop = new ClaudeLoop({ monitorOnly: true });
      await loop.startMonitor(options.port);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate fixes without applying them')
  .option('-p, --path <path>', 'Repository path (default: current directory)')
  .option('-f, --fixes <file>', 'JSON file with proposed fixes')
  .action(async (options) => {
    try {
      const loop = new ClaudeLoop({
        repoPath: options.path || process.cwd(),
        validateOnly: true,
        fixesFile: options.fixes
      });
      
      await loop.validate();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize claude-loop configuration')
  .action(async () => {
    try {
      const ClaudeLoop = require('../lib');
      await ClaudeLoop.init();
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// Show ASCII art logo
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
  console.log(chalk.gray('  Real iterative AI-powered debugging\n'));
  console.log(chalk.bold('  Quick start:'));
  console.log(chalk.cyan('  claude-loop loop    ') + chalk.gray('# Run iterative debugging (recommended)'));
  console.log(chalk.cyan('  claude-loop scan    ') + chalk.gray('# Scan for issues'));
  console.log(chalk.cyan('  claude-loop debug   ') + chalk.gray('# Debug with options\n'));
  program.outputHelp();
}

program.parse(process.argv);