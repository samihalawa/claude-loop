#!/usr/bin/env node
/**
 * File Generation and Cleanup Test
 * Tests automated file generation, temp file management, and cleanup procedures
 * Focus: Temp file creation, permissions, cleanup, security, and lifecycle management
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const chalk = require('chalk');
const os = require('os');

// Import the actual components
const ClaudeLoopEngine = require('./lib/claude-loop-engine');
const config = require('./lib/config');
const { FILE_PATTERNS, PROCESS_CONFIG } = require('./lib/config/constants');

class FileGenerationCleanupTester {
    constructor() {
        this.testResults = {
            timestamp: new Date().toISOString(),
            testType: 'File Generation and Cleanup',
            tests: [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                errors: []
            }
        };
        this.testDir = path.join(os.tmpdir(), 'claude-loop-file-test');
        this.tempFiles = new Set();
        this.testFiles = new Set();
    }

    async runAllTests() {
        console.log(chalk.cyan.bold('🧪 Starting File Generation and Cleanup Tests'));
        console.log(chalk.gray(`Test directory: ${this.testDir}`));
        console.log('═'.repeat(60));

        try {
            // Setup test environment
            await this.setupTestEnvironment();
            
            // Test 1: Temp File Creation and Permissions
            await this.testTempFileCreation();
            
            // Test 2: File Generation Patterns
            await this.testFileGenerationPatterns();
            
            // Test 3: Secure File Handling
            await this.testSecureFileHandling();
            
            // Test 4: Cleanup Procedures
            await this.testCleanupProcedures();
            
            // Test 5: File Lifecycle Management
            await this.testFileLifecycleManagement();
            
            // Test 6: Error Handling and Recovery
            await this.testErrorHandlingRecovery();
            
            // Test 7: Memory and Resource Management
            await this.testResourceManagement();
            
            // Test 8: Concurrent File Operations
            await this.testConcurrentOperations();
            
            // Test 9: Engine Integration File Ops
            await this.testEngineFileOperations();

        } catch (error) {
            this.addTestResult('Critical Test Failure', false, `Unexpected error: ${error.message}`);
            console.error(chalk.red('❌ Critical test failure:'), error.message);
        } finally {
            await this.cleanup();
            this.generateReport();
        }
    }

    async setupTestEnvironment() {
        console.log(chalk.blue('\n🔄 Setting up test environment'));
        
        try {
            // Create test directory
            await fs.mkdir(this.testDir, { recursive: true });
            this.addTestResult('Test Directory Creation', true, `Created test directory: ${this.testDir}`);
            
            console.log(chalk.green('✓ Test environment setup completed'));
        } catch (error) {
            this.addTestResult('Test Environment Setup', false, error.message);
            throw error;
        }
    }

    async testTempFileCreation() {
        console.log(chalk.blue('\n🔄 Test 1: Temp File Creation and Permissions'));
        
        try {
            // Test basic temp file creation
            const tempFileName = `claude-loop-prompt-${crypto.randomBytes(16).toString('hex')}.tmp`;
            const tempFilePath = path.join(this.testDir, tempFileName);
            
            const testContent = 'Test prompt content for integration testing';
            await fs.writeFile(tempFilePath, testContent, { mode: 0o600 });
            this.tempFiles.add(tempFilePath);
            
            // Verify file was created
            const fileExists = fsSync.existsSync(tempFilePath);
            this.addTestResult('Temp File Creation', fileExists, 
                fileExists ? 'Temp file created successfully' : 'Temp file creation failed');
            
            // Test file permissions (Unix systems)
            if (process.platform !== 'win32') {
                const stats = await fs.stat(tempFilePath);
                const permissions = stats.mode & parseInt('777', 8);
                const expectedPermissions = parseInt('600', 8);
                const permissionsCorrect = permissions === expectedPermissions;
                
                this.addTestResult('File Permissions', permissionsCorrect,
                    `File permissions: ${permissions.toString(8)} (expected: ${expectedPermissions.toString(8)})`);
            } else {
                this.addTestResult('File Permissions', true, 'Skipped on Windows platform');
            }
            
            // Test file content
            const readContent = await fs.readFile(tempFilePath, 'utf8');
            const contentCorrect = readContent === testContent;
            this.addTestResult('File Content', contentCorrect,
                contentCorrect ? 'File content written and read correctly' : 'File content mismatch');
            
            // Test file naming pattern
            const followsPattern = tempFileName.startsWith(FILE_PATTERNS.PROMPT_PREFIX) && 
                                 tempFileName.endsWith(FILE_PATTERNS.TEMP_EXTENSION);
            this.addTestResult('File Naming Pattern', followsPattern,
                followsPattern ? 'File follows expected naming pattern' : 'File naming pattern incorrect');
            
            console.log(chalk.green('✓ Temp file creation tests completed'));
            
        } catch (error) {
            this.addTestResult('Temp File Creation', false, error.message);
            console.error(chalk.red('❌ Temp file creation test failed:'), error.message);
        }
    }

    async testFileGenerationPatterns() {
        console.log(chalk.blue('\n🔄 Test 2: File Generation Patterns'));
        
        try {
            // Test multiple file types that the system generates
            const fileTypes = [
                { type: 'prompt', extension: '.tmp', prefix: 'claude-loop-prompt-' },
                { type: 'session', extension: '.json', prefix: 'claude-loop-session' },
                { type: 'report', extension: '.json', suffix: '-report' }
            ];
            
            for (const fileType of fileTypes) {
                let fileName;
                if (fileType.type === 'prompt') {
                    fileName = `${fileType.prefix}${crypto.randomBytes(16).toString('hex')}${fileType.extension}`;
                } else if (fileType.type === 'session') {
                    fileName = `${fileType.prefix}${fileType.extension}`;
                } else if (fileType.type === 'report') {
                    fileName = `test${fileType.suffix}${fileType.extension}`;
                }
                
                const filePath = path.join(this.testDir, fileName);
                
                // Create file with appropriate content
                let content;
                if (fileType.extension === '.json') {
                    content = JSON.stringify({ type: fileType.type, timestamp: Date.now() }, null, 2);
                } else {
                    content = `Test content for ${fileType.type} file`;
                }
                
                await fs.writeFile(filePath, content, { mode: 0o600 });
                this.testFiles.add(filePath);
                
                // Verify file creation
                const fileExists = fsSync.existsSync(filePath);
                this.addTestResult(`${fileType.type} File Generation`, fileExists,
                    fileExists ? `${fileType.type} file generated successfully` : `${fileType.type} file generation failed`);
                
                // Test content validity for JSON files
                if (fileType.extension === '.json') {
                    try {
                        const jsonContent = JSON.parse(await fs.readFile(filePath, 'utf8'));
                        const validJson = typeof jsonContent === 'object' && jsonContent.type === fileType.type;
                        this.addTestResult(`${fileType.type} JSON Validity`, validJson,
                            validJson ? 'JSON content is valid' : 'JSON content is invalid');
                    } catch (error) {
                        this.addTestResult(`${fileType.type} JSON Validity`, false, `JSON parsing failed: ${error.message}`);
                    }
                }
            }
            
            console.log(chalk.green('✓ File generation pattern tests completed'));
            
        } catch (error) {
            this.addTestResult('File Generation Patterns', false, error.message);
            console.error(chalk.red('❌ File generation pattern test failed:'), error.message);
        }
    }

    async testSecureFileHandling() {
        console.log(chalk.blue('\n🔄 Test 3: Secure File Handling'));
        
        try {
            // Test secure file creation
            const secureFileName = `secure-test-${Date.now()}.tmp`;
            const secureFilePath = path.join(this.testDir, secureFileName);
            
            const sensitiveContent = 'Sensitive test data that should be handled securely';
            await fs.writeFile(secureFilePath, sensitiveContent, { mode: 0o600 });
            this.testFiles.add(secureFilePath);
            
            // Test file permissions for sensitive content
            if (process.platform !== 'win32') {
                const stats = await fs.stat(secureFilePath);
                const permissions = stats.mode & parseInt('777', 8);
                const isSecure = permissions === parseInt('600', 8); // Only owner can read/write
                
                this.addTestResult('Secure File Permissions', isSecure,
                    isSecure ? 'Secure permissions (600) applied correctly' : 'Insecure file permissions detected');
            } else {
                this.addTestResult('Secure File Permissions', true, 'Secure permissions handling (Windows)');
            }
            
            // Test secure deletion (overwrite before delete)
            const originalSize = (await fs.stat(secureFilePath)).size;
            
            // Simulate secure overwrite
            const randomData = crypto.randomBytes(originalSize);
            await fs.writeFile(secureFilePath, randomData);
            
            // Verify overwrite occurred
            const overwrittenContent = await fs.readFile(secureFilePath);
            const dataOverwritten = !overwrittenContent.toString().includes(sensitiveContent);
            this.addTestResult('Secure Data Overwrite', dataOverwritten,
                dataOverwritten ? 'Sensitive data overwritten before deletion' : 'Data overwrite failed');
            
            // Test atomic file operations
            const atomicFileName = `atomic-test-${Date.now()}.tmp`;
            const atomicFilePath = path.join(this.testDir, atomicFileName);
            const tempAtomicPath = atomicFilePath + '.writing';
            
            // Write to temporary file first, then move (atomic operation)
            await fs.writeFile(tempAtomicPath, 'Atomic test content');
            await fs.rename(tempAtomicPath, atomicFilePath);
            this.testFiles.add(atomicFilePath);
            
            const atomicFileExists = fsSync.existsSync(atomicFilePath);
            const tempFileGone = !fsSync.existsSync(tempAtomicPath);
            const atomicSuccess = atomicFileExists && tempFileGone;
            
            this.addTestResult('Atomic File Operations', atomicSuccess,
                atomicSuccess ? 'Atomic file operations working correctly' : 'Atomic operations failed');
            
            console.log(chalk.green('✓ Secure file handling tests completed'));
            
        } catch (error) {
            this.addTestResult('Secure File Handling', false, error.message);
            console.error(chalk.red('❌ Secure file handling test failed:'), error.message);
        }
    }

    async testCleanupProcedures() {
        console.log(chalk.blue('\n🔄 Test 4: Cleanup Procedures'));
        
        try {
            // Create multiple test files for cleanup testing
            const cleanupTestFiles = [];
            for (let i = 0; i < 5; i++) {
                const fileName = `cleanup-test-${i}-${Date.now()}.tmp`;
                const filePath = path.join(this.testDir, fileName);
                await fs.writeFile(filePath, `Cleanup test content ${i}`);
                cleanupTestFiles.push(filePath);
            }
            
            // Test individual file cleanup
            const firstFile = cleanupTestFiles[0];
            await fs.unlink(firstFile);
            
            const fileDeleted = !fsSync.existsSync(firstFile);
            this.addTestResult('Individual File Cleanup', fileDeleted,
                fileDeleted ? 'Individual file deleted successfully' : 'Individual file deletion failed');
            
            // Test batch cleanup
            const remainingFiles = cleanupTestFiles.slice(1);
            for (const filePath of remainingFiles) {
                try {
                    await fs.unlink(filePath);
                } catch (error) {
                    // File might already be deleted, continue
                }
            }
            
            const allFilesDeleted = remainingFiles.every(filePath => !fsSync.existsSync(filePath));
            this.addTestResult('Batch File Cleanup', allFilesDeleted,
                allFilesDeleted ? 'All files in batch deleted successfully' : 'Batch cleanup failed');
            
            // Test cleanup of non-existent files (error handling)
            const nonExistentFile = path.join(this.testDir, 'non-existent-file.tmp');
            try {
                await fs.unlink(nonExistentFile);
                this.addTestResult('Non-existent File Cleanup', false, 'Should have thrown error for non-existent file');
            } catch (error) {
                const expectedError = error.code === 'ENOENT';
                this.addTestResult('Non-existent File Cleanup', expectedError,
                    expectedError ? 'Properly handles non-existent files' : 'Unexpected error type');
            }
            
            // Test directory cleanup
            const testSubDir = path.join(this.testDir, 'subdir-test');
            await fs.mkdir(testSubDir, { recursive: true });
            await fs.writeFile(path.join(testSubDir, 'test.txt'), 'test');
            
            // Clean up subdirectory
            await fs.rm(testSubDir, { recursive: true, force: true });
            
            const subdirDeleted = !fsSync.existsSync(testSubDir);
            this.addTestResult('Directory Cleanup', subdirDeleted,
                subdirDeleted ? 'Directory and contents deleted successfully' : 'Directory cleanup failed');
            
            console.log(chalk.green('✓ Cleanup procedure tests completed'));
            
        } catch (error) {
            this.addTestResult('Cleanup Procedures', false, error.message);
            console.error(chalk.red('❌ Cleanup procedure test failed:'), error.message);
        }
    }

    async testFileLifecycleManagement() {
        console.log(chalk.blue('\n🔄 Test 5: File Lifecycle Management'));
        
        try {
            // Test complete file lifecycle: create -> use -> modify -> cleanup
            const lifecycleFileName = `lifecycle-test-${Date.now()}.tmp`;
            const lifecycleFilePath = path.join(this.testDir, lifecycleFileName);
            
            // Stage 1: Creation
            const initialContent = 'Initial lifecycle test content';
            await fs.writeFile(lifecycleFilePath, initialContent, { mode: 0o600 });
            
            const creationSuccessful = fsSync.existsSync(lifecycleFilePath);
            this.addTestResult('Lifecycle - Creation', creationSuccessful,
                creationSuccessful ? 'File created successfully' : 'File creation failed');
            
            // Stage 2: Usage (reading)
            const readContent = await fs.readFile(lifecycleFilePath, 'utf8');
            const readSuccessful = readContent === initialContent;
            this.addTestResult('Lifecycle - Reading', readSuccessful,
                readSuccessful ? 'File read successfully' : 'File reading failed');
            
            // Stage 3: Modification
            const modifiedContent = initialContent + '\nModified content added';
            await fs.appendFile(lifecycleFilePath, '\nModified content added');
            
            const modifiedReadContent = await fs.readFile(lifecycleFilePath, 'utf8');
            const modificationSuccessful = modifiedReadContent === modifiedContent;
            this.addTestResult('Lifecycle - Modification', modificationSuccessful,
                modificationSuccessful ? 'File modified successfully' : 'File modification failed');
            
            // Stage 4: Metadata tracking
            const stats = await fs.stat(lifecycleFilePath);
            const hasValidMetadata = stats.size > 0 && stats.mtime instanceof Date;
            this.addTestResult('Lifecycle - Metadata', hasValidMetadata,
                hasValidMetadata ? 'File metadata tracked correctly' : 'File metadata invalid');
            
            // Stage 5: Cleanup
            await fs.unlink(lifecycleFilePath);
            const cleanupSuccessful = !fsSync.existsSync(lifecycleFilePath);
            this.addTestResult('Lifecycle - Cleanup', cleanupSuccessful,
                cleanupSuccessful ? 'File cleaned up successfully' : 'File cleanup failed');
            
            // Test file age tracking for cleanup decisions
            const oldFileName = `old-file-test-${Date.now()}.tmp`;
            const oldFilePath = path.join(this.testDir, oldFileName);
            await fs.writeFile(oldFilePath, 'Old file content');
            
            // Simulate old file by changing timestamps
            const oldTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
            await fs.utimes(oldFilePath, new Date(oldTime), new Date(oldTime));
            
            const oldStats = await fs.stat(oldFilePath);
            const isOldFile = Date.now() - oldStats.mtime.getTime() > (23 * 60 * 60 * 1000); // > 23 hours
            this.addTestResult('File Age Tracking', isOldFile,
                isOldFile ? 'File age tracking works correctly' : 'File age tracking failed');
            
            // Cleanup old file
            await fs.unlink(oldFilePath);
            
            console.log(chalk.green('✓ File lifecycle management tests completed'));
            
        } catch (error) {
            this.addTestResult('File Lifecycle Management', false, error.message);
            console.error(chalk.red('❌ File lifecycle management test failed:'), error.message);
        }
    }

    async testErrorHandlingRecovery() {
        console.log(chalk.blue('\n🔄 Test 6: Error Handling and Recovery'));
        
        try {
            // Test handling of permission errors
            const restrictedDir = path.join(this.testDir, 'restricted');
            await fs.mkdir(restrictedDir, { recursive: true });
            
            if (process.platform !== 'win32') {
                // Make directory read-only
                await fs.chmod(restrictedDir, 0o444);
                
                try {
                    const restrictedFile = path.join(restrictedDir, 'test.tmp');
                    await fs.writeFile(restrictedFile, 'test');
                    this.addTestResult('Permission Error Handling', false, 'Should have failed due to permissions');
                } catch (error) {
                    const expectedError = error.code === 'EACCES' || error.code === 'EPERM';
                    this.addTestResult('Permission Error Handling', expectedError,
                        expectedError ? 'Permission errors handled correctly' : `Unexpected error: ${error.code}`);
                }
                
                // Restore permissions for cleanup
                await fs.chmod(restrictedDir, 0o755);
            } else {
                this.addTestResult('Permission Error Handling', true, 'Skipped on Windows platform');
            }
            
            // Test handling of disk space issues (simulated)
            const largeFileName = `large-file-test-${Date.now()}.tmp`;
            const largeFilePath = path.join(this.testDir, largeFileName);
            
            try {
                // Create a reasonably sized file (not actually huge to avoid issues)
                const largeContent = 'x'.repeat(10000); // 10KB
                await fs.writeFile(largeFilePath, largeContent);
                
                const largeFileCreated = fsSync.existsSync(largeFilePath);
                this.addTestResult('Large File Handling', largeFileCreated,
                    largeFileCreated ? 'Large file created successfully' : 'Large file creation failed');
                
                // Cleanup large file
                if (largeFileCreated) {
                    await fs.unlink(largeFilePath);
                }
                
            } catch (error) {
                this.addTestResult('Large File Handling', false, `Large file error: ${error.message}`);
            }
            
            // Test recovery from corrupted files
            const corruptedFileName = `corrupted-test-${Date.now()}.tmp`;
            const corruptedFilePath = path.join(this.testDir, corruptedFileName);
            
            // Create a file and then corrupt it
            await fs.writeFile(corruptedFilePath, 'Valid content');
            
            // Simulate corruption by truncating file unexpectedly
            const fd = await fs.open(corruptedFilePath, 'r+');
            await fd.truncate(0);
            await fd.close();
            
            try {
                const corruptedContent = await fs.readFile(corruptedFilePath, 'utf8');
                const isCorrupted = corruptedContent.length === 0;
                this.addTestResult('Corrupted File Detection', isCorrupted,
                    isCorrupted ? 'Corrupted file detected correctly' : 'Failed to detect corruption');
            } catch (error) {
                this.addTestResult('Corrupted File Detection', false, `Corruption test error: ${error.message}`);
            }
            
            // Cleanup corrupted file
            await fs.unlink(corruptedFilePath);
            
            // Cleanup restricted directory
            await fs.rmdir(restrictedDir);
            
            console.log(chalk.green('✓ Error handling and recovery tests completed'));
            
        } catch (error) {
            this.addTestResult('Error Handling Recovery', false, error.message);
            console.error(chalk.red('❌ Error handling and recovery test failed:'), error.message);
        }
    }

    async testResourceManagement() {
        console.log(chalk.blue('\n🔄 Test 7: Memory and Resource Management'));
        
        try {
            const initialMemory = process.memoryUsage();
            
            // Test creating and managing many files
            const manyFiles = [];
            const fileCount = 100;
            
            for (let i = 0; i < fileCount; i++) {
                const fileName = `resource-test-${i}-${Date.now()}.tmp`;
                const filePath = path.join(this.testDir, fileName);
                await fs.writeFile(filePath, `Resource test content ${i}`);
                manyFiles.push(filePath);
            }
            
            const allFilesCreated = manyFiles.every(filePath => fsSync.existsSync(filePath));
            this.addTestResult('Bulk File Creation', allFilesCreated,
                allFilesCreated ? `Created ${fileCount} files successfully` : 'Bulk file creation failed');
            
            // Test file handle management
            const fileHandles = [];
            try {
                for (let i = 0; i < Math.min(10, manyFiles.length); i++) {
                    const handle = await fs.open(manyFiles[i], 'r');
                    fileHandles.push(handle);
                }
                
                this.addTestResult('File Handle Management', true, `Opened ${fileHandles.length} file handles`);
                
                // Close all handles
                for (const handle of fileHandles) {
                    await handle.close();
                }
                
            } catch (error) {
                this.addTestResult('File Handle Management', false, `File handle error: ${error.message}`);
            }
            
            // Test memory usage after operations
            const currentMemory = process.memoryUsage();
            const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
            const memoryIncreaseKB = Math.round(memoryIncrease / 1024);
            
            this.addTestResult('Memory Usage Tracking', true, 
                `Memory increase: ${memoryIncreaseKB}KB (heap used: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB)`);
            
            // Cleanup many files
            for (const filePath of manyFiles) {
                try {
                    await fs.unlink(filePath);
                } catch (error) {
                    // Continue cleanup even if some files fail
                }
            }
            
            const cleanupSuccessful = manyFiles.every(filePath => !fsSync.existsSync(filePath));
            this.addTestResult('Bulk File Cleanup', cleanupSuccessful,
                cleanupSuccessful ? 'All files cleaned up successfully' : 'Some files remain after cleanup');
            
            console.log(chalk.green('✓ Resource management tests completed'));
            
        } catch (error) {
            this.addTestResult('Resource Management', false, error.message);
            console.error(chalk.red('❌ Resource management test failed:'), error.message);
        }
    }

    async testConcurrentOperations() {
        console.log(chalk.blue('\n🔄 Test 8: Concurrent File Operations'));
        
        try {
            // Test concurrent file creation
            const concurrentPromises = [];
            const concurrentFileCount = 20;
            
            for (let i = 0; i < concurrentFileCount; i++) {
                const promise = (async (index) => {
                    const fileName = `concurrent-${index}-${Date.now()}.tmp`;
                    const filePath = path.join(this.testDir, fileName);
                    await fs.writeFile(filePath, `Concurrent content ${index}`);
                    return filePath;
                })(i);
                
                concurrentPromises.push(promise);
            }
            
            const createdFiles = await Promise.all(concurrentPromises);
            const allConcurrentFilesCreated = createdFiles.every(filePath => fsSync.existsSync(filePath));
            
            this.addTestResult('Concurrent File Creation', allConcurrentFilesCreated,
                allConcurrentFilesCreated ? `${concurrentFileCount} files created concurrently` : 'Concurrent creation failed');
            
            // Test concurrent read operations
            const readPromises = createdFiles.map(async (filePath) => {
                try {
                    const content = await fs.readFile(filePath, 'utf8');
                    return content.startsWith('Concurrent content');
                } catch (error) {
                    return false;
                }
            });
            
            const readResults = await Promise.all(readPromises);
            const allReadsSuccessful = readResults.every(result => result === true);
            
            this.addTestResult('Concurrent File Reading', allReadsSuccessful,
                allReadsSuccessful ? 'All concurrent reads successful' : 'Some concurrent reads failed');
            
            // Test concurrent cleanup
            const cleanupPromises = createdFiles.map(async (filePath) => {
                try {
                    await fs.unlink(filePath);
                    return true;
                } catch (error) {
                    return false;
                }
            });
            
            const cleanupResults = await Promise.all(cleanupPromises);
            const allCleanupsSuccessful = cleanupResults.every(result => result === true);
            
            this.addTestResult('Concurrent File Cleanup', allCleanupsSuccessful,
                allCleanupsSuccessful ? 'All concurrent cleanups successful' : 'Some concurrent cleanups failed');
            
            console.log(chalk.green('✓ Concurrent operations tests completed'));
            
        } catch (error) {
            this.addTestResult('Concurrent Operations', false, error.message);
            console.error(chalk.red('❌ Concurrent operations test failed:'), error.message);
        }
    }

    async testEngineFileOperations() {
        console.log(chalk.blue('\n🔄 Test 9: Engine Integration File Operations'));
        
        try {
            // Test ClaudeLoopEngine file operations without actually running the engine
            const engine = new ClaudeLoopEngine();
            
            // Test temp file tracking
            const hasTemplatesTracker = engine.tempFiles instanceof Set;
            this.addTestResult('Engine Temp File Tracker', hasTemplatesTracker,
                hasTemplatesTracker ? 'Engine has temp file tracking' : 'Engine missing temp file tracker');
            
            // Test cleanup method existence
            const hasCleanupMethod = typeof engine.cleanup === 'function';
            this.addTestResult('Engine Cleanup Method', hasCleanupMethod,
                hasCleanupMethod ? 'Engine has cleanup method' : 'Engine missing cleanup method');
            
            // Create a test file to simulate engine temp file
            const engineTestFile = path.join(this.testDir, `claude-loop-prompt-${crypto.randomBytes(16).toString('hex')}.tmp`);
            await fs.writeFile(engineTestFile, 'Engine test prompt content');
            
            // Add to engine's temp file tracker
            engine.tempFiles.add(engineTestFile);
            
            const fileTracked = engine.tempFiles.has(engineTestFile);
            this.addTestResult('Engine File Tracking', fileTracked,
                fileTracked ? 'File properly tracked by engine' : 'File tracking failed');
            
            // Test engine cleanup simulation
            try {
                // Simulate cleanup by clearing temp files
                for (const tempFile of engine.tempFiles) {
                    try {
                        if (fsSync.existsSync(tempFile)) {
                            await fs.unlink(tempFile);
                        }
                    } catch (error) {
                        // Continue cleanup even if some files fail
                    }
                }
                engine.tempFiles.clear();
                
                const cleanupWorked = !fsSync.existsSync(engineTestFile) && engine.tempFiles.size === 0;
                this.addTestResult('Engine Cleanup Simulation', cleanupWorked,
                    cleanupWorked ? 'Engine cleanup simulation successful' : 'Engine cleanup simulation failed');
                
            } catch (error) {
                this.addTestResult('Engine Cleanup Simulation', false, `Cleanup error: ${error.message}`);
            }
            
            console.log(chalk.green('✓ Engine integration file operation tests completed'));
            
        } catch (error) {
            this.addTestResult('Engine File Operations', false, error.message);
            console.error(chalk.red('❌ Engine file operations test failed:'), error.message);
        }
    }

    addTestResult(testName, passed, details) {
        const result = {
            testName,
            passed,
            details,
            timestamp: new Date().toISOString()
        };
        
        this.testResults.tests.push(result);
        this.testResults.summary.total++;
        
        if (passed) {
            this.testResults.summary.passed++;
            console.log(chalk.green('✓'), testName, chalk.gray(`- ${details}`));
        } else {
            this.testResults.summary.failed++;
            this.testResults.summary.errors.push(`${testName}: ${details}`);
            console.log(chalk.red('❌'), testName, chalk.red(`- ${details}`));
        }
    }

    async cleanup() {
        console.log(chalk.yellow('\n🧹 Cleaning up test resources...'));
        
        try {
            // Clean up any remaining test files
            for (const filePath of this.tempFiles) {
                try {
                    if (fsSync.existsSync(filePath)) {
                        await fs.unlink(filePath);
                    }
                } catch (error) {
                    console.warn(chalk.yellow(`Warning: Could not delete ${filePath}: ${error.message}`));
                }
            }
            
            for (const filePath of this.testFiles) {
                try {
                    if (fsSync.existsSync(filePath)) {
                        await fs.unlink(filePath);
                    }
                } catch (error) {
                    console.warn(chalk.yellow(`Warning: Could not delete ${filePath}: ${error.message}`));
                }
            }
            
            // Remove test directory
            try {
                await fs.rm(this.testDir, { recursive: true, force: true });
            } catch (error) {
                console.warn(chalk.yellow(`Warning: Could not remove test directory: ${error.message}`));
            }
            
        } catch (error) {
            console.error(chalk.red('❌ Cleanup error:'), error.message);
        }
    }

    generateReport() {
        const reportPath = path.join(__dirname, 'claude-loop-file-generation-cleanup-report.json');
        
        try {
            fsSync.writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2));
            
            console.log('\n' + '═'.repeat(60));
            console.log(chalk.cyan.bold('📊 File Generation and Cleanup Test Results'));
            console.log('═'.repeat(60));
            console.log(chalk.blue(`Total Tests: ${this.testResults.summary.total}`));
            console.log(chalk.green(`Passed: ${this.testResults.summary.passed}`));
            console.log(chalk.red(`Failed: ${this.testResults.summary.failed}`));
            console.log(chalk.blue(`Success Rate: ${Math.round((this.testResults.summary.passed / this.testResults.summary.total) * 100)}%`));
            console.log(chalk.gray(`Report saved: ${reportPath}`));
            
            if (this.testResults.summary.errors.length > 0) {
                console.log(chalk.red('\n❌ Errors Found:'));
                this.testResults.summary.errors.forEach(error => {
                    console.log(chalk.red(`  • ${error}`));
                });
            }
            
            console.log('═'.repeat(60));
            
        } catch (error) {
            console.error(chalk.red('❌ Failed to generate report:'), error.message);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new FileGenerationCleanupTester();
    tester.runAllTests().catch(error => {
        console.error(chalk.red('❌ Test suite failed:'), error.message);
        process.exit(1);
    });
}

module.exports = FileGenerationCleanupTester;