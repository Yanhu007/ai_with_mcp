import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { MCPClientManager } from './main/services/mcpClientManager';
import { McpMarketPlaceManager } from './main/services/mcpMarketPlaceManager';

// 加载环境变量
dotenv.config();

// Keep a global reference to prevent garbage collection
let mainWindow: BrowserWindow | null = null;
// Initialize MCPClientManager instance
let mcpClientManager: MCPClientManager | null = null;
// Initialize McpMarketPlaceManager instance
let mcpMarketPlaceManager: McpMarketPlaceManager | null = null;

async function initMcpClientManager() {
  try {
    mcpClientManager = new MCPClientManager();
    await mcpClientManager.initialize();
    console.log('MCP Client Manager initialized successfully');
  } catch (error) {
    console.error('Failed to initialize MCPClientManager:', error);
  }
}

async function initMcpMarketPlaceManager() {
  try {
    mcpMarketPlaceManager = new McpMarketPlaceManager();
    await mcpMarketPlaceManager.initialize();
    console.log('MCP Marketplace Manager initialized successfully');
  } catch (error) {
    console.error('Failed to initialize McpMarketPlaceManager:', error);
  }
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true, // Keep web security enabled
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js'), // Updated path to preload.js
    }
  });

  // Load the index.html of the app (adjust path for production vs development)
  const indexPath = app.isPackaged 
    ? path.join(__dirname, 'index.html') // For packaged app
    : path.join(__dirname, 'index.html'); // For development

  mainWindow.loadFile(indexPath);

  // Open DevTools in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create window when Electron is ready
