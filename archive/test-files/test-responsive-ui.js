#!/usr/bin/env node

const fs = require('fs');
const chalk = require('chalk');

async function testResponsiveUI() {
    console.log(chalk.cyan('🧪 Testing UI Responsive Behavior and Layout\n'));
    
    const results = {
        passed: 0,
        failed: 0,
        warnings: 0,
        tests: []
    };
    
    const token = process.env.WEBUI_TEST_TOKEN || require('crypto').randomBytes(48).toString('hex');
    const port = process.env.TEST_BROWSER_UI_PORT || 3997;
    const baseUrl = `http://localhost:${port}`;
    
    // Test 1: CSS Media Queries Analysis
    console.log(chalk.blue('Test 1: CSS Media Queries and Responsive Breakpoints'));
    try {
        const { spawn } = require('child_process');
        const response = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        const responsiveFeatures = [
            { pattern: '@media (max-width: 768px)', name: 'Mobile Breakpoint (768px)' },
            { pattern: 'flex-direction: column', name: 'Flexible Column Layout' },
            { pattern: 'grid-template-columns: 1fr', name: 'Single Column Grid for Mobile' },
            { pattern: 'padding: 1rem', name: 'Responsive Padding' },
            { pattern: 'font-size: 1.5rem', name: 'Responsive Typography' },
            { pattern: 'min-width:', name: 'Minimum Width Constraints' },
            { pattern: 'max-width:', name: 'Maximum Width Constraints' },
            { pattern: 'gap:', name: 'Responsive Grid/Flex Gap' }
        ];
        
        let foundFeatures = [];
        let missingFeatures = [];
        
        for (const feature of responsiveFeatures) {
            if (response.includes(feature.pattern)) {
                foundFeatures.push(feature.name);
            } else {
                missingFeatures.push(feature.name);
            }
        }
        
        if (foundFeatures.length >= 6) {
            console.log(chalk.green('✅ Comprehensive responsive design features present'));
            console.log(chalk.gray(`   Found: ${foundFeatures.join(', ')}`));
            results.passed++;
            results.tests.push({ 
                name: 'CSS Media Queries', 
                status: 'PASS', 
                details: `${foundFeatures.length}/8 responsive features found` 
            });
        } else if (foundFeatures.length >= 4) {
            console.log(chalk.yellow(`⚠️ Basic responsive features present (${foundFeatures.length}/8)`));
            console.log(chalk.gray(`   Missing: ${missingFeatures.join(', ')}`));
            results.warnings++;
            results.tests.push({ 
                name: 'CSS Media Queries', 
                status: 'WARNING', 
                details: `Only ${foundFeatures.length}/8 features, missing: ${missingFeatures.slice(0,3).join(', ')}` 
            });
        } else {
            console.log(chalk.red(`❌ Insufficient responsive design features (${foundFeatures.length}/8)`));
            results.failed++;
            results.tests.push({ 
                name: 'CSS Media Queries', 
                status: 'FAIL', 
                details: `Only ${foundFeatures.length}/8 features found` 
            });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error analyzing responsive CSS:', error.message));
        results.failed++;
        results.tests.push({ name: 'CSS Media Queries', status: 'FAIL', details: error.message });
    }
    
    // Test 2: Viewport Meta Tag and Mobile Optimization
    console.log(chalk.blue('\nTest 2: Viewport Meta Tag and Mobile Optimization'));
    try {
        const { spawn } = require('child_process');
        const response = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        const mobileOptimizations = [
            { pattern: 'name="viewport"', name: 'Viewport Meta Tag' },
            { pattern: 'width=device-width', name: 'Device Width Setting' },
            { pattern: 'initial-scale=1.0', name: 'Proper Initial Scale' },
            { pattern: 'user-scalable=', name: 'User Scaling Control' },
            { pattern: 'touch-action:', name: 'Touch Action Optimization' },
            { pattern: '-webkit-touch-callout:', name: 'WebKit Touch Optimization' },
            { pattern: '-webkit-user-select:', name: 'Text Selection Control' }
        ];
        
        let foundOptimizations = [];
        for (const opt of mobileOptimizations) {
            if (response.includes(opt.pattern)) {
                foundOptimizations.push(opt.name);
            }
        }
        
        if (foundOptimizations.length >= 3) {
            console.log(chalk.green('✅ Good mobile optimization features'));
            console.log(chalk.gray(`   Found: ${foundOptimizations.join(', ')}`));
            results.passed++;
            results.tests.push({ 
                name: 'Mobile Optimization', 
                status: 'PASS', 
                details: `${foundOptimizations.length} mobile features found` 
            });
        } else {
            console.log(chalk.yellow(`⚠️ Basic mobile optimization (${foundOptimizations.length} features)`));
            results.warnings++;
            results.tests.push({ 
                name: 'Mobile Optimization', 
                status: 'WARNING', 
                details: `Only ${foundOptimizations.length} mobile features` 
            });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error checking mobile optimization:', error.message));
        results.failed++;
        results.tests.push({ name: 'Mobile Optimization', status: 'FAIL', details: error.message });
    }
    
    // Test 3: CSS Grid and Flexbox Layout Analysis
    console.log(chalk.blue('\nTest 3: Modern Layout Systems (Grid & Flexbox)'));
    try {
        const { spawn } = require('child_process');
        const response = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        const layoutFeatures = [
            { pattern: 'display: grid', name: 'CSS Grid Display' },
            { pattern: 'grid-template-columns:', name: 'Grid Template Columns' },
            { pattern: 'grid-gap:', name: 'Grid Gap' },
            { pattern: 'gap:', name: 'Modern Gap Property' },
            { pattern: 'display: flex', name: 'Flexbox Display' },
            { pattern: 'flex-direction:', name: 'Flex Direction' },
            { pattern: 'justify-content:', name: 'Flex Justify Content' },
            { pattern: 'align-items:', name: 'Flex Align Items' },
            { pattern: 'flex-wrap:', name: 'Flex Wrap' },
            { pattern: 'auto-fit', name: 'Responsive Grid Auto-fit' },
            { pattern: 'minmax(', name: 'Grid Minmax Function' }
        ];
        
        let foundLayouts = [];
        for (const layout of layoutFeatures) {
            if (response.includes(layout.pattern)) {
                foundLayouts.push(layout.name);
            }
        }
        
        const gridFeatures = foundLayouts.filter(f => f.includes('Grid')).length;
        const flexFeatures = foundLayouts.filter(f => f.includes('Flex')).length;
        
        if (gridFeatures >= 3 && flexFeatures >= 3) {
            console.log(chalk.green('✅ Excellent modern layout implementation'));
            console.log(chalk.gray(`   Grid features: ${gridFeatures}, Flex features: ${flexFeatures}`));
            results.passed++;
            results.tests.push({ 
                name: 'Modern Layout Systems', 
                status: 'PASS', 
                details: `Grid: ${gridFeatures}, Flex: ${flexFeatures}` 
            });
        } else if (foundLayouts.length >= 4) {
            console.log(chalk.yellow(`⚠️ Good layout features (${foundLayouts.length} total)`));
            results.warnings++;
            results.tests.push({ 
                name: 'Modern Layout Systems', 
                status: 'WARNING', 
                details: `${foundLayouts.length} layout features found` 
            });
        } else {
            console.log(chalk.red(`❌ Limited modern layout features (${foundLayouts.length})`));
            results.failed++;
            results.tests.push({ 
                name: 'Modern Layout Systems', 
                status: 'FAIL', 
                details: `Only ${foundLayouts.length} layout features` 
            });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error analyzing layout systems:', error.message));
        results.failed++;
        results.tests.push({ name: 'Modern Layout Systems', status: 'FAIL', details: error.message });
    }
    
    // Test 4: Typography and Spacing Responsiveness
    console.log(chalk.blue('\nTest 4: Responsive Typography and Spacing'));
    try {
        const { spawn } = require('child_process');
        const response = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        const typographyFeatures = [
            { pattern: 'font-size: 1.8rem', name: 'Relative Font Sizes (rem)' },
            { pattern: 'font-size: 1.5rem', name: 'Responsive Heading Sizes' },
            { pattern: 'font-size: 0.875rem', name: 'Small Text Optimization' },
            { pattern: 'line-height:', name: 'Line Height Settings' },
            { pattern: 'letter-spacing:', name: 'Letter Spacing' },
            { pattern: 'margin: 0 auto', name: 'Auto Margin Centering' },
            { pattern: 'padding: 1rem', name: 'Relative Padding (rem)' },
            { pattern: 'padding: 2rem', name: 'Consistent Spacing Scale' }
        ];
        
        let foundTypography = [];
        for (const typo of typographyFeatures) {
            if (response.includes(typo.pattern)) {
                foundTypography.push(typo.name);
            }
        }
        
        if (foundTypography.length >= 6) {
            console.log(chalk.green('✅ Excellent responsive typography and spacing'));
            console.log(chalk.gray(`   Features: ${foundTypography.join(', ')}`));
            results.passed++;
            results.tests.push({ 
                name: 'Responsive Typography', 
                status: 'PASS', 
                details: `${foundTypography.length}/8 typography features` 
            });
        } else if (foundTypography.length >= 4) {
            console.log(chalk.yellow(`⚠️ Good typography features (${foundTypography.length}/8)`));
            results.warnings++;
            results.tests.push({ 
                name: 'Responsive Typography', 
                status: 'WARNING', 
                details: `${foundTypography.length}/8 features found` 
            });
        } else {
            console.log(chalk.red(`❌ Limited typography responsiveness (${foundTypography.length}/8)`));
            results.failed++;
            results.tests.push({ 
                name: 'Responsive Typography', 
                status: 'FAIL', 
                details: `Only ${foundTypography.length}/8 features` 
            });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error analyzing typography:', error.message));
        results.failed++;
        results.tests.push({ name: 'Responsive Typography', status: 'FAIL', details: error.message });
    }
    
    // Test 5: Interactive Elements Responsiveness
    console.log(chalk.blue('\nTest 5: Interactive Elements and Touch Optimization'));
    try {
        const { spawn } = require('child_process');
        const response = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        const interactiveFeatures = [
            { pattern: 'min-width: 120px', name: 'Minimum Touch Target Size' },
            { pattern: 'padding: 12px', name: 'Adequate Button Padding' },
            { pattern: 'cursor: pointer', name: 'Cursor Feedback' },
            { pattern: 'transition:', name: 'Smooth Transitions' },
            { pattern: 'transform:', name: 'Transform Effects' },
            { pattern: ':hover', name: 'Hover States' },
            { pattern: ':focus', name: 'Focus States' },
            { pattern: 'outline:', name: 'Focus Outlines' }
        ];
        
        let foundInteractive = [];
        for (const feature of interactiveFeatures) {
            if (response.includes(feature.pattern)) {
                foundInteractive.push(feature.name);
            }
        }
        
        if (foundInteractive.length >= 6) {
            console.log(chalk.green('✅ Excellent interactive element optimization'));
            console.log(chalk.gray(`   Features: ${foundInteractive.join(', ')}`));
            results.passed++;
            results.tests.push({ 
                name: 'Interactive Elements', 
                status: 'PASS', 
                details: `${foundInteractive.length}/8 interactive features` 
            });
        } else if (foundInteractive.length >= 4) {
            console.log(chalk.yellow(`⚠️ Good interactive features (${foundInteractive.length}/8)`));
            results.warnings++;
            results.tests.push({ 
                name: 'Interactive Elements', 
                status: 'WARNING', 
                details: `${foundInteractive.length}/8 features found` 
            });
        } else {
            console.log(chalk.red(`❌ Limited interactive optimization (${foundInteractive.length}/8)`));
            results.failed++;
            results.tests.push({ 
                name: 'Interactive Elements', 
                status: 'FAIL', 
                details: `Only ${foundInteractive.length}/8 features` 
            });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error analyzing interactive elements:', error.message));
        results.failed++;
        results.tests.push({ name: 'Interactive Elements', status: 'FAIL', details: error.message });
    }
    
    // Test 6: Container and Layout Responsiveness
    console.log(chalk.blue('\nTest 6: Container and Layout Responsiveness'));
    try {
        const { spawn } = require('child_process');
        const response = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        const containerFeatures = [
            { pattern: 'max-width: 1400px', name: 'Maximum Container Width' },
            { pattern: 'margin: 0 auto', name: 'Container Centering' },
            { pattern: 'overflow-x: hidden', name: 'Horizontal Overflow Control' },
            { pattern: 'min-height: 100vh', name: 'Full Viewport Height' },
            { pattern: 'box-sizing: border-box', name: 'Border Box Model' },
            { pattern: 'width: 100%', name: 'Full Width Elements' },
            { pattern: 'position: relative', name: 'Relative Positioning' },
            { pattern: 'z-index:', name: 'Layer Management' }
        ];
        
        let foundContainer = [];
        for (const feature of containerFeatures) {
            if (response.includes(feature.pattern)) {
                foundContainer.push(feature.name);
            }
        }
        
        if (foundContainer.length >= 6) {
            console.log(chalk.green('✅ Excellent container and layout management'));
            console.log(chalk.gray(`   Features: ${foundContainer.join(', ')}`));
            results.passed++;
            results.tests.push({ 
                name: 'Container Layout', 
                status: 'PASS', 
                details: `${foundContainer.length}/8 container features` 
            });
        } else if (foundContainer.length >= 4) {
            console.log(chalk.yellow(`⚠️ Good container features (${foundContainer.length}/8)`));
            results.warnings++;
            results.tests.push({ 
                name: 'Container Layout', 
                status: 'WARNING', 
                details: `${foundContainer.length}/8 features found` 
            });
        } else {
            console.log(chalk.red(`❌ Limited container optimization (${foundContainer.length}/8)`));
            results.failed++;
            results.tests.push({ 
                name: 'Container Layout', 
                status: 'FAIL', 
                details: `Only ${foundContainer.length}/8 features` 
            });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error analyzing container layout:', error.message));
        results.failed++;
        results.tests.push({ name: 'Container Layout', status: 'FAIL', details: error.message });
    }
    
    // Test 7: Test HTML File Responsive Features
    console.log(chalk.blue('\nTest 7: Test HTML File Responsive Analysis'));
    try {
        const htmlPath = '/Users/samihalawa/git/claude-loop/test-broken-ui.html';
        if (fs.existsSync(htmlPath)) {
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');
            
            const htmlResponsiveFeatures = [
                { pattern: 'meta name="viewport"', name: 'Viewport Meta Tag' },
                { pattern: 'box-sizing: border-box', name: 'Border Box Model' },
                { pattern: 'max-width:', name: 'Maximum Width Constraints' },
                { pattern: 'min-width:', name: 'Minimum Width Constraints' },
                { pattern: 'flex-wrap:', name: 'Flexible Wrapping' },
                { pattern: 'transition:', name: 'Smooth Transitions' },
                { pattern: '@media', name: 'Media Queries' },
                { pattern: 'responsive', name: 'Responsive Design Intent' }
            ];
            
            let foundHtmlFeatures = [];
            for (const feature of htmlResponsiveFeatures) {
                if (htmlContent.includes(feature.pattern)) {
                    foundHtmlFeatures.push(feature.name);
                }
            }
            
            if (foundHtmlFeatures.length >= 5) {
                console.log(chalk.green('✅ HTML test file has good responsive features'));
                console.log(chalk.gray(`   Features: ${foundHtmlFeatures.join(', ')}`));
                results.passed++;
                results.tests.push({ 
                    name: 'HTML File Responsiveness', 
                    status: 'PASS', 
                    details: `${foundHtmlFeatures.length} responsive features` 
                });
            } else if (foundHtmlFeatures.length >= 3) {
                console.log(chalk.yellow(`⚠️ HTML test file has basic responsive features (${foundHtmlFeatures.length})`));
                results.warnings++;
                results.tests.push({ 
                    name: 'HTML File Responsiveness', 
                    status: 'WARNING', 
                    details: `${foundHtmlFeatures.length} responsive features` 
                });
            } else {
                console.log(chalk.red(`❌ HTML test file lacks responsive features (${foundHtmlFeatures.length})`));
                results.failed++;
                results.tests.push({ 
                    name: 'HTML File Responsiveness', 
                    status: 'FAIL', 
                    details: `Only ${foundHtmlFeatures.length} responsive features` 
                });
            }
        } else {
            console.log(chalk.red('❌ HTML test file not found'));
            results.failed++;
            results.tests.push({ name: 'HTML File Responsiveness', status: 'FAIL', details: 'File not found' });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error analyzing HTML responsive features:', error.message));
        results.failed++;
        results.tests.push({ name: 'HTML File Responsiveness', status: 'FAIL', details: error.message });
    }
    
    // Generate Report
    console.log(chalk.cyan('\n📊 Responsive UI Testing Summary Report'));
    console.log(chalk.cyan('=' .repeat(50)));
    console.log(chalk.green(`✅ Passed: ${results.passed}`));
    console.log(chalk.yellow(`⚠️ Warnings: ${results.warnings}`));
    console.log(chalk.red(`❌ Failed: ${results.failed}`));
    console.log(chalk.cyan(`📋 Total Tests: ${results.tests.length}`));
    
    const successRate = ((results.passed + results.warnings * 0.5) / results.tests.length * 100).toFixed(1);
    console.log(chalk.cyan(`📈 Success Rate: ${successRate}%`));
    
    console.log(chalk.cyan('\n📋 Detailed Responsive Test Results:'));
    results.tests.forEach((test, index) => {
        const statusColor = test.status === 'PASS' ? chalk.green : 
                           test.status === 'WARNING' ? chalk.yellow : chalk.red;
        console.log(`${index + 1}. ${statusColor(test.status)} ${test.name}: ${test.details}`);
    });
    
    // Key Responsive Recommendations
    console.log(chalk.cyan('\n📝 Responsive Design Assessment:'));
    
    if (results.passed >= 5) {
        console.log(chalk.green('🎉 Excellent responsive design implementation!'));
        console.log(chalk.green('   - Modern CSS Grid and Flexbox layouts'));
        console.log(chalk.green('   - Comprehensive mobile optimization'));
        console.log(chalk.green('   - Proper viewport and touch handling'));
        console.log(chalk.green('   - Responsive typography and spacing'));
    } else if (results.passed + results.warnings >= 5) {
        console.log(chalk.yellow('⚡ Good responsive design with room for improvement'));
        console.log(chalk.yellow('   - Core responsive features are working'));
        console.log(chalk.yellow('   - Consider enhancing mobile touch interactions'));
        console.log(chalk.yellow('   - Review typography scaling across devices'));
    } else {
        console.log(chalk.red('🔧 Responsive design needs significant improvement'));
        console.log(chalk.red('   - Missing critical responsive breakpoints'));
        console.log(chalk.red('   - Layout may not work well on mobile devices'));
        console.log(chalk.red('   - Typography and spacing need responsiveness'));
    }
    
    // Save report to file
    const reportPath = '/Users/samihalawa/git/claude-loop/responsive-ui-test-report.json';
    fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: {
            passed: results.passed,
            warnings: results.warnings,
            failed: results.failed,
            total: results.tests.length,
            successRate: successRate
        },
        tests: results.tests,
        assessment: results.passed >= 5 ? 'Excellent' : 
                   results.passed + results.warnings >= 5 ? 'Good' : 'Needs Improvement'
    }, null, 2));
    
    console.log(chalk.cyan(`\n💾 Responsive test report saved to: ${reportPath}`));
    
    return results;
}

testResponsiveUI()
    .then((results) => {
        if (results.failed <= 1) {
            console.log(chalk.green('\n🎉 Responsive design testing completed successfully!'));
            process.exit(0);
        } else {
            console.log(chalk.yellow('\n⚠️ Some responsive design issues detected - see report above'));
            process.exit(1);
        }
    })
    .catch((error) => {
        console.error(chalk.red('\n❌ Responsive UI testing failed:'), error.message);
        process.exit(1);
    });