// Evidence-aware demo screening. Results are private owner review metadata;
// website content and saved lead data are not proof of business facts.
import { createHash } from 'node:crypto';
import { demoQaStatus, screenDemo } from './_demo-qa.js';
import { inspectQaDemo } from './_qa-agent.js';
import { readQaWebsite, type QaSiteEvidence } from './_qa-website.js';
import { recordTask } from './_team.js';

type Row = Record<string, unknown>;
const obj = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const source = (lead: unknown) => {
  const row = obj(lead);
  return { businessName: text(row.business_name), email: text(row.email), phone: text(row.phone), website: text(row.website) };
};
const sourceDigest = (lead: unknown) => createHash('sha256').update(JSON.stringify(source(lead))).digest('hex');
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function checkDemoWithSources(input: unknown, lead: unknown, options: { fixWhitespace?: boolean } = {}): Promise<Row> {
  const website = await readQaWebsite(source(lead).website);
  return screenEvidenceDemo(input, lead, website, options);
}

// Called only after the checked demo was saved. Activity is best effort and
// never contains the lead's website content or the demo's private QA data.
export async function recordDemoCheck(jobId: string, leadId: string | null, checked: unknown): Promise<void> {
  const qa = obj(obj(checked).qa);
  const agent = obj(qa.agent);
  const count = Array.isArray(qa.issues) ? qa.issues.length : 0;
  await recordTask({ agentKey: 'quality-assurance', title: 'Check a demo', status: qa.status === 'checked' ? 'done' : 'failed', summary: qa.status === 'checked' ? `Demo screened; ${count} item(s) for owner review. Website: ${text(agent.websiteStatus) || 'unavailable'}.` : 'Demo screening failed; owner review is needed.', leadId, input: { jobId }, output: { issueCount: count }, requestedBy: 'system' });
}

export function screenEvidenceDemo(input: unknown, lead: unknown, website: QaSiteEvidence, options: { fixWhitespace?: boolean; now?: Date } = {}): Row {
  const checked = screenDemo(input, { fixWhitespace: options.fixWhitespace === true });
  const qa = obj(checked.qa);
  if (qa.status !== 'checked') return checked;
  let expectedHost = '';
  try {
    const url = source(lead).website;
    expectedHost = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase();
  } catch { /* No comparable saved site. */ }
  const siteMatches = website.status === 'available' && Boolean(expectedHost) && website.host === expectedHost;
  const siteStatus = website.status === 'available' && !siteMatches ? 'unavailable' : website.status;
  const evidence = siteMatches ? { emails: website.emails, phones: website.phones } : null;
  const result = inspectQaDemo(checked, source(lead), evidence);
  const current = Array.isArray(qa.issues) ? [...qa.issues] : [];
  for (const finding of result.findings) {
    if (!current.some((issue: any) => issue?.code === finding.code && issue?.path === finding.path)) current.push(finding);
  }
  // The limited contact comparison never verifies the demo's factual claims.
  // Always require an explicit owner review before using it in outreach.
  current.push({ code: 'business_facts_need_review', path: 'review', message: 'Review the demo and confirm business facts before sharing. Automated checks cannot verify all claims.' });
  if (!source(lead).businessName) current.push({ code: 'lead_identity_missing', path: 'businessName', message: 'The saved lead has no business name to compare. Confirm the business identity.' });
  if (siteStatus !== 'available') current.push({ code: 'website_not_checked', path: 'contact.website', message: siteStatus === 'not_provided' ? 'No website was available for this check. Business details still need review.' : 'The saved website could not be checked. Business details still need review.' });
  const timestamp = (options.now || new Date()).toISOString();
  return { ...checked, qa: { ...qa, issues: current, agent: { version: 1, checkedAt: timestamp, sourceFingerprint: sourceDigest(lead), websiteStatus: siteStatus, websiteHost: siteMatches ? website.host : null, websiteCheckedAt: website.checkedAt, limitations: result.limitations } } };
}

// The current lead must be supplied by each owner UI and mail-review caller.
// Legacy reviews without evidence metadata are stale and must be rechecked.
export function evidenceDemoStatus(input: unknown, lead: unknown, now = new Date()): 'unchecked' | 'stale' | 'error' | 'checked' {
  const base = demoQaStatus(input);
  if (base !== 'checked') return base;
  const agent = obj(obj(obj(input).qa).agent);
  if (!lead || typeof lead !== 'object' || Array.isArray(lead) || agent.version !== 1 || agent.sourceFingerprint !== sourceDigest(lead)) return 'stale';
  const at = Date.parse(text(agent.checkedAt));
  const siteAt = Date.parse(text(agent.websiteCheckedAt));
  const current = now.getTime();
  if (!Number.isFinite(current) || !Number.isFinite(at) || !Number.isFinite(siteAt) || at > current || siteAt > current || current - at > MAX_AGE_MS || current - siteAt > MAX_AGE_MS) return 'stale';
  if (!['available', 'unavailable', 'not_provided'].includes(text(agent.websiteStatus))) return 'stale';
  return 'checked';
}
