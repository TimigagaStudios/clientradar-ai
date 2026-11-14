import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, BarChart3, CalendarClock, CheckCircle2, ChevronDown, Megaphone, MessagesSquare, MonitorPlay, RefreshCw, Search, Send, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import { cn } from '../utils/cn';

// AI Team page: the real team register with real task records and the activity log.
// Read-only in Phase 1. Agents marked "Planned" do no work yet and are labelled as such.

interface TeamAgent {
  key: string;
  name: string;
  role: string;
  job: string;
  tools: string[];
  dataAccess: string[];
  needsApproval: string[];
  reportsTo: string | null;
  stage: 'active' | 'planned';
  stageNote: string;
  done: number;
  failed: number;
  lastSummary: string | null;
  lastAt: string | null;
}

interface TeamTask {
  id: string;
  agentKey: string;
  title: string;
  status: string;
  leadId: string | null;
  leadName: string | null;
  error: string | null;
  createdAt: string;
}

interface TeamActivity {
  id: number;
  agentKey: string;
  kind: string;
  summary: string;
  createdAt: string;
}

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  master: Sparkles,
  'lead-research': Search,
  'demo-creation': MonitorPlay,
  'quality-assurance': ShieldCheck,
  outreach: Send,
  reporting: BarChart3,
  scheduling: CalendarClock,
  'customer-communication': MessagesSquare,
  'social-content': Megaphone,
};

const timeAgo = (value: string | null) => {
  if (!value) return '';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
};

const Chips = ({ title, items }: { title: string; items: string[] }) => (
  <div>
    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-secondary)] font-bold mb-2">{title}</p>
    {items.length ? (
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="px-3 py-1 rounded-full neo-in text-xs text-[var(--text-primary)]">{item}</span>
        ))}
      </div>
    ) : (
      <p className="text-xs text-[var(--text-secondary)]">Nothing</p>
    )}
  </div>
);

