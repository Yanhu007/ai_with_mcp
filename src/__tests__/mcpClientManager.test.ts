import { MCPClientManager } from '../mcpClientManager';
import { MCPClient } from '../mcpClient';
import { McpServer } from '../types/McpServerTypes';

// Mock the MCPClient class
jest.mock('../mcpClient');

describe('MCPClientManager', () => {
  let clientManager: MCPClientManager;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create a new instance of MCPClientManager for each test
    clientManager = new MCPClientManager();
  });
  
  describe('executeTool', () => {
    test('should execute add tool on stdio transport and return 3', async () => {
      // Arrange
      const mcpServer: McpServer = {
        name: "Demo",
        transport: "stdio",
        command: "uv",
        args: ["--directory", "C:\\Repo\\mcp-demo\\mcp-server-demo", "run", "server.py"],
        serverLink: ""
      };
      
      // Mock implementation for this test case
      const mockClient = new MCPClient(mcpServer);
      
      // Mock the getTools method to return the add tool
      jest.spyOn(mockClient, 'getTools').mockResolvedValue([
        { name: 'add', inputSchema: { type: 'object' } }
      ]);
      
      // Mock the executeTool method to return "3"
      jest.spyOn(mockClient, 'executeTool').mockResolvedValue("3");
      
      // Mock the connectToServer method to return "connected"
      jest.spyOn(mockClient, 'connectToServer').mockResolvedValue("connected");
      
      // Use private property access to set up the test environment
      (clientManager as any).mcpClients = new Map([["Demo", mockClient]]);
      (clientManager as any).toolToClientMap = new Map([["add", mockClient]]);
      
      // Act
      const result = await clientManager.executeTool({
        toolName: "add",
        toolArgs: {
          a: 1,
          b: 2
        }
      });
      
      // Assert
      expect(result).toBe("3");
      expect(mockClient.executeTool).toHaveBeenCalledWith({
        toolName: "add",
        toolArgs: {
          a: 1,
          b: 2
        }
      });
    });
    
    test('should execute multiply tool on sse transport and return 12', async () => {
      // Arrange
      const mcpServer: McpServer = {
        name: "Demo-SSE",
        transport: "sse",
        command: "",
        args: [],
        serverLink: "http://0.0.0.0:8000/sse"
      };
      
      // Mock implementation for this test case
      const mockClient = new MCPClient(mcpServer);
      
      // Mock the getTools method to return the multiply tool
      jest.spyOn(mockClient, 'getTools').mockResolvedValue([
        { name: 'multiply', inputSchema: { type: 'object' } }
      ]);
      
      // Mock the executeTool method to return "12"
      jest.spyOn(mockClient, 'executeTool').mockResolvedValue("12");
      
      // Mock the connectToServer method to return "connected"
      jest.spyOn(mockClient, 'connectToServer').mockResolvedValue("connected");
      
      // Use private property access to set up the test environment
      (clientManager as any).mcpClients = new Map([["Demo-SSE", mockClient]]);
      (clientManager as any).toolToClientMap = new Map([["multiply", mockClient]]);
      
      // Act
      const result = await clientManager.executeTool({
        toolName: "multiply",
        toolArgs: {
          a: 3,
          b: 4
        }
      });
      
      // Assert
      expect(result).toBe("12");
      expect(mockClient.executeTool).toHaveBeenCalledWith({
        toolName: "multiply",
        toolArgs: {
          a: 3,
          b: 4
        }
      });
    });
  });
});