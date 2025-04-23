import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Keep a global reference to prevent garbage collection
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the index.html of the app (adjust path for production vs development)
  const indexPath = app.isPackaged 
    ? path.join(__dirname, '../src/index.html') // For packaged app
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
app.whenReady().then(createWindow);

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