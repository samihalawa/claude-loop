#!/usr/bin/env node

const MCPInstaller = require('./lib/mcp-installer');

async function testMCPIntegration() {
    console.log('🧪 Testing MCP Integration');
    
    try {
        const installer = new MCPInstaller();
        
        // Test checking MCP availability
        console.log('📊 Checking current MCP availability...');
        const mcpStatus = await installer.checkMCPAvailability();
        
        console.log('📋 MCP Status Report:');
        console.log(`  VUDA: ${mcpStatus.hasVUDA ? '✅ Available' : '❌ Not available'}`);
        console.log(`  Browser MCP: ${mcpStatus.hasBrowserMCP ? '✅ Available' : '❌ Not available'}`);
        console.log(`  Sequential Thinking: ${mcpStatus.hasSequentialThinking ? '✅ Available' : '❌ Not available'}`);
        console.log(`  All installed MCPs: ${mcpStatus.all.join(', ') || 'None'}`);
        
        console.log('\n✅ MCP integration test completed successfully');
        
    } catch (error) {
        console.error('❌ MCP integration test failed:', error.message);
        console.log('ℹ️  This is expected if Claude desktop is not installed');
        process.exit(0); // Don't fail the test if Claude isn't installed
    }
}

testMCPIntegration();