app.whenReady().then(async () => {
  await initMcpMarketPlaceManager(); // Initialize marketplace manager first
  await initMcpClientManager();
  setupIpcHandlers();
  createWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// 注册 IPC 处理程序
function setupIpcHandlers() {
// IPC handlers for Azure OpenAI API configuration
ipcMain.handle('save-config', async (event, config) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Failed to save config:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('load-config', async () => {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { success: true, data: config };
    }
    return { 
      success: true, 
      data: {
        apiKey: '',
        endpoint: '',
        deploymentName: '',
        apiVersion: '2023-05-15'
      } 
    };
  } catch (error) {
    console.error('Failed to load config:', error);
    return { 
      success: false, 
      error: (error as Error).message,
      data: {
        apiKey: '',
        endpoint: '',
        deploymentName: '',
        apiVersion: '2023-05-15'
      }
    };
  }
});

// IPC handlers for MCP Marketplace functionality
ipcMain.handle('get-marketplace-tools', async () => {
  if (!mcpMarketPlaceManager) {
    console.log('MCP Marketplace Manager not initialized, trying to initialize now');
    await initMcpMarketPlaceManager();
    
    if (!mcpMarketPlaceManager) {
      throw new Error('Failed to initialize MCP Marketplace Manager');
    }
  }
  
  try {
    const formattedTools = mcpMarketPlaceManager.getAllFormattedTools();
    return formattedTools;
  } catch (error) {
    console.error('Error getting marketplace tools:', error);
    throw error;
  }
});

ipcMain.handle('get-server-for-tool', async (event, toolName) => {
  if (!mcpMarketPlaceManager) {
    console.log('MCP Marketplace Manager not initialized, trying to initialize now');
    await initMcpMarketPlaceManager();
    
    if (!mcpMarketPlaceManager) {
      throw new Error('Failed to initialize MCP Marketplace Manager');
    }
  }
  
  try {
    const serverConfig = mcpMarketPlaceManager.getServerConfigForTool(toolName);
    return serverConfig;
  } catch (error) {
    console.error(`Error getting server config for tool ${toolName}:`, error);
    throw error;
  }
});

ipcMain.handle('has-client-for-tool', async (event, toolName) => {
  if (!mcpClientManager) {
    console.log('MCP Client Manager not initialized, trying to initialize now');
    await initMcpClientManager();
    
    if (!mcpClientManager) {
      return false;
    }
  }
  
  try {
    const client = mcpClientManager.getClientByToolName(toolName);
    return client !== undefined;
  } catch (error) {
    console.error(`Error checking client for tool ${toolName}:`, error);
    return false;
  }
});

ipcMain.handle('get-client-for-server', async (event, serverName) => {
  if (!mcpClientManager) {
    console.log('MCP Client Manager not initialized, trying to initialize now');
    await initMcpClientManager();
    
    if (!mcpClientManager) {
      return null;
    }
  }
  
  try {
    const client = mcpClientManager.getClientByServerName(serverName);
    
    if (!client) {
      return null;
    }
    
    // We need to return a simplified version of the client since we can't send
    // the entire client object over IPC
    const tools = await client.getTools();
    
    return {
      serverName,
      tools
    };
  } catch (error) {
    console.error(`Error getting client for server ${serverName}:`, error);
    return null;
  }
});

// IPC handlers for MCP client functionality
ipcMain.handle('get-mcp-client-manager', async () => {
  if (!mcpClientManager) {
    console.log('MCP Client Manager not initialized, trying to initialize now');
    await initMcpClientManager();
  }
  
  // We cannot directly send the mcpClientManager object via IPC
  // Instead, return a boolean indicating if it's available
  return mcpClientManager !== null;
});

ipcMain.handle('get-server-config', async (event, serverName) => {
  if (!mcpClientManager) {
    throw new Error('MCP Client Manager not initialized');
  }
  
  try {
    // Get the current configuration from the config file
    const configPath = mcpClientManager.getConfigPath();
    const configData = await fs.promises.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    if (!config.mcpServers || !config.mcpServers[serverName]) {
      throw new Error(`Server "${serverName}" not found in configuration`);
    }
    
    // Create a server config structure in the expected format for the UI
    const serverConfig = {
      mcpServers: {
        [serverName]: config.mcpServers[serverName]
      }
    };
    
    return serverConfig;
  } catch (error) {
    console.error(`Error getting server config for ${serverName}:`, error);
    throw error;
  }
});

ipcMain.handle('update-mcp-server', async (event, serverConfig) => {
  if (!mcpClientManager) {
    console.log('MCP Client Manager not initialized, trying to initialize now');
    await initMcpClientManager();
    
    if (!mcpClientManager) {
      throw new Error('Failed to initialize MCP Client Manager');
    }
  }
  
  try {
    // First, validate the configuration format
    if (!serverConfig.mcpServers || Object.keys(serverConfig.mcpServers).length === 0) {
      throw new Error('Invalid server configuration: mcpServers is missing or empty');
    }
    
    const [[serverName, config]] = Object.entries(serverConfig.mcpServers);
    
    if (!serverName) {
      throw new Error('Invalid server configuration: server name is missing');
    }
    
    // Check if the server exists in the current configuration
    const existingClient = mcpClientManager.getClientByServerName(serverName);
    if (!existingClient) {
      throw new Error(`Server "${serverName}" not found. Cannot update.`);
    }
    
    // Update the server in the mcpClientManager
    await mcpClientManager.updateServer(serverConfig);
    
    return { success: true, serverName };
  } catch (error) {
    console.error('Error updating MCP server:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('add-mcp-server', async (event, serverConfig) => {
  if (!mcpClientManager) {
    console.log('MCP Client Manager not initialized, trying to initialize now');
    await initMcpClientManager();
    
    if (!mcpClientManager) {
      throw new Error('Failed to initialize MCP Client Manager');
    }
  }
  
  try {
    const serverName = await mcpClientManager.addServer(serverConfig);
    return { success: true, serverName };
  } catch (error) {
    console.error('Error adding MCP server:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('delete-mcp-server', async (event, serverName) => {
  if (!mcpClientManager) {
    console.log('MCP Client Manager not initialized, trying to initialize now');
    await initMcpClientManager();
    
    if (!mcpClientManager) {
      throw new Error('Failed to initialize MCP Client Manager');
    }
  }
  
  try {
    // Validate the server name
    if (!serverName) {
      throw new Error('Server name is missing');
    }
    
    // Check if the server exists
    const existingClient = mcpClientManager.getClientByServerName(serverName);
    if (!existingClient) {
      throw new Error(`Server "${serverName}" not found. Cannot delete.`);
    }
    
    // Delete the server from the mcpClientManager
    await mcpClientManager.deleteServer(serverName);
    
    return { success: true, serverName };
  } catch (error) {
    console.error('Error deleting MCP server:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-mcp-clients-with-tools', async () => {
  if (!mcpClientManager) {
    console.log('MCP Client Manager not initialized when requesting clients');
    return [];
  }
  
  try {
    const clientsWithTools = mcpClientManager.getAllClientsWithTools();

    // Enhance the client data with connection error messages
    const enhancedClients = clientsWithTools.map(client => {
      const mcpClient = mcpClientManager?.getClientByServerName(client.serverName);
      const hasTools = client.toolNames.length > 0;
      
      // If the client has no tools, it might be disconnected due to an error
      if (!hasTools && mcpClient) {
        return {
          ...client,
          errorMessage: mcpClient.getLastError()?.message || "Failed to connect to the server"
        };
      }
      
      return client;
    });
    
    return enhancedClients;
  } catch (error) {
    console.error('Error getting MCP clients with tools:', error);
    return [];
  }
});

ipcMain.handle('get-all-mcp-tools', async () => {
  if (!mcpClientManager) {
    console.log('MCP Client Manager not initialized when requesting tools');
    return [];
  }
  
  try {
    const tools = await mcpClientManager.getAllTools();
    return tools;
  } catch (error) {
    console.error('Error getting MCP tools:', error);
    return [];
  }
});

ipcMain.handle('execute-mcp-tool', async (event, { toolName, toolArgs }) => {
  if (!mcpClientManager) {
    throw new Error('MCP Client Manager not initialized');
  }
  
  try {
    const result = await mcpClientManager.executeTool({ toolName, toolArgs });
    return result;
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    throw error;
  }
});

// Handler for refreshing MCP server connection
ipcMain.handle('refresh-mcp-server', async (event, serverName) => {
  try {
    console.log(`Refreshing MCP server connection for ${serverName}`);
    
    if (!mcpClientManager) {
      throw new Error('MCP Client Manager not initialized');
    }

    // Get the client by server name
    const client = mcpClientManager.getClientByServerName(serverName);
    
    if (!client) {
      console.error(`Server ${serverName} not found`);
      return { success: false, error: `Server ${serverName} not found` };
    }
    
    // First clean up existing connection
    await client.cleanup();
    
    // Remove existing tool mappings for this client
    const existingTools = mcpClientManager.getAllClientsWithTools()
      .find(c => c.serverName === serverName)?.toolNames || [];
      
    console.log(`Removing ${existingTools.length} existing tool mappings for ${serverName}`);
    
    // Reconnect to the server
    const connectionResult = await client.connectToServer();
    
    if (connectionResult === 'connected') {
      // Get updated tools
      const tools = await client.getTools();
      
      // Return success with the tools
      console.log(`Successfully reconnected to ${serverName} with ${tools.length} tools`);
      
      return { 
        success: true, 
        tools: tools.map(t => t.name)
      };
    } else if (connectionResult instanceof Error) {
      console.error(`Failed to reconnect to ${serverName}:`, connectionResult.message);
      return { 
        success: false, 
        error: connectionResult.message
      };
    } else {
      console.error(`Failed to reconnect to ${serverName} with unknown error`);
      return { 
        success: false, 
        error: 'Unknown connection error'
      };
    }
  } catch (error) {
    console.error(`Error refreshing MCP server connection for ${serverName}:`, error);
    return { 
      success: false, 
      error: (error as Error).message
    };
  }
});
}