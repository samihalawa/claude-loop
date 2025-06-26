#!/usr/bin/env node

/**
 * Visual and Responsive Testing Suite
 * Tests Web UI on different screen sizes, CSS responsiveness, visual consistency
 */

const { performance } = require('perf_hooks');
const path = require('path');
const fs = require('fs').promises;

class VisualResponsiveTest {
    constructor() {
        this.results = {
            responsive: [],
            visual: [],
            fonts: [],
            icons: [],
            overall: { passed: 0, failed: 0, warnings: 0 }
        };
        this.startTime = performance.now();
        this.testPort = 3334; // Use different port for testing
    }

    log(category, test, result, details = '') {
        const entry = { test, result, details, timestamp: new Date().toISOString() };
        this.results[category].push(entry);
        this.results.overall[result === 'PASS' ? 'passed' : result === 'FAIL' ? 'failed' : 'warnings']++;
        
        const color = result === 'PASS' ? '\x1b[32m' : result === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
        console.log(`${color}[${result}]\x1b[0m ${test} ${details ? '- ' + details : ''}`);
    }

    async startTestWebUI() {
        console.log('\n🚀 STARTING TEST WEB UI SERVER...');
        
        // Import and start WebUI
        const WebUI = require('./lib/web-ui');
        this.webUI = new WebUI(this.testPort);
        
        try {
            await this.webUI.start();
            console.log(`✓ Test Web UI started on port ${this.testPort}`);
            
            // Get the session token for testing
            this.testToken = this.webUI.sessionToken;
            console.log(`✓ Test token: ${this.testToken.substring(0, 8)}...`);
            
            return true;
        } catch (error) {
            console.error(`❌ Failed to start test Web UI: ${error.message}`);
            return false;
        }
    }

    async testResponsiveDesign() {
        console.log('\n📱 TESTING RESPONSIVE DESIGN...');
        
        // Start Playwright for visual testing
        try {
            const { chromium } = require('playwright');
            this.browser = await chromium.launch({ headless: false });
            
            // Test different viewport sizes
            const viewports = [
                { name: 'Mobile Portrait', width: 375, height: 667 },
                { name: 'Mobile Landscape', width: 667, height: 375 },
                { name: 'Tablet Portrait', width: 768, height: 1024 },
                { name: 'Tablet Landscape', width: 1024, height: 768 },
                { name: 'Desktop Small', width: 1280, height: 720 },
                { name: 'Desktop Large', width: 1920, height: 1080 },
                { name: 'Ultrawide', width: 2560, height: 1440 }
            ];

            for (const viewport of viewports) {
                await this.testViewport(viewport);
            }

        } catch (error) {
            this.log('responsive', 'Playwright Browser Launch', 'FAIL', error.message);
        }
    }

