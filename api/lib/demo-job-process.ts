import { generateDemoContent, showcaseKind, showcaseRule, splitTemplateKey, tierRules, TIER_LIMITS } from './demo-ai.js';
import type { DemoShowcaseKind, DemoStyleLevel } from './demo-ai.js';
import { recordTask } from './_team.js';
import { describeDesign, loadEarlierDesigns, pickDesignDna } from './_design.js';

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

function fallbackShowcase(kind: DemoShowcaseKind, lead: any, limit: number) {
  const city = lead.city || 'the local area';
  const sets: Record<DemoShowcaseKind, { title: string; items: { title: string; subtitle: string; detail: string }[] }> = {
    listings: { title: 'Featured listings', items: [
      { title: 'Modern one-bedroom apartment', subtitle: city, detail: '1 bedroom, 1 bathroom, open-plan living space.' },
      { title: 'Spacious two-bedroom home', subtitle: city, detail: '2 bedrooms, 2 bathrooms, private outdoor area.' },
      { title: 'Bright studio', subtitle: city, detail: 'Compact studio layout with fitted kitchen.' },
      { title: 'Family three-bedroom residence', subtitle: city, detail: '3 bedrooms, 2 bathrooms, parking space.' },
      { title: 'Top-floor apartment', subtitle: city, detail: '2 bedrooms, 1 bathroom, balcony.' },
      { title: 'Garden-level flat', subtitle: city, detail: '1 bedroom, 1 bathroom, shared garden.' },
    ] },
    menu: { title: 'From the menu', items: [
      { title: 'House special', subtitle: 'Mains', detail: 'The signature dish, prepared fresh to order.' },
      { title: 'Seasonal starter', subtitle: 'Starters', detail: 'A light plate built around seasonal ingredients.' },
      { title: 'Grilled favourite', subtitle: 'Mains', detail: 'A grilled classic served with a choice of sides.' },
      { title: 'Fresh salad bowl', subtitle: 'Light bites', detail: 'Crisp greens with a house dressing.' },
      { title: 'Homemade dessert', subtitle: 'Desserts', detail: 'A sweet finish made in-house.' },
      { title: 'Signature drink', subtitle: 'Drinks', detail: 'A refreshing house blend.' },
    ] },
    products: { title: 'Featured products', items: [
      { title: 'Best seller', subtitle: 'Popular', detail: 'A customer favourite from the main range.' },
      { title: 'New arrival', subtitle: 'Just in', detail: 'The latest addition to the collection.' },
      { title: 'Everyday essential', subtitle: 'Essentials', detail: 'A dependable choice for daily use.' },
      { title: 'Gift pick', subtitle: 'Gifts', detail: 'A thoughtful option for someone special.' },
      { title: 'Premium selection', subtitle: 'Premium', detail: 'A higher-end option with extra detail.' },
      { title: 'Bundle set', subtitle: 'Sets', detail: 'A matching set that works together.' },
    ] },
    booking: { title: 'Book a service', items: [
      { title: 'Initial consultation', subtitle: 'New customers', detail: 'A first conversation to understand what you need.' },
      { title: 'Standard appointment', subtitle: 'All customers', detail: 'The most requested service, by appointment.' },
      { title: 'Follow-up visit', subtitle: 'Returning customers', detail: 'A shorter visit to review progress.' },
      { title: 'Extended session', subtitle: 'All customers', detail: 'Extra time for more detailed work.' },
      { title: 'Group booking', subtitle: 'Families and teams', detail: 'One booking for several people.' },
      { title: 'Priority slot', subtitle: 'Urgent requests', detail: 'Ask the team about the earliest available time.' },
    ] },
  };
  return { title: sets[kind].title, items: sets[kind].items.slice(0, limit) };
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

// Reads the public title, description and colours of a lead's existing website.
// (Moved here from website-profile.ts to stay inside Vercel's server function limit.)
async function inspectPublicWebsite(url: string | undefined) {
  if (!url) return null;
  let parsed: URL;
  try { parsed = new URL(url.startsWith('http') ? url : `https://${url}`); } catch { return null; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  try {
    const response = await fetch(parsed.toString(), { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'ClientRadar-DemoFactory/1.0' } });
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 250_000);
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || null;
    const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1]?.trim() || null;
    const colors = [...new Set((html.match(/#[0-9a-fA-F]{6}/g) || []).map((color) => color.toLowerCase()))].slice(0, 8);
    return { url: parsed.toString(), title, description, colors };
  } catch {
    return null;
  }
}

const LEVEL_NAMES: Record<string, string> = { mid: 'Mid-Level', hybrid: 'Hybrid', ultra: 'Ultra Premium' };

// Same wording as the prompt built in api/demo-jobs.ts (kept in step by hand until that file is next edited).
export function buildDemoPrompt(lead: any, templateKey: string, styleLevel: DemoStyleLevel) {
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
    ...tierRules(styleLevel),
    'Do not invent medical, legal, financial, awards, pricing, review, or performance claims.',
    'Return structured website content only; the template controls layout and code.',
  ].join('\n');
}

// options.record = false when an agent task already tracks this build (avoids a double record).
export async function processDemoJob(supabase: any, id: string, options: { record?: boolean } = {}) {
  const record = options.record !== false;
  const { data: job, error: jobError } = await supabase.from('demo_jobs').select('*, leads(*)').eq('id', id).single();
  if (jobError || !job) throw new Error('Demo job not found');
  if (job.status === 'ready') return job;
  const startedAt = new Date();
  const businessName = job.leads?.business_name || 'a lead';
  const levelName = LEVEL_NAMES[splitTemplateKey(job.template_key).level] || 'demo';
  await supabase.from('demo_jobs').update({ status: 'generating', attempts: (job.attempts || 0) + 1, started_at: new Date().toISOString() }).eq('id', id);
  try {
    const lead = job.leads || {};
    const { template, level } = splitTemplateKey(job.template_key);
    const websiteProfile = await inspectPublicWebsite(lead.website);
    const stylePrompt = websiteProfile
      ? `${job.prompt}\nExisting website profile: ${JSON.stringify(websiteProfile)}\nPreserve the recognizable brand direction while improving clarity, hierarchy, mobile layout, and conversion flow.`
      : `${job.prompt}\nNo existing website was found. Create a distinctive brand direction based on the business name, category, city, and template. Avoid generic copy and vary palette, tone, layout emphasis, and visual mood between businesses.`;
    // Every demo gets its own design recipe, checked against earlier demos so looks do not repeat.
    const design = pickDesignDna({ seedText: `${id}:${(job.attempts || 0) + 1}`, category: lead.category, brandColors: websiteProfile?.colors, earlier: await loadEarlierDesigns(supabase, id) });
    const kind = showcaseKind(template, lead.category);
    const showcaseLimit = TIER_LIMITS[level].showcase;
    const fullPrompt = `${showcaseLimit > 0 ? `${stylePrompt}\n${showcaseRule(kind, showcaseLimit)}` : stylePrompt}\n${describeDesign(design)}`;
    // If the AI provider fails, the demo still completes with built-in text and records the reason.
    let generated: Awaited<ReturnType<typeof generateDemoContent>> = null;
    let aiError: string | null = null;
    try {
      generated = await generateDemoContent(lead, template, fullPrompt, level);
    } catch (reason) {
      aiError = reason instanceof Error ? reason.message.slice(0, 200) : 'AI provider failed';
    }
    const baseShowcase = showcaseLimit > 0 ? fallbackShowcase(kind, lead, showcaseLimit) : null;
    const showcase = baseShowcase ? { kind, title: generated?.showcase?.title || baseShowcase.title, items: generated?.showcase?.items || baseShowcase.items, sample: true } : null;
    const content = {
      businessName: lead.business_name || 'Your Business',
      category: lead.category || 'Business',
      city: lead.city || '',
      templateKey: template,
      styleLevel: level,
      generatedBy: generated ? 'ai' : 'fallback',
      aiError,
      design,
      showcase,
      ...mergeContent(fallbackContent(lead, level), generated),
      contact: { phone: lead.phone || null, email: lead.email || null, instagram: lead.instagram || null, website: lead.website || null },
      theme: generated?.theme || { ...fallbackTheme(lead), source: websiteProfile ? 'website-profile' : 'generated-fallback', websiteProfile },
    };
    const demoUrl = `/demos/preview/${id}`;
    const { data, error } = await supabase.from('demo_jobs').update({ status: 'ready', content, demo_url: demoUrl, generated_at: new Date().toISOString(), completed_at: new Date().toISOString(), error: null }).eq('id', id).select().single();
    if (error) throw error;
    await supabase.from('leads').update({ demo_status: 'Ready', demo_link: demoUrl, updated_at: new Date().toISOString() }).eq('id', job.lead_id);
    if (record) await recordTask({
      agentKey: 'demo-creation',
      title: `Build ${levelName} demo for ${businessName}`,
      status: 'done',
      summary: `Built the ${levelName} demo for ${businessName} (${generated ? 'AI written' : 'built-in text'}).`,
      leadId: job.lead_id,
      input: { jobId: id, template, level },
      output: { demoUrl, generatedBy: generated ? 'ai' : 'fallback', aiError },
      startedAt,
    });
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Demo generation failed';
    if (record) await recordTask({
      agentKey: 'demo-creation',
      title: `Build ${levelName} demo for ${businessName}`,
      status: 'failed',
      summary: `Could not build the demo for ${businessName}: ${message}`,
      leadId: job.lead_id,
      input: { jobId: id },
      error: message,
      startedAt,
    });
    await supabase.from('demo_jobs').update({ status: 'failed', error: message }).eq('id', id);
    throw new Error(message);
  }
}