import { MCPClient } from '../mcpClient';
import { McpServer } from '../types/McpServerTypes';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { mock, mockReset } from 'jest-mock-extended';

// Mock the SDK imports
jest.mock('@modelcontextprotocol/sdk/client/index.js');
jest.mock('@modelcontextprotocol/sdk/client/stdio.js');
jest.mock('@modelcontextprotocol/sdk/client/sse.js');

describe('MCPClient', () => {
  // Create mocks
  const mockClient = mock<Client>();
  const mockStdioTransport = mock<StdioClientTransport>();
  const mockSseTransport = mock<SSEClientTransport>();

  // Mock the constructors
  (Client as jest.Mock).mockImplementation(() => mockClient);
  (StdioClientTransport as jest.Mock).mockImplementation(() => mockStdioTransport);
  (SSEClientTransport as jest.Mock).mockImplementation(() => mockSseTransport);

  beforeEach(() => {
    // Reset all mocks before each test
    mockReset(mockClient);
    mockReset(mockStdioTransport);
    mockReset(mockSseTransport);
    jest.clearAllMocks();
  });

  test('Test Case 1: Should connect to stdio server and return tools [add, divide]', async () => {
    // Setup
    const mcpServer: McpServer = {
      name: "Demo",
      transport: "stdio",
      command: "uv",
      args: ["--directory", "C:\\Repo\\mcp-demo\\mcp-server-demo", "run", "server.py"],
      serverLink: ""
    };

    // Mock the listTools response with correct schema structure
    mockClient.listTools.mockResolvedValue({
      tools: [
        { 
          name: 'add', 
          description: 'Add two numbers', 
          inputSchema: {
            type: "object",
            properties: {
              a: { type: "number" },
              b: { type: "number" }
            }
          }
        },
        { 
          name: 'divide', 
          description: 'Divide two numbers', 
          inputSchema: {
            type: "object",
            properties: {
              a: { type: "number" },
              b: { type: "number" }
            }
          }
        }
      ]
    });

    // Create client and connect
    const client = new MCPClient(mcpServer);
    const result = await client.connectToServer();

    // Assertions
    expect(StdioClientTransport).toHaveBeenCalledWith({
      command: mcpServer.command,
      args: mcpServer.args
    });
    expect(mockClient.connect).toHaveBeenCalledWith(mockStdioTransport);
    expect(mockClient.listTools).toHaveBeenCalled();
    expect(result).toBe('connected');

    // Get tools and verify
    const tools = await client.getTools();
    expect(tools.length).toBe(2);
    expect(tools.map(t => t.name)).toEqual(['add', 'divide']);
  });

  test('Test Case 2: Should connect to SSE server and return tools [subtract, multiply]', async () => {
    // Setup
    const mcpServer: McpServer = {
      name: "Demo-SSE",
      transport: "sse",
      command: "",
      args: [],
      serverLink: "http://0.0.0.0:8000/sse"
    };

    // Mock the listTools response with correct schema structure
    mockClient.listTools.mockResolvedValue({
      tools: [
        { 
          name: 'subtract', 
          description: 'Subtract two numbers', 
          inputSchema: {
            type: "object",
            properties: {
              a: { type: "number" },
              b: { type: "number" }
            }
          }
        },
        { 
          name: 'multiply', 
          description: 'Multiply two numbers', 
          inputSchema: {
            type: "object",
            properties: {
              a: { type: "number" },
              b: { type: "number" }
            }
          }
        }
      ]
    });

    // Create client and connect
    const client = new MCPClient(mcpServer);
    const result = await client.connectToServer();

    // Assertions
    expect(SSEClientTransport).toHaveBeenCalledWith(new URL(mcpServer.serverLink));
    expect(mockClient.connect).toHaveBeenCalledWith(mockSseTransport);
    expect(mockClient.listTools).toHaveBeenCalled();
    expect(result).toBe('connected');

    // Get tools and verify
    const tools = await client.getTools();
    expect(tools.length).toBe(2);
    expect(tools.map(t => t.name)).toEqual(['subtract', 'multiply']);
  });

  test('Should properly handle cleanup', async () => {
    // Setup
    const mcpServer: McpServer = {
      name: "Demo",
      transport: "stdio",
      command: "uv",
      args: [],
      serverLink: ""
    };

    // Mock successful connection
    mockClient.listTools.mockResolvedValue({ tools: [] });

    // Create client and connect
    const client = new MCPClient(mcpServer);
    await client.connectToServer();

    // Cleanup
    await client.cleanup();

    // Assert close was called
    expect(mockClient.close).toHaveBeenCalled();
  });

  test('Should handle connection errors', async () => {
    // Setup
    const mcpServer: McpServer = {
      name: "Demo",
      transport: "stdio",
      command: "uv",
      args: [],
      serverLink: ""
    };

    // Mock connection error
    const error = new Error('Connection failed');
    mockClient.connect.mockImplementation(() => {
      throw error;
    });

    // Create client and attempt to connect
    const client = new MCPClient(mcpServer);
    const result = await client.connectToServer();

    // Assert that we got an error back
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('Connection failed');
  });

  test('Test Case: Should execute add tool and return sum result', async () => {
    // Setup
    const mcpServer: McpServer = {
      name: "Demo",
      transport: "stdio",
      command: "uv",
      args: ["--directory", "C:\\Repo\\mcp-demo\\mcp-server-demo", "run", "server.py"],
      serverLink: ""
    };

    // Mock successful connection
    mockClient.listTools.mockResolvedValue({ tools: [] });

    // Mock the callTool response to return the sum
    mockClient.callTool.mockResolvedValue({
      content: "3"
    });

    // Create client and connect
    const client = new MCPClient(mcpServer);
    await client.connectToServer();

    // Execute tool
    const result = await client.executeTool({
      toolName: "add",
      toolArgs: {
        a: 1,
        b: 2
      }
    });

    // Assert callTool was called with correct parameters
    expect(mockClient.callTool).toHaveBeenCalledWith({
      name: "add",
      arguments: {
        a: 1,
        b: 2
      }
    });

    // Assert that we got the expected result
    expect(result).toBe("3");
  });

  test('Test Case: Should execute multiply tool and return product result', async () => {
    // Setup
    const mcpServer: McpServer = {
      name: "Demo-SSE",
      transport: "sse",
      command: "",
      args: [],
      serverLink: "http://0.0.0.0:8000/sse"
    };

    // Mock successful connection
    mockClient.listTools.mockResolvedValue({ tools: [] });

    // Mock the callTool response to return the product
    mockClient.callTool.mockResolvedValue({
      content: "12"
    });

    // Create client and connect
    const client = new MCPClient(mcpServer);
    await client.connectToServer();

    // Execute tool
    const result = await client.executeTool({
      toolName: "multiply",
      toolArgs: {
        a: 3,
        b: 4
      }
    });

    // Assert callTool was called with correct parameters
    expect(mockClient.callTool).toHaveBeenCalledWith({
      name: "multiply",
      arguments: {
        a: 3,
        b: 4
      }
    });

    // Assert that we got the expected result
    expect(result).toBe("12");
  });

  test('Should handle error when executing tool', async () => {
    // Setup
    const mcpServer: McpServer = {
      name: "Demo",
      transport: "stdio",
      command: "uv",
      args: [],
      serverLink: ""
    };

    // Mock successful connection
    mockClient.listTools.mockResolvedValue({ tools: [] });

    // Mock callTool to throw an error
    const error = new Error('Tool execution failed');
    mockClient.callTool.mockRejectedValue(error);

    // Create client and connect
    const client = new MCPClient(mcpServer);
    await client.connectToServer();

    // Assert that the promise is rejected with the expected error
    await expect(client.executeTool({
      toolName: "add",
      toolArgs: {
        a: 1,
        b: 2
      }
    })).rejects.toThrow('Tool execution failed');
  });
});