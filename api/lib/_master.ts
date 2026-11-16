// Master Agent: understands the owner's request, answers from real records and decides which
// specialist gets which task. It never does a specialist's work itself and has no tools of its
// own except "hand a task over". The specialists run separately (see _agents.ts).
// Optional setting (name only): MASTER_AI_MODEL. Uses the same server key as the Demo Factory.
import { aiConfig, aiUnavailableReason } from './_ai-config.js';

export interface PlannedTask {
  agent: 'lead-research' | 'demo-creation' | 'outreach';
  category?: string;
  city?: string;
  leadName?: string;
  level?: 'mid' | 'hybrid' | 'ultra';
  kind?: 'first' | 'followup';
  count?: number;
}

export interface MasterPlan {
  reply: string;
  tasks: PlannedTask[];
  source: 'ai' | 'rules';
  aiError: string | null;
}

export interface MasterContext {
  totals: Record<string, number>;
  leadNames: string[];
  recentActivity: string[];
}

const MAX_TASKS = 3;
const clean = (value: unknown, max: number) => String(value ?? '').replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function levelFrom(text: string): 'mid' | 'hybrid' | 'ultra' {
  if (/ultra|premium/i.test(text)) return 'ultra';
  if (/hybrid/i.test(text)) return 'hybrid';
  return 'mid';
}

export function statusLine(context: MasterContext) {
  const t = context.totals;
  const emailLine = Number.isFinite(t.withEmail) && Number.isFinite(t.withoutEmail)
    ? ` ${t.withEmail} have an email address, ${t.withoutEmail} do not; ${t.readyNoEmail || 0} ready demos are missing one.`
    : '';
  return `You have ${t.leads || 0} leads: ${t.new || 0} new, ${t.pendingReply || 0} awaiting reply, ${t.warm || 0} warm and ${t.closed || 0} closed. ${t.demosReady || 0} demos are ready.${emailLine}`;
}

// "Build demos for my top 20 leads without a website": a request for MANY demos at once.
// A single named demo ("build a demo for Pegasus Dental") is not a batch.
export const MAX_BATCH = 25;
export function batchDemoWish(message: string): { count: number; noWebsite: boolean; level: 'mid' | 'hybrid' | 'ultra' } | null {
  const text = clean(message, 400);
  if (!/\bdemos?\b/i.test(text)) return null;
  const many = /\bdemos\b/i.test(text) || /\b(each|every|all|top|best|strongest)\b/i.test(text);
  const aboutLeads = /\b(leads?|businesses|them|all|every|top|best|strongest|rest|remaining)\b/i.test(text);
  if (!many || !aboutLeads || /\b(ready|preview|show|open|delete|how many|status)\b/i.test(text)) return null;
  const number = text.match(/\b(\d{1,3})\b/);
  const count = number ? Math.max(1, Math.min(MAX_BATCH, Number(number[1]))) : /\b(all|every|rest|remaining)\b/i.test(text) ? MAX_BATCH : 10;
  return { count, noWebsite: Boolean(searchWishes(text).noWebsite), level: levelFrom(text) };
}

