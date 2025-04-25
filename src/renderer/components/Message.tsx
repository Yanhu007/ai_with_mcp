// Message.tsx - Component for rendering individual chat messages
import React from 'react';
import { Message as MessageType } from '../types/ChatTypes';

interface MessageProps {
  message: MessageType;
}

const Message: React.FC<MessageProps> = ({ message }) => {
  // Determine message class based on role
  const getMessageClass = () => {
    switch(message.role) {
      case 'user':
        return 'user-message';
      case 'assistant':
        return 'assistant-message';
      case 'system':
        return 'system-message assistant-message';
      case 'tool':
        return 'tool-message assistant-message';
      default:
        return 'assistant-message';
    }
  };

  return (
    <div className={`message ${getMessageClass()}`}>
      <div className="message-content" dangerouslySetInnerHTML={{ __html: message.content }} />
    </div>
  );
};

export default Message;