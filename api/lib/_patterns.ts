import { sameTrade } from './_design.js';

// Built-in text that learns from the AI. Every demo the AI has written stays in the database; when the
// AI cannot be reached, the built-in writer borrows the wording of an earlier AI demo OF THE SAME TRADE
// and re-fits it to the new business. No new table is needed: the finished demos are the memory.
//
// Safety rules, because one business's facts must never appear on another business's site:
// - only a demo of the same trade is used (a dentist never borrows from a restaurant);
// - the earlier business's name and city are swapped for the new ones;
// - any sentence that still carries a number, a claim word (award, certified, years, family-owned...),
//   a web or email address, or a word from the earlier business's name is thrown away;
// - whatever is thrown away falls back to the plain built-in sentence for that part.

const CLAIMS = /\b(award|awarded|winning|certified|certificate|accredit|licen[cs]ed|registered|insured|since|established|founded|family[- ]owned|years?|decades?|generation|voted|rated|stars?|reviews?|testimonial|guarantee|warrant|no\.? ?1|number one|leading|largest|oldest|best|top[- ]rated|trusted by|clients served|customers served|members?hip|partner of|official|exclusive|patent)\b/i;
const GENERIC = new Set(['the', 'and', 'for', 'group', 'company', 'services', 'service', 'limited', 'studio', 'studios', 'centre', 'center', 'clinic', 'house', 'home', 'homes', 'real', 'estate', 'realty', 'restaurant', 'kitchen', 'dental', 'care', 'shop', 'store', 'salon', 'hotel', 'international', 'global', 'nigeria', 'lagos']);

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type Refit = (value: unknown, max: number) => string | null;

function refitter(source: { name: string; city: string }, target: { name: string; city: string; category: string }): Refit {
  const leftovers = source.name.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !GENERIC.has(word) && !target.name.toLowerCase().includes(word) && !target.category.toLowerCase().includes(word));
  return (value, max) => {
    if (typeof value !== 'string' || !value.trim()) return null;
    let text = value;
    if (source.name.length >= 3) text = text.replace(new RegExp(escapeRegex(source.name), 'gi'), target.name);
    if (source.city.length >= 3) {
      if (!target.city && new RegExp(`\\b${escapeRegex(source.city)}\\b`, 'i').test(text)) return null;
      text = text.replace(new RegExp(`\\b${escapeRegex(source.city)}\\b`, 'gi'), target.city);
    }
    const lower = text.toLowerCase();
    if (/\d/.test(text) || CLAIMS.test(text) || /@|https?:|www\.|\.com\b/i.test(text)) return null;
    if (leftovers.some((word) => lower.includes(word))) return null;
    return text.replace(/\s+/g, ' ').trim().slice(0, max);
  };
}

export type LearnedParts = { sourceId: string; sourceName: string; reused: number; parts: Record<string, any> };

// Returns the parts that could be safely re-fitted, or null when no AI demo of this trade exists yet.
export async function learnedParts(supabase: any, lead: any, level: string, excludeId: string): Promise<LearnedParts | null> {
  try {
    const { data, error } = await supabase.from('demo_jobs').select('id, content').eq('status', 'ready').order('created_at', { ascending: false }).limit(80);
    if (error || !data) return null;
    const targetName = String(lead.business_name || '').trim();
    const candidates = data.filter((job: any) => job.id !== excludeId && job.content?.generatedBy === 'ai' && !job.content?.learnedFrom && sameTrade(job.content?.category, lead.category) && String(job.content?.businessName || '').toLowerCase() !== targetName.toLowerCase());
    if (!candidates.length || !targetName) return null;
    // The same level reads best; within that, a steady but varied choice so fallback demos do not all copy one source.
    const sameLevel = candidates.filter((job: any) => job.content?.styleLevel === level);
    const pool = sameLevel.length ? sameLevel : candidates;
    let seed = 0;
    for (const letter of excludeId) seed = (seed * 31 + letter.charCodeAt(0)) >>> 0;
    const source = pool[seed % pool.length].content;
    const fit = refitter({ name: String(source.businessName || ''), city: String(source.city || '') }, { name: targetName, city: String(lead.city || ''), category: String(lead.category || '') });
    let reused = 0;
    const text = (value: unknown, max: number) => { const done = fit(value, max); if (done) reused += 1; return done; };
    const block = (item: any, fields: [string, number][]) => {
      const out: Record<string, string> = {};
      fields.forEach(([field, max]) => { const done = text(item?.[field], max); if (done) out[field] = done; });
      return out;
    };
    // A list is only reused whole item by whole item: a title without its body (or the reverse) is dropped.
    const list = (items: any, first: string, second: string) => (Array.isArray(items) ? items : []).map((item: any) => {
      const head = fit(item?.[first], 90);
      const body = fit(item?.[second], 320);
      if (!head || !body) return null;
      reused += 2;
      return { [first]: head, [second]: body };
    }).filter(Boolean);
    const parts = {
      hero: block(source.hero, [['eyebrow', 60], ['title', 120], ['description', 260], ['cta', 30]]),
      about: block(source.about, [['title', 90], ['body', 600]]),
      services: list(source.services, 'title', 'body'),
      highlights: list(source.highlights, 'title', 'body'),
      process: list(source.process, 'title', 'body'),
      faq: list(source.faq, 'question', 'answer'),
      closing: block(source.closing, [['title', 90], ['body', 260], ['cta', 30]]),
    };
    return reused ? { sourceId: String(pool[seed % pool.length].id), sourceName: String(source.businessName || ''), reused, parts } : null;
  } catch {
    return null;
  }
}
