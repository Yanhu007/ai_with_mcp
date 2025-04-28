// Define the Electron APIs exposed by the preload script
interface Window {
  electron: {
    ipcRenderer: {
      invoke(channel: string, ...args: any[]): Promise<any>;
      on(channel: string, listener: (event: any, ...args: any[]) => void): void;
      once(channel: string, listener: (event: any, ...args: any[]) => void): void;
      removeListener(channel: string, listener: Function): void;
    };
  };
  
  // ChatApi instance
  chatApi: {
    refreshAvailableTools(): Promise<any[]>;
    initMcpClientManager(): Promise<any[]>;
    // Add other methods as needed
  };
}