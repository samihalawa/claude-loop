const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

class Logger {
    constructor(verbose = false, logFile = null) {
        this.verbose = verbose;
        this.logFile = logFile;
        this.logLevels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            SUCCESS: 2,
            DEBUG: 3
        };
        this.currentLevel = this.verbose ? this.logLevels.DEBUG : this.logLevels.INFO;
    }

    _log(level, icon, color, message, details = null) {
        if (this.logLevels[level] > this.currentLevel) {
            return;
        }

        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] ${icon} ${message}`;
        
        // Console output with colors
        console.log(color(icon), message);
        if (details && this.verbose) {
            console.log(chalk.gray(details));
        }
        
        // File logging if enabled
        if (this.logFile) {
            try {
                const logEntry = `${formattedMessage}${details ? ' | ' + details : ''}\n`;
                fs.appendFileSync(this.logFile, logEntry);
            } catch (error) {
                // Prevent infinite loop by not using logger for logger errors
                console.error('Failed to write to log file:', error.message);
            }
        }
    }

    info(message, details = null) {
        this._log('INFO', 'ℹ', chalk.blue, message, details);
    }

    success(message, details = null) {
        this._log('SUCCESS', '✓', chalk.green, message, details);
    }

    warn(message, details = null) {
        this._log('WARN', '⚠', chalk.yellow, message, details);
    }

    error(message, details = null) {
        this._log('ERROR', '✗', chalk.red, message, details);
    }

    debug(message, details = null) {
        this._log('DEBUG', '→', chalk.gray, message, details);
    }

    // Progress and status logging
    progress(message) {
        this._log('INFO', '⏳', chalk.cyan, message);
    }

    status(message) {
        this._log('INFO', '📊', chalk.magenta, message);
    }

    // Security-related logging
    security(message, details = null) {
        this._log('WARN', '🔒', chalk.yellow, message, details);
    }

    // Performance logging
    performance(message, timing = null) {
        const details = timing ? `(${timing}ms)` : null;
        this._log('INFO', '⚡', chalk.blue, message, details);
    }

    // Set log level dynamically
    setLevel(level) {
        if (level in this.logLevels) {
            this.currentLevel = this.logLevels[level];
        }
    }

    // Enable/disable file logging
    setLogFile(filePath) {
        this.logFile = filePath;
        if (filePath) {
            // Ensure directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }
}

// Create a default logger instance
const defaultLogger = new Logger(
    process.env.NODE_ENV === 'development',
    process.env.LOG_FILE
);

module.exports = { Logger, logger: defaultLogger };