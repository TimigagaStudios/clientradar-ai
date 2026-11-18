import { nameKey } from './_duplicates.js';
import { aiConfig, aiUnavailableReason } from './_ai-config.js';
import { applyEdits, mailReady, retryFailed, sendEmail, recordAcceptedBatchSend, type OutreachDraft } from './_outreach.js';

// Follow-up Agent (part of Outreach): a polite second email to leads that were written to a few
// days ago and have not replied. Like first-contact outreach, drafts are written in one batch and
// nothing is sent until the owner approves the batch once. Its tools: read the contacted leads,
// write drafts, send through Brevo, write the outreach log. It never writes to a lead twice.

export const MAX_FOLLOWUP = 25;
const FOLLOW_UP_DAYS = 3;

const clean = (value: unknown, max: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const validEmail = (value: unknown) => /^[^\s@<>,;]+@[^\s@<>,;]+\.[a-z]{2,}$/i.test(String(value || '').trim());

// "Follow up with the leads that did not reply", "chase the ones that have not answered".
export function followUpWish(message: string): { count: number } | null {
  const text = clean(message, 400);
  if (!/\b(follow[\s-]?up|chase|nudge|remind|second (email|message)|check[\s-]?in|bump)\b/i.test(text)) return null;
  if (!/\b(leads?|businesses|clients?|them|all|every|everyone|ones?|people|demos|batch|reply|replied|answered|no reply|not replied|silent|quiet)\b/i.test(text)) return null;
  if (/\b(how many|status|did you|have you|was|were|inbox|opened)\b/i.test(text) || /\?\s*$/.test(text)) return null;
  const number = text.match(/\b(\d{1,3})\b/);
  return { count: number ? Math.max(1, Math.min(MAX_FOLLOWUP, Number(number[1]))) : MAX_FOLLOWUP };
}

export interface FollowUpPick { leads: any[]; waiting: number }

// Leads written to at least FOLLOW_UP_DAYS ago that have not replied and have not been followed up yet.
// One per email address and one per business name.
export async function pickForFollowUp(supabase: any, count: number): Promise<FollowUpPick> {
  const { data: rows } = await supabase.from('leads').select('id, business_name, category, city, email, website, status, demo_status, demo_link, lead_score').in('status', ['Email Sent', 'Pending Reply']).order('lead_score', { ascending: false }).limit(400);
  const candidates = (rows || []).filter((lead: any) => validEmail(lead.email) && lead.demo_link);
  if (!candidates.length) return { leads: [], waiting: 0 };
  const ids = candidates.map((lead) => lead.id);
  const { data: logs } = await supabase.from('outreach_logs').select('lead_id, type, sent_at').in('lead_id', ids).order('sent_at', { ascending: false });
  const { data: replies } = await supabase.from('outreach_replies').select('lead_id').in('lead_id', ids);
  const replied = new Set((replies || []).map((row: any) => row.lead_id));
  const byLead = new Map<string, any[]>();
  for (const log of logs || []) {
    const list = byLead.get(log.lead_id) || [];
    list.push(log);
    byLead.set(log.lead_id, list);
  }
  const cutoff = Date.now() - FOLLOW_UP_DAYS * 24 * 3600 * 1000;
  const seen = new Set<string>();
  const open = candidates.filter((lead) => {
    if (replied.has(lead.id)) return false;
    const list = byLead.get(lead.id) || [];
    const intro = list.find((log) => log.type === 'intro');
    if (!intro) return false;
    if (new Date(intro.sent_at).getTime() > cutoff) return false;
    if (list.some((log) => log.type === 'follow_up' || log.type === 'followup')) return false;
    const keys = [String(lead.email).trim().toLowerCase(), `name:${nameKey(lead.business_name)}`];
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
  return { leads: open.slice(0, count), waiting: Math.max(0, open.length - count) };
}

const senderName = () => clean(process.env.BREVO_SENDER_NAME, 60) || 'Timothy';

function builtInFollowUp(lead: any) {
  const name = clean(lead.business_name, 80);
  return `I am just following up on my email from a few days ago about a sample website for ${name}.`;
}

function composeFollowUp(lead: any, opening: string, subject: string, demoUrl: string, writtenBy: 'ai' | 'built-in'): OutreachDraft {
  const name = clean(lead.business_name, 80);
  const body = [
    'Hello,',
    opening,
    `The sample website I put together for ${name} is still here if you would like to look: ${demoUrl}`,
    'It is only a sample and every part can be changed to fit you. If it is not for you, reply "no thanks" and I will not write again.',
    `${senderName()}\nTimigaga Studios`,
  ].join('\n\n');
  return { leadId: lead.id, name, email: String(lead.email).trim(), subject, body, demoUrl, writtenBy, state: 'pending' };
}

// An AI line is used only when it is a plain nudge: no numbers, prices, links, claims or promises.
const RISKY = /\d|https?:|www\.|@|\b(guarantee|award|best|number one|#1|free|discount|cheap|increase|double|triple|rank|revenue|sales|customers will|certified|licensed|trusted|leading|top-rated)\b/i;
const safeLine = (value: unknown, min: number, max: number) => {
  const text = clean(value, max + 40);
  return text.length >= min && text.length <= max && !RISKY.test(text) ? text : '';
};

// ONE AI call writes a short follow-up opening and subject for every lead in the batch.
async function aiNudges(leads: any[]): Promise<{ lines: Map<string, { opening: string; subject: string }>; error: string | null }> {
  const lines = new Map<string, { opening: string; subject: string }>();
  const { provider, apiKey } = aiConfig();
  const unavailable = aiUnavailableReason(provider, apiKey);
  if (unavailable) return { lines, error: unavailable };
  const model = process.env.MASTER_AI_MODEL || process.env.DEMO_AI_MODEL || 'gemini-3.5-flash-lite';
  const system = [
    'You write short follow-up emails for Timigaga Studios, a web design studio. A first email offering a sample website concept was sent a few days ago and the business has not replied.',
    'For each business write: "subject" (at most 60 characters, plain, a gentle follow-up, no hype) and "opening" (one sentence, at most 180 characters, warm and polite, says this is a follow-up).',
    'Use ONLY the facts given. Never invent facts, numbers, prices, results, reviews, awards or promises. No links. No emoji. Do not greet and do not sign off; do not mention the sample website (the next paragraph does).',
    'Each opening must be worded differently from the others.',
    'Return only JSON: {"emails": [{"id": string, "subject": string, "opening": string}]}',
  ].join('\n');
  const list = leads.map((lead, index) => ({ id: String(index + 1), business: clean(lead.business_name, 80), type: clean(lead.category, 40), place: clean(lead.city, 40) }));
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify(list) }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7 } }),
    });
    const result: any = await response.json().catch(() => null);
    if (!response.ok) return { lines, error: clean(result?.error?.message || `AI error ${response.status}`, 160) };
    const parsed = JSON.parse(String(result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'));
    for (const item of Array.isArray(parsed?.emails) ? parsed.emails : []) {
      const lead = leads[Number(item?.id) - 1];
      const opening = safeLine(item?.opening, 20, 200);
      if (!lead || !opening) continue;
      lines.set(lead.id, { opening, subject: safeLine(item?.subject, 8, 70) });
    }
    return { lines, error: null };
  } catch (error) {
    return { lines, error: clean(error instanceof Error ? error.message : 'AI call failed', 160) };
  }
}

