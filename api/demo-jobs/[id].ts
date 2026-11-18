import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireOwner } from '../lib/auth.js';
import { generateDemoContent } from '../lib/demo-ai.js';
import { screenDemo } from '../lib/_demo-qa.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

function makeContent(lead: any, templateKey: string) {
  const business = lead.business_name || 'Your Business';
  const category = lead.category || 'Local business';
  const city = lead.city || 'your area';
  return {
    businessName: business,
    category,
    city,
    templateKey,
    hero: {
      eyebrow: category,
      title: `${business} made simple for ${city}`,
      description: `A polished demo concept for ${business}, designed to help customers understand the offer and take the next step.`,
      cta: 'Get in touch',
    },
    sections: [
      { title: 'What we offer', body: `Explore practical ${category.toLowerCase()} services shaped around your needs.` },
      { title: `Why choose ${business}`, body: 'Clear information, a professional first impression, and an easy way for customers to contact the business.' },
      { title: 'Ready to get started?', body: `Contact ${business} today to learn more.` },
    ],
    contact: { phone: lead.phone || null, email: lead.email || null, instagram: lead.instagram || null },
    disclaimer: 'Demo concept content. Confirm business details before production use.',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireOwner(req, res))) return;
  if (process.env.API_AUTH_DISABLED === 'true') return res.status(403).json({ success: false, error: 'Private demo data requires authentication.' });
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ success: false, error: 'Demo job id is required' });
  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ success: false, error: 'Missing Supabase environment variables' });
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('demo_jobs').select('*, leads(*)').eq('id', id).single();
    if (error) return res.status(404).json({ success: false, error: error.message });
    return res.status(200).json({ success: true, data });
  }

  if (req.method === 'POST') {
    if (process.env.API_AUTH_DISABLED === 'true' || req.body?.confirm !== true) return res.status(403).json({ success: false, error: 'An authenticated owner must approve demo creation or retry.' });
    const { data: job, error: jobError } = await supabase.from('demo_jobs').select('*, leads(*)').eq('id', id).single();
    if (jobError || !job) return res.status(404).json({ success: false, error: 'Demo job not found' });
    if (job.status === 'ready') return res.status(200).json({ success: true, data: job });

    const now = new Date();
    const stuck = job.status === 'generating' && Number.isFinite(Date.parse(job.started_at || '')) && now.getTime() - Date.parse(job.started_at) > 120000;
    if (!['queued', 'failed'].includes(job.status) && !stuck) return res.status(409).json({ success: false, error: 'Demo is already generating or cannot be started.' });
    const started = now.toISOString();
    let claim = supabase.from('demo_jobs').update({ status: 'generating', attempts: (job.attempts || 0) + 1, started_at: started }).eq('id', id).eq('status', job.status);
    claim = job.attempts == null ? claim.is('attempts', null) : claim.eq('attempts', job.attempts);
    if (stuck) claim = claim.eq('started_at', job.started_at);
    const { data: claimed, error: claimError } = await claim.select('id');
    if (claimError) return res.status(500).json({ success: false, error: claimError.message });
    if (!claimed?.length) return res.status(409).json({ success: false, error: 'Demo is already generating or changed. Please retry.' });
    try {
      const content = (await generateDemoContent(job.leads, job.template_key, job.prompt)) || makeContent(job.leads, job.template_key);
      const demoUrl = `/demos/preview/${id}`;
      const { data, error } = await supabase.from('demo_jobs').update({ status: 'ready', content: screenDemo(content, { fixWhitespace: req.body?.qaMinor === true && process.env.API_AUTH_DISABLED !== 'true' }), demo_url: demoUrl, generated_at: new Date().toISOString(), completed_at: new Date().toISOString(), error: null }).eq('id', id).eq('status', 'generating').eq('started_at', started).select().maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('A newer demo build replaced this attempt.');
      await supabase.from('leads').update({ demo_status: 'Ready', demo_link: demoUrl, updated_at: new Date().toISOString() }).eq('id', job.lead_id);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Demo generation failed';
      await supabase.from('demo_jobs').update({ status: 'failed', error: message }).eq('id', id).eq('status', 'generating').eq('started_at', started);
      return res.status(500).json({ success: false, error: message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
