import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { clearWork, enqueueWork, getWork, pauseWork, restoreWork, resumeWork, subscribeWork, workActive, workSummary, type WorkState } from '../../lib/workQueue';
import './fluidOrb.css';

// The Master Agent, present on every page as a small orb. It shows what the team is working on,
// says when work is finished and offers the next step. It only shows real task results.
// The orb can be dragged anywhere on the screen, and it can read its message aloud.

type Notice = { text: string; to?: string; yes?: string; action?: 'refresh-demos' | 'draft-outreach' | 'draft-followup' };
type Spot = { x: number; y: number };
type ChatTask = { id: string; agentName?: string; title: string; status: string; summary?: string; error?: string | null; link?: string };
type ChatLine = { id: string; side: 'me' | 'ai'; text: string; tasks?: ChatTask[] };

const POS_KEY = 'cr-orb-pos';
const SNOOZE_KEY = 'cr-demo-update-later';
const DUP_KEY = 'cr-duplicate-notice';
const MAIL_KEY = 'cr-outreach-offer';
const FOLLOWUP_KEY = 'cr-followup-offer';
const REPLY_KEY = 'cr-replies-told';
const lineId = () => Math.random().toString(36).slice(2, 9);
const postTeam = async (body: Record<string, unknown>) => {
  const response = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let result: any = null;
  try { result = JSON.parse(await response.text()); } catch { /* not JSON */ }
  if (!response.ok || !result?.success) throw new Error(result?.error || `server error ${response.status}`);
  return result.data;
};
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

const HIDE_AFTER = 8000;

