// McpConfigSidepane.tsx - Sidepane for MCP Servers Configuration
import React, { useState, useEffect, useRef } from 'react';
import EditServerModal from './EditServerModal';
const ipcRenderer = typeof window !== 'undefined' && window.electron?.ipcRenderer;

interface McpServer {
  serverName: string;
  isConnected: boolean;
  availableTools: string[];
  errorMessage?: string; // Added error message property
  isReconnecting?: boolean; // Added reconnecting status property
}

interface McpConfigSidepaneProps {
  isOpen: boolean;
  onClose: () => void;
  width?: number;
  setWidth?: (width: number) => void;
}

const McpConfigSidepane: React.FC<McpConfigSidepaneProps> = ({ 
  isOpen, 
  onClose, 
  width: initialWidth = 350, 
  setWidth 
}) => {
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showServerModal, setShowServerModal] = useState(false);
  const [addingServer, setAddingServer] = useState(false);
  const [isEditingServer, setIsEditingServer] = useState(false);
  const [currentServerName, setCurrentServerName] = useState<string | null>(null);
  
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const sidepaneRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  // Load MCP servers data
  useEffect(() => {
    const fetchMcpServers = async () => {
      try {
        setLoading(true);
        // Get all servers with their tools
        // Check if window.electron.ipcRenderer exists before using it
        if (!window.electron?.ipcRenderer) {
          console.error('window.electron.ipcRenderer is not available');
          return;
        }
        
        const clientsWithTools = await window.electron?.ipcRenderer.invoke('get-mcp-clients-with-tools');
        
        // Format the data
        const serversData = clientsWithTools.map((client: any) => ({
          serverName: client.serverName,
          isConnected: client.toolNames.length > 0, // If has tools, it's connected
          availableTools: client.toolNames,
          errorMessage: client.errorMessage // Include error message from the server
        }));
        
        setMcpServers(serversData);
      } catch (error) {
        console.error('Error fetching MCP servers:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchMcpServers();
    }
  }, [isOpen]);

  // Setup resize functionality
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = initialWidth;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      // Prevent other events from firing while resizing
      e.preventDefault();
      e.stopPropagation();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = startXRef.current - e.clientX;
      // For left-aligned sidepane, increasing width when drag moves left
      const newWidth = Math.max(250, Math.min(600, startWidthRef.current + delta));
      if (setWidth) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    const resizeHandle = resizeHandleRef.current;
    
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', handleMouseDown);
    }
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (resizeHandle) {
        resizeHandle.removeEventListener('mousedown', handleMouseDown);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [initialWidth, setWidth]);

  // Handle add/edit server save
  const handleSaveServer = async (serverConfig: any) => {
    try {
      setAddingServer(true);
      
      // Check if window.electron.ipcRenderer exists before using it
      if (!window.electron?.ipcRenderer) {
        console.error('window.electron.ipcRenderer is not available');
        return;
      }
      
      const result = await window.electron?.ipcRenderer.invoke(
        isEditingServer ? 'update-mcp-server' : 'add-mcp-server', 
        serverConfig
      );
      
      if (result.success) {
        // Server added/updated successfully
        setShowServerModal(false);
        setIsEditingServer(false);
        setCurrentServerName(null);
        
        // Reload the servers list
        const clientsWithTools = await window.electron?.ipcRenderer.invoke('get-mcp-clients-with-tools');
        const serversData = clientsWithTools.map((client: any) => ({
          serverName: client.serverName,
          isConnected: client.toolNames.length > 0,
          availableTools: client.toolNames
        }));
        
        setMcpServers(serversData);
        
        // Refresh the available tools list in chatApi
        if (window.chatApi && typeof window.chatApi.refreshAvailableTools === 'function') {
          window.chatApi.refreshAvailableTools()
            .then((tools: any[]) => {
              console.log(`Tools list refreshed after server ${isEditingServer ? 'update' : 'addition'}, ${tools.length} tools available`);
            })
            .catch((error: Error) => {
              console.error('Error refreshing tools list:', error);
            });
        }
        
        // Success message is now shown in the modal component directly
        // No need to show an alert popup here
      } else {
        // Error adding/updating server
        console.error(`Error ${isEditingServer ? 'updating' : 'adding'} server:`, result.error);
        alert(`Error ${isEditingServer ? 'updating' : 'adding'} server: ${result.error}`);
      }
    } catch (error) {
      console.error(`Error ${isEditingServer ? 'updating' : 'adding'} server:`, error);
      alert(`Error ${isEditingServer ? 'updating' : 'adding'} server: ${(error as Error).message}`);
    } finally {
      setAddingServer(false);
    }
  };

  // Handle refresh connection for a server
  const handleRefreshServer = async (serverName: string) => {
    try {
      // Check if window.electron.ipcRenderer exists before using it
      if (!window.electron?.ipcRenderer) {
        console.error('window.electron.ipcRenderer is not available');
        return;
      }
      
      // Mark the server as reconnecting
      setMcpServers((prevServers) => 
        prevServers.map((server) => 
          server.serverName === serverName ? { ...server, isReconnecting: true, errorMessage: undefined } : server
        )
      );
      
      // Call the IPC method to refresh the server connection
      const result = await window.electron.ipcRenderer.invoke('refresh-mcp-server', serverName);
      
      if (result.success) {
        // Connection refreshed successfully
        console.log(`Server ${serverName} connection refreshed with tools:`, result.tools);
        
        // Update server data with new tools
        setMcpServers((prevServers) => 
          prevServers.map((server) => 
            server.serverName === serverName ? 
              { 
                ...server, 
                isConnected: result.tools.length > 0, 
                availableTools: result.tools,
                errorMessage: undefined
              } : server
          )
        );
        
        // Refresh the available tools list in chatApi
        if (window.chatApi && typeof window.chatApi.refreshAvailableTools === 'function') {
          window.chatApi.refreshAvailableTools()
            .then((tools: any[]) => {
              console.log(`Tools list refreshed after server reconnection, ${tools.length} tools available`);
            })
            .catch((error: Error) => {
              console.error('Error refreshing tools list:', error);
            });
        }
      } else {
        // Error refreshing connection
        console.error(`Error refreshing connection for server ${serverName}:`, result.error);
        
        // Update server with error message
        setMcpServers((prevServers) => 
          prevServers.map((server) => 
            server.serverName === serverName ? 
              { 
                ...server, 
                isConnected: false,
                errorMessage: result.error
              } : server
          )
        );
      }
    } catch (error) {
      console.error(`Error refreshing connection for server ${serverName}:`, error);
      
      // Update server with error message
      setMcpServers((prevServers) => 
        prevServers.map((server) => 
          server.serverName === serverName ? 
            { 
              ...server, 
              isConnected: false,
              errorMessage: (error as Error).message
            } : server
        )
      );
    } finally {
      // Reset the reconnecting state
      setMcpServers((prevServers) => 
        prevServers.map((server) => 
          server.serverName === serverName ? { ...server, isReconnecting: false } : server
        )
      );
    }
  };

  // Handle edit server
  const handleEditServer = async (serverName: string) => {
    try {
      setAddingServer(true);
      setCurrentServerName(serverName);
      setIsEditingServer(true);
      
      // The EditServerModal will fetch the configuration when it opens
      setShowServerModal(true);
    } catch (error) {
      console.error(`Error preparing to edit server ${serverName}:`, error);
      alert(`Error preparing to edit server: ${(error as Error).message}`);
    } finally {
      setAddingServer(false);
    }
  };

  // Handle delete server
  const handleDeleteServer = (serverName: string) => {
    // Show confirmation dialog
    if (window.confirm(`Are you sure you want to delete server "${serverName}"?`)) {
      try {
        // Check if window.electron.ipcRenderer exists before using it
        if (!window.electron?.ipcRenderer) {
          console.error('window.electron.ipcRenderer is not available');
          return;
        }
        
        // Call the IPC method to delete the server
        window.electron.ipcRenderer.invoke('delete-mcp-server', serverName)
          .then((result: any) => {
            if (result.success) {
              // Server deleted successfully
              // Reload the servers list
              window.electron?.ipcRenderer.invoke('get-mcp-clients-with-tools')
                .then((clientsWithTools: any) => {
                  const serversData = clientsWithTools.map((client: any) => ({
                    serverName: client.serverName,
                    isConnected: client.toolNames.length > 0,
                    availableTools: client.toolNames
                  }));
                  
                  setMcpServers(serversData);
                  
                  // Refresh the available tools list in chatApi
                  if (window.chatApi && typeof window.chatApi.refreshAvailableTools === 'function') {
                    window.chatApi.refreshAvailableTools()
                      .then((tools: any[]) => {
                        console.log(`Tools list refreshed after server deletion, ${tools.length} tools available`);
                      })
                      .catch((error: Error) => {
                        console.error('Error refreshing tools list:', error);
                      });
                  }
                });
            } else {
              // Error deleting server
              console.error(`Error deleting server:`, result.error);
              alert(`Error deleting server: ${result.error}`);
            }
          })
          .catch((error: Error) => {
            console.error(`Error deleting server:`, error);
            alert(`Error deleting server: ${error.message}`);
          });
      } catch (error) {
        console.error(`Error deleting server:`, error);
        alert(`Error deleting server: ${(error as Error).message}`);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={sidepaneRef} 
      className="config-sidepane" 
      style={{ width: `${initialWidth}px` }}
    >
      <div className="sidepane-header">
        <h2>MCP Servers</h2>
        <div className="header-actions">
          <button 
            className="add-server-btn" 
            onClick={() => {
              setShowServerModal(true);
              setIsEditingServer(false);
              setCurrentServerName(null);
            }}
            title="Add New Server"
          >
            + New Server
          </button>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
      </div>
      
      {/* Server Modal for Add/Edit */}
      <EditServerModal 
        isOpen={showServerModal}
        onClose={() => setShowServerModal(false)}
        isEditing={isEditingServer}
        serverName={currentServerName}
        isSaving={addingServer}
        onSave={handleSaveServer}
      />
      
      <div className="sidepane-content">
        {loading ? (
          <div className="loading-indicator">Loading MCP servers...</div>
        ) : mcpServers.length > 0 ? (
          <div className="server-cards">
            {mcpServers.map((server) => (
              <div key={server.serverName} className="server-card">
                <div className="server-card-header">
                  <div className="server-info">
                    <span 
                      className={`status-indicator ${server.isConnected ? 'connected' : 'disconnected'}`} 
                      title={server.isConnected ? 'Connected' : 'Disconnected'}
                    ></span>
                    <h3 className="server-name">{server.serverName}</h3>
                  </div>
                  <div className="server-actions">
                    {!server.isConnected && !server.isReconnecting && (
                      <button 
                        className="action-btn" 
                        onClick={() => handleRefreshServer(server.serverName)}
                        title="Refresh Connection"
                      >
                        🔄
                      </button>
                    )}
                    <button 
                      className="action-btn" 
                      onClick={() => handleEditServer(server.serverName)}
                      title="Edit Server"
                    >
                      ✏️
                    </button>
                    <button 
                      className="action-btn" 
                      onClick={() => handleDeleteServer(server.serverName)}
                      title="Delete Server"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                
                <div className="server-card-content">
                  {server.isReconnecting ? (
                    <div className="server-reconnecting">
                      <p className="reconnecting-text">Reconnecting...</p>
                    </div>
                  ) : !server.isConnected ? (
                    server.errorMessage ? (
                      <div className="server-error-message">
                        <p className="error-text">Error: {server.errorMessage}</p>
                      </div>
                    ) : (
                      <p className="no-tools">Server is disconnected</p>
                    )
                  ) : (
                    <>
                      <h4>Available Tools ({server.availableTools.length})</h4>
                      <div className="tools-container">
                        {server.availableTools.map((tool) => (
                          <div className="tool-chip" key={tool} title={tool}>
                            <span className="tool-name">{tool}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No MCP servers configured</p>
          </div>
        )}
      </div>
      
      <div 
        ref={resizeHandleRef} 
        className="resize-handle"
        title="Drag to resize"
      ></div>
    </div>
  );
};

export default McpConfigSidepane;