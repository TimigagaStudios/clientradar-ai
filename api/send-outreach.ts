import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { requireOwner } from './lib/auth.js';
import { ensureMailRecoveryReady } from './lib/_mail-recovery.js';
import { qaReviewResponse, reviewOutreachDemos } from './lib/_qa-outreach.js';

const BREVO_API_KEY = process.env.BREVO_API_KEY as string;
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME as string;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL as string;
const BREVO_REPLY_TO_EMAIL = process.env.BREVO_REPLY_TO_EMAIL as string;
const BREVO_REPLY_TO_NAME = process.env.BREVO_REPLY_TO_NAME as string;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fingerprint = /^[a-f0-9]{64}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireOwner(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  if (process.env.API_AUTH_DISABLED === 'true') return res.status(403).json({ success: false, error: 'Sending is unavailable while API authentication is disabled.' });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(503).json({ success: false, error: 'Cannot verify mail recovery. Nothing was sent.' });
  const db = createClient(supabaseUrl, serviceKey);
  try {
    const action = String(req.body?.action || 'send');
    if (action === 'resolve') {
      const key = String(req.body?.fingerprint || '');
      const resolution = String(req.body?.resolution || '');
      if (req.body?.confirm !== true || !fingerprint.test(key) || !['accepted', 'not_sent'].includes(resolution)) return res.status(403).json({ success: false, error: 'Confirm the provider result first.' });
      await ensureMailRecoveryReady(db);
      const { data: attempt, error: readError } = await db.from('cr_direct_mail_attempts').select('state').eq('fingerprint', key).maybeSingle();
      if (readError || !attempt || !['sending', 'unknown'].includes(attempt.state)) return res.status(409).json({ success: false, error: 'This send does not need resolution. Reload and check again.' });
      const { data, error } = await db.rpc('cr_resolve_direct_send', { p_fingerprint: key, p_expected_state: attempt.state, p_resolution: resolution });
      if (error || !data?.state) return res.status(409).json({ success: false, error: 'Could not record the provider result. If still in progress, wait and check Brevo.' });
      return res.status(200).json({ success: true, data });
    }
    if (action !== 'send') return res.status(400).json({ success: false, error: 'Unknown mail action.' });
    if (req.body?.confirm !== true) return res.status(403).json({ success: false, error: 'Sending needs your explicit approval.' });
    const { toEmail, toName, subject, body } = req.body;
    const mailKind = req.body?.mailKind === undefined ? 'intro' : req.body.mailKind;
    if (typeof toEmail !== 'string' || typeof subject !== 'string' || typeof body !== 'string' || !toEmail || !subject || !body || !['intro', 'followup'].includes(mailKind)) {
      return res.status(400).json({ success: false, error: 'An email, subject, message and valid mail kind are required.' });
    }
    if (toEmail.length > 320 || subject.length > 200 || body.length > 10000) return res.status(400).json({ success: false, error: 'Email fields are too long.' });
    let leadId = typeof req.body?.leadId === 'string' ? req.body.leadId : '';
    if (!leadId) {
      // Older clients omitted the lead ID. Use an exact, unique saved email;
      // never guess an identity when no match or more than one match exists.
      const { data: leads, error: leadError } = await db.from('leads').select('id').eq('email', toEmail.trim()).limit(2);
      if (leadError || leads?.length !== 1) return res.status(400).json({ success: false, error: 'Select the saved lead before sending. The address did not identify exactly one lead.' });
      leadId = String(leads[0].id || '');
    }
    if (!uuid.test(leadId)) return res.status(400).json({ success: false, error: 'A valid saved lead is required.' });
    if (!BREVO_API_KEY || !BREVO_SENDER_NAME || !BREVO_SENDER_EMAIL) return res.status(500).json({ success: false, error: 'Missing Brevo environment variables' });
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const origin = host ? `${/^(localhost|127\.)/.test(host) ? 'http' : 'https'}://${host}` : '';
    const review = await reviewOutreachDemos(db, subject, body, origin);
    if (review.required && (req.body?.qaOverride !== true || req.body?.qaToken !== review.token)) return res.status(409).json(qaReviewResponse(review));
    await ensureMailRecoveryReady(db);
    const key = createHash('sha256').update(JSON.stringify({ leadId: leadId.toLowerCase(), toEmail: toEmail.trim().toLowerCase(), subject, body, mailKind })).digest('hex');
    const { data: claim, error: claimError } = await db.rpc('cr_claim_direct_send', { p_fingerprint: key, p_lead_id: leadId, p_recipient: toEmail.trim(), p_subject: subject, p_body: body, p_mail_kind: mailKind, p_demo_proofs: review.proofs });
    if (claimError || !claim) {
      const { data: active } = await db.from('cr_direct_mail_attempts').select('fingerprint,state,recipient,subject').eq('lead_id', leadId).in('state', ['sending', 'unknown']).maybeSingle();
      if (active) return res.status(409).json({ success: false, code: 'DIRECT_SEND_NEEDS_REVIEW', error: 'Another email for this lead needs provider review first.', review: active });
      return res.status(409).json({ success: false, error: 'Another send may be in progress for this lead. Check batches and Brevo before continuing.' });
    }
    if (!claim.claimed) return res.status(409).json({ success: false, code: 'DIRECT_SEND_NEEDS_REVIEW', error: claim.state === 'sent' ? 'This exact email was already recorded as accepted. No new email was sent.' : 'Send status is uncertain. Check Brevo before continuing.', review: claim });
    const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const payload: Record<string, unknown> = {
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
      to: [{ email: toEmail.trim(), name: typeof toName === 'string' ? toName : 'Lead' }],
      subject,
      htmlContent: `<div style="font-family: Arial, sans-serif; color: #111111; line-height: 1.7;">${escapeHtml(body).replace(/\n/g, '<br>')}</div>`,
      textContent: body,
    };
    if (BREVO_REPLY_TO_EMAIL) payload.replyTo = { email: BREVO_REPLY_TO_EMAIL, name: BREVO_REPLY_TO_NAME || BREVO_SENDER_NAME };
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    } catch {
      await db.from('cr_direct_mail_attempts').update({ state: 'unknown', updated_at: new Date().toISOString() }).eq('fingerprint', key).eq('state', 'sending');
      return res.status(409).json({ success: false, code: 'DIRECT_SEND_NEEDS_REVIEW', error: 'Send status is uncertain. Check Brevo before continuing.', review: { fingerprint: key, state: 'unknown' } });
    }
    const { data, error } = await db.rpc('cr_resolve_direct_send', { p_fingerprint: key, p_expected_state: 'sending', p_resolution: 'provider_accepted' });
    if (error || data?.state !== 'sent') return res.status(409).json({ success: false, code: 'DIRECT_SEND_NEEDS_REVIEW', error: 'Brevo accepted the email but the result could not be saved. Check Brevo before retrying.', review: { fingerprint: key, state: 'sending' } });
    return res.status(200).json({ success: true, data: { accepted: true } });
  } catch (error) {
    console.error('send-outreach error:', error);
    return res.status(503).json({ success: false, error: error instanceof Error ? error.message : 'Could not complete the mail request. Check Brevo before retrying.' });
  }
}
