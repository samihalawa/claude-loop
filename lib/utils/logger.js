const chalk = require('chalk');

class Logger {
    constructor(verbose = false) {
        this.verbose = verbose;
    }

    info(message) {
        console.log(chalk.blue('ℹ'), message);
    }

    success(message) {
        console.log(chalk.green('✓'), message);
    }

    warn(message) {
        console.log(chalk.yellow('⚠'), message);
    }

    error(message, details) {
        console.log(chalk.red('✗'), message);
        if (details && this.verbose) {
            console.log(chalk.gray(details));
        }
    }

    debug(message) {
        if (this.verbose) {
            console.log(chalk.gray('→'), message);
        }
    }
}

module.exports = { Logger };