import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processDemoJob } from './lib/demo-job-process.js';

function buildPrompt(lead: any, templateKey: string) {
  return [
    'Create a polished, mobile-first demo website for this business.',
    `Business name: ${lead.business_name}`,
    `Industry: ${lead.category || 'General business'}`,
    `Location: ${lead.city || 'Not provided'}`,
    `Phone: ${lead.phone || 'Not provided'}`,
    `Email: ${lead.email || 'Not provided'}`,
    `Instagram: ${lead.instagram || 'Not provided'}`,
    `Website status: ${lead.website ? 'Existing website' : 'No website found'}`,
    `Template: ${templateKey}`,
    'Include a hero, services, about, trust points, contact section, and a clear call to action.',
    'Do not invent medical, legal, financial, awards, pricing, or performance claims.',
    'Return structured website content only; the template controls layout and code.',
  ].join('\n');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ success: false, error: 'Missing Supabase environment variables' });
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (req.method === 'GET') {
      const { data, error } = await supabase.from('demo_jobs').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true, data });
    }

    if (req.method === 'POST') {
      const { leadId, templateKey = 'auto', jobId, action } = req.body || {};
      if (action === 'process' && jobId) {
        const data = await processDemoJob(supabase, jobId);
        return res.status(200).json({ success: true, data });
      }
      if (!leadId) return res.status(400).json({ success: false, error: 'leadId is required' });
      const { data: lead, error: leadError } = await supabase.from('leads').select('*').eq('id', leadId).single();
      if (leadError || !lead) return res.status(404).json({ success: false, error: 'Lead not found' });
      const { data: activeJob } = await supabase.from('demo_jobs').select('id,status').eq('lead_id', leadId).in('status', ['queued', 'generating']).maybeSingle();
      if (activeJob) return res.status(409).json({ success: false, error: 'This lead already has a demo job in progress.', data: activeJob });
      const prompt = buildPrompt(lead, templateKey);
      const { data, error } = await supabase.from('demo_jobs').insert({ lead_id: leadId, template_key: templateKey, status: 'queued', prompt }).select().single();
      if (error) return res.status(500).json({ success: false, error: error.message });
      await supabase.from('leads').update({ demo_status: 'In Progress', updated_at: new Date().toISOString() }).eq('id', leadId);
      return res.status(201).json({ success: true, data });
    }
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('demo-jobs API error:', error);
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Demo job server error' });
  }
}
