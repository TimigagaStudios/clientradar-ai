// src/services/tools/logClientReplyTool.ts

import { Tool } from '../toolRegistry';

export const logClientReplyTool: Tool = {
  name: 'log_client_reply',
  description: 'Log a client reply (Interested, Not Interested, Need More Info, Requested Demo, etc.) into the lead record. Used by the Outreach and Executive Agents.',
  parameters: {
    leadId: 'string',
    status: 'string (Interested | Not Interested | Need More Info | Requested Demo | Follow-up Scheduled | Other)',
    note: 'string (optional details about the reply)',
  },
  execute: async (params: any) => {
    // This is a placeholder for now.
    // Later this will update the lead in Supabase via the updateLead function.

    console.log(`[Tool] log_client_reply called with:`, params);

    return {
      success: true,
      message: `Client reply logged for lead ${params.leadId}`,
      details: {
        status: params.status,
        note: params.note || 'No additional note',
      },
    };
  },
};