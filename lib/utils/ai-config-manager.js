/**
 * AI-Driven Configuration Manager
 * Intelligently manages configuration with dynamic port allocation, 
 * environment detection, and adaptive settings
 */

const os = require('os');
const path = require('path');
const envValidator = require('./env-validator');
const logger = require('./unified-logger');
const { PORTS, URL_PATTERNS, TEST_PORTS } = require('../config/constants');

class AIConfigManager {
    constructor() {
        this.config = {};
        this.allocatedPorts = new Set();
        this.configHistory = [];
        this.adaptiveSettings = {};
        
        this.initialize();
    }

    /**
     * Initialize AI-driven configuration
     */
    initialize() {
        // Detect environment characteristics
        this.detectEnvironment();
        
        // Generate intelligent defaults
        this.generateIntelligentDefaults();
        
        // Validate and sanitize environment variables
        this.validateEnvironment();
        
        // Apply AI-driven optimizations
        this.applyAIOptimizations();
        
        logger.info('AI-driven configuration initialized');
    }

    /**
     * Detect environment characteristics for intelligent configuration
     */
    detectEnvironment() {
        const env = {
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            nodeVersion: process.version,
            isDocker: this.isRunningInDocker(),
            isCI: this.isRunningInCI(),
            isDevelopment: process.env.NODE_ENV !== 'production',
            userHome: os.homedir(),
            workingDir: process.cwd()
        };

        this.environment = env;
        logger.debug('Environment detected:', env);
    }

    /**
     * Check if running in Docker container
     */
    isRunningInDocker() {
        try {
            const fs = require('fs');
            return fs.existsSync('/.dockerenv') || 
                   fs.readFileSync('/proc/self/cgroup', 'utf8').includes('docker');
        } catch {
            return false;
        }
    }

    /**
     * Check if running in CI environment
     */
    isRunningInCI() {
        const ciIndicators = [
            'CI', 'CONTINUOUS_INTEGRATION', 'BUILD_NUMBER', 
            'JENKINS_URL', 'TRAVIS', 'CIRCLECI', 'GITHUB_ACTIONS'
        ];
        return ciIndicators.some(indicator => process.env[indicator]);
    }

    /**
     * Generate intelligent default configuration based on environment
     */
    generateIntelligentDefaults() {
        const env = this.environment;
        
        // AI-driven memory allocation
        const memoryMB = Math.floor(env.totalMemory / 1024 / 1024);
        const availableMemoryMB = Math.floor(env.freeMemory / 1024 / 1024);
        
        // Dynamic port range based on environment
        const portRange = this.getIntelligentPortRange();
        
        // Adaptive timeouts based on system performance
        const timeouts = this.calculateAdaptiveTimeouts();
        
        // Connection limits based on system resources
        const connectionLimits = this.calculateConnectionLimits();

        this.config = {
            environment: {
                type: env.isDevelopment ? 'development' : 'production',
                platform: env.platform,
                cpus: env.cpus,
                memoryMB,
                availableMemoryMB,
                isDocker: env.isDocker,
                isCI: env.isCI
            },
            
            networking: {
                host: env.isDocker ? '0.0.0.0' : URL_PATTERNS.LOCALHOST,
                portRange: portRange,
                maxConnections: connectionLimits.maxConnections,
                connectionTimeout: timeouts.connection,
                requestTimeout: timeouts.request
            },
            
            performance: {
                maxMemoryUsage: Math.floor(memoryMB * 0.7), // Use 70% of available memory
                gcThreshold: Math.floor(memoryMB * 0.5),
                maxConcurrency: Math.min(env.cpus * 2, 20),
                adaptiveThrottling: env.cpus < 4 // Enable on lower-end systems
            },
            
            paths: {
                home: env.userHome,
                working: env.workingDir,
                temp: this.getIntelligentTempPath(),
                logs: this.getIntelligentLogPath(),
                config: this.getIntelligentConfigPath()
            },
            
            timeouts: timeouts,
            
            features: {
                enableWebUI: true,
                enableMetrics: !env.isCI,
                enableVerboseLogging: env.isDevelopment,
                enableCaching: memoryMB > 1024, // Enable caching on systems with >1GB RAM
                enableCompression: env.cpus > 2 // Enable compression on multi-core systems
            }
        };
    }

