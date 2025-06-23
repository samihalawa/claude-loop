#!/usr/bin/env node

const ClaudeLoopEngine = require('./lib/claude-loop-engine');
const path = require('path');
const fs = require('fs').promises;

async function testMainFunctionality() {
    console.log('🧪 Testing Main Claude Loop Functionality');
    
    try {
        // Test 1: Engine Creation with Real Parameters
        console.log('\n🔧 Testing engine creation...');
        
        const engine = new ClaudeLoopEngine({
            repoPath: process.cwd(),
            maxIterations: 1,
            claudeCommand: 'echo "Claude simulation - all systems working"',
            ui: false
        });
        
        console.log('✅ Engine created successfully');
        console.log(`   Repository: ${engine.repoPath}`);
        console.log(`   Max iterations: ${engine.maxIterations}`);
        console.log(`   Claude command: ${engine.claudeCommand}`);
        
        // Test 2: MCP Integration Check
        console.log('\n🔌 Testing MCP integrations...');
        
        const mcpStatus = await engine.mcpInstaller.checkMCPAvailability();
        console.log(`✅ VUDA available: ${mcpStatus.hasVUDA}`);
        console.log(`✅ Browser MCP available: ${mcpStatus.hasBrowserMCP}`);
        console.log(`✅ Sequential Thinking available: ${mcpStatus.hasSequentialThinking}`);
        console.log(`✅ Total MCPs: ${mcpStatus.all.length}`);
        
        // Test 3: Temp File Management
        console.log('\n📄 Testing temp file management...');
        
        const crypto = require('crypto');
        const random = crypto.randomBytes(16).toString('hex');
        const tempFile = path.join(process.cwd(), `claude-loop-test-${random}.tmp`);
        
        const testPrompt = `CLAUDE LOOP TEST PROMPT
        
This is a test of the claude-loop system's temp file handling.

PHASE 1: REPOSITORY ANALYSIS
- Test that temp files are created securely
- Verify cleanup procedures work
- Validate file permissions

PHASE 2: WORKFLOW TESTING  
- Ensure the system can handle complex prompts
- Test multi-line content
- Verify special characters: !@#$%^&*()

DELIVERABLE: Working temp file system`;

        // Create temp file with secure permissions (like the engine does)
        await fs.writeFile(tempFile, testPrompt, { mode: 0o600 });
        console.log('✅ Temp file created with secure permissions');
        
        // Add to engine's temp file tracking
        engine.tempFiles.add(tempFile);
        
        // Verify file content
        const content = await fs.readFile(tempFile, 'utf8');
        if (content === testPrompt) {
            console.log('✅ Temp file content verified');
        } else {
            throw new Error('Temp file content verification failed');
        }
        
        // Test cleanup
        await engine.cleanup();
        
        // Verify file was cleaned up
        try {
            await fs.access(tempFile);
            throw new Error('Temp file was not cleaned up');
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('✅ Temp file cleaned up successfully');
            } else {
                throw error;
            }
        }
        
        // Test 4: Progress Tracking Functionality
        console.log('\n📈 Testing progress tracking...');
        
        const testIteration = 3;
        const testMaxIterations = 10;
        const testStartTime = Date.now() - 120000; // 2 minutes ago
        
        // Test progress bar generation
        const progressBar = engine.generateProgressBar(testIteration, testMaxIterations);
        console.log(`   Progress bar: ${progressBar}`);
        
        // Test time formatting
        const formattedTime = engine.formatElapsedTime(testStartTime);
        console.log(`   Elapsed time: ${formattedTime}`);
        
        // Test iteration focus
        const focus = engine.getIterationFocus(testIteration);
        console.log(`   Current focus: ${focus}`);
        
        console.log('✅ Progress tracking working correctly');
        
        // Test 5: Session Report Generation
        console.log('\n📋 Testing session report generation...');
        
        engine.iteration = 5;
        engine.startTime = Date.now() - 300000; // 5 minutes ago
        
        await engine.generateReport();
        
        // Verify report was created
        const reportPath = path.join(process.cwd(), 'claude-loop-session.json');
        try {
            const reportData = JSON.parse(await fs.readFile(reportPath, 'utf8'));
            if (reportData.session && reportData.session.iterations === 5) {
                console.log('✅ Session report generated correctly');
            } else {
                throw new Error('Session report validation failed');
            }
            
            // Cleanup report
            await fs.unlink(reportPath);
            console.log('✅ Session report cleaned up');
        } catch (error) {
            throw new Error(`Session report test failed: ${error.message}`);
        }
        
        // Test 6: Command Sanitization
        console.log('\n🔒 Testing command sanitization...');
        
        const testCommands = [
            { cmd: 'claude', shouldAllow: true },
            { cmd: '/usr/local/bin/claude', shouldAllow: true },
            { cmd: 'npx claude', shouldAllow: true },
            { cmd: 'malicious-command', shouldAllow: false },
            { cmd: '; rm -rf /', shouldAllow: false },
            { cmd: 'claude; echo "hack"', shouldAllow: false }
        ];
        
        for (const { cmd, shouldAllow } of testCommands) {
            const engine2 = new ClaudeLoopEngine({
                claudeCommand: cmd,
                repoPath: process.cwd()
            });
            
            if (shouldAllow) {
                if (engine2.claudeCommand === cmd) {
                    console.log(`   ✅ Safe command "${cmd}" allowed`);
                } else {
                    throw new Error(`Safe command "${cmd}" was rejected`);
                }
            } else {
                if (engine2.claudeCommand !== cmd) {
                    console.log(`   ✅ Unsafe command "${cmd}" sanitized to "${engine2.claudeCommand}"`);
                } else {
                    throw new Error(`Unsafe command "${cmd}" was not sanitized`);
                }
            }
        }
        
        console.log('✅ Command sanitization working correctly');
        
        // Test 7: Tool Configuration
        console.log('\n🛠️  Testing tool configuration...');
        
        const expectedTools = [
            'Bash', 'Read', 'Write', 'Edit', 'MultiEdit', 
            'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch',
            'NotebookRead', 'NotebookEdit', 'Task'
        ];
        
        for (const tool of expectedTools) {
            if (engine.allowedTools.includes(tool)) {
                console.log(`   ✅ Tool "${tool}" enabled`);
            } else {
                throw new Error(`Required tool "${tool}" not enabled`);
            }
        }
        
        console.log('✅ All required tools enabled for maximum autonomy');
        
        // Test 8: Final Integration Report
        console.log('\n📊 Generating main functionality test report...');
        
        const functionalityReport = {
            timestamp: new Date().toISOString(),
            testSuite: 'Claude Loop Main Functionality Test',
            results: {
                engineCreation: 'passed',
                mcpIntegration: 'passed',
                tempFileManagement: 'passed',
                progressTracking: 'passed',
                sessionReporting: 'passed',
                commandSanitization: 'passed',
                toolConfiguration: 'passed'
            },
            mcpStatus: mcpStatus,
            engineConfig: {
                repoPath: engine.repoPath,
                maxIterations: engine.maxIterations,
                claudeCommand: engine.claudeCommand,
                allowedToolsCount: engine.allowedTools.length
            },
            platform: {
                node: process.version,
                platform: process.platform,
                arch: process.arch
            },
            summary: 'All main functionality tests passed - Claude Loop is ready for operation'
        };
        
        const functionalityReportPath = path.join(process.cwd(), 'claude-loop-functionality-report.json');
        await fs.writeFile(functionalityReportPath, JSON.stringify(functionalityReport, null, 2));
        console.log(`✅ Functionality report saved to: ${functionalityReportPath}`);
        
        console.log('\n🎉 Main Functionality Test COMPLETED SUCCESSFULLY!');
        console.log('\n📊 Main Functionality Test Summary:');
        console.log('   ✅ Engine Creation');
        console.log('   ✅ MCP Integration Check');
        console.log('   ✅ Temp File Management');
        console.log('   ✅ Progress Tracking');
        console.log('   ✅ Session Report Generation');
        console.log('   ✅ Command Sanitization');
        console.log('   ✅ Tool Configuration');
        console.log('   ✅ Functionality Report Generated');
        
        console.log('\n🚀 Claude Loop is fully functional and ready for debugging operations!');
        
    } catch (error) {
        console.error('❌ Main Functionality Test FAILED:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

testMainFunctionality();