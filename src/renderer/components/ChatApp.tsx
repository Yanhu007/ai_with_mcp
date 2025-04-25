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

  // Combine chat history and system messages for display
  const displayMessages = [...chatHistory, ...systemMessages];

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
    
    try {
      if (hasTools) {
        // 创建一个临时的消息占位符用于流式更新
        const tempMsg: Message = { 
          role: 'assistant', 
          content: '', 
          id: 'streaming-' + Date.now() 
        };
        
        // 添加临时消息到聊天历史中
        setChatHistory(prev => [...prev, tempMsg]);
        
        // 使用 MCP 工具处理对话 - 回调会添加消息到聊天历史中
        await chatApi.processConversationWithMCP(updatedHistory, {
          onAssistantMessage: (message: Message) => {
            // 只处理非最终回应的消息（中间工具调用结果）
            if (message.tool_calls) {
              setChatHistory(prev => {
                // 移除流式占位符消息
                const filtered = prev.filter(m => m.id !== tempMsg.id);
                return [...filtered, message];
              });
            }
          },
          
          onToolUse: (toolName: string) => {
            // 工具使用通知由 chatApi.addUISystemMessage 处理
            // 这会触发已注册的回调
          },
          
          onToolResult: (message: Message) => {
            setChatHistory(prev => {
              // 修复: 不再使用map和find组合，改用简单的数组扩展
              const filteredMessages = prev.filter(m => m.id !== tempMsg.id);
              return [...filteredMessages, message];
            });
          },
          
          // 添加流式输出回调处理最终响应
          onFinalResponseChunk: (chunkText: string) => {
            // 实时更新临时消息的内容
            setChatHistory(prev => 
              prev.map(m => 
                (m.id === tempMsg.id) 
                  ? { ...m, content: chunkText } 
                  : m
              )
            );
          }
        });
        
        // 当流式输出完毕后，最终的消息已通过 onAssistantMessage 添加到历史记录中
        // 需要移除临时占位符消息
        setChatHistory(prev => prev.filter(m => m.id !== tempMsg.id));
      } else {
        // 非工具流 - 创建临时消息用于流式更新
        const tempMsg: Message = { 
          role: 'assistant', 
          content: '', 
          id: 'streaming-' + Date.now() 
        };
        
        // 添加临时消息到聊天历史中
        setChatHistory(prev => [...prev, tempMsg]);
        
        // 流式完成
        await chatApi.streamChatCompletion(
          updatedHistory,
          // 更新临时消息的内容
          (responseText: string) => {
            setChatHistory(prev => 
              prev.map(m => 
                (m.id === tempMsg.id) 
                  ? { ...m, content: responseText } 
                  : m
              )
            );
          },
          // 完成时，将临时消息替换为最终消息
          (finalResponse: string) => {
            setChatHistory(prev => {
              const filtered = prev.filter(m => m.id !== tempMsg.id);
              const assistantMsg: Message = { role: 'assistant', content: finalResponse };
              return [...filtered, assistantMsg];
            });
          }
        );
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
      
      // 添加错误消息
      setChatHistory(prev => {
        // 过滤掉任何临时消息
        const filtered = prev.filter(m => !m.id?.startsWith('streaming-'));
        const errorMsg: Message = { 
          role: 'assistant', 
          content: `Error: ${error instanceof Error ? error.message : String(error)}` 
        };
        return [...filtered, errorMsg];
      });
    } finally {
      setIsLoading(false);
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