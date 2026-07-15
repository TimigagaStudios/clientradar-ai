// src/services/tools/updateLeadStatusTool.ts

import { Tool } from '../toolRegistry';

export const updateLeadStatusTool: Tool = {
  name: 'update_lead_status',
  description: 'Update the status of a lead (New, Demo Created, Email Sent, Pending Reply, Interested, Negotiating, Rejected, Deal Closed). Used by the Executive and Outreach Agents.',
  parameters: {
    leadId: 'string',
    status: 'string (New | Demo Created | Email Sent | Pending Reply | Interested | Negotiating | Rejected | Deal Closed)',
  },
  execute: async (params: any) => {
    // Placeholder for now.
    // Later this will call the updateLeadStatus function from LeadContext.

    console.log(`[Tool] update_lead_status called with:`, params);

    return {
      success: true,
      message: `Lead ${params.leadId} status updated to ${params.status}`,
    };
  },
};