import { MCPClientManager } from '../../../../src/main/services/mcpClientManager';
import { MCPClient } from '../../../../src/main/services/mcpClient';
import { McpServer } from '../../../../src/main/types/McpServerTypes';

// Mock the MCPClient class
jest.mock('../../../../src/main/services/mcpClient');

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

  describe('initialize', () => {
    test('should load MCP server configuration from local file and initialize clients correctly', async () => {
      // Arrange
      const mockFetchClient = new MCPClient({} as McpServer);
      const mockPlaywrightClient = new MCPClient({} as McpServer);
      const mockDemoClient = new MCPClient({} as McpServer);
      const mockDemoSseClient = new MCPClient({} as McpServer);
      
      // Reset the mock counts to ignore the client instances created above
      (MCPClient as jest.Mock).mockClear();
      
      // Mock the MCPClient constructor to return our mock clients
      (MCPClient as jest.Mock).mockImplementation((mcpServer: McpServer) => {
        if (mcpServer.name === 'fetch') return mockFetchClient;
        if (mcpServer.name === 'playwright') return mockPlaywrightClient;
        if (mcpServer.name === 'Demo') return mockDemoClient;
        if (mcpServer.name === 'Demo-SSE') return mockDemoSseClient;
        return new MCPClient(mcpServer);
      });
      
      // Mock connectToServer to return 'connected' for all clients
      jest.spyOn(mockFetchClient, 'connectToServer').mockResolvedValue('connected');
      jest.spyOn(mockPlaywrightClient, 'connectToServer').mockResolvedValue('connected');
      jest.spyOn(mockDemoClient, 'connectToServer').mockResolvedValue('connected');
      jest.spyOn(mockDemoSseClient, 'connectToServer').mockResolvedValue('connected');
      
      // Mock getTools to return different tools for each client
      jest.spyOn(mockFetchClient, 'getTools').mockResolvedValue([
        { name: 'fetch', inputSchema: { type: 'object' } }
      ]);
      
      jest.spyOn(mockPlaywrightClient, 'getTools').mockResolvedValue([
        { name: 'browser_close', inputSchema: { type: 'object' } },
        { name: 'browser_wait', inputSchema: { type: 'object' } },
        { name: 'browser_resize', inputSchema: { type: 'object' } },
        { name: 'browser_file_upload', inputSchema: { type: 'object' } },
        { name: 'browser_install', inputSchema: { type: 'object' } },
        { name: 'browser_press_key', inputSchema: { type: 'object' } },
        { name: 'browser_navigate', inputSchema: { type: 'object' } },
        { name: 'browser_navigate_back', inputSchema: { type: 'object' } },
        { name: 'browser_navigate_forward', inputSchema: { type: 'object' } },
        { name: 'browser_pdf_save', inputSchema: { type: 'object' } },
        { name: 'browser_snapshot', inputSchema: { type: 'object' } },
        { name: 'browser_click', inputSchema: { type: 'object' } },
        { name: 'browser_drag', inputSchema: { type: 'object' } },
        { name: 'browser_hover', inputSchema: { type: 'object' } },
        { name: 'browser_type', inputSchema: { type: 'object' } },
        { name: 'browser_select_option', inputSchema: { type: 'object' } },
        { name: 'browser_take_screenshot', inputSchema: { type: 'object' } },
        { name: 'browser_tab_list', inputSchema: { type: 'object' } },
        { name: 'browser_tab_new', inputSchema: { type: 'object' } },
        { name: 'browser_tab_select', inputSchema: { type: 'object' } },
        { name: 'browser_tab_close', inputSchema: { type: 'object' } }
      ]);
      
      jest.spyOn(mockDemoClient, 'getTools').mockResolvedValue([
        { name: 'add', inputSchema: { type: 'object' } },
        { name: 'divide', inputSchema: { type: 'object' } }
      ]);
      
      jest.spyOn(mockDemoSseClient, 'getTools').mockResolvedValue([
        { name: 'subtract', inputSchema: { type: 'object' } },
        { name: 'multiply', inputSchema: { type: 'object' } }
      ]);
      
      // Act
      await clientManager.initialize();
      
      // Assert
      // Verify all clients were created with correct configuration
      expect(MCPClient).toHaveBeenCalledTimes(4);
      
      // Check mcpClients map contains all expected servers
      const serverNames = clientManager.getAllServerNames();
      expect(serverNames).toContain('fetch');
      expect(serverNames).toContain('playwright');
      expect(serverNames).toContain('Demo');
      expect(serverNames).toContain('Demo-SSE');
      
      // Check that getAllClientsWithTools returns the correct mappings
      const clientsWithTools = clientManager.getAllClientsWithTools();
      
      // Create a map of server names to tool names for easier assertion
      const serverToolMap = new Map<string, string[]>();
      clientsWithTools.forEach(({ serverName, toolNames }) => {
        serverToolMap.set(serverName, toolNames);
      });
      
      // Verify each server has the expected tools
      expect(serverToolMap.get('fetch')).toEqual(['fetch']);
      expect(serverToolMap.get('playwright')).toEqual([
        'browser_close', 'browser_wait', 'browser_resize', 'browser_file_upload',
        'browser_install', 'browser_press_key', 'browser_navigate', 
        'browser_navigate_back', 'browser_navigate_forward', 'browser_pdf_save',
        'browser_snapshot', 'browser_click', 'browser_drag', 'browser_hover',
        'browser_type', 'browser_select_option', 'browser_take_screenshot',
        'browser_tab_list', 'browser_tab_new', 'browser_tab_select', 'browser_tab_close'
      ]);
      expect(serverToolMap.get('Demo')).toEqual(['add', 'divide']);
      expect(serverToolMap.get('Demo-SSE')).toEqual(['subtract', 'multiply']);
      
      // Verify tool to client mappings work correctly
      expect(clientManager.getClientByToolName('fetch')).toBe(mockFetchClient);
      expect(clientManager.getClientByToolName('browser_navigate')).toBe(mockPlaywrightClient);
      expect(clientManager.getClientByToolName('add')).toBe(mockDemoClient);
      expect(clientManager.getClientByToolName('multiply')).toBe(mockDemoSseClient);
    });
  });
});