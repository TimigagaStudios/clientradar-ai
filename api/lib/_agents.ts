import { buildDemoPrompt, processDemoJob } from './demo-job-process.js';
import { normalizeStyleLevel } from './demo-ai.js';

// Specialist agents. Each runner receives ONE task and only the tools listed for that agent:
// it cannot reach another agent's tools or data. Each task runs in its own server call.

export interface AgentResult {
  summary: string;
  output: Record<string, unknown>;
}

type Runner = (supabase: any, task: any) => Promise<AgentResult>;

// --- Lead Research Agent: one tool, the public Google Places search. Read-only. ---
async function placesSearch(category: string, city: string) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error('Google Places key is not set');
  const search = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(`${category} in ${city}`)}&key=${key}`, { signal: AbortSignal.timeout(12000) });
  const data: any = await search.json();
  if (!search.ok || data.status === 'REQUEST_DENIED') throw new Error(data.error_message || 'Google Places search failed');
  const places: any[] = (data.results || []).slice(0, 8);
  return Promise.all(
    places.map(async (place) => {
      let details: any = {};
      try {
        const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place.place_id)}&fields=website,formatted_phone_number&key=${key}`, { signal: AbortSignal.timeout(8000) });
        details = (await response.json())?.result || {};
      } catch {
        /* details are optional */
      }
      return {
        businessName: String(place.name || ''),
        address: String(place.formatted_address || ''),
        rating: Number(place.rating) || 0,
        reviewCount: Number(place.user_ratings_total) || 0,
        website: details.website || null,
        phone: details.formatted_phone_number || null,
        mapLink: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
      };
    }),
  );
}

const runLeadResearch: Runner = async (_supabase, task) => {
  const category = String(task.input?.category || '').trim();
  const city = String(task.input?.city || '').trim();
  if (!category || !city) throw new Error('The task needs a business type and a city');
  const businesses = await placesSearch(category, city);
  const withoutSite = businesses.filter((item) => !item.website).length;
  return {
    summary: `Found ${businesses.length} ${category} in ${city}; ${withoutSite} of them show no website.`,
    output: { category, city, businesses },
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