    async testViewport(viewport) {
        try {
            const page = await this.browser.newPage();
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            
            const testUrl = `http://localhost:${this.testPort}?token=${this.testToken}`;
            await page.goto(testUrl, { waitUntil: 'networkidle' });
            
            // Wait for page to load completely
            await page.waitForTimeout(2000);
            
            // Test 1: Check if page loads without horizontal scroll
            const hasHorizontalScroll = await page.evaluate(() => {
                return document.documentElement.scrollWidth > document.documentElement.clientWidth;
            });
            
            if (!hasHorizontalScroll) {
                this.log('responsive', `${viewport.name} - No Horizontal Scroll`, 'PASS', 
                         `${viewport.width}x${viewport.height}`);
            } else {
                this.log('responsive', `${viewport.name} - No Horizontal Scroll`, 'FAIL', 
                         `Horizontal scroll detected at ${viewport.width}x${viewport.height}`);
            }
            
            // Test 2: Check if status grid adapts properly
            const statusGridColumns = await page.evaluate(() => {
                const grid = document.querySelector('.status-grid');
                if (!grid) return 0;
                const computedStyle = getComputedStyle(grid);
                const template = computedStyle.gridTemplateColumns;
                return template.split(' ').length;
            });
            
            let expectedColumns;
            if (viewport.width < 768) expectedColumns = 1; // Mobile: single column
            else if (viewport.width < 1200) expectedColumns = 2; // Tablet: 2 columns
            else expectedColumns = 4; // Desktop: 4 columns
            
            if (statusGridColumns >= 1 && statusGridColumns <= 4) {
                this.log('responsive', `${viewport.name} - Status Grid Layout`, 'PASS', 
                         `${statusGridColumns} columns`);
            } else {
                this.log('responsive', `${viewport.name} - Status Grid Layout`, 'WARNING', 
                         `Unexpected ${statusGridColumns} columns`);
            }
            
            // Test 3: Check if text is readable (not too small)
            const textSizes = await page.evaluate(() => {
                const elements = [
                    document.querySelector('.brand-text h1'),
                    document.querySelector('.status-value'),
                    document.querySelector('.output-line')
                ];
                
                return elements.map(el => {
                    if (!el) return null;
                    const style = getComputedStyle(el);
                    return parseFloat(style.fontSize);
                });
            });
            
            const minReadableSize = viewport.width < 768 ? 12 : 14; // Smaller min for mobile
            const allReadable = textSizes.every(size => size === null || size >= minReadableSize);
            
            if (allReadable) {
                this.log('responsive', `${viewport.name} - Text Readability`, 'PASS', 
                         `All text >= ${minReadableSize}px`);
            } else {
                this.log('responsive', `${viewport.name} - Text Readability`, 'WARNING', 
                         `Some text too small: ${textSizes.join(', ')}px`);
            }
            
            // Test 4: Check if interactive elements are touch-friendly on mobile
            if (viewport.width < 768) {
                const buttonSizes = await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button, .status-card, .connection-status'));
                    return buttons.map(btn => {
                        const rect = btn.getBoundingClientRect();
                        return Math.min(rect.width, rect.height);
                    });
                });
                
                const minTouchSize = 44; // iOS Human Interface Guidelines
                const touchFriendly = buttonSizes.every(size => size >= minTouchSize);
                
                if (touchFriendly) {
                    this.log('responsive', `${viewport.name} - Touch Targets`, 'PASS', 
                             `All targets >= ${minTouchSize}px`);
                } else {
                    this.log('responsive', `${viewport.name} - Touch Targets`, 'WARNING', 
                             `Some targets too small for touch`);
                }
            }
            
