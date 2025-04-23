// Azure OpenAI 配置（直接硬编码）
const azureOpenAIConfig = {
    endpoint: "https://chatgpt-austrilia.openai.azure.com/",
    apiKey: "67293e1b6e29478d927f1add17d8e1a4",
    deploymentName: "gpt-4o",
    apiVersion: "2025-01-01-preview"
};

// 默认MCP服务器配置
const defaultMcpConfig = {
    "servers": {
        "example-server": {
            "type": "sse",
            "url": "http://127.0.0.1:3001/sse",
            "description": "示例SSE服务器"
        }
    }
};

// 运行时MCP数据
let mcpRuntime = {
    initialized: false,
    activeServers: {},
    availableTools: [],
    toolsMap: {},
    sseConnections: {},
    sessionIds: {}  // 新增：存储每个服务器的sessionId
};

// 加载MCP配置
function loadMcpConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get('mcpConfig', (result) => {
            if (result.mcpConfig) {
                resolve(result.mcpConfig);
            } else {
                // 如果没有保存的配置，使用默认配置
                chrome.storage.local.set({ mcpConfig: defaultMcpConfig });
                resolve(defaultMcpConfig);
            }
        });
    });
}

// 保存MCP配置
function saveMcpConfig(config) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ mcpConfig: config }, resolve);
    });
}

// DOM元素
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// 聊天历史
let chatHistory = [
  { role: "system", content: "你是一个有用的AI助手。你可以使用工具来帮助用户解决问题。当用户询问天气或需要搜索信息时，请使用适当的工具。" }
];

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 创建工具面板
    createToolsPanel();
  
    // 创建聊天头部控件
    createChatHeader();

    // 创建MCP配置面板
    createMcpConfigPanel();

    // 初始化MCP服务器
    await initMcpServers();
  
    // 加载聊天历史
    chrome.storage.local.get('chatHistory', (result) => {
        if (result.chatHistory && result.chatHistory.length > 0) {
            chatHistory = result.chatHistory;

            // 渲染历史消息
            chatHistory.forEach(msg => {
                if (msg.role === 'user' || msg.role === 'assistant') {
                    addMessageToUI(msg.role, msg.content);
                }
            });
        }
    });
});

// 发送按钮点击事件
sendBtn.addEventListener('click', sendMessage);

// 用户按下回车键时发送消息（Shift+Enter 换行）
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// 发送消息
async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;
  
  // 清空输入框
  userInput.value = '';
  
  // 添加用户消息到UI
  addMessageToUI('user', message);
  
  // 添加用户消息到历史
  chatHistory.push({ role: "user", content: message });
  
  // 添加正在输入指示器
  showTypingIndicator();
  
  try {
    // 禁用发送按钮
    sendBtn.disabled = true;
    
    // 调用Azure OpenAI API (支持MCP)
    await processConversationWithMCP();
    
  } catch (error) {
    // 隐藏正在输入指示器
    hideTypingIndicator();
    
    // 显示错误消息
    addMessageToUI('system', `错误: ${error.message}`);
    console.error('API调用错误:', error);
  } finally {
    // 重新启用发送按钮
    sendBtn.disabled = false;
  }
}

// 使用MCP处理对话
async function processConversationWithMCP() {
  let requiresFollowUp = true;
  let toolResults = [];
  
  while (requiresFollowUp) {
    // 构建带有工具结果的消息历史
    const messagesWithTools = [...chatHistory];
    
      // 检查最后一个消息是否为助手消息且包含工具调用
      const lastAssistantMessageIndex = findLastAssistantWithToolCallsIndex(messagesWithTools);

      if (lastAssistantMessageIndex !== -1 && toolResults.length > 0) {
          const lastAssistantMessage = messagesWithTools[lastAssistantMessageIndex];

          // 确保每个工具调用都有对应的工具响应
          for (const toolCall of lastAssistantMessage.tool_calls) {
              // 检查该工具调用是否已经有响应
              const hasResponse = messagesWithTools.some(msg =>
                  msg.role === 'tool' && msg.tool_call_id === toolCall.id
              );

              // 如果没有响应，且我们有对应的结果，添加工具响应
              if (!hasResponse) {
                  const toolResult = toolResults.find(tr => tr.tool_call_id === toolCall.id);
                  if (toolResult) {
                      messagesWithTools.push({
                          role: "tool",
                tool_call_id: toolResult.tool_call_id,
                name: toolResult.name,
                content: toolResult.content
            });

                // 从待处理结果中移除
                toolResults = toolResults.filter(tr => tr.tool_call_id !== toolCall.id);
            } else {
                // 如果没有对应的结果，可能是执行中出错，添加一个错误响应
                console.warn(`未找到工具调用ID ${toolCall.id} 的结果，添加默认错误响应`);
                messagesWithTools.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    name: toolCall.function.name,
                    content: JSON.stringify({ error: "工具执行失败或超时" })
                });
            }
        }
      }
    }
    
      // 打印消息历史以便调试
      console.log('发送到API的消息历史:', JSON.stringify(messagesWithTools, null, 2));

    // 调用API
    const response = await callAzureOpenAIWithTools(messagesWithTools);
    
    // 处理响应
    if (response.tool_calls && response.tool_calls.length > 0) {
        // AI请求使用工具

        // 添加助手消息到历史，包含所有工具调用
      chatHistory.push({
        role: "assistant",
        content: response.content || "",
          tool_calls: response.tool_calls
      });
      
      // 显示思考消息
      if (response.content) {
        addMessageToUI('assistant', response.content);
      }

        // 处理每个工具调用
        for (const toolCall of response.tool_calls) {
          addMessageToUI('system', `正在使用${toolCall.function.name}工具...`);

          // 执行工具调用
          try {
            const toolResult = await executeToolCall(toolCall);

            // 将结果添加到工具结果列表
            toolResults.push({
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: JSON.stringify(toolResult)
            });

              // 立即将工具响应添加到聊天历史
              chatHistory.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  name: toolCall.function.name,
                  content: JSON.stringify(toolResult)
              });
          } catch (error) {
              console.error(`执行工具 ${toolCall.function.name} 时出错:`, error);

              // 添加错误响应
              const errorResult = { error: `工具执行失败: ${error.message}` };
              toolResults.push({
                  tool_call_id: toolCall.id,
                  name: toolCall.function.name,
                  content: JSON.stringify(errorResult)
              });

              // 添加到聊天历史
              chatHistory.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  name: toolCall.function.name,
                  content: JSON.stringify(errorResult)
              });
          }
      }
      
      // 仍然需要后续处理
      requiresFollowUp = true;
    } else {
      // 最终响应，不需要工具
      hideTypingIndicator();
      
      // 添加AI回复到UI
      addMessageToUI('assistant', response.content);
      
      // 添加AI回复到历史
      chatHistory.push({
        role: "assistant",
        content: response.content
      });
      
      // 保存聊天历史到storage
      chrome.storage.local.set({ chatHistory });
      
      // 完成处理
      requiresFollowUp = false;
    }
  }
}

