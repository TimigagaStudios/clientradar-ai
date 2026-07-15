// src/services/agentCommunication.ts

import { AgentType, AgentMessage, AgentResponse } from '../agents/types';
import { agentOrchestrator } from './agentOrchestrator';

export class AgentCommunication {
  // Send a message from one agent to another
  async sendMessageBetweenAgents(
    fromAgent: AgentType,
    toAgent: AgentType,
    message: string
  ): Promise<AgentResponse> {
    const messages: AgentMessage[] = [
      {
        role: 'user',
        content: `[Message from ${fromAgent} Agent]: ${message}`,
      },
    ];

    return await agentOrchestrator.delegateTask(toAgent, messages);
  }

  // Broadcast a message to multiple agents
  async broadcastMessage(
    fromAgent: AgentType,
    toAgents: AgentType[],
    message: string
  ): Promise<AgentResponse[]> {
    const results: AgentResponse[] = [];

    for (const agent of toAgents) {
      const result = await this.sendMessageBetweenAgents(fromAgent, agent, message);
      results.push(result);
    }

    return results;
  }
}

// Export a singleton instance
export const agentCommunication = new AgentCommunication();