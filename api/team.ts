import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './lib/auth.js';
import { AGENTS, teamClient } from './lib/_team.js';
import { planRequest } from './lib/_master.js';
import type { MasterContext } from './lib/_master.js';
import { canRun, runAgentTask } from './lib/_agents.js';

// AI team endpoint.
// GET                      team register with live task and activity records.
// POST action "chat"       the Master Agent answers and hands tasks to specialists (records only, runs nothing).
// POST action "run"        one specialist runs ONE task in this server call (approval checked here).
// POST action "cancel"     the owner declines a waiting task.

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
  const { data: children } = await supabase.from('agent_tasks').select('status, agent_key, output, error, title').eq('parent_task_id', parentId);
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
    recentActivity: (activity || []).map((row: any) => `${nameOf(row.agent_key)}: ${row.summary}`),
  };
}

async function handleChat(supabase: any, req: VercelRequest, res: VercelResponse) {
  const message = String(req.body?.message || '').trim().slice(0, 600);
  if (!message) return res.status(400).json({ success: false, error: 'message is required' });
  const history = Array.isArray(req.body?.history) ? req.body.history.filter((line: unknown) => typeof line === 'string').slice(-6) : [];

  const context = await masterContext(supabase);
  const plan = await planRequest(message, history, context);
  let reply = plan.reply;

  // Turn the plan into task rows. Demo tasks must point at exactly one saved lead.
  const rows: any[] = [];
  const problems: string[] = [];
  for (const task of plan.tasks) {
    if (task.agent === 'lead-research') {
      rows.push({ agent_key: 'lead-research', title: `Find ${task.category} in ${task.city}`, status: 'queued', input: { category: task.category, city: task.city } });
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

async function handleRun(supabase: any, req: VercelRequest, res: VercelResponse) {
  const taskId = String(req.body?.taskId || '');
  if (!taskId) return res.status(400).json({ success: false, error: 'taskId is required' });
  const { data: task } = await supabase.from('agent_tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
  if (!canRun(task.agent_key)) return res.status(400).json({ success: false, error: 'This agent is not active yet' });
  if (task.status === 'waiting_approval' && req.body?.approve !== true) return res.status(403).json({ success: false, error: 'This task needs your approval first' });
  if (!['queued', 'waiting_approval', 'failed'].includes(task.status)) return res.status(409).json({ success: false, error: `This task is already ${task.status}` });
  if ((task.attempts || 0) >= MAX_ATTEMPTS) return res.status(409).json({ success: false, error: 'This task has been tried 3 times. Ask again to start a new one.' });

  // Claim the task; if another call claimed it first, stop.
  const { data: claimed } = await supabase.from('agent_tasks').update({ status: 'running', attempts: (task.attempts || 0) + 1, started_at: new Date().toISOString(), updated_at: new Date().toISOString(), error: null }).eq('id', taskId).eq('status', task.status).select('id');
  if (!claimed?.length) return res.status(409).json({ success: false, error: 'This task is already running' });
  if (task.status === 'waiting_approval') await note(supabase, 'master', 'approved', `You approved: ${task.title}`, taskId, task.lead_id);

  let result: { status: string; summary: string; output: any; error: string | null };
  try {
    const done = await runAgentTask(supabase, task);
    result = { status: 'done', summary: done.summary, output: done.output, error: null };
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
      return res.status(400).json({ success: false, error: 'Unknown action' });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message.slice(0, 200) : 'Team error' });
    }
  }
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

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
