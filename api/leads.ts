import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './lib/auth.js';
import { isValidContactEmail, isValidContactPhone } from './lib/_website.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

function isMissingTable(error: any): boolean {
  const msg = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`;
  return /does not exist|schema cache|PGRST205|PGRST204|42P01|42703/i.test(msg);
}

async function resetAllLeads(supabase: any): Promise<number> {
  const now = new Date().toISOString();

  // 1. Cancel open lead-bound tasks so background queues do not chase deleted leads, then detach lead_id.
  for (const op of [
    () => supabase.from('agent_tasks').update({ status: 'cancelled', completed_at: now, updated_at: now }).in('status', ['queued', 'waiting_approval']).not('lead_id', 'is', null),
    () => supabase.from('agent_tasks').update({ status: 'cancelled', completed_at: now, updated_at: now }).in('status', ['queued', 'waiting_approval']).in('agent_key', ['demo-creation', 'outreach']),
    () => supabase.from('agent_tasks').update({ lead_id: null, updated_at: now }).not('lead_id', 'is', null),
    () => supabase.from('agent_activity').update({ lead_id: null }).not('lead_id', 'is', null),
  ]) {
    const { error } = await op();
    if (error && !isMissingTable(error)) {
      console.warn('Reset detach warning:', error.message);
    }
  }

  // 2. Remove child rows tied to leads (handles tables created without ON DELETE CASCADE).
  for (const table of ['lead_notes', 'outreach_logs', 'demo_jobs', 'outreach_replies']) {
    const { error } = await supabase.from(table).delete().not('lead_id', 'is', null);
    if (error && !isMissingTable(error)) {
      throw new Error(`Could not clear ${table.replace(/_/g, ' ')}: ${error.message}`);
    }
  }

  // 3. Preserve invoices when lead_id is nullable; only delete linked invoices if NOT NULL blocks detaching.
  const detachInvoices = await supabase.from('invoices').update({ lead_id: null }).not('lead_id', 'is', null);
  if (detachInvoices.error && !isMissingTable(detachInvoices.error)) {
    const removeInvoices = await supabase.from('invoices').delete().not('lead_id', 'is', null);
    if (removeInvoices.error && !isMissingTable(removeInvoices.error)) {
      throw new Error(`Could not clear linked invoices: ${removeInvoices.error.message}`);
    }
  }

  // 4. Delete all leads in one query and return how many were removed.
  const { data: deletedRows, error: deleteError } = await supabase
    .from('leads')
    .delete()
    .not('id', 'is', null)
    .select('id');

  if (deleteError) {
    throw new Error(deleteError.message || 'Could not delete leads');
  }

  return Array.isArray(deletedRows) ? deletedRows.length : 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireUser(req, res))) return;
  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return res.status(500).json({
        success: false,
        error: 'Missing Supabase environment variables',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (req.method === 'GET') {
      const pageSize = 1000;
      const maxRows = 5000;
      const rows: any[] = [];

      for (let start = 0; start < maxRows; start += pageSize) {
        const { data: page, error } = await supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(start, start + pageSize - 1);

        if (error) {
          return res.status(500).json({
            success: false,
            error: error.message,
          });
        }

        const chunk = Array.isArray(page) ? page : [];
        rows.push(...chunk);
        if (chunk.length < pageSize) break;
      }

      return res.status(200).json({
        success: true,
        data: rows,
      });
    }

    if (req.method === 'POST') {
      const lead = req.body;

      if (lead?.requireCompleteContacts === true && (!isValidContactEmail(lead.email) || !isValidContactPhone(lead.phone))) {
        return res.status(400).json({
          success: false,
          error: 'Map-sourced leads qualify only when both a valid business email address and a phone number are present.',
        });
      }

      const { data, error } = await supabase
        .from('leads')
        .insert([
          {
            business_name: lead.businessName,
            category: lead.category,
            city: lead.city,
            latitude: lead.latitude ?? null,
            longitude: lead.longitude ?? null,
            rating: lead.rating,
            review_count: lead.reviewCount,
            phone: lead.phone || null,
            email: lead.email || null,
            instagram: lead.instagram || null,
            website: lead.website || null,
            outdated_website: lead.outdatedWebsite || false,
            lead_score: lead.leadScore || 0,
            priority: lead.priority,
            status: lead.status,
            demo_status: lead.demoStatus || 'Not Started',
            notes: lead.notes || '',
            demo_link: lead.demoLink || null,
            deal_value: lead.dealValue || null,
            outreach_history: lead.outreachHistory || [],
            timeline: lead.timeline || [],
          },
        ])
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
      const confirmed = req.query.all === '1' || req.body?.confirm === 'RESET_ALL_LEADS';
      if (!confirmed) {
        return res.status(400).json({
          success: false,
          error: 'Reset confirmation is required to delete all leads.',
        });
      }
      const deleted = await resetAllLeads(supabase);
      return res.status(200).json({
        success: true,
        deleted,
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  } catch (error) {
    console.error('Leads API error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
