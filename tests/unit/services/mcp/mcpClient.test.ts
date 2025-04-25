import { MCPClient } from '../../../../src/main/services/mcpClient';
import { McpServer } from '../../../../src/main/types/McpServerTypes';

// These tests connect to actual MCP servers, not using mocks
describe('MCPClient Integration Tests', () => {
  // Test timeouts need to be longer for real server connections
  jest.setTimeout(30000);

  test('should connect to stdio server and retrieve tools [add, divide]', async () => {
    // Arrange
    const mcpServer: McpServer = {
      name: "Demo",
      transport: "stdio",
      command: "uv",
      args: ["--directory", "C:\\Repo\\mcp-demo\\mcp-server-demo", "run", "server.py"],
      serverLink: ""
    };
    
    // Act
    const client = new MCPClient(mcpServer);
    const connectionResult = await client.connectToServer();
    const tools = await client.getTools();
    const toolNames = tools.map(tool => tool.name);
    
    // Cleanup
    await client.cleanup();
    
    // Assert
    expect(connectionResult).toBe("connected");
    expect(toolNames).toContain('add');
    expect(toolNames).toContain('divide');
    expect(toolNames.length).toBe(2);
    console.log('tools =', toolNames);
  });

  test('should connect to SSE server and retrieve tools [subtract, multiply]', async () => {
    // Arrange
    const mcpServer: McpServer = {
      name: "Demo-SSE",
      transport: "sse",
      command: "",
      args: [],
      serverLink: "http://10.4.207.8:8000/sse"
    };
    
    // Act
    const client = new MCPClient(mcpServer);
    const connectionResult = await client.connectToServer();
    const tools = await client.getTools();
    const toolNames = tools.map(tool => tool.name);
    
    // Cleanup
    await client.cleanup();
    
    // Assert
    expect(connectionResult).toBe("connected");
    expect(toolNames).toContain('subtract');
    expect(toolNames).toContain('multiply');
    expect(toolNames.length).toBe(2);
    console.log('tools =', toolNames);
  });
});