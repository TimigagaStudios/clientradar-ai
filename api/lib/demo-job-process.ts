import { generateDemoContent, splitTemplateKey, TIER_LIMITS } from './demo-ai.js';
import type { DemoStyleLevel } from './demo-ai.js';
import { inspectPublicWebsite } from './website-profile.js';

function fallbackContent(lead: any, level: DemoStyleLevel) {
  const business = lead.business_name || 'Your Business';
  const category = lead.category || 'Local business';
  const lower = category.toLowerCase();
  const city = lead.city || 'your area';
  const limits = TIER_LIMITS[level];
  const services = [
    { title: 'Core services', body: `Practical ${lower} services explained clearly, so customers know what to expect before they get in touch.` },
    { title: 'Enquiries and bookings', body: `A simple way to ask a question or arrange a time with ${business}.` },
    { title: 'Customer care', body: 'Friendly, direct communication from the first message to the finished job.' },
    { title: 'Tailored options', body: 'Options shaped around what each customer actually needs, discussed before any commitment.' },
    { title: 'Clear information', body: 'Opening details, location and contact routes kept easy to find on every screen size.' },
    { title: 'After-service support', body: `A clear route back to ${business} for follow-up questions.` },
  ];
  const highlights = [
    { title: 'Local and reachable', body: `Based in ${city} and easy to contact by phone or message.` },
    { title: 'Clear and honest', body: 'Straightforward information with no confusing fine print.' },
    { title: 'Built for mobile', body: 'Customers can find what they need in seconds on any phone.' },
    { title: 'A professional first impression', body: `A modern online home that reflects the quality of ${business}.` },
  ];
  const process = [
    { title: 'Get in touch', body: `Call or message ${business} with what you need.` },
    { title: 'Talk it through', body: 'Discuss the details and agree the best option for you.' },
    { title: 'Confirm', body: 'Agree a time and the next steps.' },
    { title: 'Enjoy the service', body: 'Sit back while the team takes care of the rest.' },
  ];
  const faq = [
    { question: `Where is ${business} located?`, answer: `${business} serves customers in ${city}. Contact the team for exact directions.` },
    { question: 'How do I make an enquiry?', answer: 'Use the contact details on this page to call or send a message.' },
    { question: 'What services are available?', answer: `See the services section for an overview, or ask the team about a specific ${lower} need.` },
    { question: 'What are the opening hours?', answer: 'Opening hours will be confirmed by the business before this site goes live.' },
    { question: 'How quickly will I get a reply?', answer: 'The team aims to respond as soon as possible during working hours.' },
  ];
  return {
    hero: { eyebrow: category, title: `${business} made simple for ${city}`, description: `A polished demo concept for ${business}, designed to help customers understand the offer and take the next step.`, cta: 'Get in touch' },
    about: { title: `About ${business}`, body: `${business} is a ${lower} business serving ${city}. This demo shows how a clear, modern website can introduce the business, explain what it offers and make it easy for customers to get in touch.` },
    services: services.slice(0, limits.services),
    highlights: highlights.slice(0, limits.highlights),
    process: process.slice(0, limits.process),
    faq: faq.slice(0, limits.faq),
    closing: { title: 'Ready to get started?', body: `Contact ${business} today to learn more.`, cta: 'Contact us' },
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

// Uses each AI-written part when present, otherwise the safe fallback part, so the preview is always complete.
function mergeContent(base: any, generated: any) {
  if (!generated) return base;
  const pick = (ai: any, fallback: any) => {
    const merged = { ...fallback };
    Object.keys(fallback).forEach((key) => { if (ai?.[key]) merged[key] = ai[key]; });
    return merged;
  };
  const list = (ai: any[], fallback: any[]) => (Array.isArray(ai) && ai.length >= Math.min(2, fallback.length) ? ai : fallback);
  return {
    hero: pick(generated.hero, base.hero),
    about: pick(generated.about, base.about),
    services: list(generated.services, base.services),
    highlights: list(generated.highlights, base.highlights),
    process: list(generated.process, base.process),
    faq: list(generated.faq, base.faq),
    closing: pick(generated.closing, base.closing),
    disclaimer: generated.disclaimer || base.disclaimer,
  };
}

export async function processDemoJob(supabase: any, id: string) {
  const { data: job, error: jobError } = await supabase.from('demo_jobs').select('*, leads(*)').eq('id', id).single();
  if (jobError || !job) throw new Error('Demo job not found');
  if (job.status === 'ready') return job;
  await supabase.from('demo_jobs').update({ status: 'generating', attempts: (job.attempts || 0) + 1, started_at: new Date().toISOString() }).eq('id', id);
  try {
    const lead = job.leads || {};
    const { template, level } = splitTemplateKey(job.template_key);
    const websiteProfile = await inspectPublicWebsite(lead.website);
    const stylePrompt = websiteProfile
      ? `${job.prompt}\nExisting website profile: ${JSON.stringify(websiteProfile)}\nPreserve the recognizable brand direction while improving clarity, hierarchy, mobile layout, and conversion flow.`
      : `${job.prompt}\nNo existing website was found. Create a distinctive brand direction based on the business name, category, city, and template. Avoid generic copy and vary palette, tone, layout emphasis, and visual mood between businesses.`;
    const generated = await generateDemoContent(lead, template, stylePrompt, level);
    const content = {
      businessName: lead.business_name || 'Your Business',
      category: lead.category || 'Business',
      city: lead.city || '',
      templateKey: template,
      styleLevel: level,
      generatedBy: generated ? 'ai' : 'fallback',
      ...mergeContent(fallbackContent(lead, level), generated),
      contact: { phone: lead.phone || null, email: lead.email || null, instagram: lead.instagram || null },
      theme: generated?.theme || { ...fallbackTheme(lead), source: websiteProfile ? 'website-profile' : 'generated-fallback', websiteProfile },
    };
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