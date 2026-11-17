import { buildDemoPrompt, processDemoJob, refreshDemoSections } from './demo-job-process.js';
import { normalizeStyleLevel } from './demo-ai.js';
import { searchBusinesses, type FoundBusiness } from './_places.js';
import { isOfficialWebsiteUrl, isValidContactEmail, isValidContactPhone, scanSummary, scanWebsite } from './_website.js';

// Specialist agents. Each runner receives ONE task and only the tools listed for that agent:
// it cannot reach another agent's tools or data. Each task runs in its own server call.

export interface AgentResult {
  summary: string;
  output: Record<string, unknown>;
}

type Runner = (supabase: any, task: any) => Promise<AgentResult>;

const MAX_AUTO_SITE_SCANS = 8;

// --- Lead Research Agent: public business search + two-route contact qualification. Read-only; saves nothing. ---
const runLeadResearch: Runner = async (_supabase, task) => {
  const category = String(task.input?.category || '').trim();
  const city = String(task.input?.city || '').trim();
  if (!category || !city) throw new Error('The task needs a business type and a city');
  const wanted = Math.max(1, Math.min(100, Math.round(Number(task.input?.count) || 8)));
  const onlyWithoutSite = Boolean(task.input?.noWebsite);
  // Read enough map candidates to inspect qualification (without-site searches read up to 4 pages).
  const pageSize = onlyWithoutSite ? 100 : Math.max(wanted, Math.min(40, wanted * 2));
  let pool: FoundBusiness[] = [];
  let looked = 0;
  let credits = 0;
  let found = await searchBusinesses({ category, city, limit: pageSize });
  for (let page = 0; ; page += 1) {
    looked += found.businesses.length;
    credits += found.credits || 0;
    pool = pool.concat(onlyWithoutSite ? found.businesses.filter((item) => !item.website) : found.businesses);
    if (pool.length >= (onlyWithoutSite ? wanted : Math.max(wanted, 16)) || !found.hasMore || found.source !== 'geoapify' || page >= 3) break;
    found = await searchBusinesses({ category, city, limit: pageSize, offset: (page + 1) * pageSize });
  }
  const candidates = pool.slice(0, Math.max(wanted, Math.min(pool.length, 20)));

  // Route 1: map already has email + phone. Route 2: official website checked for missing contact(s).
  const toScan = candidates
    .filter((item) => !(isValidContactEmail(item.email) && isValidContactPhone(item.phone)) && isOfficialWebsiteUrl(item.website))
    .slice(0, MAX_AUTO_SITE_SCANS);
  const scanMap = new Map<FoundBusiness, Awaited<ReturnType<typeof scanWebsite>>>();
  for (let i = 0; i < toScan.length; i += 4) {
    const batch = toScan.slice(i, i + 4);
    const scans = await Promise.all(batch.map((item) => scanWebsite(item.website).catch(() => null)));
    batch.forEach((item, index) => scanMap.set(item, scans[index]));
  }

  let route1 = 0;
  let route2 = 0;
  let pendingCheck = 0;
  let incomplete = 0;

  const enriched = candidates.map((item) => {
    const mapEmail = isValidContactEmail(item.email) ? String(item.email).trim().toLowerCase() : null;
    const mapPhone = isValidContactPhone(item.phone) ? String(item.phone).trim() : null;
    if (mapEmail && mapPhone) {
      route1 += 1;
      return {
        ...item,
        email: mapEmail,
        phone: mapPhone,
        emailSource: 'map' as const,
        phoneSource: 'map' as const,
        websiteChecked: false,
      };
    }
    if (scanMap.has(item)) {
      const scan = scanMap.get(item);
      if (!scan) {
        incomplete += 1;
        return {
          ...item,
          email: mapEmail,
          phone: mapPhone,
          emailSource: mapEmail ? ('map' as const) : undefined,
          phoneSource: mapPhone ? ('map' as const) : undefined,
          websiteChecked: true,
          websiteRead: false,
          websiteError: 'Site could not be read',
        };
      }
      const siteEmail = scan.emails[0] || null;
      const sitePhone = scan.phones[0] || null;
      const finalEmail = mapEmail || siteEmail;
      const finalPhone = mapPhone || sitePhone;
      if (finalEmail && finalPhone) route2 += 1;
      else incomplete += 1;
      return {
        ...item,
        email: finalEmail,
        phone: finalPhone,
        instagram: scan.instagram || undefined,
        emailSource: mapEmail ? ('map' as const) : siteEmail ? ('website' as const) : undefined,
        phoneSource: mapPhone ? ('map' as const) : sitePhone ? ('website' as const) : undefined,
        websiteChecked: true,
        websiteRead: true,
        websiteScanSummary: scanSummary(scan),
      };
    }
    if (isOfficialWebsiteUrl(item.website)) {
      pendingCheck += 1;
      return {
        ...item,
        email: mapEmail,
        phone: mapPhone,
        emailSource: mapEmail ? ('map' as const) : undefined,
        phoneSource: mapPhone ? ('map' as const) : undefined,
        websiteChecked: false,
      };
    }
    incomplete += 1;
    return {
      ...item,
      email: mapEmail,
      phone: mapPhone,
      emailSource: mapEmail ? ('map' as const) : undefined,
      phoneSource: mapPhone ? ('map' as const) : undefined,
      websiteChecked: false,
    };
  });

  const rankOf = (entry: any) => {
    if (isValidContactEmail(entry.email) && isValidContactPhone(entry.phone)) return 0;
    if (!entry.websiteChecked && isOfficialWebsiteUrl(entry.website)) return 1;
    return 2;
  };
  const sorted = [...enriched].sort((a, b) => rankOf(a) - rankOf(b)).slice(0, wanted);
  const qualifiedTotal = sorted.filter((entry) => isValidContactEmail(entry.email) && isValidContactPhone(entry.phone)).length;
  const pendingShown = sorted.filter((entry) => !(isValidContactEmail(entry.email) && isValidContactPhone(entry.phone)) && !entry.websiteChecked && isOfficialWebsiteUrl(entry.website)).length;
  const incompleteShown = sorted.length - qualifiedTotal - pendingShown;

  const where = found.source === 'google' ? '' : found.source === 'geoapify' ? ' Source: Geoapify (OpenStreetMap data).' : ' Source: OpenStreetMap.';
  const summary = !sorted.length
    ? `Found no ${category} in ${city}${onlyWithoutSite ? ` without a listed website (looked at ${looked})` : ''}.${where}`
    : [
        `Checked ${sorted.length} ${category} in ${city}: ${qualifiedTotal} qualified with both email and phone (${route1} from map contacts, ${route2} confirmed on official websites).`,
        pendingShown ? `${pendingShown} more have an official website you can check below before saving.` : '',
        incompleteShown ? `${incompleteShown} ${incompleteShown === 1 ? 'is' : 'are'} incomplete (missing email or phone) and kept out of Save.` : '',
        onlyWithoutSite && !qualifiedTotal ? 'Note: businesses without a website only qualify when the map listing itself includes both email and phone.' : '',
        where.trim(),
      ].filter(Boolean).join(' ');

  return {
    summary,
    output: {
      category,
      city,
      source: found.source,
      note: found.note,
      businesses: sorted,
      looked,
      qualified: qualifiedTotal,
      route1,
      route2,
      pendingWebsiteChecks: pendingShown,
      incomplete: incompleteShown,
      noWebsiteOnly: onlyWithoutSite,
      credits: credits || null,
    },
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
  const level = normalizeStyleLevel(task.input?.level || 'ultra');
  if (!leadId) throw new Error('The task has no lead');
  const { data: lead, error: leadError } = await supabase.from('leads').select('*').eq('id', leadId).single();
  if (leadError || !lead) throw new Error('Lead not found');
  const { data: activeJob } = await supabase.from('demo_jobs').select('id').eq('lead_id', leadId).in('status', ['queued', 'generating']).maybeSingle();
  if (activeJob) throw new Error('This lead already has a demo being built');
  const { data: job, error } = await supabase.from('demo_jobs').insert({ lead_id: leadId, template_key: `auto:${level}`, status: 'queued', prompt: buildDemoPrompt(lead, 'auto', level) }).select().single();
  if (error || !job) throw new Error(error?.message || 'Could not create the demo job');
  await supabase.from('leads').update({ demo_status: 'In Progress', updated_at: new Date().toISOString() }).eq('id', leadId);
  const built = await processDemoJob(supabase, job.id, { record: false });
  const written = built?.content?.generatedBy === 'ai' ? 'AI written' : built?.content?.learnedFrom ? 'built-in text in the style of an earlier AI demo' : 'built-in text';
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
