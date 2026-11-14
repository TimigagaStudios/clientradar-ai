import { createClient } from '@supabase/supabase-js';

// The AI team register and the shared task / activity records.
// The file name starts with an underscore on purpose: Vercel does not count
// underscore files under api/ as server functions.
//
// Rules of this module:
// - Each agent has its own short list of tools and data. Nothing here grants access; it documents
//   and records. Tools are wired agent by agent in later phases.
// - Recording must never break the real work: every write is best-effort and silent.

export type AgentStage = 'active' | 'planned';

export interface AgentProfile {
  key: string;
  name: string;
  role: string;
  job: string;
  tools: string[];
  dataAccess: string[];
  needsApproval: string[];
  reportsTo: string | null;
  stage: AgentStage;
  stageNote: string;
}

export const AGENTS: AgentProfile[] = [
  {
    key: 'master',
    name: 'Master Agent',
    role: 'Chief of staff',
    job: 'Your single point of contact. Takes your instructions, splits them into tasks, hands them to the right specialist, checks the results and reports back.',
    tools: ['Assign a task to a specialist', 'Read task results', 'Ask you for approval'],
    dataAccess: ['Task records', 'Activity log', 'Lead summaries'],
    needsApproval: ['Anything a specialist needs approval for'],
    reportsTo: null,
    stage: 'planned',
    stageNote: 'Voice briefing is live. Real chat and task hand-offs arrive in Phase 2.',
  },
  {
    key: 'lead-research',
    name: 'Lead Research Agent',
    role: 'Finds businesses worth contacting',
    job: 'Searches public business listings for a category and city and returns candidates with rating, reviews, phone and website status.',
    tools: ['Google Places search'],
    dataAccess: ['Public business listings'],
    needsApproval: ['Saving leads without you choosing them'],
    reportsTo: 'master',
    stage: 'active',
    stageNote: 'Every Lead Finder search is recorded as its task.',
  },
  {
    key: 'demo-creation',
    name: 'Demo Creation Agent',
    role: 'Builds the demo website for a lead',
    job: 'Reads the lead and its public website, asks the writing model for structured content and produces the demo preview in the chosen quality tier.',
    tools: ['Public website reader', 'Demo content writer (AI model)', 'Demo renderer'],
    dataAccess: ['The one lead it is building for', 'Demo jobs'],
    needsApproval: ['Sending a demo to a client (it never sends)'],
    reportsTo: 'master',
    stage: 'active',
    stageNote: 'Every demo build is recorded as its task. Internal specialist workers arrive in Phase 4.',
  },
  {
    key: 'quality-assurance',
    name: 'Quality Assurance Agent',
    role: 'Checks work before you see it',
    job: 'Reviews demos and drafts for invented claims, broken sections and tone before they reach you.',
    tools: ['Demo checker', 'Draft checker'],
    dataAccess: ['Demo content', 'Outreach drafts'],
    needsApproval: [],
    reportsTo: 'master',
    stage: 'planned',
    stageNote: 'Phase 4',
  },
  {
    key: 'outreach',
    name: 'Outreach Agent',
    role: 'Prepares first contact',
    job: 'Drafts the first message for a lead and queues it for your approval. Nothing is sent without you.',
    tools: ['Message drafter', 'Send queue'],
    dataAccess: ['Lead contact details', 'Outreach log'],
    needsApproval: ['Sending any message'],
    reportsTo: 'master',
    stage: 'planned',
    stageNote: 'Phase 4',
  },
  {
    key: 'reporting',
    name: 'Business Intelligence Agent',
    role: 'Numbers and reports',
    job: 'Turns leads, demos, replies and deals into short reports and flags what changed.',
    tools: ['Pipeline reader', 'Report writer'],
    dataAccess: ['Lead and deal totals', 'Activity log'],
    needsApproval: [],
    reportsTo: 'master',
    stage: 'planned',
    stageNote: 'Phase 4',
  },
  {
    key: 'scheduling',
    name: 'Appointment Agent',
    role: 'Calls and meetings',
    job: 'Proposes times, tracks confirmations and reminds you before a call.',
    tools: ['Calendar reader', 'Reminder sender'],
    dataAccess: ['Lead contact details', 'Your availability'],
    needsApproval: ['Confirming a meeting on your behalf'],
    reportsTo: 'master',
    stage: 'planned',
    stageNote: 'Phase 5',
  },
  {
    key: 'customer-communication',
    name: 'Customer Communication Agent',
    role: 'Replies and follow-ups',
    job: 'Reads client replies, suggests answers and keeps follow-ups from being forgotten.',
    tools: ['Reply reader', 'Reply drafter'],
    dataAccess: ['Conversations with the one client it is handling'],
    needsApproval: ['Sending any reply', 'Any price or commitment'],
    reportsTo: 'master',
    stage: 'planned',
    stageNote: 'Phase 6',
  },
  {
    key: 'social-content',
    name: 'Social Media and Content Agent',
    role: 'Posts and content ideas',
    job: 'Drafts posts and content ideas for Timigaga Studios for you to approve.',
    tools: ['Post drafter'],
    dataAccess: ['Approved brand notes'],
    needsApproval: ['Publishing anything'],
    reportsTo: 'master',
    stage: 'planned',
    stageNote: 'Phase 6',
  },
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function teamClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

export interface TaskRecord {
  agentKey: string;
  title: string;
  status: 'done' | 'failed';
  summary: string;
  leadId?: string | null;
  input?: unknown;
  output?: unknown;
  error?: string | null;
  startedAt?: Date;
  requestedBy?: 'owner' | 'master' | 'system';
}

// Writes one finished task and one activity line. Never throws and never waits longer than 4 seconds.
export async function recordTask(record: TaskRecord): Promise<void> {
  const write = async () => {
    const supabase = teamClient();
    if (!supabase) return;
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('agent_tasks')
      .insert({
        agent_key: record.agentKey,
        title: record.title.slice(0, 200),
        status: record.status,
        requested_by: record.requestedBy || 'owner',
        lead_id: record.leadId || null,
        input: record.input ?? null,
        output: record.output ?? null,
        error: record.error ? String(record.error).slice(0, 300) : null,
        attempts: 1,
        started_at: (record.startedAt || new Date()).toISOString(),
        completed_at: now,
      })
      .select('id')
      .single();
    if (error || !data) return;
    await supabase.from('agent_activity').insert({
      agent_key: record.agentKey,
      task_id: data.id,
      lead_id: record.leadId || null,
      kind: record.status === 'done' ? 'task_done' : 'task_failed',
      summary: record.summary.slice(0, 300),
    });
  };
  try {
    await Promise.race([write(), new Promise((resolve) => setTimeout(resolve, 4000))]);
  } catch {
    /* recording is best-effort */
  }
}
