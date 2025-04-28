import { MCPClient } from './mcpClient';
import { McpServer } from '../types/McpServerTypes';
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
  private configPath: string = path.join(__dirname, '../../../resources/mcp.json');
  
  /**
   * Initialize the MCPClientManager by loading MCP server configurations
   * from the specified JSON file and creating MCPClient instances
   * 
   * @param configPath - Path to the MCP configuration JSON file
   * @returns A promise that resolves when all clients are initialized
   */
  async initialize(configPath: string = path.join(__dirname, '../../../resources/mcp.json')): Promise<void> {
    try {
      // Read and parse the MCP configuration file
      const configData = await fs.promises.readFile(configPath, 'utf-8');
      const config: McpConfigFile = JSON.parse(configData);
      
      console.log('Loaded MCP configuration:', JSON.stringify(config, null, 2));
      
      // Create and initialize MCPClient instances for each server
      const serverEntries = Object.entries(config.mcpServers);
      for (let i = 0; i < serverEntries.length; i++) {
        const [serverName, serverConfig] = serverEntries[i];
        
        // Convert the config format to match McpServer interface
        const mcpServer: McpServer = {
          name: serverName,
          transport: serverConfig.url ? 'sse' : 'stdio',
          command: serverConfig.command || '',
          args: serverConfig.args || [],
          serverLink: serverConfig.url || ''
        };
        
        console.log(`Initializing MCPClient for server ${serverName} with config:`, mcpServer);
        
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
            
            console.log(`Client ${serverName} initialized successfully with ${tools.length} tools.`);
          } else if (result instanceof Error) {
            console.error(`Failed to connect to server ${serverName}:`, result.message);
            // Keep the client in the map even if initial connection failed
            // It might be able to connect later
          }
        } catch (error) {
          console.error(`Error initializing MCPClient for server ${serverName}:`, error);
        }
      }
    } catch (error) {
      console.error('Error initializing MCPClientManager:', error);
      throw error;
    }
  }
  
  /**
   * Add a new MCP server to the configuration file and create a client instance
   * 
   * @param serverConfig - Configuration for the new server
   * @returns A promise that resolves to the server name if successful, or rejects with an error
   */
  async addServer(serverConfig: McpConfigFile): Promise<string> {
    try {
      // Validate the server configuration
      if (!serverConfig.mcpServers || Object.keys(serverConfig.mcpServers).length === 0) {
        throw new Error('Invalid server configuration: mcpServers is missing or empty');
      }
      
      const [[serverName, config]] = Object.entries(serverConfig.mcpServers);
      
      if (!serverName) {
        throw new Error('Invalid server configuration: server name is missing');
      }
      
      if (this.mcpClients.has(serverName)) {
        throw new Error(`Server with name "${serverName}" already exists`);
      }
      
      if (!config.command && !config.url) {
        throw new Error('Invalid server configuration: either command or url must be provided');
      }
      
      // Read existing configuration
      let existingConfig: McpConfigFile;
      try {
        const configData = await fs.promises.readFile(this.configPath, 'utf-8');
        existingConfig = JSON.parse(configData);
      } catch (error) {
        // If the file doesn't exist or is invalid, create a new config
        existingConfig = { mcpServers: {} };
      }
      
      // Add the new server to the configuration
      existingConfig.mcpServers[serverName] = config;
      
      // Write the updated configuration to the file
      await fs.promises.writeFile(
        this.configPath,
        JSON.stringify(existingConfig, null, 2),
        'utf-8'
      );
      
      // Create and initialize the new MCPClient
      const mcpServer: McpServer = {
        name: serverName,
        transport: config.url ? 'sse' : 'stdio',
        command: config.command || '',
        args: config.args || [],
        serverLink: config.url || ''
      };
      
      const client = new MCPClient(mcpServer);
      
      // Store the client in the map
      this.mcpClients.set(serverName, client);
      
      // Try to connect to the server and get tools
      try {
        const result = await client.connectToServer();
        if (result === 'connected') {
          const tools = await client.getTools();
          
          // Create mappings from tool names to this client
          tools.forEach(tool => {
            this.toolToClientMap.set(tool.name, client);
          });
          
          console.log(`Client ${serverName} initialized successfully with ${tools.length} tools.`);
        } else if (result instanceof Error) {
          console.error(`Failed to connect to server ${serverName}:`, result.message);
          // Keep the client in the map even if initial connection failed
        }
      } catch (error) {
        console.error(`Error initializing MCPClient for server ${serverName}:`, error);
      }
      
      return serverName;
    } catch (error) {
      console.error('Error adding server:', error);
      throw error;
    }
  }

  /**
   * Get the path to the MCP configuration file
   * 
   * @returns The path to the MCP configuration file
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Update an existing MCP server in the configuration file and reconnect
   * 
   * @param serverConfig - Updated configuration for the server
   * @returns A promise that resolves to the server name if successful, or rejects with an error
   */
  async updateServer(serverConfig: McpConfigFile): Promise<string> {
    try {
      // Validate the server configuration
      if (!serverConfig.mcpServers || Object.keys(serverConfig.mcpServers).length === 0) {
        throw new Error('Invalid server configuration: mcpServers is missing or empty');
      }
      
      const [[serverName, config]] = Object.entries(serverConfig.mcpServers);
      
      if (!serverName) {
        throw new Error('Invalid server configuration: server name is missing');
      }
      
      if (!this.mcpClients.has(serverName)) {
        throw new Error(`Server with name "${serverName}" does not exist`);
      }
      
      if (!config.command && !config.url) {
        throw new Error('Invalid server configuration: either command or url must be provided');
      }
      
      // Read existing configuration
      let existingConfig: McpConfigFile;
      try {
        const configData = await fs.promises.readFile(this.configPath, 'utf-8');
        existingConfig = JSON.parse(configData);
      } catch (error) {
        throw new Error(`Failed to read existing configuration: ${(error as Error).message}`);
      }
      
      // Update the server in the configuration
      existingConfig.mcpServers[serverName] = config;
      
      // Write the updated configuration to the file
      await fs.promises.writeFile(
        this.configPath,
        JSON.stringify(existingConfig, null, 2),
        'utf-8'
      );
      
      // Get the existing client and clean it up
      const existingClient = this.mcpClients.get(serverName);
      if (existingClient) {
        // Remove tool mappings for this client
        for (const [toolName, client] of this.toolToClientMap.entries()) {
          if (client === existingClient) {
            this.toolToClientMap.delete(toolName);
          }
        }
        
        // Clean up the existing client connection
        await existingClient.cleanup();
      }
      
      // Create and initialize the new MCPClient with updated config
      const mcpServer: McpServer = {
        name: serverName,
        transport: config.url ? 'sse' : 'stdio',
        command: config.command || '',
        args: config.args || [],
        serverLink: config.url || ''
      };
      
      const client = new MCPClient(mcpServer);
      
      // Store the client in the map, replacing the old one
      this.mcpClients.set(serverName, client);
      
      // Try to connect to the server and get tools
      try {
        const result = await client.connectToServer();
        if (result === 'connected') {
          const tools = await client.getTools();
          
          // Create mappings from tool names to this client
          tools.forEach(tool => {
            this.toolToClientMap.set(tool.name, client);
          });
          
          console.log(`Client ${serverName} updated and initialized successfully with ${tools.length} tools.`);
        } else if (result instanceof Error) {
          console.error(`Failed to connect to updated server ${serverName}:`, result.message);
          // Keep the client in the map even if initial connection failed
        }
      } catch (error) {
        console.error(`Error initializing updated MCPClient for server ${serverName}:`, error);
      }
      
      return serverName;
    } catch (error) {
      console.error('Error updating server:', error);
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