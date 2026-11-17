import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLeads } from '../context/LeadContext';

type SentLog = { id: string; lead_id: string | null; subject: string; body: string; type: string; sent_at: string };

export default function OutreachHistory() {
  const { leads } = useLeads();
  const [page, setPage] = useState(0);
  const [logs, setLogs] = useState<SentLog[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLogs(null); setError('');
    fetch(`/api/outreach-logs?all=1&page=${page}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Could not load sent history');
        if (active) { setLogs(result.data || []); setMore(Boolean(result.hasMore)); }
      }).catch((reason) => { if (active) { setError(reason instanceof Error ? reason.message : 'Could not load sent history'); setLogs([]); } });
    return () => { active = false; };
  }, [page, revision]);
  return <section className="space-y-4" data-sent-history>
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-black">Sent history</h2><p className="text-sm text-[var(--text-secondary)]">Recorded ClientRadar emails only. A record does not confirm delivery; some sends may be missing if logging failed.</p></div><button type="button" className="neo-button rounded-full px-4 py-2 text-sm" onClick={() => setRevision((v) => v + 1)}>Refresh</button></div>
    {error && <p className="text-red-500" role="alert">{error}</p>}
    {logs === null && <p>Loading sent history...</p>}
    {logs?.length === 0 && !error && <p className="neo-card p-4">No recorded emails on this page.</p>}
    {logs?.map((log) => {
      const lead = leads.find((item) => item.id === log.lead_id);
      return <article key={log.id} className="neo-card p-4 space-y-2">
        <button type="button" className="w-full text-left" aria-expanded={open === log.id} onClick={() => setOpen(open === log.id ? '' : log.id)}>
          <strong className="block break-words">{log.subject || '(No subject)'}</strong>
          <span className="block text-sm text-[var(--text-secondary)]">{lead?.businessName || 'Lead unavailable'} - {log.sent_at ? new Date(log.sent_at).toLocaleString() : 'Date unavailable'} - {log.type}</span>
          {lead?.email && <span className="block text-xs text-[var(--text-secondary)]">Current lead email: {lead.email} (may differ from original recipient)</span>}
        </button>
        {open === log.id && <div><p className="whitespace-pre-wrap break-words text-sm">{log.body}</p>{lead && <Link className="text-sm text-[var(--accent)]" to={`/leads/${lead.id}`}>Open lead</Link>}</div>}
      </article>;
    })}
    <div className="flex items-center gap-3"><button type="button" className="neo-button rounded-full px-4 py-2 disabled:opacity-40" disabled={page === 0} onClick={() => { setOpen(''); setPage((v) => v - 1); }}>Previous</button><span className="text-sm">Page {page + 1}</span><button type="button" className="neo-button rounded-full px-4 py-2 disabled:opacity-40" disabled={!more || logs === null} onClick={() => { setOpen(''); setPage((v) => v + 1); }}>Next</button></div>
  </section>;
}
