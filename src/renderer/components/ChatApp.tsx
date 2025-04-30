// ChatApp.tsx - Main container component for the chat application
import React, { useState, useEffect, useRef } from 'react';
import ChatHeader from './ChatHeader';
import ChatContainer from './ChatContainer';
import ChatInput from './ChatInput';
import ModelConfigSidepane from './ModelConfigSidepane';
import McpConfigSidepane from './McpConfigSidepane';
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
  const [showMcpConfigModal, setShowMcpConfigModal] = useState<boolean>(false);
  const [hasTools, setHasTools] = useState<boolean>(false);
  
  // Add state for sidepane width
  const [sidepaneWidth, setSidepaneWidth] = useState<number>(350);
  
  // Add refs for drag functionality
  const isDraggingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  // Initialize on mount
  useEffect(() => {
    loadConfig();
    initMcpClientManager();
    
    // Register system message callbacks
    chatApi.registerSystemMessageCallbacks({
      onAdd: (message: Message) => {
        setSystemMessages(prev => [...prev, message]);
      }
    });
    
    // Setup resizing event listeners
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      startXRef.current = e.clientX;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      
      // Calculate the new width based on the mouse position
      const containerRect = document.querySelector('.container')?.getBoundingClientRect();
      if (!containerRect) return;
      
      // Calculate width from right edge of screen
      const newWidth = Math.max(250, Math.min(600, containerRect.right - e.clientX));
      setSidepaneWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    
    // Add event listeners for drag resize
    const resizeHandle = resizeHandleRef.current;
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', handleMouseDown);
    }
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Cleanup on unmount
    return () => {
      chatApi.registerSystemMessageCallbacks({
        onAdd: undefined
      });
      
      if (resizeHandle) {
        resizeHandle.removeEventListener('mousedown', handleMouseDown);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
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
  
  // Handle clicks for sidepane toggles
  const handleConfigClick = () => {
    setShowConfigModal(!showConfigModal);
    // Close the MCP config panel if open
    if (showMcpConfigModal) setShowMcpConfigModal(false);
  };
  
  const handleMcpConfigClick = () => {
    setShowMcpConfigModal(!showMcpConfigModal);
    // Close the API config panel if open
    if (showConfigModal) setShowConfigModal(false);
  };

  // Filter and combine chat history and system messages for display, and sort by timestamp-based ID
  const displayMessages = [...chatHistory, ...systemMessages]
    .filter(message => 
      message.role === 'user' || 
      message.role === 'system' || 
      (message.role === 'assistant' && !message.tool_calls)
    )
    .sort((a, b) => {
      const aTime = a.id ? parseInt(a.id) : 0;
      const bTime = b.id ? parseInt(b.id) : 0;
      return aTime - bTime; // Sort from oldest to newest
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
    const userMsg: Message = { 
      role: 'user', 
      content: userMessage,
      id: Date.now().toString() // Add timestamp-based ID
    };
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
          id: (Date.now()+1).toString() // Use a different ID to avoid collision with user message 
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
                tempMsg.id = Date.now().toString(); // Update ID to current timestamp
                
                // Add the temporary message to chat history.
                setChatHistory(prev => [...prev, { ...tempMsg, content: chunkText}]);
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
          id: (Date.now()+1).toString() // Use a different ID to avoid collision with user message 
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
                tempMsg.id = Date.now().toString(); // Update ID to current timestamp
                
                // Add the temporary message to chat history and update the id with the timestamp.
                setChatHistory(prev => [...prev, { ...tempMsg, content: responseText}]);
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
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          id: Date.now().toString() // Add timestamp-based ID 
        };
        return [...filtered, errorMsg];
      });
    } finally {
      setIsLoading(false);
      streamingMsgId = null;
    }
  };

  // Current active sidepane
  const getActiveSidepane = () => {
    if (showConfigModal) {
      return (
        <ModelConfigSidepane 
          isOpen={showConfigModal}
          config={config}
          onClose={() => setShowConfigModal(false)}
          onSave={saveConfig}
          width={sidepaneWidth}
          setWidth={setSidepaneWidth}
        />
      );
    } else if (showMcpConfigModal) {
      return (
        <McpConfigSidepane 
          isOpen={showMcpConfigModal}
          onClose={() => setShowMcpConfigModal(false)}
          width={sidepaneWidth}
          setWidth={setSidepaneWidth}
        />
      );
    }
    return null;
  };

  // Function to handle clearing chat history and system messages
  const handleClearChat = () => {
    setChatHistory([]);
    setSystemMessages([]);
  };

  return (
    <div className="container">
      <ChatHeader 
        onConfigClick={handleConfigClick}
        onMcpConfigClick={handleMcpConfigClick}
        onClearChat={handleClearChat}
      />
      
      <div className="main-content">
        <div 
          className="chat-area" 
          style={{ 
            flex: 1, 
            maxWidth: (showConfigModal || showMcpConfigModal) ? `calc(100% - ${sidepaneWidth}px)` : '100%',
            transition: 'max-width 0.15s ease-in-out'
          }}
        >
          <ChatContainer 
            messages={displayMessages} 
            isLoading={isLoading} 
          />
          
          <ChatInput 
            onSendMessage={sendMessage} 
            disabled={isLoading} 
          />
        </div>
        
        {(showConfigModal || showMcpConfigModal) && (
          <>
            <div 
              ref={resizeHandleRef}
              className="resize-handle"
              style={{ 
                left: 'auto', 
                right: `${sidepaneWidth}px`,
                width: '6px',
                height: '100%',
                cursor: 'ew-resize',
                position: 'absolute',
                zIndex: 20
              }}
              title="Drag to resize"
            ></div>
            
            {getActiveSidepane()}
          </>
        )}
      </div>
    </div>
  );
};

export default ChatApp;