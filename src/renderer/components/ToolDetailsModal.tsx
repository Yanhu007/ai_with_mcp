// filepath: c:\Repo\ai_with_mcp\src\renderer\components\ToolDetailsModal.tsx
// ToolDetailsModal.tsx - A component to display MCP tool details
import React, { useEffect } from 'react';

// Define the structure of a tool
interface ToolDetails {
  name: string;
  description?: string;
  inputSchema?: any;
  serverName?: string;
}

interface ToolDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tool: ToolDetails | null;
}

const ToolDetailsModal: React.FC<ToolDetailsModalProps> = ({ 
  isOpen, 
  onClose, 
  tool
}) => {
  if (!isOpen || !tool) return null;
  
  // Handle click outside the modal box to close it
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle ESC key to close the modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Function to pretty-print JSON schema
  const renderParametersSection = () => {
    if (!tool.inputSchema) return <p>No parameters available</p>;
    
    // Format the schema if it's a JSON object
    let formattedSchema;
    try {
      // If it's already a parsed object
      if (typeof tool.inputSchema === 'object') {
        formattedSchema = JSON.stringify(tool.inputSchema, null, 2);
      } else {
        // Try to parse it if it's a string
        formattedSchema = JSON.stringify(JSON.parse(tool.inputSchema), null, 2);
      }
    } catch (e) {
      // If parsing fails, just display as is
      formattedSchema = typeof tool.inputSchema === 'string' 
        ? tool.inputSchema 
        : JSON.stringify(tool.inputSchema);
    }

    return (
      <div className="parameters-section">
        <h4>Parameters</h4>
        <pre className="parameters-json">{formattedSchema}</pre>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container tool-details-modal">
        <div className="modal-header">
          <h3>{tool.name}</h3>
          <button 
            className="close-btn" 
            onClick={onClose}
            title="Close"
          >
            &times;
          </button>
        </div>
        <div className="modal-body">
          {tool.serverName && (
            <div className="server-info">
              <strong>Server:</strong> {tool.serverName}
            </div>
          )}
          
          <div className="description-section">
            <h4>Description</h4>
            <p>{tool.description || 'No description available'}</p>
          </div>
          
          {renderParametersSection()}
        </div>
      </div>
    </div>
  );
};

export default ToolDetailsModal;