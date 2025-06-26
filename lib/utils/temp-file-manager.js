const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const logger = require('./unified-logger');
const logger = require('./unified-logger');
const { PORTS, URL_PATTERNS, TEST_PORTS } = require('../config/constants');

/**
 * Centralized temporary file management utility
 * Handles creation, tracking, and cleanup of temporary files
 */
class TempFileManager {
    constructor() {
        this.tempFiles = new Set();
        this.setupCleanupHandlers();
    }

    /**
     * Create a secure temporary file with automatic tracking
     * @param {string} baseDir - Directory to create the file in
     * @param {string} prefix - Prefix for the filename
     * @param {string} content - Content to write to the file
     * @returns {Promise<string>} - Path to the created file
     */
    async createSecureTempFile(baseDir, prefix, content = '') {
        // Validate and sanitize input parameters
        if (!baseDir || typeof baseDir !== 'string') {
            throw new Error('Invalid base directory');
        }
        
        if (!prefix || typeof prefix !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(prefix)) {
            throw new Error('Invalid prefix - only alphanumeric, underscore, and dash allowed');
        }
        
        if (typeof content !== 'string') {
            throw new Error('Content must be a string');
        }
        
        // Prevent path traversal attacks and validate directory
        let normalizedBaseDir;
        try {
            normalizedBaseDir = path.resolve(baseDir);
        } catch (error) {
            throw new Error(`Invalid directory path: ${baseDir}`);
        }
        
        // Check for Windows drive letters and reject them on non-Windows systems
        if (process.platform !== 'win32' && /^[A-Za-z]:/.test(baseDir)) {
            throw new Error(`Windows-style paths not allowed on this system: ${baseDir}`);
        }
        
        const allowedDirs = [
            path.resolve(process.cwd()),
            path.resolve(require('os').tmpdir())
        ];
        
        // Ensure normalized path is within allowed directories (strict checking)
        const isAllowedDir = allowedDirs.some(allowedDir => {
            const normalizedAllowed = path.resolve(allowedDir);
            return normalizedBaseDir === normalizedAllowed || 
                   normalizedBaseDir.startsWith(normalizedAllowed + path.sep);
        });
        
        if (!isAllowedDir) {
            throw new Error(`Directory not allowed: ${normalizedBaseDir}`);
        }
        
        // Limit content size to prevent DoS
        if (content.length > 100 * 1024 * 1024) { // 100MB limit
            throw new Error('Content too large');
        }
        
        const random = crypto.randomBytes(32).toString('hex'); // Increased entropy
        const extension = config.get('fileSystem.tempFileExtension') || '.tmp';
        
        // Ensure extension is safe
        if (!/^\.[a-zA-Z0-9]{1,10}$/.test(extension)) {
            throw new Error('Invalid file extension');
        }
        
        const tempFilePath = path.join(normalizedBaseDir, `${prefix}-${Date.now()}-${random}${extension}`);
        
        // Final validation - ensure the constructed path is still within allowed directory
        const resolvedTempPath = path.resolve(tempFilePath);
        if (!resolvedTempPath.startsWith(normalizedBaseDir)) {
            throw new Error('Path traversal attempt detected');
        }
        
        logger.debug(`Creating secure temp file: ${tempFilePath}`);
        
        try {
            // Ensure the base directory exists
            await this.ensureDirectoryExists(normalizedBaseDir);
            
            // Create the file with secure permissions (owner read/write only)
            const permissions = config.get('fileSystem.tempFilePermissions') || 0o600;
            await fs.writeFile(tempFilePath, content, { 
                mode: permissions,
                flag: 'wx' // Create file exclusively, fail if exists
            });
            
            // Track the file for cleanup
            this.tempFiles.add(tempFilePath);
            
            // Verify file was created with correct permissions
            const stats = await fs.stat(tempFilePath);
            if ((stats.mode & parseInt('777', 8)) !== permissions) {
                logger.warn(`Temp file permissions may be incorrect: ${tempFilePath}`);
            }
            
            logger.fileOperation('Created secure temp file', tempFilePath, true);
            return tempFilePath;
            
        } catch (error) {
            logger.error(`Failed to create temp file: ${tempFilePath}`, error.message);
            // Remove from tracking if creation failed
            this.tempFiles.delete(tempFilePath);
            throw error;
        }
    }

    /**
     * Create and write content to a temporary file
     * @param {string} baseDir - Directory to create the file in
     * @param {string} prefix - Prefix for the filename
     * @param {string} content - Content to write to the file
     * @returns {Promise<string>} - Path to the created file
     */
    async createTempFileWithContent(baseDir, prefix, content) {
        const tempFilePath = await this.createSecureTempFile(baseDir, prefix);
        
        try {
            await fs.writeFile(tempFilePath, content, { 
                mode: config.get('fileSystem.tempFilePermissions') 
            });
            
            logger.fileOperation('Written content to temp file', tempFilePath, true);
            return tempFilePath;
            
        } catch (error) {
            // Clean up the file if writing content failed
            await this.cleanupTempFile(tempFilePath);
            throw error;
        }
    }

