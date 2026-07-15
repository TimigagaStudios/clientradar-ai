// src/agents/baseAgent.ts

import { AgentType, AgentConfig, AgentResponse, AgentMessage } from './types';

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected systemPrompt: string;

  constructor(config: AgentConfig, systemPrompt: string) {
    this.config = config;
    this.systemPrompt = systemPrompt;
  }

  abstract getType(): AgentType;

  // This method will be implemented by each specific agent
  abstract processMessage(messages: AgentMessage[]): Promise<AgentResponse>;

  // Helper method for future use
  protected createErrorResponse(error: string): AgentResponse {
    return {
      success: false,
      error,
      agent: this.getType(),
    };
  }
}