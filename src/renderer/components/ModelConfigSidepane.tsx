// ModelConfigSidepane.tsx - Resizable sidepane for Azure OpenAI API settings
import React, { useState, useEffect, useRef } from 'react';
import { Config } from '../types/ChatTypes';

interface ModelConfigSidepaneProps {
  isOpen: boolean;
  config: Config;
  onClose: () => void;
  onSave: (config: Config) => void;
  width?: number;
  setWidth?: (width: number) => void;
}

const ModelConfigSidepane: React.FC<ModelConfigSidepaneProps> = ({ isOpen, config, onClose, onSave, width: initialWidth = 350, setWidth }) => {
  const [formData, setFormData] = useState<Config>({
    apiKey: '117a0bc586aa4711a95ca960560295cc',
    endpoint: 'https://yanhuopenapi.openai.azure.com',
    deploymentName: 'gpt-4o',
    apiVersion: '2023-05-15'
  });
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const sidepaneRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  // Update form data when config changes
  useEffect(() => {
    setFormData(config);
  }, [config]);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    // Map HTML ID to Config property
    const fieldMap: Record<string, keyof Config> = {
      'api-key': 'apiKey',
      'endpoint': 'endpoint',
      'deployment-name': 'deploymentName',
      'api-version': 'apiVersion'
    };
    
    const field = fieldMap[id] || id;
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={sidepaneRef} 
      className="config-sidepane" 
      style={{ width: `${initialWidth}px` }}
    >
      <div className="sidepane-header">
        <h2>Azure OpenAI API</h2>
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>
      
      <div className="sidepane-content">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="endpoint">Endpoint</label>
            <input 
              type="text" 
              id="endpoint" 
              placeholder="https://your-resource-name.openai.azure.com" 
              value={formData.endpoint} 
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="api-key">API Key</label>
            <input 
              type="password" 
              id="api-key" 
              value={formData.apiKey} 
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="deployment-name">Deployment Name</label>
            <input 
              type="text" 
              id="deployment-name" 
              placeholder="your-deployment-name" 
              value={formData.deploymentName} 
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="api-version">API Version</label>
            <input 
              type="text" 
              id="api-version" 
              value={formData.apiVersion} 
              onChange={handleChange}
            />
          </div>
          <button type="submit" id="save-config-btn">Save Configuration</button>
        </form>
      </div>
      
      <div 
        ref={resizeHandleRef} 
        className="resize-handle"
        title="Drag to resize"
      ></div>
    </div>
  );
};

export default ModelConfigSidepane;