    /**
     * Clean up a specific temporary file
     * @param {string} tempFilePath - Path to the temporary file
     * @returns {Promise<boolean>} - True if cleanup successful
     */
    async cleanupTempFile(tempFilePath) {
        if (!this.tempFiles.has(tempFilePath)) {
            logger.debug(`Temp file not tracked: ${tempFilePath}`);
            return false;
        }

        try {
            await fs.unlink(tempFilePath);
            this.tempFiles.delete(tempFilePath);
            logger.fileOperation('Cleaned up temp file', tempFilePath, true);
            return true;
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, remove from tracking
                this.tempFiles.delete(tempFilePath);
                logger.debug(`Temp file already removed: ${tempFilePath}`);
                return true;
            }
            
            logger.warn(`Could not clean up temp file: ${tempFilePath}`, error.message);
            return false;
        }
    }

    /**
     * Clean up all tracked temporary files
     * @returns {Promise<number>} - Number of files successfully cleaned up
     */
    async cleanupAllTempFiles() {
        logger.debug(`Cleaning up ${this.tempFiles.size} temp files...`);
        
        let successCount = 0;
        const cleanupPromises = Array.from(this.tempFiles).map(async (tempFile) => {
            const success = await this.cleanupTempFile(tempFile);
            if (success) successCount++;
        });

        await Promise.all(cleanupPromises);
        
        if (successCount > 0) {
            logger.success(`Cleaned up ${successCount} temp files`);
        }
        
        return successCount;
    }

    /**
     * Get a list of all tracked temporary files
     * @returns {Array<string>} - Array of temp file paths
     */
    getTrackedFiles() {
        return Array.from(this.tempFiles);
    }

    /**
     * Check if a file is being tracked as a temporary file
     * @param {string} filePath - Path to check
     * @returns {boolean} - True if file is tracked
     */
    isTracked(filePath) {
        return this.tempFiles.has(filePath);
    }

    /**
     * Get statistics about temporary files
     * @returns {Object} - Statistics object
     */
    getStats() {
        return {
            totalTracked: this.tempFiles.size,
            trackedFiles: Array.from(this.tempFiles)
        };
    }

    /**
     * Ensure a directory exists, creating it if necessary
     * @param {string} dirPath - Directory path
     * @returns {Promise<void>}
     */
    async ensureDirectoryExists(dirPath) {
        try {
            await fs.access(dirPath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.mkdir(dirPath, { recursive: true });
                logger.fileOperation('Created directory', dirPath, true);
            } else {
                throw error;
            }
        }
    }

    /**
     * Setup cleanup handlers for process termination
     */
    setupCleanupHandlers() {
        const cleanup = async () => {
            logger.info('🧹 Cleaning up temporary files...');
            await this.cleanupAllTempFiles();
        };

        // Handle various process termination signals
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('SIGQUIT', cleanup);
        process.on('exit', cleanup);
        
        // Handle uncaught exceptions
        process.on('uncaughtException', async (error) => {
            logger.error('Uncaught exception, cleaning up temp files', error.message);
            await cleanup();
            process.exit(1);
        });

        process.on('unhandledRejection', async (reason) => {
            logger.error('Unhandled rejection, cleaning up temp files', reason);
            await cleanup();
            process.exit(1);
        });
    }

    /**
     * Create a managed temporary file that auto-cleans after a timeout
     * @param {string} baseDir - Directory to create the file in
     * @param {string} prefix - Prefix for the filename
     * @param {string} content - Content to write to the file
     * @param {number} timeoutMs - Timeout in milliseconds
     * @returns {Promise<string>} - Path to the created file
     */
    async createTimedTempFile(baseDir, prefix, content = '', timeoutMs = 300000) {
        const tempFilePath = await this.createTempFileWithContent(baseDir, prefix, content);
        
        // Set up automatic cleanup
        setTimeout(async () => {
            if (this.isTracked(tempFilePath)) {
                logger.debug(`Auto-cleaning timed temp file: ${tempFilePath}`);
                await this.cleanupTempFile(tempFilePath);
            }
        }, timeoutMs);

        return tempFilePath;
    }

    /**
     * Cleanup method for shutdown
     */
    async shutdown() {
        await this.cleanupAllTempFiles();
        this.tempFiles.clear();
    }
}

// Export singleton instance
module.exports = new TempFileManager();