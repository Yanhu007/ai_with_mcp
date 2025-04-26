// ChatApp.tsx - Main container component for the chat application
import React, { useState, useEffect } from 'react';
import ChatHeader from './ChatHeader';
import ChatContainer from './ChatContainer';
import ChatInput from './ChatInput';
import ConfigModal from './ConfigModal';
import { Config, Message } from '../types/ChatTypes';
import chatApi from '../api/chatApi.js';

const ChatApp: React.FC = () => {
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [systemMessages, setSystemMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [config, setConfig] = useState<Config>({
    apiKey: '',
    endpoint: '',
    deploymentName: '',
    apiVersion: '2023-05-15'
  });
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [hasTools, setHasTools] = useState<boolean>(false);

  // Initialize on mount
  useEffect(() => {
    loadConfig();
    initMcpClientManager();
    
    // Register system message callbacks
    chatApi.registerSystemMessageCallbacks({
      onAdd: (message: Message) => {
        setSystemMessages(prev => [...prev, message]);
      },
      onRemove: (message: Message) => {
        setSystemMessages(prev => prev.filter(msg => msg.id !== message.id));
      }
    });
    
    // Cleanup on unmount
    return () => {
      chatApi.registerSystemMessageCallbacks({
        onAdd: undefined,
        onRemove: undefined
      });
    };
  }, []);

  const loadConfig = async () => {
    try {
      const configData = await chatApi.loadConfig();
      setConfig(configData);
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const saveConfig = async (newConfig: Config) => {
    try {
      const success = await chatApi.saveConfig(newConfig);
      if (success) {
        setConfig(newConfig);
        setShowConfigModal(false);
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Error saving configuration');
    }
  };

  const initMcpClientManager = async () => {
    try {
      const tools = await chatApi.initMcpClientManager();
      setHasTools(tools.length > 0);
    } catch (error) {
      console.error('Failed to initialize MCP Client Manager:', error);
    }
  };

  // Combine chat history and system messages for display, filtering to show only user messages
  // and assistant messages without tool_calls
  const displayMessages = [...chatHistory, ...systemMessages].filter(message => {
    return message.role === 'user' || 
           (message.role === 'assistant' && !message.tool_calls);
  });

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim()) return;

    // Check if configuration is set
    if (!config.apiKey || !config.endpoint || !config.deploymentName) {
      alert('Please configure your Azure OpenAI API settings before sending messages.');
      setShowConfigModal(true);
      return;
    }

    // Add user message to chat history
    const userMsg: Message = { role: 'user', content: userMessage };
    const updatedHistory: Message[] = [...chatHistory, userMsg];
    setChatHistory(updatedHistory);
    
    // Start loading state
    setIsLoading(true);
    
    // Track streaming state to handle errors properly
    let streamingMsgId: string | null = null;
    
    try {
      if (hasTools) {
        // Create a temporary message placeholder for streaming updates
        const tempMsg: Message = { 
          role: 'assistant', 
          content: '', 
          id: 'streaming-' + Date.now() 
        };
        // Ensure id is a string before assigning
        streamingMsgId = tempMsg.id || null;
        
        // Track if we've added the temporary message to avoid React state closure issues
        let tempMsgAdded = false;
        
        // Use MCP tools to process conversation - callbacks will add messages to chat history
        await chatApi.processConversationWithMCP(updatedHistory, {
          onAssistantMessage: (message: Message) => {
            // 添加助手消息到历史记录，该消息是工具识别消息，所以内容可能为空
            if (message.tool_calls) {          
              setChatHistory(prev => {
                // Add the message to history
                return [...prev, message];
              });
            }
          },
          
          onToolUse: (toolName: string) => {
            // Tool use notifications are handled by chatApi.addUISystemMessage
            // which will trigger registered callbacks
          },
          
          onToolResult: (message: Message) => {
            setChatHistory(prev => {
              return [...prev, message];
            });
          },
          
          // Add streaming output callback to handle final response
          onFinalResponseChunk: (chunkText: string) => {
            // Only process if we have content
            if (chunkText) {
              // If this is the first chunk with content
              if (!tempMsgAdded) {
                // Hide loading indicator
                setIsLoading(false);
                tempMsgAdded = true;
                
                // Add the temporary message to chat history
                setChatHistory(prev => [...prev, { ...tempMsg, content: chunkText }]);
              } else {
                // Update temporary message content with each subsequent chunk
                setChatHistory(prev => 
                  prev.map(m => 
                    (m.id === tempMsg.id) 
                      ? { ...m, content: chunkText } 
                      : m
                  )
                );
              }
            }
          }
        });
        
        streamingMsgId = null;
      } else {
        // Non-tool flow - create temporary message for streaming updates
        const tempMsg: Message = { 
          role: 'assistant', 
          content: '', 
          id: 'streaming-' + Date.now() 
        };
        // Ensure id is a string before assigning
        streamingMsgId = tempMsg.id || null;
        
        // Track if we've added the temporary message to avoid React state closure issues
        let tempMsgAdded = false;
        
        // Stream chat completion
        await chatApi.streamChatCompletion(
          updatedHistory,
          // Update temporary message content
          (responseText: string) => {
            // Only process if we have content
            if (responseText) {
              // If this is the first chunk with content
              if (!tempMsgAdded) {
                // Hide loading indicator
                setIsLoading(false);
                tempMsgAdded = true;
                
                // Add the temporary message to chat history
                setChatHistory(prev => [...prev, { ...tempMsg, content: responseText }]);
              } else {
                // Update temporary message content with each subsequent chunk
                setChatHistory(prev => 
                  prev.map(m => 
                    (m.id === tempMsg.id) 
                      ? { ...m, content: responseText } 
                      : m
                  )
                );
              }
            }
          }
        );
        streamingMsgId = null;
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
      
      // Add error message
      setChatHistory(prev => {
        // Filter out any temporary messages, using saved ID
        const filtered = streamingMsgId 
          ? prev.filter(m => m.id !== streamingMsgId) 
          : prev.filter(m => !m.id?.startsWith('streaming-'));
          
        const errorMsg: Message = { 
          role: 'assistant', 
          content: `Error: ${error instanceof Error ? error.message : String(error)}` 
        };
        return [...filtered, errorMsg];
      });
    } finally {
      setIsLoading(false);
      streamingMsgId = null;
    }
  };

  return (
    <div className="container">
      <ChatHeader 
        onConfigClick={() => setShowConfigModal(true)} 
      />
      
      <ChatContainer 
        messages={displayMessages} 
        isLoading={isLoading} 
      />
      
      <ChatInput 
        onSendMessage={sendMessage} 
        disabled={isLoading} 
      />
      
      <ConfigModal 
        isOpen={showConfigModal}
        config={config}
        onClose={() => setShowConfigModal(false)}
        onSave={saveConfig}
      />
    </div>
  );
};

export default ChatApp;