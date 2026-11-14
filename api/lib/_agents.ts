import { buildDemoPrompt, processDemoJob } from './demo-job-process.js';
import { normalizeStyleLevel } from './demo-ai.js';
import { findBusinesses } from './_places.js';

// Specialist agents. Each runner receives ONE task and only the tools listed for that agent:
// it cannot reach another agent's tools or data. Each task runs in its own server call.

export interface AgentResult {
  summary: string;
  output: Record<string, unknown>;
}

type Runner = (supabase: any, task: any) => Promise<AgentResult>;

// --- Lead Research Agent: one tool, the public business search. Read-only; it saves nothing. ---
const runLeadResearch: Runner = async (_supabase, task) => {
  const category = String(task.input?.category || '').trim();
  const city = String(task.input?.city || '').trim();
  if (!category || !city) throw new Error('The task needs a business type and a city');
  const found = await findBusinesses(category, city);
  const withoutSite = found.businesses.filter((item) => !item.website).length;
  const where = found.source === 'google' ? '' : ' Source: OpenStreetMap (free), so the list is shorter and has no ratings.';
  return {
    summary: found.businesses.length
      ? `Found ${found.businesses.length} ${category} in ${city}; ${withoutSite} of them show no website.${where}`
      : `Found no ${category} in ${city}.${where}`,
    output: { category, city, source: found.source, note: found.note, businesses: found.businesses },
  };
};

// --- Demo Creation Agent: reads its one lead, writes a demo job and builds it. Never sends anything. ---
const LEVEL_NAMES: Record<string, string> = { mid: 'Mid-Level', hybrid: 'Hybrid', ultra: 'Ultra Premium' };

const runDemoCreation: Runner = async (supabase, task) => {
  const leadId = String(task.input?.leadId || '');
  const level = normalizeStyleLevel(task.input?.level);
  if (!leadId) throw new Error('The task has no lead');
  const { data: lead, error: leadError } = await supabase.from('leads').select('*').eq('id', leadId).single();
  if (leadError || !lead) throw new Error('Lead not found');
  const { data: activeJob } = await supabase.from('demo_jobs').select('id').eq('lead_id', leadId).in('status', ['queued', 'generating']).maybeSingle();
  if (activeJob) throw new Error('This lead already has a demo being built');
  const { data: job, error } = await supabase.from('demo_jobs').insert({ lead_id: leadId, template_key: `auto:${level}`, status: 'queued', prompt: buildDemoPrompt(lead, 'auto', level) }).select().single();
  if (error || !job) throw new Error(error?.message || 'Could not create the demo job');
  await supabase.from('leads').update({ demo_status: 'In Progress', updated_at: new Date().toISOString() }).eq('id', leadId);
  const built = await processDemoJob(supabase, job.id, { record: false });
  const written = built?.content?.generatedBy === 'ai' ? 'AI written' : 'built-in text';
  return {
    summary: `Built the ${LEVEL_NAMES[level]} demo for ${lead.business_name} (${written}). It is ready for you to review; nothing was sent.`,
    output: { leadId, leadName: lead.business_name, level, jobId: job.id, demoUrl: `/demos/preview/${job.id}`, generatedBy: built?.content?.generatedBy || 'fallback' },
  };
};

const RUNNERS: Record<string, Runner> = {
  'lead-research': runLeadResearch,
  'demo-creation': runDemoCreation,
};

export const canRun = (agentKey: string) => Boolean(RUNNERS[agentKey]);

export async function runAgentTask(supabase: any, task: any): Promise<AgentResult> {
  const runner = RUNNERS[task.agent_key];
  if (!runner) throw new Error('This agent is not active yet');
  return runner(supabase, task);
}
