import { createHash } from 'node:crypto';
import { demoFingerprint } from './_demo-qa.js';
import { evidenceDemoStatus } from './_qa-demo-agent.js';
import { inspectQaMessage, type QaFinding } from './_qa-agent.js';
import { recordTask } from './_team.js';
import { readQaWebsite } from './_qa-website.js';

type Finding = { demoId: string; state: string; issues: string[] };
type DemoProof = { id: string; exists: boolean; status?: string; content?: unknown };
export type OutreachQaReview = { required: boolean; token: string; demos: Finding[]; messageFindings: QaFinding[]; websiteStatus: string; proofs: DemoProof[] };
export class QaReviewNeeded extends Error {
  constructor(public review: OutreachQaReview) { super('Review the quality findings before sending.'); }
}

// Only links to ClientRadar's known preview route can be assessed. A link to an
// unrelated external website is not represented as having been checked.
export async function reviewOutreachDemos(supabase: any, subject: string, body: string, appOrigin = '', scope: { leadId: string; recipient: string; kind: string } = { leadId: '', recipient: '', kind: '' }): Promise<OutreachQaReview> {
  const message = `${subject}\n${body}`;
  const matches = [...message.matchAll(/\/demos\/preview\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?=$|[^0-9a-f-])/gi)];
  const ids = [...new Set(matches.map((match) => match[1].toLowerCase()))].sort();
  // Avoid silently ignoring malformed preview paths.
  const previewCount = (message.match(/\/demos\/preview\//gi) || []).length;
  const malformed = previewCount > matches.length;
  const demos: Finding[] = [];
  const proofs: DemoProof[] = [];
  const digestItems: unknown[] = [];
  // A preview-looking path on another host is not this application's demo.
  // Missing or invalid origin information also fails closed to owner review.
  const links = [...message.matchAll(/https?:\/\/[^\s<>"']+/gi)].map((match) => match[0]);
  // Decode URL escapes conservatively for detection only. Encoded preview
  // paths need owner review rather than being treated as verified local URLs.
  let decoded = message;
  for (let pass = 0; pass < 2; pass += 1) decoded = decoded.replace(/%([0-9a-f]{2})/gi, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  let unverifiedLink = decoded !== message && /\/demos\/preview\//i.test(decoded);
  for (const link of links) {
    if (!/\/demos\/preview\//i.test(link)) continue;
    try { if (!appOrigin || new URL(link).origin !== new URL(appOrigin).origin) unverifiedLink = true; }
    catch { unverifiedLink = true; }
  }
  if (unverifiedLink) {
    demos.push({ demoId: 'unknown', state: 'unchecked', issues: ['A preview-looking link is on an unverified origin or has an encoded path.'] });
    digestItems.push({ id: 'unverified-origin', state: 'unchecked' });
  }
  if (malformed) {
    demos.push({ demoId: 'unknown', state: 'unchecked', issues: ['A demo link could not be identified.'] });
    digestItems.push({ id: 'unknown', state: 'unchecked' });
  }
  for (const id of ids) {
    const { data: job, error } = await supabase.from('demo_jobs').select('id,lead_id,status,content,leads(business_name,email,phone,website)').eq('id', id).maybeSingle();
    if (error) throw new Error('Could not check demo review status. No email was sent.');
    proofs.push(job ? { id, exists: true, status: job.status, content: job.content } : { id, exists: false });
    const state = job?.status === 'ready' ? evidenceDemoStatus(job.content, job.leads) : 'unchecked';
    const qa = job?.content?.qa;
    const issues = Array.isArray(qa?.issues) ? qa.issues.slice(0, 100).map((issue: any) => `${String(issue?.message || 'Review issue').slice(0, 200)} (${String(issue?.path || '').slice(0, 100)})`) : [];
    if (job && scope.leadId && String(job.lead_id || '').toLowerCase() !== scope.leadId.toLowerCase()) issues.push('This demo is linked to a different lead. Confirm the recipient and demo.');
    const needsReview = state !== 'checked' || issues.length > 0;
    if (needsReview) demos.push({ demoId: id, state, issues });
    const lead = job?.leads;
    const leadSnapshot = lead ? { business_name: lead.business_name, email: lead.email, phone: lead.phone, website: lead.website } : null;
    digestItems.push({ id, leadId: job?.lead_id || null, leadSnapshot, state, fingerprint: job?.content ? demoFingerprint(job.content) : '', qa: qa || null, status: job?.status || 'missing' });
  }
  // Deterministic message screening is separate from demo screening. Bind the
  // findings and their version to the exact subject and body; old overrides
  // cannot approve edited text or silently survive a rules update.
  const messageFindings = inspectQaMessage(subject, body).findings;
  let savedLead: { business_name: unknown; email: unknown; phone: unknown; website: unknown } | null = null;
  let siteSnapshot: { status: string; host: string | null; emails: string[]; phones: string[] } | null = null;
  if (scope.leadId) {
    const { data: lead, error } = await supabase.from('leads').select('business_name,email,phone,website').eq('id', scope.leadId).maybeSingle();
    if (error) throw new Error('Could not check the saved lead. No email was sent.');
    if (lead) {
      savedLead = { business_name: lead.business_name, email: lead.email, phone: lead.phone, website: lead.website };
      const email = typeof lead.email === 'string' ? lead.email.trim().toLowerCase() : '';
      if (email && email !== scope.recipient.trim().toLowerCase()) messageFindings.push({ code: 'recipient_differs_from_lead', path: 'recipient', message: 'Recipient differs from the saved lead email. This can be legitimate; confirm the correct address before sending.' });
      const site = await readQaWebsite(lead.website);
      // The timestamp is excluded: a repeated read of unchanged contacts must
      // give the owner the same token. Site changes and unavailable reads fail
      // closed to a new review. The site itself may be incomplete or incorrect.
      siteSnapshot = { status: site.status, host: site.host, emails: [...site.emails].map((value) => value.toLowerCase()).sort(), phones: [...site.phones].map((value) => value.replace(/\D/g, '')).sort() };
      if (site.status !== 'available') messageFindings.push({ code: 'message_website_not_checked', path: 'review', message: site.status === 'not_provided' ? 'No saved website was available to compare business contacts. Confirm business facts.' : 'The saved website could not be checked. Confirm business facts.' });
      const messageEmails = [...new Set((message.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).map((value) => value.toLowerCase()))].slice(0, 20);
      const knownEmails = [email, ...siteSnapshot.emails].filter(Boolean);
      if (knownEmails.length && messageEmails.some((value) => !knownEmails.includes(value))) messageFindings.push({ code: 'message_email_not_in_sources', path: 'body', message: 'An email in the message differs from saved or website contacts. It may be your own; confirm it is correct.' });
      const messagePhones = [...new Set((message.match(/(?:\+?\d[\d ()-]{5,}\d)/g) || []).map((value) => value.replace(/\D/g, '')).filter((value) => value.length >= 7 && value.length <= 15))].slice(0, 20);
      const savedPhone = typeof lead.phone === 'string' ? lead.phone.replace(/\D/g, '') : '';
      const knownPhones = [savedPhone, ...siteSnapshot.phones].filter(Boolean);
      if (knownPhones.length && messagePhones.some((value) => !knownPhones.includes(value))) messageFindings.push({ code: 'message_phone_not_in_sources', path: 'body', message: 'A possible phone in the message differs from saved or website contacts. It may be yours or formatted differently; confirm it.' });
    } else messageFindings.push({ code: 'lead_not_found', path: 'recipient', message: 'The saved lead could not be found. Confirm the recipient and business before sending.' });
  } else messageFindings.push({ code: 'message_lead_unavailable', path: 'review', message: 'No saved lead was linked to this message. Business details and website could not be compared.' });
  const token = createHash('sha256').update(JSON.stringify({ version: 4, scope, savedLead, siteSnapshot, subject, body, digestItems, messageFindings })).digest('hex');
  const websiteStatus = siteSnapshot?.status || 'not_checked';
  if (scope.leadId) await recordTask({ agentKey: 'quality-assurance', title: 'Check a message', status: 'done', summary: `Message screened; ${messageFindings.length} possible message issue(s), ${demos.length} demo review(s). Website: ${websiteStatus}. No email sent by this check.`, leadId: scope.leadId, output: { issueCount: messageFindings.length, demoReviews: demos.length, websiteStatus }, requestedBy: 'system' });
  return { required: demos.length > 0 || messageFindings.length > 0, token, demos, messageFindings, websiteStatus, proofs };
}

// Bind an approved batch to its actual recipient and message text. Draft state
// may change while sending, so it is deliberately excluded from the digest.
export function batchApprovalDigest(drafts: any[]): string {
  const items = drafts.map((draft) => ({ leadId: String(draft?.leadId || ''), email: String(draft?.email || ''), subject: String(draft?.subject || ''), body: String(draft?.body || '') }));
  return createHash('sha256').update(JSON.stringify(items)).digest('hex');
}

export function qaReviewResponse(review: OutreachQaReview) {
  return { success: false, code: 'QA_REVIEW_REQUIRED', error: 'Review the quality findings before sending.', review: { required: review.required, token: review.token, demos: review.demos, messageFindings: review.messageFindings, websiteStatus: review.websiteStatus } };
}
