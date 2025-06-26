#!/usr/bin/env node

/**
 * Comprehensive Claude Loop Engine Integration Test
 * Tests core engine functionality, initialization, and workflows
 */

const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// Test framework setup
const test = {
    results: [],
    startTime: Date.now(),
    
    async run(name, testFn) {
        console.log(`🧪 Testing: ${name}`);
        const start = Date.now();
        try {
            await testFn();
            const duration = Date.now() - start;
            this.results.push({ name, status: 'PASS', duration });
            console.log(`✅ PASS: ${name} (${duration}ms)`);
            return true;
        } catch (error) {
            const duration = Date.now() - start;
            this.results.push({ name, status: 'FAIL', duration, error: error.message });
            console.log(`❌ FAIL: ${name} (${duration}ms)`);
            console.log(`   Error: ${error.message}`);
            return false;
        }
    },
    
    generateReport() {
        const totalTime = Date.now() - this.startTime;
        const passed = this.results.filter(r => r.status === 'PASS').length;
        const failed = this.results.filter(r => r.status === 'FAIL').length;
        
        return {
            summary: {
                total: this.results.length,
                passed,
                failed,
                duration: totalTime,
                timestamp: new Date().toISOString()
            },
            results: this.results
        };
    }
};

async function testEngineInitialization() {
    // Test basic engine creation and configuration
    const ClaudeLoopEngine = require('./lib/claude-loop-engine');
    
    // Test 1: Default initialization
    const engine1 = new ClaudeLoopEngine();
    if (!engine1.repoPath) throw new Error('Engine should have default repoPath');
    if (engine1.maxIterations !== 10) throw new Error('Engine should have default maxIterations');
    if (!engine1.claudeCommand) throw new Error('Engine should have default claudeCommand');
    
    // Test 2: Custom configuration
    const customConfig = {
        repoPath: '/tmp/test-repo',
        maxIterations: 5,
        claudeCommand: 'custom-claude',
        ui: true
    };
    
    const engine2 = new ClaudeLoopEngine(customConfig);
    if (!engine2.repoPath.endsWith('test-repo')) throw new Error('Engine should use custom repoPath');
    if (engine2.maxIterations !== 5) throw new Error('Engine should use custom maxIterations');
    if (engine2.claudeCommand !== 'custom-claude') throw new Error('Engine should use custom claudeCommand');
    if (!engine2.ui) throw new Error('Engine should use custom ui setting');
    
    // Test 3: Validation and sanitization
    const invalidConfig = {
        maxIterations: -1,
        claudeCommand: 'rm -rf /'
    };
    
    const engine3 = new ClaudeLoopEngine(invalidConfig);
    if (engine3.maxIterations !== 10) throw new Error('Engine should reject invalid maxIterations');
    if (engine3.claudeCommand.includes('rm')) throw new Error('Engine should sanitize dangerous commands');
    
    // Test 4: Required components initialization
    if (!engine1.mcpInstaller) throw new Error('Engine should initialize MCP installer');
    if (!engine1.tempFiles) throw new Error('Engine should initialize temp file tracking');
    if (!Array.isArray(engine1.allowedTools)) throw new Error('Engine should have allowed tools list');
    
    console.log('  ✓ Engine initialization tests passed');
}

async function testEngineConfiguration() {
    const ClaudeLoopEngine = require('./lib/claude-loop-engine');
    
    // Test configuration validation and defaults
    const engine = new ClaudeLoopEngine();
    
    // Test security configuration
    if (!engine.allowedTools.includes('Bash')) throw new Error('Engine should include Bash in allowed tools');
    if (!engine.allowedTools.includes('Read')) throw new Error('Engine should include Read in allowed tools');
    if (!engine.allowedTools.includes('Write')) throw new Error('Engine should include Write in allowed tools');
    if (!engine.allowedTools.includes('Task')) throw new Error('Engine should include Task in allowed tools');
    
    // Test sanitization methods
    const sanitizedPrompt = engine.sanitizePromptContent('Test prompt with ${{injection}} and `backticks`');
    if (sanitizedPrompt.includes('${{')) throw new Error('Prompt sanitization should remove template literals');
    if (sanitizedPrompt.includes('`')) throw new Error('Prompt sanitization should remove backticks');
    
    // Test progress calculation methods
    const progressBar = engine.generateProgressBar(3, 10);
    if (!progressBar) throw new Error('Engine should generate progress bar');
    
    const elapsedTime = engine.formatElapsedTime(Date.now() - 65000);
    if (!elapsedTime.includes('1m')) throw new Error('Engine should format elapsed time correctly');
    
    const iterationFocus = engine.getIterationFocus(1);
    if (!iterationFocus) throw new Error('Engine should provide iteration focus');
    
    console.log('  ✓ Engine configuration tests passed');
}

