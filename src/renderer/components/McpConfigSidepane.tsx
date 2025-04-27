// McpConfigSidepane.tsx - Sidepane for MCP Servers Configuration
import React, { useState, useEffect, useRef } from 'react';
const ipcRenderer = typeof window !== 'undefined' && window.electron?.ipcRenderer;

// Example templates for JSON configuration
const stdioServerTemplate = {
  mcpServers: {
    "${server_name}": {
      command: "${command}",
      args: []
    }
  }
};

const sseServerTemplate = {
  mcpServers: {
    "${server_name}": {
      url: "${sse_server_url}"
    }
  }
};

interface McpServer {
  serverName: string;
  isConnected: boolean;
  availableTools: string[];
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
  const [showAddServerModal, setShowAddServerModal] = useState(false);
  const [serverConfigJson, setServerConfigJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [addingServer, setAddingServer] = useState(false);
  
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
          availableTools: client.toolNames
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

  // Handle refresh connection for a server
  const handleRefreshServer = (serverName: string) => {
    // This is a placeholder - functionality will be implemented later
    console.log(`Refresh server: ${serverName}`);
  };

  // Handle disable/enable server
  const handleToggleServerStatus = (serverName: string) => {
    // This is a placeholder - functionality will be implemented later
    console.log(`Toggle server status: ${serverName}`);
  };

  // Handle edit server
  const handleEditServer = (serverName: string) => {
    // This is a placeholder - functionality will be implemented later
    console.log(`Edit server: ${serverName}`);
  };

  // Handle delete server
  const handleDeleteServer = (serverName: string) => {
    // This is a placeholder - functionality will be implemented later
    console.log(`Delete server: ${serverName}`);
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
              setShowAddServerModal(true);
              setServerConfigJson(JSON.stringify(stdioServerTemplate, null, 2));
              setJsonError(null);
            }}
            title="Add New Server"
          >
            + New Server
          </button>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
      </div>
      
      {/* Add New Server Modal */}
      {showAddServerModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Add New MCP Server</h3>
              <button 
                className="close-modal-btn" 
                onClick={() => setShowAddServerModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="config-templates">
                <p>Templates:</p>
                <button 
                  onClick={() => {
                    setServerConfigJson(JSON.stringify(stdioServerTemplate, null, 2));
                    setJsonError(null);
                  }}
                >
                  Stdio Example
                </button>
                <button 
                  onClick={() => {
                    setServerConfigJson(JSON.stringify(sseServerTemplate, null, 2));
                    setJsonError(null);
                  }}
                >
                  SSE Example
                </button>
              </div>
              <textarea
                className={`json-editor ${jsonError ? 'error' : ''}`}
                value={serverConfigJson}
                onChange={(e) => {
                  setServerConfigJson(e.target.value);
                  setJsonError(null);
                }}
                placeholder="Enter server configuration in JSON format"
                rows={12}
              />
              {jsonError && (
                <div className="error-message">
                  {jsonError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="cancel-btn"
                onClick={() => setShowAddServerModal(false)}
              >
                Cancel
              </button>
              <button
                className="save-btn"
                disabled={addingServer}
                onClick={async () => {
                  try {
                    // Validate JSON format
                    let serverConfig;
                    try {
                      serverConfig = JSON.parse(serverConfigJson);
                      
                      // Check if mcpServers property exists
                      if (!serverConfig.mcpServers) {
                        setJsonError("Invalid configuration: 'mcpServers' property is missing");
                        return;
                      }
                      
                      // Check if there's at least one server
                      const serverNames = Object.keys(serverConfig.mcpServers);
                      if (serverNames.length === 0) {
                        setJsonError("Invalid configuration: No server defined");
                        return;
                      }
                      
                      // Check if server config is valid
                      const serverConfig1 = serverConfig.mcpServers[serverNames[0]];
                      if (!serverConfig1.command && !serverConfig1.url) {
                        setJsonError("Invalid configuration: Either 'command' or 'url' must be specified");
                        return;
                      }
                    } catch (error) {
                      setJsonError(`Invalid JSON: ${(error as Error).message}`);
                      return;
                    }
                    
                    // Save to local mcp.json
                    setAddingServer(true);
                    // Check if window.electron.ipcRenderer exists before using it
                    if (!window.electron?.ipcRenderer) {
                        console.error('window.electron.ipcRenderer is not available');
                        return;
                    }
                    const result = await window.electron?.ipcRenderer.invoke('add-mcp-server', serverConfig);
                    
                    if (result.success) {
                      // Server added successfully
                      setShowAddServerModal(false);
                      
                      // Reload the servers list
                      const clientsWithTools = await window.electron?.ipcRenderer.invoke('get-mcp-clients-with-tools');
                      const serversData = clientsWithTools.map((client: any) => ({
                        serverName: client.serverName,
                        isConnected: client.toolNames.length > 0,
                        availableTools: client.toolNames
                      }));
                      
                      setMcpServers(serversData);
                      
                      // Show success message
                      alert(`Server "${result.serverName}" added successfully`);
                    } else {
                      // Error adding server
                      setJsonError(`Error adding server: ${result.error}`);
                    }
                  } catch (error) {
                    setJsonError(`Error: ${(error as Error).message}`);
                  } finally {
                    setAddingServer(false);
                  }
                }}
              >
                {addingServer ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      
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
                    <button 
                      className="action-btn" 
                      onClick={() => handleRefreshServer(server.serverName)}
                      title="Refresh Connection"
                    >
                      🔄
                    </button>
                    <button 
                      className="action-btn" 
                      onClick={() => handleToggleServerStatus(server.serverName)}
                      title={server.isConnected ? "Disable" : "Enable"}
                    >
                      {server.isConnected ? '✅' : '❌'}
                    </button>
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
                  <h4>Available Tools ({server.availableTools.length})</h4>
                  {server.availableTools.length > 0 ? (
                    <div className="tools-container">
                      {server.availableTools.map((tool) => (
                        <div className="tool-chip" key={tool} title={tool}>
                          <span className="tool-name">{tool}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-tools">No tools available</p>
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