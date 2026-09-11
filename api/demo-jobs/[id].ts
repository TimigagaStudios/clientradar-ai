import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateDemoContent } from '../lib/demo-ai';

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
    const { data: job, error: jobError } = await supabase.from('demo_jobs').select('*, leads(*)').eq('id', id).single();
    if (jobError || !job) return res.status(404).json({ success: false, error: 'Demo job not found' });
    if (job.status === 'ready') return res.status(200).json({ success: true, data: job });

    await supabase.from('demo_jobs').update({ status: 'generating', attempts: (job.attempts || 0) + 1, started_at: new Date().toISOString() }).eq('id', id);
    try {
      const content = (await generateDemoContent(job.leads, job.template_key, job.prompt)) || makeContent(job.leads, job.template_key);
      const demoUrl = `/demos/preview/${id}`;
      const { data, error } = await supabase.from('demo_jobs').update({ status: 'ready', content, demo_url: demoUrl, generated_at: new Date().toISOString(), completed_at: new Date().toISOString(), error: null }).eq('id', id).select().single();
      if (error) throw error;
      await supabase.from('leads').update({ demo_status: 'Ready', demo_link: demoUrl, updated_at: new Date().toISOString() }).eq('id', job.lead_id);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Demo generation failed';
      await supabase.from('demo_jobs').update({ status: 'failed', error: message }).eq('id', id);
      return res.status(500).json({ success: false, error: message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
