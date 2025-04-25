/**
 * Type definitions for MCP Server
 */

export interface McpServer {
  /** Name of the MCP server */
  name: string;
  /** Transport type ('stdio' or 'sse') */
  transport: 'stdio' | 'sse' | string;
  /** Command to execute when using stdio transport */
  command: string;
  /** Command line arguments for the command when using stdio transport */
  args: string[];
  /** Server URL to connect to when using sse transport */
  serverLink: string;
}