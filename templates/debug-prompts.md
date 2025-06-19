# Claude Loop Debug Prompts

## Main Loop Prompt (Based on Your Style)

```
systematically debug and fix this repository so all functionality works as expected without adding complexity and leveraging existing logic

Update Todos:
  ⎿  ☐ Analyze current application structure and identify all components
     ☐ Identify and fix all broken button handlers and workflows
     ☐ Audit all links and routes for missing or broken connections
     ☐ Test all UI components for visual and functional issues
     ☐ Ensure all database operations work correctly
     ☐ Fix any permission or authentication issues
     ☐ Verify all sections display correctly with proper styling
```

## Specialized Agent Prompts

### 1. Button & Workflow Debug Agent
```
You are debugging button functionality and workflows.

Focus on:
- Finding all onClick handlers that don't work
- Tracing button actions to their implementations
- Identifying missing or broken workflows
- Fixing handleCreateProduction-style function issues
- Ensuring all user interactions have proper responses

Common issues to look for:
- Missing event handlers
- Incorrect function bindings
- Broken promise chains
- Missing route definitions
- Database constraint violations
```

### 2. Route & Navigation Debug Agent
```
You are auditing links and navigation.

Tasks:
- Systematically check all Link components and href attributes
- Identify routes that lead to 404s
- Find buttons linking to non-existent pages
- Verify all navigation flows work end-to-end
- Check for missing route definitions

Pattern to follow:
1. List all routes defined in the application
2. List all links/buttons that navigate
3. Cross-reference to find mismatches
4. Fix broken connections
```

### 3. UI Component Debug Agent
```
You are testing visual and functional UI issues.

Check each component for:
- Visual rendering problems
- Language switching functionality
- Responsive design issues
- Component state management
- Data display correctness

Sections to test systematically:
- banco-vocabulario functionality
- listas-vocabulario display
- produccion workflows
- All form submissions
- Modal and dialog behaviors
```

### 4. Database & Backend Debug Agent
```
You are fixing backend and database issues.

Focus areas:
- Database constraint violations
- Missing migrations or schema issues
- API endpoint failures
- Data validation problems
- Permission and authentication errors

Approach:
1. Test each database operation
2. Verify constraints are satisfied
3. Check API responses
4. Ensure proper error handling
```

## Your Specific Debug Patterns

Based on your history, here are the patterns claude-loop follows:

### 1. Systematic Functionality Audit
```javascript
// The scanner looks for these patterns you often debug:
const functionalityPatterns = [
  // Button handlers
  { pattern: /onClick=\{[^}]*undefined[^}]*\}/, type: 'undefined_handler' },
  { pattern: /onClick=\{[^}]*\}/, check: 'handler_exists' },
  
  // Routes
  { pattern: /href=["'][^"']+["']/, check: 'route_exists' },
  { pattern: /navigate\(['"]([^'"]+)['"]\)/, check: 'route_exists' },
  
  // Database operations
  { pattern: /\.create\(/, check: 'constraint_validation' },
  { pattern: /\.findOne\(/, check: 'error_handling' }
];
```

### 2. Visual Debug Integration
```javascript
// When you need visual debugging (like with visual-ui-debug-agent-mcp):
class VisualDebugAgent {
  async debugUI(component) {
    // Take screenshot
    // Analyze layout issues
    // Check responsive behavior
    // Verify styling consistency
    // Test interactions visually
  }
}
```

### 3. Workflow Testing Pattern
```javascript
// Your typical workflow testing approach:
async function testWorkflow(workflowName) {
  const steps = [
    'Check initial state',
    'Trigger action (click button)',
    'Verify state change',
    'Check database update',
    'Verify UI feedback',
    'Test error cases'
  ];
  
  for (const step of steps) {
    await validateStep(step);
  }
}
```

## Example Debug Session (Your Style)

```bash
$ claude-loop debug --focus workflows

🤖 Claude Loop - Debugging Repository

📋 Creating todo list based on your patterns:
  ⎿  ☐ Analyze handleCreateProduction and similar handlers
     ☐ Audit all button onClick implementations  
     ☐ Check all Link hrefs and route definitions
     ☐ Test banco-vocabulario functionality
     ☐ Verify listas-vocabulario display
     ☐ Test language switching
     ☐ Fix database constraint issues

🔍 Scanning for issues...
  Found 15 undefined button handlers
  Found 8 broken routes
  Found 3 database constraint violations

🤖 Launching specialized agents...
  Agent #1 (workflows): Fixing button handlers
  Agent #2 (routes): Fixing navigation
  Agent #3 (database): Fixing constraints

[Agents work autonomously to fix issues]

✅ Fixed Issues:
  ✓ handleCreateProduction now properly handles async operations
  ✓ All buttons now have working onClick handlers
  ✓ Routes /vocabulary/* now properly defined
  ✓ Database constraints satisfied for all operations
```

## Integration with Your Tools

### Visual UI Debug Agent Pattern
```javascript
// If visual-ui-debug-agent-mcp is available:
if (hasVisualDebugger()) {
  await visualDebugger.screenshot(component);
  await visualDebugger.analyzeLayout();
  await visualDebugger.testInteractions();
}
```

### MCP Server Integration
```javascript
// For your MCP server debugging:
const mcpConfig = {
  "visual-ui-debug": {
    "command": "visual-ui-debug-agent-mcp",
    "args": ["--gateway", "cloudflare"],
    "env": { "BYPASS_PERMISSIONS": "true" }
  }
};
```

## Your Common Debug Commands

Based on your patterns, claude-loop would execute:

```bash
# Your typical debugging flow:
claude-loop scan --types workflows,routes,ui
claude-loop debug --focus "button handlers"
claude-loop debug --focus "broken routes"
claude-loop debug --focus "database constraints"

# With visual debugging:
claude-loop debug --with-visual --mcp-server visual-ui-debug
```

## Key Principles (From Your Approach)

1. **Systematic**: Test every button, every route, every workflow
2. **Functional Focus**: Make things work before optimizing
3. **Leverage Existing**: Use existing logic rather than rewriting
4. **Visual Verification**: See that UI components render correctly
5. **End-to-End**: Test complete workflows, not just units

This aligns with your debugging style of systematically finding and fixing all broken functionality!