    /**
     * Get intelligent port range based on environment
     */
    getIntelligentPortRange() {
        if (this.environment.isCI) {
            // CI environments often have restricted port ranges
            return { min: PORTS.TEST_APP, max: 3100 };
        } else if (this.environment.isDocker) {
            // Docker containers can use a wider range
            return { min: PORTS.TEST_APP, max: 9000 };
        } else {
            // Local development - avoid common service ports
            return { min: PORTS.WEBUI_DEFAULT, max: 8888 };
        }
    }

    /**
     * Calculate adaptive timeouts based on system performance
     */
    calculateAdaptiveTimeouts() {
        const cpus = this.environment.cpus;
        const memoryMB = Math.floor(this.environment.totalMemory / 1024 / 1024);
        
        // Base timeouts that scale with system resources
        const baseMultiplier = cpus < 4 ? 1.5 : (cpus > 8 ? 0.7 : 1.0);
        const memoryMultiplier = memoryMB < 2048 ? 1.3 : (memoryMB > 8192 ? 0.8 : 1.0);
        
        const multiplier = baseMultiplier * memoryMultiplier;
        
        return {
            connection: Math.floor(10000 * multiplier),  // 10-15 seconds
            request: Math.floor(30000 * multiplier),     // 30-45 seconds
            process: Math.floor(600000 * multiplier),    // 10-15 minutes
            websocket: Math.floor(60000 * multiplier),   // 1-1.5 minutes
            handshake: Math.floor(5000 * multiplier)     // 5-7.5 seconds
        };
    }

    /**
     * Calculate connection limits based on system resources
     */
    calculateConnectionLimits() {
        const cpus = this.environment.cpus;
        const memoryMB = Math.floor(this.environment.totalMemory / 1024 / 1024);
        
        // Scale connections based on available resources
        let maxConnections = Math.min(
            Math.floor(cpus * 2.5),        // CPU-based limit
            Math.floor(memoryMB / 100),    // Memory-based limit (1 connection per 100MB)
            50                             // Hard upper limit
        );
        
        // Minimum viable connections
        maxConnections = Math.max(maxConnections, 3);
        
        return {
            maxConnections,
            maxConcurrentRequests: maxConnections * 2,
            maxWebSocketConnections: Math.floor(maxConnections * 0.6)
        };
    }

    /**
     * Get intelligent temporary directory path
     */
    getIntelligentTempPath() {
        const candidates = [
            process.env.TMPDIR,
            process.env.TMP,
            process.env.TEMP,
            path.join(this.environment.workingDir, 'tmp'),
            path.join(this.environment.userHome, '.claude-loop', 'tmp'),
            os.tmpdir()
        ];
        
        return candidates.find(p => p && typeof p === 'string') || os.tmpdir();
    }

    /**
     * Get intelligent log directory path
     */
    getIntelligentLogPath() {
        if (this.environment.isDocker) {
            return '/var/log/claude-loop';
        }
        
        return path.join(this.environment.userHome, '.claude-loop', 'logs');
    }

    /**
     * Get intelligent configuration directory path
     */
    getIntelligentConfigPath() {
        const platform = this.environment.platform;
        
        switch (platform) {
            case 'darwin':
                return path.join(this.environment.userHome, 'Library', 'Application Support', 'Claude');
            case 'win32':
                return path.join(this.environment.userHome, 'AppData', 'Roaming', 'Claude');
            default:
                return path.join(this.environment.userHome, '.config', 'claude');
        }
    }

