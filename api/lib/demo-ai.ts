type DemoLead = {
  business_name: string;
  category?: string;
  city?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  website?: string;
};

export type DemoStyleLevel = 'mid' | 'hybrid' | 'ultra';

export const TIER_LIMITS: Record<DemoStyleLevel, { services: number; highlights: number; process: number; faq: number }> = {
  mid: { services: 3, highlights: 3, process: 0, faq: 0 },
  hybrid: { services: 4, highlights: 3, process: 3, faq: 0 },
  ultra: { services: 6, highlights: 4, process: 4, faq: 5 },
};

export function normalizeStyleLevel(value: unknown): DemoStyleLevel {
  const level = String(value || '').toLowerCase();
  return level === 'hybrid' || level === 'ultra' ? level : 'mid';
}

// The style level travels inside template_key as "template:level" so no database change is needed.
export function splitTemplateKey(value: unknown) {
  const [template, level] = String(value || 'auto').split(':');
  return { template: template || 'auto', level: normalizeStyleLevel(level) };
}

export function tierRules(level: DemoStyleLevel): string[] {
  if (level === 'ultra') {
    return [
      'Style level: Ultra Premium.',
      'Write a full, production-grade presentation with the richest copy and a distinct brand voice.',
      'Use the exact brand colors when they are known. Follow current modern UI/UX principles with consistent spacing and structure.',
      'The demo is multi-page: Home, About, Services, FAQ and Contact. Write content for every page.',
      'Provide 6 services, 4 reasons to choose the business, 4 process steps and 5 frequently asked questions.',
    ];
  }
  if (level === 'hybrid') {
    return [
      'Style level: Hybrid.',
      'Balance aesthetics and functionality: clean premium wording, professional grid-based structure, SEO-friendly headings.',
      'Avoid enterprise features. Focus on speed, clarity and reusability.',
      'One long page: hero, about, services, reasons to choose the business, a how-it-works process and a contact call to action.',
      'Provide 4 services, 3 reasons to choose the business and 3 process steps.',
    ];
  }
  return [
    'Style level: Mid-Level.',
    'Modern, clean and fast: strong visual layout, clean typography, SEO-friendly headings, low complexity.',
    'No dashboards, no admin features, no heavy functionality.',
    'One page: hero, about, services, reasons to choose the business and a contact call to action.',
    'Provide 3 services and 3 reasons to choose the business.',
  ];
}

function tierShape(level: DemoStyleLevel) {
  const shape: Record<string, unknown> = {
    theme: { background: '#000000', surface: '#111111', accent: '#ff7a00', text: '#ffffff', muted: '#cccccc', style: 'modern' },
    hero: { eyebrow: '', title: '', description: '', cta: '' },
    about: { title: '', body: '' },
    services: [{ title: '', body: '' }],
    highlights: [{ title: '', body: '' }],
  };
  if (level !== 'mid') shape.process = [{ title: '', body: '' }];
  if (level === 'ultra') shape.faq = [{ question: '', answer: '' }];
  shape.closing = { title: '', body: '', cta: '' };
  shape.disclaimer = '';
  return JSON.stringify(shape);
}

function cleanText(value: unknown, max: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function cleanPairs(value: unknown, limit: number, first: string, second: string) {
  if (!Array.isArray(value) || limit <= 0) return [];
  return value
    .map((item) => ({ [first]: cleanText(item?.[first], 90), [second]: cleanText(item?.[second], 420) }))
    .filter((item) => item[first] && item[second])
    .slice(0, limit);
}

function cleanTheme(value: any) {
  const isHex = (color: unknown) => typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color);
  if (!value || !isHex(value.background) || !isHex(value.text) || !isHex(value.accent)) return null;
  return {
    background: value.background,
    surface: isHex(value.surface) ? value.surface : value.background,
    accent: value.accent,
    text: value.text,
    muted: isHex(value.muted) ? value.muted : value.text,
    style: cleanText(value.style, 40) || 'modern',
    source: 'ai',
  };
}

// Keeps only the fields the preview understands, with safe lengths. Empty parts are filled by the fallback later.
export function normalizeDemoContent(parsed: any, level: DemoStyleLevel) {
  const limits = TIER_LIMITS[level];
  const hero = parsed?.hero || {};
  const about = parsed?.about || {};
  const closing = parsed?.closing || {};
  return {
    theme: cleanTheme(parsed?.theme),
    hero: { eyebrow: cleanText(hero.eyebrow, 60), title: cleanText(hero.title, 110), description: cleanText(hero.description, 320), cta: cleanText(hero.cta, 32) },
    about: { title: cleanText(about.title, 90), body: cleanText(about.body, 700) },
    services: cleanPairs(parsed?.services, limits.services, 'title', 'body'),
    highlights: cleanPairs(parsed?.highlights, limits.highlights, 'title', 'body'),
    process: cleanPairs(parsed?.process, limits.process, 'title', 'body'),
    faq: cleanPairs(parsed?.faq, limits.faq, 'question', 'answer'),
    closing: { title: cleanText(closing.title, 90), body: cleanText(closing.body, 320), cta: cleanText(closing.cta, 32) },
    disclaimer: cleanText(parsed?.disclaimer, 240),
  };
}

export async function generateDemoContent(lead: DemoLead, templateKey: string, prompt: string, styleLevel: DemoStyleLevel = 'mid') {
  const provider = (process.env.DEMO_AI_PROVIDER || 'fallback').toLowerCase();
  const apiKey = process.env.DEMO_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (provider === 'fallback' || !apiKey) return null;

  const model = process.env.DEMO_AI_MODEL || 'gemini-2.0-flash';
  const instruction = `${prompt}\n\nReturn only valid JSON with this shape: ${tierShape(styleLevel)}. Use the existing website profile colors when provided. Do not invent reviews, awards, prices, licences, statistics or medical, legal or financial claims. Business: ${lead.business_name}. Template: ${templateKey}.`;
  let response: Response;

  if (provider === 'gemini') {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: instruction }] }], generationConfig: { responseMimeType: 'application/json' } }),
    });
  } else if (provider === 'openrouter') {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, temperature: 0.3, messages: [{ role: 'user', content: instruction }] }),
    });
  } else {
    throw new Error(`Unsupported DEMO_AI_PROVIDER: ${provider}`);
  }

  if (!response.ok) throw new Error(`Demo AI provider returned HTTP ${response.status}`);
  const body = await response.json();
  const text = provider === 'gemini' ? body.candidates?.[0]?.content?.parts?.[0]?.text : body.choices?.[0]?.message?.content;
  if (!text) throw new Error('Demo AI provider returned no content');
  const jsonText = String(text).replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed: unknown;
  try { parsed = JSON.parse(jsonText); } catch { throw new Error('Demo AI provider returned text that is not valid JSON'); }
  return normalizeDemoContent(parsed, styleLevel);
}
