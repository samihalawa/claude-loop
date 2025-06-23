#!/usr/bin/env node

const ClaudeLoopEngine = require('./lib/claude-loop-engine');

async function testSimpleWorkflow() {
    console.log('🧪 Testing Simple Debug Workflow');
    
    try {
        // Create a minimal test scenario
        console.log('📋 Creating test engine with minimal configuration...');
        const engine = new ClaudeLoopEngine({
            repoPath: process.cwd(),
            maxIterations: 1, // Just one iteration for testing
            claudeCommand: 'echo', // Use echo instead of actual claude for testing
            ui: false // Disable UI for simpler testing
        });
        
        console.log('✅ Engine created successfully');
        console.log(`   Repository: ${engine.repoPath}`);
        console.log(`   Max iterations: ${engine.maxIterations}`);
        console.log(`   Claude command: ${engine.claudeCommand}`);
        
        // Test temp file creation
        console.log('📄 Testing temp file creation...');
        const crypto = require('crypto');
        const path = require('path');
        const fs = require('fs').promises;
        
        const random = crypto.randomBytes(16).toString('hex');
        const tempFile = path.join(process.cwd(), `test-temp-${random}.tmp`);
        
        await fs.writeFile(tempFile, 'Test content', { mode: 0o600 });
        console.log('✅ Temp file created successfully');
        
        // Test cleanup
        await fs.unlink(tempFile);
        console.log('✅ Temp file cleanup successful');
        
        // Test session data structure
        console.log('📊 Testing session data persistence...');
        const sessionData = {
            session: {
                iterations: 1,
                duration: Date.now() - Date.now(),
                timestamp: new Date().toISOString()
            },
            note: 'Test session data'
        };
        
        const sessionFile = path.join(process.cwd(), 'test-session.json');
        await fs.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));
        console.log('✅ Session data created successfully');
        
        // Verify session data
        const readData = JSON.parse(await fs.readFile(sessionFile, 'utf8'));
        console.log('✅ Session data read successfully');
        
        // Cleanup test session file
        await fs.unlink(sessionFile);
        console.log('✅ Test session file cleanup successful');
        
        console.log('\n✅ Simple workflow test completed successfully');
        
    } catch (error) {
        console.error('❌ Simple workflow test failed:', error.message);
        process.exit(1);
    }
}

testSimpleWorkflow();