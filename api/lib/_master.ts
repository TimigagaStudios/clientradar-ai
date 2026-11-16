// Master Agent: understands the owner's request, answers from real records and decides which
// specialist gets which task. It never does a specialist's work itself and has no tools of its
// own except "hand a task over". The specialists run separately (see _agents.ts).
// Optional setting (name only): MASTER_AI_MODEL. Uses the same server key as the Demo Factory.

export interface PlannedTask {
  agent: 'lead-research' | 'demo-creation';
  category?: string;
  city?: string;
  leadName?: string;
  level?: 'mid' | 'hybrid' | 'ultra';
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
  return `You have ${t.leads || 0} leads: ${t.new || 0} new, ${t.pendingReply || 0} awaiting reply, ${t.warm || 0} warm and ${t.closed || 0} closed. ${t.demosReady || 0} demos are ready.`;
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

// Used when no AI key is set or the AI call fails. Understands two plain requests.
export function planByRules(message: string, context: MasterContext): Omit<MasterPlan, 'source' | 'aiError'> {
  const text = clean(message, 400);
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
    }
  }
  return { reply, tasks };
}

export async function planRequest(message: string, history: string[], context: MasterContext): Promise<MasterPlan> {
  const provider = (process.env.DEMO_AI_PROVIDER || 'fallback').toLowerCase();
  const apiKey = process.env.GEMINI_API_KEY || process.env.DEMO_AI_API_KEY;
  if (provider !== 'gemini' || !apiKey) return { ...planByRules(message, context), source: 'rules', aiError: null };

  const model = process.env.MASTER_AI_MODEL || process.env.DEMO_AI_MODEL || 'gemini-3.5-flash-lite';
  const system = [
    'You are the Master Agent of ClientRadar AI, chief of staff to Timothy, owner of Timigaga Studios (a web design studio).',
    'You coordinate a team of specialist agents. You never do their work yourself and you never invent results, numbers, leads, prices or promises.',
    'Specialists you may hand tasks to right now:',
    '- "lead-research": searches public business listings in ANY country. Needs "category" (only the type of business, no numbers) and "city" (only the place, any city in the world). How many and "without a website" are read from the owner message automatically.',
    '- "demo-creation": builds a demo website for ONE existing lead. Needs "leadName" copied exactly from the lead list, and "level": "mid", "hybrid" or "ultra" (use "mid" unless told otherwise).',
    'The Outreach Agent writes first-contact emails for many leads at once, but you cannot start it with a task here: if the owner wants that, tell him to say "draft outreach emails". Outreach for a single named lead is done on the Outreach page.',
    'The Outreach Agent also writes polite follow-up emails to leads that were written to at least 3 days ago and have not replied; if the owner wants that, tell him to say "follow up with the leads that did not reply". A lead is never followed up twice.',
    'Client replies to outreach emails are collected and sorted on the Replies page by the Customer Communication Agent; what came in is listed under recent team activity. You cannot answer clients.',
    'The Customer Communication Agent also writes a suggested answer for promising replies. The owner reads it on the Replies page and only his approval sends it. You cannot answer clients.',
    'Quality checks, reports, scheduling and social posts are planned agents that are NOT active yet. If asked for those, say so plainly and create no task.',
    'You cannot send messages, save leads, delete anything or spend money. The owner saves found businesses himself with the Save buttons under the results.',
    'Answer questions about the business only from the records given below. If the records do not contain the answer, say you do not have it.',
    `Create at most ${MAX_TASKS} tasks. Create none when the request is only a question. If a needed detail is missing (for example the city), ask for it and create no task.`,
    'Reply in one to three short plain sentences, no markdown, no lists. When you create tasks, say which agent you are asking and for what; do not claim the work is already done.',
    'Return only JSON: {"reply": string, "tasks": [{"agent": string, "category"?: string, "city"?: string, "leadName"?: string, "level"?: string}]}',
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
  const provider = (process.env.DEMO_AI_PROVIDER || 'fallback').toLowerCase();
  const apiKey = process.env.GEMINI_API_KEY || process.env.DEMO_AI_API_KEY;
  if (provider !== 'gemini' || !apiKey) throw new Error('voice input needs the AI key');
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
