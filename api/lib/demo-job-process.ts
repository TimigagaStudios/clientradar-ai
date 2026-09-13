import { generateDemoContent } from './demo-ai.js';
import { inspectPublicWebsite } from './website-profile.js';

function fallbackContent(lead: any, templateKey: string) {
  const business = lead.business_name || 'Your Business';
  const category = lead.category || 'Local business';
  const city = lead.city || 'your area';
  return {
    businessName: business, category, city, templateKey,
    hero: { eyebrow: category, title: `${business} made simple for ${city}`, description: `A polished demo concept for ${business}, designed to help customers understand the offer and take the next step.`, cta: 'Get in touch' },
    sections: [
      { title: 'What we offer', body: `Explore practical ${category.toLowerCase()} services shaped around your needs.` },
      { title: `Why choose ${business}`, body: 'Clear information, a professional first impression, and an easy way for customers to contact the business.' },
      { title: 'Ready to get started?', body: `Contact ${business} today to learn more.` },
    ],
    contact: { phone: lead.phone || null, email: lead.email || null, instagram: lead.instagram || null },
    disclaimer: 'Demo concept content. Confirm business details before production use.',
  };
}

function fallbackTheme(lead: any) {
  const palettes = [
    { background: '#0b1026', surface: '#131d3d', accent: '#ff7a00', text: '#f8fafc', muted: '#b6c0d9' },
    { background: '#f7f2ea', surface: '#fffaf2', accent: '#8b5e3c', text: '#2d241f', muted: '#75665d' },
    { background: '#071b1c', surface: '#0f2d2d', accent: '#4fd1c5', text: '#f0fffc', muted: '#a7c6c1' },
  ];
  const key = `${lead.business_name || ''}${lead.category || ''}`.split('').reduce((sum: number, char: string) => sum + char.charCodeAt(0), 0);
  return palettes[key % palettes.length];
}

export async function processDemoJob(supabase: any, id: string) {
  const { data: job, error: jobError } = await supabase.from('demo_jobs').select('*, leads(*)').eq('id', id).single();
  if (jobError || !job) throw new Error('Demo job not found');
  if (job.status === 'ready') return job;
  await supabase.from('demo_jobs').update({ status: 'generating', attempts: (job.attempts || 0) + 1, started_at: new Date().toISOString() }).eq('id', id);
  try {
    const websiteProfile = await inspectPublicWebsite(job.leads.website);
    const stylePrompt = websiteProfile
      ? `${job.prompt}\nExisting website profile: ${JSON.stringify(websiteProfile)}\nPreserve the recognizable brand direction while improving clarity, hierarchy, mobile layout, and conversion flow.`
      : `${job.prompt}\nNo existing website was found. Create a distinctive brand direction based on the business name, category, city, and template. Avoid generic copy and vary palette, tone, layout emphasis, and visual mood between businesses.`;
    const generated = await generateDemoContent(job.leads, job.template_key, stylePrompt);
    const content = { ...(generated || fallbackContent(job.leads, job.template_key)), theme: generated?.theme || { ...fallbackTheme(job.leads), source: websiteProfile ? 'website-profile' : 'generated-fallback', websiteProfile } };
    const demoUrl = `/demos/preview/${id}`;
    const { data, error } = await supabase.from('demo_jobs').update({ status: 'ready', content, demo_url: demoUrl, generated_at: new Date().toISOString(), completed_at: new Date().toISOString(), error: null }).eq('id', id).select().single();
    if (error) throw error;
    await supabase.from('leads').update({ demo_status: 'Ready', demo_link: demoUrl, updated_at: new Date().toISOString() }).eq('id', job.lead_id);
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Demo generation failed';
    await supabase.from('demo_jobs').update({ status: 'failed', error: message }).eq('id', id);
    throw new Error(message);
  }
}
