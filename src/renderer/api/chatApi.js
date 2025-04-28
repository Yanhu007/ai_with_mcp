import ModelClient from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import { createSseStream } from "@azure/core-sse";

// chatApi.js - API functions for communication with Azure OpenAI and MCP tools
const ipcRenderer = typeof window !== 'undefined' && window?.electron?.ipcRenderer;

// Chat API class to handle all API interactions
class ChatApi {
  constructor() {
    this.availableTools = [];
    this.config = {
      apiKey: '117a0bc586aa4711a95ca960560295cc',
      endpoint: 'https://yanhuopenapi.openai.azure.com',
      deploymentName: 'gpt-4o',
      apiVersion: '2023-05-15'
    };
    this.systemMessages = [];
    this.systemMessageCallbacks = {
      onAdd: null
    };
  }

  // Register callbacks for system message events
  registerSystemMessageCallbacks(callbacks) {
    this.systemMessageCallbacks = {
      ...this.systemMessageCallbacks,
      ...callbacks
    };
  }

  // Add a temporary system message that only appears in UI
  addUISystemMessage(content) {
    const systemMsg = { 
      role: 'system', 
      content,
      id: Date.now().toString() // Add a unique ID to find this message later
    };
    
    this.systemMessages.push(systemMsg);
    
    // Notify UI about new system message
    if (this.systemMessageCallbacks.onAdd) {
      this.systemMessageCallbacks.onAdd(systemMsg);
    }
    
    return systemMsg;
  }

  // Initialize MCP Client Manager
  async initMcpClientManager() {
    try {
      // Get MCP client manager status
      const mcpManagerAvailable = await ipcRenderer.invoke('get-mcp-client-manager');
      
      if (mcpManagerAvailable) {
        // Get available tools
        const tools = await ipcRenderer.invoke('get-all-mcp-tools');
        
        console.log('MCP Client Manager initialized with tools:', 
          tools.map(tool => tool.name));
        
        // Format tools for Azure OpenAI API
        this.availableTools = tools.map(tool => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description || "",
            parameters: tool.inputSchema
          }
        }));