export default function MasterFloat() {
  const navigate = useNavigate();
  const location = useLocation();
  const [work, setWork] = useState<WorkState>(getWork());
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [typing, setTyping] = useState(false);
  const chatEnd = useRef<HTMLDivElement | null>(null);
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
        if (workActive()) return;
        const snoozed = Date.now() - Number(localStorage.getItem(SNOOZE_KEY) || 0) < 24 * 3600 * 1000;
        const response = await fetch('/api/team?view=demo-updates');
        const body = JSON.parse(await response.text());
        // Business names saved more than once: said once a week at most.
        const repeats = body?.data?.duplicates;
        if (body?.success && repeats?.names > 0 && Date.now() - Number(localStorage.getItem(DUP_KEY) || 0) > 7 * 24 * 3600 * 1000) {
          localStorage.setItem(DUP_KEY, String(Date.now()));
          addNotice({ to: '/leads/duplicates', yes: 'Review them', text: `${repeats.names} business ${repeats.names === 1 ? 'name is' : 'names are'} saved more than once (for example ${repeats.example})${repeats.likelySame ? `; ${repeats.likelySame} look like the same business saved twice` : ''}. You can merge them or keep them as separate branches. Nothing was deleted.` });
        }
        // Client replies not yet looked at: said once for each newest reply.
        const news = body?.data?.replies;
        if (body?.success && news?.fresh > 0 && news.newest && localStorage.getItem(REPLY_KEY) !== news.newest) {
          localStorage.setItem(REPLY_KEY, String(news.newest));
          addNotice({ to: '/replies', yes: 'Read them', text: `${news.fresh} ${news.fresh === 1 ? 'reply' : 'replies'} to your outreach ${news.fresh === 1 ? 'is' : 'are'} waiting${news.good ? `; ${news.good} ${news.good === 1 ? 'looks' : 'look'} promising` : ''}.` });
        }
        // Demos that are ready but were never emailed: offered once a day at most.
        const mail = body?.data?.outreach;
        if (body?.success && mail?.ready > 0 && Date.now() - Number(localStorage.getItem(MAIL_KEY) || 0) > 24 * 3600 * 1000) {
          localStorage.setItem(MAIL_KEY, String(Date.now()));
          addNotice({ action: 'draft-outreach', yes: 'Yes, write them', text: `${mail.ready} ${mail.ready === 1 ? 'lead has' : 'leads have'} a ready demo and an email address but ${mail.ready === 1 ? 'has' : 'have'} not been written to. Shall I have the Outreach Agent write the emails? You read them and approve once; nothing is sent before that.` });
        }
        // Leads written to days ago that never replied: offered once a day at most.
        const follow = body?.data?.followup;
        if (body?.success && follow?.ready > 0 && Date.now() - Number(localStorage.getItem(FOLLOWUP_KEY) || 0) > 24 * 3600 * 1000) {
          localStorage.setItem(FOLLOWUP_KEY, String(Date.now()));
          addNotice({ action: 'draft-followup', yes: 'Yes, write them', text: `${follow.ready} ${follow.ready === 1 ? 'lead was' : 'leads were'} written to at least 3 days ago and ${follow.ready === 1 ? 'has' : 'have'} not replied. Shall I have the Outreach Agent write a polite follow-up for ${follow.ready === 1 ? 'it' : 'them'}? You read ${follow.ready === 1 ? 'it' : 'them'} and approve once; nothing is sent before that.` });
        }
        const count = Number(body?.data?.count) || 0;
        if (!body?.success || !count || snoozed) return;
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

  const startOutreach = async () => {
    dropNotice();
    setOpen(true);
    setThinking(true);
    try {
      const data = await postTeam({ action: 'chat', message: 'Draft outreach emails for my leads with ready demos', history: [] });
      say({ side: 'ai', text: String(data.reply || ''), tasks: Array.isArray(data.tasks) ? data.tasks : [] });
    } catch (error) {
      say({ side: 'ai', text: `I could not start the drafts: ${error instanceof Error ? error.message : 'unknown reason'}.` });
    }
    setThinking(false);
  };

  const startFollowUp = async () => {
    dropNotice();
    setOpen(true);
    setThinking(true);
    try {
      const data = await postTeam({ action: 'chat', message: 'Follow up with the leads that did not reply', history: [] });
      say({ side: 'ai', text: String(data.reply || ''), tasks: Array.isArray(data.tasks) ? data.tasks : [] });
    } catch (error) {
      say({ side: 'ai', text: `I could not start the follow-ups: ${error instanceof Error ? error.message : 'unknown reason'}.` });
    }
    setThinking(false);
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
    if (notice.action === 'draft-outreach') {
      yes = { label: notice.yes || 'Yes', run: () => void startOutreach() };
      no = { label: 'Not now', run: dropNotice };
    } else if (notice.action === 'draft-followup') {
      yes = { label: notice.yes || 'Yes', run: () => void startFollowUp() };
      no = { label: 'Not now', run: dropNotice };
    } else if (notice.action === 'refresh-demos') {
      yes = { label: notice.yes || 'Yes', run: () => void startRefresh() };
      no = { label: 'Not now', run: () => { try { localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch { /* ignore */ } dropNotice(); } };
    } else {
      if (notice.to) yes = { label: notice.yes || 'Open', run: () => { const to = notice.to as string; dropNotice(); navigate(to); } };
      no = { label: yes ? 'Later' : 'OK', run: dropNotice };
    }
  }

  // ---- Chat: ask the Master Agent from any page. The same server, records and approvals as the home chat.
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'nearest' }); }, [chat, thinking]);
  const say = (line: Omit<ChatLine, 'id'>) => setChat((current) => [...current.slice(-11), { ...line, id: lineId() }]);
  const patchTask = (taskId: string, change: Partial<ChatTask>) => setChat((current) => current.map((line) => (line.tasks ? { ...line, tasks: line.tasks.map((task) => (task.id === taskId ? { ...task, ...change } : task)) } : line)));
  const runTask = async (task: ChatTask, approve: boolean) => {
    patchTask(task.id, { status: 'running', error: null });
    try {
      const data = await postTeam({ action: 'run', taskId: task.id, approve });
      patchTask(task.id, { status: data.status, summary: data.summary, error: data.error });
      if (Array.isArray(data.output?.queue) && data.output.queue.length) enqueueWork(data.output.queue);
      say({ side: 'ai', text: String(data.summary || data.error || 'Done.') });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown reason';
      patchTask(task.id, { status: 'failed', error: reason });
      say({ side: 'ai', text: `Could not finish "${task.title}": ${reason}` });
    }
  };
  const declineTask = async (task: ChatTask) => {
    try { await postTeam({ action: 'cancel', taskId: task.id }); patchTask(task.id, { status: 'cancelled' }); } catch (error) { patchTask(task.id, { error: error instanceof Error ? error.message : 'Could not decline' }); }
  };
  const send = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const words = draft.trim();
    if (!words || thinking) return;
    setDraft('');
    say({ side: 'me', text: words });
    const word = words.toLowerCase().replace(/[.!?]+$/, '');
    if (/^(hold on|hold up|pause|wait|stop|stop for now|not now)( please)?$/.test(word) && workActive() && !getWork().paused) { pauseWork(); say({ side: 'ai', text: 'Paused. The task running right now will finish, then I wait. Say continue when you are ready.' }); return; }
    if (/^(continue|resume|go on|go ahead|carry on|ok continue)( please)?$/.test(word) && getWork().paused) { resumeWork(); say({ side: 'ai', text: 'Continuing with the rest of the queue.' }); return; }
    setThinking(true);
    try {
      const history = chat.slice(-6).map((line) => `${line.side === 'me' ? 'Timothy' : 'Master Agent'}: ${line.text}`);
      const data = await postTeam({ action: 'chat', message: words, history });
      const tasks: ChatTask[] = Array.isArray(data.tasks) ? data.tasks : [];
      setThinking(false);
      say({ side: 'ai', text: String(data.reply || ''), tasks });
      // Tasks that need no approval start straight away, one after another.
      for (const task of tasks.filter((item) => item.status === 'queued')) await runTask(task, false);
    } catch (error) {
      setThinking(false);
      say({ side: 'ai', text: `I could not reach the team server: ${error instanceof Error ? error.message : 'unknown reason'}.` });
    }
  };

  // ---- Voice: reads the current message aloud when asked. Never speaks by itself.
  useEffect(() => { setVoiceNote(''); }, [text]);

  // The panel tucks itself away: at once when you touch or scroll the page behind it,
  // and after a few quiet seconds. It stays while you type, while an answer is on its way, or while it is speaking.
  const busy = typing || thinking || voice !== 'idle' || draft.trim().length > 0;
  const [touched, setTouched] = useState(0);
  useEffect(() => {
    if (!open) return;
    const inside = (event: Event) => event.target instanceof Element && Boolean(event.target.closest('[data-master-float]'));
    const away = (event: Event) => { if (inside(event)) setTouched(Date.now()); else setOpen(false); };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('wheel', away, { capture: true, passive: true });
    const timer = busy ? 0 : window.setTimeout(() => setOpen(false), HIDE_AFTER);
    return () => { document.removeEventListener('pointerdown', away, true); document.removeEventListener('wheel', away, true); if (timer) window.clearTimeout(timer); };
  }, [open, busy, touched, text, chat.length]);
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
    setOpen((value) => !value);
  };

  // On the home page the full chat is already there, so the orb only appears when it has something to report.
  if (!text && onAssistant) return null;
  const lastReply = [...chat].reverse().find((line) => line.side === 'ai')?.text || '';
  const toRead = text || lastReply;

  const left = spot.x + SIZE / 2 < window.innerWidth / 2;
  const upper = spot.y < window.innerHeight / 2;
  const bubbleWidth = Math.min(320, window.innerWidth - 2 * EDGE);
  const bubbleStyle: React.CSSProperties = {
    position: 'fixed', zIndex: 70, width: bubbleWidth,
    left: left ? EDGE : undefined, right: left ? undefined : EDGE,
    // While typing on a phone the panel moves to the top, clear of the keyboard.
    top: typing ? 76 : upper ? spot.y + SIZE + 8 : undefined, bottom: typing || upper ? undefined : window.innerHeight - spot.y + 8,
    maxHeight: Math.max(220, typing ? window.innerHeight * 0.5 : upper ? window.innerHeight - spot.y - SIZE - 8 - EDGE : spot.y - 8 - 76), overflowY: 'auto',
    background: 'rgba(8,16,36,0.96)', color: '#eaf1ff', border: '1px solid rgba(120,170,255,0.28)',
  };

  return (
    <div data-master-float>
      {open && !dragging && (
        <div role="status" aria-live="polite" className="rounded-2xl px-4 py-3 text-sm shadow-2xl" style={bubbleStyle} data-float-bubble>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: '#8fb7ff' }}>Master Agent</p>
            {toRead && <button type="button" onClick={() => void speak(toRead)} aria-label={voice === 'idle' ? 'Read this aloud' : 'Stop speaking'} className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ border: '1px solid rgba(255,255,255,0.25)', color: '#eaf1ff' }} data-float-speak>
              {voice === 'idle' ? 'Listen' : voice === 'loading' ? 'Loading...' : 'Stop'}
            </button>}
          </div>
          {text && <p className="mt-1 leading-5 break-words" data-float-status>{text}</p>}
          {voiceNote && <p className="mt-1 text-xs" style={{ color: '#ffb37a' }}>{voiceNote}</p>}
          {active && <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}><div style={{ width: `${sum.total ? Math.round(((sum.done + sum.failed) / sum.total) * 100) : 0}%`, height: '100%', background: '#ff7a00', transition: 'width 400ms' }} /></div>}
          {(yes || no) && <div className="mt-3 flex flex-wrap gap-2">
            {yes && <button type="button" onClick={yes.run} className="rounded-full px-3.5 py-1.5 text-xs font-bold text-white" style={{ background: '#ff7a00' }}>{yes.label}</button>}
            {no && <button type="button" onClick={no.run} className="rounded-full px-3.5 py-1.5 text-xs font-bold" style={{ border: '1px solid rgba(255,255,255,0.25)', color: '#eaf1ff' }}>{no.label}</button>}
          </div>}
          {(chat.length > 0 || thinking) && (
            <div className="mt-3 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: '34vh', borderTop: text ? '1px solid rgba(255,255,255,0.12)' : undefined, paddingTop: text ? 10 : 0 }} data-float-chat>
              {chat.map((line) => (
                <div key={line.id} className={line.side === 'me' ? 'text-right' : ''}>
                  <span className="inline-block rounded-2xl px-3 py-2 text-left break-words" style={{ maxWidth: '92%', background: line.side === 'me' ? 'rgba(255,122,0,0.22)' : 'rgba(255,255,255,0.07)' }}>{line.text}</span>
                  {line.tasks?.filter((task) => task.status === 'waiting_approval').map((task) => (
                    <div key={task.id} className="mt-2 rounded-xl p-2 text-left text-xs" style={{ border: '1px solid rgba(255,255,255,0.16)' }}>
                      <p className="font-semibold break-words">{task.title}</p>
                      <div className="mt-2 flex gap-2">
                        {task.link ? <button type="button" onClick={() => { const to = task.link as string; setOpen(false); navigate(to); }} className="rounded-full px-3 py-1.5 font-bold text-white" style={{ background: '#ff7a00' }} data-task-link>Review drafts</button> : <button type="button" onClick={() => void runTask(task, true)} className="rounded-full px-3 py-1.5 font-bold text-white" style={{ background: '#ff7a00' }}>Approve</button>}
                        <button type="button" onClick={() => void declineTask(task)} className="rounded-full px-3 py-1.5 font-bold" style={{ border: '1px solid rgba(255,255,255,0.25)' }}>Decline</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {thinking && <p className="text-xs" style={{ color: '#9fb0d0' }}>Thinking...</p>}
              <div ref={chatEnd} />
            </div>
          )}
          <form onSubmit={(event) => void send(event)} className="mt-3 flex gap-2" data-float-form>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask the Master Agent..." aria-label="Message to the Master Agent" onFocus={() => setTyping(window.innerWidth < 860)} onBlur={() => window.setTimeout(() => setTyping(false), 250)} enterKeyHint="send" className="min-w-0 flex-1 rounded-full px-3.5 py-2 outline-none" style={{ fontSize: 16, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#eaf1ff' }} />
            <button type="submit" disabled={!draft.trim() || thinking} className="rounded-full px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40" style={{ background: '#ff7a00' }}>Send</button>
          </form>
          <div className="mt-2 flex items-center justify-between text-xs" style={{ color: '#9fb0d0' }}>
            {!onAssistant ? <button type="button" onClick={() => { setOpen(false); navigate('/'); }} className="underline">Open full chat</button> : <span />}
            <button type="button" onClick={() => setOpen(false)}>Hide</button>
          </div>
        </div>
      )}
      <button
        type="button"
        data-float-orb
        aria-label={text ? 'Master Agent update. Tap to open, drag to move.' : 'Talk to the Master Agent. Tap to open, drag to move.'}
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
