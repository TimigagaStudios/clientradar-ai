// src/services/tools/createInvoiceTool.ts

import { Tool } from '../toolRegistry';

export const createInvoiceTool: Tool = {
  name: 'create_invoice',
  description: 'Create a new invoice for a closed or negotiating deal. Used by the Executive and Revenue Agents.',
  parameters: {
    leadId: 'string',
    amount: 'number',
    dueDate: 'string (YYYY-MM-DD)',
    notes: 'string (optional)',
  },
  execute: async (params: any) => {
    // Placeholder for now.
    // Later this will create an invoice in Supabase.

    console.log(`[Tool] create_invoice called with:`, params);

    return {
      success: true,
      message: `Invoice created for lead ${params.leadId}`,
      details: {
        amount: params.amount,
        dueDate: params.dueDate,
      },
    };
  },
};