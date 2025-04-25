// ChatTypes.ts - Type definitions for the chat application

export interface Config {
  apiKey: string;
  endpoint: string;
  deploymentName: string;
  apiVersion: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: ToolCall[];
  id?: string; // Used for system messages that need to be tracked for removal
}

export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}