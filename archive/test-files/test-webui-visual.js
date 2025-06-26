const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TOKEN = 'd81218ca826364f9f525bb33721c30a95b5a93b6de9f5c9137025ca6ae4d6d020c587ec4ce601d0dff8670e01fde0d9518d11e01823bf188a32be6234862dc2d';
const BASE_URL = `http://localhost:3333?token=${TOKEN}`;

async function testWebUI() {
    let browser;
    
    try {
        console.log('🌐 Starting browser for Web UI testing...');
        browser = await puppeteer.launch({ 
            headless: false,
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-web-security']
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        
        console.log('📱 Navigating to Web UI...');
        await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
        
        // Take initial screenshot
        console.log('📸 Taking screenshots...');
        await page.screenshot({ 
            path: 'webui-screenshot-desktop.png', 
            fullPage: true 
        });
        
        // Test responsive design
        await page.setViewport({ width: 768, height: 1024 });
        await page.screenshot({ 
            path: 'webui-screenshot-tablet.png', 
            fullPage: true 
        });
        
        await page.setViewport({ width: 375, height: 667 });
        await page.screenshot({ 
            path: 'webui-screenshot-mobile.png', 
            fullPage: true 
        });
        
        // Test elements
        console.log('🔍 Testing UI elements...');
        
        // Check page title
        const title = await page.title();
        console.log(`✅ Page title: ${title}`);
        
        // Check key elements exist
        const elements = await page.evaluate(() => {
            return {
                hasHeader: !!document.querySelector('.app-header'),
                hasStatusGrid: !!document.querySelector('.status-grid'),
                hasOutputContainer: !!document.querySelector('.output-container'),
                hasConnectionStatus: !!document.querySelector('.connection-status'),
                hasAutoScrollCheckbox: !!document.querySelector('#autoScroll'),
                hasSessionStatus: !!document.getElementById('status'),
                hasIterations: !!document.getElementById('iterations'),
                hasCurrentPhase: !!document.getElementById('currentPhase'),
                hasRuntime: !!document.getElementById('runtime'),
                hasOutputContent: !!document.getElementById('output')
            };
        });
        
        console.log('🔍 UI Elements Found:');
        Object.entries(elements).forEach(([key, found]) => {
            console.log(`  ${found ? '✅' : '❌'} ${key}: ${found}`);
        });
        
        // Test WebSocket connection
        console.log('🔌 Testing WebSocket connection...');
        const wsStatus = await page.evaluate(() => {
            return new Promise((resolve) => {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const token = new URLSearchParams(window.location.search).get('token');
                const ws = new WebSocket(`${protocol}//${window.location.host}?token=${encodeURIComponent(token)}`);
                
                ws.onopen = () => {
                    console.log('WebSocket connected');
                    ws.close();
                    resolve({ connected: true, error: null });
                };
                
                ws.onerror = (error) => {
                    resolve({ connected: false, error: error.toString() });
                };
                
                setTimeout(() => {
                    resolve({ connected: false, error: 'Timeout' });
                }, 5000);
            });
        });
        
        console.log(`🔌 WebSocket Status: ${wsStatus.connected ? '✅ Connected' : '❌ Failed'}`);
        if (!wsStatus.connected) {
            console.log(`   Error: ${wsStatus.error}`);
        }
        
        // Test API endpoints
        console.log('🔗 Testing API endpoints...');
        const apiTests = await page.evaluate(async () => {
            const token = new URLSearchParams(window.location.search).get('token');
            const results = {};
            
            try {
                const healthResponse = await fetch(`/health?token=${token}`);
                results.health = {
                    status: healthResponse.status,
                    ok: healthResponse.ok,
                    data: await healthResponse.json()
                };
            } catch (error) {
                results.health = { error: error.toString() };
            }
            
            try {
                const sessionResponse = await fetch(`/api/session?token=${token}`);
                results.session = {
                    status: sessionResponse.status,
                    ok: sessionResponse.ok,
                    data: await sessionResponse.json()
                };
            } catch (error) {
                results.session = { error: error.toString() };
            }
            
            return results;
        });
        
        console.log('🔗 API Test Results:');
        console.log(`  Health endpoint: ${apiTests.health.ok ? '✅' : '❌'} (${apiTests.health.status})`);
        console.log(`  Session endpoint: ${apiTests.session.ok ? '✅' : '❌'} (${apiTests.session.status})`);
        
        // Test checkbox interaction
        console.log('🖱️ Testing checkbox interaction...');
        await page.click('#autoScroll');
        const checkboxState = await page.evaluate(() => {
            return document.getElementById('autoScroll').checked;
        });
        console.log(`✅ Checkbox interaction: ${checkboxState ? 'Checked' : 'Unchecked'}`);
        
        console.log('✅ Web UI testing completed successfully!');
        
        // Keep browser open for manual inspection
        console.log('🔍 Browser left open for manual inspection...');
        await page.waitForTimeout(10000); // Wait 10 seconds
        
    } catch (error) {
        console.error('❌ Error during Web UI testing:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run the test
testWebUI().catch(console.error);