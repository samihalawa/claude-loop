# Debug Repository Command

Systematically debug and fix this repository using multi-agent orchestration until all code works correctly.

## Main Orchestrator Loop

```
INITIALIZE:
- Scan entire repository structure
- Identify all file types and frameworks
- Detect testing framework and commands
- Create initial issue inventory

WHILE issues_exist AND context_available:
    PHASE 1 - DISCOVERY:
        - Run syntax checkers
        - Execute test suites
        - Analyze dependencies
        - Check for security issues
        - Identify performance problems
    
    PHASE 2 - PRIORITIZATION:
        - Critical: Blocks execution
        - High: Breaks functionality
        - Medium: Degrades quality
        - Low: Minor improvements
    
    PHASE 3 - AGENT ASSIGNMENT:
        - Assign specialized agents to issue categories
        - Group related issues for efficiency
        - Set fix constraints and validation rules
    
    PHASE 4 - PARALLEL EXECUTION:
        - Launch debug agents in waves
        - Monitor progress in real-time
        - Collect proposed fixes
    
    PHASE 5 - VALIDATION:
        - Test each fix in isolation
        - Run integration tests
        - Check for regression
    
    PHASE 6 - APPLICATION:
        - Apply validated fixes
        - Update issue inventory
        - Generate progress report

FINALIZE:
- Run full test suite
- Generate final report
- Commit all fixes (if requested)
```

## Debug Agent Templates

### Syntax Debug Agent
```
You are Syntax Debug Agent #{n}.

Issues to fix:
{syntax_errors}

Requirements:
- Fix syntax errors minimally
- Preserve code intent
- Maintain style consistency
- Validate with: {lint_command}
```

### Test Debug Agent
```
You are Test Debug Agent #{n}.

Failing tests:
{test_failures}

Requirements:
- Fix failing tests
- Don't break passing tests
- Add missing test cases
- Validate with: {test_command}
```

### Dependency Debug Agent
```
You are Dependency Debug Agent #{n}.

Dependency issues:
{dependency_problems}

Requirements:
- Resolve version conflicts
- Update deprecated packages
- Fix missing dependencies
- Validate with: {install_command}
```

## Usage

```bash
claude debug
```

This will:
1. Scan repository for all issues
2. Create prioritized fix plan
3. Deploy specialized agents
4. Fix issues systematically
5. Validate all changes
6. Report results

## Progress Tracking Format

```
Debug Progress:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DISCOVERED ISSUES:
✗ Syntax Errors: 12
✗ Failing Tests: 23/145  
✗ Type Errors: 8
✗ Missing Dependencies: 3
✗ Security Vulnerabilities: 2

CURRENT ACTIVITY:
→ Agent #1: Fixing syntax in src/utils.js
→ Agent #2: Resolving test failure in auth.test.js
→ Agent #3: Updating deprecated lodash usage

COMPLETED:
✓ Fixed import errors (5/5)
✓ Resolved ESLint violations (28/28)
✓ Updated package.json dependencies

NEXT WAVE:
• Fix remaining test failures
• Resolve type mismatches
• Address security issues

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Progress: ████████░░░░░░░ 52% (47/91 issues fixed)
```

## Validation Checklist

Each fix must pass:
- [ ] Syntax validation
- [ ] Unit tests
- [ ] Integration tests  
- [ ] No new issues introduced
- [ ] Performance not degraded
- [ ] Security not compromised

## Configuration

The debug command adapts to repository type:
- **JavaScript/TypeScript**: ESLint, Jest, npm/yarn
- **Python**: pylint, pytest, pip
- **Go**: go fmt, go test, go mod
- **Rust**: cargo fmt, cargo test, cargo

## Advanced Options

```bash
# Debug specific areas
claude debug --focus=tests
claude debug --focus=security
claude debug --focus=performance

# Limit scope
claude debug --files="src/**/*.js"
claude debug --exclude="node_modules,dist"

# Validation levels
claude debug --strict  # All tests must pass
claude debug --quick   # Fix critical issues only
```