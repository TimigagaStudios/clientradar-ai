// src/services/toolExecutionSystem.ts

import { toolExecutor } from './toolExecutor';
import { toolRegistry } from './toolRegistry';

export class ToolExecutionSystem {
  // Execute a tool by name with parameters
  async runTool(toolName: string, params: any) {
    const tool = toolRegistry.getTool(toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool "${toolName}" not found in registry`,
      };
    }

    // Use the Tool Executor to run the tool
    return await toolExecutor.executeTool(toolName, params);
  }

  // Get list of all available tools (for agents to know what they can use)
  getAvailableTools() {
    return toolRegistry.getAllTools().map(tool => ({
      name: tool.name,
      description: tool.description,
    }));
  }

  // Check if a tool exists
  toolExists(toolName: string): boolean {
    return toolRegistry.hasTool(toolName);
  }
}

// Export a singleton instance
export const toolExecutionSystem = new ToolExecutionSystem();