// MCP Client Manager setup
let availableTools = [];

// Initialize MCP Client Manager
async function initMcpClientManager() {
  try {
    // 获取MCP客户端管理器的状态
    const mcpManagerAvailable = await api.invoke('get-mcp-client-manager');
    
    if (mcpManagerAvailable) {
      // 获取可用工具
      availableTools = await api.invoke('get-all-mcp-tools');
      
      console.log('MCP Client Manager initialized with tools:', 
        availableTools.map(tool => tool.name));
      
      // 为Azure OpenAI API格式化工具
      availableTools = availableTools.map(tool => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description || "",
          parameters: tool.inputSchema
        }
      }));
    }
  } catch (error) {
    console.error('Failed to initialize MCP Client Manager:', error);
  }
}

// Element references
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-btn');
const configButton = document.getElementById('configBtn');
const configModal = document.getElementById('config-modal');
const closeModalButton = document.querySelector('.close');
const saveConfigButton = document.getElementById('save-config-btn');
const apiKeyInput = document.getElementById('api-key');
const endpointInput = document.getElementById('endpoint');
const deploymentNameInput = document.getElementById('deployment-name');
const apiVersionInput = document.getElementById('api-version');

// Chat history
const chatHistory = [];

// Configuration
let config = {
  apiKey: '117a0bc586aa4711a95ca960560295cc',
  endpoint: 'https://yanhuopenapi.openai.azure.com',
  deploymentName: 'gpt-4o',
  apiVersion: '2025-01-01-preview'
};

// Configure marked for syntax highlighting
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true
});

// Event listeners
sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

configButton.addEventListener('click', () => {
  configModal.style.display = 'block';
});

closeModalButton.addEventListener('click', () => {
  configModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
  if (e.target === configModal) {
    configModal.style.display = 'none';
  }
});

saveConfigButton.addEventListener('click', saveConfig);

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await initMcpClientManager();
  console.log('MCP Client Manager initialized successfully');
});

// Functions
async function loadConfig() {
  const result = await api.invoke('load-config');
  if (result.success) {
    config = result.data;
    apiKeyInput.value = config.apiKey;
    endpointInput.value = config.endpoint;
    deploymentNameInput.value = config.deploymentName;
    apiVersionInput.value = config.apiVersion;
  } else {
    console.error('Failed to load config:', result.error);
  }
}

async function saveConfig() {
  config = {
    apiKey: apiKeyInput.value,
    endpoint: endpointInput.value,
    deploymentName: deploymentNameInput.value,
    apiVersion: apiVersionInput.value
  };

  const result = await api.invoke('save-config', config);
  if (result.success) {
    configModal.style.display = 'none';
  } else {
    console.error('Failed to save config:', result.error);
    alert('Failed to save configuration: ' + result.error);
  }
}

async function sendMessage() {
  const userMessage = userInput.value.trim();
  if (!userMessage) return;

  // Check if configuration is set
  if (!config.apiKey || !config.endpoint || !config.deploymentName) {
    alert('Please configure your Azure OpenAI API settings before sending messages.');
    configModal.style.display = 'block';
    return;
  }

  // Add user message to UI
  addMessageToUI('user', userMessage);
  
  // Clear input
  userInput.value = '';
  
  // Update chat history
  chatHistory.push({ role: 'user', content: userMessage });
  
  // Show typing indicator
  const indicatorElement = addTypingIndicator();
  
  try {
    // Disable send button during API call
    sendButton.disabled = true;
    
    // Process conversation with tools if available
    if (availableTools.length > 0) {
      // Remove typing indicator
      if (indicatorElement) {
        indicatorElement.remove();
      }
      
      await processConversationWithMCP();
    } else {
      // Create response message container for streaming response
      const responseId = 'response-' + Date.now();
      const responseElement = document.createElement('div');
      responseElement.className = 'message assistant-message';
      responseElement.innerHTML = `<div id="${responseId}" class="message-content"></div>`;
      chatContainer.appendChild(responseElement);
      const responseContentElement = document.getElementById(responseId);
      
      // Remove typing indicator
      if (indicatorElement) {
        indicatorElement.remove();
      }
      
      // Make API request to Azure OpenAI with streaming (without tools)
      await streamChatCompletion(chatHistory, responseContentElement);
    }
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
  } catch (error) {
    console.error('Error:', error);
    // Remove typing indicator
    if (indicatorElement) {
      indicatorElement.remove();
    }
    
    addMessageToUI('assistant', `Error: ${error.message}`);
  } finally {
    // Re-enable send button
    sendButton.disabled = false;
  }
}