// 查找最后一个带有工具调用的助手消息索引
function findLastAssistantWithToolCallsIndex(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant' && messages[i].tool_calls && messages[i].tool_calls.length > 0) {
            return i;
        }
    }
    return -1;
}

// 调用Azure OpenAI API (支持工具)
async function callAzureOpenAIWithTools(messages) {
  const url = `${azureOpenAIConfig.endpoint}openai/deployments/${azureOpenAIConfig.deploymentName}/chat/completions?api-version=${azureOpenAIConfig.apiVersion}`;
  
    // 仅使用MCP服务器提供的工具
  const body = {
    messages: messages,
    temperature: 0.7,
    max_tokens: 16384,
      tools: mcpRuntime.availableTools,
    tool_choice: "auto"
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': azureOpenAIConfig.apiKey
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API请求失败: ${response.status} ${errorText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message;
}

// 调用Azure OpenAI API (保留原方法以备不需要工具的场景)
async function callAzureOpenAI(messages) {
  const url = `${azureOpenAIConfig.endpoint}openai/deployments/${azureOpenAIConfig.deploymentName}/chat/completions?api-version=${azureOpenAIConfig.apiVersion}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': azureOpenAIConfig.apiKey
    },
    body: JSON.stringify({
      messages: messages,
      temperature: 0.7,
      max_tokens: 16384
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API请求失败: ${response.status} ${errorText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

// 清除历史对话
function clearConversation() {
    // 请求用户确认
    if (confirm('确定要清除所有对话历史并开始新的对话吗？')) {
        // 重置聊天历史
        chatHistory = [
            { role: "system", content: "你是一个有用的AI助手。你可以使用工具来帮助用户解决问题。当用户询问天气或需要搜索信息时，请使用适当的工具。" }
        ];

        // 清除UI中的消息
        chatMessages.innerHTML = '';

        // 添加系统欢迎消息
        addMessageToUI('system', '对话已清除。您好，我是您的AI助手，有什么可以帮您的吗？');

        // 保存到storage
        chrome.storage.local.set({ chatHistory });
    }
}

// 执行工具调用
async function executeToolCall(toolCall) {
    const { name, arguments: args } = toolCall.function;
    const parsedArgs = JSON.parse(args);

    console.log(`执行工具: ${name}，参数:`, parsedArgs);

    // 仅支持MCP工具
    if (mcpRuntime.initialized && mcpRuntime.toolsMap[name]) {
        try {
            const serverInfo = mcpRuntime.toolsMap[name];

            // 转换参数名称以适应weather_server.py的期望
            let transformedArgs = { ...parsedArgs };

            // 特殊处理weather工具的参数名称
            if (name === "get_current_weather" && parsedArgs.location && !parsedArgs.location_name) {
                transformedArgs = {
                    location_name: parsedArgs.location,
                    ...parsedArgs
                };
                delete transformedArgs.location;
            }

            return await executeMcpTool(name, transformedArgs, serverInfo.serverName);
        } catch (error) {
            console.error(`执行MCP工具 ${name} 失败:`, error);
            return { error: `执行MCP工具失败: ${error.message}` };
        }
    }

    // 没有找到工具，返回错误
    return { error: `未找到工具: ${name}。确保已连接到MCP服务器并已加载该工具。` };
}

// 通过MCP服务器执行工具（SSE形式）
async function executeMcpTool(name, args, serverName) {
    if (!mcpRuntime.activeServers[serverName]) {
        throw new Error(`服务器 ${serverName} 未连接或不可用`);
    }

    return new Promise((resolve, reject) => {
        // 为这次调用生成一个唯一ID
        const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // 获取已保存的session_id，如果没有则生成一个新的
        const session_id = mcpRuntime.sessionIds[serverName] ||
            `session_${serverName}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        console.log(`为工具调用使用session_id: ${session_id}`);

        // 设置超时
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('工具执行超时'));
        }, 30000); // 30秒超时

        // 监听SSE事件的回调
        const handleSseMessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("收到SSE消息:", data);

                // MCP响应匹配
                if (data.id === callId) {
                    cleanup();

                    // 检查是否有错误
                    if (data.error) {
                        reject(new Error(data.error));
                        return;
                    }

                    // 处理响应内容
                    // 根据MCP协议，工具执行结果可能在content字段的text属性中
                    if (data.result && data.result.content && Array.isArray(data.result.content) && data.result.content.length > 0) {
                        const firstContent = data.result.content[0];
                        if (firstContent.text) {
                            try {
                                // 尝试解析JSON结果
                                const resultObject = JSON.parse(firstContent.text);
                                resolve(resultObject);
                            } catch (parseError) {
                                // 如果不是JSON，直接返回文本
                                resolve({ text: firstContent.text });
                            }
                            return;
                        }
                    }

                    // 如果没有找到预期格式的内容，返回整个响应
                    resolve(data.result || data);
                }
            } catch (error) {
                console.error('解析SSE消息失败:', error, event.data);
            }
        };

        // 清理函数
        const cleanup = () => {
            clearTimeout(timeout);
            const sseConnection = mcpRuntime.sseConnections[serverName];
            if (sseConnection) {
                sseConnection.removeEventListener('message', handleSseMessage);
            }
        };

        // 添加事件监听器
        const sseConnection = mcpRuntime.sseConnections[serverName];
        sseConnection.addEventListener('message', handleSseMessage);

        // 根据weather_server.py的实现构造适当的消息体
        // weather_server.py期望使用tools/call方法，并在请求体中包含session_id
        const messageBody = {
            jsonrpc: "2.0",
            method: "tools/call",
            params: {
                name: name,
                arguments: args
            },
            id: callId,
            session_id: session_id  // 确保在请求体中包含session_id
        };

        // 获取正确的endpoint URL
        const serverInfo = mcpRuntime.activeServers[serverName];
        let messageEndpoint;

        // 使用服务器返回的endpoint，而不是硬编码的路径
        if (serverInfo.endpoint) {
            // 获取基础URL（协议 + 主机名 + 端口）
            const serverUrlObj = new URL(serverInfo.url);
            const baseUrl = `${serverUrlObj.protocol}//${serverUrlObj.host}`;
            // 确保endpoint以/开头
            const endpoint = serverInfo.endpoint.startsWith('/') ? serverInfo.endpoint : `/${serverInfo.endpoint}`;
            messageEndpoint = `${baseUrl}${endpoint}`;
        } else {
            console.error(`No endpoint found for server ${serverName}!!!!!!!`);
        }

        // 在URL中添加session_id查询参数
        const endpointUrl = new URL(messageEndpoint);
        endpointUrl.searchParams.append('session_id', session_id);
        messageEndpoint = endpointUrl.toString();

        console.log(`发送工具调用请求到endpoint: ${messageEndpoint}`);

        // 发送请求到endpoint，同时在header和请求体中带上session_id
        // 根据MCP规范，session_id应该同时出现在请求体和X-Session-ID头中
        fetch(messageEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-ID': session_id  // 在header中也包含session_id
            },
            body: JSON.stringify(messageBody)
        }).catch(error => {
            cleanup();
            reject(error);
        });
    });
}

