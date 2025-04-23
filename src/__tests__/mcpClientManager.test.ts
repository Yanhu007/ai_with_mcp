import { MCPClientManager } from '../mcpClientManager';
import { MCPClient } from '../mcpClient';
import * as fs from 'fs';
import * as path from 'path';
import { mock, mockReset } from 'jest-mock-extended';

// Mock the fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

// Mock the MCPClient
jest.mock('../mcpClient');

describe('MCPClientManager', () => {
  // Create mocks
  const mockMcpClient = mock<MCPClient>();
  
  // Mock the constructor of MCPClient
  (MCPClient as jest.Mock).mockImplementation(() => mockMcpClient);
  
  const mockConfigData = {
    mcpServers: {
      fetch: {
        command: "uvx",
        args: ["mcp-server-fetch"]
      },
      playwright: {
        command: "npx",
        args: ["@playwright/mcp@latest"]
      },
      Demo: {
        command: "uv",
        args: ["--directory", "C:\\Repo\\mcp-demo\\mcp-server-demo", "run", "server.py"]
      },
      "Demo-SSE": {
        url: "http://0.0.0.0:8000/sse"
      }
    }
  };

  beforeEach(() => {
    // Reset all mocks before each test
    mockReset(mockMcpClient);
    jest.clearAllMocks();
    
    // Mock the file reading
    (fs.promises.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfigData));
    
    // Default mock implementations
    mockMcpClient.connectToServer.mockResolvedValue('connected');
    mockMcpClient.getTools.mockResolvedValue([]);
    mockMcpClient.cleanup.mockResolvedValue();
  });

  test('Should load MCP server configurations and initialize clients', async () => {
    // Setup
    const manager = new MCPClientManager();
    const configPath = 'test/path/mcp.json';
    
    // Act
    await manager.initialize(configPath);
    
    // Assert
    expect(fs.promises.readFile).toHaveBeenCalledWith(configPath, 'utf-8');
    expect(MCPClient).toHaveBeenCalledTimes(4); // Four servers in the config
    expect(mockMcpClient.connectToServer).toHaveBeenCalledTimes(4);
  });

  test('Should create correct MCPClient instances for stdio transport', async () => {
    // Setup
    const manager = new MCPClientManager();
    
    // Act
    await manager.initialize();
    
    // Assert
    // Check if MCPClient was constructed with correct parameters for fetch server
    expect(MCPClient).toHaveBeenCalledWith({
      name: 'fetch',
      transport: 'stdio',
      command: 'uvx',
      args: ['mcp-server-fetch'],
      serverLink: ''
    });
  });

  test('Should create correct MCPClient instances for SSE transport', async () => {
    // Setup
    const manager = new MCPClientManager();
    
    // Act
    await manager.initialize();
    
    // Assert
    // Check if MCPClient was constructed with correct parameters for Demo-SSE server
    expect(MCPClient).toHaveBeenCalledWith({
      name: 'Demo-SSE',
      transport: 'sse',
      command: '',
      args: [],
      serverLink: 'http://0.0.0.0:8000/sse'
    });
  });

  test('Should map tools to their respective clients', async () => {
    // Setup
    const manager = new MCPClientManager();
    
    // Mock the getTools method to return different tools for different clients
    let callCount = 0;
    mockMcpClient.getTools.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([
          { name: 'fetchTool1', description: 'Fetch tool 1', inputSchema: {} },
          { name: 'fetchTool2', description: 'Fetch tool 2', inputSchema: {} }
        ]);
      } else if (callCount === 2) {
        return Promise.resolve([
          { name: 'playwrightTool', description: 'Playwright tool', inputSchema: {} }
        ]);
      } else if (callCount === 3) {
        return Promise.resolve([
          { name: 'demoTool1', description: 'Demo tool 1', inputSchema: {} },
          { name: 'demoTool2', description: 'Demo tool 2', inputSchema: {} }
        ]);
      } else {
        return Promise.resolve([
          { name: 'demoSseTool', description: 'Demo SSE tool', inputSchema: {} }
        ]);
      }
    });
    
    // Act
    await manager.initialize();
    
    // Assert
    expect(mockMcpClient.getTools).toHaveBeenCalledTimes(4);
    
    // Check if the getClientByToolName method returns the correct client for each tool
    const fetchClient = manager.getClientByToolName('fetchTool1');
    const playwrightClient = manager.getClientByToolName('playwrightTool');
    const demoClient = manager.getClientByToolName('demoTool1');
    const demoSseClient = manager.getClientByToolName('demoSseTool');
    
    expect(fetchClient).toBeDefined();
    expect(playwrightClient).toBeDefined();
    expect(demoClient).toBeDefined();
    expect(demoSseClient).toBeDefined();
  });

  test('Should get client by server name', async () => {
    // Setup
    const manager = new MCPClientManager();
    
    // Act
    await manager.initialize();
    const client = manager.getClientByServerName('fetch');
    
    // Assert
    expect(client).toBeDefined();
  });

  test('Should get client by tool name', async () => {
    // Setup
    const manager = new MCPClientManager();
    
    // Mock the getTools method to return a tool for the first client
    mockMcpClient.getTools.mockResolvedValueOnce([
      { name: 'fetchTool', description: 'Fetch tool', inputSchema: {} }
    ]);
    
    // Act
    await manager.initialize();
    const client = manager.getClientByToolName('fetchTool');
    
    // Assert
    expect(client).toBeDefined();
  });

  test('Should return undefined for non-existent server name', async () => {
    // Setup
    const manager = new MCPClientManager();
    
    // Act
    await manager.initialize();
    const client = manager.getClientByServerName('nonexistent');
    
    // Assert
    expect(client).toBeUndefined();
  });

  test('Should return undefined for non-existent tool name', async () => {
    // Setup
    const manager = new MCPClientManager();
    
    // Act
    await manager.initialize();
    const client = manager.getClientByToolName('nonexistent');
    
    // Assert
    expect(client).toBeUndefined();
  });

  test('Should get all clients with their tools', async () => {
    // Setup
    const manager = new MCPClientManager();
    
    // Mock the getTools method to return different tools for different clients
    mockMcpClient.getTools
      .mockResolvedValueOnce([
        { name: 'fetchTool1', description: 'Fetch tool 1', inputSchema: {} },
        { name: 'fetchTool2', description: 'Fetch tool 2', inputSchema: {} }
      ])
      .mockResolvedValueOnce([
        { name: 'playwrightTool', description: 'Playwright tool', inputSchema: {} }
      ])
      .mockResolvedValueOnce([
        { name: 'demoTool1', description: 'Demo tool 1', inputSchema: {} },
        { name: 'demoTool2', description: 'Demo tool 2', inputSchema: {} }
      ])
      .mockResolvedValueOnce([
        { name: 'demoSseTool', description: 'Demo SSE tool', inputSchema: {} }
      ]);
    
    // Act
    await manager.initialize();
    const clientsWithTools = manager.getAllClientsWithTools();
    
    // Assert
    expect(clientsWithTools).toHaveLength(4);
    
    // Find the fetch client entry
    const fetchClientEntry = clientsWithTools.find(entry => entry.serverName === 'fetch');
    expect(fetchClientEntry).toBeDefined();
    expect(fetchClientEntry?.toolNames).toContain('fetchTool1');
    expect(fetchClientEntry?.toolNames).toContain('fetchTool2');
    
    // Find the Demo client entry
    const demoClientEntry = clientsWithTools.find(entry => entry.serverName === 'Demo');
    expect(demoClientEntry).toBeDefined();
    expect(demoClientEntry?.toolNames).toContain('demoTool1');
    expect(demoClientEntry?.toolNames).toContain('demoTool2');
  });

  test('Should get all server names', async () => {
    // Setup
    const manager = new MCPClientManager();
    
    // Act
    await manager.initialize();
    const serverNames = manager.getAllServerNames();
    
    // Assert
    expect(serverNames).toHaveLength(4);
    expect(serverNames).toContain('fetch');
    expect(serverNames).toContain('playwright');
    expect(serverNames).toContain('Demo');
    expect(serverNames).toContain('Demo-SSE');
  });

  test('Should clean up all clients', async () => {
    // Setup
    const manager = new MCPClientManager();
    
    // Act
    await manager.initialize();
    await manager.cleanup();
    
    // Assert
    expect(mockMcpClient.cleanup).toHaveBeenCalledTimes(4);
  });

  test('Should handle file read errors', async () => {
    // Setup
    const manager = new MCPClientManager();
    const error = new Error('Failed to read file');
    (fs.promises.readFile as jest.Mock).mockRejectedValue(error);
    
    // Act & Assert
    await expect(manager.initialize()).rejects.toThrow('Failed to read file');
  });

  test('Should handle client connection errors', async () => {
    // Setup
    const manager = new MCPClientManager();
    const error = new Error('Failed to connect');
    mockMcpClient.connectToServer.mockRejectedValue(error);
    
    // We still expect the initialization to succeed even if clients fail to connect
    // Act & Assert
    await expect(manager.initialize()).resolves.not.toThrow();
  });
});