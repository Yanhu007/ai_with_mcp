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