    /**
     * Validate environment variables with AI-driven defaults
     */
    validateEnvironment() {
        const validation = envValidator.validateEnvironment();
        
        if (!validation.valid) {
            logger.warn('Environment validation failed, using AI-generated defaults');
            // Apply AI-generated defaults for failed validations
            validation.errors.forEach(error => {
                logger.warn(`Environment error: ${error}`);
            });
        }
        
        // Merge validated environment with our intelligent config
        this.config.environment.validated = validation.valid;
        this.config.environment.warnings = validation.warnings;
    }

    /**
     * Apply AI-driven optimizations based on detected patterns
     */
    applyAIOptimizations() {
        const config = this.config;
        
        // Optimize for CI environments
        if (config.environment.isCI) {
            config.performance.maxConcurrency = Math.min(config.performance.maxConcurrency, 5);
            config.networking.maxConnections = Math.min(config.networking.maxConnections, 10);
            config.features.enableMetrics = false;
            config.features.enableVerboseLogging = false;
        }
        
        // Optimize for Docker environments
        if (config.environment.isDocker) {
            config.networking.host = '0.0.0.0';
            config.paths.logs = '/var/log/claude-loop';
            config.paths.temp = '/tmp/claude-loop';
        }
        
        // Optimize for low-memory systems
        if (config.environment.memoryMB < 1024) {
            config.performance.maxConcurrency = Math.min(config.performance.maxConcurrency, 3);
            config.networking.maxConnections = Math.min(config.networking.maxConnections, 5);
            config.features.enableCaching = false;
            config.features.enableCompression = false;
        }
        
        // Optimize for development
        if (config.environment.isDevelopment) {
            config.features.enableVerboseLogging = true;
            config.features.enableMetrics = true;
            config.performance.adaptiveThrottling = false; // Disable for faster development
        }
        
        logger.info('AI optimizations applied based on environment characteristics');
    }

    /**
     * Dynamically allocate an available port
     * @param {string} serviceName - Name of the service requesting the port
     * @param {number} preferredPort - Preferred port number (optional)
     * @returns {Promise<number>} - Allocated port number
     */
    async allocatePort(serviceName, preferredPort = null) {
        const net = require('net');
        const range = this.config.networking.portRange;
        
        // Try preferred port first if provided
        if (preferredPort && preferredPort >= range.min && preferredPort <= range.max) {
            if (await this.isPortAvailable(preferredPort)) {
                this.allocatedPorts.add(preferredPort);
                logger.info(`Allocated preferred port ${preferredPort} for ${serviceName}`);
                return preferredPort;
            }
        }
        
        // Find next available port in range
        for (let port = range.min; port <= range.max; port++) {
            if (!this.allocatedPorts.has(port) && await this.isPortAvailable(port)) {
                this.allocatedPorts.add(port);
                logger.info(`Allocated port ${port} for ${serviceName}`);
                return port;
            }
        }
        
        throw new Error(`No available ports in range ${range.min}-${range.max} for ${serviceName}`);
    }

    /**
     * Check if a port is available
     * @param {number} port - Port to check
     * @returns {Promise<boolean>} - True if port is available
     */
    isPortAvailable(port) {
        return new Promise((resolve) => {
            const net = require('net');
            const server = net.createServer();
            
            server.listen(port, (err) => {
                if (err) {
                    resolve(false);
                } else {
                    server.once('close', () => resolve(true));
                    server.close();
                }
            });
            
            server.on('error', () => resolve(false));
        });
    }

    /**
     * Release an allocated port
     * @param {number} port - Port to release
     * @param {string} serviceName - Name of the service releasing the port
     */
    releasePort(port, serviceName) {
        if (this.allocatedPorts.has(port)) {
            this.allocatedPorts.delete(port);
            logger.info(`Released port ${port} from ${serviceName}`);
        }
    }