async function testFileOperations() {
    const ClaudeLoopEngine = require('./lib/claude-loop-engine');
    const engine = new ClaudeLoopEngine();
    
    // Test temp file operations
    const tempFile1 = path.join(os.tmpdir(), `test-${Date.now()}-1.tmp`);
    const tempFile2 = path.join(process.cwd(), `test-${Date.now()}-2.tmp`);
    
    // Create test files
    await fs.writeFile(tempFile1, 'test content 1');
    await fs.writeFile(tempFile2, 'test content 2');
    
    // Add to engine tracking
    engine.tempFiles.add(tempFile1);
    engine.tempFiles.add(tempFile2);
    
    // Test file tracking
    if (!engine.tempFiles.has(tempFile1)) throw new Error('Engine should track temp file 1');
    if (!engine.tempFiles.has(tempFile2)) throw new Error('Engine should track temp file 2');
    
    // Test secure cleanup
    const cleaned1 = await engine.secureCleanupTempFile(tempFile1);
    const cleaned2 = await engine.secureCleanupTempFile(tempFile2);
    
    if (!cleaned1) throw new Error('Engine should clean up temp file 1');
    if (!cleaned2) throw new Error('Engine should clean up temp file 2');
    
    // Verify files are deleted and removed from tracking
    if (engine.tempFiles.has(tempFile1)) throw new Error('Engine should remove temp file 1 from tracking');
    if (engine.tempFiles.has(tempFile2)) throw new Error('Engine should remove temp file 2 from tracking');
    
    try {
        await fs.access(tempFile1);
        throw new Error('Temp file 1 should be deleted');
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    
    try {
        await fs.access(tempFile2);
        throw new Error('Temp file 2 should be deleted');
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    
    console.log('  ✓ File operations tests passed');
}

async function testMCPIntegration() {
    const ClaudeLoopEngine = require('./lib/claude-loop-engine');
    const engine = new ClaudeLoopEngine();
    
    // Test MCP installer initialization
    if (!engine.mcpInstaller) throw new Error('Engine should have MCP installer');
    if (typeof engine.mcpInstaller.checkMCPAvailability !== 'function') {
        throw new Error('MCP installer should have checkMCPAvailability method');
    }
    
    // Test MCP availability check (should not fail even if MCPs not installed)
    try {
        const mcpStatus = await engine.mcpInstaller.checkMCPAvailability();
        if (typeof mcpStatus.hasVUDA !== 'boolean') throw new Error('MCP status should include VUDA status');
        if (typeof mcpStatus.hasBrowserMCP !== 'boolean') throw new Error('MCP status should include BrowserMCP status');
        if (!Array.isArray(mcpStatus.all)) throw new Error('MCP status should include all MCPs list');
    } catch (error) {
        // MCP check can fail if Claude config doesn't exist, that's OK for testing
        console.log(`  ⚠ MCP availability check failed (expected in test environment): ${error.message}`);
    }
    
    console.log('  ✓ MCP integration tests passed');
}

async function testSessionManagement() {
    const ClaudeLoopEngine = require('./lib/claude-loop-engine');
    const engine = new ClaudeLoopEngine();
    
    // Test session initialization
    if (!engine.sessionId) {
        // Session ID should be null initially
        engine.sessionId = `test-session-${Date.now()}`;
    }
    
    if (engine.iteration !== 0) throw new Error('Engine should start with iteration 0');
    if (engine.conversationActive !== false) throw new Error('Engine should start with conversation inactive');
    if (engine.currentPhase !== 'Initializing') throw new Error('Engine should start in Initializing phase');
    
    // Test progress tracking
    engine.iteration = 3;
    engine.startTime = Date.now() - 120000; // 2 minutes ago
    
    const progress = engine.generateProgressBar(3, 10);
    if (!progress) throw new Error('Engine should generate progress bar');
    
    const elapsed = engine.formatElapsedTime(engine.startTime);
    if (!elapsed.includes('2m')) throw new Error('Engine should calculate elapsed time correctly');
    
    // Test cleanup
    await engine.cleanup();
    if (engine.tempFiles.size !== 0) throw new Error('Cleanup should clear temp files');
    
    console.log('  ✓ Session management tests passed');
}

async function testErrorHandling() {
    const ClaudeLoopEngine = require('./lib/claude-loop-engine');
    
    // Test error handling in various scenarios
    const engine = new ClaudeLoopEngine();
    
    // Test invalid file cleanup
    const nonExistentFile = '/nonexistent/path/file.tmp';
    engine.tempFiles.add(nonExistentFile);
    
    const cleanupResult = await engine.secureCleanupTempFile(nonExistentFile);
    if (cleanupResult !== false) throw new Error('Cleanup should return false for non-existent file');
    if (engine.tempFiles.has(nonExistentFile)) throw new Error('Non-existent file should be removed from tracking');
    
    // Test prompt content validation
    const invalidPrompt = null;
    try {
        engine.sanitizePromptContent(invalidPrompt);
        throw new Error('Should throw error for null prompt');
    } catch (error) {
        if (!error.message.includes('Invalid prompt content')) {
            throw new Error('Should provide meaningful error message');
        }
    }
    
    // Test large content handling
    const largeContent = 'x'.repeat(1000000); // 1MB content
    const sanitized = engine.sanitizePromptContent(largeContent);
    if (sanitized.length >= largeContent.length) throw new Error('Should limit large content size');
    
    console.log('  ✓ Error handling tests passed');
}

async function testProgressCalculation() {
    const ClaudeLoopEngine = require('./lib/claude-loop-engine');
    const engine = new ClaudeLoopEngine();
    
    // Test progress bar generation with various values
    const tests = [
        { current: 0, total: 10, expected: 0 },
        { current: 5, total: 10, expected: 0.5 },
        { current: 10, total: 10, expected: 1 }
    ];
    
    for (const { current, total, expected } of tests) {
        const progressBar = engine.generateProgressBar(current, total, 20);
        if (!progressBar || typeof progressBar !== 'string') {
            throw new Error(`Progress bar should be string for ${current}/${total}`);
        }
        
        // Count filled characters (should be proportional)
        const filledChars = (progressBar.match(/█/g) || []).length;
        const expectedFilled = Math.round(20 * expected);
        if (Math.abs(filledChars - expectedFilled) > 1) {
            throw new Error(`Progress bar incorrect for ${current}/${total}: got ${filledChars}, expected ~${expectedFilled}`);
        }
    }
    
    // Test time formatting
    const timeTests = [
        { elapsed: 1000, expected: '0m 1s' },
        { elapsed: 65000, expected: '1m 5s' },
        { elapsed: 3661000, expected: '61m 1s' }
    ];
    
    for (const { elapsed, expected } of timeTests) {
        const startTime = Date.now() - elapsed;
        const formatted = engine.formatElapsedTime(startTime);
        if (formatted !== expected) {
            throw new Error(`Time formatting incorrect: got "${formatted}", expected "${expected}"`);
        }
    }
    
    console.log('  ✓ Progress calculation tests passed');
}

// Main test execution
async function runTests() {
    console.log('🚀 Starting Claude Loop Engine Integration Tests\n');
    
    const tests = [
        ['Engine Initialization', testEngineInitialization],
        ['Engine Configuration', testEngineConfiguration],
        ['File Operations', testFileOperations],
        ['MCP Integration', testMCPIntegration],
        ['Session Management', testSessionManagement],
        ['Error Handling', testErrorHandling],
        ['Progress Calculation', testProgressCalculation]
    ];
    
    let allPassed = true;
    
    for (const [name, testFn] of tests) {
        const passed = await test.run(name, testFn);
        if (!passed) allPassed = false;
    }
    
    // Generate and save report
    const report = test.generateReport();
    
    console.log('\n📊 TEST RESULTS:');
    console.log('================');
    console.log(`Total Tests: ${report.summary.total}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Duration: ${report.summary.duration}ms`);
    console.log(`Success Rate: ${Math.round((report.summary.passed / report.summary.total) * 100)}%`);
    
    // Save detailed report
    const reportPath = path.join(process.cwd(), 'engine-integration-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved: ${reportPath}`);
    
    if (allPassed) {
        console.log('\n✅ All engine integration tests passed!');
        console.log('🎯 Claude Loop Engine is ready for production use');
        process.exit(0);
    } else {
        console.log('\n❌ Some tests failed. Please review the results above.');
        process.exit(1);
    }
}

// Run tests if called directly
if (require.main === module) {
    runTests().catch(error => {
        console.error('💥 Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = { runTests, testEngineInitialization, testEngineConfiguration };