// Read straight from the owner's own words (not from the AI): how many businesses, and whether only
// those without a website are wanted. "Find 100 real estate companies in Los Angeles without websites".
export function searchWishes(message: string): { count?: number; noWebsite?: boolean } {
  const text = clean(message, 400);
  const number = text.match(/\b(\d{1,4})\b(?!\s*(?:km|miles?|stars?|%))/);
  const count = number ? Math.max(1, Math.min(100, Number(number[1]))) : undefined;
  const noWebsite = /\b(?:without|with no|no|lacking|don'?t have|do not have|has no|have no|missing)\b[^.]{0,30}\b(?:web ?sites?|sites?)\b/i.test(text);
  return { ...(count ? { count } : {}), ...(noWebsite ? { noWebsite: true } : {}) };
}

// Removes the number and the "without a website" wording so only the business type and the place remain.
export const tidyCategory = (value: string) => clean(value.replace(/^\s*(?:about|around|up to|at least)?\s*\d{1,4}\s+/i, '').replace(/\s+(?:that|which|who)\b.*$/i, '').replace(/\s+(?:without|with no|with)\b.*$/i, ''), 60);
export const tidyCity = (value: string) => clean(value.replace(/[,;]?\s+(?:without|with no|with|that|which|who|and)\b.*$/i, ''), 60);

const asksUpkeepInbox = (text: string) => /\b(?:records?\s+upkeep|upkeep agent)\b/i.test(text) && /\b(?:email|contact|gmail|inbox|website|site|scan)\b/i.test(text);
const upkeepInboxAnswer = 'Records Upkeep reads public websites already attached to saved leads and fills missing email, phone or Instagram; it does not open Gmail. Gmail link scanning is a separate, opt-in feature and only runs after the updated app is deployed and the Google Apps Script helper is installed and authorized. It checks up to 10 recent inbox emails, sends link metadata but not the email body, and leaves translated/extracted results for your review—nothing is saved as a lead automatically.';

// Used when no AI key is set or the AI call fails. Handles factual count questions without AI.
export function planByRules(message: string, context: MasterContext): Omit<MasterPlan, 'source' | 'aiError'> {
  const text = clean(message, 400);
  if (asksUpkeepInbox(text)) return { reply: upkeepInboxAnswer, tasks: [] };
  if (/\b(?:how many|count|number of|total)\b/i.test(text) && /\b(?:leads?|business(?:es)?)\b/i.test(text) && /\bemail(?:s| address(?:es)?)?\b/i.test(text)) {
    const totals = context.totals;
    if (Number.isFinite(totals.withEmail) && Number.isFinite(totals.withoutEmail)) {
      return { reply: `I found ${totals.withEmail} ${totals.withEmail === 1 ? 'lead' : 'leads'} with an email address and ${totals.withoutEmail} without one. ${totals.readyNoEmail || 0} ready ${totals.readyNoEmail === 1 ? 'demo is' : 'demos are'} missing an email.`, tasks: [] };
    }
  }
  const demo = text.match(/\bdemo\b.*?\bfor\s+(.+?)[.?!]*$/i);
  if (demo) {
    return { reply: `I will ask the Demo Creation Agent to prepare a demo for ${clean(demo[1], 80)}.`, tasks: [{ agent: 'demo-creation', leadName: clean(demo[1], 80), level: levelFrom(text) }] };
  }
  const find = text.match(/\b(?:find|search for|search|look for|get me|scan for)\s+(?:me\s+)?(?:some\s+|new\s+)?(.+?)\s+(?:in|around|near)\s+(.+?)[.?!]*$/i);
  if (find) {
    const category = tidyCategory(find[1]);
    const city = tidyCity(find[2]);
    if (category && city) return { reply: `I will ask the Lead Research Agent to look for ${category} in ${city}.`, tasks: [{ agent: 'lead-research', category, city }] };
  }
  const recent = context.recentActivity.length ? ` Latest team activity: ${context.recentActivity.slice(0, 3).join(' ')}` : '';
  return { reply: `${statusLine(context)}${recent} You can ask me to find businesses in a city or to build a demo for a lead.`, tasks: [] };
}

function validate(parsed: any): Omit<MasterPlan, 'source' | 'aiError'> | null {
  const reply = clean(parsed?.reply, 600);
  if (!reply) return null;
  const tasks: PlannedTask[] = [];
  for (const raw of Array.isArray(parsed?.tasks) ? parsed.tasks.slice(0, MAX_TASKS) : []) {
    if (raw?.agent === 'lead-research' && tidyCategory(String(raw.category || '')) && tidyCity(String(raw.city || ''))) {
      tasks.push({ agent: 'lead-research', category: tidyCategory(String(raw.category)), city: tidyCity(String(raw.city)) });
    } else if (raw?.agent === 'demo-creation' && clean(raw.leadName, 80)) {
      tasks.push({ agent: 'demo-creation', leadName: clean(raw.leadName, 80), level: ['mid', 'hybrid', 'ultra'].includes(raw.level) ? raw.level : 'mid' });
    } else if (raw?.agent === 'outreach') {
      tasks.push({ agent: 'outreach', kind: raw?.kind === 'followup' ? 'followup' : 'first', count: Math.max(1, Math.min(25, Number(raw.count) || 25)) });
    }
  }
  return { reply, tasks };
}

export async function planRequest(message: string, history: string[], context: MasterContext): Promise<MasterPlan> {
  const text = clean(message, 400);
  if (asksUpkeepInbox(text)) return { reply: upkeepInboxAnswer, tasks: [], source: 'rules', aiError: null };
  if (/\b(?:how many|count|number of|total)\b/i.test(text) && /\b(?:leads?|business(?:es)?)\b/i.test(text) && /\bemail(?:s| address(?:es)?)?\b/i.test(text)) {
    return { ...planByRules(text, context), source: 'rules', aiError: null };
  }
  const { provider, apiKey } = aiConfig();
  const unavailable = aiUnavailableReason(provider, apiKey);
  if (unavailable) return { ...planByRules(message, context), source: 'rules', aiError: unavailable };

  const model = process.env.MASTER_AI_MODEL || process.env.DEMO_AI_MODEL || 'gemini-3.5-flash-lite';
  const system = [
    'You are the Master Agent of ClientRadar AI, chief of staff to Timothy, owner of Timigaga Studios (a web design studio).',
    'Talk like a sharp, warm chief of staff texting the owner: plain words, 1 to 4 short sentences, no markdown, no lists, no robot talk. You may discuss ideas, answer questions and think things through with him, not only hand out tasks. Understand what he means in whatever words he uses; never make him repeat himself in exact phrases.',
    'You coordinate specialist agents and never do their work yourself. You never invent results, numbers, leads, prices or promises. Answer questions about the business only from the records given below; if the records do not contain the answer, say you do not have it.',
    'Specialists you may hand tasks to right now:',
    '- "lead-research": searches public business listings in ANY country. Needs "category" (only the type of business, no numbers) and "city" (only the place, any city in the world). How many and "without a website" are read from the owner message automatically.',
    '- "demo-creation": builds a demo website for ONE existing lead. Needs "leadName" copied exactly from the lead list, and "level": "mid", "hybrid" or "ultra" (use "mid" unless told otherwise).',
    '- "outreach" with "kind": "first": the Outreach Agent writes first-contact emails for many leads at once. Use it whenever the owner wants leads emailed, in whatever words he says it. "count" is how many (default 25). Nothing is sent without his approval.',
    '- "outreach" with "kind": "followup": the Outreach Agent writes polite follow-up emails to leads written to at least 3 days ago that have not replied. Use it whenever he wants non-repliers chased, in whatever words he says it. A lead is never followed up twice.',
    'Records Upkeep reads public websites already attached to saved lead records and fills missing email, phone or Instagram fields; it never reads the owner’s Gmail inbox.',
    'Email Link Scan is separate. Only after the owner accepts the orb prompt, the configured Google Apps Script checks up to 10 received inbox messages from the last 30 days and sends sender, subject, date, Gmail message ID, website link and link label—not the email body—to ClientRadar. The public website text may be sent to the configured Gemini API for English translation and extraction. Results stay in Import Review; they do not become leads until the owner imports them. If the helper script or its authorized time trigger has not been set up, say it will not run yet.',
    'Client replies to outreach emails are collected and sorted on the Replies page by the Customer Communication Agent, and a suggested answer is written for promising replies. The owner reads it there and only his approval sends it. You cannot answer clients.',
    'Quality checks, reports, scheduling and social posts are planned agents that are NOT active yet. If asked for those, say so plainly and create no task.',
    'You cannot send messages, save leads, delete anything or spend money. The owner saves found businesses himself with the Save buttons under the results.',
    `Create at most ${MAX_TASKS} tasks. Create none when the request is only a question or an idea. If a needed detail is missing (for example the city), ask for it and create no task.`,
    'When you create tasks, say which agent you are asking and for what; do not claim the work is already done.',
    'Return only JSON: {"reply": string, "tasks": [{"agent": string, "category"?: string, "city"?: string, "leadName"?: string, "level"?: string, "kind"?: string, "count"?: number}]}',
  ].join('\n');
  const records = [
    `Pipeline: ${statusLine(context)}`,
    `Recent team activity: ${context.recentActivity.length ? context.recentActivity.join(' | ') : 'none recorded'}`,
    `Lead list: ${context.leadNames.length ? context.leadNames.join('; ') : 'no leads saved'}`,
  ].join('\n');
  const talk = history.slice(-6).map((line) => clean(line, 300)).join('\n');

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: `RECORDS\n${records}\n\nEARLIER IN THIS CHAT\n${talk || 'nothing'}\n\nTIMOTHY SAYS\n${clean(message, 600)}` }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
    });
    if (!response.ok) throw new Error(response.status === 429 ? 'free AI limit reached' : `AI service returned ${response.status}`);
    const body: any = await response.json();
    const text = body?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || '';
    const plan = validate(JSON.parse(text.replace(/^```(?:json)?|```$/g, '').trim()));
    if (!plan) throw new Error('AI answer was not usable');
    return { ...plan, source: 'ai', aiError: null };
  } catch (error) {
    const reason = error instanceof Error ? (error.name === 'TimeoutError' ? 'AI service took too long' : error.message.slice(0, 120)) : 'AI failed';
    return { ...planByRules(message, context), source: 'rules', aiError: reason };
  }
}

