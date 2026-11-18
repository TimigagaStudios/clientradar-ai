import { createHash } from 'node:crypto';
import { demoFingerprint, demoQaStatus } from './_demo-qa.js';

type Finding = { demoId: string; state: string; issues: string[] };
type DemoProof = { id: string; exists: boolean; status?: string; content?: unknown };
export type OutreachQaReview = { required: boolean; token: string; demos: Finding[]; proofs: DemoProof[] };
export class QaReviewNeeded extends Error {
  constructor(public review: OutreachQaReview) { super('Review the demo quality findings before sending.'); }
}

// Only links to ClientRadar's known preview route can be assessed. A link to an
// unrelated external website is not represented as having been checked.
export async function reviewOutreachDemos(supabase: any, subject: string, body: string, appOrigin = ''): Promise<OutreachQaReview> {
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
    const { data: job, error } = await supabase.from('demo_jobs').select('id,status,content').eq('id', id).maybeSingle();
    if (error) throw new Error('Could not check demo review status. No email was sent.');
    proofs.push(job ? { id, exists: true, status: job.status, content: job.content } : { id, exists: false });
    const state = job?.status === 'ready' ? demoQaStatus(job.content) : 'unchecked';
    const qa = job?.content?.qa;
    const issues = Array.isArray(qa?.issues) ? qa.issues.slice(0, 100).map((issue: any) => `${String(issue?.message || 'Review issue').slice(0, 200)} (${String(issue?.path || '').slice(0, 100)})`) : [];
    const needsReview = state !== 'checked' || issues.length > 0;
    if (needsReview) demos.push({ demoId: id, state, issues });
    digestItems.push({ id, state, fingerprint: job?.content ? demoFingerprint(job.content) : '', qa: qa || null, status: job?.status || 'missing' });
  }
  const token = createHash('sha256').update(JSON.stringify({ subject, body, digestItems })).digest('hex');
  return { required: demos.length > 0, token, demos, proofs };
}

// Bind an approved batch to its actual recipient and message text. Draft state
// may change while sending, so it is deliberately excluded from the digest.
export function batchApprovalDigest(drafts: any[]): string {
  const items = drafts.map((draft) => ({ leadId: String(draft?.leadId || ''), email: String(draft?.email || ''), subject: String(draft?.subject || ''), body: String(draft?.body || '') }));
  return createHash('sha256').update(JSON.stringify(items)).digest('hex');
}

export function qaReviewResponse(review: OutreachQaReview) {
  return { success: false, code: 'QA_REVIEW_REQUIRED', error: 'Review the demo quality findings before sending.', review: { required: review.required, token: review.token, demos: review.demos } };
}
