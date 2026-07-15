// src/services/toolExecutor.ts

import { toolRegistry } from './toolRegistry';

export class ToolExecutor {
  // Execute a tool by name with parameters
  async executeTool(toolName: string, params: any): Promise<any> {
    const tool = toolRegistry.getTool(toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool "${toolName}" not found`,
      };
    }

    if (!tool.execute) {
      return {
        success: false,
        error: `Tool "${toolName}" does not have an execute function`,
      };
    }

    try {
      const result = await tool.execute(params);
      return {
        success: true,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      };
    }
  }

  // Get list of available tools (useful for agents to know what they can use)
  getAvailableTools() {
    return toolRegistry.getAllTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }
}

// Export a singleton instance
export const toolExecutor = new ToolExecutor();