    /**
     * Get configuration for a specific service
     * @param {string} serviceName - Name of the service
     * @returns {object} - Service-specific configuration
     */
    getServiceConfig(serviceName) {
        const baseConfig = {
            host: this.config.networking.host,
            timeouts: this.config.timeouts,
            paths: this.config.paths,
            performance: this.config.performance,
            features: this.config.features
        };

        // Service-specific configurations
        const serviceConfigs = {
            webui: {
                ...baseConfig,
                maxConnections: this.config.networking.maxConnections,
                enableMetrics: this.config.features.enableMetrics
            },
            
            engine: {
                ...baseConfig,
                maxIterations: process.env.CLAUDE_LOOP_MAX_ITERATIONS || 10,
                maxTurns: process.env.CLAUDE_MAX_TURNS || 30,
                maxConcurrency: this.config.performance.maxConcurrency
            },
            
            testing: {
                ...baseConfig,
                timeout: this.config.timeouts.process,
                enableVerboseLogging: true,
                enableMetrics: false
            }
        };

        return serviceConfigs[serviceName] || baseConfig;
    }

    /**
     * Adapt configuration based on runtime patterns
     * @param {object} metrics - Runtime metrics
     */
    adaptConfiguration(metrics) {
        // AI-driven configuration adaptation based on runtime patterns
        if (metrics.memoryUsage > this.config.performance.gcThreshold) {
            logger.warn('High memory usage detected, enabling aggressive garbage collection');
            if (global.gc) {
                global.gc();
            }
        }
        
        if (metrics.connectionErrors > 10) {
            logger.warn('High connection error rate, reducing connection limits');
            this.config.networking.maxConnections = Math.max(
                Math.floor(this.config.networking.maxConnections * 0.8), 
                3
            );
        }
        
        if (metrics.responseTime > this.config.timeouts.request * 0.8) {
            logger.warn('High response times detected, increasing timeouts');
            Object.keys(this.config.timeouts).forEach(key => {
                this.config.timeouts[key] = Math.floor(this.config.timeouts[key] * 1.2);
            });
        }
        
        // Store adaptation history for learning
        this.configHistory.push({
            timestamp: Date.now(),
            metrics: { ...metrics },
            adaptations: { ...this.config }
        });
        
        // Keep only last 100 adaptations
        if (this.configHistory.length > 100) {
            this.configHistory.shift();
        }
    }

    /**
     * Generate AI-driven recommendations
     * @returns {Array} - Array of configuration recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        const config = this.config;
        
        // Memory recommendations
        if (config.environment.availableMemoryMB < 512) {
            recommendations.push({
                type: 'performance',
                severity: 'high',
                message: 'Low available memory detected',
                suggestion: 'Consider increasing system memory or reducing concurrent operations',
                autoFix: 'Reducing maxConcurrency to 2'
            });
            config.performance.maxConcurrency = Math.min(config.performance.maxConcurrency, 2);
        }
        
        // CPU recommendations
        if (config.environment.cpus < 2) {
            recommendations.push({
                type: 'performance',
                severity: 'medium',
                message: 'Single-core system detected',
                suggestion: 'Disable parallel processing features for better stability',
                autoFix: 'Disabling adaptive throttling and compression'
            });
            config.performance.adaptiveThrottling = false;
            config.features.enableCompression = false;
        }
        
        // Environment recommendations
        if (config.environment.isCI && config.features.enableMetrics) {
            recommendations.push({
                type: 'environment',
                severity: 'low',
                message: 'Metrics enabled in CI environment',
                suggestion: 'Disable metrics collection in CI for faster builds',
                autoFix: 'Disabling metrics in CI'
            });
            config.features.enableMetrics = false;
        }
        
        return recommendations;
    }

    /**
     * Get current configuration
     * @returns {object} - Current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Update configuration with validation
     * @param {object} updates - Configuration updates
     */
    updateConfig(updates) {
        // Validate updates
        if (!updates || typeof updates !== 'object') {
            throw new Error('Invalid configuration updates');
        }
        
        // Apply updates with deep merge
        this.config = this.deepMerge(this.config, updates);
        
        // Re-apply AI optimizations
        this.applyAIOptimizations();
        
        logger.info('Configuration updated with AI optimizations');
    }

    /**
     * Deep merge objects
     * @param {object} target - Target object
     * @param {object} source - Source object
     * @returns {object} - Merged object
     */
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }
}

// Export singleton instance
module.exports = new AIConfigManager();