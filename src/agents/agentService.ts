// src/services/agentService.ts

import { AgentType, AgentMessage, AgentResponse, AgentConfig } from '../agents/types';
import { BaseAgent } from '../agents/baseAgent';

export class AgentService {
  private agents: Map<AgentType, BaseAgent> = new Map();

  // Register an agent
  registerAgent(agent: BaseAgent) {
    this.agents.set(agent.getType(), agent);
  }

  // Get a registered agent
  getAgent(type: AgentType): BaseAgent | undefined {
    return this.agents.get(type);
  }

  // Main method to send a message to any agent
  async sendMessage(
    agentType: AgentType,
    messages: AgentMessage[]
  ): Promise<AgentResponse> {
    const agent = this.getAgent(agentType);

    if (!agent) {
      return {
        success: false,
        error: `Agent ${agentType} not registered`,
        agent: agentType,
      };
    }

    try {
      return await agent.processMessage(messages);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        agent: agentType,
      };
    }
  }
}

// Export a singleton instance
export const agentService = new AgentService();