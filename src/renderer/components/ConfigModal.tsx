// ConfigModal.tsx - Configuration modal for Azure OpenAI API settings
import React, { useState, useEffect } from 'react';
import { Config } from '../types/ChatTypes';

interface ConfigModalProps {
  isOpen: boolean;
  config: Config;
  onClose: () => void;
  onSave: (config: Config) => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, config, onClose, onSave }) => {
  const [formData, setFormData] = useState<Config>({
    apiKey: '117a0bc586aa4711a95ca960560295cc',
    endpoint: 'https://yanhuopenapi.openai.azure.com',
    deploymentName: 'gpt-4o',
    apiVersion: '2023-05-15'
  });

  // Update form data when config changes
  useEffect(() => {
    setFormData(config);
  }, [config]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    // 正确映射HTML ID到Config属性
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
    <div id="config-modal" className="modal" style={{ display: 'block' }}>
      <div className="modal-content">
        <span className="close" onClick={onClose}>&times;</span>
        <h2>OpenAI API</h2>
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
    </div>
  );
};

export default ConfigModal;