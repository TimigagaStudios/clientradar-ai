import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, requireOwner } from './lib/auth.js';
import { AGENTS, recordTask, teamClient } from './lib/_team.js';
import { planRequest, transcribeAudio, searchWishes, batchDemoWish, briefingFor, MAX_BATCH } from './lib/_master.js';
import { runUpkeep, upkeepSummary } from './lib/_upkeep.js';
import { outdatedDemos } from './lib/demo-job-process.js';
import { keepApart, keptApart, listDuplicates, mergeLeads, nameKey } from './lib/_duplicates.js';
import { listReplies, replyNews, replySenders, resolveReplySend, secretOk, sendReplyAnswer, setReplyStatus, skipReplyDraft, takeInReplies } from './lib/_replies.js';
import { pushConfigured, pushPublicKey, saveSubscription, deleteSubscription, sendPush, vapidProblem } from './lib/_push.js';
import { applyEdits, batchOutreachWish, mailReady, outreachReady, pickForOutreach, retryFailed, sendOneDraft, writeDrafts, type OutreachDraft } from './lib/_outreach.js';
import { followUpReady, followUpWish, pickForFollowUp, sendOneFollowUp, writeFollowUps } from './lib/_followup.js';
import { billsLine, deleteTracker, listTracker, saveTracker } from './lib/_tracker.js';
import type { MasterContext } from './lib/_master.js';
import { canRun, runAgentTask } from './lib/_agents.js';
import { isOfficialWebsiteUrl, isValidContactEmail, isValidContactPhone, scanLead, scanWebsite, scanSummary } from './lib/_website.js';
import { handleExtract, handleImportSave, handleImportUpdate, listPendingImports } from './lib/_screenshots.js';
import { ensureMailRecoveryReady } from './lib/_mail-recovery.js';
import { QaReviewNeeded, batchApprovalDigest, qaReviewResponse, reviewOutreachDemos } from './lib/_qa-outreach.js';

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
  // Read every lead in bounded pages so email totals stay accurate beyond the API's default row cap.
  const pageSize = 1000;
  const rows: any[] = [];
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase.from('leads').select('business_name, status, demo_status, email, phone')
      .order('created_at', { ascending: false }).order('id', { ascending: true }).range(start, start + pageSize - 1);
    if (error) throw new Error(`Could not read leads for Master totals: ${error.message || 'database query failed'}`);
    const page: any[] = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  const { data: activity, error: activityError } = await supabase.from('agent_activity').select('agent_key, summary')
    .order('created_at', { ascending: false }).limit(8);
  if (activityError) console.warn('Could not read recent agent activity:', activityError.message || activityError);
  const count = (test: (row: any) => boolean) => rows.filter(test).length;
  return {
    totals: {
      leads: rows.length,
      new: count((row) => row.status === 'New'),
      pendingReply: count((row) => row.status === 'Pending Reply'),
      warm: count((row) => row.status === 'Interested' || row.status === 'Negotiating'),
      closed: count((row) => row.status === 'Deal Closed'),
      demosReady: count((row) => row.demo_status === 'Ready'),
      withEmail: count((row) => isValidContactEmail(row.email)),
      withoutEmail: count((row) => !isValidContactEmail(row.email)),
      withBothContacts: count((row) => isValidContactEmail(row.email) && isValidContactPhone(row.phone)),
      readyNoEmail: count((row) => row.demo_status === 'Ready' && !isValidContactEmail(row.email)),
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
  const followUp = followUpWish(message);
  if (followUp) return await handleFollowUp(supabase, req, res, message, followUp.count);
  const mail = batchOutreachWish(message);
  if (mail) return await handleBatchOutreach(supabase, req, res, message, mail.count);
  const batch = batchDemoWish(message);
  if (batch) return await handleBatchDemos(supabase, res, message, batch);

  const context = await masterContext(supabase);
  const plan = await planRequest(message, history, context);
  let reply = plan.reply;

  // The Master Agent understood an outreach or follow-up request in the owner's own words.
  const mailTask = plan.tasks.find((task) => task.agent === 'outreach');
  if (mailTask) {
    return mailTask.kind === 'followup'
      ? await handleFollowUp(supabase, req, res, message, mailTask.count || 25)
      : await handleBatchOutreach(supabase, req, res, message, mailTask.count || 25);
  }

  // Turn the plan into task rows. Every Master-handed task waits for owner approval before running.
  const rows: any[] = [];
  const problems: string[] = [];
  for (const task of plan.tasks) {
    if (task.agent === 'lead-research') {
      rows.push({ agent_key: 'lead-research', title: `Find ${task.category} in ${task.city}`, status: 'waiting_approval', input: { category: task.category, city: task.city, ...searchWishes(message) } });
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
    const level = task.level || 'ultra';
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
    data: { reply, source: plan.source, aiError: plan.aiError, tasks: tasks.map((task) => ({ id: task.id, agentKey: task.agent_key, agentName: nameOf(task.agent_key), title: task.title, status: task.status, minorEligible: rows.length === 1 && rows[0].agent_key === 'lead-research' && !rows[0].input?.noWebsite && Number(rows[0].input?.count || 8) <= 10 })) },
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
  await sendPush(supabase, { title: 'ClientRadar', body: `${total} outreach ${plural(total, 'draft', 'drafts')} written. Open to read and approve once.`, url: `/outreach/drafts/${created.id}`, tag: 'drafts' });
  return res.status(200).json({ success: true, data: { reply, source: 'rules', tasks: [{ id: created.id, agentKey: created.agent_key, agentName: nameOf(created.agent_key), title: created.title, status: created.status, link: `/outreach/drafts/${created.id}` }] } });
}

const outreachTask = async (supabase: any, taskId: string) => {
  const { data: task } = await supabase.from('agent_tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task || task.agent_key !== 'outreach') throw new Error('Outreach batch not found');
  return task;
};
const hasBatchApproval = (task: any) => {
  const drafts = Array.isArray(task.output?.drafts) ? task.output.drafts : [];
  const approval = task.output?.ownerApproval;
  return Boolean(approval && Array.isArray(approval.leadIds) && approval.digest === batchApprovalDigest(drafts));
};
const outreachView = (task: any) => ({ id: task.id, title: task.title, status: task.status, createdAt: task.created_at, mailReady: mailReady(), approvalValid: hasBatchApproval(task), drafts: (Array.isArray(task.output?.drafts) ? task.output.drafts : []) as OutreachDraft[] });

// Older in-progress batches predate approval digests. They may be reviewed and
// explicitly reapproved, but this action never sends an email.
async function reapproveBatch(supabase: any, body: any, followUp: boolean) {
  if (body?.confirm !== true) return { status: 403, body: { success: false, error: 'Reapproval needs your confirmation.' } };
  const task = followUp ? await followUpTask(supabase, String(body?.taskId || '')) : await outreachTask(supabase, String(body?.taskId || ''));
  if (!['running', 'done', 'failed'].includes(task.status)) return { status: 409, body: { success: false, error: 'This batch cannot be reapproved.' } };
  const drafts = Array.isArray(task.output?.drafts) ? task.output.drafts as OutreachDraft[] : [];
  if (drafts.some((draft) => draft.state === 'sending' || draft.state === 'unknown')) return { status: 409, body: { success: false, error: 'Check the uncertain send in Brevo before reapproving.' } };
  const leadIds = drafts.filter((draft) => draft.state === 'pending' || draft.state === 'failed').map((draft) => draft.leadId);
  if (!leadIds.length) return { status: 400, body: { success: false, error: 'There are no unsent drafts to approve.' } };
  const ownerApproval = { digest: batchApprovalDigest(drafts), leadIds, at: new Date().toISOString() };
  const output = { ...task.output, ownerApproval };
  const { data, error } = await supabase.from('agent_tasks').update({ output }).eq('id', task.id).eq('status', task.status).eq('output', JSON.stringify(task.output)).select('id');
  if (error) return { status: 500, body: { success: false, error: error.message } };
  if (!data?.length) return { status: 409, body: { success: false, error: 'Batch changed. Reload and review it again.' } };
  await note(supabase, 'master', 'approved', 'You reapproved the reviewed unsent batch', task.id);
  return { status: 200, body: { success: true, data: followUp ? followUpView({ ...task, output }) : outreachView({ ...task, output }) } };
}

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
  const { data: claimed } = await supabase.from('agent_tasks').update({ status: 'running', attempts: (task.attempts || 0) + 1, started_at: now, updated_at: now, output: { ...task.output, drafts, ownerApproval: { digest: batchApprovalDigest(drafts), leadIds: drafts.filter((draft) => draft.state === 'pending').map((draft) => draft.leadId), at: now }, summary: `Approved: ${toSend} to send.` } }).eq('id', task.id).eq('status', 'waiting_approval').eq('output', JSON.stringify(task.output)).select('id');
  if (!claimed?.length) return { status: 409, body: { success: false, error: 'This batch was already approved' } };
  await note(supabase, 'master', 'approved', `You approved sending ${toSend} outreach ${plural(toSend, 'email', 'emails')}`, task.id);
  return { status: 200, body: { success: true, data: outreachView({ ...task, status: 'running', output: { ...task.output, drafts, ownerApproval: { digest: batchApprovalDigest(drafts), leadIds: drafts.filter((draft) => draft.state === 'pending').map((draft) => draft.leadId), at: now } } }) } };
}

async function retryOutreach(supabase: any, body: any) {
  const task = await outreachTask(supabase, String(body?.taskId || ''));
  if (!hasBatchApproval(task)) return { status: 403, body: { success: false, error: 'This batch needs a fresh owner approval before sending.' } };
  if (!['failed', 'done', 'running'].includes(task.status)) return { status: 403, body: { success: false, error: 'This batch was never approved' } };
  if (outreachView(task).drafts.some((draft) => draft.state === 'sending' || draft.state === 'unknown')) return { status: 409, body: { success: false, error: 'Check the uncertain send in Brevo before retrying.' } };
  if (!outreachView(task).drafts.some((draft) => draft.state === 'failed')) return { status: 400, body: { success: false, error: 'No unsent email to try again' } };
  const drafts = await retryFailed(supabase, task);
  await note(supabase, 'master', 'approved', 'You asked to try the unsent outreach emails again', task.id);
  return { status: 200, body: { success: true, data: outreachView({ ...task, status: 'running', output: { ...task.output, drafts } }) } };
}

async function claimBatchDraft(supabase: any, task: any, leadId: string, proofs: unknown[]) {
  const drafts = Array.isArray(task.output?.drafts) ? task.output.drafts as OutreachDraft[] : [];
  if (drafts.some((item) => item.state === 'sending' || item.state === 'unknown')) throw new Error('A send is in progress or uncertain. Check Brevo before continuing.');
  const selected = drafts.find((item) => item.leadId === leadId);
  if (!selected || selected.state !== 'pending') throw new Error('This draft is not pending.');
  const { data, error } = await supabase.rpc('cr_claim_batch_send', { p_task_id: task.id, p_lead_id: leadId, p_expected_output: task.output, p_demo_proofs: proofs });
  if (error || !data?.output) throw new Error('Batch changed or this lead already has a send in progress. Check other batches and Brevo before continuing.');
  return { ...task, output: data.output };
}

async function resolveUncertainSend(supabase: any, body: any, followUp: boolean) {
  if (body?.confirm !== true || !['accepted', 'not_sent'].includes(body?.resolution)) return { status: 403, body: { success: false, error: 'Confirm the provider result first.' } };
  const task = followUp ? await followUpTask(supabase, String(body?.taskId || '')) : await outreachTask(supabase, String(body?.taskId || ''));
  if (task.status !== 'running' || !hasBatchApproval(task)) return { status: 403, body: { success: false, error: 'The approved batch is not available.' } };
  const drafts = Array.isArray(task.output?.drafts) ? task.output.drafts as OutreachDraft[] : [];
  const found = drafts.find((draft) => draft.leadId === String(body?.leadId || ''));
  if (!found || !['sending', 'unknown'].includes(found.state)) return { status: 409, body: { success: false, error: 'This send does not need resolution.' } };
  if (found.state === 'sending' && (!found.sendStartedAt || !Number.isFinite(Date.parse(found.sendStartedAt)) || Date.now() - Date.parse(found.sendStartedAt) < 120000)) return { status: 409, body: { success: false, error: 'This send may still be running. Wait and check Brevo.' } };
  const { data, error } = await supabase.rpc('cr_resolve_batch_send', { p_task_id: task.id, p_lead_id: found.leadId, p_expected_output: task.output, p_resolution: body.resolution });
  if (error || !data?.output || !data?.status) return { status: 409, body: { success: false, error: 'Could not record the provider result atomically. Keep this batch paused and check the database setup.' } };
  const updated = { ...task, output: data.output, status: data.status };
  await note(supabase, 'master', 'approved', `Owner recorded provider result for ${found.name}: ${body.resolution}`, task.id, found.leadId);
  if (data.status !== 'running') await closeParent(supabase, task.parent_task_id);
  return { status: 200, body: { success: true, data: followUp ? followUpView(updated) : outreachView(updated) } };
}

async function sendOutreach(supabase: any, body: any, origin: string) {
  const task = await outreachTask(supabase, String(body?.taskId || ''));
  if (!hasBatchApproval(task)) return { status: 403, body: { success: false, error: 'This batch needs a fresh owner approval before sending.' } };
  if (task.status !== 'running') return { status: 403, body: { success: false, error: task.status === 'waiting_approval' ? 'This batch needs your approval first' : `This batch is already ${task.status}` } };
  const draft = outreachView(task).drafts.find((item) => item.leadId === String(body?.leadId || ''));
  if (!draft) return { status: 404, body: { success: false, error: 'Draft not found.' } };
  if (!task.output.ownerApproval.leadIds.includes(draft.leadId)) return { status: 403, body: { success: false, error: 'This email was not included in the approved batch.' } };
  if (draft.state !== 'pending') return { status: 409, body: { success: false, error: 'This draft is not pending. Check its current status.' } };
  const review = await reviewOutreachDemos(supabase, draft.subject, draft.body, origin);
  if (review.required && (body?.qaOverride !== true || body?.qaToken !== review.token || body?.confirm !== true)) return { status: 409, body: qaReviewResponse(review) };
  await ensureMailRecoveryReady(supabase);
  const claimed = await claimBatchDraft(supabase, task, draft.leadId, review.proofs);
  const out = await sendOneDraft(supabase, claimed, draft.leadId);
  if (out.draft.state === 'sent') await note(supabase, 'outreach', 'sent', `Sent the first email to ${out.draft.name}`, task.id, out.draft.leadId);
  if (out.finished) {
    await note(supabase, 'outreach', out.sent ? 'task_done' : 'task_failed', `Outreach batch finished: ${out.sent} sent${out.failed ? `, ${out.failed} failed` : ''}.`, task.id);
    await closeParent(supabase, task.parent_task_id);
  }
  return { status: 200, body: { success: true, data: out } };
}


async function handleFollowUp(supabase: any, req: VercelRequest, res: VercelResponse, message: string, count: number) {
  const pick = await pickForFollowUp(supabase, count);
  const now = new Date().toISOString();
  if (!pick.leads.length) {
    const reply = 'I found no lead to follow up with: I only follow up with businesses written to at least 3 days ago that have not replied and have not been followed up yet.';
    await supabase.from('agent_tasks').insert({ agent_key: 'master', title: message.slice(0, 200), status: 'done', requested_by: 'owner', input: { message }, output: { reply, source: 'rules' }, attempts: 1, started_at: now, completed_at: now });
    return res.status(200).json({ success: true, data: { reply, source: 'rules', tasks: [] } });
  }
  const written = await writeFollowUps(pick.leads, originOf(req));
  const total = written.drafts.length;
  const title = `Send ${total} follow-up ${plural(total, 'email', 'emails')} (one approval for all)`;
  const how = written.ai === total ? 'each with its own opening written by the AI' : written.ai ? `${written.ai} with an opening written by the AI, the rest with built-in wording` : 'with built-in wording (the AI was not available)';
  const reply = `The Outreach Agent wrote ${total} follow-up ${plural(total, 'draft', 'drafts')}, ${how}. Each one is a polite second email to a business that has not replied. Nothing has been sent: open the drafts, change or leave out any you like, then approve once and they go out.${pick.waiting ? ` ${pick.waiting} more are waiting after this batch.` : ''}${mailReady() ? '' : ' Note: email sending is not set up in Vercel yet, so sending would fail until the Brevo settings are added.'}`;
  const { data: parent } = await supabase.from('agent_tasks').insert({ agent_key: 'master', title: message.slice(0, 200), status: 'running', requested_by: 'owner', input: { message }, output: { reply, source: 'rules' }, attempts: 1, started_at: now }).select('id').single();
  const { data: created, error } = await supabase.from('agent_tasks').insert({ agent_key: 'outreach', title, status: 'waiting_approval', parent_task_id: parent?.id || null, requested_by: 'master', input: { outreach: true, followUp: true, leadIds: pick.leads.map((lead: any) => lead.id) }, output: { drafts: written.drafts, aiError: written.aiError, summary: `${total} follow-up ${plural(total, 'draft', 'drafts')} written; waiting for your approval.` } }).select('id, agent_key, title, status').single();
  if (error || !created) return res.status(500).json({ success: false, error: error?.message || 'Could not save the drafts' });
  await note(supabase, 'master', 'handoff', `Asked ${nameOf('outreach')} to write ${total} follow-up ${plural(total, 'draft', 'drafts')} (waiting for your approval before anything is sent)`, created.id);
  await note(supabase, 'outreach', 'task_done', `Wrote ${total} follow-up ${plural(total, 'draft', 'drafts')} (${written.ai} with AI openings). Nothing sent.`, created.id);
  await sendPush(supabase, { title: 'ClientRadar', body: `${total} follow-up ${plural(total, 'draft', 'drafts')} written. Open to read and approve once.`, url: `/outreach/follow-ups/${created.id}`, tag: 'drafts' });
  return res.status(200).json({ success: true, data: { reply, source: 'rules', tasks: [{ id: created.id, agentKey: created.agent_key, agentName: nameOf(created.agent_key), title: created.title, status: created.status, link: `/outreach/follow-ups/${created.id}` }] } });
}

const followUpTask = async (supabase: any, taskId: string) => {
  const { data: task } = await supabase.from('agent_tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task || task.agent_key !== 'outreach' || !task.input?.followUp) throw new Error('Follow-up batch not found');
  return task;
};
const followUpView = (task: any) => ({ id: task.id, title: task.title, status: task.status, createdAt: task.created_at, mailReady: mailReady(), approvalValid: hasBatchApproval(task), drafts: (Array.isArray(task.output?.drafts) ? task.output.drafts : []) as OutreachDraft[] });

async function approveFollowUp(supabase: any, body: any) {
  if (body?.confirm !== true) return { status: 403, body: { success: false, error: 'Sending needs your approval' } };
  const task = await followUpTask(supabase, String(body?.taskId || ''));
  if (task.status !== 'waiting_approval') return { status: 409, body: { success: false, error: `This batch is already ${task.status}` } };
  if (!mailReady()) return { status: 400, body: { success: false, error: 'Email sending is not set up: the Brevo settings are missing in Vercel. Nothing was sent.' } };
  const drafts = applyEdits(followUpView(task).drafts, body?.drafts);
  const toSend = drafts.filter((draft) => draft.state === 'pending').length;
  if (!toSend) return { status: 400, body: { success: false, error: 'Every draft is left out, so there is nothing to send' } };
  const now = new Date().toISOString();
  const { data: claimed } = await supabase.from('agent_tasks').update({ status: 'running', attempts: (task.attempts || 0) + 1, started_at: now, updated_at: now, output: { ...task.output, drafts, ownerApproval: { digest: batchApprovalDigest(drafts), leadIds: drafts.filter((draft) => draft.state === 'pending').map((draft) => draft.leadId), at: now }, summary: `Approved: ${toSend} to send.` } }).eq('id', task.id).eq('status', 'waiting_approval').eq('output', JSON.stringify(task.output)).select('id');
  if (!claimed?.length) return { status: 409, body: { success: false, error: 'This batch was already approved' } };
  await note(supabase, 'master', 'approved', `You approved sending ${toSend} follow-up ${plural(toSend, 'email', 'emails')}`, task.id);
  return { status: 200, body: { success: true, data: followUpView({ ...task, status: 'running', output: { ...task.output, drafts, ownerApproval: { digest: batchApprovalDigest(drafts), leadIds: drafts.filter((draft) => draft.state === 'pending').map((draft) => draft.leadId), at: now } } }) } };
}

async function retryFollowUp(supabase: any, body: any) {
  const task = await followUpTask(supabase, String(body?.taskId || ''));
  if (!hasBatchApproval(task)) return { status: 403, body: { success: false, error: 'This batch needs a fresh owner approval before sending.' } };
  if (!['failed', 'done', 'running'].includes(task.status)) return { status: 403, body: { success: false, error: 'This batch was never approved' } };
  if (followUpView(task).drafts.some((draft) => draft.state === 'sending' || draft.state === 'unknown')) return { status: 409, body: { success: false, error: 'Check the uncertain send in Brevo before retrying.' } };
  if (!followUpView(task).drafts.some((draft) => draft.state === 'failed')) return { status: 400, body: { success: false, error: 'No unsent email to try again' } };
  const drafts = await retryFailed(supabase, task);
  await note(supabase, 'master', 'approved', 'You asked to try the unsent follow-up emails again', task.id);
  return { status: 200, body: { success: true, data: followUpView({ ...task, status: 'running', output: { ...task.output, drafts } }) } };
}

async function sendFollowUp(supabase: any, body: any, origin: string) {
  const task = await followUpTask(supabase, String(body?.taskId || ''));
  if (!hasBatchApproval(task)) return { status: 403, body: { success: false, error: 'This batch needs a fresh owner approval before sending.' } };
  if (task.status !== 'running') return { status: 403, body: { success: false, error: task.status === 'waiting_approval' ? 'This batch needs your approval first' : `This batch is already ${task.status}` } };
  const draft = followUpView(task).drafts.find((item) => item.leadId === String(body?.leadId || ''));
  if (!draft) return { status: 404, body: { success: false, error: 'Draft not found.' } };
  if (!task.output.ownerApproval.leadIds.includes(draft.leadId)) return { status: 403, body: { success: false, error: 'This email was not included in the approved batch.' } };
  if (draft.state !== 'pending') return { status: 409, body: { success: false, error: 'This draft is not pending. Check its current status.' } };
  const review = await reviewOutreachDemos(supabase, draft.subject, draft.body, origin);
  if (review.required && (body?.qaOverride !== true || body?.qaToken !== review.token || body?.confirm !== true)) return { status: 409, body: qaReviewResponse(review) };
  await ensureMailRecoveryReady(supabase);
  const claimed = await claimBatchDraft(supabase, task, draft.leadId, review.proofs);
  const out = await sendOneFollowUp(supabase, claimed, draft.leadId);
  if (out.draft.state === 'sent') await note(supabase, 'outreach', 'sent', `Sent a follow-up to ${out.draft.name}`, task.id, out.draft.leadId);
  if (out.finished) {
    await note(supabase, 'outreach', out.sent ? 'task_done' : 'task_failed', `Follow-up batch finished: ${out.sent} sent${out.failed ? `, ${out.failed} failed` : ''}.`, task.id);
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
  const level = task.input?.level || 'ultra';
  const { data: created, error } = await supabase.from('agent_tasks').insert(ids.map((leadId, index) => ({
    agent_key: 'demo-creation', title: `Build ${LEVEL_NAMES[level]} demo for ${names[index] || 'lead'}`, status: 'queued', lead_id: leadId,
    parent_task_id: task.parent_task_id, requested_by: 'master', input: { leadId, level, batchTaskId: task.id },
  }))).select('id, title');
  if (error || !created) {
    await supabase.from('agent_tasks').update({ status: 'failed', error: String(error?.message || 'Could not queue the demos').slice(0, 300), completed_at: new Date().toISOString() }).eq('id', task.id);
    return res.status(500).json({ success: false, error: error?.message || 'Could not queue the demos' });
  }
  const summary = `Approved. ${created.length} ${LEVEL_NAMES[level]} ${created.length === 1 ? 'demo is' : 'demos are'} queued and will build one after another. Keep ClientRadar open; you can use other pages meanwhile.`;
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
  if ((task.agent_key === 'demo-creation' || req.body?.autoMinor === true) && !(await requireOwner(req, res))) return;
  if (process.env.API_AUTH_DISABLED === 'true' && task.agent_key === 'demo-creation') return res.status(403).json({ success: false, error: 'Demo work is unavailable while API authentication is disabled.' });
  if (task.agent_key === 'outreach') return res.status(400).json({ success: false, error: 'Open the drafts to review and send them' });
  if (!canRun(task.agent_key)) return res.status(400).json({ success: false, error: 'This agent is not active yet' });
  // Auto-accept is deliberately narrow: only a single small ordinary research task.
  // The authenticated owner opts in on this request; all other task types fail closed.
  const autoMinor = req.body?.autoMinor === true && task.agent_key === 'lead-research'
    && task.requested_by === 'master' && !task.input?.batch && !task.input?.noWebsite
    && Number(task.input?.count || 8) >= 1 && Number(task.input?.count || 8) <= 10;
  if (task.status === 'waiting_approval' && req.body?.approve !== true && !autoMinor) return res.status(403).json({ success: false, error: 'This task needs your approval first' });
  if (task.input?.batch && task.status === 'waiting_approval') return await startBatch(supabase, task, res);
  // A task stuck on "running" for over two minutes was interrupted and may be tried again.
  const stuck = task.status === 'running' && Date.now() - new Date(task.started_at || task.created_at).getTime() > 120000;
  if (!stuck && !['queued', 'waiting_approval', 'failed'].includes(task.status)) return res.status(409).json({ success: false, error: `This task is already ${task.status}` });
  if ((task.attempts || 0) >= MAX_ATTEMPTS) return res.status(409).json({ success: false, error: 'This task has been tried 3 times. Ask again to start a new one.' });

  // Claim the task; if another call claimed it first, stop.
  const started = new Date().toISOString();
  let taskClaim = supabase.from('agent_tasks').update({ status: 'running', attempts: (task.attempts || 0) + 1, started_at: started, updated_at: started, error: null }).eq('id', taskId).eq('status', task.status);
  taskClaim = task.attempts == null ? taskClaim.is('attempts', null) : taskClaim.eq('attempts', task.attempts);
  if (task.status === 'running') taskClaim = taskClaim.eq('started_at', task.started_at);
  const { data: claimed } = await taskClaim.select('id');
  if (!claimed?.length) return res.status(409).json({ success: false, error: 'This task is already running' });
  if (task.status === 'waiting_approval') await note(supabase, 'master', 'approved', `${autoMinor && req.body?.approve !== true ? 'Auto-approved minor research' : 'You approved'}: ${task.title}`, taskId, task.lead_id);

  let result: { status: string; summary: string; output: any; error: string | null };
  try {
    const done = await runAgentTask(supabase, task, { qaMinor: req.body?.qaMinor === true && process.env.API_AUTH_DISABLED !== 'true' });
    result = { status: 'done', summary: done.summary, output: { ...done.output, summary: done.summary }, error: null };
  } catch (error) {
    const message = (error instanceof Error ? error.message : 'The task failed').slice(0, 300);
    result = { status: 'failed', summary: `Could not finish "${task.title}": ${message}`, output: null, error: message };
  }
  const { data: finished, error: finishError } = await supabase.from('agent_tasks').update({ status: result.status, output: result.output, error: result.error, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', taskId).eq('status', 'running').eq('started_at', started).select('id');
  if (finishError || !finished?.length) return res.status(409).json({ success: false, error: 'A newer task attempt replaced this one. Reload for the current status.' });
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

// The mailbox script has no login. It may use exactly two actions, and only with the shared password.
async function handleMailbox(req: VercelRequest, res: VercelResponse) {
  if (!process.env.REPLY_INBOX_SECRET) return res.status(503).json({ success: false, error: 'The reply inbox is not set up: REPLY_INBOX_SECRET is missing in Vercel' });
  if (!secretOk(req.body?.secret)) return res.status(401).json({ success: false, error: 'Wrong password for the reply inbox' });
  const supabase = teamClient();
  if (!supabase) return res.status(500).json({ success: false, error: 'Missing Supabase environment variables' });
  try {
    if (req.body.action === 'reply-senders') return res.status(200).json({ success: true, data: await replySenders(supabase) });
    const taken = await takeInReplies(supabase, req.body?.replies);
    if (taken.saved) {
      await note(supabase, 'customer-communication', 'task_done', `${taken.saved} new ${plural(taken.saved, 'reply', 'replies')} came in${taken.good ? `; ${taken.good} look promising (${taken.names.slice(0, 3).join(', ')})` : '; none looks promising yet'}.`);
      await sendPush(supabase, { title: 'ClientRadar', body: taken.good ? `${taken.saved} new ${plural(taken.saved, 'reply', 'replies')} - ${taken.good} look promising (${taken.names.slice(0, 2).join(', ')}). Suggested answers are ready.` : `${taken.saved} new ${plural(taken.saved, 'reply', 'replies')} came in.`, url: '/replies', tag: 'replies' });
    }
    return res.status(200).json({ success: true, data: { received: taken.received, saved: taken.saved, known: taken.known, unmatched: taken.unmatched } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Could not take in the replies' });
  }
}

const AUTO_DEMO_CAP = 5;
const AUTO_DRAFT_CAP = 10;

type AutopilotApprovalItem = {
  id: string;
  title: string;
  agentKey: string;
  agentName: string;
  link?: string;
  kind: 'demos' | 'lead-research' | 'outreach' | 'followup';
};

async function handleAutopilot(supabase: any, req: VercelRequest, res: VercelResponse) {
  const started: string[] = [];
  const now = new Date().toISOString();

  // 1. Inspect saved leads (bounded first 400 highest-scored for demo picking + total count) and open tasks.
  const [{ count: totalLeadsRaw }, { data: candidateLeads }, { data: activeDemoJobs }, { data: openTasks }] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }),
    supabase.from('leads').select('id, business_name, lead_score, demo_status, website, email, status, notes').order('lead_score', { ascending: false }).limit(400),
    supabase.from('demo_jobs').select('lead_id').in('status', ['queued', 'generating']),
    supabase.from('agent_tasks').select('id, agent_key, title, status, lead_id, input, requested_by, parent_task_id, created_at').in('status', ['queued', 'running', 'waiting_approval']).order('created_at', { ascending: false }).limit(60),
  ]);

  const totalLeads = Number(totalLeadsRaw || (candidateLeads || []).length || 0);
  let tasksList: any[] = openTasks || [];

  // Retire any unapproved queued demo tasks left over from an earlier autopilot version so nothing runs without owner approval
  // and no lead gets a Mid-Level demo instead of Ultra Premium.
  const unapprovedAutoDemos = tasksList.filter(
    (task) => task.agent_key === 'demo-creation' && task.status === 'queued' && task.requested_by === 'master-autopilot',
  );
  if (unapprovedAutoDemos.length > 0) {
    const retiredIds = unapprovedAutoDemos.map((task) => String(task.id));
    try {
      await supabase
        .from('agent_tasks')
        .update({ status: 'cancelled', completed_at: now, updated_at: now })
        .in('id', retiredIds)
        .eq('status', 'queued');
      const parentIds = Array.from(new Set(unapprovedAutoDemos.map((task) => task.parent_task_id).filter(Boolean)));
      for (const pid of parentIds) {
        await closeParent(supabase, String(pid));
      }
    } catch {
      /* best-effort cleanup */
    }
    const retiredSet = new Set(retiredIds);
    tasksList = tasksList.filter((task) => !retiredSet.has(String(task.id)));
  }

  // Only demo tasks ALREADY approved by the owner (requested_by !== 'master-autopilot') resume in the browser work queue.
  const existingApprovedQueuedDemos = tasksList.filter(
    (task) => task.agent_key === 'demo-creation' && task.status === 'queued' && task.requested_by !== 'master-autopilot',
  );
  const runningDemos = tasksList.filter((task) => task.agent_key === 'demo-creation' && task.status === 'running');
  const queue: { id: string; title: string }[] = existingApprovedQueuedDemos.map((task) => ({
    id: String(task.id),
    title: String(task.title),
  }));
  if (existingApprovedQueuedDemos.length > 0) {
    started.push(`Resumed ${existingApprovedQueuedDemos.length} approved website ${plural(existingApprovedQueuedDemos.length, 'demo', 'demos')} in background`);
  }

  // 2. Proactively stage a batch of Ultra Premium demos into waiting_approval (NEVER queued without owner approval).
  const openDemoApproval = tasksList.find((task) => task.agent_key === 'demo-creation' && task.status === 'waiting_approval');
  let freshDemoApproval: AutopilotApprovalItem | null = null;
  if (!openDemoApproval && existingApprovedQueuedDemos.length === 0 && runningDemos.length === 0 && Array.isArray(candidateLeads) && candidateLeads.length > 0) {
    const busyLeadIds = new Set<string>([
      ...(activeDemoJobs || []).map((row: any) => String(row.lead_id || '')),
      ...tasksList
        .filter((task) => task.agent_key === 'demo-creation')
        .flatMap((task) => [
          ...(task.lead_id ? [String(task.lead_id)] : []),
          ...(Array.isArray(task.input?.leadIds) ? task.input.leadIds.map((id: any) => String(id)) : []),
        ]),
    ]);
    const keyOf = (lead: any) => (keptApart(lead) ? `${nameKey(lead.business_name)}:${lead.id}` : nameKey(lead.business_name));
    const takenNames = new Set(
      candidateLeads
        .filter((lead: any) => busyLeadIds.has(lead.id) || (lead.demo_status && lead.demo_status !== 'Not Started'))
        .map(keyOf),
    );
    const pickedDemos: any[] = [];
    for (const lead of candidateLeads) {
      if (pickedDemos.length >= AUTO_DEMO_CAP) break;
      if (busyLeadIds.has(lead.id) || (lead.demo_status && lead.demo_status !== 'Not Started')) continue;
      const key = keyOf(lead);
      if (key && takenNames.has(key)) continue;
      if (key) takenNames.add(key);
      pickedDemos.push(lead);
    }

    if (pickedDemos.length > 0) {
      const names = pickedDemos.map((lead) => String(lead.business_name || 'Lead'));
      const batchTitle = `Build ${pickedDemos.length} Ultra Premium ${plural(pickedDemos.length, 'demo', 'demos')} (one approval for all)`;
      const { data: parent } = await supabase
        .from('agent_tasks')
        .insert({
          agent_key: 'master',
          title: `Autopilot: stage ${pickedDemos.length} Ultra Premium ${plural(pickedDemos.length, 'demo', 'demos')} for approval`,
          status: 'running',
          requested_by: 'master-autopilot',
          input: { autopilot: true, level: 'ultra', leadIds: pickedDemos.map((lead) => lead.id) },
          attempts: 1,
          started_at: now,
        })
        .select('id')
        .single();

      const { data: createdDemoBatch } = await supabase
        .from('agent_tasks')
        .insert({
          agent_key: 'demo-creation',
          title: batchTitle,
          status: 'waiting_approval',
          parent_task_id: parent?.id || null,
          requested_by: 'master-autopilot',
          input: {
            batch: true,
            autopilot: true,
            level: 'ultra',
            leadIds: pickedDemos.map((lead) => lead.id),
            leadNames: names,
          },
        })
        .select('id, title')
        .single();

      if (createdDemoBatch) {
        const previewNames = names.slice(0, 3).join(', ') + (names.length > 3 ? ` and ${names.length - 3} more` : '');
        freshDemoApproval = {
          id: String(createdDemoBatch.id),
          title: String(createdDemoBatch.title),
          agentKey: 'demo-creation',
          agentName: nameOf('demo-creation'),
          kind: 'demos',
        };
        started.push(`Staged ${pickedDemos.length} Ultra Premium website ${plural(pickedDemos.length, 'demo', 'demos')} (${previewNames}) - waiting for your approval`);
        await note(
          supabase,
          'master',
          'handoff',
          `Autopilot staged ${pickedDemos.length} Ultra Premium ${plural(pickedDemos.length, 'demo', 'demos')} for approval: ${previewNames}`,
          createdDemoBatch.id,
        );
      }
    }
  }

  // 3. Proactively prepare first-contact outreach drafts into waiting_approval (NEVER sends without owner approval).
  const openFirstOutreach = tasksList.find((task) => task.agent_key === 'outreach' && !task.input?.followUp && ['waiting_approval', 'running'].includes(task.status));
  let freshOutreachApproval: AutopilotApprovalItem | null = null;
  if (!openFirstOutreach && totalLeads > 0) {
    try {
      const pick = await pickForOutreach(supabase, AUTO_DRAFT_CAP);
      if (pick.leads.length > 0) {
        const written = await writeDrafts(pick.leads, originOf(req));
        const total = written.drafts.length;
        if (total > 0) {
          const title = `Send ${total} outreach ${plural(total, 'email', 'emails')} (one approval for all)`;
          const { data: parent } = await supabase
            .from('agent_tasks')
            .insert({
              agent_key: 'master',
              title: `Autopilot: prepare ${total} outreach ${plural(total, 'draft', 'drafts')}`,
              status: 'running',
              requested_by: 'master-autopilot',
              input: { autopilot: true, count: total },
              attempts: 1,
              started_at: now,
            })
            .select('id')
            .single();

          const { data: created } = await supabase
            .from('agent_tasks')
            .insert({
              agent_key: 'outreach',
              title,
              status: 'waiting_approval',
              parent_task_id: parent?.id || null,
              requested_by: 'master-autopilot',
              input: { outreach: true, autopilot: true, leadIds: pick.leads.map((lead: any) => lead.id) },
              output: {
                drafts: written.drafts,
                aiError: written.aiError,
                summary: `${total} outreach ${plural(total, 'draft', 'drafts')} prepared by Autopilot; waiting for your approval.`,
              },
            })
            .select('id, title')
            .single();

          if (created) {
            freshOutreachApproval = {
              id: String(created.id),
              title: String(created.title),
              agentKey: 'outreach',
              agentName: nameOf('outreach'),
              link: `/outreach/drafts/${created.id}`,
              kind: 'outreach',
            };
            started.push(`Prepared ${total} outreach email ${plural(total, 'draft', 'drafts')} linked to ready demos (waiting for your approval - nothing sent)`);
            await note(supabase, 'outreach', 'task_done', `Autopilot prepared ${total} outreach ${plural(total, 'draft', 'drafts')}. Waiting for owner approval.`, created.id);
          }
        }
      }
    } catch {
      /* outreach prep is best-effort during arrival scan */
    }
  }

  // 4. Proactively prepare 3-day follow-up drafts into waiting_approval (NEVER sends without owner approval).
  const openFollowUp = tasksList.find((task) => task.agent_key === 'outreach' && Boolean(task.input?.followUp) && ['waiting_approval', 'running'].includes(task.status));
  let freshFollowUpApproval: AutopilotApprovalItem | null = null;
  if (!openFollowUp && totalLeads > 0) {
    try {
      const pick = await pickForFollowUp(supabase, AUTO_DRAFT_CAP);
      if (pick.leads.length > 0) {
        const written = await writeFollowUps(pick.leads, originOf(req));
        const total = written.drafts.length;
        if (total > 0) {
          const title = `Send ${total} follow-up ${plural(total, 'email', 'emails')} (one approval for all)`;
          const { data: parent } = await supabase
            .from('agent_tasks')
            .insert({
              agent_key: 'master',
              title: `Autopilot: prepare ${total} follow-up ${plural(total, 'draft', 'drafts')}`,
              status: 'running',
              requested_by: 'master-autopilot',
              input: { autopilot: true, followUp: true, count: total },
              attempts: 1,
              started_at: now,
            })
            .select('id')
            .single();

          const { data: created } = await supabase
            .from('agent_tasks')
            .insert({
              agent_key: 'outreach',
              title,
              status: 'waiting_approval',
              parent_task_id: parent?.id || null,
              requested_by: 'master-autopilot',
              input: { outreach: true, followUp: true, autopilot: true, leadIds: pick.leads.map((lead: any) => lead.id) },
              output: {
                drafts: written.drafts,
                aiError: written.aiError,
                summary: `${total} follow-up ${plural(total, 'draft', 'drafts')} prepared by Autopilot; waiting for your approval.`,
              },
            })
            .select('id, title')
            .single();

          if (created) {
            freshFollowUpApproval = {
              id: String(created.id),
              title: String(created.title),
              agentKey: 'outreach',
              agentName: nameOf('outreach'),
              link: `/outreach/follow-ups/${created.id}`,
              kind: 'followup',
            };
            started.push(`Prepared ${total} polite 3-day follow-up ${plural(total, 'draft', 'drafts')} (waiting for your approval - nothing sent)`);
            await note(supabase, 'outreach', 'task_done', `Autopilot prepared ${total} follow-up ${plural(total, 'draft', 'drafts')}. Waiting for owner approval.`, created.id);
          }
        }
      }
    } catch {
      /* follow-up prep is best-effort during arrival scan */
    }
  }

  // 5. Run one fast bounded Records Upkeep check when leads exist.
  if (totalLeads > 0 && req.body?.autoMinor === true) {
    try {
      const upkeep = await runUpkeep(supabase);
      const summary = upkeepSummary({
        placed: Number(upkeep?.placed || 0),
        approximate: Number(upkeep?.approximate || 0),
        notFound: Number(upkeep?.notFound || 0),
        scanned: Number(upkeep?.scanned || 0),
        emails: Number(upkeep?.emails || 0),
        services: Number(upkeep?.services || 0),
      });
      if (summary) {
        started.push(`Records Upkeep: ${summary}`);
      }
    } catch {
      /* upkeep stays non-blocking */
    }
  }

  // 6. Collect all waiting approvals (demos, lead research, outreach, follow-ups) for 1-tap review in Master Autopilot.
  const approvals: AutopilotApprovalItem[] = [];
  if (freshDemoApproval) approvals.push(freshDemoApproval);
  if (freshOutreachApproval) approvals.push(freshOutreachApproval);
  if (freshFollowUpApproval) approvals.push(freshFollowUpApproval);
  for (const task of tasksList) {
    if (task.status !== 'waiting_approval') continue;
    if (approvals.some((item) => item.id === String(task.id))) continue;
    if (task.agent_key === 'outreach') {
      const isFollowUp = Boolean(task.input?.followUp);
      approvals.push({
        id: String(task.id),
        title: String(task.title),
        agentKey: 'outreach',
        agentName: nameOf('outreach'),
        link: isFollowUp ? `/outreach/follow-ups/${task.id}` : `/outreach/drafts/${task.id}`,
        kind: isFollowUp ? 'followup' : 'outreach',
      });
    } else if (task.agent_key === 'demo-creation' || task.agent_key === 'lead-research') {
      approvals.push({
        id: String(task.id),
        title: String(task.title),
        agentKey: String(task.agent_key),
        agentName: nameOf(String(task.agent_key)),
        kind: task.agent_key === 'demo-creation' ? 'demos' : 'lead-research',
      });
    }
  }

  if (!started.length) {
    if (totalLeads === 0) {
      started.push('Pipeline audit complete: 0 saved leads - strict 2-route Lead Qualification & default Ultra Premium demos armed.');
    } else if (approvals.length > 0) {
      started.push(`Pipeline audit complete: ${approvals.length} staged ${plural(approvals.length, 'task or batch is', 'tasks or batches are')} waiting for your approval.`);
    } else {
      started.push(`Pipeline audit complete across ${totalLeads.toLocaleString()} ${plural(totalLeads, 'lead', 'leads')}: Ultra Premium demos, outreach eligibility, and 3-day follow-up windows verified.`);
    }
  }

  // 7. Build context-aware 1-tap growth moves so the Master Agent always drives the next step.
  const suggestions: { label: string; prompt?: string; route?: string }[] = [];
  if (approvals.length > 0 && approvals[0].link) {
    suggestions.push({ label: approvals[0].kind === 'followup' ? 'Review follow-up drafts' : 'Review outreach drafts', route: approvals[0].link });
  }
  if (totalLeads === 0) {
    suggestions.push(
      { label: 'Find Dentists in London', prompt: 'Find 20 dentists in London with email and phone' },
      { label: 'Find Real Estate in Miami', prompt: 'Find 20 real estate agencies in Miami with email and phone' },
      { label: 'Open Lead Finder', route: '/finder' },
    );
  } else {
    suggestions.push(
      { label: 'Find 20 Med Spas in New York', prompt: 'Find 20 med spas in New York with email and phone' },
      { label: 'Pipeline & revenue report', prompt: 'Give me a sharp executive summary of my pipeline and what we should close next.' },
    );
  }

  const briefing = await briefingFor(supabase, String(req.body?.sig || ''));
  return res.status(200).json({
    success: true,
    data: {
      briefing,
      started,
      queue,
      approvals,
      suggestions,
      checkedAt: now,
    },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST' && (req.body?.action === 'reply-in' || req.body?.action === 'reply-senders')) return await handleMailbox(req, res);
  if (!(await requireUser(req, res))) return;
  if (req.method === 'POST') {
    try {
      const supabase = teamClient();
      if (!supabase) return res.status(500).json({ success: false, error: 'Missing Supabase environment variables' });
      const action = req.body?.action;
      const ownerActions = ['outreach-resolve', 'followup-resolve', 'outreach-reapprove', 'followup-reapprove', 'outreach-approve', 'outreach-send', 'outreach-retry', 'followup-approve', 'followup-send', 'followup-retry', 'reply-send', 'reply-resolve', 'demo-refresh-start'];
      if ((ownerActions.includes(action) || (action === 'autopilot' && req.body?.autoMinor === true)) && !(await requireOwner(req, res))) return;
      if (action === 'autopilot') return await handleAutopilot(supabase, req, res);
      if (action === 'briefing') {
        // The opening briefing: important things first, memory of what was already said.
        return res.status(200).json({ success: true, data: await briefingFor(supabase, String(req.body?.sig || '')) });
      }
      if (action === 'chat') return await handleChat(supabase, req, res);
      if (action === 'scan-candidate') {
        const website = String(req.body?.website || '').trim().slice(0, 500);
        if (!website) return res.status(400).json({ success: false, error: 'website is required' });
        if (!isOfficialWebsiteUrl(website)) {
          return res.status(200).json({
            success: true,
            data: { read: false, nonOfficial: true, reason: 'This link points to a social media or third-party listing page, not an official business website.' },
          });
        }
        const scan = await scanWebsite(website);
        if (!scan) return res.status(200).json({ success: true, data: { read: false, reason: 'Site could not be read (it may be offline, blocking visitors, or built in a way that hides its text).' } });
        return res.status(200).json({ success: true, data: {
          read: true, officialUrl: scan.url, emails: scan.emails, phones: scan.phones, instagram: scan.instagram,
          colors: scan.colors, accent: scan.accent, darkDesign: scan.darkDesign, fonts: scan.fonts,
          platform: scan.platform, mobileReady: scan.mobileReady, secure: scan.secure,
          pagesRead: scan.pagesRead, summary: scanSummary(scan),
        } });
      }
      if (action === 'run') return await handleRun(supabase, req, res);
      if (action === 'cancel') return await handleCancel(supabase, req, res);
      if (action === 'transcribe') {
        const audio = String(req.body?.audio || '');
        const mimeType = ['audio/wav', 'audio/mp3', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/webm', 'audio/mpeg'].includes(req.body?.mimeType) ? req.body.mimeType : 'audio/wav';
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
      if (action === 'outreach-resolve' || action === 'followup-resolve') {
        if (process.env.API_AUTH_DISABLED === 'true') return res.status(403).json({ success: false, error: 'Sending is unavailable while API authentication is disabled.' });
        const out = await resolveUncertainSend(supabase, req.body, action === 'followup-resolve');
        return res.status(out.status).json(out.body);
      }
      if (action === 'outreach-reapprove' || action === 'followup-reapprove') {
        if (process.env.API_AUTH_DISABLED === 'true') return res.status(403).json({ success: false, error: 'Sending is unavailable while API authentication is disabled.' });
        const out = await reapproveBatch(supabase, req.body, action === 'followup-reapprove');
        return res.status(out.status).json(out.body);
      }
      if (action === 'outreach-approve' || action === 'outreach-send' || action === 'outreach-retry') {
        if (process.env.API_AUTH_DISABLED === 'true') return res.status(403).json({ success: false, error: 'Sending is unavailable while API authentication is disabled.' });
        const out = action === 'outreach-approve' ? await approveOutreach(supabase, req.body) : action === 'outreach-retry' ? await retryOutreach(supabase, req.body) : await sendOutreach(supabase, req.body, originOf(req));
        return res.status(out.status).json(out.body);
      }
      if (action === 'followup-approve' || action === 'followup-send' || action === 'followup-retry') {
        if (process.env.API_AUTH_DISABLED === 'true') return res.status(403).json({ success: false, error: 'Sending is unavailable while API authentication is disabled.' });
        const out = action === 'followup-approve' ? await approveFollowUp(supabase, req.body) : action === 'followup-retry' ? await retryFollowUp(supabase, req.body) : await sendFollowUp(supabase, req.body, originOf(req));
        return res.status(out.status).json(out.body);
      }
      if (action === 'reply-status') return res.status(200).json({ success: true, data: await setReplyStatus(supabase, String(req.body?.id || ''), String(req.body?.status || '')) });
      if (action === 'push-key') return res.status(200).json({ success: true, data: { configured: pushConfigured(), publicKey: pushPublicKey(), problem: vapidProblem() } });
      if (action === 'push-subscribe') return res.status(200).json({ success: true, data: await saveSubscription(supabase, req.body?.subscription) });
      if (action === 'push-unsubscribe') return res.status(200).json({ success: true, data: await deleteSubscription(supabase, String(req.body?.endpoint || '')) });
      if (action === 'push-test') {
        const out = await sendPush(supabase, { title: 'ClientRadar', body: 'Notifications are working. Replies, drafts and demos will reach you here.', url: '/', tag: 'test' });
        return res.status(200).json({ success: true, data: { sent: out.sent, configured: pushConfigured(), errors: out.errors } });
      }
      if (action === 'reply-resolve') {
        if (process.env.API_AUTH_DISABLED === 'true' || req.body?.confirm !== true) return res.status(403).json({ success: false, error: 'Confirm the provider result while authenticated.' });
        const out = await resolveReplySend(supabase, String(req.body?.id || ''), String(req.body?.resolution || ''));
        await note(supabase, 'master', 'approved', `Owner recorded reply provider result: ${String(req.body?.resolution || '')}`, null);
        return res.status(200).json({ success: true, data: out });
      }
      if (action === 'reply-skip-draft') return res.status(200).json({ success: true, data: await skipReplyDraft(supabase, String(req.body?.id || '')) });
      if (action === 'reply-send') {
        // Sending an answer to a client needs the owner's approval, like every other send.
        if (process.env.API_AUTH_DISABLED === 'true') return res.status(403).json({ success: false, error: 'Sending is unavailable while API authentication is disabled.' });
        if (req.body?.confirm !== true) return res.status(403).json({ success: false, error: 'Sending an answer needs your approval' });
        try {
          const out = await sendReplyAnswer(supabase, String(req.body?.id || ''), String(req.body?.text || ''), { qaOverride: req.body?.qaOverride === true, qaToken: String(req.body?.qaToken || ''), origin: originOf(req) });
          await note(supabase, 'customer-communication', 'sent', `You answered a reply from ${out.to}`, null, null);
          return res.status(200).json({ success: true, data: out });
        } catch (error) {
          if (error instanceof QaReviewNeeded) return res.status(409).json(qaReviewResponse(error.review));
          throw error;
        }
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
        if (process.env.API_AUTH_DISABLED === 'true' || req.body?.confirm !== true) return res.status(403).json({ success: false, error: 'An authenticated owner must approve demo updates.' });
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
  if (req.query?.view === 'followup-drafts') {
    const supabase = teamClient();
    if (!supabase) return res.status(500).json({ success: false, error: 'Missing Supabase environment variables' });
    try { return res.status(200).json({ success: true, data: followUpView(await followUpTask(supabase, String(req.query?.taskId || ''))) }); } catch (error) { return res.status(404).json({ success: false, error: error instanceof Error ? error.message : 'Not found' }); }
  }
  if (req.query?.view === 'replies') {
    const supabase = teamClient();
    if (!supabase) return res.status(500).json({ success: false, error: 'Missing Supabase environment variables' });
    return res.status(200).json({ success: true, data: { ...(await listReplies(supabase)), secretSet: Boolean(process.env.REPLY_INBOX_SECRET) } });
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
    return res.status(200).json({ success: true, data: { replies: await replyNews(supabase).catch(() => ({ fresh: 0, good: 0, newest: '' })), outreach: await outreachReady(supabase).catch(() => ({ ready: 0, noEmail: 0 })), followup: await followUpReady(supabase).catch(() => ({ ready: 0 })), duplicates: { names: repeated.length, example: repeated[0]?.name || '', leads: repeated.reduce((sum, entry) => sum + entry.leads.length, 0), likelySame: repeated.filter((entry) => entry.hint === 'same').length }, count: found.length, names: found.slice(0, 3).map((demo) => demo.name), sections: Array.from(new Set(found.flatMap((demo) => demo.missing))) } });
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
        ? await supabase.from('agent_tasks').select('id, parent_task_id, agent_key, title, status, output, error, created_at, input').in('parent_task_id', ids).order('created_at', { ascending: true })
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
          link: child.agent_key === 'outreach' ? (child.input?.followUp ? `/outreach/follow-ups/${child.id}` : `/outreach/drafts/${child.id}`) : undefined,
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
      supabase.from('agent_tasks').select('id, agent_key, title, status, requested_by, lead_id, error, created_at, completed_at, started_at, input, leads(business_name)').order('created_at', { ascending: false }).limit(30),
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
      followUp: Boolean(row.input?.followUp),
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
