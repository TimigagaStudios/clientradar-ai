import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { clearWork, enqueueWork, getWork, pauseWork, restoreWork, resumeWork, subscribeWork, workActive, workSummary, type WorkState } from '../../lib/workQueue';
import './fluidOrb.css';

// The Master Agent, present on every page as a small orb. It shows what the team is working on,
// says when work is finished and offers the next step. It only shows real task results.
// The orb can be dragged anywhere on the screen, and it can read its message aloud.

type Notice = { text: string; to?: string; yes?: string; action?: 'refresh-demos' };
type Spot = { x: number; y: number };

const POS_KEY = 'cr-orb-pos';
const SNOOZE_KEY = 'cr-demo-update-later';
const SIZE = 48;
const EDGE = 10;

const clampSpot = (spot: Spot): Spot => ({
  x: Math.max(EDGE, Math.min(window.innerWidth - SIZE - EDGE, spot.x)),
  y: Math.max(EDGE + 64, Math.min(window.innerHeight - SIZE - EDGE, spot.y)),
});
const startSpot = (): Spot => {
  try {
    const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') return clampSpot(saved);
  } catch { /* nothing saved */ }
  return clampSpot({ x: window.innerWidth, y: window.innerHeight - SIZE - 14 });
};

export default function MasterFloat() {
  const navigate = useNavigate();
  const location = useLocation();
  const [work, setWork] = useState<WorkState>(getWork());
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(true);
  const [spot, setSpot] = useState<Spot>(startSpot);
  const [dragging, setDragging] = useState(false);
  const [voice, setVoice] = useState<'idle' | 'loading' | 'speaking'>('idle');
  const [voiceNote, setVoiceNote] = useState('');
  const drag = useRef<{ id: number; dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);
  const audio = useRef<{ context: AudioContext | null; source: AudioBufferSourceNode | null; seq: number }>({ context: null, source: null, seq: 0 });

  const addNotice = (notice: Notice) => { setNotices((current) => (current.some((item) => item.text === notice.text) ? current : [...current, notice])); setOpen(true); };
  const dropNotice = () => setNotices((current) => current.slice(1));

  useEffect(() => {
    const stop = subscribeWork((next) => { setWork({ ...next }); setOpen(true); });
    restoreWork();
    const onNotice = (event: Event) => { const detail = (event as CustomEvent).detail; if (detail?.text) addNotice(detail); };
    const onResize = () => setSpot((current) => clampSpot(current));
    window.addEventListener('cr-notice', onNotice);
    window.addEventListener('resize', onResize);
    // The Records Upkeep Agent checks for demos built before the newest sections existed and reports here.
    const timer = window.setTimeout(async () => {
      try {
        if (Date.now() - Number(localStorage.getItem(SNOOZE_KEY) || 0) < 24 * 3600 * 1000 || workActive()) return;
        const response = await fetch('/api/team?view=demo-updates');
        const body = JSON.parse(await response.text());
        const count = Number(body?.data?.count) || 0;
        if (!body?.success || !count) return;
        const label: Record<string, string> = { faq: 'a "Common questions" section', process: 'a "How it works" section', photos: 'photos' };
        const sections = (body.data.sections || []).map((key: string) => label[key] || key).join(', ');
        addNotice({ action: 'refresh-demos', yes: `Yes, update ${count === 1 ? 'it' : 'them'}`, text: `The records agent found ${count} ${count === 1 ? 'demo' : 'demos'} built before the latest upgrade. What can be added: ${sections}. Shall I update ${count === 1 ? 'it' : 'them'}? The existing wording and the link stay the same.` });
      } catch { /* the check is optional */ }
    }, 7000);
    return () => { stop(); window.removeEventListener('cr-notice', onNotice); window.removeEventListener('resize', onResize); window.clearTimeout(timer); stopVoice(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRefresh = async () => {
    dropNotice();
    try {
      const response = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'demo-refresh-start' }) });
      const body = JSON.parse(await response.text());
      if (!body?.success) throw new Error(body?.error || 'server error');
      if (body.data?.queue?.length) enqueueWork(body.data.queue);
      else addNotice({ text: 'Every demo is already up to date.' });
    } catch (error) {
      addNotice({ text: `I could not start the update: ${error instanceof Error ? error.message : 'unknown reason'}.` });
    }
  };

  const sum = workSummary(work);
  const active = workActive();
  const onAssistant = location.pathname === '/';
  const updating = work.items.length > 0 && work.items.every((item) => /^Update /.test(item.title));
  const notice = notices[0] || null;

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
    const written = sum.done && !updating ? ` (${sum.ai} written by the AI${sum.done - sum.ai ? `, ${sum.done - sum.ai} with built-in text` : ''})` : '';
    const plural = sum.total === 1 ? 'demo is' : 'demos are';
    text = `${sum.done} of ${sum.total} ${plural} ${updating ? 'updated' : 'ready'}${written}.${sum.failed ? ` ${sum.failed} could not be ${updating ? 'updated' : 'built'}; see AI Team.` : ''}${updating ? ' The AI Team page lists what was added to each.' : ''} Preview now?`;
    yes = { label: 'Yes, show me', run: () => { clearWork(); navigate('/demos'); } };
    no = { label: 'Later', run: clearWork };
  } else if (notice) {
    text = notice.text;
    if (notice.action === 'refresh-demos') {
      yes = { label: notice.yes || 'Yes', run: () => void startRefresh() };
      no = { label: 'Not now', run: () => { try { localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch { /* ignore */ } dropNotice(); } };
    } else {
      if (notice.to) yes = { label: notice.yes || 'Open', run: () => { const to = notice.to as string; dropNotice(); navigate(to); } };
      no = { label: yes ? 'Later' : 'OK', run: dropNotice };
    }
  }

  // ---- Voice: reads the current message aloud when asked. Never speaks by itself.
  useEffect(() => { setVoiceNote(''); }, [text]);
  function stopVoice() {
    audio.current.seq += 1;
    try { audio.current.source?.stop(); } catch { /* already stopped */ }
    audio.current.source = null;
    try { window.speechSynthesis?.cancel(); } catch { /* not available */ }
    setVoice('idle');
  }
  const speak = async (words: string) => {
    if (voice !== 'idle') { stopVoice(); return; }
    setVoiceNote('');
    const seq = audio.current.seq + 1;
    audio.current.seq = seq;
    // The audio must be unlocked inside the tap itself, or iPhone stays silent.
    let context: AudioContext | null = null;
    try {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (Ctor) { context = audio.current.context || new Ctor(); audio.current.context = context; if (context && context.state === 'suspended') void context.resume(); }
    } catch { context = null; }
    setVoice('loading');
    try {
      if (!context) throw new Error('no audio');
      const response = await fetch('/api/demo-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'speak', text: words.slice(0, 600) }) });
      if (!response.ok || !(response.headers.get('content-type') || '').startsWith('audio/')) throw new Error('voice not available');
      const buffer = await context.decodeAudioData((await response.arrayBuffer()).slice(0));
      if (seq !== audio.current.seq) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => { if (audio.current.source === source) { audio.current.source = null; setVoice('idle'); } };
      audio.current.source = source;
      setVoice('speaking');
      source.start();
    } catch {
      if (seq !== audio.current.seq) return;
      // The device's own voice is the stand-in when the natural voice cannot be reached.
      try {
        const line = new SpeechSynthesisUtterance(words);
        line.onend = () => setVoice('idle');
        line.onerror = () => { setVoice('idle'); setVoiceNote('Voice is not available right now.'); };
        window.speechSynthesis.speak(line);
        setVoice('speaking');
      } catch {
        setVoice('idle');
        setVoiceNote('Voice is not available right now.');
      }
    }
  };

  // ---- Dragging: hold the orb and move it; it stays where you leave it.
  const onDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    drag.current = { id: event.pointerId, dx: event.clientX - spot.x, dy: event.clientY - spot.y, sx: event.clientX, sy: event.clientY, moved: false };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* not supported */ }
  };
  const onMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    if (!state.moved && Math.hypot(event.clientX - state.sx, event.clientY - state.sy) < 7) return;
    state.moved = true;
    setDragging(true);
    setSpot(clampSpot({ x: event.clientX - state.dx, y: event.clientY - state.dy }));
  };
  const onUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    drag.current = null;
    if (!state) return;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* not supported */ }
    if (state.moved) {
      setDragging(false);
      // Rest against the nearer side so it never sits in the middle of the page.
      const rested = clampSpot({ x: spot.x + SIZE / 2 < window.innerWidth / 2 ? 0 : window.innerWidth, y: spot.y });
      setSpot(rested);
      try { localStorage.setItem(POS_KEY, JSON.stringify(rested)); } catch { /* ignore */ }
      return;
    }
    if (text && !open) setOpen(true);
    else if (text) setOpen(false);
    else if (!onAssistant) navigate('/');
  };

  // Nothing to say: a quiet orb that opens the chat (not shown on the chat page itself).
  if (!text && onAssistant) return null;

  const left = spot.x + SIZE / 2 < window.innerWidth / 2;
  const upper = spot.y < window.innerHeight / 2;
  const bubbleWidth = Math.min(320, window.innerWidth - 2 * EDGE);
  const bubbleStyle: React.CSSProperties = {
    position: 'fixed', zIndex: 70, width: bubbleWidth,
    left: left ? EDGE : undefined, right: left ? undefined : EDGE,
    top: upper ? spot.y + SIZE + 8 : undefined, bottom: upper ? undefined : window.innerHeight - spot.y + 8,
    background: 'rgba(8,16,36,0.96)', color: '#eaf1ff', border: '1px solid rgba(120,170,255,0.28)',
  };

  return (
    <div data-master-float>
      {text && open && !dragging && (
        <div role="status" aria-live="polite" className="rounded-2xl px-4 py-3 text-sm shadow-2xl" style={bubbleStyle} data-float-bubble>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: '#8fb7ff' }}>Master Agent</p>
            <button type="button" onClick={() => void speak(text)} aria-label={voice === 'idle' ? 'Read this aloud' : 'Stop speaking'} className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ border: '1px solid rgba(255,255,255,0.25)', color: '#eaf1ff' }} data-float-speak>
              {voice === 'idle' ? 'Listen' : voice === 'loading' ? 'Loading...' : 'Stop'}
            </button>
          </div>
          <p className="mt-1 leading-5 break-words">{text}</p>
          {voiceNote && <p className="mt-1 text-xs" style={{ color: '#ffb37a' }}>{voiceNote}</p>}
          {active && <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}><div style={{ width: `${sum.total ? Math.round(((sum.done + sum.failed) / sum.total) * 100) : 0}%`, height: '100%', background: '#ff7a00', transition: 'width 400ms' }} /></div>}
          <div className="mt-3 flex flex-wrap gap-2">
            {yes && <button type="button" onClick={yes.run} className="rounded-full px-3.5 py-1.5 text-xs font-bold text-white" style={{ background: '#ff7a00' }}>{yes.label}</button>}
            {no && <button type="button" onClick={no.run} className="rounded-full px-3.5 py-1.5 text-xs font-bold" style={{ border: '1px solid rgba(255,255,255,0.25)', color: '#eaf1ff' }}>{no.label}</button>}
            <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1.5 text-xs" style={{ color: '#9fb0d0' }}>Hide</button>
          </div>
        </div>
      )}
      <button
        type="button"
        data-float-orb
        aria-label={text ? 'Master Agent update. Drag to move.' : 'Talk to the Master Agent. Drag to move.'}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
        className="flex items-center justify-center rounded-full shadow-xl"
        style={{ position: 'fixed', zIndex: 71, left: spot.x, top: spot.y, width: SIZE, height: SIZE, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', cursor: dragging ? 'grabbing' : 'grab', background: 'rgba(8,16,36,0.92)', border: `1px solid ${voice === 'speaking' ? '#ff7a00' : 'rgba(120,170,255,0.35)'}`, transition: dragging ? 'none' : 'left 220ms ease, top 220ms ease', transform: dragging ? 'scale(1.08)' : undefined }}
      >
        <span className="mini-orb" aria-hidden="true" style={{ width: 30, height: 30, pointerEvents: 'none' }} />
        {(active || (text && !open)) && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full" style={{ background: '#ff7a00', border: '2px solid #081024' }} />}
      </button>
    </div>
  );
}
