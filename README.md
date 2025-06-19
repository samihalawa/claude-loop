# claude-loop

AI-powered repository debugging tool using Claude CLI for systematic issue detection and autonomous fixing.

## Features

- 🤖 **Autonomous AI Agents**: Claude analyzes and fixes issues with full creative freedom
- 🔍 **Comprehensive Scanning**: Detects syntax, test, dependency, type, security, and performance issues
- ✅ **Smart Validation**: Every fix is validated to ensure no regressions
- 📊 **Real-time Monitoring**: Watch the debugging progress live
- 🚀 **Multi-language Support**: Works with JavaScript, TypeScript, Python, Go, Rust, and more

## Installation

```bash
npm install -g claude-loop
```

## Quick Start

```bash
# Scan your repository for issues
claude-loop scan

# Run full autonomous debugging
claude-loop debug

# Debug specific areas
claude-loop debug --focus tests
claude-loop debug --focus security

# Monitor debugging progress
claude-loop monitor
```

## How It Works

Unlike traditional linters or fixers, claude-loop gives Claude complete freedom to:

1. **Understand Context**: Claude reads your entire codebase to understand patterns and intentions
2. **Analyze Deeply**: Not just syntax - Claude understands what your code is trying to do
3. **Fix Creatively**: Claude can refactor, optimize, and improve - not just patch
4. **Validate Thoroughly**: Every fix is tested to ensure it actually improves your code

## Commands

### `claude-loop scan`
Analyzes your repository and generates a detailed issue report.

```bash
claude-loop scan
claude-loop scan --types syntax,tests  # Scan specific issue types
claude-loop scan --output report.json   # Custom output file
```

### `claude-loop debug`
Runs the full autonomous debugging cycle.

```bash
claude-loop debug                       # Interactive mode
claude-loop debug --no-interactive      # Skip confirmations
claude-loop debug --dry-run            # Preview fixes without applying
claude-loop debug --max-iterations 10   # More thorough debugging
```

### `claude-loop monitor`
Opens a real-time web interface to monitor debugging progress.

```bash
claude-loop monitor
claude-loop monitor --port 3000        # Custom port
```

## Configuration

Initialize a configuration file:

```bash
claude-loop init
```

This creates `.claude-loop.json`:

```json
{
  "claudeLoop": {
    "claudeCommand": "claude",
    "maxIterations": 5,
    "concurrentAgents": 3,
    "interactive": true
  }
}
```

## The Power of AI Freedom

Traditional tools follow rigid rules. claude-loop is different:

```javascript
// Traditional linter: "Missing semicolon"
const data = getData()

// Claude might see: "This async function should be awaited"
const data = await getData();

// Or even: "This could be streamed for better performance"
const dataStream = createDataStream();
for await (const chunk of dataStream) {
  process(chunk);
}
```

Claude doesn't just fix syntax - it understands intent and improves your code.

## Example Session

```bash
$ claude-loop debug

🤖 Claude Loop - AI-Powered Repository Debugger

🔍 Scanning repository for issues...
✓ Scan complete!

Issue Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ● syntax: 12 issues
  ● tests: 23 issues  
  ● types: 8 issues
  ● security: 2 issues
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total: 45 issues found

Found 45 issues. Run automated fixing? (Y/n) y

Iteration 1/5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Launching 3 debug agents...
✓ Collected 38 proposed fixes
✓ 35/38 fixes validated
✓ Applied 35 fixes

🔄 Re-scanning repository...
  Issues remaining: 10 (35 fixed this iteration)
```

## Advanced Usage

### Focus on Specific Areas

```bash
# Focus on test failures
claude-loop debug --focus tests

# Fix only security issues
claude-loop debug --focus security

# Target specific files
claude-loop debug --path "src/**/*.js"
```

### CI/CD Integration

```yaml
# .github/workflows/debug.yml
name: AI Debug
on: [push]
jobs:
  debug:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install -g claude-loop
      - run: claude-loop scan --output=debug-report.json
      - run: claude-loop debug --no-interactive --dry-run
```

## Requirements

- Node.js 14+
- Claude CLI (`claude` command available)
- Repository with standard project structure

## Supported Languages

- JavaScript/TypeScript (ESLint, Jest, npm)
- Python (Pylint, pytest, pip)
- Go (go vet, go test)
- Rust (cargo clippy, cargo test)
- More coming soon!

## License

MIT

## Contributing

Contributions welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

## Support

- Issues: [GitHub Issues](https://github.com/samihalawa/claude-loop/issues)
- Discussions: [GitHub Discussions](https://github.com/samihalawa/claude-loop/discussions)