// src/services/toolRegistry.ts

import { sendOutreachTool } from './tools/sendOutreachTool';
import { searchBusinessTool } from './tools/searchBusinessTool';
import { logClientReplyTool } from './tools/logClientReplyTool';
import { updateLeadStatusTool } from './tools/updateLeadStatusTool';
import { createInvoiceTool } from './tools/createInvoiceTool';

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute?: (params: any) => Promise<any>;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    // Register default tools used by ClientRadar
    this.registerTool(sendOutreachTool);
    this.registerTool(searchBusinessTool);
    this.registerTool(logClientReplyTool);
    this.registerTool(updateLeadStatusTool);
    this.registerTool(createInvoiceTool);
  }

  // Register a new tool
  registerTool(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  // Get a tool by name
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  // Get all registered tools
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  // Check if a tool exists
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
}

// Export a singleton instance
export const toolRegistry = new ToolRegistry();