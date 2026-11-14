import { buildDemoPrompt, processDemoJob, refreshDemoSections } from './demo-job-process.js';
import { normalizeStyleLevel } from './demo-ai.js';
import { searchBusinesses, type FoundBusiness } from './_places.js';

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
  const wanted = Math.max(1, Math.min(100, Math.round(Number(task.input?.count) || 8)));
  const onlyWithoutSite = Boolean(task.input?.noWebsite);
  // "Without a website" needs more reading: up to 4 pages of 100 are read and filtered, then it stops.
  const pageSize = onlyWithoutSite ? 100 : wanted;
  let businesses: FoundBusiness[] = [];
  let looked = 0;
  let credits = 0;
  let found = await searchBusinesses({ category, city, limit: pageSize });
  for (let page = 0; ; page += 1) {
    looked += found.businesses.length;
    credits += found.credits || 0;
    businesses = businesses.concat(onlyWithoutSite ? found.businesses.filter((item) => !item.website) : found.businesses);
    if (businesses.length >= wanted || !found.hasMore || found.source !== 'geoapify' || page >= 3) break;
    found = await searchBusinesses({ category, city, limit: pageSize, offset: (page + 1) * pageSize });
  }
  businesses = businesses.slice(0, wanted);
  const withoutSite = businesses.filter((item) => !item.website).length;
  const where = found.source === 'google' ? '' : found.source === 'geoapify' ? ' Source: Geoapify (free map data, no ratings).' : ' Source: OpenStreetMap (free), so the list is shorter and has no ratings.';
  const short = businesses.length < wanted && wanted > 8 ? ` You asked for ${wanted}; the free map data only had ${businesses.length}.` : '';
  const summary = !businesses.length
    ? `Found no ${category} in ${city}${onlyWithoutSite ? ` without a listed website (looked at ${looked})` : ''}.${where}`
    : onlyWithoutSite
      ? `Looked at ${looked} ${category} in ${city}; ${businesses.length} have no website listed in the map data (some may still have one).${short}${where}`
      : `Found ${businesses.length} ${category} in ${city}; ${withoutSite} of them show no website.${short}${where}`;
  return {
    summary,
    output: { category, city, source: found.source, note: found.note, businesses, looked, noWebsiteOnly: onlyWithoutSite, credits: credits || null },
  };
};

// --- Demo Creation Agent: reads its one lead, writes a demo job and builds it. Never sends anything. ---
const LEVEL_NAMES: Record<string, string> = { mid: 'Mid-Level', hybrid: 'Hybrid', ultra: 'Ultra Premium' };

const SECTION_NAMES: Record<string, string> = { process: 'How it works', faq: 'Common questions', photos: 'photos' };

const runDemoCreation: Runner = async (supabase, task) => {
  // An update of a finished demo: only the missing sections are added.
  if (task.input?.refresh) {
    const done = await refreshDemoSections(supabase, String(task.input.jobId || ''));
    const jobId = String(task.input.jobId || '');
    if (!done.added.length) return { summary: `The demo for ${done.name} needed no change (no new section was missing and no photos were found for it).`, output: { jobId, demoUrl: `/demos/preview/${jobId}`, generatedBy: 'none' } };
    const sections = done.added.map((key) => SECTION_NAMES[key] || key).join(' and ');
    return {
      summary: `Added ${sections} to the demo for ${done.name}${done.generatedBy === 'none' ? '' : ` (${done.generatedBy === 'ai' ? 'AI written' : 'built-in text'})`}${done.photos ? `: ${done.photos.own} from their own website, ${done.photos.sample} sample ${done.photos.sample === 1 ? 'photo' : 'photos'} marked as samples` : ''}. Its wording and link did not change.`,
      output: { jobId, demoUrl: `/demos/preview/${jobId}`, generatedBy: done.generatedBy, added: done.added },
    };
  }
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
