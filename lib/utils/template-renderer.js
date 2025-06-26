/**
 * Template rendering utility for HTML templates with variable substitution
 */

const fs = require('fs').promises;
const path = require('path');
const { UI_CONFIG, HTTP_RESPONSES } = require('../config/constants');
const logger = require('./unified-logger');

class TemplateRenderer {
    constructor() {
        this.templateCache = new Map();
        this.cacheEnabled = process.env.NODE_ENV === 'production';
    }

    /**
     * Render a template with the given variables
     * @param {string} templatePath - Path to the template file
     * @param {Object} variables - Variables to substitute in the template
     * @returns {Promise<string>} - Rendered HTML
     */
    async render(templatePath, variables = {}) {
        let templateContent;
        
        // Check cache first in production
        if (this.cacheEnabled && this.templateCache.has(templatePath)) {
            templateContent = this.templateCache.get(templatePath);
        } else {
            // Read template file
            const fullPath = path.resolve(templatePath);
            templateContent = await fs.readFile(fullPath, 'utf8');
            
            // Cache in production
            if (this.cacheEnabled) {
                this.templateCache.set(templatePath, templateContent);
            }
        }
        
        // Substitute variables
        return this.substituteVariables(templateContent, variables);
    }

    /**
     * Substitute template variables with actual values
     * @param {string} template - Template content
     * @param {Object} variables - Variables to substitute
     * @returns {string} - Template with substituted variables
     */
    substituteVariables(template, variables) {
        let result = template;
        
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{{${key}}}`;
            result = result.replace(new RegExp(placeholder, 'g'), value);
        }
        
        return result;
    }

    /**
     * Get default template variables for the dashboard
     * @returns {Object} - Default variables
     */
    getDefaultDashboardVariables() {
        return {
            // CDN URLs (configurable)
            CDN_BOOTSTRAP: process.env.CDN_BOOTSTRAP || 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
            CDN_FONTAWESOME: process.env.CDN_FONTAWESOME || 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
            CDN_FONTS: process.env.CDN_FONTS || 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
            
            // Theme colors (configurable)
            THEME_PRIMARY: process.env.THEME_PRIMARY || '#667eea',
            THEME_SECONDARY: process.env.THEME_SECONDARY || '#764ba2',
            THEME_DARK: process.env.THEME_DARK || '#1a1a2e',
            THEME_DARKER: process.env.THEME_DARKER || '#16213e',
            THEME_BG: process.env.THEME_BG || '#0f1419',
            THEME_CARD_BG: process.env.THEME_CARD_BG || '#1a1a2e',
            THEME_TEXT: process.env.THEME_TEXT || '#e2e8f0',
            THEME_TEXT_SECONDARY: process.env.THEME_TEXT_SECONDARY || '#8796a0',
            THEME_BORDER: process.env.THEME_BORDER || '#2d3748',
            THEME_SUCCESS: process.env.THEME_SUCCESS || '#48bb78',
            THEME_WARNING: process.env.THEME_WARNING || '#ed8936',
            THEME_ERROR: process.env.THEME_ERROR || '#f56565',
            THEME_ACCENT: process.env.THEME_ACCENT || '#00f5ff',
            
            // UI Configuration
            MAX_ITERATIONS: process.env.CLAUDE_LOOP_MAX_ITERATIONS || '10',
            APP_NAME: process.env.APP_NAME || 'Claude Loop',
            APP_DESCRIPTION: process.env.APP_DESCRIPTION || 'AI-Powered Repository Debugger'
        };
    }

    /**
     * Render the dashboard template with default variables
     * @param {Object} additionalVariables - Additional variables to merge with defaults
     * @returns {Promise<string>} - Rendered dashboard HTML
     */
    async renderDashboard(additionalVariables = {}) {
        const templatePath = path.join(__dirname, '../templates/dashboard.html');
        const defaultVars = this.getDefaultDashboardVariables();
        const variables = { ...defaultVars, ...additionalVariables };
        
        return this.render(templatePath, variables);
    }

    /**
     * Clear template cache (useful for development)
     */
    clearCache() {
        this.templateCache.clear();
    }

    /**
     * Get cache status
     * @returns {Object} - Cache information
     */
    getCacheStatus() {
        return {
            enabled: this.cacheEnabled,
            size: this.templateCache.size,
            templates: Array.from(this.templateCache.keys())
        };
    }
}

// Export singleton instance
module.exports = new TemplateRenderer();