const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const fs = require('fs').promises;
const path = require('path');
const Scanner = require('./scanner');
const Orchestrator = require('./orchestrator');
const Monitor = require('./monitor');
const { Logger } = require('./utils/logger');

class ClaudeLoop {
  constructor(options = {}) {
    this.options = {
      repoPath: process.cwd(),
      maxIterations: 5,
      concurrentAgents: 3,
      claudeCommand: 'claude',
      interactive: true,
      dryRun: false,
      scanOnly: false,
      validateOnly: false,
      monitorOnly: false,
      focus: null,
      outputFile: 'claude-loop-report.json',
      ...options
    };

    this.logger = new Logger(this.options.verbose);
    this.scanner = new Scanner(this.options.repoPath, this.logger);
    this.orchestrator = new Orchestrator(this.options, this.logger);
    this.monitor = new Monitor(this.logger);
  }

  async scan() {
    const spinner = ora('Scanning repository for issues...').start();
    
    try {
      const report = await this.scanner.scan(this.options.issueTypes);
      spinner.succeed('Scan complete!');
      
      // Display summary
      console.log('\n' + chalk.bold('Issue Summary:'));
      console.log('━'.repeat(50));
      
      let totalIssues = 0;
      Object.entries(report.summary.byCategory).forEach(([category, count]) => {
        if (count > 0) {
          totalIssues += count;
          const color = this.getCategoryColor(category);
          console.log(`  ${chalk[color]('●')} ${category}: ${chalk.bold(count)} issues`);
        }
      });
      
      console.log('━'.repeat(50));
      console.log(`  ${chalk.bold('Total:')} ${chalk.red(totalIssues)} issues found\n`);
      
      // Save report
      await fs.writeFile(
        path.join(this.options.repoPath, this.options.outputFile),
        JSON.stringify(report, null, 2)
      );
      
      console.log(chalk.green(`✓ Full report saved to: ${this.options.outputFile}`));
      
      if (report.recommendations.length > 0) {
        console.log('\n' + chalk.bold('Recommendations:'));
        for (const rec of report.recommendations) {
          console.log(`  ${chalk.yellow('→')} [${rec.priority}] ${rec.action}`);
          if (rec.command) {
            console.log(`    ${chalk.gray('Run:')} ${chalk.cyan(rec.command)}`);
          }
        }
      }
      
      return report;
    } catch (error) {
      spinner.fail('Scan failed');
      throw error;
    }
  }

  async debug() {
    console.log(chalk.cyan.bold('\n🤖 Claude Loop - AI-Powered Repository Debugger\n'));
    
    // Initial scan
    const scanReport = await this.scan();
    
    if (scanReport.summary.total === 0) {
      console.log(chalk.green('\n✨ No issues found! Your repository is clean.\n'));
      return;
    }
    
    // Confirm before proceeding
    if (this.options.interactive && !this.options.dryRun) {
      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: `Found ${scanReport.summary.total} issues. Run automated fixing?`,
        default: true
      }]);
      
      if (!proceed) {
        console.log(chalk.yellow('\n⚠ Debug cancelled by user.\n'));
        return;
      }
    }
    
    // Show what will be done
    if (this.options.dryRun) {
      console.log(chalk.yellow('\n🔍 DRY RUN MODE - No changes will be applied\n'));
    }
    
    // Run orchestrator
    try {
      await this.orchestrator.run(scanReport);
      
      console.log(chalk.green.bold('\n✅ Debug session complete!\n'));
      
      // Final summary
      const finalReport = await this.scanner.scan();
      const fixed = scanReport.summary.total - finalReport.summary.total;
      
      console.log(chalk.bold('Results:'));
      console.log(`  Fixed: ${chalk.green(fixed)} issues`);
      console.log(`  Remaining: ${chalk.yellow(finalReport.summary.total)} issues`);
      console.log(`  Success Rate: ${chalk.cyan(Math.round((fixed / scanReport.summary.total) * 100) + '%')}`);
      
    } catch (error) {
      console.error(chalk.red('\n❌ Debug failed:'), error.message);
      throw error;
    }
  }

  async validate() {
    const spinner = ora('Loading fixes to validate...').start();
    
    try {
      const fixesPath = path.join(this.options.repoPath, this.options.fixesFile);
      const fixes = JSON.parse(await fs.readFile(fixesPath, 'utf8'));
      
      spinner.text = 'Validating fixes...';
      
      const results = await this.orchestrator.validateFixes(fixes);
      
      spinner.succeed('Validation complete!');
      
      // Display results
      console.log('\n' + chalk.bold('Validation Results:'));
      console.log('━'.repeat(50));
      
      let passed = 0, failed = 0;
      results.forEach(result => {
        if (result.valid) {
          passed++;
          console.log(`  ${chalk.green('✓')} ${result.name}`);
        } else {
          failed++;
          console.log(`  ${chalk.red('✗')} ${result.name}: ${result.errors.join(', ')}`);
        }
      });
      
      console.log('━'.repeat(50));
      console.log(`  Passed: ${chalk.green(passed)} | Failed: ${chalk.red(failed)}\n`);
      
      return results;
    } catch (error) {
      spinner.fail('Validation failed');
      throw error;
    }
  }

  async startMonitor(port = 8080) {
    console.log(chalk.cyan('\n📊 Starting Claude Loop Monitor...\n'));
    
    try {
      await this.monitor.start(port, this.options.repoPath);
      
      console.log(chalk.green(`✓ Monitor running at: ${chalk.bold(`http://localhost:${port}`)}`));
      console.log(chalk.gray('\nPress Ctrl+C to stop the monitor\n'));
      
    } catch (error) {
      console.error(chalk.red('Failed to start monitor:'), error.message);
      throw error;
    }
  }

  getCategoryColor(category) {
    const colors = {
      syntax: 'red',
      tests: 'yellow',
      dependencies: 'magenta',
      types: 'blue',
      security: 'redBright',
      performance: 'cyan'
    };
    return colors[category] || 'white';
  }

  static async init() {
    console.log(chalk.cyan.bold('\n🎯 Claude Loop Configuration\n'));
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'claudeCommand',
        message: 'Claude CLI command:',
        default: 'claude'
      },
      {
        type: 'number',
        name: 'maxIterations',
        message: 'Maximum debug iterations:',
        default: 5
      },
      {
        type: 'number',
        name: 'concurrentAgents',
        message: 'Concurrent agents:',
        default: 3
      },
      {
        type: 'confirm',
        name: 'interactive',
        message: 'Enable interactive mode?',
        default: true
      }
    ]);
    
    const config = {
      claudeLoop: {
        ...answers,
        version: require('../package.json').version
      }
    };
    
    // Save to .claude-loop.json
    await fs.writeFile(
      path.join(process.cwd(), '.claude-loop.json'),
      JSON.stringify(config, null, 2)
    );
    
    console.log(chalk.green('\n✓ Configuration saved to .claude-loop.json'));
    console.log(chalk.gray('\nYou can now run: claude-loop debug\n'));
  }
}

module.exports = ClaudeLoop;