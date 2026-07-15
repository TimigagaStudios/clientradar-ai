// src/agents/types.ts

export type AgentType =
  | 'executive'
  | 'radar'
  | 'scout'
  | 'outreach'
  | 'proposal'
  | 'studio'
  | 'revenue'
  | 'social'
  | 'communication';

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AgentResponse {
  success: boolean;
  content?: string;
  error?: string;
  agent: AgentType;
}

export interface AgentConfig {
  type: AgentType;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}