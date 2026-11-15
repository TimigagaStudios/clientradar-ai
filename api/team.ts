import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './lib/auth.js';
import { AGENTS, recordTask, teamClient } from './lib/_team.js';
import { planRequest, transcribeAudio, searchWishes, batchDemoWish, MAX_BATCH } from './lib/_master.js';
import { runUpkeep, upkeepSummary } from './lib/_upkeep.js';
import { outdatedDemos } from './lib/demo-job-process.js';
import { keepApart, keptApart, listDuplicates, mergeLeads, nameKey } from './lib/_duplicates.js';
import { applyEdits, batchOutreachWish, mailReady, outreachReady, pickForOutreach, sendOneDraft, writeDrafts, type OutreachDraft } from './lib/_outreach.js';
import { billsLine, deleteTracker, listTracker, saveTracker } from './lib/_tracker.js';
import type { MasterContext } from './lib/_master.js';
import { canRun, runAgentTask } from './lib/_agents.js';
import { scanLead } from './lib/_website.js';
import { handleExtract, handleImportSave, handleImportUpdate, listPendingImports } from './lib/_screenshots.js';

// AI team endpoint.
// GET                      team register with live task and activity records.
// POST action "chat"       the Master Agent answers and hands tasks to specialists (records only, runs nothing).
// POST action "run"        one specialist runs ONE task in this server call (approval checked here).
// POST action "cancel"     the owner declines a waiting task.
// POST action "transcribe" a short voice recording becomes text (nothing is stored).
// GET  ?view=chat          the saved conversation, rebuilt from the task records.
// POST action "extract"       the Screenshot Intelligence Agent reads ONE screenshot into business records.
// POST action "import-update" saves an edit or removes records waiting for review.
// POST action "import-save"   reviewed records become leads in the normal leads table.
// GET  ?view=imports          records still waiting for review.
// POST action "scan-site"     Lead Research reads ONE lead's own website: fills a missing email, phone or Instagram and notes the brand colours.

// Reading a screenshot with the AI can take longer than the default time allowed for a server call.
export const config = { maxDuration: 60 };

const MAX_ATTEMPTS = 3;
const LEVEL_NAMES: Record<string, string> = { mid: 'Mid-Level', hybrid: 'Hybrid', ultra: 'Ultra Premium' };
const nameOf = (key: string) => AGENTS.find((agent) => agent.key === key)?.name || key;

async function note(supabase: any, agentKey: string, kind: string, summary: string, taskId?: string | null, leadId?: string | null) {
  try {
    await supabase.from('agent_activity').insert({ agent_key: agentKey, task_id: taskId || null, lead_id: leadId || null, kind, summary: summary.slice(0, 300) });
  } catch {
    /* the log is best-effort */
  }
}

