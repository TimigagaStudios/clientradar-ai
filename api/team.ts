import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './lib/auth.js';
import { AGENTS, teamClient } from './lib/_team.js';

// AI team endpoint. GET returns the team register with live task and activity records.
// Read-only in Phase 1; giving tasks to agents arrives with the Master Agent (Phase 2).

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireUser(req, res))) return;
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
