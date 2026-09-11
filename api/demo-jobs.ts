import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDemoPrompt } from '../src/lib/demo-factory';
import { processDemoJob } from './lib/demo-job-process';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
      try { return res.status(200).json({ success: true, data: await processDemoJob(supabase, jobId) }); }
      catch (error) { return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Demo processing failed' }); }
    }
    if (!leadId) return res.status(400).json({ success: false, error: 'leadId is required' });
    const { data: lead, error: leadError } = await supabase.from('leads').select('*').eq('id', leadId).single();
    if (leadError || !lead) return res.status(404).json({ success: false, error: 'Lead not found' });
    const { data: activeJob } = await supabase.from('demo_jobs').select('id,status').eq('lead_id', leadId).in('status', ['queued', 'generating']).maybeSingle();
    if (activeJob) return res.status(409).json({ success: false, error: 'This lead already has a demo job in progress.', data: activeJob });
    const prompt = buildDemoPrompt({ id: lead.id, businessName: lead.business_name, category: lead.category, city: lead.city, rating: lead.rating || 0, reviewCount: lead.review_count || 0, phone: lead.phone || undefined, email: lead.email || undefined, instagram: lead.instagram || undefined, website: lead.website || undefined, outdatedWebsite: lead.outdated_website || false, leadScore: lead.lead_score || 0, priority: lead.priority, status: lead.status, demoStatus: lead.demo_status || 'Not Started', notes: lead.notes || '', demoLink: lead.demo_link || undefined, dealValue: lead.deal_value || undefined, createdAt: lead.created_at, updatedAt: lead.updated_at, timeline: lead.timeline || [], outreachHistory: lead.outreach_history || [] }, templateKey);
    const { data, error } = await supabase.from('demo_jobs').insert({ lead_id: leadId, template_key: templateKey, status: 'queued', prompt }).select().single();
    if (error) return res.status(500).json({ success: false, error: error.message });
    await supabase.from('leads').update({ demo_status: 'In Progress', updated_at: new Date().toISOString() }).eq('id', leadId);
    return res.status(201).json({ success: true, data });
  }
  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
