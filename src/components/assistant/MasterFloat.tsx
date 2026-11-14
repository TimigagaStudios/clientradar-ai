import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { clearWork, getWork, pauseWork, restoreWork, resumeWork, subscribeWork, workActive, workSummary, type WorkState } from '../../lib/workQueue';
import './fluidOrb.css';

// The Master Agent, present on every page as a small orb. It shows what the team is working on,
// says when work is finished and offers the next step. It only shows real task results.

type Notice = { text: string; to?: string; yes?: string };

export default function MasterFloat() {
  const navigate = useNavigate();
  const location = useLocation();
  const [work, setWork] = useState<WorkState>(getWork());
  const [notice, setNotice] = useState<Notice | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const stop = subscribeWork((next) => { setWork({ ...next }); setOpen(true); });
    restoreWork();
    const onNotice = (event: Event) => { const detail = (event as CustomEvent).detail; if (detail?.text) { setNotice(detail); setOpen(true); } };
    window.addEventListener('cr-notice', onNotice);
    return () => { stop(); window.removeEventListener('cr-notice', onNotice); };
  }, []);

  const sum = workSummary(work);
  const active = workActive();
  const onAssistant = location.pathname === '/';

  let text = '';
  let yes: { label: string; run: () => void } | null = null;
  let no: { label: string; run: () => void } | null = null;
  if (active && work.paused) {
    text = `Paused. ${sum.done} of ${sum.total} done, ${sum.left} waiting.`;
    yes = { label: 'Continue', run: resumeWork };
  } else if (active) {
    text = `Working: ${sum.done} of ${sum.total} done.${sum.running ? ` Now: ${sum.running.title}.` : ''}`;
    no = { label: 'Hold on', run: pauseWork };
  } else if (work.finished && sum.total) {
    const written = sum.done ? ` (${sum.ai} written by the AI${sum.done - sum.ai ? `, ${sum.done - sum.ai} with built-in text` : ''})` : '';
    text = `${sum.done} of ${sum.total} ${sum.total === 1 ? 'demo is' : 'demos are'} ready${written}.${sum.failed ? ` ${sum.failed} could not be built; see AI Team.` : ''} Preview now?`;
    yes = { label: 'Yes, show me', run: () => { clearWork(); navigate('/demos'); } };
    no = { label: 'Later', run: clearWork };
  } else if (notice) {
    text = notice.text;
    if (notice.to) yes = { label: notice.yes || 'Open', run: () => { const to = notice.to as string; setNotice(null); navigate(to); } };
    no = { label: yes ? 'Later' : 'OK', run: () => setNotice(null) };
  }

  // Nothing to say: a quiet orb that opens the chat (not shown on the chat page itself).
  if (!text && onAssistant) return null;

  return (
    <div data-master-float className="fixed z-[70] flex flex-col items-end gap-2" style={{ right: '14px', bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))', maxWidth: 'min(320px, calc(100vw - 28px))' }}>
      {text && open && (
        <div role="status" aria-live="polite" className="rounded-2xl px-4 py-3 text-sm shadow-2xl" style={{ background: 'rgba(8,16,36,0.96)', color: '#eaf1ff', border: '1px solid rgba(120,170,255,0.28)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: '#8fb7ff' }}>Master Agent</p>
          <p className="mt-1 leading-5 break-words">{text}</p>
          {active && <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}><div style={{ width: `${sum.total ? Math.round(((sum.done + sum.failed) / sum.total) * 100) : 0}%`, height: '100%', background: '#ff7a00', transition: 'width 400ms' }} /></div>}
          <div className="mt-3 flex flex-wrap gap-2">
            {yes && <button type="button" onClick={yes.run} className="rounded-full px-3.5 py-1.5 text-xs font-bold text-white" style={{ background: '#ff7a00' }}>{yes.label}</button>}
            {no && <button type="button" onClick={no.run} className="rounded-full px-3.5 py-1.5 text-xs font-bold" style={{ border: '1px solid rgba(255,255,255,0.25)', color: '#eaf1ff' }}>{no.label}</button>}
            {active && <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1.5 text-xs" style={{ color: '#9fb0d0' }}>Hide</button>}
          </div>
        </div>
      )}
      <button
        type="button"
        aria-label={text ? 'Master Agent update' : 'Talk to the Master Agent'}
        onClick={() => { if (text && !open) setOpen(true); else if (!onAssistant) navigate('/'); }}
        className="relative flex h-12 w-12 items-center justify-center rounded-full shadow-xl"
        style={{ background: 'rgba(8,16,36,0.92)', border: '1px solid rgba(120,170,255,0.35)' }}
      >
        <span className="mini-orb" aria-hidden="true" style={{ width: 30, height: 30 }} />
        {(active || (text && !open)) && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full" style={{ background: '#ff7a00', border: '2px solid #081024' }} />}
      </button>
    </div>
  );
}
