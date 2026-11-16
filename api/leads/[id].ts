import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from '../lib/auth.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

function isMissingTable(error: any): boolean {
  const msg = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`;
  return /does not exist|schema cache|PGRST205|PGRST204|42P01|42703/i.test(msg);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireUser(req, res))) return;
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing lead id',
    });
  }

  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return res.status(500).json({
        success: false,
        error: 'Missing Supabase environment variables',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (req.method === 'PATCH') {
      const updates = req.body;
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Core pipeline fields
      if ('status' in updates) payload.status = updates.status;
      if ('demoStatus' in updates) payload.demo_status = updates.demoStatus;
      if ('demoLink' in updates) payload.demo_link = updates.demoLink;
      if ('dealValue' in updates) payload.deal_value = updates.dealValue;
      if ('notes' in updates) payload.notes = updates.notes;
      if ('timeline' in updates) payload.timeline = updates.timeline;
      if ('outreachHistory' in updates) payload.outreach_history = updates.outreachHistory;
      if ('clientReplies' in updates) payload.client_replies = updates.clientReplies;

      // Editable identity and contact fields
      if ('businessName' in updates) payload.business_name = updates.businessName;
      if ('category' in updates) payload.category = updates.category;
      if ('city' in updates) payload.city = updates.city;
      if ('phone' in updates) payload.phone = updates.phone || null;
      if ('email' in updates) payload.email = updates.email || null;
      if ('instagram' in updates) payload.instagram = updates.instagram || null;
      if ('website' in updates) payload.website = updates.website || null;
      if ('outdatedWebsite' in updates) payload.outdated_website = Boolean(updates.outdatedWebsite);
      if ('latitude' in updates) payload.latitude = updates.latitude;
      if ('longitude' in updates) payload.longitude = updates.longitude;
      if ('rating' in updates) payload.rating = updates.rating;
      if ('reviewCount' in updates) payload.review_count = updates.reviewCount;
      if ('leadScore' in updates) payload.lead_score = updates.leadScore;
      if ('priority' in updates) payload.priority = updates.priority;

      const { data, error } = await supabase
        .from('leads')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(200).json({
        success: true,
        data,
      });
    }

    if (req.method === 'DELETE') {
      const now = new Date().toISOString();

      // Cancel open tasks for this lead and detach optional foreign keys before deleting.
      for (const op of [
        () => supabase.from('agent_tasks').update({ status: 'cancelled', completed_at: now, updated_at: now }).eq('lead_id', id).in('status', ['queued', 'waiting_approval']),
        () => supabase.from('agent_tasks').update({ lead_id: null, updated_at: now }).eq('lead_id', id),
        () => supabase.from('agent_activity').update({ lead_id: null }).eq('lead_id', id),
        () => supabase.from('outreach_replies').update({ lead_id: null }).eq('lead_id', id),
      ]) {
        const { error } = await op();
        if (error && !isMissingTable(error)) console.warn('Lead detach warning:', error.message);
      }

      // Remove child rows that reference leads(id) without ON DELETE CASCADE.
      for (const table of ['lead_notes', 'outreach_logs', 'demo_jobs']) {
        const { error } = await supabase.from(table).delete().eq('lead_id', id);
        if (error && !isMissingTable(error)) {
          return res.status(500).json({
            success: false,
            error: `Could not delete attached ${table.replace(/_/g, ' ')}: ${error.message}`,
          });
        }
      }

      const detachInvoice = await supabase.from('invoices').update({ lead_id: null }).eq('lead_id', id);
      if (detachInvoice.error && !isMissingTable(detachInvoice.error)) {
        const deleteInvoice = await supabase.from('invoices').delete().eq('lead_id', id);
        if (deleteInvoice.error && !isMissingTable(deleteInvoice.error)) {
          return res.status(500).json({
            success: false,
            error: `Could not clear attached invoice: ${deleteInvoice.error.message}`,
          });
        }
      }

      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) {
        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  } catch (error) {
    console.error('Lead detail API error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