// Turns a short voice recording into text with the same AI key. Returns only what was said.
export async function transcribeAudio(base64: string, mimeType: string): Promise<string> {
  const { provider, apiKey } = aiConfig();
  const unavailable = aiUnavailableReason(provider, apiKey);
  if (unavailable) throw new Error(`Voice input needs Gemini: ${unavailable}`);
  const model = process.env.MASTER_AI_MODEL || process.env.DEMO_AI_MODEL || 'gemini-3.5-flash-lite';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [
        { inline_data: { mime_type: mimeType, data: base64 } },
        { text: 'Write down exactly what the speaker says in this recording, in the language spoken. Output only the spoken words as plain text. If there is no clear speech, output nothing.' },
      ] }],
      generationConfig: { temperature: 0 },
    }),
  });
  if (!response.ok) throw new Error(response.status === 429 ? 'free AI limit reached, type your message instead' : `AI service returned ${response.status}`);
  const body: any = await response.json();
  const text = body?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || '';
  return clean(text, 600);
}

// The opening briefing: the most important things first, then the numbers only if asked.
// The client sends the signature of the last briefing it showed; when nothing important has
// changed, the Master says so instead of repeating itself. One AI call at most per login,
// and none at all when nothing is new. Free tier only, like everything else here.

export interface Briefing {
  headline: string;
  brief: string;
  nextStep: string;
  signature: string;
  isNew: boolean;
  source: 'ai' | 'rules';
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export async function briefingFor(supabase: any, storedSig: string): Promise<Briefing> {
  const [repliesRes, tasksRes, leadsRes, activityRes] = await Promise.all([
    supabase.from('outreach_replies').select('id, label, draft_state, from_name, from_email').eq('status', 'new').order('created_at', { ascending: false }).limit(50),
    supabase.from('agent_tasks').select('id, title, status, created_at').in('status', ['waiting_approval', 'failed', 'running', 'queued']).order('created_at', { ascending: false }).limit(50),
    supabase.from('leads').select('status, demo_status, deal_value, created_at').order('created_at', { ascending: false }).limit(2000),
    supabase.from('agent_activity').select('summary').order('created_at', { ascending: false }).limit(3),
  ]);
  const replies: any[] = repliesRes?.data || [];
  const tasks: any[] = tasksRes?.data || [];
  const leads: any[] = leadsRes?.data || [];
  const recent: string[] = (activityRes?.data || []).map((row: any) => clean(row.summary, 160)).filter(Boolean);

  const promising = replies.filter((row: any) => row.label === 'interested' || row.label === 'question');
  const draftsReady = promising.filter((row: any) => row.draft_state === 'ready');
  const approvals = tasks.filter((row: any) => row.status === 'waiting_approval');
  const failed = tasks.filter((row: any) => row.status === 'failed');
  const running = tasks.filter((row: any) => row.status === 'running' || row.status === 'queued');
  const nameOfReply = (row: any) => clean(row.from_name || row.from_email, 60);

  const today = new Date().toISOString().slice(0, 10);
  const count = (test: (row: any) => boolean) => leads.filter(test).length;
  const totals = {
    total: leads.length,
    newToday: count((row: any) => String(row.created_at || '').slice(0, 10) === today),
    fresh: count((row: any) => row.status === 'New'),
    pendingReply: count((row: any) => row.status === 'Pending Reply'),
    warm: count((row: any) => row.status === 'Interested' || row.status === 'Negotiating'),
    closed: count((row: any) => row.status === 'Deal Closed'),
    demosReady: count((row: any) => row.demo_status === 'Ready'),
    pipeline: leads.reduce((sum: number, row: any) => sum + (Number(row.deal_value) || 0), 0),
  };

  // The signature covers everything the Master would brief about. Same signature = nothing new.
  const signature = [
    ...promising.map((row: any) => `r${row.id}`),
    ...approvals.map((row: any) => `a${row.id}`),
    ...failed.map((row: any) => `f${row.id}`),
    ...running.map((row: any) => `w${row.id}`),
  ].sort().join('|');
  const isNew = signature !== String(storedSig || '');

  const nextStep = draftsReady.length
    ? `approve the suggested answer for ${nameOfReply(draftsReady[0])}`
    : promising.length
      ? `read the ${plural(promising.length, 'reply', 'replies')} waiting on the Replies page`
      : approvals.length
        ? `review the waiting drafts (${clean(approvals[0].title, 80)})`
        : failed.length
          ? `retry ${clean(failed[0].title, 80)}`
          : totals.fresh
            ? 'draft outreach emails for the new leads'
            : totals.demosReady
              ? 'send the ready demos to their businesses'
              : 'find more leads to grow the pipeline';

  const brief = `The full picture: ${plural(totals.total, 'lead', 'leads')} in the pipeline, ${totals.newToday} added today, ${totals.fresh} still new, ${totals.pendingReply} awaiting reply, ${totals.warm} warm and ${totals.closed} closed. ${plural(totals.demosReady, 'demo is', 'demos are')} ready to send. Pipeline value $${totals.pipeline.toLocaleString()}.`;

  const builtInHeadline = () => {
    if (!isNew) {
      const recap = recent.length ? ` Last thing done: ${recent[0]}` : '';
      return `Nothing new since we last spoke.${recap} Next: ${nextStep}.`;
    }
    const parts: string[] = [];
    if (promising.length) parts.push(`${plural(promising.length, 'reply is', 'replies are')} waiting${draftsReady.length ? ` and suggested ${draftsReady.length === 1 ? 'answer is' : 'answers are'} ready` : ''} - ${promising.slice(0, 3).map(nameOfReply).join(', ')}`);
    if (approvals.length) parts.push(`${plural(approvals.length, 'batch is', 'batches are')} waiting for your approval`);
    if (failed.length) parts.push(`${plural(failed.length, 'thing failed', 'things failed')} - ${clean(failed[0].title, 60)}`);
    if (running.length) parts.push(`${plural(running.length, 'task is', 'tasks are')} running`);
    if (!parts.length) return `Everything is quiet. ${brief} Next: ${nextStep}.`;
    return `${parts.join('. ')}. Next: ${nextStep}.`;
  };

  if (!isNew) return { headline: builtInHeadline(), brief, nextStep, signature, isNew, source: 'rules' };

  // The AI writes the headline from the facts, so it sounds like a person, not a template.
  const { provider, apiKey } = aiConfig();
  if (aiUnavailableReason(provider, apiKey)) return { headline: builtInHeadline(), brief, nextStep, signature, isNew, source: 'rules' };
  const model = process.env.MASTER_AI_MODEL || process.env.DEMO_AI_MODEL || 'gemini-3.5-flash-lite';
  const facts = [
    promising.length ? `${plural(promising.length, 'promising reply is', 'promising replies are')} waiting (${promising.slice(0, 3).map(nameOfReply).join(', ')}), suggested answers ready for ${draftsReady.length}` : 'no replies waiting',
    approvals.length ? `${plural(approvals.length, 'batch is', 'batches are')} waiting for approval` : 'no drafts waiting for approval',
    failed.length ? `${plural(failed.length, 'thing failed', 'things failed')}: ${clean(failed[0].title, 80)}` : 'nothing failed',
    running.length ? `${plural(running.length, 'task is', 'tasks are')} running now` : 'no work running',
    `pipeline: ${totals.total} leads, ${totals.newToday} added today, ${totals.warm} warm, ${totals.closed} closed, ${totals.demosReady} demos ready, value $${totals.pipeline.toLocaleString()}`,
    recent.length ? `recently done: ${recent.join(' | ')}` : 'nothing done recently',
    `next thing to do: ${nextStep}`,
  ].join('\n');
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'You are the Master Agent briefing Timothy, owner of Timigaga Studios. Write his opening briefing in 2 to 4 short plain sentences, warm and direct, no markdown, no lists. Lead with the most important thing. Use only the facts given; never invent numbers or results. End by mentioning the next thing to do.' }] },
        contents: [{ role: 'user', parts: [{ text: `FACTS\n${facts}` }] }],
        generationConfig: { temperature: 0.5 },
      }),
    });
    if (!response.ok) return { headline: builtInHeadline(), brief, nextStep, signature, isNew, source: 'rules' };
    const body: any = await response.json().catch(() => null);
    const text = clean(body?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join(''), 600);
    if (text.length < 30) return { headline: builtInHeadline(), brief, nextStep, signature, isNew, source: 'rules' };
    return { headline: text, brief, nextStep, signature, isNew, source: 'ai' };
  } catch {
    return { headline: builtInHeadline(), brief, nextStep, signature, isNew, source: 'rules' };
  }
}
