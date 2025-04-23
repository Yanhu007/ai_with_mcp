const { ipcRenderer } = require('electron');
const { marked } = require('marked');
const hljs = require('highlight.js');

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
  apiKey: '',
  endpoint: '',
  deploymentName: '',
  apiVersion: '2023-05-15'
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

// Load configuration on startup
loadConfig();

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

// Functions
async function loadConfig() {
  const result = await ipcRenderer.invoke('load-config');
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

  const result = await ipcRenderer.invoke('save-config', config);
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
    
    // Create response message container
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
    
    // Make API request to Azure OpenAI with streaming
    await streamChatCompletion(chatHistory, responseContentElement);
    
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