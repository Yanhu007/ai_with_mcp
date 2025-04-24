import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { MCPClientManager } from './mcpClientManager';

// 加载环境变量
dotenv.config();

// Keep a global reference to prevent garbage collection
let mainWindow: BrowserWindow | null = null;
// Initialize MCPClientManager instance
let mcpClientManager: MCPClientManager | null = null;

async function initMcpClientManager() {
  try {
    mcpClientManager = new MCPClientManager();
    await mcpClientManager.initialize();
    console.log('MCP Client Manager initialized successfully');
  } catch (error) {
    console.error('Failed to initialize MCPClientManager:', error);
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
      webSecurity: false, // Keep web security enabled
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, app.isPackaged ? './preload.js' : '../dist/preload.js')
    }
  });



  // Load the index.html of the app (adjust path for production vs development)
  const indexPath = app.isPackaged 
    ? path.join(__dirname, './index.html') // For packaged app
    : path.join(__dirname, '../src/index.html'); // For development

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
  // Configure network permissions before initializing MCP
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    // Allow proper headers for SSE connections
    const requestHeaders = { ...details.requestHeaders };
    
    // Add CORS headers if needed
    requestHeaders['Access-Control-Allow-Origin'] = '*';
    
    // Add specific headers for SSE connections
    if (details.url.includes('/sse')) {
      requestHeaders['Accept'] = 'text/event-stream';
      requestHeaders['Cache-Control'] = 'no-cache';
      requestHeaders['Connection'] = 'keep-alive';
    }
    
    callback({ requestHeaders });
  });

  // Configure response handling
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    
    // Add CORS headers to responses
    responseHeaders['Access-Control-Allow-Origin'] = '*';
    responseHeaders['Access-Control-Allow-Headers'] = '*';
    responseHeaders['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    
    callback({ responseHeaders });
  });

  // 设置网络请求超时
  app.commandLine.appendSwitch('disable-http-cache');
  app.commandLine.appendSwitch('ignore-certificate-errors');
  
  await initMcpClientManager();
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