const Team = () => {
  const [agents, setAgents] = useState<TeamAgent[]>([]);
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [activity, setActivity] = useState<TeamActivity[]>([]);
  const [ready, setReady] = useState(true);
  const [setup, setSetup] = useState('');
  const [detail, setDetail] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed('');
    try {
      const response = await fetch('/api/team');
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not load the team');
      setAgents(result.data.agents || []);
      setTasks(result.data.tasks || []);
      setActivity(result.data.activity || []);
      setReady(result.ready !== false);
      setSetup(result.setup || '');
      setDetail(result.detail || '');
    } catch (error) {
      setFailed(error instanceof Error ? error.message : 'Could not load the team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const nameOf = (key: string) => agents.find((agent) => agent.key === key)?.name || key;
  const master = agents.find((agent) => agent.key === 'master');
  const specialists = agents.filter((agent) => agent.key !== 'master');
  const activeCount = agents.filter((agent) => agent.stage === 'active').length;
  const doneCount = agents.reduce((sum, agent) => sum + agent.done, 0);

  const renderAgent = (agent: TeamAgent, wide = false) => {
    const Icon = ICONS[agent.key] || Sparkles;
    const open = openKey === agent.key;
    const active = agent.stage === 'active';
    return (
      <div key={agent.key} className={cn('neo-card p-5 sm:p-6', wide && 'md:col-span-2 xl:col-span-3', !active && agent.key !== 'master' && 'opacity-80')}>
        <button type="button" onClick={() => setOpenKey(open ? null : agent.key)} aria-expanded={open} className="w-full text-left flex items-start gap-4">
          <span className={cn('shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center', active || agent.key === 'master' ? 'bg-blue-500/15 text-blue-400' : 'neo-in text-[var(--text-secondary)]')}>
            <Icon size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-black text-[var(--text-primary)]">{agent.name}</span>
              <span className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-bold border', active ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-slate-500/10 text-[var(--text-secondary)] border-slate-500/20')}>
                {active ? 'Active' : 'Planned'}
              </span>
            </span>
            <span className="block text-sm text-[var(--text-secondary)] mt-0.5">{agent.role}</span>
            {active ? (
              <span className="block text-sm text-[var(--text-primary)] mt-3">
                {agent.lastSummary ? <>{agent.lastSummary} <span className="text-[var(--text-secondary)]">{timeAgo(agent.lastAt)}</span></> : <span className="text-[var(--text-secondary)]">No recorded work yet.</span>}
              </span>
            ) : (
              <span className="block text-sm text-[var(--text-secondary)] mt-3">{agent.stageNote}</span>
            )}
            {active && (
              <span className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-[var(--text-secondary)]">
                <span><b className="text-[var(--text-primary)]">{agent.done}</b> done</span>
                <span><b className="text-[var(--text-primary)]">{agent.failed}</b> failed</span>
              </span>
            )}
          </span>
          <ChevronDown size={18} className={cn('shrink-0 mt-1 text-[var(--text-secondary)] transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <div className="mt-5 pt-5 border-t border-slate-500/15 space-y-4">
            <p className="text-sm text-[var(--text-primary)] leading-relaxed">{agent.job}</p>
            <Chips title="Tools" items={agent.tools} />
            <Chips title="Can see" items={agent.dataAccess} />
            <Chips title="Needs your approval for" items={agent.needsApproval} />
            <p className="text-xs text-[var(--text-secondary)]">
              {agent.reportsTo ? `Reports to ${nameOf(agent.reportsTo)}.` : 'Reports to you.'} {active ? agent.stageNote : ''}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">AI Team</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            {loading && !agents.length ? 'Loading your team...' : `${activeCount} of ${agents.length} agents active - ${doneCount} ${doneCount === 1 ? 'task' : 'tasks'} completed`}
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="neo-card px-4 py-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] self-start md:self-auto disabled:opacity-60">
          <RefreshCw size={16} className={cn(loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      {failed && <div className="neo-card p-5 text-sm text-red-400" role="alert">{failed}</div>}

      {!ready && !failed && (
        <div className="neo-card p-5 sm:p-6 border border-amber-500/30" role="status">
          <p className="font-bold text-[var(--text-primary)]">{setup === 'tables-missing' ? 'One setup step left' : 'Team records could not be read'}</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {setup === 'tables-missing'
              ? 'The task and activity tables do not exist yet. Run the file 004_agent_team.sql once in Supabase (SQL Editor), then tap Refresh. Until then nothing is recorded, and everything else keeps working.'
              : detail || 'Please try again.'}
          </p>
        </div>
      )}

      {master && <div className="grid grid-cols-1">{renderAgent(master)}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
        {specialists.map((agent) => renderAgent(agent))}
      </div>

      <section className="neo-card p-5 sm:p-6 space-y-4">
        <h2 className="text-xl font-black text-[var(--text-primary)]">Recent tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">No tasks yet. Run a Lead Finder search or generate a demo and it will appear here.</p>
        ) : (
          <ul className="divide-y divide-slate-500/15">
            {tasks.map((task) => (
              <li key={task.id} className="py-3 flex items-start gap-3">
                {task.status === 'failed' ? <XCircle size={18} className="shrink-0 mt-0.5 text-red-400" /> : <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-green-500" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)] break-words">{task.title}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {nameOf(task.agentKey)} - {task.status} - {timeAgo(task.createdAt)}
                    {task.leadId && <> - <Link to={`/leads/${task.leadId}`} className="underline">{task.leadName || 'Open lead'}</Link></>}
                  </p>
                  {task.error && <p className="text-xs text-red-400 mt-1 break-words">{task.error}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="neo-card p-5 sm:p-6 space-y-4">
        <h2 className="text-xl font-black text-[var(--text-primary)] inline-flex items-center gap-2"><Activity size={20} /> Activity log</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Nothing recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map((row) => (
              <li key={row.id} className="flex items-start gap-3 text-sm">
                <span className={cn('shrink-0 mt-1.5 w-2 h-2 rounded-full', row.kind === 'task_failed' ? 'bg-red-400' : 'bg-blue-400')} />
                <span className="min-w-0 flex-1 text-[var(--text-primary)] break-words">
                  <b>{nameOf(row.agentKey)}</b> - {row.summary} <span className="text-[var(--text-secondary)] whitespace-nowrap">{timeAgo(row.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default Team;
