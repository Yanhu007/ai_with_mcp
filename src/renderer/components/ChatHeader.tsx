// ChatHeader.tsx - Header component for the chat application
import React from 'react';

interface ChatHeaderProps {
  onConfigClick: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ onConfigClick }) => {
  return (
    <header>
      <h1>Chat with MCPs</h1>
      <button id="configBtn" className="config-btn" onClick={onConfigClick}>
        ⚙️
      </button>
    </header>
  );
};

export default ChatHeader;