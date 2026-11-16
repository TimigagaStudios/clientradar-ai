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
    dataAccess: ['Task records', 'Activity log', 'Lead names and pipeline totals'],
    needsApproval: ['Anything a specialist needs approval for'],
    reportsTo: null,
    stage: 'active',
    stageNote: 'Chat, planning and hand-offs to Lead Research and Demo Creation are live. Background runs and notifications come next.',
  },
  {
    key: 'lead-research',
    name: 'Lead Research Agent',
    role: 'Finds businesses worth contacting',
    job: 'Searches public business listings for a category and city and returns candidates with rating, reviews, phone and website status.',
    tools: ['Business search', 'Website scan (emails, brand colours, style)'],
    dataAccess: ['Public business listings'],
    needsApproval: ['Saving leads without you choosing them'],
    reportsTo: 'master',
    stage: 'active',
    stageNote: 'Runs searches the Master Agent hands over; Lead Finder searches are recorded too.',
  },
  {
    key: 'screenshot-intelligence',
    name: 'Screenshot Intelligence Agent',
    role: 'Turns screenshots into leads',
    job: 'Reads screenshots of business listings, pulls out every business as its own record with a confidence mark, and keeps them for your review. Nothing becomes a lead until you import it.',
    tools: ['Read one screenshot with the AI', 'Keep records for review', 'Save reviewed records as leads'],
    dataAccess: ['Screenshots you upload', 'Records waiting for review', 'Leads (add only, after your review)'],
    needsApproval: ['Importing any record as a lead'],
    reportsTo: 'master',
    stage: 'active',
    stageNote: 'Bulk screenshot import with review, duplicate marks and source tracking is live from the Import button.',
  },
  {
    key: 'records-upkeep',
    name: 'Records Upkeep Agent',
    role: 'Keeps older records up to date',
    job: 'Goes through your saved leads after you sign in and fills what newer ClientRadar features need, so nothing has to be imported again: map positions for the globe, and a first read of lead websites for a missing email. It only fills empty fields and never changes what you typed.',
    tools: ['Look up a map position from an address or city', 'Website scan (emails, brand colours, style)'],
    dataAccess: ['Leads (fills empty map position, email, phone, Instagram; adds a note line)'],
    needsApproval: ['Changing or deleting anything you entered'],
    reportsTo: 'master',
    stage: 'active',
    stageNote: 'Runs quietly after sign-in (at most every 6 hours) and after a screenshot import, in small batches, then gives the Master Agent one summary. It reads saved lead websites, not the owner’s Gmail inbox.',
  },
  {
    key: 'email-link-scan',
    name: 'Email Link Scan',
    role: 'Finds business details from website links in recent email',
    job: 'After the owner explicitly accepts the orb prompt, the owner’s Google Apps Script checks up to 10 received inbox messages from the last 30 days for a public website link. It sends only the sender, subject, date, Gmail message ID, link and link label—not the email body. ClientRadar reads and may translate the public site, then keeps the extracted details for owner review. It never saves a lead automatically.',
    tools: ['Check an approved recent inbox batch', 'Read linked public websites', 'Translate and extract business details', 'Keep candidates for review'],
    dataAccess: ['Inbox metadata and website links only after owner consent', 'Public website text (may be sent to configured Gemini)', 'Pending import records'],
    needsApproval: ['Each inbox scan', 'Importing any record as a lead'],
    reportsTo: 'master',
    stage: 'active',
    stageNote: 'Requires the updated Gmail helper script and its existing authorized time trigger. It is separate from Records Upkeep, which scans websites already saved on leads.',
  },
  {
    key: 'demo-creation',
    name: 'Demo Creation Agent',
    role: 'Builds the demo website for a lead',
    job: 'Reads the lead and its public website, asks the writing model for structured content and produces the demo preview in the chosen quality tier.',
    tools: ['Public website reader', 'Demo content writer (AI model)', 'Demo renderer'],
    dataAccess: ['The one lead it is building for', 'Demo jobs'],
    needsApproval: ['Building a demo when the Master Agent asks for it', 'Sending a demo to a client (it never sends)'],
    reportsTo: 'master',
    stage: 'active',
    stageNote: 'Builds demos the Master Agent hands over (after your approval) and from the Demos page. Internal specialist workers arrive in Phase 4.',
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
    job: 'Writes the first email for every lead with a ready demo and waits for one approval. Nothing is sent without you.',
    tools: ['Message drafter', 'Email sender (Brevo)'],
    dataAccess: ['Lead contact details', 'Demo links', 'Outreach log'],
    needsApproval: ['Sending any message'],
    reportsTo: 'master',
    stage: 'active',
    stageNote: 'First emails in batches',
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
    job: 'Takes in client replies to outreach emails, sorts them and flags the promising ones. It does not answer clients.',
    tools: ['Reply reader', 'Reply sorter'],
    dataAccess: ['Replies from businesses that were written to', 'Lead stage'],
    needsApproval: ['Sending any reply', 'Any price or commitment'],
    reportsTo: 'master',
    stage: 'active',
    stageNote: 'Reply inbox; answers not yet',
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
