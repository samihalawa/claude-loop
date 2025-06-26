module.exports = {
    env: {
        node: true,
        es2021: true,
        jest: true
    },
    extends: [
        'eslint:recommended'
    ],
    parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module'
    },
    rules: {
        // Error prevention
        'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
        'no-console': 'error', // Enforce proper logging
        'no-debugger': 'error',
        'no-alert': 'error',
        
        // Code quality
        'prefer-const': 'error',
        'no-var': 'error',
        'object-shorthand': 'error',
        'prefer-template': 'error',
        
        // Security
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        'no-script-url': 'error',
        
        // Best practices
        'eqeqeq': ['error', 'always'],
        'curly': ['error', 'all'],
        'dot-notation': 'error',
        'no-throw-literal': 'error',
        'no-return-assign': 'error',
        'no-sequences': 'error',
        'no-unmodified-loop-condition': 'error',
        'no-unused-expressions': 'error',
        
        // Style (basic)
        'indent': ['error', 4, { 'SwitchCase': 1 }],
        'quotes': ['error', 'single', { 'avoidEscape': true }],
        'semi': ['error', 'always'],
        'comma-trailing': ['error', 'never'],
        'no-trailing-spaces': 'error',
        
        // Node.js specific
        'no-process-exit': 'warn',
        'no-process-env': 'off', // We use process.env for configuration
        'global-require': 'warn',
        'handle-callback-err': 'error'
    },
    globals: {
        'process': 'readonly',
        'Buffer': 'readonly',
        '__dirname': 'readonly',
        '__filename': 'readonly',
        'module': 'readonly',
        'require': 'readonly',
        'exports': 'readonly',
        'console': 'readonly'
    },
    overrides: [
        {
            files: ['test-*.js', '*.test.js', '**/__tests__/**/*.js'],
            rules: {
                'no-console': 'off' // Allow console.log in tests
            }
        }
    ]
};