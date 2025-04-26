// ChatContainer.tsx - Container for displaying chat messages
import React, { useRef, useEffect } from 'react';
import { Message } from '../types/ChatTypes';
import MessageComponent from './Message';

interface ChatContainerProps {
  messages: Message[];
  isLoading: boolean;
}

const ChatContainer: React.FC<ChatContainerProps> = ({ messages, isLoading }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div id="chat-container" className="chat-container" ref={containerRef}>
      {messages.map((message, index) => (
        <MessageComponent key={index} message={message} />
      ))}
      
      {isLoading && (
        <div className="message assistant-message">
          <div className="typing-indicator">
            <div className="dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatContainer;