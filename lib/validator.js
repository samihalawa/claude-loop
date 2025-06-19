const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class Validator {
    constructor(repoPath, logger) {
        this.repoPath = repoPath;
        this.logger = logger;
        this.baseline = null;
        this.validationResults = {};
    }

    async captureBaseline() {
        this.logger.info('Capturing baseline state...');
        
        this.baseline = {
            testResults: await this.runTests(),
            lintResults: await this.runLinter(),
            typeResults: await this.runTypeCheck(),
            buildResults: await this.runBuild()
        };

        return this.baseline;
    }

    async validateFix(fix, fixName = 'unnamed') {
        this.logger.debug(`Validating fix: ${fixName}`);
        
        const results = {
            name: fixName,
            applied: false,
            valid: false,
            errors: [],
            warnings: []
        };

        try {
            // Apply the fix
            await this.applyFix(fix);
            results.applied = true;

            // Run validation suite
            const validation = await this.runValidationSuite();
            
            // Compare with baseline
            results.comparison = this.compareWithBaseline(validation);
            
            // Determine if fix is valid
            results.valid = this.isFixValid(results.comparison);
            
            if (!results.valid) {
                results.errors.push('Fix causes regression');
                await this.rollbackFix(fix);
            }

        } catch (error) {
            results.errors.push(error.message);
            results.valid = false;
            
            // Attempt rollback
            try {
                await this.rollbackFix(fix);
            } catch (rollbackError) {
                results.errors.push(`Rollback failed: ${rollbackError.message}`);
            }
        }

        this.validationResults[fixName] = results;
        return results;
    }

    async applyFix(fix) {
        if (fix.type === 'file_edit') {
            const filePath = path.join(this.repoPath, fix.file);
            
            // Read current content
            let content;
            try {
                content = await fs.readFile(filePath, 'utf8');
            } catch (error) {
                if (error.code === 'ENOENT') {
                    // File doesn't exist, create it
                    content = '';
                } else {
                    throw error;
                }
            }
            
            // Store original for rollback
            fix.original = content;
            
            // Apply changes
            let newContent = content;
            for (const change of fix.changes) {
                newContent = this.applyChange(newContent, change);
            }
            
            // Ensure directory exists
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            
            // Write new content
            await fs.writeFile(filePath, newContent);
            
        } else if (fix.type === 'command') {
            execSync(fix.command, { cwd: this.repoPath });
        }
    }

    applyChange(content, change) {
        if (change.original && change.replacement) {
            // Simple string replacement
            return content.replace(change.original, change.replacement);
        } else if (change.line && change.replacement) {
            // Line-based replacement
            const lines = content.split('\n');
            if (change.line > 0 && change.line <= lines.length) {
                lines[change.line - 1] = change.replacement;
            }
            return lines.join('\n');
        }
        return content;
    }

    async rollbackFix(fix) {
        if (fix.type === 'file_edit' && fix.original !== undefined) {
            const filePath = path.join(this.repoPath, fix.file);
            await fs.writeFile(filePath, fix.original);
        }
    }

    async runValidationSuite() {
        const results = {
            tests: await this.runTests(),
            lint: await this.runLinter(),
            types: await this.runTypeCheck(),
            build: await this.runBuild()
        };

        return results;
    }

    async runTests() {
        try {
            execSync('npm test', {
                cwd: this.repoPath,
                encoding: 'utf8',
                stdio: 'pipe'
            });

            return { passed: true, error: null };
        } catch (error) {
            return {
                passed: false,
                error: error.message,
                output: error.stdout || error.stderr
            };
        }
    }

    async runLinter() {
        try {
            execSync('npx eslint .', {
                cwd: this.repoPath,
                encoding: 'utf8',
                stdio: 'pipe'
            });

            return { passed: true, errors: 0, warnings: 0 };
        } catch (error) {
            // ESLint exits with error if there are issues
            const output = error.stdout || error.stderr || '';
            const errorCount = (output.match(/\d+ errors?/g) || ['0'])[0].match(/\d+/)[0];
            const warningCount = (output.match(/\d+ warnings?/g) || ['0'])[0].match(/\d+/)[0];
            
            return {
                passed: false,
                errors: parseInt(errorCount),
                warnings: parseInt(warningCount)
            };
        }
    }

    async runTypeCheck() {
        try {
            // Check if TypeScript is used
            await fs.access(path.join(this.repoPath, 'tsconfig.json'));
            
            execSync('npx tsc --noEmit', {
                cwd: this.repoPath,
                encoding: 'utf8',
                stdio: 'pipe'
            });

            return { passed: true, errors: 0 };
        } catch (error) {
            if (error.code === 'ENOENT') {
                // No TypeScript config
                return { passed: true, errors: 0, skipped: true };
            }
            
            const errorCount = (error.stdout || '').split('\n')
                .filter(line => line.includes('error TS')).length;

            return {
                passed: false,
                errors: errorCount,
                output: error.stdout
            };
        }
    }

    async runBuild() {
        try {
            // Check if build script exists
            const packageJson = JSON.parse(
                await fs.readFile(path.join(this.repoPath, 'package.json'), 'utf8')
            );
            
            if (!packageJson.scripts?.build) {
                return { passed: true, skipped: true };
            }
            
            execSync('npm run build', {
                cwd: this.repoPath,
                encoding: 'utf8',
                stdio: 'pipe'
            });

            return { passed: true };
        } catch (error) {
            return {
                passed: false,
                error: error.message,
                output: error.stdout || error.stderr
            };
        }
    }

    compareWithBaseline(current) {
        if (!this.baseline) {
            return { noBaseline: true };
        }

        return {
            tests: this.compareTestResults(this.baseline.testResults, current.tests),
            lint: this.compareLintResults(this.baseline.lintResults, current.lint),
            types: this.compareTypeResults(this.baseline.typeResults, current.types),
            build: this.compareBuildResults(this.baseline.buildResults, current.build)
        };
    }

    compareTestResults(baseline, current) {
        return {
            regression: baseline.passed && !current.passed,
            improvement: !baseline.passed && current.passed,
            details: { baseline, current }
        };
    }

    compareLintResults(baseline, current) {
        return {
            regression: current.errors > baseline.errors,
            improvement: current.errors < baseline.errors,
            newErrors: current.errors - baseline.errors,
            newWarnings: current.warnings - baseline.warnings,
            details: { baseline, current }
        };
    }

    compareTypeResults(baseline, current) {
        if (baseline.skipped || current.skipped) {
            return { skipped: true };
        }
        
        return {
            regression: baseline.passed && !current.passed,
            improvement: !baseline.passed && current.passed,
            newErrors: (current.errors || 0) - (baseline.errors || 0),
            details: { baseline, current }
        };
    }

    compareBuildResults(baseline, current) {
        if (baseline.skipped || current.skipped) {
            return { skipped: true };
        }
        
        return {
            regression: baseline.passed && !current.passed,
            improvement: !baseline.passed && current.passed,
            details: { baseline, current }
        };
    }

    isFixValid(comparison) {
        // No regressions allowed
        const hasRegression = 
            comparison.tests?.regression ||
            comparison.lint?.regression ||
            comparison.types?.regression ||
            comparison.build?.regression;

        return !hasRegression;
    }
}

module.exports = Validator;