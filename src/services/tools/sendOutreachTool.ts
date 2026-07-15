// src/services/tools/sendOutreachTool.ts

import { Tool } from '../toolRegistry';

export const sendOutreachTool: Tool = {
  name: 'send_outreach',
  description: 'Send an outreach email to a lead using Brevo. This tool is used by the Outreach Agent.',
  parameters: {
    leadId: 'string',
    subject: 'string',
    body: 'string',
    type: 'string (email or follow_up)',
  },
  execute: async (params: any) => {
    // This is a placeholder for now.
    // Later this will call the actual Brevo API via /api/send-outreach.ts

    console.log(`[Tool] send_outreach called with:`, params);

    // Simulate sending
    return {
      success: true,
      message: `Outreach sent to lead ${params.leadId}`,
      details: {
        subject: params.subject,
        type: params.type,
      },
    };
  },
};