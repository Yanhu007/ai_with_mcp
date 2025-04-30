import * as fs from 'fs';
import * as path from 'path';
import { MCPClientManager } from '../src/main/services/mcpClientManager';

async function main() {
  try {
    // Create instance of MCPClientManager
    const mcpClientManager = new MCPClientManager();
    
    // Path to the full_mcps.json file
    const fullMcpsPath = path.join(__dirname, '../resources/full_mcps.json');
    
    console.log(`Initializing MCPClientManager with config: ${fullMcpsPath}`);
    
    // Initialize the manager with the full_mcps.json file
    await mcpClientManager.initialize(fullMcpsPath);
    
    // Get all available tools
    console.log('Getting all tools from MCP servers...');
    const allTools = await mcpClientManager.getAllTools();
    
    // Transform tools to match the required schema
    const toolsWithSchema = allTools.map(tool => ({
      tool_name: tool.name,
      tool_description: tool.description || '',
      tool_inputSchema: JSON.stringify(tool.inputSchema),
      server_name: tool.serverName
    }));
    
    // Output path for full_tools.json
    const outputPath = path.join(__dirname, '../resources/full_tools.json');
    
    // Write the tools to full_tools.json
    await fs.promises.writeFile(
      outputPath,
      JSON.stringify(toolsWithSchema, null, 2),
      'utf-8'
    );
    
    console.log(`Successfully wrote ${toolsWithSchema.length} tools to ${outputPath}`);
    
    // Clean up MCP clients
    await mcpClientManager.cleanup();
    
  } catch (error) {
    console.error('Error processing MCP tools:', error);
    process.exit(1);
  }
}

// Run the main function
main();