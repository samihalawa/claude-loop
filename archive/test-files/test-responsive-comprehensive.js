#!/usr/bin/env node

const fs = require('fs');
const chalk = require('chalk');
const { spawn } = require('child_process');

async function testResponsiveComprehensive() {
    console.log(chalk.cyan('🧪 Comprehensive Responsive Design Testing\n'));
    
    const results = {
        passed: 0,
        failed: 0,
        warnings: 0,
        tests: []
    };
    
    const token = process.env.WEBUI_TEST_TOKEN || require('crypto').randomBytes(48).toString('hex');
    const port = process.env.TEST_BROWSER_UI_PORT || 3998;
    const baseUrl = `http://localhost:${port}`;
    
    // Test 1: CSS Media Query Analysis
    console.log(chalk.blue('Test 1: CSS Media Query Implementation'));
    try {
        const response = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        const mediaQueries = [
            { pattern: '@media (max-width: 768px)', name: 'Mobile breakpoint (768px)', critical: true },
            { pattern: 'flex-direction: column', name: 'Mobile column layout', critical: true },
            { pattern: 'grid-template-columns: 1fr', name: 'Single column grid for mobile', critical: true },
            { pattern: 'padding: 1rem', name: 'Responsive padding', critical: false },
            { pattern: 'font-size: 1.5rem', name: 'Responsive headings', critical: false },
            { pattern: 'gap: 1rem', name: 'Responsive spacing', critical: false }
        ];
        
        let foundQueries = [];
        let criticalMissing = [];
        
        for (const query of mediaQueries) {
            if (response.includes(query.pattern)) {
                foundQueries.push(query.name);
            } else if (query.critical) {
                criticalMissing.push(query.name);
            }
        }
        
        if (criticalMissing.length === 0) {
            console.log(chalk.green('✅ All critical media queries implemented'));
            console.log(chalk.gray(`   Found: ${foundQueries.join(', ')}`));
            results.passed++;
            results.tests.push({ 
                name: 'Media Queries', 
                status: 'PASS', 
                details: `${foundQueries.length} responsive features found` 
            });
        } else {
            console.log(chalk.red(`❌ Missing critical media queries: ${criticalMissing.join(', ')}`));
            results.failed++;
            results.tests.push({ 
                name: 'Media Queries', 
                status: 'FAIL', 
                details: `Missing: ${criticalMissing.join(', ')}` 
            });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error analyzing media queries:', error.message));
        results.failed++;
        results.tests.push({ name: 'Media Queries', status: 'FAIL', details: error.message });
    }
    
    // Test 2: Viewport Configuration
    console.log(chalk.blue('\nTest 2: Viewport Meta Tag Configuration'));
    try {
        const response = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        const viewportChecks = [
            { pattern: 'name="viewport"', name: 'Viewport meta tag present', required: true },
            { pattern: 'width=device-width', name: 'Device width setting', required: true },
            { pattern: 'initial-scale=1.0', name: 'Proper initial scale', required: true }
        ];
        
        let viewportScore = 0;
        let missingRequired = [];
        
        for (const check of viewportChecks) {
            if (response.includes(check.pattern)) {
                viewportScore++;
            } else if (check.required) {
                missingRequired.push(check.name);
            }
        }
        
        if (missingRequired.length === 0) {
            console.log(chalk.green('✅ Viewport configuration is optimal'));
            results.passed++;
            results.tests.push({ 
                name: 'Viewport Configuration', 
                status: 'PASS', 
                details: `All ${viewportScore} viewport settings correct` 
            });
        } else {
            console.log(chalk.red(`❌ Missing viewport settings: ${missingRequired.join(', ')}`));
            results.failed++;
            results.tests.push({ 
                name: 'Viewport Configuration', 
                status: 'FAIL', 
                details: `Missing: ${missingRequired.join(', ')}` 
            });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error checking viewport configuration:', error.message));
        results.failed++;
        results.tests.push({ name: 'Viewport Configuration', status: 'FAIL', details: error.message });
    }
    
    // Test 3: Flexible Layout Systems
    console.log(chalk.blue('\nTest 3: Flexible Layout Systems (CSS Grid & Flexbox)'));
    try {
        const response = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        const layoutSystems = [
            { pattern: 'display: grid', name: 'CSS Grid' },
            { pattern: 'grid-template-columns:', name: 'Grid columns' },
            { pattern: 'grid-gap:', name: 'Grid gap' },
            { pattern: 'gap:', name: 'Modern gap property' },
            { pattern: 'display: flex', name: 'Flexbox' },
            { pattern: 'flex-direction:', name: 'Flex direction' },
            { pattern: 'justify-content:', name: 'Flex justify' },
            { pattern: 'align-items:', name: 'Flex align' },
            { pattern: 'auto-fit', name: 'Responsive grid auto-fit' },
            { pattern: 'minmax(', name: 'Grid minmax' }
        ];
        
        let foundSystems = [];
        for (const system of layoutSystems) {
            if (response.includes(system.pattern)) {
                foundSystems.push(system.name);
            }
        }
        
        const gridCount = foundSystems.filter(s => s.includes('Grid') || s.includes('grid')).length;
        const flexCount = foundSystems.filter(s => s.includes('Flex') || s.includes('flex')).length;
        
        if (gridCount >= 3 && flexCount >= 3) {
            console.log(chalk.green('✅ Excellent modern layout implementation'));
            console.log(chalk.gray(`   Grid features: ${gridCount}, Flexbox features: ${flexCount}`));
            results.passed++;
            results.tests.push({ 
                name: 'Layout Systems', 
                status: 'PASS', 
                details: `Grid: ${gridCount}, Flexbox: ${flexCount}` 
            });
        } else if (foundSystems.length >= 5) {
            console.log(chalk.yellow(`⚠️ Good layout implementation (${foundSystems.length} features)`));
            results.warnings++;
            results.tests.push({ 
                name: 'Layout Systems', 
                status: 'WARNING', 
                details: `${foundSystems.length} layout features` 
            });
        } else {
            console.log(chalk.red(`❌ Limited layout flexibility (${foundSystems.length} features)`));
            results.failed++;
            results.tests.push({ 
                name: 'Layout Systems', 
                status: 'FAIL', 
                details: `Only ${foundSystems.length} layout features` 
            });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error analyzing layout systems:', error.message));
        results.failed++;
        results.tests.push({ name: 'Layout Systems', status: 'FAIL', details: error.message });
    }
    
    // Test 4: Typography Responsiveness
    console.log(chalk.blue('\nTest 4: Responsive Typography'));
    try {
        const response = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        const typographyFeatures = [
            { pattern: 'font-size: 2.5rem', name: 'Large text (rem units)' },
            { pattern: 'font-size: 1.8rem', name: 'Medium text (rem units)' },
            { pattern: 'font-size: 0.875rem', name: 'Small text optimization' },
            { pattern: 'line-height:', name: 'Line height settings' },
            { pattern: 'letter-spacing:', name: 'Letter spacing' },
            { pattern: 'font-weight:', name: 'Font weight variations' }
        ];
        
        let foundTypography = [];
        for (const feature of typographyFeatures) {
            if (response.includes(feature.pattern)) {
                foundTypography.push(feature.name);
            }
        }
        
        if (foundTypography.length >= 5) {
            console.log(chalk.green('✅ Excellent responsive typography'));
            console.log(chalk.gray(`   Features: ${foundTypography.join(', ')}`));
            results.passed++;
            results.tests.push({ 
                name: 'Typography', 
                status: 'PASS', 
                details: `${foundTypography.length} typography features` 
            });
        } else if (foundTypography.length >= 3) {
            console.log(chalk.yellow(`⚠️ Good typography (${foundTypography.length} features)`));
            results.warnings++;
            results.tests.push({ 
                name: 'Typography', 
                status: 'WARNING', 
                details: `${foundTypography.length} features found` 
            });
        } else {
            console.log(chalk.red(`❌ Limited typography responsiveness (${foundTypography.length})`));
            results.failed++;
            results.tests.push({ 
                name: 'Typography', 
                status: 'FAIL', 
                details: `Only ${foundTypography.length} features` 
            });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error analyzing typography:', error.message));
        results.failed++;
        results.tests.push({ name: 'Typography', status: 'FAIL', details: error.message });
    }
    
    // Test 5: Touch and Mobile Optimization
    console.log(chalk.blue('\nTest 5: Touch and Mobile Optimization'));
    try {
        const response = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        const touchFeatures = [
            { pattern: 'padding: 0.75rem 1.5rem', name: 'Adequate touch targets' },
            { pattern: 'min-width: 120px', name: 'Minimum button width' },
            { pattern: 'cursor: pointer', name: 'Pointer interactions' },
            { pattern: 'transition:', name: 'Smooth interactions' },
            { pattern: ':hover', name: 'Hover states' },
            { pattern: ':focus', name: 'Focus states for accessibility' }
        ];
        
        let foundTouch = [];
        for (const feature of touchFeatures) {
            if (response.includes(feature.pattern)) {
                foundTouch.push(feature.name);
            }
        }
        
        if (foundTouch.length >= 5) {
            console.log(chalk.green('✅ Excellent touch optimization'));
            console.log(chalk.gray(`   Features: ${foundTouch.join(', ')}`));
            results.passed++;
            results.tests.push({ 
                name: 'Touch Optimization', 
                status: 'PASS', 
                details: `${foundTouch.length} touch features` 
            });
        } else if (foundTouch.length >= 3) {
            console.log(chalk.yellow(`⚠️ Good touch features (${foundTouch.length})`));
            results.warnings++;
            results.tests.push({ 
                name: 'Touch Optimization', 
                status: 'WARNING', 
                details: `${foundTouch.length} features found` 
            });
        } else {
            console.log(chalk.red(`❌ Limited touch optimization (${foundTouch.length})`));
            results.failed++;
            results.tests.push({ 
                name: 'Touch Optimization', 
                status: 'FAIL', 
                details: `Only ${foundTouch.length} features` 
            });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error analyzing touch optimization:', error.message));
        results.failed++;
        results.tests.push({ name: 'Touch Optimization', status: 'FAIL', details: error.message });
    }
    
    // Test 6: Container and Spacing Responsiveness
    console.log(chalk.blue('\nTest 6: Container and Spacing Systems'));
    try {
        const response = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        const containerFeatures = [
            { pattern: 'max-width: 1400px', name: 'Maximum container width' },
            { pattern: 'margin: 0 auto', name: 'Container centering' },
            { pattern: 'width: 100%', name: 'Full width elements' },
            { pattern: 'padding: 2rem', name: 'Consistent padding scale' },
            { pattern: 'padding: 1rem', name: 'Mobile padding' },
            { pattern: 'box-sizing: border-box', name: 'Border box model' }
        ];
        
        let foundContainer = [];
        for (const feature of containerFeatures) {
            if (response.includes(feature.pattern)) {
                foundContainer.push(feature.name);
            }
        }
        
        if (foundContainer.length >= 5) {
            console.log(chalk.green('✅ Excellent container management'));
            console.log(chalk.gray(`   Features: ${foundContainer.join(', ')}`));
            results.passed++;
            results.tests.push({ 
                name: 'Container Systems', 
                status: 'PASS', 
                details: `${foundContainer.length} container features` 
            });
        } else if (foundContainer.length >= 3) {
            console.log(chalk.yellow(`⚠️ Good container features (${foundContainer.length})`));
            results.warnings++;
            results.tests.push({ 
                name: 'Container Systems', 
                status: 'WARNING', 
                details: `${foundContainer.length} features found` 
            });
        } else {
            console.log(chalk.red(`❌ Limited container responsiveness (${foundContainer.length})`));
            results.failed++;
            results.tests.push({ 
                name: 'Container Systems', 
                status: 'FAIL', 
                details: `Only ${foundContainer.length} features` 
            });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error analyzing container systems:', error.message));
        results.failed++;
        results.tests.push({ name: 'Container Systems', status: 'FAIL', details: error.message });
    }
    
    // Test 7: Cross-Device Compatibility Features
    console.log(chalk.blue('\nTest 7: Cross-Device Compatibility'));
    try {
        const response = await new Promise((resolve, reject) => {
            const curl = spawn('curl', ['-s', `${baseUrl}?token=${token}`]);
            let data = '';
            curl.stdout.on('data', chunk => data += chunk);
            curl.on('close', () => resolve(data));
            curl.on('error', reject);
        });
        
        const compatibilityFeatures = [
            { pattern: '-webkit-', name: 'WebKit prefixes' },
            { pattern: '-moz-', name: 'Mozilla prefixes' },
            { pattern: 'overflow-x: hidden', name: 'Horizontal scroll prevention' },
            { pattern: 'min-height: 100vh', name: 'Full viewport height' },
            { pattern: '-webkit-font-smoothing:', name: 'Font smoothing' },
            { pattern: 'text-rendering:', name: 'Text rendering optimization' }
        ];
        
        let foundCompatibility = [];
        for (const feature of compatibilityFeatures) {
            if (response.includes(feature.pattern)) {
                foundCompatibility.push(feature.name);
            }
        }
        
        if (foundCompatibility.length >= 4) {
            console.log(chalk.green('✅ Good cross-device compatibility'));
            console.log(chalk.gray(`   Features: ${foundCompatibility.join(', ')}`));
            results.passed++;
            results.tests.push({ 
                name: 'Cross-Device Compatibility', 
                status: 'PASS', 
                details: `${foundCompatibility.length} compatibility features` 
            });
        } else if (foundCompatibility.length >= 2) {
            console.log(chalk.yellow(`⚠️ Basic compatibility features (${foundCompatibility.length})`));
            results.warnings++;
            results.tests.push({ 
                name: 'Cross-Device Compatibility', 
                status: 'WARNING', 
                details: `${foundCompatibility.length} features found` 
            });
        } else {
            console.log(chalk.red(`❌ Limited cross-device support (${foundCompatibility.length})`));
            results.failed++;
            results.tests.push({ 
                name: 'Cross-Device Compatibility', 
                status: 'FAIL', 
                details: `Only ${foundCompatibility.length} features` 
            });
        }
    } catch (error) {
        console.log(chalk.red('❌ Error analyzing compatibility:', error.message));
        results.failed++;
        results.tests.push({ name: 'Cross-Device Compatibility', status: 'FAIL', details: error.message });
    }
    
    // Generate Comprehensive Report
    console.log(chalk.cyan('\n📊 Comprehensive Responsive Design Summary'));
    console.log(chalk.cyan('=' .repeat(60)));
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
    
    // Responsive Assessment
    console.log(chalk.cyan('\n📱 Responsive Design Assessment:'));
    
    if (results.passed >= 6) {
        console.log(chalk.green('🎉 Outstanding responsive design implementation!'));
        console.log(chalk.green('   ✓ Mobile-first approach with comprehensive breakpoints'));
        console.log(chalk.green('   ✓ Modern CSS Grid and Flexbox for flexible layouts'));
        console.log(chalk.green('   ✓ Optimized typography scaling across all devices'));
        console.log(chalk.green('   ✓ Touch-friendly interaction design'));
        console.log(chalk.green('   ✓ Cross-browser compatibility considerations'));
    } else if (results.passed + results.warnings >= 5) {
        console.log(chalk.yellow('⚡ Good responsive design with minor improvements needed'));
        console.log(chalk.yellow('   ✓ Core responsive features working well'));
        console.log(chalk.yellow('   → Consider enhancing touch interaction sizes'));
        console.log(chalk.yellow('   → Review cross-device compatibility features'));
    } else {
        console.log(chalk.red('🔧 Responsive design needs significant improvements'));
        console.log(chalk.red('   × Missing critical mobile breakpoints'));
        console.log(chalk.red('   × Layout may not adapt well to different screen sizes'));
        console.log(chalk.red('   × Typography and spacing need responsive scaling'));
    }
    
    // Save comprehensive report
    const reportPath = '/Users/samihalawa/git/claude-loop/responsive-design-comprehensive-report.json';
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
        assessment: results.passed >= 6 ? 'Outstanding' : 
                   results.passed + results.warnings >= 5 ? 'Good' : 'Needs Improvement',
        recommendations: results.failed > 2 ? [
            'Implement proper mobile breakpoints',
            'Add CSS Grid and Flexbox for flexible layouts',
            'Optimize typography for different screen sizes',
            'Ensure touch targets meet minimum size requirements'
        ] : results.warnings > 1 ? [
            'Enhance touch interaction areas',
            'Add more cross-browser compatibility features',
            'Consider additional viewport optimizations'
        ] : [
            'Maintain current excellent responsive design',
            'Continue monitoring for new device support'
        ]
    }, null, 2));
    
    console.log(chalk.cyan(`\n💾 Comprehensive responsive report saved to: ${reportPath}`));
    
    return results;
}

testResponsiveComprehensive()
    .then((results) => {
        if (results.failed <= 1) {
            console.log(chalk.green('\n🎉 Comprehensive responsive design testing completed successfully!'));
            process.exit(0);
        } else {
            console.log(chalk.yellow('\n⚠️ Some responsive design issues detected - see report above'));
            process.exit(1);
        }
    })
    .catch((error) => {
        console.error(chalk.red('\n❌ Responsive design testing failed:'), error.message);
        process.exit(1);
    });