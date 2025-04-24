// Preload script for Electron
// This file is loaded before the renderer process

const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

console.log('Preload script running');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    send: (channel, data) => {
      // whitelist channels
      const validChannels = ['save-config', 'load-config', 'get-mcp-client-manager', 'get-all-mcp-tools', 'execute-mcp-tool'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    receive: (channel, func) => {
      const validChannels = ['from-main'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes sender 
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    invoke: (channel, data) => {
      const validChannels = ['save-config', 'load-config', 'get-mcp-client-manager', 'get-all-mcp-tools', 'execute-mcp-tool'];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, data);
      }
    }
  }
);

// 暴露markdown和语法高亮功能给渲染进程
contextBridge.exposeInMainWorld('libraries', {
  marked: marked,
  hljs: hljs
});