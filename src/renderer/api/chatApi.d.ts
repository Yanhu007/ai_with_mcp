import { Config, Message } from '../types/ChatTypes';

interface ToolResult {
  tool_call_id: string;
  name: string;
  content: string;
}

interface ProcessConversationCallbacks {
  onAssistantMessage?: (message: Message) => void;
  onToolUse?: (toolName: string) => void;
  onToolResult?: (message: Message) => void;
  onFinalResponseChunk?: (text: string) => void;
}

interface SystemMessageCallbacks {
  onAdd?: (message: Message) => void;
  onRemove?: (message: Message) => void;
}

declare class ChatApi {
  availableTools: any[];
  config: Config;
  systemMessages: Message[];
  systemMessageCallbacks: SystemMessageCallbacks;
  
  constructor();
  
  registerSystemMessageCallbacks(callbacks: SystemMessageCallbacks): void;
  addUISystemMessage(content: string): Message;
  initMcpClientManager(): Promise<any[]>;
  loadConfig(): Promise<Config>;
  saveConfig(newConfig: Config): Promise<boolean>;
  streamChatCompletion(messages: Message[], onChunk?: (text: string) => void, onComplete?: (text: string) => void): Promise<string>;
  callAzureOpenAIWithTools(messages: Message[]): Promise<any>;
  executeToolCall(toolCall: any): Promise<any>;
  findLastAssistantWithToolCallsIndex(messages: Message[]): number;
  processConversationWithMCP(messages: Message[], callbacks?: ProcessConversationCallbacks): Promise<Message[]>;
}

declare const chatApi: ChatApi;
export default chatApi;