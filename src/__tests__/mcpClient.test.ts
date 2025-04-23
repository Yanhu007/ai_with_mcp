import { MCPClient } from '../mcpClient';
import { McpServer } from '../types/McpServerTypes';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

// Mock the MCP SDK
jest.mock('@modelcontextprotocol/sdk/client/index.js');
jest.mock('@modelcontextprotocol/sdk/client/stdio.js');
jest.mock('@modelcontextprotocol/sdk/client/sse.js');

describe('MCPClient', () => {
  let mockClient: any;
  let mockStdioTransport: any;
  let mockSseTransport: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock implementations
    mockClient = {
      connect: jest.fn(),
      listTools: jest.fn(),
      callTool: jest.fn(),
      close: jest.fn()
    };

    mockStdioTransport = {};
    mockSseTransport = {};

    // Mock the constructor and methods
    (Client as jest.Mock).mockImplementation(() => mockClient);
    (StdioClientTransport as jest.Mock).mockImplementation(() => mockStdioTransport);
    (SSEClientTransport as jest.Mock).mockImplementation(() => mockSseTransport);
  });

  test('Should retrieve tools for stdio transport server', async () => {
    // Test case 1
    const mcpServer: McpServer = {
      name: "Demo",
      transport: "stdio",
      command: "uv",
      args: ["--directory", "C:\\Repo\\mcp-demo\\mcp-server-demo", "run", "server.py"],
      serverLink: ""
    };

    // Set up mock return value for listTools
    mockClient.listTools.mockResolvedValue({
      tools: [
        { name: 'add', description: 'Addition tool', inputSchema: {} },
        { name: 'divide', description: 'Division tool', inputSchema: {} }
      ]
    });

    // Create instance and connect
    const mcpClient = new MCPClient(mcpServer);
    await mcpClient.connectToServer();

    // Verify the right transport was created with the right parameters
    expect(StdioClientTransport).toHaveBeenCalledWith({
      command: 'uv',
      args: ['--directory', 'C:\\Repo\\mcp-demo\\mcp-server-demo', 'run', 'server.py']
    });

    expect(mockClient.connect).toHaveBeenCalledWith(mockStdioTransport);
    expect(mockClient.listTools).toHaveBeenCalled();

    // Get the tools and verify
    const tools = await mcpClient.getTools();
    expect(tools).toHaveLength(2);
    expect(tools.map(tool => tool.name)).toEqual(['add', 'divide']);
  });

  test('Should retrieve tools for SSE transport server', async () => {
    // Test case 2
    const mcpServer: McpServer = {
      name: "Demo-SSE",
      transport: "sse",
      command: "",
      args: [],
      serverLink: "http://0.0.0.0:8000/sse"
    };

    // Set up mock return value for listTools
    mockClient.listTools.mockResolvedValue({
      tools: [
        { name: 'subtract', description: 'Subtraction tool', inputSchema: {} },
        { name: 'multiply', description: 'Multiplication tool', inputSchema: {} }
      ]
    });

    // Create instance and connect
    const mcpClient = new MCPClient(mcpServer);
    await mcpClient.connectToServer();

    // Verify the right transport was created with the right parameters
    expect(SSEClientTransport).toHaveBeenCalledWith(new URL("http://0.0.0.0:8000/sse"));
    expect(mockClient.connect).toHaveBeenCalledWith(mockSseTransport);
    expect(mockClient.listTools).toHaveBeenCalled();

    // Get the tools and verify
    const tools = await mcpClient.getTools();
    expect(tools).toHaveLength(2);
    expect(tools.map(tool => tool.name)).toEqual(['subtract', 'multiply']);
  });

  test('Should execute add tool on stdio transport and return 3', async () => {
    // Arrange
    const mcpServer: McpServer = {
      name: "Demo",
      transport: "stdio",
      command: "uv",
      args: ["--directory", "C:\\Repo\\mcp-demo\\mcp-server-demo", "run", "server.py"],
      serverLink: ""
    };

    // Set up mock return value for callTool
    mockClient.callTool.mockResolvedValue({
      content: "3"
    });

    // Create instance and connect
    const mcpClient = new MCPClient(mcpServer);
    
    // Act
    const result = await mcpClient.executeTool({
      toolName: "add",
      toolArgs: {
        a: 1,
        b: 2
      }
    });

    // Assert
    expect(result).toBe("3");
    expect(mockClient.callTool).toHaveBeenCalledWith({
      name: "add",
      arguments: {
        a: 1,
        b: 2
      }
    });
  });

  test('Should execute multiply tool on sse transport and return 12', async () => {
    // Arrange
    const mcpServer: McpServer = {
      name: "Demo-SSE",
      transport: "sse",
      command: "",
      args: [],
      serverLink: "http://0.0.0.0:8000/sse"
    };

    // Set up mock return value for callTool
    mockClient.callTool.mockResolvedValue({
      content: "12"
    });

    // Create instance and connect
    const mcpClient = new MCPClient(mcpServer);
    
    // Act
    const result = await mcpClient.executeTool({
      toolName: "multiply",
      toolArgs: {
        a: 3,
        b: 4
      }
    });

    // Assert
    expect(result).toBe("12");
    expect(mockClient.callTool).toHaveBeenCalledWith({
      name: "multiply",
      arguments: {
        a: 3,
        b: 4
      }
    });
  });
});