// 初始化MCP服务器
async function initMcpServers() {
    try {
        updateToolsList([{ name: '初始化中...', description: '正在连接MCP服务器' }]);

        // 加载MCP配置
        const config = await loadMcpConfig();

        // 连接SSE服务器
        await connectToSseServers(config);

        // 获取可用工具并更新UI
        if (Object.keys(mcpRuntime.activeServers).length > 0) {
            mcpRuntime.initialized = true;

            // 收集所有服务器的工具信息用于UI显示
            const allToolsForUI = Object.entries(mcpRuntime.toolsMap).map(([toolName, info]) => ({
                name: toolName,
                description: findToolDescription(toolName),
                serverName: info.serverName
            }));

            // 一次性更新工具列表UI，显示所有服务器的所有工具
            updateToolsList(allToolsForUI);

            addMessageToUI('system', `成功连接到 ${Object.keys(mcpRuntime.activeServers).length} 个MCP服务器，加载了 ${mcpRuntime.availableTools.length} 个工具`);
        } else {
            // 没有服务器连接成功
            updateToolsList([]);
            addMessageToUI('system', '未能连接到任何MCP服务器，请检查服务器配置并确保MCP服务器正在运行');
        }
    } catch (error) {
        console.error('初始化MCP服务器失败:', error);
        addMessageToUI('system', `初始化MCP服务器失败: ${error.message}`);
        updateToolsList([]);
    }
}

// 查找工具的描述信息
function findToolDescription(toolName) {
    // 从availableTools中查找工具的描述
    const tool = mcpRuntime.availableTools.find(t =>
        t.function && t.function.name === toolName
    );
    return tool?.function?.description || '无描述';
}

// 发送初始化请求
async function sendInitializeRequest(serverName) {
    try {
        // 获取服务器信息
        const serverInfo = mcpRuntime.activeServers[serverName];
        if (!serverInfo) {
            throw new Error(`服务器 ${serverName} 未连接或不可用`);
        }

        // 获取或生成会话ID
        const session_id = mcpRuntime.sessionIds[serverName] ||
            `session_${serverName}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // 构造严格符合要求的初始化请求消息，添加clientInfo
        const initializeMessage = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "roots": {
                        "listChanged": true
                    }
                },
                "clientInfo": {
                    "name": "Visual Studio Code",
                    "version": "1.99.2"
                }
            }
        };

        console.log(`发送initialize请求到服务器 ${serverName}:`, initializeMessage);

        // 获取消息处理端点
        let messageEndpoint;

        // 使用服务器返回的endpoint，而不是硬编码的路径
        if (serverInfo.endpoint) {
            // 获取基础URL（协议 + 主机名 + 端口）
            const serverUrlObj = new URL(serverInfo.url);
            const baseUrl = `${serverUrlObj.protocol}//${serverUrlObj.host}`;
            // 确保endpoint以/开头
            const endpoint = serverInfo.endpoint.startsWith('/') ? serverInfo.endpoint : `/${serverInfo.endpoint}`;
            messageEndpoint = `${baseUrl}${endpoint}`;
        } else {
            console.error(`No endpoint found for server ${serverName}!!!!!!!`);
        }

        // 在URL中添加session_id查询参数
        const endpointUrl = new URL(messageEndpoint);
        endpointUrl.searchParams.append('session_id', session_id);
        messageEndpoint = endpointUrl.toString();

        console.log(`发送initialize请求到endpoint: ${messageEndpoint}`);

        // 发送初始化请求
        const response = await fetch(messageEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-ID': session_id
            },
            body: JSON.stringify(initializeMessage)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`初始化服务器 ${serverName} 时收到非200响应: ${response.status} ${errorText}`);
            return false;
        }

        // 尝试读取响应内容
        const responseText = await response.text();
        console.log(`服务器 ${serverName} 初始化响应:`, responseText);

        // 检查响应是否为简单的Accept字符串
        if (responseText.trim() === "Accept") {
            console.log(`服务器 ${serverName} 返回了Accept响应，初始化成功`);
            // 保存session_id如果之前没有
            if (!mcpRuntime.sessionIds[serverName] && session_id) {
                mcpRuntime.sessionIds[serverName] = session_id;
            }
            return true;
        }

        // 尝试解析为JSON，如果可能的话
        try {
            const responseData = JSON.parse(responseText);
            console.log(`服务器 ${serverName} 初始化JSON响应:`, responseData);

            // 保存session_id如果之前没有
            if (!mcpRuntime.sessionIds[serverName] && session_id) {
                mcpRuntime.sessionIds[serverName] = session_id;
            }

            return true;
        } catch (parseError) {
            // 不是JSON，但响应状态码是成功的，我们认为初始化成功
            console.log(`服务器 ${serverName} 返回了非JSON响应，但状态码表示成功:`, responseText);

            // 保存session_id如果之前没有
            if (!mcpRuntime.sessionIds[serverName] && session_id) {
                mcpRuntime.sessionIds[serverName] = session_id;
            }

            return true;
        }
    } catch (error) {
        console.error(`发送initialize请求到服务器 ${serverName} 失败:`, error);
        return false;
    }
}

