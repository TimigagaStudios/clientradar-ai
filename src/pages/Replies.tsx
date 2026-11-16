import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

// Reply inbox: what businesses answered to outreach emails, sorted so the promising ones come first.
// ClientRadar only reads and sorts. Answers are written by the owner, in his own mailbox.

type Reply = { id: string; leadId: string | null; leadName: string; fromEmail: string; fromName: string; subject: string; body: string; receivedAt: string; label: string; score: number; reason: string; scoredBy: string; status: string };

const call = async (url: string, body?: Record<string, unknown>) => {
  const response = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  let result: any = null;
  try { result = JSON.parse(await response.text()); } catch { /* not JSON */ }
  if (!response.ok || !result?.success) throw new Error(result?.error || `server error ${response.status}`);
  return result.data;
};
const LABEL: Record<string, { text: string; color: string }> = {
  interested: { text: 'Interested', color: '#22c55e' },
  question: { text: 'Asks a question', color: '#FF7A00' },
  not_interested: { text: 'Not interested', color: '#f87171' },
  auto_reply: { text: 'Automatic message', color: '#94a3b8' },
  other: { text: 'Unclear', color: '#94a3b8' },
};
const good = (reply: Reply) => reply.label === 'interested' || reply.label === 'question';

export default function Replies() {
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [setup, setSetup] = useState({ ready: true, secretSet: true });
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState('');
  const [all, setAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await call('/api/team?view=replies');
      setReplies(data.replies || []);
      setSetup({ ready: Boolean(data.ready), secretSet: Boolean(data.secretSet) });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load the replies'); setReplies([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const mark = async (reply: Reply, status: 'new' | 'handled') => {
    setReplies((current) => (current || []).map((item) => (item.id === reply.id ? { ...item, status } : item)));
    try { await call('/api/team', { action: 'reply-status', id: reply.id, status }); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save'); void load(); }
  };

  const list = (replies || []).filter((reply) => all || reply.status === 'new').sort((first, second) => Number(good(second)) - Number(good(first)) || second.score - first.score);
  const waiting = (replies || []).filter((reply) => reply.status === 'new');
  return (
    <div className="space-y-5 pb-24" data-replies>
      <header>
        <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)]">Replies</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{replies === null ? 'Loading...' : `${waiting.length} to look at${waiting.filter(good).length ? `, ${waiting.filter(good).length} promising` : ''}. Promising ones come first.`}</p>
      </header>
      {error && <p className="neo-card p-4 text-sm text-red-400" role="alert">{error}</p>}
      {replies !== null && (!setup.ready || !setup.secretSet) && (
        <div className="neo-card p-4 text-sm text-[#FF7A00]" data-setup>
          <p className="font-bold">The reply inbox is not switched on yet.</p>
          {!setup.ready && <p className="mt-1">Step missing: run migration 007 in Supabase.</p>}
          {!setup.secretSet && <p className="mt-1">Step missing: add REPLY_INBOX_SECRET in Vercel and redeploy.</p>}
        </div>
      )}
      {replies !== null && setup.ready && setup.secretSet && !(replies || []).length && <p className="neo-card p-5 text-sm text-[var(--text-secondary)]">No reply has come in yet. Replies are collected from your mailbox every few minutes once the mailbox script is running.</p>}

      {list.map((reply) => (
        <section key={reply.id} className="neo-card p-4 sm:p-5" data-reply data-label={reply.label} style={{ opacity: reply.status === 'handled' ? 0.6 : 1 }}>
          <button type="button" className="w-full text-left" onClick={() => setOpenId(openId === reply.id ? '' : reply.id)} aria-expanded={openId === reply.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-[var(--text-primary)] break-words">{reply.leadName}</p>
                <p className="text-xs text-[var(--text-secondary)] break-all">{reply.fromEmail} - {new Date(reply.receivedAt).toLocaleString()}</p>
              </div>
              <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: LABEL[reply.label]?.color || '#94a3b8', border: `1px solid ${LABEL[reply.label]?.color || '#94a3b8'}` }}>{LABEL[reply.label]?.text || reply.label}</span>
            </div>
            <p className="mt-2 text-sm text-[var(--text-primary)] break-words">{openId === reply.id ? reply.subject : reply.body.slice(0, 140) || reply.subject}</p>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)] break-words">{reply.reason} ({reply.scoredBy === 'ai' ? 'sorted by the AI' : 'sorted by built-in rules'})</p>
          </button>
          {openId === reply.id && (
            <div className="mt-3 space-y-3">
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-secondary)]">{reply.body || 'The reply had no new text.'}</p>
              <div className="flex flex-wrap gap-2">
                <a href={`mailto:${reply.fromEmail}?subject=${encodeURIComponent(/^re:/i.test(reply.subject) ? reply.subject : `Re: ${reply.subject}`)}`} className="rounded-full px-3.5 py-2 text-xs font-bold text-white" style={{ background: '#FF7A00' }}>Answer in your mail app</a>
                {reply.leadId && <Link to={`/leads/${reply.leadId}`} className="neo-button rounded-full px-3.5 py-2 text-xs font-bold text-[var(--text-primary)]">Open lead</Link>}
                <button type="button" onClick={() => void mark(reply, reply.status === 'handled' ? 'new' : 'handled')} className="neo-button rounded-full px-3.5 py-2 text-xs font-bold text-[var(--text-primary)]" data-handled>{reply.status === 'handled' ? 'Mark as not done' : 'Done'}</button>
              </div>
            </div>
          )}
        </section>
      ))}
      {(replies || []).some((reply) => reply.status === 'handled') && <button type="button" onClick={() => setAll(!all)} className="text-sm font-bold text-[#FF7A00]" data-show-all>{all ? 'Hide finished replies' : 'Show finished replies too'}</button>}
    </div>
  );
}
