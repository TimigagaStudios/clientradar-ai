import EventTime from '../components/ui/EventTime';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ListPager, { usePagedList } from '../components/ui/ListPager';
import { useQaReview } from '../components/QaReviewDialog';
import DraftQa from '../components/DraftQa';

// Reply inbox: what businesses answered to outreach emails, sorted so the promising ones come first.
// The Customer Communication Agent writes a suggested answer for promising replies. Nothing is sent
// until the owner reads it here and approves it. Answers can also be written in the owner's mail app.

type Reply = { id: string; leadId: string | null; leadName: string; fromEmail: string; fromName: string; subject: string; body: string; receivedAt: string; label: string; score: number; reason: string; scoredBy: string; status: string; suggestedReply: string; draftState: string; draftBy: string };

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
  const { postWithQaReview, qaReviewDialog } = useQaReview();
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [setup, setSetup] = useState({ ready: true, secretSet: true });
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState('');
  const [all, setAll] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [confirmId, setConfirmId] = useState('');
  const [sending, setSending] = useState(false);

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

  const sendAnswer = async (reply: Reply) => {
    setConfirmId('');
    setSending(true);
    setError('');
    try {
      await postWithQaReview('/api/team', { action: 'reply-send', id: reply.id, text: edits[reply.id] ?? reply.suggestedReply, confirm: true });
      setReplies((current) => (current || []).map((item) => (item.id === reply.id ? { ...item, draftState: 'sent', status: 'handled', suggestedReply: edits[reply.id] ?? reply.suggestedReply } : item)));
      window.dispatchEvent(new CustomEvent('cr-notice', { detail: { text: `Your answer to ${reply.leadName} was sent.`, to: '/leads', yes: 'Open leads' } }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not send'); await load(); }
    setSending(false);
  };

  const resolveSend = async (reply: Reply, resolution: 'accepted' | 'not_sent') => {
    const description = resolution === 'accepted' ? 'accepted' : 'did not accept';
    if (!window.confirm(`Have you checked Brevo and confirmed it ${description} this email? This records your decision and sends nothing.`)) return;
    try { await call('/api/team', { action: 'reply-resolve', id: reply.id, resolution, confirm: true }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not record the result'); }
  };

  const skipDraft = async (reply: Reply) => {
    setReplies((current) => (current || []).map((item) => (item.id === reply.id ? { ...item, draftState: 'skipped' } : item)));
    try { await call('/api/team', { action: 'reply-skip-draft', id: reply.id }); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save'); void load(); }
  };

  const list = (replies || []).filter((reply) => all || reply.status === 'new').sort((first, second) => Number(good(second)) - Number(good(first)) || second.score - first.score);
  const replyPager = usePagedList(list, all ? 'all' : 'new', 10);
  const waiting = (replies || []).filter((reply) => reply.status === 'new');
  const draftsReady = waiting.filter((reply) => reply.draftState === 'ready').length;
  return (
    <div className="space-y-5 pb-24" data-replies>
      {qaReviewDialog}
      <header>
        <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)]">Replies</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{replies === null ? 'Loading...' : `${waiting.length} to look at${waiting.filter(good).length ? `, ${waiting.filter(good).length} promising` : ''}${draftsReady ? `, ${draftsReady} suggested ${draftsReady === 1 ? 'answer' : 'answers'} ready` : ''}. Promising ones come first.`}</p>
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

      {replyPager.visible.map((reply) => (
        <section key={reply.id} className="neo-card p-4 sm:p-5" data-reply data-label={reply.label} style={{ opacity: reply.status === 'handled' ? 0.6 : 1 }}>
          <button type="button" className="w-full text-left" onClick={() => setOpenId(openId === reply.id ? '' : reply.id)} aria-expanded={openId === reply.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-[var(--text-primary)] break-words">{reply.leadName}</p>
                <p className="text-xs text-[var(--text-secondary)] break-all">{reply.fromEmail}</p>
              </div>
              <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: LABEL[reply.label]?.color || '#94a3b8', border: `1px solid ${LABEL[reply.label]?.color || '#94a3b8'}` }}>{LABEL[reply.label]?.text || reply.label}</span>
            </div>
            <p className="mt-2 text-sm text-[var(--text-primary)] break-words">{openId === reply.id ? reply.subject : reply.body.slice(0, 140) || reply.subject}</p>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)] break-words">{reply.reason} ({reply.scoredBy === 'ai' ? 'sorted by the AI' : 'sorted by built-in rules'})</p>
          </button>
          <p className="mt-1 text-xs text-[var(--text-secondary)]"><EventTime value={reply.receivedAt} label="Reply date" /></p>
          {openId === reply.id && (
            <div className="mt-3 space-y-3">
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-secondary)]">{reply.body || 'The reply had no new text.'}</p>

              {reply.draftState === 'ready' && (
                <div className="rounded-xl border border-[#FF7A00]/40 p-3 space-y-2" data-draft-box>
                  <p className="text-xs font-bold text-[var(--text-primary)]">Suggested answer {reply.draftBy === 'ai' ? '(written by the AI)' : '(built-in wording)'} - change it if you like. Nothing is sent until you approve.</p>
                  <textarea value={edits[reply.id] ?? reply.suggestedReply} onChange={(event) => setEdits((current) => ({ ...current, [reply.id]: event.target.value }))} aria-label="Suggested answer" rows={8} className="w-full rounded-xl neo-in px-3 py-2 text-sm leading-6 text-[var(--text-primary)] outline-none" />
                  <DraftQa subject={/^re:/i.test(reply.subject) ? reply.subject : `Re: ${reply.subject || 'your email'}`} body={(edits[reply.id] ?? reply.suggestedReply).replace(/\s+/g, ' ').trim().slice(0, 4000)} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={sending || !(edits[reply.id] ?? reply.suggestedReply).trim()} onClick={() => setConfirmId(reply.id)} className="rounded-full px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40" style={{ background: '#FF7A00' }} data-send-answer>Approve and send</button>
                    <button type="button" onClick={() => void skipDraft(reply)} className="neo-button rounded-full px-3.5 py-2 text-xs font-bold text-[var(--text-primary)]" data-skip-draft>I will answer myself</button>
                  </div>
                </div>
              )}
              {(reply.draftState.startsWith('sending:') || reply.draftState.startsWith('unknown:')) && <div className="text-xs text-[var(--text-primary)]"><p>Send status is uncertain. Check Brevo before trying again; acceptance does not prove delivery. An active send may require a short wait.</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => void resolveSend(reply, 'accepted')} className="neo-button rounded-full px-3 py-2">Provider accepted it</button><button type="button" onClick={() => void resolveSend(reply, 'not_sent')} className="neo-button rounded-full px-3 py-2">Provider did not accept it</button></div></div>}
              {reply.draftState === 'sent' && <p className="text-xs font-bold text-green-500" data-answered>Answered - sent or marked accepted after provider review; delivery is not confirmed.</p>}
              {reply.draftState === 'skipped' && <p className="text-xs text-[var(--text-secondary)]">You chose to answer this one yourself.</p>}

              <div className="flex flex-wrap gap-2">
                <a href={`mailto:${reply.fromEmail}?subject=${encodeURIComponent(/^re:/i.test(reply.subject) ? reply.subject : `Re: ${reply.subject}`)}`} className="rounded-full px-3.5 py-2 text-xs font-bold text-white" style={{ background: '#FF7A00' }}>Answer in your mail app</a>
                {reply.leadId && <Link to={`/leads/${reply.leadId}`} className="neo-button rounded-full px-3.5 py-2 text-xs font-bold text-[var(--text-primary)]">Open lead</Link>}
                <button type="button" onClick={() => void mark(reply, reply.status === 'handled' ? 'new' : 'handled')} className="neo-button rounded-full px-3.5 py-2 text-xs font-bold text-[var(--text-primary)]" data-handled>{reply.status === 'handled' ? 'Mark as not done' : 'Done'}</button>
              </div>
            </div>
          )}
        </section>
      ))}
      <ListPager pager={replyPager} noun="replies" />
      {(replies || []).some((reply) => reply.status === 'handled') && <button type="button" onClick={() => setAll(!all)} className="text-sm font-bold text-[#FF7A00]" data-show-all>{all ? 'Hide finished replies' : 'Show finished replies too'}</button>}

      {confirmId && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} role="dialog" aria-modal="true" aria-label="Confirm sending">
          <div className="neo-card w-full max-w-md p-5 space-y-3">
            <h3 className="text-lg font-black text-[var(--text-primary)]">Send this answer now?</h3>
            <p className="text-sm text-[var(--text-secondary)]">A real email goes to this business from your Brevo sender address. This cannot be taken back.</p>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { const reply = (replies || []).find((item) => item.id === confirmId); if (reply) void sendAnswer(reply); }} className="rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: '#FF7A00' }} data-confirm-answer>Yes, send</button>
              <button type="button" onClick={() => setConfirmId('')} className="neo-button rounded-full px-4 py-2 text-sm font-bold text-[var(--text-primary)]">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
