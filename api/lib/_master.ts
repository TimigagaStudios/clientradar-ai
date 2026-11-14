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

// Used when no AI key is set or the AI call fails. Understands two plain requests.
export function planByRules(message: string, context: MasterContext): Omit<MasterPlan, 'source' | 'aiError'> {
  const text = clean(message, 400);
  const demo = text.match(/\bdemo\b.*?\bfor\s+(.+?)[.?!]*$/i);
  if (demo) {
    return { reply: `I will ask the Demo Creation Agent to prepare a demo for ${clean(demo[1], 80)}.`, tasks: [{ agent: 'demo-creation', leadName: clean(demo[1], 80), level: levelFrom(text) }] };
  }
  const find = text.match(/\b(?:find|search for|search|look for|get me|scan for)\s+(?:me\s+)?(?:some\s+|new\s+)?(.+?)\s+(?:in|around|near)\s+(.+?)[.?!]*$/i);
  if (find) {
    return { reply: `I will ask the Lead Research Agent to look for ${clean(find[1], 60)} in ${clean(find[2], 60)}.`, tasks: [{ agent: 'lead-research', category: clean(find[1], 60), city: clean(find[2], 60) }] };
  }
  const recent = context.recentActivity.length ? ` Latest team activity: ${context.recentActivity.slice(0, 3).join(' ')}` : '';
  return { reply: `${statusLine(context)}${recent} You can ask me to find businesses in a city or to build a demo for a lead.`, tasks: [] };
}

function validate(parsed: any): Omit<MasterPlan, 'source' | 'aiError'> | null {
  const reply = clean(parsed?.reply, 600);
  if (!reply) return null;
  const tasks: PlannedTask[] = [];
  for (const raw of Array.isArray(parsed?.tasks) ? parsed.tasks.slice(0, MAX_TASKS) : []) {
    if (raw?.agent === 'lead-research' && clean(raw.category, 60) && clean(raw.city, 60)) {
      tasks.push({ agent: 'lead-research', category: clean(raw.category, 60), city: clean(raw.city, 60) });
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
    '- "lead-research": searches public business listings. Needs "category" (type of business) and "city".',
    '- "demo-creation": builds a demo website for ONE existing lead. Needs "leadName" copied exactly from the lead list, and "level": "mid", "hybrid" or "ultra" (use "mid" unless told otherwise).',
    'Outreach, quality checks, reports, scheduling, client replies and social posts are planned agents that are NOT active yet. If asked for those, say so plainly and create no task.',
    'You cannot send messages, save leads, delete anything or spend money.',
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
