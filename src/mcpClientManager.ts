import { MCPClient } from './mcpClient';
import { McpServer } from './types/McpServerTypes';
import * as fs from 'fs';
import * as path from 'path';

interface McpConfigFile {
  mcpServers: {
    [key: string]: {
      command?: string;
      args?: string[];
      url?: string;
    };
  };
}

export class MCPClientManager {
  private mcpClients: Map<string, MCPClient> = new Map();
  private toolToClientMap: Map<string, MCPClient> = new Map();
  
  /**
   * Initialize the MCPClientManager by loading MCP server configurations
   * from the specified JSON file and creating MCPClient instances
   * 
   * @param configPath - Path to the MCP configuration JSON file
   * @returns A promise that resolves when all clients are initialized
   */
  async initialize(configPath: string = path.join(__dirname, '../resources/mcp.json')): Promise<void> {
    try {
      // Read and parse the MCP configuration file
      const configData = await fs.promises.readFile(configPath, 'utf-8');
      const config: McpConfigFile = JSON.parse(configData);
      
      // Create and initialize MCPClient instances for each server
      for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
        // Convert the config format to match McpServer interface
        const mcpServer: McpServer = {
          name: serverName,
          transport: serverConfig.url ? 'sse' : 'stdio',
          command: serverConfig.command || '',
          args: serverConfig.args || [],
          serverLink: serverConfig.url || ''
        };
        
        // Create a new MCPClient instance
        const client = new MCPClient(mcpServer);
        
        // Store the client in the map
        this.mcpClients.set(serverName, client);
        
        // Try to connect to the server and get the tools
        try {
          const result = await client.connectToServer();
          if (result === 'connected') {
            const tools = await client.getTools();
            
            // Create mappings from tool names to this client
            tools.forEach(tool => {
              this.toolToClientMap.set(tool.name, client);
            });
          }
        } catch (error) {
          console.error(`Failed to initialize MCPClient for server ${serverName}:`, error);
        }
      }
    } catch (error) {
      console.error('Error initializing MCPClientManager:', error);
      throw error;
    }
  }
  
  /**
   * Get an MCPClient instance by server name
   * 
   * @param serverName - The name of the MCP server
   * @returns The MCPClient instance or undefined if not found
   */
  getClientByServerName(serverName: string): MCPClient | undefined {
    return this.mcpClients.get(serverName);
  }
  
  /**
   * Get an MCPClient instance by tool name
   * 
   * @param toolName - The name of the tool
   * @returns The MCPClient instance or undefined if not found
   */
  getClientByToolName(toolName: string): MCPClient | undefined {
    return this.toolToClientMap.get(toolName);
  }
  
  /**
   * Get all MCPClient instances with their associated tools
   * 
   * @returns An array of objects containing the server name and tool names
   */
  getAllClientsWithTools(): { serverName: string; toolNames: string[] }[] {
    const result: { serverName: string; toolNames: string[] }[] = [];
    
    for (const [serverName, client] of this.mcpClients.entries()) {
      const toolNames: string[] = [];
      
      // Find all tools associated with this client
      this.toolToClientMap.forEach((mappedClient, toolName) => {
        if (mappedClient === client) {
          toolNames.push(toolName);
        }
      });
      
      result.push({ serverName, toolNames });
    }
    
    return result;
  }
  
  /**
   * Get all MCPClient server names
   * 
   * @returns An array of all server names
   */
  getAllServerNames(): string[] {
    return Array.from(this.mcpClients.keys());
  }
  
  /**
   * Get all available tools from all MCPClient instances as a flat array
   * 
   * @returns A flat array of all available tools across all clients
   */
  async getAllTools(): Promise<{name: string, description?: string, inputSchema: any, serverName: string}[]> {
    const result: {name: string, description?: string, inputSchema: any, serverName: string}[] = [];
    
    for (const [serverName, client] of this.mcpClients.entries()) {
      try {
        const tools = await client.getTools();
        tools.forEach(tool => {
          result.push({
            ...tool,
            serverName
          });
        });
      } catch (error) {
        console.error(`Error getting tools from server ${serverName}:`, error);
      }
    }
    
    return result;
  }
  
  /**
   * Execute a tool with the given name and arguments
   * 
   * @param toolName - The name of the tool to execute
   * @param toolArgs - The arguments to pass to the tool
   * @returns The tool's response content as a string
   * @throws Error if the tool or client is not found
   */
  async executeTool({ toolName, toolArgs }: { toolName: string, toolArgs: { [key: string]: unknown } }): Promise<string> {
    const client = this.getClientByToolName(toolName);
    
    if (!client) {
      throw new Error(`No client found for tool: ${toolName}`);
    }
    
    return client.executeTool({ toolName, toolArgs });
  }
  
  /**
   * Clean up all MCPClient instances
   */
  async cleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.mcpClients.values()).map(client => 
      client.cleanup().catch(error => 
        console.error('Error cleaning up MCPClient:', error)
      )
    );
    
    await Promise.all(cleanupPromises);
    
    this.mcpClients.clear();
    this.toolToClientMap.clear();
  }
}