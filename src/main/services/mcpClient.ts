import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { McpServer } from "../types/McpServerTypes";

interface Tool {
  name: string;
  description?: string; // Make description optional to match the SDK type
  inputSchema: any;
}

export class MCPClient {
  private server: McpServer;
  private mcp: Client;
  private transport: StdioClientTransport | SSEClientTransport | null = null;
  private tools: Tool[] = [];

  constructor(mcpServer: McpServer) {
    this.server = mcpServer;
    this.mcp = new Client({ name: this.server.name, version: "1.0.0" });
  }

  async connectToServer(): Promise<string | Error> {
    try {
      // Initialize transport and connect to server
      this.transport = this.server.transport === 'stdio' 
        ? new StdioClientTransport({
            command: this.server.command,
            args: this.server.args,
          }) 
        : new SSEClientTransport(new URL(this.server.serverLink));

      await this.mcp.connect(this.transport);

      // List available tools
      const toolsResult = await this.mcp.listTools();
      this.tools = toolsResult.tools.map((tool) => ({
        name: tool.name,
        description: tool.description || "", // Provide a default empty string for undefined descriptions
        inputSchema: tool.inputSchema,
      }));

      console.log(
        "Connected to server with tools:",
        this.tools.map(({ name }) => name),
      );
      return "connected";
    } catch (e) {
      console.log("Failed to connect to MCP server: ", e);
      return e instanceof Error ? e : new Error(String(e));
    }
  }

  async getTools(): Promise<Tool[]> {
    return this.tools;
  }
  
  /**
   * Execute a tool with the given name and arguments
   * 
   * @param toolName - The name of the tool to execute
   * @param toolArgs - The arguments to pass to the tool
   * @returns The tool's response content as a string
   */
  async executeTool({ toolName, toolArgs }: { toolName: string, toolArgs: { [key: string]: unknown } }): Promise<string> {
    try {
      const result = await this.mcp.callTool({
        name: toolName,
        arguments: toolArgs,
      });
      
      // Return the content from the tool result
      return result.content as string;
    } catch (e) {
      console.error(`Error executing tool ${toolName}:`, e);
      throw e instanceof Error ? e : new Error(String(e));
    }
  }
  
  async cleanup(): Promise<void> {
    if (this.transport) {
      await this.mcp.close();
      this.transport = null;
    }
  }
}