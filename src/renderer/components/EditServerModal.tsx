// EditServerModal.tsx - Modal for adding or editing MCP Servers
import React, { useState, useEffect } from 'react';

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

interface EditServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialConfig?: string;
  isEditing?: boolean;
  serverName?: string | null;
  onSave: (config: any) => Promise<void>;
  isSaving: boolean;
}

const EditServerModal: React.FC<EditServerModalProps> = ({
  isOpen,
  onClose,
  initialConfig = JSON.stringify(stdioServerTemplate, null, 2),
  isEditing = false,
  serverName = null,
  onSave,
  isSaving
}) => {
  const [serverConfigJson, setServerConfigJson] = useState(initialConfig);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reset success message when modal is opened or closed
  useEffect(() => {
    if (isOpen) {
      setSuccessMessage(null);
    } else {
      // Reset success message when modal is closed
      setSuccessMessage(null);
    }
  }, [isOpen]);

  // Fetch existing server configuration when editing
  useEffect(() => {
    const fetchServerConfig = async () => {
      if (isEditing && serverName && isOpen) {
        try {
          if (!window.electron?.ipcRenderer) {
            console.error('window.electron.ipcRenderer is not available');
            return;
          }
          
          const serverConfig = await window.electron.ipcRenderer.invoke('get-server-config', serverName);
          if (serverConfig) {
            // Format the config for display
            setServerConfigJson(JSON.stringify(serverConfig, null, 2));
            setJsonError(null);
          }
        } catch (error) {
          console.error('Error fetching server config:', error);
          setJsonError(`Error loading server configuration: ${(error as Error).message}`);
        }
      }
    };

    fetchServerConfig();
  }, [isEditing, serverName, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      // Reset messages
      setJsonError(null);
      setSuccessMessage(null);
      
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
      
      // Call the onSave function passed as prop
      await onSave(serverConfig);
      setSuccessMessage(isEditing ? "Server configuration updated successfully!" : "Server added successfully!");
    } catch (error) {
      setJsonError(`Error: ${(error as Error).message}`);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h3>{isEditing ? 'Edit MCP Server' : 'Add New MCP Server'}</h3>
          <button 
            className="close-modal-btn" 
            onClick={onClose}
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
                setSuccessMessage(null);
              }}
            >
              Stdio Example
            </button>
            <button 
              onClick={() => {
                setServerConfigJson(JSON.stringify(sseServerTemplate, null, 2));
                setJsonError(null);
                setSuccessMessage(null);
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
              setSuccessMessage(null);
            }}
            placeholder="Enter server configuration in JSON format"
            rows={12}
          />
          {jsonError && (
            <div className="error-message">
              {jsonError}
            </div>
          )}
          {successMessage && (
            <div className="success-message">
              {successMessage}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button
            className="cancel-btn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="save-btn"
            disabled={isSaving}
            onClick={handleSave}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditServerModal;