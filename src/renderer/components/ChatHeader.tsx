// ChatHeader.tsx - Header component for the chat application
import React from 'react';

interface ChatHeaderProps {
  onConfigClick: () => void;
  onMcpConfigClick: () => void;
  onClearChat: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ onConfigClick, onMcpConfigClick, onClearChat }) => {
  return (
    <header>
      <div className="header-title">
        <h1>Chat with MCPs</h1>
        <button 
          id="clearChatBtn" 
          className="clear-btn" 
          onClick={onClearChat} 
          title="Clear Chat History"
        >
          🧹
        </button>
      </div>
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