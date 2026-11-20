// Bounded, deterministic QA building block. It never changes content or sends
// messages. A finding is a prompt for owner review, not a statement of fact.
// A website profile must come from a separately controlled fetch; this helper
// does not contact a website and does not decide whether a URL is trustworthy.

export type QaFinding = { code: string; path: string; message: string };
export type QaSource = {
  businessName?: unknown;
  email?: unknown;
  phone?: unknown;
  website?: unknown;
};
export type QaWebsiteEvidence = { emails?: unknown; phones?: unknown } | null;
export type QaAgentReport = {
  findings: QaFinding[];
  sources: { savedLead: boolean; websiteContacts: boolean };
  limitations: string[];
};

type Dict = Record<string, unknown>;
const object = (v: unknown): Dict => v && typeof v === 'object' && !Array.isArray(v) ? v as Dict : {};
const str = (v: unknown): string => typeof v === 'string' ? v : '';
const normalized = (v: unknown): string => str(v).trim().replace(/\s+/g, ' ').toLowerCase();
const phone = (v: unknown): string => str(v).replace(/\D/g, '');
const strings = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').slice(0, 10) : [];

function listText(value: unknown): { path: string; value: string }[] {
  const result: { path: string; value: string }[] = [];
  const addFields = (prefix: string, item: unknown) => {
    for (const [key, field] of Object.entries(object(item))) {
      if (typeof field === 'string' && field.trim()) result.push({ path: `${prefix}.${key}`, value: field.slice(0, 4000) });
    }
  };
  const demo = object(value);
  for (const key of ['businessName', 'disclaimer']) if (str(demo[key]).trim()) result.push({ path: key, value: str(demo[key]).slice(0, 4000) });
  for (const key of ['hero', 'about', 'closing']) addFields(key, demo[key]);
  for (const key of ['services', 'highlights', 'process', 'faq', 'sections']) {
    if (Array.isArray(demo[key])) (demo[key] as unknown[]).slice(0, 30).forEach((item, i) => addFields(`${key}.${i}`, item));
  }
  const showcase = object(demo.showcase);
  if (str(showcase.title).trim()) result.push({ path: 'showcase.title', value: str(showcase.title).slice(0, 4000) });
  if (Array.isArray(showcase.items)) showcase.items.slice(0, 30).forEach((item, i) => addFields(`showcase.items.${i}`, item));
  return result;
}

