// ChatHeader.tsx - Header component for the chat application
import React from 'react';

interface ChatHeaderProps {
  onConfigClick: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ onConfigClick }) => {
  return (
    <header>
      <h1>Azure OpenAI Chat</h1>
      <button id="configBtn" className="config-btn" onClick={onConfigClick}>
        ⚙️ Configure
      </button>
    </header>
  );
};

export default ChatHeader;