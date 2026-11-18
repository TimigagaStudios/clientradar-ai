// Preliminary deterministic demo-content screening. Not a visual, factual,
// security, legal, or live-link audit. Do not treat a lack of findings as
// proof that a demo is safe or ready to send.
import { createHash } from 'node:crypto';

export type DemoQaIssue = { code: string; path: string; message: string };
export type DemoQaFix = { path: string; description: string };
export type DemoQaResult = { content: Record<string, unknown>; issues: DemoQaIssue[]; fixes: DemoQaFix[] };

type Data = Record<string, unknown>;
const object = (value: unknown): Data => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

// Only presentation copy is eligible; business identity and contact data are
// deliberately excluded. The caller must obtain the owner's opt-in first.
const trimFields: Record<string, string[]> = {
  hero: ['eyebrow', 'title', 'description', 'cta'],
  about: ['title', 'body'],
  closing: ['title', 'body', 'cta'],
};

export function inspectDemo(input: unknown, options: { fixWhitespace?: boolean } = {}): DemoQaResult {
  const original = object(input);
  const content: Data = { ...original };
  const issues: DemoQaIssue[] = [];
  const fixes: DemoQaFix[] = [];
  const add = (code: string, path: string, message: string) => issues.push({ code, path, message });
  for (const [section, fields] of Object.entries(trimFields)) {
    const value = original[section];
    if (value === null || typeof value !== 'object' || Array.isArray(value)) continue;
    const copy = { ...object(value) };
    for (const field of fields) {
      const val = copy[field];
      if (typeof val !== 'string' || val === val.trim()) continue;
      if (options.fixWhitespace === true) {
        copy[field] = val.trim();
        fixes.push({ path: `${section}.${field}`, description: 'Trimmed surrounding whitespace.' });
      }
    }
    content[section] = copy;
  }
  if (!text(content.businessName)) add('missing_business_name', 'businessName', 'Business name is missing.');
  if (!text(object(content.hero).title)) add('missing_hero', 'hero.title', 'Hero title is missing.');
  if (!text(object(content.about).body)) add('missing_about', 'about.body', 'About text is missing.');
  if (!Array.isArray(content.services) || !content.services.length) add('missing_services', 'services', 'Services are missing.');
  if (!text(content.disclaimer)) add('missing_disclaimer', 'disclaimer', 'Demo disclaimer is missing.');
  const contact = object(content.contact);
  const email = text(contact.email);
  const phone = text(contact.phone);
  if (!email && !phone) add('missing_contact', 'contact', 'No email or phone contact is present.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) add('invalid_email', 'contact.email', 'Email format may be invalid.');
  if (phone && (phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15)) add('invalid_phone', 'contact.phone', 'Phone format may be invalid.');
  if (email && /(^|@)(example\.(com|org|net)|test\.com)$|^(test|yourname)@/i.test(email)) add('placeholder_email', 'contact.email', 'Email may be a placeholder.');
  if (phone && (/^(\d)\1{6,}$/.test(phone.replace(/\D/g, '')) || /1234567/.test(phone.replace(/\D/g, '')))) add('placeholder_phone', 'contact.phone', 'Phone may be a placeholder.');
  const checked: { path: string; value: unknown }[] = [];
  for (const section of ['hero', 'about', 'closing']) {
    for (const [key, value] of Object.entries(object(content[section]))) checked.push({ path: `${section}.${key}`, value });
  }
  for (const section of ['services', 'highlights', 'process', 'faq', 'sections']) {
    if (!Array.isArray(content[section])) continue;
    (content[section] as unknown[]).forEach((item, index) => {
      for (const [key, value] of Object.entries(object(item))) checked.push({ path: `${section}.${index}.${key}`, value });
    });
  }
  checked.push({ path: 'businessName', value: content.businessName });
  for (const item of checked) {
    const value = text(item.value);
    if (!value) continue;
    if (/\b(lorem ipsum|your business name|insert (text|name|here))\b|\[placeholder\]/i.test(value)) add('possible_placeholder', item.path, 'Text may contain placeholder wording.');
    if (/\b(guaranteed|guarantee|\d+\s*%\s*off|expires?\s+(today|tomorrow)|only\s+\d+\s+(spots|places)\s+left)\b/i.test(value)) add('possible_claim', item.path, 'Check this possible promotional claim against approved facts.');
  }
  return { content, issues, fixes };
}

const QA_VERSION = 1;

// JSONB does not preserve object key order. Sort keys recursively so the
// fingerprint survives a round trip through the database. View statistics
// and the review itself are not part of the customer-facing demo.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Data).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

export function demoFingerprint(input: unknown): string {
  const { qa: _qa, stats: _stats, ...demo } = object(input);
  return createHash('sha256').update(JSON.stringify(canonical(demo))).digest('hex');
}

// Fixes are limited to the whitespace allowlist above. The caller supplies
// this opt-in only from an authenticated request on the owner's device.
export function screenDemo(input: unknown, options: { fixWhitespace?: boolean } = {}): Data {
  const original = object(input);
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Demo content is missing or invalid');
    const result = inspectDemo(original, options);
    return { ...result.content, qa: { version: QA_VERSION, status: 'checked', checkedAt: new Date().toISOString(), fingerprint: demoFingerprint(result.content), issues: result.issues, fixes: result.fixes } };
  } catch {
    return { ...original, qa: { version: QA_VERSION, status: 'error', checkedAt: new Date().toISOString(), issues: [], fixes: [] } };
  }
}

export function demoQaStatus(input: unknown): 'unchecked' | 'stale' | 'error' | 'checked' {
  const qa = object(object(input).qa);
  if (!Object.keys(qa).length) return 'unchecked';
  if (qa.version !== QA_VERSION) return 'stale';
  if (qa.status === 'error') return 'error';
  if (qa.status !== 'checked' || typeof qa.fingerprint !== 'string' || qa.fingerprint !== demoFingerprint(input) || !Array.isArray(qa.issues) || !Array.isArray(qa.fixes)) return 'stale';
  return 'checked';
}

// Apply only owner-supplied text to a narrowly allowed field. The caller must
// require explicit approval and compare-and-swap the content in the database.
export function applyOwnerCorrection(input: unknown, path: string, value: string): Data {
  const allowed = /^(businessName|disclaimer|contact\.(email|phone)|hero\.(eyebrow|title|description|cta)|about\.(title|body)|closing\.(title|body|cta)|(?:services|highlights|process|faq|sections)\.\d+\.(?:title|body|question|answer))$/;
  if (!allowed.test(path) || typeof value !== 'string' || value.length > 4000) throw new Error('This field cannot be corrected here.');
  const content = JSON.parse(JSON.stringify(object(input))) as Data;
  const parts = path.split('.');
  if (parts.length === 2 && ['contact', 'hero', 'about', 'closing'].includes(parts[0]) && content[parts[0]] == null) content[parts[0]] = {};
  let cursor: any = content;
  for (const part of parts.slice(0, -1)) {
    if (!cursor || typeof cursor !== 'object' || !(part in cursor)) throw new Error('The selected field is not available.');
    cursor = cursor[part];
  }
  const key = parts[parts.length - 1];
  if (!cursor || typeof cursor !== 'object' || (cursor[key] != null && typeof cursor[key] !== 'string')) throw new Error('The selected field is not text.');
  cursor[key] = value;
  return content;
}