const patterns: { code: string; pattern: RegExp; message: string }[] = [
  { code: 'placeholder', pattern: /\b(?:lorem ipsum|your business name|insert (?:text|name|here))\b|\[(?:placeholder|business name|first name|insert[^\]]*)\]/i, message: 'Possible placeholder text. Review and replace it with confirmed wording.' },
  { code: 'guarantee', pattern: /\b(?:guarantee(?:d|s)?|risk[- ]free|100\s*%\s*(?:guaranteed|success))\b/i, message: 'Possible guarantee or absolute promise. Confirm it is approved and accurate.' },
  { code: 'promotion', pattern: /\b(?:discount|\d+\s*%\s*off|free trial|special offer|sale ends|expires?\s+(?:today|tomorrow)|only\s+\d+\s+(?:spots|places)\s+left)\b/i, message: 'Possible offer, deadline or scarcity claim. Confirm it was approved and is accurate.' },
  { code: 'price', pattern: /(?:[$\u00a3\u20ac\u20a6]\s*\d|\b(?:usd|gbp|eur|ngn)\s*\d|\b\d[\d,.]*\s*(?:dollars|pounds|euros|naira)\b)/i, message: 'Possible price or payment amount. Confirm it was approved and is accurate.' },
  { code: 'credentials', pattern: /\b(?:award[- ]winning|licensed|certified|accredited|insured|\d+\s+years? (?:of |in )?(?:experience|business)|five[- ]star|5[- ]star)\b/i, message: 'Possible credential, review or experience claim. Check it against reliable evidence.' },
  { code: 'pressure', pattern: /\b(?:act now|last chance|do not miss out|don't miss out|urgent(?:ly)?|immediately|respond today)\b/i, message: 'Possible pressure or urgency. Review tone and whether the wording is justified.' },
  { code: 'unverified_outcome', pattern: /\b(?:you(?:'re| are) (?:leaving|losing)|missing easy clients|(?:would|will) (?:turn|increase|double|triple|boost)|leaving bookings on the table)\b/i, message: 'Possible unsupported customer or business outcome. Confirm it before use.' },
  { code: 'website_assumption', pattern: /\b(?:do not have a (?:proper )?(?:site|website)|don't have a (?:proper )?(?:site|website)|no strong website|no website at all)\b/i, message: 'Possible assumption about the business website. Confirm it before use.' },
];

function inspectText(items: { path: string; value: string }[], findings: QaFinding[]) {
  for (const item of items.slice(0, 200)) {
    for (const rule of patterns) {
      if (rule.pattern.test(item.value)) findings.push({ code: rule.code, path: item.path, message: rule.message });
    }
  }
}

function contactFindings(actual: unknown, lead: QaSource, website: QaWebsiteEvidence, findings: QaFinding[]) {
  const contact = object(actual);
  const actualEmail = normalized(contact.email);
  const leadEmail = normalized(lead.email);
  const siteEmails = strings(website?.emails).map(normalized);
  if (actualEmail && leadEmail && actualEmail !== leadEmail) findings.push({ code: 'email_differs_from_lead', path: 'contact.email', message: 'Demo email differs from the saved lead email. Confirm the correct address.' });
  if (actualEmail && siteEmails.length && !siteEmails.includes(actualEmail)) findings.push({ code: 'email_not_seen_on_site', path: 'contact.email', message: 'Demo email was not among contacts found on the scanned website pages. This does not prove it is wrong.' });
  const actualPhone = phone(contact.phone);
  const leadPhone = phone(lead.phone);
  const sitePhones = strings(website?.phones).map(phone).filter(Boolean);
  if (actualPhone && leadPhone && actualPhone !== leadPhone) findings.push({ code: 'phone_differs_from_lead', path: 'contact.phone', message: 'Demo phone differs from the saved lead phone. Formatting or country codes may explain the difference; confirm it.' });
  if (actualPhone && sitePhones.length && !sitePhones.includes(actualPhone)) findings.push({ code: 'phone_not_seen_on_site', path: 'contact.phone', message: 'Demo phone was not an exact match for the scanned website contacts. Formatting or country codes may explain this.' });
}

export function inspectQaDemo(input: unknown, lead: QaSource = {}, website: QaWebsiteEvidence = null): QaAgentReport {
  const demo = object(input);
  const findings: QaFinding[] = [];
  if (normalized(lead.businessName) && normalized(demo.businessName) && normalized(lead.businessName) !== normalized(demo.businessName)) {
    findings.push({ code: 'name_differs_from_lead', path: 'businessName', message: 'Demo name differs from the saved lead name. Confirm the correct business.' });
  }
  contactFindings(demo.contact, lead, website, findings);
  inspectText(listText(demo), findings);
  if (object(demo.showcase).sample === true) findings.push({ code: 'sample_showcase', path: 'showcase', message: 'Showcase items are labelled as samples. Confirm or replace them before sharing.' });
  return makeReport(findings, lead, website);
}

export function inspectQaMessage(subject: unknown, body: unknown, lead: QaSource = {}, website: QaWebsiteEvidence = null): QaAgentReport {
  const findings: QaFinding[] = [];
  if (!str(subject).trim()) findings.push({ code: 'missing_subject', path: 'subject', message: 'The message subject is empty.' });
  if (!str(body).trim()) findings.push({ code: 'missing_body', path: 'body', message: 'The message body is empty.' });
  inspectText([{ path: 'subject', value: str(subject).slice(0, 4000) }, { path: 'body', value: str(body).slice(0, 40000) }], findings);
  // Language rules cannot establish that factual assertions are supported.
  findings.push({ code: 'message_facts_need_review', path: 'review', message: 'Review the message and confirm any factual statements before sending. The automated check cannot verify every claim.' });
  return makeReport(findings, lead, website);
}

function makeReport(findings: QaFinding[], lead: QaSource, website: QaWebsiteEvidence): QaAgentReport {
  return {
    findings: findings.slice(0, 100),
    sources: { savedLead: Object.values(lead).some((v) => Boolean(str(v).trim())), websiteContacts: strings(website?.emails).length > 0 || strings(website?.phones).length > 0 },
    limitations: [
      'Automated checks are limited and do not verify all claims, identity, tone, links, visuals, legal compliance or safety.',
      'A saved lead or website may itself be incorrect or outdated. Missing website evidence does not establish that a claim is false.',
      'Review the content and confirm business details before sharing or sending.',
    ],
  };
}