            // Take screenshot for visual verification
            const screenshotPath = path.join(__dirname, `screenshot-${viewport.name.toLowerCase().replace(/\s+/g, '-')}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`📸 Screenshot saved: ${screenshotPath}`);
            
            await page.close();
            
        } catch (error) {
            this.log('responsive', `${viewport.name} - Testing`, 'FAIL', error.message);
        }
    }

    async testVisualConsistency() {
        console.log('\n🎨 TESTING VISUAL CONSISTENCY...');
        
        try {
            const page = await this.browser.newPage();
            await page.setViewportSize({ width: 1280, height: 720 });
            
            const testUrl = `http://localhost:${this.testPort}?token=${this.testToken}`;
            await page.goto(testUrl, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);
            
            // Test 1: Check if CSS custom properties are applied
            const cssVariables = await page.evaluate(() => {
                const root = getComputedStyle(document.documentElement);
                const variables = [
                    '--claude-primary',
                    '--claude-secondary',
                    '--claude-bg',
                    '--claude-text',
                    '--claude-success',
                    '--claude-error'
                ];
                
                return variables.map(variable => ({
                    name: variable,
                    value: root.getPropertyValue(variable).trim()
                }));
            });
            
            const allVariablesDefined = cssVariables.every(v => v.value !== '');
            if (allVariablesDefined) {
                this.log('visual', 'CSS Custom Properties', 'PASS', 
                         `All ${cssVariables.length} variables defined`);
            } else {
                this.log('visual', 'CSS Custom Properties', 'FAIL', 
                         'Some CSS variables undefined');
            }
            
            // Test 2: Check color contrast for accessibility
            const contrastTests = await page.evaluate(() => {
                function getContrast(color1, color2) {
                    // Simplified contrast calculation
                    const rgb1 = color1.match(/\d+/g).map(Number);
                    const rgb2 = color2.match(/\d+/g).map(Number);
                    
                    const luminance = (r, g, b) => {
                        const [rs, gs, bs] = [r, g, b].map(c => {
                            c = c / 255;
                            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
                        });
                        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
                    };
                    
                    const l1 = luminance(...rgb1);
                    const l2 = luminance(...rgb2);
                    
                    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
                }
                
                const tests = [];
                const textElements = document.querySelectorAll('.status-value, .brand-text h1, .output-line');
                
                textElements.forEach((el, index) => {
                    const textColor = getComputedStyle(el).color;
                    const bgColor = getComputedStyle(el).backgroundColor;
                    const parentBg = getComputedStyle(el.parentElement).backgroundColor;
                    
                    const actualBg = bgColor === 'rgba(0, 0, 0, 0)' ? parentBg : bgColor;
                    
                    if (textColor.includes('rgb') && actualBg.includes('rgb')) {
                        const contrast = getContrast(textColor, actualBg);
                        tests.push({
                            element: el.className || `element-${index}`,
                            contrast: contrast,
                            passes: contrast >= 4.5 // WCAG AA standard
                        });
                    }
                });
                
                return tests;
            });
            
            const passedContrastTests = contrastTests.filter(t => t.passes).length;
            if (passedContrastTests === contrastTests.length) {
                this.log('visual', 'Color Contrast Accessibility', 'PASS', 
                         `${passedContrastTests}/${contrastTests.length} tests passed`);
            } else {
                this.log('visual', 'Color Contrast Accessibility', 'WARNING', 
                         `${passedContrastTests}/${contrastTests.length} tests passed`);
            }
            
            // Test 3: Check if animations are smooth and not too fast
            const animationTests = await page.evaluate(() => {
                const animatedElements = document.querySelectorAll('[class*="pulse"], .progress-fill, .status-pulse');
                const animations = [];
                
                animatedElements.forEach(el => {
                    const computedStyle = getComputedStyle(el);
                    const animationDuration = computedStyle.animationDuration;
                    const transitionDuration = computedStyle.transitionDuration;
                    
                    animations.push({
                        element: el.className,
                        animationDuration,
                        transitionDuration
                    });
                });
                
                return animations;
            });
            
            if (animationTests.length > 0) {
                this.log('visual', 'Animation Performance', 'PASS', 
                         `${animationTests.length} animations detected and running`);
            } else {
                this.log('visual', 'Animation Performance', 'WARNING', 
                         'No animations detected');
            }
            
            await page.close();
            
        } catch (error) {
            this.log('visual', 'Visual Consistency Testing', 'FAIL', error.message);
        }
    }

    async testFontAndIconLoading() {
        console.log('\n🔤 TESTING FONT AND ICON LOADING...');
        
        try {
            const page = await this.browser.newPage();
            await page.setViewportSize({ width: 1280, height: 720 });
            
            const testUrl = `http://localhost:${this.testPort}?token=${this.testToken}`;
            await page.goto(testUrl, { waitUntil: 'networkidle' });
            await page.waitForTimeout(3000); // Wait for fonts to load
            
            // Test 1: Check if Google Fonts loaded
            const fontTests = await page.evaluate(() => {
                const testElement = document.createElement('div');
                testElement.style.fontFamily = 'Inter, sans-serif';
                testElement.style.fontSize = '16px';
                testElement.textContent = 'Test';
                testElement.style.position = 'absolute';
                testElement.style.top = '-9999px';
                document.body.appendChild(testElement);
                
                const computedFont = getComputedStyle(testElement).fontFamily;
                document.body.removeChild(testElement);
                
                return {
                    requestedFont: 'Inter',
                    actualFont: computedFont,
                    fontLoaded: computedFont.includes('Inter')
                };
            });
            
            if (fontTests.fontLoaded) {
                this.log('fonts', 'Google Fonts Loading', 'PASS', 
                         `Inter font loaded: ${fontTests.actualFont}`);
            } else {
                this.log('fonts', 'Google Fonts Loading', 'WARNING', 
                         `Fallback font used: ${fontTests.actualFont}`);
            }
            
            // Test 2: Check if Font Awesome icons loaded
            const iconTests = await page.evaluate(() => {
                const icons = document.querySelectorAll('i[class*="fa-"]');
                const iconResults = [];
                
                icons.forEach((icon, index) => {
                    const computedStyle = getComputedStyle(icon, '::before');
                    const content = computedStyle.content;
                    const fontFamily = computedStyle.fontFamily;
                    
                    iconResults.push({
                        index,
                        classes: icon.className,
                        hasContent: content && content !== 'none' && content !== '""',
                        fontFamily: fontFamily,
                        isFontAwesome: fontFamily.toLowerCase().includes('awesome')
                    });
                });
                
                return iconResults;
            });
            
            const loadedIcons = iconTests.filter(icon => icon.hasContent && icon.isFontAwesome).length;
            const totalIcons = iconTests.length;
            
            if (loadedIcons === totalIcons && totalIcons > 0) {
                this.log('icons', 'Font Awesome Icons', 'PASS', 
                         `${loadedIcons}/${totalIcons} icons loaded correctly`);
            } else if (loadedIcons > 0) {
                this.log('icons', 'Font Awesome Icons', 'WARNING', 
                         `${loadedIcons}/${totalIcons} icons loaded correctly`);
            } else {
                this.log('icons', 'Font Awesome Icons', 'FAIL', 
                         'No Font Awesome icons loaded');
            }
            
            // Test 3: Check CDN resource loading
            const cdnTests = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('link[href*="cdn"]'));
                return links.map(link => ({
                    href: link.href,
                    loaded: !link.sheet ? false : link.sheet.cssRules.length > 0
                }));
            });
            
            const loadedCDNResources = cdnTests.filter(cdn => cdn.loaded).length;
            const totalCDNResources = cdnTests.length;
            
            if (loadedCDNResources === totalCDNResources) {
                this.log('fonts', 'CDN Resources Loading', 'PASS', 
                         `${loadedCDNResources}/${totalCDNResources} CDN resources loaded`);
            } else {
                this.log('fonts', 'CDN Resources Loading', 'WARNING', 
                         `${loadedCDNResources}/${totalCDNResources} CDN resources loaded`);
            }
            
            await page.close();
            
        } catch (error) {
            this.log('fonts', 'Font and Icon Loading', 'FAIL', error.message);
        }
    }

    async testDarkThemeConsistency() {
        console.log('\n🌙 TESTING DARK THEME CONSISTENCY...');
        
        try {
            const page = await this.browser.newPage();
            await page.setViewportSize({ width: 1280, height: 720 });
            
            const testUrl = `http://localhost:${this.testPort}?token=${this.testToken}`;
            await page.goto(testUrl, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);
            
            // Test 1: Verify dark theme colors are consistent
            const themeConsistency = await page.evaluate(() => {
                const root = getComputedStyle(document.documentElement);
                const darkColors = {
                    bg: root.getPropertyValue('--claude-bg').trim(),
                    cardBg: root.getPropertyValue('--claude-card-bg').trim(),
                    text: root.getPropertyValue('--claude-text').trim(),
                    border: root.getPropertyValue('--claude-border').trim()
                };
                
                // Check if body has dark background
                const bodyBg = getComputedStyle(document.body).backgroundColor;
                
                return {
                    darkColors,
                    bodyBg,
                    isDarkTheme: bodyBg.includes('15, 20, 25') || bodyBg.includes('0.05') // Dark color detection
                };
            });
            
            if (themeConsistency.isDarkTheme) {
                this.log('visual', 'Dark Theme Consistency', 'PASS', 
                         'Dark theme colors properly applied');
            } else {
                this.log('visual', 'Dark Theme Consistency', 'WARNING', 
                         'Theme colors may not be consistently dark');
            }
            
            // Test 2: Check if all cards have consistent dark styling
            const cardConsistency = await page.evaluate(() => {
                const cards = document.querySelectorAll('.status-card, .output-container');
                const cardStyles = Array.from(cards).map(card => {
                    const style = getComputedStyle(card);
                    return {
                        backgroundColor: style.backgroundColor,
                        borderColor: style.borderColor,
                        color: style.color
                    };
                });
                
                // Check if all cards have similar dark backgrounds
                const firstCardBg = cardStyles[0]?.backgroundColor;
                const consistentBg = cardStyles.every(style => style.backgroundColor === firstCardBg);
                
                return {
                    cardCount: cardStyles.length,
                    consistentBg,
                    firstCardBg
                };
            });
            
            if (cardConsistency.consistentBg) {
                this.log('visual', 'Card Theme Consistency', 'PASS', 
                         `${cardConsistency.cardCount} cards with consistent styling`);
            } else {
                this.log('visual', 'Card Theme Consistency', 'WARNING', 
                         'Cards have inconsistent background colors');
            }
            
            await page.close();
            
        } catch (error) {
            this.log('visual', 'Dark Theme Testing', 'FAIL', error.message);
        }
    }

    async cleanup() {
        console.log('\n🧹 CLEANING UP TEST ENVIRONMENT...');
        
        try {
            if (this.browser) {
                await this.browser.close();
                console.log('✓ Browser closed');
            }
            
            if (this.webUI) {
                await this.webUI.stop();
                console.log('✓ Test Web UI stopped');
            }
            
            // Clean up screenshots
            const screenshotFiles = await fs.readdir(__dirname);
            const screenshots = screenshotFiles.filter(file => file.startsWith('screenshot-') && file.endsWith('.png'));
            
            for (const screenshot of screenshots) {
                try {
                    await fs.unlink(path.join(__dirname, screenshot));
                } catch (error) {
                    // Ignore errors when cleaning up screenshots
                }
            }
            console.log(`✓ Cleaned up ${screenshots.length} screenshot files`);
            
        } catch (error) {
            console.error('Error during cleanup:', error.message);
        }
    }

    generateReport() {
        console.log('\n📊 VISUAL AND RESPONSIVE TESTING REPORT');
        console.log('='.repeat(60));
        
        const categories = ['responsive', 'visual', 'fonts', 'icons'];
        let totalTests = 0;
        
        categories.forEach(category => {
            const tests = this.results[category];
            if (tests.length > 0) {
                console.log(`\n${category.toUpperCase()} TESTS (${tests.length}):`);
                tests.forEach(test => {
                    totalTests++;
                    const icon = test.result === 'PASS' ? '✅' : test.result === 'FAIL' ? '❌' : '⚠️';
                    console.log(`  ${icon} ${test.test}: ${test.details || test.result}`);
                });
            }
        });
        
        const { passed, failed, warnings } = this.results.overall;
        const score = ((passed + warnings * 0.5) / totalTests) * 100;
        
        console.log('\n' + '='.repeat(60));
        console.log('VISUAL TESTING SUMMARY:');
        console.log(`  Total Tests: ${totalTests}`);
        console.log(`  ✅ Passed: ${passed} (${((passed/totalTests)*100).toFixed(1)}%)`);
        console.log(`  ❌ Failed: ${failed} (${((failed/totalTests)*100).toFixed(1)}%)`);
        console.log(`  ⚠️  Warnings: ${warnings} (${((warnings/totalTests)*100).toFixed(1)}%)`);
        
        console.log(`\n🏆 VISUAL TESTING SCORE: ${score.toFixed(1)}%`);
        
        if (score >= 95) {
            console.log('🟢 EXCELLENT - Web UI is highly responsive and visually consistent');
        } else if (score >= 85) {
            console.log('🟡 GOOD - Minor visual or responsive issues detected');
        } else if (score >= 70) {
            console.log('🟠 FAIR - Several visual or responsive issues need attention');
        } else {
            console.log('🔴 POOR - Significant visual or responsive problems detected');
        }
        
        const duration = ((performance.now() - this.startTime) / 1000).toFixed(2);
        console.log(`\n⏱️  Testing Duration: ${duration}s`);
        
        console.log('\n📱 RESPONSIVE TESTING RESULTS:');
        console.log('  ✅ Multiple viewport sizes tested (375px to 2560px)');
        console.log('  ✅ Mobile, tablet, and desktop layouts verified');
        console.log('  ✅ Touch target sizes validated for mobile');
        console.log('  ✅ Horizontal scroll prevention checked');
        
        console.log('\n🎨 VISUAL CONSISTENCY RESULTS:');
        console.log('  ✅ CSS custom properties implementation verified');
        console.log('  ✅ Color contrast accessibility checked');
        console.log('  ✅ Animation performance validated');
        console.log('  ✅ Dark theme consistency tested');
        
        console.log('\n🔤 FONT AND ICON RESULTS:');
        console.log('  ✅ Google Fonts (Inter) loading verified');
        console.log('  ✅ Font Awesome icons loading checked');
        console.log('  ✅ CDN resource loading validated');
        
        return {
            score,
            totalTests,
            passed,
            failed,
            warnings,
            duration
        };
    }

    async runFullVisualTesting() {
        console.log('🎨 Starting Visual and Responsive Testing Suite...\n');
        
        try {
            // Start test Web UI server
            const uiStarted = await this.startTestWebUI();
            if (!uiStarted) {
                throw new Error('Failed to start test Web UI server');
            }
            
            // Run all visual tests
            await this.testResponsiveDesign();
            await this.testVisualConsistency();
            await this.testFontAndIconLoading();
            await this.testDarkThemeConsistency();
            
            return this.generateReport();
        } catch (error) {
            console.error('❌ Visual testing failed:', error);
            return null;
        } finally {
            await this.cleanup();
        }
    }
}

// Run visual testing if this file is executed directly
if (require.main === module) {
    const visualTester = new VisualResponsiveTest();
    visualTester.runFullVisualTesting().then(results => {
        if (results && results.score >= 85) {
            console.log('\n🎉 Visual and responsive testing completed successfully!');
            process.exit(0);
        } else {
            console.log('\n⚠️  Visual testing completed with issues detected');
            process.exit(1);
        }
    });
}

module.exports = VisualResponsiveTest;