        return this.availableTools;
      }
      return [];
    } catch (error) {
      console.error('Failed to initialize MCP Client Manager:', error);
      throw error;
    }
  }

  // Load configuration from main process
  async loadConfig() {
    try {
      const result = await ipcRenderer.invoke('load-config');
      if (result.success) {
        this.config = result.data;
        return this.config;
      } else {
        console.error('Failed to load config:', result.error);
        throw new Error(`Failed to load config: ${result.error}`);
      }
    } catch (error) {
      console.error('Error loading config:', error);
      throw error;
    }
  }

  // Save configuration to main process
  async saveConfig(newConfig) {
    try {
      const result = await ipcRenderer.invoke('save-config', newConfig);
      if (result.success) {
        this.config = newConfig;
        return true;
      } else {
        console.error('Failed to save config:', result.error);
        throw new Error(`Failed to save config: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  }

  // Stream chat completion from Azure OpenAI API - 使用 Fetch API 和原生 ReadableStream
  async streamChatCompletion(messages, onChunk, onComplete) {
    try {
      // 构造 Azure OpenAI API URL
      const apiUrl = `${this.config.endpoint}/openai/deployments/${this.config.deploymentName}/chat/completions?api-version=${this.config.apiVersion}`;
      
      // 发送请求并获取流式响应
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey
        },
        body: JSON.stringify({
          messages: messages,
          max_tokens: 4096,
          temperature: 0.7,
          top_p: 1,
          model: this.config.deploymentName,
          stream: true
        })
      });

      // 检查请求是否成功
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get chat completions: ${response.status} - ${errorText}`);
      }

      // 获取响应流
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let responseText = '';

      // 处理流式响应
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // 解码二进制数据
        const chunk = decoder.decode(value, { stream: true });
        
        // 处理 SSE 格式 (data: {...})
        const lines = chunk.split('\n').filter(line => 
          line.trim() !== '' && line.trim() !== 'data: [DONE]'
        );
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonData = JSON.parse(line.substring(6));
              if (jsonData.choices && jsonData.choices[0]?.delta?.content) {
                const content = jsonData.choices[0].delta.content;
                responseText += content;
                
                // 回调每个文本块
                if (onChunk) onChunk(responseText);
              }
            } catch (e) {
              console.warn('Error parsing JSON:', e, line);
            }
          }
        }
      }

      // 回调完整响应
      if (onComplete) onComplete(responseText);
      
      return responseText;
    } catch (error) {
      console.error('Error in streamChatCompletion:', error);
      throw error;
    }
  }

  // Call Azure OpenAI API with tools - 使用 Azure AI Inference SDK
  async callAzureOpenAIWithTools(messages) {
    try {
      // 创建 Azure OpenAI 客户端
      const endpoint = `${this.config.endpoint}/openai/deployments/${this.config.deploymentName}`;
      const client = new ModelClient(endpoint, new AzureKeyCredential(this.config.apiKey));

      // 对于中间结果，不使用流式输出，直接获取完整响应
      const response = await client.path("/chat/completions").post({
        body: {
          messages: messages,
          max_tokens: 4096,
          temperature: 0.7,
          top_p: 1,
          model: this.config.deploymentName,
          tools: this.availableTools,
          tool_choice: "auto",
          stream: false // 中间结果不使用流式输出
        }
      });

      // 检查请求是否成功
      if (response.status !== "200") {
        throw new Error(`Failed to get chat completions, http operation failed with ${response.status} code`);
      }

      // 解析响应 - 修复: 使用 response.body 而不是 response.body.json()
      const result = await response.body;
      
      // 返回消息内容
      return result.choices[0].message;
    } catch (error) {
      console.error('Error in callAzureOpenAIWithTools:', error);
      throw error;
    }
  }

  // 使用 fetch API 流式输出最终结果 - 仅在最后一次对话时使用
  async streamFinalResponse(messages, onChunk, onComplete) {
    return this.streamChatCompletion(messages, onChunk, onComplete);
  }

  // Execute a tool call using mcpClientManager via IPC
  async executeToolCall(toolCall) {
    const { name, arguments: args } = toolCall.function;
    const parsedArgs = JSON.parse(args);

    console.log(`Executing tool: ${name}, arguments:`, parsedArgs);

    try {
      // Execute tool through IPC 
      const result = await ipcRenderer.invoke('execute-mcp-tool', { 
        toolName: name, 
        toolArgs: parsedArgs 
      });
      
      // Try to parse the result as JSON if it's a string
      if (typeof result === 'string') {
        try {
          return JSON.parse(result);
        } catch (e) {
          // If not valid JSON, return as text
          return { text: result };
        }
      }
      
      return result;
    } catch (error) {
      console.error(`Error executing MCP tool ${name}:`, error);
      throw error;
    }
  }

  // Helper function: Find the index of the last assistant message with tool calls
  findLastAssistantWithToolCallsIndex(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].tool_calls && messages[i].tool_calls.length > 0) {
        return i;
      }
    }
    return -1;
  }

  // Process a conversation with MCP tools
  async processConversationWithMCP(messages, callbacks = {}) {
    const { onAssistantMessage, onToolUse, onToolResult, onFinalResponseChunk } = callbacks;
    
    let requiresFollowUp = true;
    let toolResults = [];
    let currentMessages = [...messages];
    
    while (requiresFollowUp) {
      // Check if the last message is from assistant and contains tool calls
      const lastAssistantMessageIndex = this.findLastAssistantWithToolCallsIndex(currentMessages);

      if (lastAssistantMessageIndex !== -1 && toolResults.length > 0) {
        const lastAssistantMessage = currentMessages[lastAssistantMessageIndex];

        // Ensure each tool call has a corresponding tool response
        for (const toolCall of lastAssistantMessage.tool_calls) {
          // Check if this tool call already has a response
          const hasResponse = currentMessages.some(msg =>
            msg.role === 'tool' && msg.tool_call_id === toolCall.id
          );

          // If no response and we have a matching result, add tool response
          if (!hasResponse) {
            const toolResult = toolResults.find(tr => tr.tool_call_id === toolCall.id);
            if (toolResult) {
              const toolResponse = {
                role: "tool",
                tool_call_id: toolResult.tool_call_id,
                name: toolResult.name,
                content: toolResult.content
              };
              
              currentMessages.push(toolResponse);
              
              // Remove from pending results
              toolResults = toolResults.filter(tr => tr.tool_call_id !== toolCall.id);
            } else {
              // If no matching result, might be an error during execution, add error response
              console.warn(`No result found for tool call ID ${toolCall.id}, adding default error response`);
              
              const errorResponse = {
                role: "tool",
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: JSON.stringify({ error: "Tool execution failed or timed out" })
              };
              
              currentMessages.push(errorResponse);
            }
          }
        }
      }
      
      // Call API with tools
      const response = await this.callAzureOpenAIWithTools(currentMessages);
      
      // Process response
      if (response.tool_calls && response.tool_calls.length > 0) {
        // AI requested tool use
        
        // Add assistant message to messages with all tool calls
        const assistantMessage = {
          role: "assistant",
          content: response.content || "",
          tool_calls: response.tool_calls,
          id: Date.now().toString() // Add timestamp-based ID
        };
        
        currentMessages.push(assistantMessage);
        
        // Fire callback for assistant message if provided
        if (onAssistantMessage) {
          onAssistantMessage(assistantMessage);
        }

        // Process each tool call
        for (const toolCall of response.tool_calls) {
          const toolName = toolCall.function.name;
          
          // Fire callback for tool use if provided and add system message
          if (onToolUse) {
            onToolUse(toolName);
          }
          
          // Add UI system message
          this.addUISystemMessage(`Using tool: ${toolName}...`);

          // Execute tool call
          try {
            const toolResult = await this.executeToolCall(toolCall);

            // Add result to tool results list
            const toolResultObj = {
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify(toolResult)
            };
            
            toolResults.push(toolResultObj);

            // Immediately add tool response to chat messages
            const toolResponse = {
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify(toolResult),
              id: Date.now().toString() // Add timestamp-based ID
            };
            
            currentMessages.push(toolResponse);
            
            // Fire callback for tool result if provided
            if (onToolResult) {
              onToolResult(toolResponse);
            }
          } catch (error) {
            console.error(`Error executing tool ${toolName}:`, error);

            // Add error response
            const errorResult = { error: `Tool execution failed: ${error.message}` };
            
            const toolResultObj = {
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify(errorResult)
            };
            
            toolResults.push(toolResultObj);

            // Add to chat messages
            const errorResponse = {
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify(errorResult),
              id: Date.now().toString() // Add timestamp-based ID
            };
            
            currentMessages.push(errorResponse);
            
            // Fire callback for tool result if provided
            if (onToolResult) {
              onToolResult(errorResponse);
            }
          }
        }
        
        // Still need follow-up processing
        requiresFollowUp = true;
      } else {
        // Final response, no tools needed - 使用流式输出处理最终响应
        if (onFinalResponseChunk) {
          // 如果提供了流式处理回调，使用流式输出最终结果
          let finalContent = '';
          
          // 使用临时消息列表进行最终流式请求，不包含当前的助手最后回复
          const finalMessages = [...currentMessages];
          
          await this.streamFinalResponse(
            finalMessages, 
            // 流式处理每个块
            (chunkText) => {
              finalContent = chunkText;
              onFinalResponseChunk(chunkText);
            },
            // 完成后添加到消息历史
            (completeText) => {
              const finalMessage = {
                role: "assistant",
                content: completeText,
                id: Date.now().toString() // Add timestamp-based ID
              };
              
              currentMessages.push(finalMessage);
              
              // 触发助手消息回调
              if (onAssistantMessage) {
                onAssistantMessage(finalMessage);
              }
            }
          );
        } else {
          // 如果没有提供流式处理回调，使用默认方式处理
          const finalMessage = {
            role: "assistant",
            content: response.content,
            id: Date.now().toString() // Add timestamp-based ID
          };
          
          currentMessages.push(finalMessage);
          
          // 触发助手消息回调
          if (onAssistantMessage) {
            onAssistantMessage(finalMessage);
          }
        }
        
        // 处理完成
        requiresFollowUp = false;
      }
    }
    
    // 返回增强后的消息
    return currentMessages;
  }

  // Refresh available tools list - called after server operations (add/update/delete)
  async refreshAvailableTools() {
    try {
      // Get MCP client manager status
      const mcpManagerAvailable = await ipcRenderer.invoke('get-mcp-client-manager');
      
      if (mcpManagerAvailable) {
        // Get available tools
        const tools = await ipcRenderer.invoke('get-all-mcp-tools');
        
        console.log('Refreshed MCP tools list, found:', 
          tools.map(tool => tool.name));
        
        // Format tools for Azure OpenAI API
        this.availableTools = tools.map(tool => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description || "",
            parameters: tool.inputSchema
          }
        }));

        return this.availableTools;
      }
      
      // If MCP client manager is not available, clear tools
      this.availableTools = [];
      return [];
    } catch (error) {
      console.error('Failed to refresh MCP tools:', error);
      this.availableTools = [];
      return [];
    }
  }
}

// Create and export a singleton instance
export const chatApi = new ChatApi();
export default chatApi;