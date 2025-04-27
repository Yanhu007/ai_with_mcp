// ChatHeader.tsx - Header component for the chat application
import React from 'react';

interface ChatHeaderProps {
  onConfigClick: () => void;
  onMcpConfigClick: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ onConfigClick, onMcpConfigClick }) => {
  return (
    <header>
      <h1>Chat with MCPs</h1>
      <div className="header-buttons">
        <button 
          id="mcpConfigBtn" 
          className="config-btn" 
          onClick={onMcpConfigClick} 
          title="MCP Servers Configuration"
        >
          🔌
        </button>
        <button 
          id="configBtn" 
          className="config-btn" 
          onClick={onConfigClick} 
          title="API Configuration"
        >
          ⚙️
        </button>
      </div>
    </header>
  );
};

export default ChatHeader;