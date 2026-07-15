// src/services/agentOrchestrator.ts

import { AgentType, AgentMessage, AgentResponse } from '../agents/types';
import { agentService } from './agentService';

export class AgentOrchestrator {
  // Send a task to a specific agent
  async delegateTask(agentType: AgentType, messages: AgentMessage[]): Promise<AgentResponse> {
    return await agentService.sendMessage(agentType, messages);
  }

  // Example: Executive Agent delegates to another agent
  async executiveDelegate(
    targetAgent: AgentType,
    task: string
  ): Promise<AgentResponse> {
    const messages: AgentMessage[] = [
      {
        role: 'user',
        content: `Please handle this task: ${task}`,
      },
    ];

    return await this.delegateTask(targetAgent, messages);
  }
}

// Export a singleton instance
export const agentOrchestrator = new AgentOrchestrator();