# Workflow & Button Debug Prompt

You are debugging a web application with a focus on making all functionality work correctly.

## Your Mission

Based on the user's typical debugging approach:

```
"systematically debug and fix this repository so all buttons and views and functionality works in a way that is expected without adding complexity and leveraging when possible on existing logic"
```

## Priority Areas (From User's History)

### 1. Button Handler Issues
- Find all buttons with undefined or broken onClick handlers
- Fix handleCreateProduction-style async function issues  
- Ensure all buttons trigger their intended actions
- Verify promise chains complete successfully

### 2. Route & Navigation Audit
- Audit all Link components for broken hrefs
- Find buttons that navigate to non-existent pages
- Verify all routes are properly defined
- Fix 404 errors and missing routes

### 3. UI Component Testing
- Test sections like:
  - banco-vocabulario
  - listas-vocabulario  
  - produccion workflows
- Verify language switching functionality
- Ensure all sections display correctly
- Check responsive behavior

### 4. Database & Constraints
- Fix database constraint violations
- Ensure all create/update operations validate
- Handle errors gracefully
- Verify data persistence

## Debugging Approach

1. **Scan Systematically**
   ```javascript
   // Find all interactive elements
   const buttons = findAll('button[onClick]');
   const links = findAll('a[href], Link[to]');
   const forms = findAll('form[onSubmit]');
   ```

2. **Test Each Workflow**
   ```javascript
   // For each major workflow:
   - Initial state
   - User action (click/submit)
   - Expected behavior
   - Database changes
   - UI feedback
   ```

3. **Fix Using Existing Logic**
   - Don't rewrite - fix what's there
   - Leverage existing patterns
   - Maintain consistency

## Common Issues to Fix

### Undefined Handlers
```javascript
// Before:
<button onClick={undefined}>Create</button>

// After:
<button onClick={handleCreate}>Create</button>
```

### Broken Routes
```javascript
// Before:
<Link href="/vocabulario/list">View Lists</Link> // 404

// After:
<Link href="/vocabulary/lists">View Lists</Link> // Works
```

### Async Handler Issues
```javascript
// Before:
const handleCreateProduction = () => {
  createProduction(data); // Doesn't wait
  navigate('/success'); // Navigates too early
}

// After:
const handleCreateProduction = async () => {
  try {
    await createProduction(data);
    navigate('/success');
  } catch (error) {
    showError(error.message);
  }
}
```

### Database Constraints
```javascript
// Before:
db.vocabularyItems.create({
  word: userInput // Might violate unique constraint
})

// After:
const existing = await db.vocabularyItems.findOne({ word: userInput });
if (!existing) {
  await db.vocabularyItems.create({ word: userInput });
} else {
  showError('Word already exists');
}
```

## Visual Testing Integration

If visual debugging is needed:
- Screenshot each major view
- Check layout consistency
- Verify responsive behavior
- Test interactive elements visually

## Output Your Fixes

For each issue found:

```json
{
  "issue": "Button 'Create Production' has undefined handler",
  "location": "src/components/Production.jsx:45",
  "fix": {
    "description": "Connected button to existing handleCreateProduction function",
    "changes": [{
      "original": "<button onClick={undefined}>",
      "replacement": "<button onClick={handleCreateProduction}>"
    }]
  },
  "tested": "Clicked button - successfully creates production and navigates"
}
```

Remember: The goal is to make everything WORK, not to make it perfect. Fix functionality first!