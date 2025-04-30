import * as fs from 'fs';
import * as path from 'path';
import { McpServer } from '../types/McpServerTypes';

// Type definitions for the tool and server configuration
interface McpConfigFile {
  mcpServers: {
    [key: string]: {
      command?: string;
      args?: string[];
      url?: string;
    };
  };
}

export interface FullToolInfo {
  tool_name: string;
  tool_description: string;
  tool_inputSchema: string;
  server_name: string;
}

export interface FormattedToolInfo {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export class McpMarketPlaceManager {
  private fullMcpServers: McpConfigFile = { mcpServers: {} };
  private fullTools: FullToolInfo[] = [];
  private formattedTools: FormattedToolInfo[] = [];
  private toolToServerMap: Map<string, string> = new Map();
  
  private fullMcpsPath: string = path.join(__dirname, '../../../resources/full_mcps.json');
  private fullToolsPath: string = path.join(__dirname, '../../../resources/full_tools.json');

  /**
   * Initialize the McpMarketPlaceManager by loading MCP server and tool configurations
   * from the JSON files in the resources directory
   */
  async initialize(): Promise<void> {
    try {
      // Load MCP servers
      const mcpsData = await fs.promises.readFile(this.fullMcpsPath, 'utf-8');
      this.fullMcpServers = JSON.parse(mcpsData);
      
      console.log('Loaded full MCP server configurations:', 
        Object.keys(this.fullMcpServers.mcpServers).length);
      
      // Load tools
      const toolsData = await fs.promises.readFile(this.fullToolsPath, 'utf-8');
      this.fullTools = JSON.parse(toolsData);
      
      console.log('Loaded full tool configurations:', this.fullTools.length);
      
      // Debug each tool schema to validate it's properly parsed
      this.fullTools.forEach((tool, index) => {
        if (!tool.tool_name || !tool.tool_inputSchema) {
          console.warn(`Tool at index ${index} has invalid format:`, tool);
        }
      });
      
      // Format tools for Azure OpenAI API and build tool-to-server mapping
      this.formattedTools = this.fullTools.map((tool, index) => {
        try {
          // Store tool to server mapping
          if (tool.tool_name && tool.server_name) {
            this.toolToServerMap.set(tool.tool_name, tool.server_name);
          }
          
          // Parse the inputSchema
          let parsedSchema = {};
          try {
            parsedSchema = JSON.parse(tool.tool_inputSchema);
          } catch (parseErr) {
            console.error(`Error parsing schema for tool ${tool.tool_name}:`, parseErr);
            // Use a default schema if parsing fails
            parsedSchema = {
              "type": "object", 
              "properties": {}, 
              "required": []
            };
          }
          
          // Format tool for Azure OpenAI API
          return {
            type: "function",
            function: {
              name: tool.tool_name,
              description: tool.tool_description || "",
              parameters: parsedSchema
            }
          };
        } catch (err) {
          console.error(`Error formatting tool ${tool.tool_name || 'unknown'}:`, err);
          // Return a placeholder for invalid tools
          return {
            type: "function",
            function: {
              name: tool.tool_name || `unknown_tool_${index}`,
              description: "Error formatting tool description",
              parameters: {
                "type": "object", 
                "properties": {}, 
                "required": []
              }
            }
          };
        }
      });
      
      // Log a sample of the formatted tools
      if (this.formattedTools.length > 0) {
        console.log('Sample formatted tool:', 
          JSON.stringify(this.formattedTools[0], null, 2));
      }
      
      console.log('Marketplace initialization complete with', 
        this.formattedTools.length, 'formatted tools');
    } catch (error) {
      console.error('Error initializing McpMarketPlaceManager:', error);
      throw error;
    }
  }
  
  /**
   * Get all tools formatted for Azure OpenAI API
   */
  getAllFormattedTools(): FormattedToolInfo[] {
    return this.formattedTools;
  }
  
  /**
   * Get all raw tool information
   */
  getAllFullTools(): FullToolInfo[] {
    return this.fullTools;
  }
  
  /**
   * Get all MCP server configurations
   */
  getAllMcpServers(): McpConfigFile {
    return this.fullMcpServers;
  }
  
  /**
   * Get server name for a given tool
   * @param toolName - The name of the tool
   * @returns The name of the server or undefined if not found
   */
  getServerNameForTool(toolName: string): string | undefined {
    return this.toolToServerMap.get(toolName);
  }
  
  /**
   * Get tool information by name
   * @param toolName - The name of the tool
   * @returns The tool information or undefined if not found
   */
  getToolByName(toolName: string): FullToolInfo | undefined {
    return this.fullTools.find(tool => tool.tool_name === toolName);
  }
  
  /**
   * Get formatted tool information by name
   * @param toolName - The name of the tool
   * @returns The formatted tool information or undefined if not found
   */
  getFormattedToolByName(toolName: string): FormattedToolInfo | undefined {
    return this.formattedTools.find(tool => tool.function.name === toolName);
  }
  
  /**
   * Get MCP server configuration by name
   * @param serverName - The name of the server
   * @returns The server configuration or undefined if not found
   */
  getMcpServerByName(serverName: string): McpServer | undefined {
    const serverConfig = this.fullMcpServers.mcpServers[serverName];
    
    if (serverConfig) {
      return {
        name: serverName,
        transport: serverConfig.url ? 'sse' : 'stdio',
        command: serverConfig.command || '',
        args: serverConfig.args || [],
        serverLink: serverConfig.url || ''
      };
    }
    
    return undefined;
  }
  
  /**
   * Get server configuration by tool name
   * @param toolName - The name of the tool
   * @returns The server configuration or undefined if not found
   */
  getServerConfigForTool(toolName: string): McpServer | undefined {
    const serverName = this.getServerNameForTool(toolName);
    
    if (serverName) {
      return this.getMcpServerByName(serverName);
    }
    
    return undefined;
  }
  
  /**
   * Get all tools for a specific server
   * @param serverName - The name of the server
   * @returns Array of tools for the specified server
   */
  getToolsForServer(serverName: string): FullToolInfo[] {
    return this.fullTools.filter(tool => tool.server_name === serverName);
  }
}