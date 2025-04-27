// Message.tsx - Component for rendering individual chat messages
import React, { useEffect, useState } from 'react';
import { Message as MessageType } from '../types/ChatTypes';
import { marked } from 'marked';
import hljs from 'highlight.js';

interface MessageProps {
  message: MessageType;
}

const Message: React.FC<MessageProps> = ({ message }) => {
  const [content, setContent] = useState('');

  // Process content and apply Markdown rendering when appropriate
  useEffect(() => {
    const renderMarkdown = async () => {
      // For assistant messages without tool calls, render as Markdown
      if (message.role === 'assistant' && !message.tool_calls) {
        try {
          // Configure marked with proper options
          const renderer = {
            code(code: string, language: string) {
              const validLanguage = language && hljs.getLanguage(language) ? language : 'plaintext';
              try {
                return `<pre><code class="hljs language-${validLanguage}">${
                  hljs.highlight(code, { language: validLanguage }).value
                }</code></pre>`;
              } catch (err) {
                console.error('Highlight.js error:', err);
                return `<pre><code>${code}</code></pre>`;
              }
            }
          };
          
          marked.use({ 
            renderer: renderer as any, // Use any to bypass TypeScript checking for renderer
            breaks: true,     // Convert line breaks to <br>
            gfm: true         // Enable GitHub Flavored Markdown
          });
          
          // Parse the content as Markdown
          const parsedContent = await marked.parse(message.content);
          setContent(parsedContent);
        } catch (error) {
          console.error('Error rendering Markdown:', error);
          setContent(message.content); // Fallback to plain content
        }
      } else {
        // For other messages, use the content as-is
        setContent(message.content);
      }
    };
    
    renderMarkdown();
  }, [message.content, message.role, message.tool_calls]);

  // Determine message class based on role
  const getMessageClass = () => {
    switch(message.role) {
      case 'user':
        return 'user-message';
      case 'assistant':
        return 'assistant-message';
      case 'system':
        return 'system-message';
      case 'tool':
        return 'tool-message assistant-message';
      default:
        return 'assistant-message';
    }
  };

  return (
    <div className={`message ${getMessageClass()}`}>
      <div 
        className="message-content" 
        dangerouslySetInnerHTML={{ __html: content }} 
      />
    </div>
  );
};

export default Message;