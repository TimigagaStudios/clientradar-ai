import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

// Batch outreach: every draft the Outreach Agent wrote, for ONE approval.
// Nothing is sent until "Approve and send" is confirmed. Drafts can be changed or left out first.

type Draft = { leadId: string; name: string; email: string; subject: string; body: string; demoUrl: string; writtenBy: 'ai' | 'built-in'; state: 'pending' | 'skipped' | 'sent' | 'failed'; error?: string };
type Batch = { id: string; title: string; status: string; mailReady: boolean; drafts: Draft[] };

const call = async (url: string, body?: Record<string, unknown>) => {
  const response = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  let result: any = null;
  try { result = JSON.parse(await response.text()); } catch { /* not JSON */ }
  if (!response.ok || !result?.success) throw new Error(result?.error || `server error ${response.status}`);
  return result.data;
};
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const STATE: Record<string, string> = { pending: 'Ready to send', skipped: 'Left out', sent: 'Sent', failed: 'Not sent' };

export default function OutreachDrafts() {
  const { taskId = '' } = useParams();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const stop = useRef(false);

  const load = useCallback(async () => {
    try { setBatch(await call(`/api/team?view=outreach-drafts&taskId=${encodeURIComponent(taskId)}`)); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load the drafts'); }
  }, [taskId]);
  useEffect(() => { void load(); return () => { stop.current = true; }; }, [load]);

  const change = (leadId: string, patch: Partial<Draft>) => setBatch((current) => (current ? { ...current, drafts: current.drafts.map((draft) => (draft.leadId === leadId ? { ...draft, ...patch } : draft)) } : current));
  const editable = batch?.status === 'waiting_approval' && !sending;
  const drafts = batch?.drafts || [];
  const count = (state: Draft['state']) => drafts.filter((draft) => draft.state === state).length;

  // One email per server call, with a short pause, so one failure never stops the rest.
  const sendAll = async (list: Draft[]) => {
    setSending(true);
    stop.current = false;
    let sent = 0;
    let failed = 0;
    for (const draft of list.filter((item) => item.state === 'pending')) {
      if (stop.current) break;
      try {
        const out = await call('/api/team', { action: 'outreach-send', taskId, leadId: draft.leadId });
        change(draft.leadId, { state: out.draft.state, error: out.draft.error });
        if (out.draft.state === 'sent') sent += 1;
        if (out.draft.state === 'failed') failed += 1;
        // The key itself was refused: every other email would fail the same way, so stop here.
        if (out.draft.state === 'failed' && /did not accept the API key/i.test(String(out.draft.error || ''))) { setError('Brevo did not accept the API key, so I stopped. Nothing else was tried. Replace the key, then tap "Try again".'); break; }
      } catch (reason) {
        setError(`Stopped at ${draft.name}: ${reason instanceof Error ? reason.message : 'no connection'}. The rest were not sent; tap "Send the rest" to carry on.`);
        break;
      }
      await wait(700);
    }
    setSending(false);
    await load();
    // The orb reports what really happened, never more.
    const mails = (count: number) => `${count} ${count === 1 ? 'email' : 'emails'}`;
    const text = sent && !failed ? `${mails(sent)} sent. ${sent === 1 ? 'That lead is' : 'Those leads are'} now marked "Email Sent".` : sent ? `${mails(sent)} sent, ${failed} could not be sent. The drafts page shows why.` : failed ? `No email was sent: ${failed === 1 ? 'the email' : `all ${failed} emails`} failed. The drafts page shows why; nothing was marked as sent.` : '';
    if (text) window.dispatchEvent(new CustomEvent('cr-notice', { detail: sent ? { text, to: '/leads', yes: 'Open leads' } : { text } }));
  };

  const approve = async () => {
    setConfirm(false);
    setError('');
    try {
      const approved: Batch = await call('/api/team', { action: 'outreach-approve', taskId, confirm: true, drafts: drafts.map((draft) => ({ leadId: draft.leadId, subject: draft.subject, body: draft.body, skip: draft.state === 'skipped' })) });
      setBatch(approved);
      await sendAll(approved.drafts);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not approve'); }
  };
  const retry = async () => {
    setError('');
    try {
      const again: Batch = await call('/api/team', { action: 'outreach-retry', taskId });
      setBatch(again);
      await sendAll(again.drafts);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not try again'); }
  };
  const decline = async () => {
    try { await call('/api/team', { action: 'cancel', taskId }); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not decline'); }
  };

  const toSend = count('pending');
  return (
    <div className="space-y-5 pb-28" data-outreach-drafts>
      <header>
        <Link to="/team" className="text-sm font-bold text-[#FF7A00]">Back to AI Team</Link>
        <h1 className="mt-2 text-2xl sm:text-3xl font-black text-[var(--text-primary)]">Outreach drafts</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {!batch ? 'Loading...' : batch.status === 'waiting_approval' ? `${drafts.length} ${drafts.length === 1 ? 'email is' : 'emails are'} written. Nothing has been sent. Tap one to read or change it.` : batch.status === 'cancelled' ? 'You declined this batch. Nothing was sent.' : `${count('sent')} sent${count('failed') ? `, ${count('failed')} not sent` : ''}${count('skipped') ? `, ${count('skipped')} left out` : ''}${toSend ? `, ${toSend} still to send` : ''}.`}
        </p>
      </header>
      {error && <p className="neo-card p-4 text-sm text-red-400" role="alert">{error}</p>}
      {batch && !batch.mailReady && batch.status === 'waiting_approval' && <p className="neo-card p-4 text-sm text-[#FF7A00]">Email sending is not set up in Vercel (Brevo settings missing), so these cannot be sent yet.</p>}

      {drafts.map((draft) => (
        <section key={draft.leadId} className="neo-card p-4 sm:p-5" data-draft data-state={draft.state} style={{ opacity: draft.state === 'skipped' ? 0.55 : 1 }}>
          <button type="button" className="w-full text-left" onClick={() => setOpenId(openId === draft.leadId ? '' : draft.leadId)} aria-expanded={openId === draft.leadId}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-[var(--text-primary)] break-words">{draft.name}</p>
                <p className="text-xs text-[var(--text-secondary)] break-all">{draft.email}</p>
              </div>
              <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${draft.state === 'sent' ? 'text-green-500' : draft.state === 'failed' ? 'text-red-400' : 'text-[var(--text-secondary)]'}`}>{STATE[draft.state]}</span>
            </div>
            <p className="mt-2 text-sm text-[var(--text-primary)] break-words">{draft.subject}</p>
            <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{draft.writtenBy === 'ai' ? 'Opening written by the AI' : 'Built-in wording'}{openId === draft.leadId ? '' : ' - tap to read'}</p>
          </button>
          {draft.error && <p className="mt-2 text-xs text-red-400 break-words">{draft.error}</p>}
          {openId === draft.leadId && (
            <div className="mt-3 space-y-2">
              {editable ? (
                <>
                  <input value={draft.subject} onChange={(event) => change(draft.leadId, { subject: event.target.value })} aria-label="Subject" className="w-full rounded-xl neo-in px-3 py-2 text-sm text-[var(--text-primary)] outline-none" />
                  <textarea value={draft.body} onChange={(event) => change(draft.leadId, { body: event.target.value })} aria-label="Email text" rows={12} className="w-full rounded-xl neo-in px-3 py-2 text-sm leading-6 text-[var(--text-primary)] outline-none" />
                </>
              ) : <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-secondary)]">{draft.body}</p>}
              <div className="flex flex-wrap gap-2">
                <a href={draft.demoUrl} target="_blank" rel="noreferrer" className="neo-button rounded-full px-3.5 py-2 text-xs font-bold text-[var(--text-primary)]">Open the demo</a>
                {editable && <button type="button" onClick={() => change(draft.leadId, { state: draft.state === 'skipped' ? 'pending' : 'skipped' })} className="neo-button rounded-full px-3.5 py-2 text-xs font-bold text-[var(--text-primary)]" data-skip>{draft.state === 'skipped' ? 'Include again' : 'Leave this one out'}</button>}
              </div>
            </div>
          )}
        </section>
      ))}

      {batch && (batch.status === 'waiting_approval' || batch.status === 'running' || count('failed') > 0) && (
        <div className="sticky bottom-3 z-10 neo-card p-3 flex flex-wrap items-center gap-2" style={{ backdropFilter: 'blur(14px)' }}>
          {batch.status === 'waiting_approval' && !sending && <>
            <button type="button" disabled={!toSend || !batch.mailReady} onClick={() => setConfirm(true)} className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40" style={{ background: '#FF7A00' }} data-approve>Approve and send {toSend}</button>
            <button type="button" onClick={() => void decline()} className="neo-button rounded-full px-4 py-2.5 text-sm font-bold text-[var(--text-primary)]">Decline all</button>
          </>}
          {sending && <>
            <p className="text-sm font-semibold text-[var(--text-primary)]" role="status">Sending... {count('sent')} sent, {toSend} to go. Keep this page open.</p>
            <button type="button" onClick={() => { stop.current = true; }} className="neo-button rounded-full px-4 py-2 text-sm font-bold text-[var(--text-primary)]">Hold on</button>
          </>}
          {!sending && batch.status !== 'waiting_approval' && count('failed') > 0 && <button type="button" onClick={() => void retry()} className="rounded-full px-4 py-2.5 text-sm font-bold text-white" style={{ background: '#FF7A00' }} data-retry>Try again ({count('failed')} not sent)</button>}
          {batch.status === 'running' && !sending && toSend > 0 && <button type="button" onClick={() => void sendAll(drafts)} className="rounded-full px-4 py-2.5 text-sm font-bold text-white" style={{ background: '#FF7A00' }}>Send the rest ({toSend})</button>}
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} role="dialog" aria-modal="true" aria-label="Confirm sending">
          <div className="neo-card w-full max-w-md p-5 space-y-3">
            <h3 className="text-lg font-black text-[var(--text-primary)]">Send {toSend} {toSend === 1 ? 'email' : 'emails'} now?</h3>
            <p className="text-sm text-[var(--text-secondary)]">Real emails go to these businesses from your Brevo sender address. This cannot be taken back.{count('skipped') ? ` ${count('skipped')} left out.` : ''}</p>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => void approve()} className="rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: '#FF7A00' }} data-confirm-send>Yes, send</button>
              <button type="button" onClick={() => setConfirm(false)} className="neo-button rounded-full px-4 py-2 text-sm font-bold text-[var(--text-primary)]">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
