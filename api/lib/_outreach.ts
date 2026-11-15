import { nameKey } from './_duplicates.js';

// Outreach Agent: writes first-contact emails for many leads at once and sends them
// only after the owner has approved the batch. Its tools: read the chosen leads, write drafts,
// send through Brevo, write the outreach log. It cannot build demos, search or delete anything.

export const MAX_OUTREACH = 25;
export type DraftState = 'pending' | 'skipped' | 'sent' | 'failed';
export interface OutreachDraft {
  leadId: string; name: string; email: string; subject: string; body: string; demoUrl: string;
  writtenBy: 'ai' | 'built-in'; state: DraftState; error?: string; sentAt?: string;
}

const clean = (value: unknown, max: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const validEmail = (value: unknown) => /^[^\s@<>,;]+@[^\s@<>,;]+\.[a-z]{2,}$/i.test(String(value || '').trim());
// A lead counts as "not contacted yet" only in these states and with nothing in the outreach log.
const FRESH = new Set(['', 'new', 'demo created', 'demo ready', 'qualified']);

// "Draft outreach for my leads", "email the demos to my top 10 leads", "write emails for everyone with a demo".
export function batchOutreachWish(message: string): { count: number } | null {
  const text = clean(message, 400);
  if (!/\b(outreach|e-?mails?|mails?)\b/i.test(text)) return null;
  if (!/\b(draft|drafts|write|prepare|send|start|create|do|make|e-?mail|mail)\b/i.test(text)) return null;
  if (/\b(how many|status|did you|have you|was|were|inbox|repl(y|ies|ied)|opened)\b/i.test(text) || /\?\s*$/.test(text)) return null;
  if (!/\b(leads?|businesses|clients?|them|all|every|everyone|top|best|strongest|rest|remaining|demos|batch)\b/i.test(text)) return null;
  const number = text.match(/\b(\d{1,3})\b/);
  return { count: number ? Math.max(1, Math.min(MAX_OUTREACH, Number(number[1]))) : MAX_OUTREACH };
}

export interface OutreachPick { leads: any[]; noEmail: number; alreadyContacted: number; waiting: number }

// Leads with a finished demo and an email address that have never been written to. Strongest first,
// one per email address and one per business name.
export async function pickForOutreach(supabase: any, count: number): Promise<OutreachPick> {
  const { data: rows } = await supabase.from('leads').select('id, business_name, category, city, email, website, status, demo_status, demo_link, lead_score, notes').eq('demo_status', 'Ready').order('lead_score', { ascending: false }).limit(400);
  const ready: any[] = (rows || []).filter((lead: any) => lead.demo_link);
  const ids = ready.map((lead) => lead.id);
  const { data: logs } = ids.length ? await supabase.from('outreach_logs').select('lead_id').in('lead_id', ids) : { data: [] };
  const written = new Set((logs || []).map((row: any) => row.lead_id));
  // Drafts already waiting for approval or being sent are not drafted twice.
  const { data: openTasks } = await supabase.from('agent_tasks').select('output').eq('agent_key', 'outreach').in('status', ['waiting_approval', 'running']);
  const inDraft = new Set((openTasks || []).flatMap((task: any) => (Array.isArray(task.output?.drafts) ? task.output.drafts.map((draft: any) => draft.leadId) : [])));
  let noEmail = 0;
  let alreadyContacted = 0;
  const seen = new Set<string>();
  const open = ready.filter((lead) => {
    if (inDraft.has(lead.id)) return false;
    if (written.has(lead.id) || !FRESH.has(String(lead.status || '').toLowerCase())) { alreadyContacted += 1; return false; }
    if (!validEmail(lead.email)) { noEmail += 1; return false; }
    const keys = [String(lead.email).trim().toLowerCase(), `name:${nameKey(lead.business_name)}`];
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
  return { leads: open.slice(0, count), noEmail, alreadyContacted, waiting: Math.max(0, open.length - count) };
}

const senderName = () => clean(process.env.BREVO_SENDER_NAME, 60) || 'Timothy';

function builtInOpening(lead: any) {
  const trade = clean(lead.category, 40).toLowerCase();
  const city = clean(lead.city, 40);
  const among = trade ? `${trade} businesses` : 'local businesses';
  if (!clean(lead.website, 200)) return `I was looking at ${among}${city ? ` in ${city}` : ''} and could not find a website for ${clean(lead.business_name, 80)}.`;
  return `I came across ${clean(lead.business_name, 80)} while looking at ${among}${city ? ` in ${city}` : ''}.`;
}

function compose(lead: any, opening: string, subject: string, demoUrl: string, writtenBy: 'ai' | 'built-in'): OutreachDraft {
  const name = clean(lead.business_name, 80);
  const body = [
    'Hello,',
    opening,
    `I put together a sample website concept for ${name}. You can view it here: ${demoUrl}`,
    'It is only a sample and every part can be changed to fit you. If you like it, reply to this email and I will walk you through it.',
    `${senderName()}\nTimigaga Studios`,
    'If you would rather not hear from me again, reply "no thanks" and I will not write again.',
  ].join('\n\n');
  return { leadId: lead.id, name, email: String(lead.email).trim(), subject, body, demoUrl, writtenBy, state: 'pending' };
}

// An AI line is used only when it is a plain opening: no numbers, prices, links, claims or promises.
const RISKY = /\d|https?:|www\.|@|\b(guarantee|award|best|number one|#1|free|discount|cheap|increase|double|triple|rank|revenue|sales|customers will|certified|licensed|trusted|leading|top-rated)\b/i;
const safeLine = (value: unknown, min: number, max: number) => {
  const text = clean(value, max + 40);
  return text.length >= min && text.length <= max && !RISKY.test(text) ? text : '';
};

// ONE AI call writes a short personal opening and subject for every lead in the batch.
async function aiOpenings(leads: any[]): Promise<{ lines: Map<string, { opening: string; subject: string }>; error: string | null }> {
  const lines = new Map<string, { opening: string; subject: string }>();
  const provider = (process.env.DEMO_AI_PROVIDER || 'fallback').toLowerCase();
  const apiKey = process.env.GEMINI_API_KEY || process.env.DEMO_AI_API_KEY;
  if (provider !== 'gemini' || !apiKey) return { lines, error: 'no AI key set' };
  const model = process.env.MASTER_AI_MODEL || process.env.DEMO_AI_MODEL || 'gemini-3.5-flash-lite';
  const system = [
    'You write the opening of first-contact emails for Timigaga Studios, a web design studio. The email offers a sample website concept that was already built for the business.',
    'For each business write: "subject" (at most 60 characters, plain, names the business, no hype) and "opening" (one or two sentences, at most 220 characters, warm and specific to the type of business and the place).',
    'Use ONLY the facts given. Never invent facts, numbers, prices, results, reviews, awards or promises. No links. No emoji. Do not greet and do not sign off; do not mention the sample website (the next paragraph does).',
    'If "hasWebsite" is false you may say you could not find a website for them; never state as fact that they have none.',
    'Each opening must be worded differently from the others.',
    'Return only JSON: {"emails": [{"id": string, "subject": string, "opening": string}]}',
  ].join('\n');
  const list = leads.map((lead, index) => ({ id: String(index + 1), business: clean(lead.business_name, 80), type: clean(lead.category, 40), place: clean(lead.city, 40), hasWebsite: Boolean(clean(lead.website, 200)) }));
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
      const opening = safeLine(item?.opening, 30, 240);
      if (!lead || !opening) continue;
      lines.set(lead.id, { opening, subject: safeLine(item?.subject, 8, 70) });
    }
    return { lines, error: null };
  } catch (error) {
    return { lines, error: clean(error instanceof Error ? error.message : 'AI call failed', 160) };
  }
}

export async function writeDrafts(leads: any[], origin: string): Promise<{ drafts: OutreachDraft[]; ai: number; aiError: string | null }> {
  const { lines, error } = await aiOpenings(leads);
  const drafts = leads.map((lead) => {
    const link = String(lead.demo_link || '');
    const demoUrl = /^https?:/i.test(link) ? link : `${origin}${link.startsWith('/') ? '' : '/'}${link}`;
    const line = lines.get(lead.id);
    const subject = line?.subject || `A website concept for ${clean(lead.business_name, 80)}`;
    return compose(lead, line?.opening || builtInOpening(lead), subject, demoUrl, line ? 'ai' : 'built-in');
  });
  return { drafts, ai: drafts.filter((draft) => draft.writtenBy === 'ai').length, aiError: lines.size ? null : error };
}

// The owner's edits before approval. Only subject, body and "skip" can change; the address and the lead cannot.
export function applyEdits(drafts: OutreachDraft[], edits: unknown): OutreachDraft[] {
  const byId = new Map<string, any>((Array.isArray(edits) ? edits : []).map((edit: any) => [String(edit?.leadId || ''), edit]));
  return drafts.map((draft) => {
    const edit = byId.get(draft.leadId);
    if (!edit) return draft;
    const subject = String(edit.subject ?? draft.subject).replace(/[\r\n]+/g, ' ').trim().slice(0, 150);
    const body = String(edit.body ?? draft.body).trim().slice(0, 4000);
    return { ...draft, subject: subject || draft.subject, body: body || draft.body, state: edit.skip ? 'skipped' : draft.state };
  });
}

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toHtml = (body: string) => `<div style="font-family: Arial, sans-serif; color: #111111; line-height: 1.7;">${escapeHtml(body).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>')}</div>`;

export const mailReady = () => Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_NAME && process.env.BREVO_SENDER_EMAIL);

export async function sendEmail(draft: OutreachDraft): Promise<void> {
  if (!mailReady()) throw new Error('Email sending is not set up (Brevo settings are missing in Vercel)');
  const payload: Record<string, unknown> = {
    sender: { name: process.env.BREVO_SENDER_NAME, email: process.env.BREVO_SENDER_EMAIL },
    to: [{ email: draft.email, name: draft.name || 'Team' }],
    subject: draft.subject,
    htmlContent: toHtml(draft.body),
    textContent: draft.body,
  };
  if (process.env.BREVO_REPLY_TO_EMAIL) payload.replyTo = { email: process.env.BREVO_REPLY_TO_EMAIL, name: process.env.BREVO_REPLY_TO_NAME || process.env.BREVO_SENDER_NAME };
  const response = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'Content-Type': 'application/json', 'api-key': String(process.env.BREVO_API_KEY) }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    const result: any = await response.json().catch(() => null);
    throw new Error(clean(result?.message || `Brevo refused the email (${response.status})`, 200));
  }
}