function addMessageToUI(role, content) {
  const messageElement = document.createElement('div');
  messageElement.className = `message ${role}-message`;
  
  if (role === 'assistant') {
    // Render markdown for assistant messages
    messageElement.innerHTML = `<div class="message-content">${marked.parse(content)}</div>`;
  } else {
    // Simple text for user messages
    messageElement.innerHTML = `<div class="message-content">${content}</div>`;
  }
  
  chatContainer.appendChild(messageElement);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addTypingIndicator() {
  const indicatorElement = document.createElement('div');
  indicatorElement.className = 'message assistant-message';
  indicatorElement.innerHTML = `
    <div class="typing-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
  chatContainer.appendChild(indicatorElement);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return indicatorElement;
}

async function streamChatCompletion(messages, responseElement) {
  try {
    const controller = new AbortController();
    const signal = controller.signal;
    
    // Construct the API URL
    const apiUrl = `${config.endpoint}/openai/deployments/${config.deploymentName}/chat/completions?api-version=${config.apiVersion}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      },
      body: JSON.stringify({
        messages: messages,
        stream: true,
        max_tokens: 1000
      }),
      signal
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    // Process the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let responseText = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Decode the chunk
      const chunk = decoder.decode(value, { stream: true });
      
      // Process the SSE format
      const lines = chunk.split('\n').filter(line => line.trim() !== '' && line.trim() !== 'data: [DONE]');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonData = JSON.parse(line.substring(6));
            if (jsonData.choices && jsonData.choices[0]?.delta?.content) {
              const content = jsonData.choices[0].delta.content;
              responseText += content;
              responseElement.innerHTML = marked.parse(responseText);
              
              // Scroll to bottom
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          } catch (e) {
            console.warn('Error parsing JSON:', e, line);
          }
        }
      }
    }
    
    // Add the complete response to chat history
    chatHistory.push({ role: 'assistant', content: responseText });
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Fetch aborted');
    } else {
      throw error;
    }
  }
}

async function processConversationWithMCP() {
  let requiresFollowUp = true;
  let toolResults = [];
  
  while (requiresFollowUp) {
    // Build messages history with tool results
    const messagesWithTools = [...chatHistory];
    
    // Check if the last message is from assistant and contains tool calls
    const lastAssistantMessageIndex = findLastAssistantWithToolCallsIndex(messagesWithTools);

    if (lastAssistantMessageIndex !== -1 && toolResults.length > 0) {
      const lastAssistantMessage = messagesWithTools[lastAssistantMessageIndex];

      // Ensure each tool call has a corresponding tool response
      for (const toolCall of lastAssistantMessage.tool_calls) {
        // Check if this tool call already has a response
        const hasResponse = messagesWithTools.some(msg =>
          msg.role === 'tool' && msg.tool_call_id === toolCall.id
        );

        // If no response and we have a matching result, add tool response
        if (!hasResponse) {
          const toolResult = toolResults.find(tr => tr.tool_call_id === toolCall.id);
          if (toolResult) {
            messagesWithTools.push({
              role: "tool",
              tool_call_id: toolResult.tool_call_id,
              name: toolResult.name,
              content: toolResult.content
            });

            // Remove from pending results
            toolResults = toolResults.filter(tr => tr.tool_call_id !== toolCall.id);
          } else {
            // If no matching result, might be an error during execution, add error response
            console.warn(`No result found for tool call ID ${toolCall.id}, adding default error response`);
            messagesWithTools.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify({ error: "Tool execution failed or timed out" })
            });
          }
        }
      }
    }
    
    // Log messages for debugging
    console.log('Sending messages to API:', JSON.stringify(messagesWithTools, null, 2));

    // Call API with tools
    const response = await callAzureOpenAIWithTools(messagesWithTools);
    
    // Process response
    if (response.tool_calls && response.tool_calls.length > 0) {
      // AI requested tool use
      
      // Add assistant message to history with all tool calls
      chatHistory.push({
        role: "assistant",
        content: response.content || "",
        tool_calls: response.tool_calls
      });
      
      // Show thinking message if content provided
      if (response.content) {
        addMessageToUI('assistant', response.content);
      }

      // Process each tool call
      for (const toolCall of response.tool_calls) {
        const toolName = toolCall.function.name;
        addMessageToUI('system', `Using tool: ${toolName}...`);

        // Execute tool call
        try {
          const toolResult = await executeToolCall(toolCall);

          // Add result to tool results list
          toolResults.push({
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify(toolResult)
          });

          // Immediately add tool response to chat history
          chatHistory.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify(toolResult)
          });
        } catch (error) {
          console.error(`Error executing tool ${toolName}:`, error);

          // Add error response
          const errorResult = { error: `Tool execution failed: ${error.message}` };
          toolResults.push({
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify(errorResult)
          });

          // Add to chat history
          chatHistory.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify(errorResult)
          });
        }
      }
      
      // Still need follow-up processing
      requiresFollowUp = true;
    } else {
      // Final response, no tools needed
      
      // Add AI reply to UI
      addMessageToUI('assistant', response.content);
      
      // Add AI reply to history
      chatHistory.push({
        role: "assistant",
        content: response.content
      });
      
      // Processing complete
      requiresFollowUp = false;
    }
  }
}

// Find the index of the last assistant message with tool calls
function findLastAssistantWithToolCallsIndex(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant' && messages[i].tool_calls && messages[i].tool_calls.length > 0) {
      return i;
    }
  }
  return -1;
}

// Call Azure OpenAI API with tools
async function callAzureOpenAIWithTools(messages) {
  const apiUrl = `${config.endpoint}/openai/deployments/${config.deploymentName}/chat/completions?api-version=${config.apiVersion}`;
  
  // Use tools from MCP servers
  const body = {
    messages: messages,
    temperature: 0.7,
    max_tokens: 16384,
    tools: availableTools,
    tool_choice: "auto"
  };
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message;
}

// Execute a tool call using mcpClientManager via IPC
async function executeToolCall(toolCall) {
  const { name, arguments: args } = toolCall.function;
  const parsedArgs = JSON.parse(args);

  console.log(`Executing tool: ${name}, arguments:`, parsedArgs);

  try {
    // Execute tool through IPC 
    const result = await api.invoke('execute-mcp-tool', { 
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