// 发送initialized通知
async function sendInitializedNotification(serverName) {
    try {
        // 获取服务器信息
        const serverInfo = mcpRuntime.activeServers[serverName];
        if (!serverInfo) {
            throw new Error(`服务器 ${serverName} 未连接或不可用`);
        }

        // 获取或生成会话ID
        const session_id = mcpRuntime.sessionIds[serverName] ||
            `session_${serverName}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // 构造严格符合要求的initialized通知消息
        const initializedMessage = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        };

        console.log(`发送initialized通知到服务器 ${serverName}:`, initializedMessage);

        // 获取消息处理端点
        let messageEndpoint;

        // 使用服务器返回的endpoint，而不是硬编码的路径
        if (serverInfo.endpoint) {
            // 获取基础URL（协议 + 主机名 + 端口）
            const serverUrlObj = new URL(serverInfo.url);
            const baseUrl = `${serverUrlObj.protocol}//${serverUrlObj.host}`;
            // 确保endpoint以/开头
            const endpoint = serverInfo.endpoint.startsWith('/') ? serverInfo.endpoint : `/${serverInfo.endpoint}`;
            messageEndpoint = `${baseUrl}${endpoint}`;
        } else {
            console.error(`No endpoint found for server ${serverName}!!!!!!!`);
        }

        // 在URL中添加session_id查询参数
        const endpointUrl = new URL(messageEndpoint);
        endpointUrl.searchParams.append('session_id', session_id);
        messageEndpoint = endpointUrl.toString();

        console.log(`发送initialized通知到endpoint: ${messageEndpoint}`);

        // 发送初始化完成通知（新开TCP连接）
        const response = await fetch(messageEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-ID': session_id
            },
            body: JSON.stringify(initializedMessage)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`发送initialized通知到服务器 ${serverName} 时收到非200响应: ${response.status} ${errorText}`);
            return false;
        }

        console.log(`服务器 ${serverName} 已完成初始化流程`);

        return true;
    } catch (error) {
        console.error(`发送initialized通知到服务器 ${serverName} 失败:`, error);
        return false;
    }
}

// 向MCP服务器发送初始化请求
async function initializeServer(serverName) {
    try {
        // 获取服务器信息
        const serverInfo = mcpRuntime.activeServers[serverName];
        if (!serverInfo) {
            throw new Error(`服务器 ${serverName} 未连接或不可用`);
        }

        // 获取或生成会话ID
        const session_id = mcpRuntime.sessionIds[serverName] ||
            `session_${serverName}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // 构造初始化请求消息
        const initializeMessage = {
            jsonrpc: "2.0",
            id: `init_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {
                    roots: {
                        listChanged: true
                    }
                }
            },
            session_id: session_id
        };

        console.log(`发送初始化请求到服务器 ${serverName}:`, initializeMessage);

        // 获取消息处理端点
        let messageEndpoint;

        if (serverInfo.url && serverInfo.url.includes('/sse')) {
            // 如果URL包含/sse，则替换为/weather
            messageEndpoint = serverInfo.url.replace('/sse', '/weather');
        } else {
            // 添加默认的/weather路径
            const urlObj = new URL(serverInfo.url);
            messageEndpoint = `${urlObj.protocol}//${urlObj.host}/weather`;
        }

        // 在URL中添加session_id查询参数
        const endpointUrl = new URL(messageEndpoint);
        endpointUrl.searchParams.append('session_id', session_id);
        messageEndpoint = endpointUrl.toString();

        // 发送初始化请求
        const response = await fetch(messageEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-ID': session_id
            },
            body: JSON.stringify(initializeMessage)
        });

        // 处理响应
        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`初始化服务器 ${serverName} 时收到非200响应: ${response.status} ${errorText}`);
            // 继续执行，因为有些服务器可能不需要初始化
        } else {
            const responseData = await response.json();
            console.log(`服务器 ${serverName} 初始化响应:`, responseData);
        }

        // 发送初始化完成通知
        const initializedMessage = {
            jsonrpc: "2.0",
            method: "notifications/initialized",
            session_id: session_id
        };

        console.log(`发送初始化完成通知到服务器 ${serverName}:`, initializedMessage);

        // 发送初始化完成通知
        const initializedResponse = await fetch(messageEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-ID': session_id
            },
            body: JSON.stringify(initializedMessage)
        });

        // 处理响应
        if (!initializedResponse.ok) {
            const errorText = await initializedResponse.text();
            console.warn(`发送初始化完成通知到服务器 ${serverName} 时收到非200响应: ${initializedResponse.status} ${errorText}`);
        }

        // 标记本地初始化完成
        if (!mcpRuntime.sessionIds[serverName] && session_id) {
            mcpRuntime.sessionIds[serverName] = session_id;
        }

        return true;
    } catch (error) {
        console.error(`初始化服务器 ${serverName} 失败:`, error);
        return false;
    }
}