// Sends ONE approved draft and records it. A draft that is not "pending" is never sent again.
export async function sendOneDraft(supabase: any, task: any, leadId: string): Promise<{ draft: OutreachDraft; left: number; sent: number; failed: number; finished: boolean }> {
  const drafts: OutreachDraft[] = Array.isArray(task.output?.drafts) ? task.output.drafts : [];
  const index = drafts.findIndex((draft) => draft.leadId === leadId);
  if (index < 0) throw new Error('This lead is not in the approved batch');
  let draft = drafts[index];
  if (draft.state === 'pending') {
    // A last look at the log: if this lead was written to since the draft was made, do not write again.
    const { data: logs } = await supabase.from('outreach_logs').select('id').eq('lead_id', leadId).limit(1);
    if (logs?.length) draft = { ...draft, state: 'skipped', error: 'Already contacted since this draft was written' };
    else {
      try {
        await sendEmail(draft);
        const now = new Date().toISOString();
        draft = { ...draft, state: 'sent', sentAt: now, error: undefined };
        await supabase.from('outreach_logs').insert([{ lead_id: leadId, type: 'intro', subject: draft.subject, body: draft.body, channel: 'email' }]);
        await supabase.from('leads').update({ status: 'Email Sent', demo_status: 'Sent', updated_at: now }).eq('id', leadId);
      } catch (error) {
        draft = { ...draft, state: 'failed', error: clean(error instanceof Error ? error.message : 'Sending failed', 200) };
      }
    }
    drafts[index] = draft;
  }
  const count = (state: DraftState) => drafts.filter((item) => item.state === state).length;
  const left = count('pending');
  const sent = count('sent');
  const failed = count('failed');
  const finished = left === 0;
  const summary = finished ? `Sent ${sent} of ${sent + failed} approved ${sent + failed === 1 ? 'email' : 'emails'}${failed ? `; ${failed} could not be sent` : ''}${count('skipped') ? `; ${count('skipped')} left out` : ''}.` : `Sending: ${sent} sent, ${left} to go.`;
  const now = new Date().toISOString();
  await supabase.from('agent_tasks').update({ output: { ...task.output, drafts, summary }, ...(finished ? { status: sent || !failed ? 'done' : 'failed', error: sent || !failed ? null : 'No email could be sent', completed_at: now } : {}), updated_at: now }).eq('id', task.id);
  return { draft, left, sent, failed, finished };
}

// For the orb: how many leads could be written to right now.
export async function outreachReady(supabase: any) {
  const pick = await pickForOutreach(supabase, MAX_OUTREACH);
  return { ready: pick.leads.length + pick.waiting, noEmail: pick.noEmail };
}
