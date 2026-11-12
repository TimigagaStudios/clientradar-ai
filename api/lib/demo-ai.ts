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

export type DemoShowcaseKind = 'listings' | 'menu' | 'products' | 'booking';

export const TIER_LIMITS: Record<DemoStyleLevel, { services: number; highlights: number; process: number; faq: number; showcase: number }> = {
  mid: { services: 3, highlights: 3, process: 0, faq: 0, showcase: 0 },
  hybrid: { services: 4, highlights: 3, process: 3, faq: 0, showcase: 3 },
  ultra: { services: 6, highlights: 4, process: 4, faq: 5, showcase: 6 },
};

// Chooses the business-type sample screen from the template or the lead category.
export function showcaseKind(template: string, category: unknown): DemoShowcaseKind {
  const text = `${template} ${String(category || '')}`.toLowerCase();
  if (/real[- ]?estate|apartment|propert|realt|housing|lettings/.test(text)) return 'listings';
  if (/restaurant|cafe|coffee|food|bar\b|bakery|kitchen|grill|pizza|catering|eatery/.test(text)) return 'menu';
  if (/barber|salon|spa\b|clinic|dental|dentist|repair|studio|gym|laundry/.test(text)) return 'booking';
  if (/shop|store|boutique|retail|commerce|fashion|clothing|jewel|furniture|electronics/.test(text)) return 'products';
  return 'booking';
}

export function showcaseRule(kind: DemoShowcaseKind, count: number) {
  const subject = {
    listings: 'sample property listings (title = listing name, subtitle = general area only, detail = short features such as bedrooms and bathrooms)',
    menu: 'sample menu items (title = dish or drink, subtitle = menu section, detail = short description)',
    products: 'sample products (title = product name, subtitle = product type, detail = short description)',
    booking: 'bookable services (title = service name, subtitle = who it is for, detail = short description)',
  }[kind];
  return `Also write a "showcase" with ${count} ${subject}. These are clearly labelled samples: keep them plausible and generic, and do not include prices, street addresses, real people or availability claims.`;
}

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
  if (level !== 'mid') shape.showcase = { title: '', items: [{ title: '', subtitle: '', detail: '' }] };
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

function cleanShowcase(value: any, limit: number) {
  if (!value || !Array.isArray(value.items) || limit <= 0) return null;
  const items = value.items
    .map((item: any) => ({ title: cleanText(item?.title, 70), subtitle: cleanText(item?.subtitle, 60), detail: cleanText(item?.detail, 200) }))
    .filter((item: any) => item.title && item.detail)
    .slice(0, limit);
  return items.length >= 2 ? { title: cleanText(value.title, 80), items } : null;
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
    showcase: cleanShowcase(parsed?.showcase, limits.showcase),
    closing: { title: cleanText(closing.title, 90), body: cleanText(closing.body, 320), cta: cleanText(closing.cta, 32) },
    disclaimer: cleanText(parsed?.disclaimer, 240),
  };
}

export async function generateDemoContent(lead: DemoLead, templateKey: string, prompt: string, styleLevel: DemoStyleLevel = 'mid') {
  const provider = (process.env.DEMO_AI_PROVIDER || 'fallback').toLowerCase();
  const apiKey = process.env.DEMO_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (provider === 'fallback' || !apiKey) return null;

  const model = process.env.DEMO_AI_MODEL || (provider === 'gemini' ? 'gemini-3.5-flash-lite' : '');
  if (!model) throw new Error('Set DEMO_AI_MODEL to the model you want to use with this provider');
  const instruction = `${prompt}\n\nReturn only valid JSON with this shape: ${tierShape(styleLevel)}. Use the existing website profile colors when provided. Do not invent reviews, awards, prices, licences, statistics or medical, legal or financial claims. Business: ${lead.business_name}. Template: ${templateKey}.`;
  let response: Response;
  const signal = AbortSignal.timeout(40000);

  if (provider === 'gemini') {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: instruction }] }], generationConfig: { responseMimeType: 'application/json' } }),
    });
  } else if (provider === 'openrouter') {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, temperature: 0.3, messages: [{ role: 'user', content: instruction }] }),
    });
  } else {
    throw new Error(`Unsupported DEMO_AI_PROVIDER: ${provider}`);
  }

  if (!response.ok) throw new Error(`Demo AI provider returned HTTP ${response.status} for model ${model}`);
  const body = await response.json();
  const text = provider === 'gemini' ? body.candidates?.[0]?.content?.parts?.[0]?.text : body.choices?.[0]?.message?.content;
  if (!text) throw new Error('Demo AI provider returned no content');
  const jsonText = String(text).replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed: unknown;
  try { parsed = JSON.parse(jsonText); } catch { throw new Error('Demo AI provider returned text that is not valid JSON'); }
  return normalizeDemoContent(parsed, styleLevel);
}