// 添加消息到UI
function addMessageToUI(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = content;

    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);

    // 滚动到最新消息
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 显示正在输入指示器
function showTypingIndicator() {
    // 创建指示器如果不存在
    if (!document.querySelector('.typing-indicator')) {
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.innerHTML = `
      <div class="dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
        chatMessages.appendChild(indicator);
    }

    // 显示指示器
    document.querySelector('.typing-indicator').style.display = 'block';
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 隐藏正在输入指示器
function hideTypingIndicator() {
    const indicator = document.querySelector('.typing-indicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

// 创建工具面板
function createToolsPanel() {
    // 创建工具面板容器
    const toolsPanel = document.createElement('div');
    toolsPanel.className = 'tools-panel';

    // 创建工具面板头部
    const panelHeader = document.createElement('div');
    panelHeader.className = 'panel-header';

    // 添加返回按钮和标题
    const headerTitle = document.createElement('h3');
    headerTitle.textContent = 'MCP工具列表';

    const backButton = document.createElement('button');
    backButton.className = 'back-button';
    backButton.innerHTML = '&larr; 返回';
    backButton.addEventListener('click', () => {
        document.body.classList.remove('show-tools-panel');
    });

    panelHeader.appendChild(backButton);
    panelHeader.appendChild(headerTitle);

    // 创建工具列表容器
    const toolsListContainer = document.createElement('div');
    toolsListContainer.className = 'tools-list-container';

    // 创建工具列表
    const toolsList = document.createElement('ul');
    toolsList.id = 'tools-list';
    toolsList.className = 'tools-list';
    toolsList.innerHTML = '<li class="loading-item">正在加载MCP工具...</li>';

    // 组装面板
    toolsListContainer.appendChild(toolsList);
    toolsPanel.appendChild(panelHeader);
    toolsPanel.appendChild(toolsListContainer);

    // 将面板添加到文档
    document.body.appendChild(toolsPanel);
}

// 创建聊天头部控件
function createChatHeader() {
    // 获取聊天头部
    const chatHeader = document.querySelector('.chat-header');
    if (!chatHeader) return;

    // 创建按钮容器，使按钮靠右对齐
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'header-buttons';

    // 创建清除对话按钮
    const clearBtn = document.createElement('button');
    clearBtn.id = 'clear-conversation';
    clearBtn.className = 'header-button';
    clearBtn.title = '清除对话历史';
    clearBtn.innerHTML = '<span class="button-icon">🗑️</span>';
    clearBtn.addEventListener('click', clearConversation);

    // 创建工具面板切换按钮
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'toggle-tools-panel';
    toggleBtn.className = 'header-button';
    toggleBtn.title = '显示工具列表';
    toggleBtn.innerHTML = '<span class="button-icon">🔧</span>';
    toggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('show-tools-panel');
        document.body.classList.remove('show-config-panel');
    });

    // 创建MCP配置面板切换按钮
    const configBtn = document.createElement('button');
    configBtn.id = 'toggle-config-panel';
    configBtn.className = 'header-button';
    configBtn.title = '配置MCP服务器';
    configBtn.innerHTML = '<span class="button-icon">⚙️</span>';
    configBtn.addEventListener('click', () => {
        document.body.classList.toggle('show-config-panel');
        document.body.classList.remove('show-tools-panel');
    });

    // 添加按钮到容器
    buttonContainer.appendChild(clearBtn);
    buttonContainer.appendChild(toggleBtn);
    buttonContainer.appendChild(configBtn);

    // 添加到聊天头部
    chatHeader.appendChild(buttonContainer);
}

// 创建MCP配置面板
function createMcpConfigPanel() {
    // 创建配置面板容器
    const configPanel = document.createElement('div');
    configPanel.className = 'config-panel';

    // 创建面板头部
    const panelHeader = document.createElement('div');
    panelHeader.className = 'panel-header';

    // 添加返回按钮和标题
    const headerTitle = document.createElement('h3');
    headerTitle.textContent = 'MCP服务器配置';

    const backButton = document.createElement('button');
    backButton.className = 'back-button';
    backButton.innerHTML = '&larr; 返回';
    backButton.addEventListener('click', () => {
        document.body.classList.remove('show-config-panel');
    });

    panelHeader.appendChild(backButton);
    panelHeader.appendChild(headerTitle);

    // 创建配置内容区域
    const configContent = document.createElement('div');
    configContent.className = 'config-content';

    // 创建服务器列表
    const serversList = document.createElement('div');
    serversList.id = 'mcp-servers-list';
    serversList.className = 'servers-list';

    // 创建添加新服务器的按钮
    const addBtn = document.createElement('button');
    addBtn.className = 'add-server-btn';
    addBtn.innerHTML = '<span class="button-icon">+</span> 添加新服务器';
    addBtn.addEventListener('click', addNewServer);

    // 创建保存配置的按钮
    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-config-btn';
    saveBtn.textContent = '保存配置并应用';
    saveBtn.addEventListener('click', saveAndApplyConfig);

    // 组装面板
    configContent.appendChild(serversList);
    configContent.appendChild(addBtn);
    configContent.appendChild(saveBtn);

    configPanel.appendChild(panelHeader);
    configPanel.appendChild(configContent);

    // 将面板添加到文档
    document.body.appendChild(configPanel);

    // 初始加载配置
    loadMcpConfig().then(updateServersConfigUI);
}

// 更新服务器配置UI
function updateServersConfigUI(config) {
    const serversList = document.getElementById('mcp-servers-list');
    if (!serversList) return;

    serversList.innerHTML = '';

    // 如果没有配置的服务器
    if (!config.servers || Object.keys(config.servers).length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-servers';
        emptyMsg.textContent = '没有配置的MCP服务器';
        serversList.appendChild(emptyMsg);
        return;
    }

    // 遍历并显示所有服务器
    Object.entries(config.servers).forEach(([name, settings]) => {
        const serverItem = document.createElement('div');
        serverItem.className = 'server-item';
        serverItem.dataset.name = name;

        // 服务器名称输入
        const nameGroup = document.createElement('div');
        nameGroup.className = 'input-group';
        const nameLabel = document.createElement('label');
        nameLabel.textContent = '服务器名称:';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'server-name';
        nameInput.value = name;
        nameGroup.appendChild(nameLabel);
        nameGroup.appendChild(nameInput);

        // 服务器URL输入
        const urlGroup = document.createElement('div');
        urlGroup.className = 'input-group';
        const urlLabel = document.createElement('label');
        urlLabel.textContent = 'SSE URL:';
        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.className = 'server-url';
        urlInput.value = settings.url || '';
        urlInput.placeholder = 'http://127.0.0.1:3001/sse';
        urlGroup.appendChild(urlLabel);
        urlGroup.appendChild(urlInput);

        // 服务器描述输入
        const descGroup = document.createElement('div');
        descGroup.className = 'input-group';
        const descLabel = document.createElement('label');
        descLabel.textContent = '描述:';
        const descInput = document.createElement('input');
        descInput.type = 'text';
        descInput.className = 'server-description';
        descInput.value = settings.description || '';
        descGroup.appendChild(descLabel);
        descGroup.appendChild(descInput);

        // 删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-server-btn';
        deleteBtn.innerHTML = '<span class="button-icon">🗑️</span>';
        deleteBtn.addEventListener('click', () => removeServer(serverItem));

        // 组装服务器配置项
        const serverHeader = document.createElement('div');
        serverHeader.className = 'server-header';

        const serverTitle = document.createElement('div');
        serverTitle.className = 'server-title';
        serverTitle.textContent = name;

        serverHeader.appendChild(serverTitle);
        serverHeader.appendChild(deleteBtn);

        serverItem.appendChild(serverHeader);
        serverItem.appendChild(nameGroup);
        serverItem.appendChild(urlGroup);
        serverItem.appendChild(descGroup);

        // 显示连接状态
        const statusDiv = document.createElement('div');
        statusDiv.className = 'server-status';

        const statusIndicator = document.createElement('span');
        statusIndicator.className = `status-indicator ${mcpRuntime.activeServers[name] ? 'connected' : 'disconnected'}`;

        const statusText = document.createElement('span');
        statusText.className = 'status-text';
        statusText.textContent = mcpRuntime.activeServers[name] ? '已连接' : '未连接';

        statusDiv.appendChild(statusIndicator);
        statusDiv.appendChild(statusText);
        serverItem.appendChild(statusDiv);

        serversList.appendChild(serverItem);
    });
}

// 添加新服务器
function addNewServer() {
    loadMcpConfig().then(config => {
        if (!config.servers) {
            config.servers = {};
        }

        // 生成一个唯一的名称
        const baseName = 'server';
        let name = baseName;
        let counter = 1;

        while (config.servers[name]) {
            name = `${baseName}-${counter}`;
            counter++;
        }

        // 添加新服务器
        config.servers[name] = {
            type: 'sse',
            url: '',
            description: ''
        };

        // 更新UI并保存
        updateServersConfigUI(config);
        saveMcpConfig(config);
    });
}

// 移除服务器
function removeServer(serverItem) {
    const name = serverItem.dataset.name;

    if (confirm(`确定要删除服务器 "${name}" 吗？`)) {
        loadMcpConfig().then(config => {
            if (config.servers && config.servers[name]) {
                // 如果服务器已连接，断开连接
                if (mcpRuntime.sseConnections[name]) {
                    mcpRuntime.sseConnections[name].close();
                    delete mcpRuntime.sseConnections[name];
                }

                delete config.servers[name];
                updateServersConfigUI(config);
                saveMcpConfig(config);
            }
        });
    }
}

// 保存配置并应用
async function saveAndApplyConfig() {
    // 收集当前UI中的配置
    const serverItems = document.querySelectorAll('.server-item');
    const newConfig = { servers: {} };

    serverItems.forEach(item => {
        const oldName = item.dataset.name;
        const nameInput = item.querySelector('.server-name');
        const urlInput = item.querySelector('.server-url');
        const descInput = item.querySelector('.server-description');

        const newName = nameInput.value.trim();
        const url = urlInput.value.trim();
        const description = descInput.value.trim();

        if (newName && url) {
            newConfig.servers[newName] = {
                type: 'sse',
                url,
                description
            };

            // 如果名称改变了，更新dataset
            if (oldName !== newName) {
                item.dataset.name = newName;
            }
        }
    });

    // 保存配置
    await saveMcpConfig(newConfig);

    // 断开所有现有连接
    Object.keys(mcpRuntime.sseConnections).forEach(name => {
        if (mcpRuntime.sseConnections[name]) {
            mcpRuntime.sseConnections[name].close();
        }
    });

    // 重置运行时状态
    mcpRuntime.sseConnections = {};
    mcpRuntime.activeServers = {};
    mcpRuntime.availableTools = [];
    mcpRuntime.toolsMap = {};

    // 重新初始化MCP服务器
    await initMcpServers();

    // 更新UI
    updateServersConfigUI(newConfig);

    // 显示成功消息
    alert('配置已保存并应用');

    // 关闭配置面板
    document.body.classList.remove('show-config-panel');
}

// 连接到SSE服务器
async function connectToSseServers(config) {
    if (!config.servers || Object.keys(config.servers).length === 0) {
        throw new Error('没有配置的MCP服务器');
    }

    const connectionPromises = [];

    for (const [serverName, serverConfig] of Object.entries(config.servers)) {
        if (serverConfig.type === 'sse' && serverConfig.url) {
            connectionPromises.push(connectToSseServer(serverName, serverConfig));
        }
    }

    // 等待所有连接完成
    await Promise.allSettled(connectionPromises);

    // 检查是否有成功连接的服务器
    if (Object.keys(mcpRuntime.activeServers).length === 0) {
        throw new Error('无法连接到任何MCP服务器');
    }
}

// 连接到单个SSE服务器
async function connectToSseServer(serverName, serverConfig) {
    return new Promise((resolve, reject) => {
        try {
            console.log(`开始与服务器 ${serverName} 建立SSE连接...`);
            const sse = new EventSource(serverConfig.url);

            // 设置超时
            const timeout = setTimeout(() => {
                sse.close();
                reject(new Error(`连接到 ${serverName} 超时`));
            }, 5000);

            // 连接成功
            sse.onopen = async () => {
                clearTimeout(timeout);

                // 保存SSE连接
                mcpRuntime.sseConnections[serverName] = sse;

                // 添加到活动服务器列表
                mcpRuntime.activeServers[serverName] = {
                    ...serverConfig,
                    endpoint: null, // 初始化endpoint为null
                    initialized: false // 初始化为未初始化状态
                };

                console.log(`成功建立SSE连接到MCP服务器: ${serverName}`);

                // 等待接收可能的session_id
                setTimeout(async () => {
                    try {
                        if (mcpRuntime.sessionIds[serverName]) {
                            console.log(`使用接收到的session_id: ${mcpRuntime.sessionIds[serverName]}`);
                        } else {
                            console.log(`未接收到session_id，将在请求中生成`);
                        }

                        // 步骤1: 发送initialize请求
                        console.log(`开始向服务器 ${serverName} 发送initialize请求...`);
                        const initResult = await sendInitializeRequest(serverName);

                        if (!initResult) {
                            console.error(`向服务器 ${serverName} 发送initialize请求失败`);
                            resolve(); // 继续执行，避免阻塞
                            return;
                        }

                        // 步骤2: 发送notifications/initialized通知
                        console.log(`向服务器 ${serverName} 发送notifications/initialized通知...`);
                        const notifyResult = await sendInitializedNotification(serverName);

                        if (!notifyResult) {
                            console.error(`向服务器 ${serverName} 发送initialized通知失败`);
                            resolve(); // 继续执行，避免阻塞
                            return;
                        }

                        // 步骤3: 获取工具列表
                        console.log(`向服务器 ${serverName} 请求工具列表...`);
                        await fetchToolsFromSse(serverName, serverConfig);
                        resolve();
                    } catch (error) {
                        console.error(`完成MCP协议初始化流程失败:`, error);
                        resolve(); // 即使失败也保持连接
                    }
                }, 1000); // 等待1秒以接收可能的session_id事件
            };

            // 连接错误
            sse.onerror = (error) => {
                clearTimeout(timeout);
                sse.close();
                console.error(`连接到MCP服务器 ${serverName} 失败:`, error);
                reject(new Error(`连接到 ${serverName} 失败`));
            };

            // 监听session_id事件，获取服务器分配的session_id
            sse.addEventListener('session_id', (event) => {
                try {
                    console.log(`从 ${serverName} 接收到session_id数据:`, event.data);
                    mcpRuntime.sessionIds[serverName] = event.data;
                } catch (error) {
                    console.error(`处理session_id数据出错:`, error);
                }
            });

            // 监听endpoint事件，获取服务器返回的endpoint路径
            sse.addEventListener('endpoint', (event) => {
                try {
                    console.log(`从 ${serverName} 接收到endpoint数据:`, event.data);

                    // 尝试解析endpoint数据
                    let endpointData = event.data;
                    try {
                        // 如果是JSON字符串，则解析它
                        if (typeof endpointData === 'string' && (endpointData.startsWith('{') || endpointData.startsWith('['))) {
                            endpointData = JSON.parse(endpointData);
                        }
                    } catch (e) {
                        // 如果解析失败，保持原始格式
                        console.log('endpoint数据不是有效的JSON格式');
                    }

                    // 保存endpoint路径
                    if (mcpRuntime.activeServers[serverName]) {
                        // 如果endpointData是对象并且包含endpoint属性
                        if (typeof endpointData === 'object' && endpointData !== null && endpointData.endpoint) {
                            mcpRuntime.activeServers[serverName].endpoint = endpointData.endpoint;
                        }
                        // 如果是字符串，直接使用
                        else if (typeof endpointData === 'string') {
                            mcpRuntime.activeServers[serverName].endpoint = endpointData;
                        }
                    }

                    // 从endpoint数据中提取session_id
                    if (typeof endpointData === 'object' && endpointData !== null) {
                        // 检查多种可能的属性名
                        if (endpointData.session_id) {
                            console.log(`从endpoint数据中提取session_id: ${endpointData.session_id}`);
                            mcpRuntime.sessionIds[serverName] = endpointData.session_id;
                        } else if (endpointData.sessionId) {
                            console.log(`从endpoint数据中提取sessionId: ${endpointData.sessionId}`);
                            mcpRuntime.sessionIds[serverName] = endpointData.sessionId;
                        } else if (endpointData.sessionID) {
                            console.log(`从endpoint数据中提取sessionID: ${endpointData.sessionID}`);
                            mcpRuntime.sessionIds[serverName] = endpointData.sessionID;
                        }
                    } else if (typeof endpointData === 'string') {
                        // 尝试从URL中提取session_id参数
                        try {
                            // 检查是否是URL格式
                            if (endpointData.includes('?') || endpointData.includes('session')) {
                                const url = new URL(endpointData.startsWith('http') ? endpointData : `http://example.com${endpointData}`);
                                const sessionId = url.searchParams.get('session_id') ||
                                    url.searchParams.get('sessionId') ||
                                    url.searchParams.get('session');

                                if (sessionId) {
                                    console.log(`从endpoint URL参数中提取session_id: ${sessionId}`);
                                    mcpRuntime.sessionIds[serverName] = sessionId;
                                }
                            }
                        } catch (e) {
                            console.error('尝试从endpoint URL提取session_id失败', e);
                        }
                    }
                } catch (error) {
                    console.error(`处理endpoint数据出错:`, error);
                }
            });

            // 消息处理
            sse.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log(`从 ${serverName} 接收到消息:`, data);

                    // 尝试从消息中提取session_id（作为备用方法）
                    if (data.session_id && !mcpRuntime.sessionIds[serverName]) {
                        console.log(`从消息中提取session_id: ${data.session_id}`);
                        mcpRuntime.sessionIds[serverName] = data.session_id;
                    }
                } catch (error) {
                    console.error(`解析来自 ${serverName} 的消息出错:`, error);
                }
            };
        } catch (error) {
            reject(error);
        }
    });
}

