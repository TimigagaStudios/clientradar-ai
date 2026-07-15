// src/services/fullAgentCommunication.ts

import { AgentType, AgentMessage, AgentResponse } from '../agents/types';
import { agentOrchestrator } from './agentOrchestrator';
import { toolExecutionSystem } from './toolExecutionSystem';

export class FullAgentCommunication {
  // Send a structured task from one agent to another
  async sendTask(
    fromAgent: AgentType,
    toAgent: AgentType,
    taskDescription: string,
    context?: string
  ): Promise<AgentResponse> {
    const message: AgentMessage = {
      role: 'user',
      content: `Task from ${fromAgent} Agent: ${taskDescription}${context ? `\nContext: ${context}` : ''}`,
    };

    return await agentOrchestrator.delegateTask(toAgent, [message]);
  }

  // Agent requests to use a tool
  async agentRequestTool(
    agentType: AgentType,
    toolName: string,
    params: any
  ): Promise<any> {
    // First check if the tool exists
    if (!toolExecutionSystem.toolExists(toolName)) {
      return {
        success: false,
        error: `Tool "${toolName}" not available`,
      };
    }

    // Execute the tool
    return await toolExecutionSystem.runTool(toolName, params);
  }

  // Broadcast a task to multiple agents
  async broadcastTask(
    fromAgent: AgentType,
    toAgents: AgentType[],
    taskDescription: string
  ): Promise<AgentResponse[]> {
    const results: AgentResponse[] = [];

    for (const agent of toAgents) {
      const result = await this.sendTask(fromAgent, agent, taskDescription);
      results.push(result);
    }

    return results;
  }
}

// Export a singleton instance
export const fullAgentCommunication = new FullAgentCommunication();