export async function writeFollowUps(leads: any[], origin: string): Promise<{ drafts: OutreachDraft[]; ai: number; aiError: string | null }> {
  const { lines, error } = await aiNudges(leads);
  const drafts = leads.map((lead) => {
    const link = String(lead.demo_link || '');
    const demoUrl = /^https?:/i.test(link) ? link : `${origin}${link.startsWith('/') ? '' : '/'}${link}`;
    const line = lines.get(lead.id);
    const subject = line?.subject || `Just checking in - ${clean(lead.business_name, 60)}`;
    return composeFollowUp(lead, line?.opening || builtInFollowUp(lead), subject, demoUrl, line ? 'ai' : 'built-in');
  });
  return { drafts, ai: drafts.filter((draft) => draft.writtenBy === 'ai').length, aiError: lines.size ? null : error };
}

// Sends ONE approved follow-up and records it. A lead already followed up is never written to again.
export async function sendOneFollowUp(supabase: any, task: any, leadId: string): Promise<{ draft: OutreachDraft; left: number; sent: number; failed: number; finished: boolean }> {
  const expectedOutput = JSON.stringify(task.output);
  const drafts: OutreachDraft[] = Array.isArray(task.output?.drafts) ? task.output.drafts : [];
  const index = drafts.findIndex((draft) => draft.leadId === leadId);
  if (index < 0) throw new Error('This lead is not in the approved batch');
  let draft = drafts[index];
  if (draft.state === 'sending') {
    const { data: logs, error: logError } = await supabase.from('outreach_logs').select('id').eq('lead_id', leadId).in('type', ['follow_up', 'followup']).limit(1);
    if (logError) throw new Error('Could not check follow-up history. No email was sent.');
    if (logs?.length) return await recordAcceptedBatchSend(supabase, task, leadId, 'skipped');
    else {
      try {
        await sendEmail(draft);
      } catch (error) {
        draft = { ...draft, state: 'unknown', error: `Send status uncertain. Check Brevo before retrying. ${clean(error instanceof Error ? error.message : 'Send failed', 120)}` };
      }
      if (draft.state === 'sending') return await recordAcceptedBatchSend(supabase, task, leadId);
    }
    drafts[index] = draft;
  }
  const count = (state: OutreachDraft['state']) => drafts.filter((item) => item.state === state).length;
  const left = count('pending');
  const sent = count('sent');
  const failed = count('failed');
  const uncertain = count('unknown') + count('sending');
  const finished = left === 0 && uncertain === 0;
  const summary = uncertain ? `${uncertain} send result(s) need provider verification.` : finished ? `Sent ${sent} of ${sent + failed} approved follow-up ${sent + failed === 1 ? 'email' : 'emails'}${failed ? `; ${failed} could not be sent` : ''}${count('skipped') ? `; ${count('skipped')} left out` : ''}.` : `Sending: ${sent} sent, ${left} to go.`;
  const now = new Date().toISOString();
  const { data: saved, error: saveError } = await supabase.from('agent_tasks').update({ output: { ...task.output, drafts, summary }, ...(finished ? { status: sent || !failed ? 'done' : 'failed', error: sent || !failed ? null : 'No email could be sent', completed_at: now } : {}), updated_at: now }).eq('id', task.id).eq('status', 'running').eq('output', expectedOutput).select('id');
  if (saveError || !saved?.length) throw new Error('Send result could not be recorded. Verify the email in Brevo before retrying.');
  return { draft, left, sent, failed, finished };
}

export { applyEdits, mailReady, retryFailed };

// For the orb: how many leads could be followed up right now.
export async function followUpReady(supabase: any) {
  const pick = await pickForFollowUp(supabase, MAX_FOLLOWUP);
  return { ready: pick.leads.length + pick.waiting };
}