// 从SSE服务器获取工具列表
async function fetchToolsFromSse(serverName, serverConfig) {
    try {
        // 获取已保存的session_id，如果没有则生成一个新的
        const session_id = mcpRuntime.sessionIds[serverName] ||
            `session_${serverName}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        console.log(`为服务器 ${serverName} 使用session_id: ${session_id}`);

        // 根据MCP标准构造正确的tools/list请求格式
        const listToolsMessage = {
            jsonrpc: "2.0",
            method: "tools/list", // 使用斜杠而不是点
            params: {},          // 添加空的params对象
            id: `list_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            session_id: session_id
        };

        console.log(`请求工具列表从 ${serverName}`, listToolsMessage);

        // 获取消息处理端点 - 使用服务器返回的endpoint
        let messageEndpoint;

        // 使用服务器返回的endpoint，而不是硬编码的路径
        if (mcpRuntime.activeServers[serverName].endpoint) {
            // 获取基础URL（协议 + 主机名 + 端口）
            const serverUrlObj = new URL(serverConfig.url);
            const baseUrl = `${serverUrlObj.protocol}//${serverUrlObj.host}`;
            // 确保endpoint以/开头
            const endpoint = mcpRuntime.activeServers[serverName].endpoint.startsWith('/') ?
                mcpRuntime.activeServers[serverName].endpoint :
                `/${mcpRuntime.activeServers[serverName].endpoint}`;
            messageEndpoint = `${baseUrl}${endpoint}`;
            console.log(`使用服务器提供的endpoint: ${messageEndpoint}`);
        } else {
            // 如果没有endpoint，构造一个默认的（服务器可能没有返回endpoint）
            const urlObj = new URL(serverConfig.url);
            const defaultEndpoint = urlObj.pathname.replace('/sse', '');
            messageEndpoint = `${urlObj.protocol}//${urlObj.host}${defaultEndpoint || '/'}`;
            console.log(`没有找到服务器提供的endpoint，使用默认endpoint: ${messageEndpoint}`);
        }

        // 在URL中添加session_id查询参数
        const endpointUrl = new URL(messageEndpoint);
        endpointUrl.searchParams.append('session_id', session_id);
        messageEndpoint = endpointUrl.toString();

        // 创建一个Promise，通过SSE事件接收工具列表
        return new Promise((resolve, reject) => {
            // 设置超时
            const timeout = setTimeout(() => {
                reject(new Error(`从服务器 ${serverName} 获取工具列表超时`));
            }, 15000); // 15秒超时

            // 在SSE连接上设置事件监听，监听工具列表消息
            const handleToolsListMessage = event => {
                try {
                    const data = JSON.parse(event.data);
                    console.log(`从服务器 ${serverName} 接收到SSE消息:`, data);

                    // 检查这条消息是否是工具列表响应
                    // 响应ID匹配请求ID，且有result字段
                    if (data.id === listToolsMessage.id || 
                        (data.result && data.result.tools)) {
                        // 收到工具列表，清除超时并解析工具
                        clearTimeout(timeout);

                        // 处理工具列表
                        let tools = [];

                        // 处理MCP标准响应格式
                        if (data.result) {
                            // 如果响应包含标准的result字段
                            if (Array.isArray(data.result)) {
                                tools = data.result.map(tool => ({
                                    type: "function",
                                    function: {
                                        name: tool.name,
                                        description: tool.description,
                                        parameters: tool.inputSchema
                                    }
                                }));
                            }
                            // 如果result包含tools数组
                            else if (data.result.tools && Array.isArray(data.result.tools)) {
                                tools = data.result.tools.map(tool => ({
                                    type: "function",
                                    function: {
                                        name: tool.name,
                                        description: tool.description,
                                        parameters: tool.inputSchema || tool.parameters
                                    }
                                }));
                            }
                        }

                        // 记录工具来源
                        tools.forEach(tool => {
                            const toolName = tool.function?.name;
                            if (toolName) {
                                mcpRuntime.toolsMap[toolName] = {
                                    serverName: serverName
                                };
                            }
                        });

                        // 添加到可用工具列表
                        mcpRuntime.availableTools = [...mcpRuntime.availableTools, ...tools];

                        // 移除事件监听器
                        mcpRuntime.sseConnections[serverName].removeEventListener('message', handleToolsListMessage);

                        // 返回这个服务器的工具列表（UI格式）
                        resolve(tools.map(tool => ({
                            name: tool.function?.name,
                            description: tool.function?.description,
                            serverName: serverName
                        })));
                    }
                } catch (error) {
                    console.error(`解析SSE消息出错:`, error);
                }
            };

            // 添加事件监听器
            mcpRuntime.sseConnections[serverName].addEventListener('message', handleToolsListMessage);

            // 发送工具列表请求
            console.log(`发送工具列表请求到endpoint: ${messageEndpoint}`);
            fetch(messageEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': session_id
                },
                body: JSON.stringify(listToolsMessage)
            }).then(response => {
                // 检查HTTP响应状态
                if (!response.ok) {
                    response.text().then(errorText => {
                        console.warn(`请求工具列表时收到HTTP错误: ${response.status} ${errorText}`);
                    });
                } else {
                    // HTTP响应正常，但我们不需要处理它
                    // 工具列表将通过SSE连接返回
                    console.log(`已发送工具列表请求，等待SSE响应...`);
                }
            }).catch(error => {
                // 处理HTTP请求错误
                clearTimeout(timeout);
                mcpRuntime.sseConnections[serverName].removeEventListener('message', handleToolsListMessage);
                reject(error);
            });
        });
    } catch (error) {
        console.error(`无法从服务器 ${serverName} 获取工具列表:`, error);
        // 返回空数组，不再创建默认的天气工具
        return [];
    }
}

// 更新工具列表UI
function updateToolsList(tools) {
    const toolsList = document.getElementById('tools-list');
    if (!toolsList) return;

    toolsList.innerHTML = '';

    if (tools.length === 0) {
        toolsList.innerHTML = '<li class="no-tools">未找到可用工具</li>';
        return;
    }

    tools.forEach(tool => {
        const li = document.createElement('li');
        li.className = 'tool-item';

        const toolName = document.createElement('div');
        toolName.className = 'tool-name';
        toolName.textContent = tool.name || tool.function?.name || '未命名工具';

        const toolDesc = document.createElement('div');
        toolDesc.className = 'tool-description';
        toolDesc.textContent = tool.description || tool.function?.description || '无描述';

        // 添加服务器信息
        if (tool.serverName) {
            const serverInfo = document.createElement('div');
            serverInfo.className = 'server-info';
            serverInfo.textContent = `服务器: ${tool.serverName}`;
            li.appendChild(serverInfo);
        }

        if (tool.isDefault) {
            li.classList.add('default-tool');
        }

        li.appendChild(toolName);
        li.appendChild(toolDesc);
        toolsList.appendChild(li);
    });
}
