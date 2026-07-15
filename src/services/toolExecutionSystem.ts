// src/services/toolExecutionSystem.ts

import { toolExecutor } from './toolExecutor';
import { toolRegistry } from './toolRegistry';

export class ToolExecutionSystem {
  // Execute a tool by name with parameters
  async runTool(toolName: string, params: any): Promise<any> {
    const tool = toolRegistry.getTool(toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool "${toolName}" not found in registry`,
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

  // Get list of all available tools (for agents to know what they can use)
  getAvailableTools() {
    return toolRegistry.getAllTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  // Check if a tool exists
  toolExists(toolName: string): boolean {
    return toolRegistry.hasTool(toolName);
  }

  // Execute multiple tools in sequence
  async runMultipleTools(tools: Array<{ name: string; params: any }>): Promise<any[]> {
    const results = [];
    for (const tool of tools) {
      const result = await this.runTool(tool.name, tool.params);
      results.push(result);
    }
    return results;
  }
}

// Export a singleton instance
export const toolExecutionSystem = new ToolExecutionSystem();