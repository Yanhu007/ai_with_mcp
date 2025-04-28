const { contextBridge, ipcRenderer } = require('electron');

// 暴露 Electron IPC 接口给渲染进程
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (...args) => ipcRenderer.invoke(...args),
    on: (channel, func) => {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
  }
});

// Expose chatApi to window after it's initialized in the renderer
window.addEventListener('DOMContentLoaded', () => {
  // Wait a short time to ensure chatApi is initialized in renderer
  setTimeout(() => {
    // Access chatApi from the renderer's scope
    if (window.chatApi) {
      // Already exposed
      console.log('chatApi already exposed to window');
    } else {
      console.log('Note: chatApi not found in window. It will be set by renderer process.');
    }
  }, 1000);
});