// When every task the Master handed out is finished, the Master's own task is closed with a report.
async function closeParent(supabase: any, parentId: string | null) {
  if (!parentId) return;
  const { data: all } = await supabase.from('agent_tasks').select('status, agent_key, output, error, title, input').eq('parent_task_id', parentId);
  // The one-tap approval of a batch is not itself a piece of work, so it is not counted.
  const work = (all || []).filter((row: any) => !row.input?.batch);
  const children = work.length ? work : all;
  if (!children?.length || children.some((row: any) => ['queued', 'running', 'waiting_approval'].includes(row.status))) return;
  const done = children.filter((row: any) => row.status === 'done').length;
  const report = `${done} of ${children.length} ${children.length === 1 ? 'task' : 'tasks'} completed.`;
  const declined = children.every((row: any) => row.status === 'cancelled');
  const { data: closed } = await supabase.from('agent_tasks').update({ status: done ? 'done' : declined ? 'cancelled' : 'failed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', parentId).eq('status', 'running').select('id, title');
  if (closed?.length && !declined) await note(supabase, 'master', done ? 'task_done' : 'task_failed', `Finished "${closed[0].title}": ${report}`, parentId);
}

async function masterContext(supabase: any): Promise<MasterContext> {
  const [{ data: leads }, { data: activity }] = await Promise.all([
    supabase.from('leads').select('business_name, status, demo_status').order('created_at', { ascending: false }).limit(400),
    supabase.from('agent_activity').select('agent_key, summary').order('created_at', { ascending: false }).limit(8),
  ]);
  const rows: any[] = leads || [];
  const count = (test: (row: any) => boolean) => rows.filter(test).length;
  return {
    totals: {
      leads: rows.length,
      new: count((row) => row.status === 'New'),
      pendingReply: count((row) => row.status === 'Pending Reply'),
      warm: count((row) => row.status === 'Interested' || row.status === 'Negotiating'),
      closed: count((row) => row.status === 'Deal Closed'),
      demosReady: count((row) => row.demo_status === 'Ready'),
    },
    leadNames: rows.slice(0, 80).map((row) => String(row.business_name || '').slice(0, 60)).filter(Boolean),
    // Bills due within a week go first, so the Master Agent can mention them when asked how things stand.
    recentActivity: [await billsLine(supabase), ...(activity || []).map((row: any) => `${nameOf(row.agent_key)}: ${row.summary}`)].filter(Boolean),
  };
}

async function handleChat(supabase: any, req: VercelRequest, res: VercelResponse) {
  const message = String(req.body?.message || '').trim().slice(0, 600);
  if (!message) return res.status(400).json({ success: false, error: 'message is required' });
  const history = Array.isArray(req.body?.history) ? req.body.history.filter((line: unknown) => typeof line === 'string').slice(-6) : [];

  // Many demos at once: the Master Agent picks the leads, asks ONE approval, then they build one after another.
  // Outreach for many leads: the Outreach Agent writes every draft, the owner approves once, then they are sent.
  const mail = batchOutreachWish(message);
  if (mail) return await handleBatchOutreach(supabase, req, res, message, mail.count);
  const batch = batchDemoWish(message);
  if (batch) return await handleBatchDemos(supabase, res, message, batch);

  const context = await masterContext(supabase);
  const plan = await planRequest(message, history, context);
  let reply = plan.reply;

  // Turn the plan into task rows. Demo tasks must point at exactly one saved lead.
  const rows: any[] = [];
  const problems: string[] = [];
  for (const task of plan.tasks) {
    if (task.agent === 'lead-research') {
      rows.push({ agent_key: 'lead-research', title: `Find ${task.category} in ${task.city}`, status: 'queued', input: { category: task.category, city: task.city, ...searchWishes(message) } });
      continue;
    }
    const wanted = String(task.leadName || '').replace(/[%_,()]/g, ' ').trim();
    const { data: matches } = await supabase.from('leads').select('id, business_name').ilike('business_name', `%${wanted}%`).limit(5);
    const exact = (matches || []).filter((row: any) => String(row.business_name).toLowerCase() === wanted.toLowerCase());
    const found = exact.length === 1 ? exact : matches || [];
    if (found.length !== 1) {
      problems.push(found.length ? `I found ${found.length} leads matching "${wanted}" (${found.map((row: any) => row.business_name).join(', ')}). Tell me which one and I will ask for the demo.` : `I could not find a saved lead called "${wanted}", so no demo task was created.`);
      continue;
    }
    const level = task.level || 'mid';
    rows.push({ agent_key: 'demo-creation', title: `Build ${LEVEL_NAMES[level]} demo for ${found[0].business_name}`, status: 'waiting_approval', lead_id: found[0].id, input: { leadId: found[0].id, level } });
  }

  if (problems.length) reply = rows.length ? `${reply} ${problems.join(' ')}` : problems.join(' ');

  const now = new Date().toISOString();
  const { data: parent, error: parentError } = await supabase
    .from('agent_tasks')
    .insert({ agent_key: 'master', title: message.slice(0, 200), status: rows.length ? 'running' : 'done', requested_by: 'owner', input: { message }, output: { reply, source: plan.source }, attempts: 1, started_at: now, completed_at: rows.length ? null : now })
    .select('id')
    .single();
  if (parentError || !parent) {
    // Records are unavailable (for example the tables are missing): answer, but hand out nothing.
    return res.status(200).json({ success: true, data: { reply: rows.length ? `${reply} I could not record the tasks, so nothing was started. Check the AI Team page.` : reply, source: plan.source, aiError: plan.aiError, tasks: [] } });
  }

  let tasks: any[] = [];
  if (rows.length) {
    const { data: created, error } = await supabase
      .from('agent_tasks')
      .insert(rows.map((row) => ({ ...row, parent_task_id: parent.id, requested_by: 'master' })))
      .select('id, agent_key, title, status, lead_id');
    if (error || !created) return res.status(500).json({ success: false, error: error?.message || 'Could not create the tasks' });
    tasks = created;
    for (const task of created) {
      await note(supabase, 'master', 'handoff', `Asked ${nameOf(task.agent_key)} to: ${task.title}${task.status === 'waiting_approval' ? ' (waiting for your approval)' : ''}`, task.id, task.lead_id);
    }
  }
  return res.status(200).json({
    success: true,
    data: { reply, source: plan.source, aiError: plan.aiError, tasks: tasks.map((task) => ({ id: task.id, agentKey: task.agent_key, agentName: nameOf(task.agent_key), title: task.title, status: task.status })) },
  });
}

async function handleBatchDemos(supabase: any, res: VercelResponse, message: string, wish: { count: number; noWebsite: boolean; level: 'mid' | 'hybrid' | 'ultra' }) {
  let query = supabase.from('leads').select('id, business_name, lead_score, demo_status, website, notes').order('lead_score', { ascending: false }).limit(400);
  if (wish.noWebsite) query = query.is('website', null);
  const { data: leads } = await query;
  const { data: active } = await supabase.from('demo_jobs').select('lead_id').in('status', ['queued', 'generating']);
  const busy = new Set((active || []).map((row: any) => row.lead_id));
  // Only leads with no demo yet; the strongest first.
  // One demo per business name: a name saved twice (two branches, or the same business imported twice)
  // gets a single demo, and a name that already has a demo is not built again.
  // Leads the owner marked as different branches each count as their own business.
  const keyOf = (lead: any) => (keptApart(lead) ? `${nameKey(lead.business_name)}:${lead.id}` : nameKey(lead.business_name));
  const taken = new Set((leads || []).filter((lead: any) => busy.has(lead.id) || (lead.demo_status && lead.demo_status !== 'Not Started')).map(keyOf));
  let sameName = 0;
  const open = (leads || []).filter((lead: any) => {
    if (busy.has(lead.id) || (lead.demo_status && lead.demo_status !== 'Not Started')) return false;
    const key = keyOf(lead);
    if (key && taken.has(key)) { sameName += 1; return false; }
    if (key) taken.add(key);
    return true;
  });
  const picked = open.slice(0, wish.count);
  const now = new Date().toISOString();
  const say = async (reply: string, child: any | null) => {
    const { data: parent } = await supabase.from('agent_tasks').insert({ agent_key: 'master', title: message.slice(0, 200), status: child ? 'running' : 'done', requested_by: 'owner', input: { message }, output: { reply, source: 'rules' }, attempts: 1, started_at: now, completed_at: child ? null : now }).select('id').single();
    if (!parent || !child) return res.status(200).json({ success: true, data: { reply: child && !parent ? `${reply} I could not record the task, so nothing was started.` : reply, source: 'rules', tasks: [] } });
    const { data: created, error } = await supabase.from('agent_tasks').insert({ ...child, parent_task_id: parent.id, requested_by: 'master' }).select('id, agent_key, title, status').single();
    if (error || !created) return res.status(500).json({ success: false, error: error?.message || 'Could not create the task' });
    await note(supabase, 'master', 'handoff', `Asked ${nameOf('demo-creation')} to: ${created.title} (waiting for your approval)`, created.id);
    return res.status(200).json({ success: true, data: { reply, source: 'rules', tasks: [{ id: created.id, agentKey: created.agent_key, agentName: nameOf(created.agent_key), title: created.title, status: created.status }] } });
  };
  if (!picked.length) return await say(`I looked for leads${wish.noWebsite ? ' without a website' : ''} that have no demo yet and found none, so there is nothing to build.`, null);
  const names = picked.map((lead: any) => String(lead.business_name));
  const listed = names.slice(0, 3).join(', ') + (names.length > 3 ? ` and ${names.length - 3} more` : '');
  const more = open.length > picked.length ? ` ${open.length - picked.length} more are waiting after this batch.` : '';
  const capped = wish.count === MAX_BATCH && open.length > MAX_BATCH ? ` I keep a batch to ${MAX_BATCH} so the free AI limit is not used up at once.` : '';
  const reply = `I picked the ${picked.length} strongest ${picked.length === 1 ? 'lead' : 'leads'}${wish.noWebsite ? ' without a website' : ''} that have no demo yet: ${listed}. Approve once and the Demo Creation Agent builds them one after another; I will tell you when they are ready. Nothing is sent to anyone.${capped}${more}${sameName ? ` I left out ${sameName} ${sameName === 1 ? 'lead that shares its' : 'leads that share their'} business name with another lead, so no business gets two demos.` : ''}`;
  return await say(reply, {
    agent_key: 'demo-creation',
    title: `Build ${picked.length} ${LEVEL_NAMES[wish.level]} ${picked.length === 1 ? 'demo' : 'demos'} (one approval for all)`,
    status: 'waiting_approval',
    input: { batch: true, level: wish.level, leadIds: picked.map((lead: any) => lead.id), leadNames: names },
  });
}

const originOf = (req: VercelRequest) => {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return host ? `${/^(localhost|127\.)/.test(host) ? 'http' : 'https'}://${host}` : 'https://clientradarai.vercel.app';
};
const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

async function handleBatchOutreach(supabase: any, req: VercelRequest, res: VercelResponse, message: string, count: number) {
  const pick = await pickForOutreach(supabase, count);
  const now = new Date().toISOString();
  const aside = `${pick.noEmail ? ` ${pick.noEmail} ${plural(pick.noEmail, 'lead has', 'leads have')} a ready demo but no email address, so I left ${plural(pick.noEmail, 'it', 'them')} out.` : ''}`;
  if (!pick.leads.length) {
    const reply = `I found no lead to write to: I only draft for leads with a ready demo, an email address and no earlier contact.${aside}`;
    await supabase.from('agent_tasks').insert({ agent_key: 'master', title: message.slice(0, 200), status: 'done', requested_by: 'owner', input: { message }, output: { reply, source: 'rules' }, attempts: 1, started_at: now, completed_at: now });
    return res.status(200).json({ success: true, data: { reply, source: 'rules', tasks: [] } });
  }
  const written = await writeDrafts(pick.leads, originOf(req));
  const total = written.drafts.length;
  const title = `Send ${total} outreach ${plural(total, 'email', 'emails')} (one approval for all)`;
  const how = written.ai === total ? 'each with its own opening written by the AI' : written.ai ? `${written.ai} with an opening written by the AI, the rest with built-in wording` : 'with built-in wording (the AI was not available)';
  const reply = `The Outreach Agent wrote ${total} ${plural(total, 'draft', 'drafts')}, ${how}. Each one links to that lead's demo. Nothing has been sent: open the drafts, change or leave out any you like, then approve once and they go out.${aside}${pick.waiting ? ` ${pick.waiting} more are waiting after this batch.` : ''}${mailReady() ? '' : ' Note: email sending is not set up in Vercel yet, so sending would fail until the Brevo settings are added.'}`;
  const { data: parent } = await supabase.from('agent_tasks').insert({ agent_key: 'master', title: message.slice(0, 200), status: 'running', requested_by: 'owner', input: { message }, output: { reply, source: 'rules' }, attempts: 1, started_at: now }).select('id').single();
  const { data: created, error } = await supabase.from('agent_tasks').insert({ agent_key: 'outreach', title, status: 'waiting_approval', parent_task_id: parent?.id || null, requested_by: 'master', input: { outreach: true, leadIds: pick.leads.map((lead: any) => lead.id) }, output: { drafts: written.drafts, aiError: written.aiError, summary: `${total} ${plural(total, 'draft', 'drafts')} written; waiting for your approval.` } }).select('id, agent_key, title, status').single();
  if (error || !created) return res.status(500).json({ success: false, error: error?.message || 'Could not save the drafts' });
  await note(supabase, 'master', 'handoff', `Asked ${nameOf('outreach')} to write ${total} outreach ${plural(total, 'draft', 'drafts')} (waiting for your approval before anything is sent)`, created.id);
  await note(supabase, 'outreach', 'task_done', `Wrote ${total} outreach ${plural(total, 'draft', 'drafts')} (${written.ai} with AI openings). Nothing sent.`, created.id);
  return res.status(200).json({ success: true, data: { reply, source: 'rules', tasks: [{ id: created.id, agentKey: created.agent_key, agentName: nameOf(created.agent_key), title: created.title, status: created.status, link: `/outreach/drafts/${created.id}` }] } });
}

const outreachTask = async (supabase: any, taskId: string) => {
  const { data: task } = await supabase.from('agent_tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task || task.agent_key !== 'outreach') throw new Error('Outreach batch not found');
  return task;
};
const outreachView = (task: any) => ({ id: task.id, title: task.title, status: task.status, createdAt: task.created_at, mailReady: mailReady(), drafts: (Array.isArray(task.output?.drafts) ? task.output.drafts : []) as OutreachDraft[] });

// The ONE approval: saves the owner's edits and unlocks sending. Nothing is sent by this call.
async function approveOutreach(supabase: any, body: any) {
  if (body?.confirm !== true) return { status: 403, body: { success: false, error: 'Sending needs your approval' } };
  const task = await outreachTask(supabase, String(body?.taskId || ''));
  if (task.status !== 'waiting_approval') return { status: 409, body: { success: false, error: `This batch is already ${task.status}` } };
  if (!mailReady()) return { status: 400, body: { success: false, error: 'Email sending is not set up: the Brevo settings are missing in Vercel. Nothing was sent.' } };
  const drafts = applyEdits(outreachView(task).drafts, body?.drafts);
  const toSend = drafts.filter((draft) => draft.state === 'pending').length;
  if (!toSend) return { status: 400, body: { success: false, error: 'Every draft is left out, so there is nothing to send' } };
  const now = new Date().toISOString();
  const { data: claimed } = await supabase.from('agent_tasks').update({ status: 'running', attempts: (task.attempts || 0) + 1, started_at: now, updated_at: now, output: { ...task.output, drafts, summary: `Approved: ${toSend} to send.` } }).eq('id', task.id).eq('status', 'waiting_approval').select('id');
  if (!claimed?.length) return { status: 409, body: { success: false, error: 'This batch was already approved' } };
  await note(supabase, 'master', 'approved', `You approved sending ${toSend} outreach ${plural(toSend, 'email', 'emails')}`, task.id);
  return { status: 200, body: { success: true, data: outreachView({ ...task, status: 'running', output: { ...task.output, drafts } }) } };
}

async function sendOutreach(supabase: any, body: any) {
  const task = await outreachTask(supabase, String(body?.taskId || ''));
  if (task.status !== 'running') return { status: 403, body: { success: false, error: task.status === 'waiting_approval' ? 'This batch needs your approval first' : `This batch is already ${task.status}` } };
  const out = await sendOneDraft(supabase, task, String(body?.leadId || ''));
  if (out.draft.state === 'sent') await note(supabase, 'outreach', 'sent', `Sent the first email to ${out.draft.name}`, task.id, out.draft.leadId);
  if (out.finished) {
    await note(supabase, 'outreach', out.sent ? 'task_done' : 'task_failed', `Outreach batch finished: ${out.sent} sent${out.failed ? `, ${out.failed} failed` : ''}.`, task.id);
    await closeParent(supabase, task.parent_task_id);
  }
  return { status: 200, body: { success: true, data: out } };
}

// An approved batch becomes one queued task per lead. The app then runs them one at a time.
async function startBatch(supabase: any, task: any, res: VercelResponse) {
  const { data: claimed } = await supabase.from('agent_tasks').update({ status: 'running', attempts: 1, started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', task.id).eq('status', 'waiting_approval').select('id');
  if (!claimed?.length) return res.status(409).json({ success: false, error: 'This batch was already started' });
  const ids: string[] = Array.isArray(task.input?.leadIds) ? task.input.leadIds.slice(0, MAX_BATCH) : [];
  const names: string[] = Array.isArray(task.input?.leadNames) ? task.input.leadNames : [];
  const level = task.input?.level || 'mid';
  const { data: created, error } = await supabase.from('agent_tasks').insert(ids.map((leadId, index) => ({
    agent_key: 'demo-creation', title: `Build ${LEVEL_NAMES[level]} demo for ${names[index] || 'lead'}`, status: 'queued', lead_id: leadId,
    parent_task_id: task.parent_task_id, requested_by: 'master', input: { leadId, level, batchTaskId: task.id },
  }))).select('id, title');
  if (error || !created) {
    await supabase.from('agent_tasks').update({ status: 'failed', error: String(error?.message || 'Could not queue the demos').slice(0, 300), completed_at: new Date().toISOString() }).eq('id', task.id);
    return res.status(500).json({ success: false, error: error?.message || 'Could not queue the demos' });
  }
  const summary = `Approved. ${created.length} ${created.length === 1 ? 'demo is' : 'demos are'} queued and will build one after another. Keep ClientRadar open; you can use other pages meanwhile.`;
  const output = { batch: true, total: created.length, queue: created.map((row: any) => ({ id: row.id, title: row.title })), summary };
  await supabase.from('agent_tasks').update({ status: 'done', output, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', task.id);
  await note(supabase, 'master', 'approved', `You approved: ${task.title}`, task.id);
  return res.status(200).json({ success: true, data: { id: task.id, agentKey: task.agent_key, agentName: nameOf(task.agent_key), title: task.title, status: 'done', summary, output, error: null } });
}

async function handleRun(supabase: any, req: VercelRequest, res: VercelResponse) {
  const taskId = String(req.body?.taskId || '');
  if (!taskId) return res.status(400).json({ success: false, error: 'taskId is required' });
  const { data: task } = await supabase.from('agent_tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
  if (task.agent_key === 'outreach') return res.status(400).json({ success: false, error: 'Open the drafts to review and send them' });
  if (!canRun(task.agent_key)) return res.status(400).json({ success: false, error: 'This agent is not active yet' });
  if (task.status === 'waiting_approval' && req.body?.approve !== true) return res.status(403).json({ success: false, error: 'This task needs your approval first' });
  if (task.input?.batch && task.status === 'waiting_approval') return await startBatch(supabase, task, res);
  // A task stuck on "running" for over two minutes was interrupted and may be tried again.
  const stuck = task.status === 'running' && Date.now() - new Date(task.started_at || task.created_at).getTime() > 120000;
  if (!stuck && !['queued', 'waiting_approval', 'failed'].includes(task.status)) return res.status(409).json({ success: false, error: `This task is already ${task.status}` });
  if ((task.attempts || 0) >= MAX_ATTEMPTS) return res.status(409).json({ success: false, error: 'This task has been tried 3 times. Ask again to start a new one.' });

  // Claim the task; if another call claimed it first, stop.
  const { data: claimed } = await supabase.from('agent_tasks').update({ status: 'running', attempts: (task.attempts || 0) + 1, started_at: new Date().toISOString(), updated_at: new Date().toISOString(), error: null }).eq('id', taskId).eq('status', task.status).select('id');
  if (!claimed?.length) return res.status(409).json({ success: false, error: 'This task is already running' });
  if (task.status === 'waiting_approval') await note(supabase, 'master', 'approved', `You approved: ${task.title}`, taskId, task.lead_id);

  let result: { status: string; summary: string; output: any; error: string | null };
  try {
    const done = await runAgentTask(supabase, task);
    result = { status: 'done', summary: done.summary, output: { ...done.output, summary: done.summary }, error: null };
  } catch (error) {
    const message = (error instanceof Error ? error.message : 'The task failed').slice(0, 300);
    result = { status: 'failed', summary: `Could not finish "${task.title}": ${message}`, output: null, error: message };
  }
  await supabase.from('agent_tasks').update({ status: result.status, output: result.output, error: result.error, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', taskId);
  await note(supabase, task.agent_key, result.status === 'done' ? 'task_done' : 'task_failed', result.summary, taskId, task.lead_id);
  await closeParent(supabase, task.parent_task_id);
  return res.status(200).json({ success: true, data: { id: taskId, agentKey: task.agent_key, agentName: nameOf(task.agent_key), title: task.title, ...result } });
}

async function handleCancel(supabase: any, req: VercelRequest, res: VercelResponse) {
  const taskId = String(req.body?.taskId || '');
  const { data: cancelled } = await supabase.from('agent_tasks').update({ status: 'cancelled', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', taskId).in('status', ['queued', 'waiting_approval']).select('id, title, parent_task_id, lead_id');
  if (!cancelled?.length) return res.status(409).json({ success: false, error: 'This task can no longer be cancelled' });
  await note(supabase, 'master', 'cancelled', `You declined: ${cancelled[0].title}`, taskId, cancelled[0].lead_id);
  await closeParent(supabase, cancelled[0].parent_task_id);
  return res.status(200).json({ success: true, data: { id: taskId, status: 'cancelled' } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireUser(req, res))) return;
  if (req.method === 'POST') {
    try {
      const supabase = teamClient();
      if (!supabase) return res.status(500).json({ success: false, error: 'Missing Supabase environment variables' });
      const action = req.body?.action;
      if (action === 'chat') return await handleChat(supabase, req, res);
      if (action === 'run') return await handleRun(supabase, req, res);
      if (action === 'cancel') return await handleCancel(supabase, req, res);
      if (action === 'transcribe') {
        const audio = String(req.body?.audio || '');
        const mimeType = ['audio/wav', 'audio/mp3', 'audio/aac', 'audio/ogg', 'audio/flac'].includes(req.body?.mimeType) ? req.body.mimeType : 'audio/wav';
        if (audio.length < 2000) return res.status(400).json({ success: false, error: 'The recording was too short' });
        if (audio.length > 3_500_000) return res.status(413).json({ success: false, error: 'The recording was too long' });
        const text = await transcribeAudio(audio, mimeType);
        return res.status(200).json({ success: true, data: { text } });
      }
      if (action === 'extract' || action === 'import-update' || action === 'import-save') {
        const out = action === 'extract' ? await handleExtract(supabase, req.body) : action === 'import-update' ? await handleImportUpdate(supabase, req.body) : await handleImportSave(supabase, req.body);
        return res.status(out.status).json(out.json);
      }
      if (action === 'tracker-save' || action === 'tracker-delete') {
        const out = action === 'tracker-save' ? await saveTracker(supabase, req.body) : await deleteTracker(supabase, req.body);
        return res.status(out.status).json(out.json);
      }
      if (action === 'outreach-approve' || action === 'outreach-send') {
        const out = action === 'outreach-approve' ? await approveOutreach(supabase, req.body) : await sendOutreach(supabase, req.body);
        return res.status(out.status).json(out.body);
      }
      if (action === 'duplicate-separate') {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
        if (ids.length < 2) return res.status(400).json({ success: false, error: 'Choose the leads to keep apart' });
        const marked = await keepApart(supabase, ids);
        await note(supabase, 'records-upkeep', 'duplicate_separate', `You marked ${marked} leads with the same name as different businesses.`);
        return res.status(200).json({ success: true, data: { marked } });
      }
      if (action === 'duplicate-merge') {
        // Removing a lead needs the owner's explicit confirmation from the review screen.
        if (req.body?.confirm !== true) return res.status(403).json({ success: false, error: 'Merging needs your confirmation' });
        const merged = await mergeLeads(supabase, String(req.body?.keepId || ''), String(req.body?.removeId || ''));
        await note(supabase, 'records-upkeep', 'duplicate_merged', `You merged two records of ${merged.name}${merged.filled.length ? `; ${merged.filled.length} missing ${merged.filled.length === 1 ? 'detail was' : 'details were'} filled from the removed record` : ''}.`, null, String(req.body.keepId));
        return res.status(200).json({ success: true, data: merged });
      }
      if (action === 'demo-refresh-start') {
        // The owner said yes to the orb's offer: one queued update task per outdated demo.
        const found = await outdatedDemos(supabase, MAX_BATCH);
        if (!found.length) return res.status(200).json({ success: true, data: { queue: [] } });
        const title = `Update ${found.length} ${found.length === 1 ? 'demo' : 'demos'} with the new sections`;
        const { data: parent } = await supabase.from('agent_tasks').insert({ agent_key: 'master', title, status: 'running', requested_by: 'records-upkeep', input: { demos: found.length }, attempts: 1, started_at: new Date().toISOString() }).select('id').single();
        if (!parent) return res.status(500).json({ success: false, error: 'Could not record the task' });
        const { data: created, error } = await supabase.from('agent_tasks').insert(found.map((demo) => ({
          agent_key: 'demo-creation', title: `Update demo for ${demo.name}`, status: 'queued', lead_id: demo.leadId, parent_task_id: parent.id, requested_by: 'master', input: { refresh: true, jobId: demo.id },
        }))).select('id, title');
        if (error || !created) return res.status(500).json({ success: false, error: error?.message || 'Could not queue the updates' });
        await note(supabase, 'records-upkeep', 'handoff', `Found ${found.length} ${found.length === 1 ? 'demo' : 'demos'} built before the latest upgrade; you approved the update.`, parent.id);
        return res.status(200).json({ success: true, data: { queue: created.map((row: any) => ({ id: row.id, title: row.title })) } });
      }
      if (action === 'upkeep') {
        // The Records Upkeep Agent: one small batch per call; the app sends one summary at the end.
        if (req.body?.summary) {
          const n = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));
          const total = { placed: n(req.body.summary.placed), approximate: n(req.body.summary.approximate), notFound: n(req.body.summary.notFound), scanned: n(req.body.summary.scanned), emails: n(req.body.summary.emails), services: n(req.body.summary.services) };
          const summary = upkeepSummary(total);
          if (summary) await recordTask({ agentKey: 'records-upkeep', title: 'Bring lead records up to date', status: 'done', requestedBy: 'system', summary, output: total });
          return res.status(200).json({ success: true });
        }
        return res.status(200).json({ success: true, data: await runUpkeep(supabase) });
      }
      if (action === 'scan-site') {
        // After a bulk run the browser sends one summary so the activity log gets a single honest line.
        if (req.body?.summary) {
          const scanned = Math.max(0, Number(req.body.summary.scanned) || 0);
          const emails = Math.max(0, Number(req.body.summary.emails) || 0);
          if (scanned) await recordTask({ agentKey: 'lead-research', title: `Scan ${scanned} lead websites`, status: 'done', summary: `Scanned ${scanned} lead ${scanned === 1 ? 'website' : 'websites'} and found ${emails} ${emails === 1 ? 'email' : 'emails'}.`, output: { scanned, emails } });
          return res.status(200).json({ success: true });
        }
        const leadId = String(req.body?.leadId || '');
        if (!leadId) return res.status(400).json({ success: false, error: 'leadId is required' });
        const startedAt = new Date();
        const result = await scanLead(supabase, leadId);
        if (!result.ok) return res.status(200).json({ success: true, data: { read: false, reason: result.error } });
        const scan = result.scan;
        if (req.body?.quiet !== true) await recordTask({ agentKey: 'lead-research', title: `Scan the website of ${result.businessName}`, status: 'done', summary: `Scanned the website of ${result.businessName}: ${scan.emails.length ? `email ${scan.emails[0]}` : 'no email on the site'}${scan.accent ? `, brand colour ${scan.accent}` : ''}.`, leadId, output: { filled: result.filled, emails: scan.emails, accent: scan.accent }, startedAt });
        return res.status(200).json({ success: true, data: { read: true, filled: result.filled, emails: scan.emails, phones: scan.phones, accent: scan.accent, colors: scan.colors, darkDesign: scan.darkDesign, fonts: scan.fonts, platform: scan.platform, mobileReady: scan.mobileReady, pagesRead: scan.pagesRead } });
      }
      return res.status(400).json({ success: false, error: 'Unknown action' });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message.slice(0, 200) : 'Team error' });
    }
  }
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  if (req.query?.view === 'outreach-drafts') {
    const supabase = teamClient();
    if (!supabase) return res.status(500).json({ success: false, error: 'Missing Supabase environment variables' });
    try { return res.status(200).json({ success: true, data: outreachView(await outreachTask(supabase, String(req.query?.taskId || ''))) }); } catch (error) { return res.status(404).json({ success: false, error: error instanceof Error ? error.message : 'Not found' }); }
  }
  if (req.query?.view === 'duplicates') {
    const supabase = teamClient();
    if (!supabase) return res.status(500).json({ success: false, error: 'Missing Supabase environment variables' });
    return res.status(200).json({ success: true, data: await listDuplicates(supabase) });
  }
  if (req.query?.view === 'demo-updates') {
    // Records Upkeep Agent check: finished demos that were built before new sections existed.
    const supabase = teamClient();
    if (!supabase) return res.status(500).json({ success: false, error: 'Missing Supabase environment variables' });
    const found = await outdatedDemos(supabase, MAX_BATCH);
    // Business names saved more than once, so the owner can review them.
    const repeated = await listDuplicates(supabase);
    return res.status(200).json({ success: true, data: { outreach: await outreachReady(supabase).catch(() => ({ ready: 0, noEmail: 0 })), duplicates: { names: repeated.length, example: repeated[0]?.name || '', leads: repeated.reduce((sum, entry) => sum + entry.leads.length, 0), likelySame: repeated.filter((entry) => entry.hint === 'same').length }, count: found.length, names: found.slice(0, 3).map((demo) => demo.name), sections: Array.from(new Set(found.flatMap((demo) => demo.missing))) } });
  }
  if (req.query?.view === 'tracker') {
    const supabase = teamClient();
    if (!supabase) return res.status(500).json({ success: false, error: 'Missing Supabase environment variables' });
    const out = await listTracker(supabase);
    return res.status(out.status).json(out.json);
  }

  if (req.query?.view === 'imports') {
    try {
      const supabase = teamClient();
      if (!supabase) return res.status(500).json({ success: false, error: 'Missing Supabase environment variables' });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ success: true, data: await listPendingImports(supabase) });
    } catch {
      return res.status(200).json({ success: true, data: { ready: false, records: [] } });
    }
  }

  if (req.query?.view === 'chat') {
    try {
      const supabase = teamClient();
      if (!supabase) return res.status(500).json({ success: false, error: 'Missing Supabase environment variables' });
      const { data: parents, error } = await supabase.from('agent_tasks').select('id, title, input, output, created_at').eq('agent_key', 'master').eq('requested_by', 'owner').order('created_at', { ascending: false }).limit(20);
      if (error) return res.status(200).json({ success: true, data: { turns: [] } });
      const ids = (parents || []).map((row: any) => row.id);
      const { data: children } = ids.length
        ? await supabase.from('agent_tasks').select('id, parent_task_id, agent_key, title, status, output, error, created_at').in('parent_task_id', ids).order('created_at', { ascending: true })
        : { data: [] as any[] };
      const turns = (parents || []).reverse().map((row: any) => ({
        id: row.id,
        createdAt: row.created_at,
        message: String(row.input?.message || row.title || ''),
        reply: String(row.output?.reply || ''),
        tasks: (children || []).filter((child: any) => child.parent_task_id === row.id).map((child: any) => ({
          id: child.id,
          agentKey: child.agent_key,
          agentName: nameOf(child.agent_key),
          title: child.title,
          // A task left "running" for over two minutes was interrupted; show it as failed so it can be retried.
          // An outreach batch stays "running" while its emails go out, so it is shown as it is.
          status: child.agent_key !== 'outreach' && child.status === 'running' && Date.now() - new Date(child.created_at).getTime() > 120000 ? 'failed' : child.status,
          link: child.agent_key === 'outreach' ? `/outreach/drafts/${child.id}` : undefined,
          summary: child.output?.summary || (child.error ? `Could not finish "${child.title}": ${child.error}` : ''),
          error: child.error,
          output: child.agent_key === 'outreach' ? { summary: child.output?.summary } : child.output,
        })),
      }));
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ success: true, data: { turns } });
    } catch {
      return res.status(200).json({ success: true, data: { turns: [] } });
    }
  }

  const empty = { agents: AGENTS.map((agent) => ({ ...agent, done: 0, failed: 0, lastSummary: null, lastAt: null })), tasks: [], activity: [] };
  try {
    const supabase = teamClient();
    if (!supabase) return res.status(500).json({ success: false, error: 'Missing Supabase environment variables' });

    const [tasksResult, activityResult, countsResult] = await Promise.all([
      supabase.from('agent_tasks').select('id, agent_key, title, status, requested_by, lead_id, error, created_at, completed_at, started_at, leads(business_name)').order('created_at', { ascending: false }).limit(30),
      supabase.from('agent_activity').select('id, agent_key, task_id, lead_id, kind, summary, created_at').order('created_at', { ascending: false }).limit(60),
      supabase.from('agent_tasks').select('agent_key, status').order('created_at', { ascending: false }).limit(1000),
    ]);

    const failure = tasksResult.error || activityResult.error || countsResult.error;
    if (failure) {
      const missing = ['PGRST205', '42P01'].includes(String((failure as any).code)) || /agent_(tasks|activity)/i.test(String(failure.message || ''));
      return res.status(200).json({ success: true, ready: false, setup: missing ? 'tables-missing' : 'error', detail: String(failure.message || '').slice(0, 200), data: empty });
    }

    const activity = activityResult.data || [];
    const agents = AGENTS.map((agent) => {
      const own = (countsResult.data || []).filter((row: any) => row.agent_key === agent.key);
      const last = activity.find((row: any) => row.agent_key === agent.key) as any;
      return {
        ...agent,
        done: own.filter((row: any) => row.status === 'done').length,
        failed: own.filter((row: any) => row.status === 'failed').length,
        lastSummary: last?.summary || null,
        lastAt: last?.created_at || null,
      };
    });
    const tasks = (tasksResult.data || []).map((row: any) => ({
      id: row.id,
      agentKey: row.agent_key,
      title: row.title,
      status: row.status,
      requestedBy: row.requested_by,
      leadId: row.lead_id,
      leadName: (Array.isArray(row.leads) ? row.leads[0] : row.leads)?.business_name || null,
      error: row.error,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      ready: true,
      data: { agents, tasks, activity: activity.map((row: any) => ({ id: row.id, agentKey: row.agent_key, kind: row.kind, summary: row.summary, createdAt: row.created_at })) },
    });
  } catch (error) {
    return res.status(200).json({ success: true, ready: false, setup: 'error', detail: error instanceof Error ? error.message.slice(0, 200) : 'Unknown error', data: empty });
  }
}
