import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import {
  clearWork,
  enqueueWork,
  getWork,
  pauseWork,
  restoreWork,
  resumeWork,
  subscribeWork,
  workActive,
  workSummary,
  type WorkState,
} from '../../lib/workQueue';
import './fluidOrb.css';

// Docked Master Agent launcher + responsive bottom sheet.
// - Anchored cleanly to bottom-right with iOS safe-area support (never uses raw top pixels that jump on keyboard resize).
// - Automatically hides when typing in any page input/textarea/select outside the sheet.
// - Never pops open uninvited or auto-closes mid-read; shows a quiet badge or compact progress pill instead.
// - Hides on "/" and "/assistant" where the full Master Agent view is already on screen.

type Notice = {
  text: string;
  to?: string;
  yes?: string;
  action?: 'refresh-demos' | 'draft-outreach' | 'draft-followup';
};

type ChatTask = {
  id: string;
  agentName?: string;
  title: string;
  status: string;
  summary?: string;
  error?: string | null;
  link?: string;
};

type ChatLine = {
  id: string;
  side: 'me' | 'ai';
  text: string;
  tasks?: ChatTask[];
};

const SNOOZE_KEY = 'cr-demo-update-later';
const DUP_KEY = 'cr-duplicate-notice';
const MAIL_KEY = 'cr-outreach-offer';
const FOLLOWUP_KEY = 'cr-followup-offer';
const REPLY_KEY = 'cr-replies-told';
const PUSH_KEY = 'cr-push-offer';

const lineId = () => Math.random().toString(36).slice(2, 9);

const postTeam = async (body: Record<string, unknown>) => {
  const response = await fetch('/api/team', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let result: any = null;
  try {
    result = JSON.parse(await response.text());
  } catch {
    /* not JSON */
  }
  if (!response.ok || !result?.success) {
    throw new Error(result?.error || `server error ${response.status}`);
  }
  return result.data;
};

const isEditableElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('[data-master-float]')) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    const input = target as HTMLInputElement;
    if (tag === 'INPUT' && ['button', 'checkbox', 'radio', 'submit', 'reset', 'file'].includes(input.type)) {
      return false;
    }
    return !input.readOnly && !input.disabled;
  }
  return target.isContentEditable;
};

export default function MasterFloat() {
  const navigate = useNavigate();
  const location = useLocation();
  const [work, setWork] = useState<WorkState>(getWork());
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [pageInputFocused, setPageInputFocused] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const chatEnd = useRef<HTMLDivElement | null>(null);

  const [voice, setVoice] = useState<'idle' | 'loading' | 'speaking'>('idle');
  const [voiceNote, setVoiceNote] = useState('');
  const audio = useRef<{ context: AudioContext | null; source: AudioBufferSourceNode | null; seq: number }>({
    context: null,
    source: null,
    seq: 0,
  });
  const [recording, setRecording] = useState(false);
  const [voiceMode, setVoiceMode] = useState(() => {
    try {
      return localStorage.getItem('cr-voice-on') === '1';
    } catch {
      return false;
    }
  });
  const recorder = useRef<{ media: MediaRecorder; stream: MediaStream; chunks: Blob[]; timer: number } | null>(null);

  // Summoned explicitly by voice shortcut (?talk=1): opens sheet ready for 1-tap mic.
  const [talkMode, setTalkMode] = useState(false);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('talk') !== '1') return;
      setTalkMode(true);
      setOpen(true);
      setVoiceNote('Tap Mic and talk to the Master Agent.');
      params.delete('talk');
      const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', clean);
      const timer = window.setTimeout(() => setTalkMode(false), 20000);
      return () => window.clearTimeout(timer);
    } catch {
      /* no query string */
    }
    return undefined;
  }, []);

  // Close sheet cleanly when route changes so navigation always reveals the destination page.
  useEffect(() => {
    if (!talkMode) setOpen(false);
  }, [location.pathname, talkMode]);

  // Hide the docked launcher while typing into any page form input so iOS keyboard never collides with it.
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      if (isEditableElement(event.target)) {
        setPageInputFocused(true);
      }
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        setPageInputFocused(isEditableElement(document.activeElement));
      }, 120);
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  // Track iOS visualViewport keyboard height so an open bottom sheet stays cleanly above the keyboard without jumping to top: 76px.
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return undefined;
    const updateViewport = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setKeyboardInset(inset > 80 ? inset : 0);
    };
    updateViewport();
    vv.addEventListener('resize', updateViewport);
    vv.addEventListener('scroll', updateViewport);
    return () => {
      vv.removeEventListener('resize', updateViewport);
      vv.removeEventListener('scroll', updateViewport);
    };
  }, []);

  // Allow Escape key to close the sheet.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const setVoiceModeBoth = (on: boolean) => {
    setVoiceMode(on);
    try {
      localStorage.setItem('cr-voice-on', on ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  // Quietly queue notices as a badge instead of popping open uninvited over the owner's screen.
  const addNotice = (notice: Notice) => {
    setNotices((current) => (current.some((item) => item.text === notice.text) ? current : [...current, notice]));
  };
  const dropNotice = () => setNotices((current) => current.slice(1));

  function stopVoice() {
    audio.current.seq += 1;
    try {
      audio.current.source?.stop();
    } catch {
      /* already stopped */
    }
    audio.current.source = null;
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* not available */
    }
    setVoice('idle');
  }

  useEffect(() => {
    const stop = subscribeWork((next) => {
      setWork({ ...next });
    });
    restoreWork();
    const onNotice = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.text) addNotice(detail);
    };
    window.addEventListener('cr-notice', onNotice);

    // Background check for replies, un-emailed demos, follow-ups, duplicates, and demo section updates.
    const timer = window.setTimeout(async () => {
      try {
        if (workActive()) return;
        const snoozed = Date.now() - Number(localStorage.getItem(SNOOZE_KEY) || 0) < 24 * 3600 * 1000;
        const response = await fetch('/api/team?view=demo-updates');
        const body = JSON.parse(await response.text());

        const repeats = body?.data?.duplicates;
        if (body?.success && repeats?.names > 0 && Date.now() - Number(localStorage.getItem(DUP_KEY) || 0) > 7 * 24 * 3600 * 1000) {
          localStorage.setItem(DUP_KEY, String(Date.now()));
          addNotice({
            to: '/leads/duplicates',
            yes: 'Review them',
            text: `${repeats.names} business ${repeats.names === 1 ? 'name is' : 'names are'} saved more than once (for example ${repeats.example})${repeats.likelySame ? `; ${repeats.likelySame} look like the same business saved twice` : ''}. You can merge them or keep them as separate branches. Nothing was deleted.`,
          });
        }

        const news = body?.data?.replies;
        if (body?.success && news?.fresh > 0 && news.newest && localStorage.getItem(REPLY_KEY) !== news.newest) {
          localStorage.setItem(REPLY_KEY, String(news.newest));
          addNotice({
            to: '/replies',
            yes: 'Read them',
            text: `${news.fresh} ${news.fresh === 1 ? 'reply' : 'replies'} to your outreach ${news.fresh === 1 ? 'is' : 'are'} waiting${news.good ? `; ${news.good} ${news.good === 1 ? 'looks' : 'look'} promising` : ''}${news.drafts ? `; suggested ${news.drafts === 1 ? 'answer is' : 'answers are'} ready for ${news.drafts === 1 ? 'it' : 'them'}` : ''}.`,
          });
        }

        const mail = body?.data?.outreach;
        if (body?.success && mail?.ready > 0 && Date.now() - Number(localStorage.getItem(MAIL_KEY) || 0) > 24 * 3600 * 1000) {
          localStorage.setItem(MAIL_KEY, String(Date.now()));
          addNotice({
            action: 'draft-outreach',
            yes: 'Yes, write them',
            text: `${mail.ready} ${mail.ready === 1 ? 'lead has' : 'leads have'} a ready demo and an email address but ${mail.ready === 1 ? 'has' : 'have'} not been written to. Shall I have the Outreach Agent write the emails? You read them and approve once; nothing is sent before that.`,
          });
        }

        const follow = body?.data?.followup;
        if (body?.success && follow?.ready > 0 && Date.now() - Number(localStorage.getItem(FOLLOWUP_KEY) || 0) > 24 * 3600 * 1000) {
          localStorage.setItem(FOLLOWUP_KEY, String(Date.now()));
          addNotice({
            action: 'draft-followup',
            yes: 'Yes, write them',
            text: `${follow.ready} ${follow.ready === 1 ? 'lead was' : 'leads were'} written to at least 3 days ago and ${follow.ready === 1 ? 'has' : 'have'} not replied. Shall I have the Outreach Agent write a polite follow-up for ${follow.ready === 1 ? 'it' : 'them'}? You read ${follow.ready === 1 ? 'it' : 'them'} and approve once; nothing is sent before that.`,
          });
        }

        if (body?.success && Date.now() - Number(localStorage.getItem(PUSH_KEY) || 0) > 7 * 24 * 3600 * 1000) {
          try {
            const registration = await navigator.serviceWorker?.ready;
            const subscription = await registration?.pushManager?.getSubscription();
            if (!subscription) {
              localStorage.setItem(PUSH_KEY, String(Date.now()));
              addNotice({
                to: '/settings',
                yes: 'Turn them on',
                text: 'Want new replies, drafts ready and finished demos on your lock screen, even when ClientRadar is closed? Turn on notifications in Settings.',
              });
            }
          } catch {
            /* push is optional */
          }
        }

        const count = Number(body?.data?.count) || 0;
        if (!body?.success || !count || snoozed) return;
        const label: Record<string, string> = {
          faq: 'a "Common questions" section',
          process: 'a "How it works" section',
          photos: 'photos',
        };
        const sections = (body.data.sections || []).map((key: string) => label[key] || key).join(', ');
        addNotice({
          action: 'refresh-demos',
          yes: `Yes, update ${count === 1 ? 'it' : 'them'}`,
          text: `The records agent found ${count} ${count === 1 ? 'demo' : 'demos'} built before the latest upgrade. What can be added: ${sections}. Shall I update ${count === 1 ? 'it' : 'them'}? The existing wording and the link stay the same.`,
        });
      } catch {
        /* optional background check */
      }
    }, 7000);

    return () => {
      stop();
      window.removeEventListener('cr-notice', onNotice);
      window.clearTimeout(timer);
      stopVoice();
      recorder.current?.stream.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const say = (line: Omit<ChatLine, 'id'>) =>
    setChat((current) => [...current.slice(-11), { ...line, id: lineId() }]);

  const startRefresh = async () => {
    dropNotice();
    try {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'demo-refresh-start', confirm: true }),
      });
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
  const onAssistant = location.pathname === '/' || location.pathname === '/assistant';
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
    const written =
      sum.done && !updating
        ? ` (${sum.ai} written by the AI${sum.done - sum.ai ? `, ${sum.done - sum.ai} with built-in text` : ''})`
        : '';
    const plural = sum.total === 1 ? 'demo is' : 'demos are';
    text = `${sum.done} of ${sum.total} ${plural} ${updating ? 'updated' : 'ready'}${written}.${sum.failed ? ` ${sum.failed} could not be ${updating ? 'updated' : 'built'}; see AI Team.` : ''}${updating ? ' The AI Team page lists what was added to each.' : ''} Preview now?`;
    yes = {
      label: 'Yes, show me',
      run: () => {
        clearWork();
        setOpen(false);
        navigate('/demos');
      },
    };
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
      no = {
        label: 'Not now',
        run: () => {
          try {
            localStorage.setItem(SNOOZE_KEY, String(Date.now()));
          } catch {
            /* ignore */
          }
          dropNotice();
        },
      };
    } else {
      if (notice.to) {
        yes = {
          label: notice.yes || 'Open',
          run: () => {
            const to = notice.to as string;
            dropNotice();
            setOpen(false);
            navigate(to);
          },
        };
      }
      no = { label: yes ? 'Later' : 'OK', run: dropNotice };
    }
  }

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [chat, thinking]);

  useEffect(() => {
    if (text) setVoiceNote('');
  }, [text]);

  const patchTask = (taskId: string, change: Partial<ChatTask>) =>
    setChat((current) =>
      current.map((line) =>
        line.tasks
          ? { ...line, tasks: line.tasks.map((task) => (task.id === taskId ? { ...task, ...change } : task)) }
          : line,
      ),
    );

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
    try {
      await postTeam({ action: 'cancel', taskId: task.id });
      patchTask(task.id, { status: 'cancelled' });
    } catch (error) {
      patchTask(task.id, { error: error instanceof Error ? error.message : 'Could not decline' });
    }
  };

  const playWords = async (words: string) => {
    setVoiceNote('');
    const seq = audio.current.seq + 1;
    audio.current.seq = seq;
    let context: AudioContext | null = null;
    try {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (Ctor) {
        context = audio.current.context || new Ctor();
        audio.current.context = context;
        if (context && context.state === 'suspended') void context.resume();
      }
    } catch {
      context = null;
    }
    setVoice('loading');
    try {
      if (!context) throw new Error('no audio');
      const response = await fetch('/api/demo-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'speak', text: words.slice(0, 600) }),
      });
      if (!response.ok || !(response.headers.get('content-type') || '').startsWith('audio/')) {
        throw new Error('voice not available');
      }
      const buffer = await context.decodeAudioData((await response.arrayBuffer()).slice(0));
      if (seq !== audio.current.seq) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => {
        if (audio.current.source === source) {
          audio.current.source = null;
          setVoice('idle');
        }
      };
      audio.current.source = source;
      setVoice('speaking');
      source.start();
    } catch {
      if (seq !== audio.current.seq) return;
      try {
        const line = new SpeechSynthesisUtterance(words);
        line.onend = () => setVoice('idle');
        line.onerror = () => {
          setVoice('idle');
          setVoiceNote('Voice is not available right now.');
        };
        window.speechSynthesis.speak(line);
        setVoice('speaking');
      } catch {
        setVoice('idle');
        setVoiceNote('Voice is not available right now.');
      }
    }
  };

  const speak = async (words: string) => {
    if (voice !== 'idle') {
      stopVoice();
      return;
    }
    await playWords(words);
  };

  const ask = async (words: string) => {
    if (!words || thinking) return;
    say({ side: 'me', text: words });
    const word = words.toLowerCase().replace(/[.!?]+$/, '');
    if (/^(hold on|hold up|pause|wait|stop|stop for now|not now)( please)?$/.test(word) && workActive() && !getWork().paused) {
      pauseWork();
      say({ side: 'ai', text: 'Paused. The task running right now will finish, then I wait. Say continue when you are ready.' });
      return;
    }
    if (/^(continue|resume|go on|go ahead|carry on|ok continue)( please)?$/.test(word) && getWork().paused) {
      resumeWork();
      say({ side: 'ai', text: 'Continuing with the rest of the queue.' });
      return;
    }
    setThinking(true);
    try {
      const history = chat.slice(-6).map((line) => `${line.side === 'me' ? 'Timothy' : 'Master Agent'}: ${line.text}`);
      const data = await postTeam({ action: 'chat', message: words, history });
      const tasks: ChatTask[] = Array.isArray(data.tasks) ? data.tasks : [];
      setThinking(false);
      say({ side: 'ai', text: String(data.reply || ''), tasks });
      if (!onAssistant && voiceMode && String(data.reply || '')) {
        stopVoice();
        void playWords(String(data.reply));
      }
      for (const task of tasks.filter((item) => item.status === 'queued')) {
        await runTask(task, false);
      }
    } catch (error) {
      setThinking(false);
      say({
        side: 'ai',
        text: `I could not reach the team server: ${error instanceof Error ? error.message : 'unknown reason'}.`,
      });
    }
  };

  const send = (event?: React.FormEvent) => {
    event?.preventDefault();
    const words = draft.trim();
    if (!words) return;
    setDraft('');
    void ask(words);
  };

  const finishRecording = () => {
    const current = recorder.current;
    if (!current) return;
    recorder.current = null;
    window.clearTimeout(current.timer);
    setRecording(false);
    current.media.onstop = () => {
      current.stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(current.chunks, { type: current.media.mimeType || 'audio/webm' });
      if (!blob.size) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = String(reader.result || '').split(',')[1] || '';
        setThinking(true);
        postTeam({ action: 'transcribe', audio: base64, mimeType: blob.type })
          .then((data) => {
            const words = String(data?.text || '').trim();
            if (!words) {
              say({ side: 'ai', text: 'I did not catch that. Try again, or type instead.' });
              return null;
            }
            return ask(words);
          })
          .catch((error) =>
            say({
              side: 'ai',
              text: `Voice input failed: ${error instanceof Error ? error.message : 'unknown reason'}. Type instead.`,
            }),
          )
          .finally(() => setThinking(false));
      };
      reader.readAsDataURL(blob);
    };
    current.media.stop();
  };

  const toggleMic = async () => {
    if (recorder.current) {
      finishRecording();
      return;
    }
    if (thinking) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceNote('Voice input is not available in this browser. Please type.');
      return;
    }
    stopVoice();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const media = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      media.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      media.start();
      recorder.current = { media, stream, chunks, timer: window.setTimeout(() => finishRecording(), 30000) };
      setRecording(true);
      setVoiceNote('Listening... tap the mic again to stop.');
      if (!voiceMode) setVoiceModeBoth(true);
    } catch {
      setVoiceNote('The microphone was not allowed. Allow it for this site, or type instead.');
    }
  };

  // On "/" and "/assistant", AssistantCore is already full-screen with its own live Autopilot pulse.
  if (onAssistant && !talkMode) return null;

  const lastReply = [...chat].reverse().find((line) => line.side === 'ai')?.text || '';
  const toRead = text || lastReply;
  const badgeCount = notices.length + (work.finished && sum.total > 0 ? 1 : 0);
  const hideLauncher = !open && (pageInputFocused || keyboardInset > 0);

  return (
    <div data-master-float>
      {!location.pathname.startsWith('/globe') && (
        <div className="h-16 sm:h-6 pointer-events-none" aria-hidden="true" />
      )}
      {open && (
        <>
          <div
            data-float-backdrop
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[68] bg-black/45 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none"
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="false"
            aria-label="Master Agent quick drawer"
            data-float-bubble
            className="fixed inset-x-0 z-[70] mx-auto w-full max-w-lg rounded-t-3xl px-4 pt-3 pb-4 text-sm shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[380px] sm:rounded-3xl"
            style={{
              bottom: keyboardInset > 0 ? `${keyboardInset}px` : '0px',
              maxHeight: keyboardInset > 0 ? `calc(100dvh - ${keyboardInset + 16}px)` : 'min(78dvh, 560px)',
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(8,16,36,0.98)',
              color: '#eaf1ff',
              border: '1px solid rgba(120,170,255,0.28)',
              paddingBottom: keyboardInset > 0 ? '12px' : 'calc(14px + env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />

            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <span className="mini-orb shrink-0" aria-hidden="true" style={{ width: 22, height: 22 }} />
                <div className="min-w-0">
                  <p className="text-xs font-black tracking-wide text-white truncate">Master Agent</p>
                  <p className="text-[10px] text-[#8fb7ff] truncate">
                    {active
                      ? work.paused
                        ? `Queue paused (${sum.done}/${sum.total})`
                        : `Working in background (${sum.done}/${sum.total})`
                      : 'Active & ready on every page'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {toRead && (
                  <button
                    type="button"
                    onClick={() => void speak(toRead)}
                    aria-label={voice === 'idle' ? 'Read this aloud' : 'Stop speaking'}
                    className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{ border: '1px solid rgba(255,255,255,0.25)', color: '#eaf1ff' }}
                    data-float-speak
                  >
                    {voice === 'idle' ? 'Listen' : voice === 'loading' ? 'Loading...' : 'Stop'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close Master Agent drawer"
                  className="rounded-full p-1.5 text-white/75 hover:bg-white/10 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="mt-2.5 flex-1 overflow-y-auto space-y-3 pr-0.5">
              {text && (
                <div className="rounded-2xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <p className="leading-5 break-words text-xs sm:text-sm" data-float-status>
                    {text}
                  </p>
                  {active && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}>
                      <div
                        style={{
                          width: `${sum.total ? Math.round(((sum.done + sum.failed) / sum.total) * 100) : 0}%`,
                          height: '100%',
                          background: '#ff7a00',
                          transition: 'width 400ms',
                        }}
                      />
                    </div>
                  )}
                  {(yes || no) && (
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {yes && (
                        <button
                          type="button"
                          onClick={yes.run}
                          className="rounded-full px-3.5 py-1.5 text-xs font-bold text-white"
                          style={{ background: '#ff7a00' }}
                        >
                          {yes.label}
                        </button>
                      )}
                      {no && (
                        <button
                          type="button"
                          onClick={no.run}
                          className="rounded-full px-3.5 py-1.5 text-xs font-bold"
                          style={{ border: '1px solid rgba(255,255,255,0.25)', color: '#eaf1ff' }}
                        >
                          {no.label}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {voiceNote && (
                <p className="text-xs" style={{ color: '#ffb37a' }}>
                  {voiceNote}
                </p>
              )}

              {chat.length === 0 && !text && !thinking && (
                <p className="text-xs leading-5" style={{ color: '#9fb0d0' }}>
                  Ask me to find qualified leads, build demos, prepare outreach or follow-up drafts, or check your pipeline from right here.
                </p>
              )}

              {(chat.length > 0 || thinking) && (
                <div className="space-y-2" data-float-chat>
                  {chat.map((line) => (
                    <div key={line.id} className={line.side === 'me' ? 'text-right' : ''}>
                      <span
                        className="inline-block rounded-2xl px-3 py-2 text-left break-words text-xs sm:text-sm"
                        style={{
                          maxWidth: '92%',
                          background: line.side === 'me' ? 'rgba(255,122,0,0.22)' : 'rgba(255,255,255,0.07)',
                        }}
                      >
                        {line.text}
                      </span>
                      {line.tasks
                        ?.filter((task) => task.status === 'waiting_approval')
                        .map((task) => (
                          <div
                            key={task.id}
                            className="mt-2 rounded-xl p-2.5 text-left text-xs"
                            style={{ border: '1px solid rgba(255,255,255,0.16)' }}
                          >
                            <p className="font-semibold break-words">{task.title}</p>
                            <div className="mt-2 flex gap-2">
                              {task.link ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const to = task.link as string;
                                    setOpen(false);
                                    navigate(to);
                                  }}
                                  className="rounded-full px-3 py-1.5 font-bold text-white"
                                  style={{ background: '#ff7a00' }}
                                  data-task-link
                                >
                                  Review drafts
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void runTask(task, true)}
                                  className="rounded-full px-3 py-1.5 font-bold text-white"
                                  style={{ background: '#ff7a00' }}
                                >
                                  Approve
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void declineTask(task)}
                                className="rounded-full px-3 py-1.5 font-bold"
                                style={{ border: '1px solid rgba(255,255,255,0.25)' }}
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  ))}
                  {thinking && (
                    <p className="text-xs" style={{ color: '#9fb0d0' }}>
                      Thinking...
                    </p>
                  )}
                  <div ref={chatEnd} />
                </div>
              )}
            </div>

            <form onSubmit={(event) => void send(event)} className="mt-3 flex gap-2 pt-2 border-t border-white/10" data-float-form>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask the Master Agent..."
                aria-label="Message to the Master Agent"
                enterKeyHint="send"
                className="min-w-0 flex-1 rounded-full px-3.5 py-2 outline-none"
                style={{
                  fontSize: 16,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: '#eaf1ff',
                }}
              />
              <button
                type="button"
                onClick={() => void toggleMic()}
                aria-label={recording ? 'Stop recording' : 'Speak to the Master Agent'}
                className="rounded-full px-3 py-2 text-xs font-bold shrink-0"
                style={{
                  background: recording ? '#ef4444' : 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: '#eaf1ff',
                }}
                data-float-mic
              >
                {recording ? 'Stop' : 'Mic'}
              </button>
              <button
                type="submit"
                disabled={!draft.trim() || thinking}
                className="rounded-full px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40 shrink-0"
                style={{ background: '#ff7a00' }}
              >
                Send
              </button>
            </form>

            <div className="mt-2 flex items-center justify-between text-xs" style={{ color: '#9fb0d0' }}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate('/assistant');
                }}
                className="underline"
              >
                Open full Assistant
              </button>
              <span className="flex items-center gap-3">
                <button type="button" onClick={() => setVoiceModeBoth(!voiceMode)} className="underline" data-voice-toggle>
                  Voice replies: {voiceMode ? 'on' : 'off'}
                </button>
                <button type="button" onClick={() => setOpen(false)}>
                  Close
                </button>
              </span>
            </div>
          </div>
        </>
      )}

      {!open && (
        <button
          type="button"
          data-float-orb
          aria-label={
            active
              ? `Master Agent working (${sum.done} of ${sum.total} done). Tap to open.`
              : badgeCount > 0
                ? `Master Agent has ${badgeCount} update${badgeCount === 1 ? '' : 's'}. Tap to open.`
                : 'Open Master Agent'
          }
          onClick={() => setOpen(true)}
          className="fixed z-[65] flex items-center gap-2 rounded-full shadow-xl transition-all duration-200"
          style={{
            right: '16px',
            bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            height: '48px',
            padding: active ? '0 14px 0 10px' : '0',
            width: active ? 'auto' : '48px',
            justifyContent: 'center',
            background: 'rgba(8,16,36,0.94)',
            color: '#eaf1ff',
            border: `1px solid ${voice === 'speaking' || active ? '#ff7a00' : 'rgba(120,170,255,0.35)'}`,
            opacity: hideLauncher ? 0 : 1,
            pointerEvents: hideLauncher ? 'none' : 'auto',
            transform: hideLauncher ? 'translateY(16px)' : 'translateY(0)',
          }}
        >
          <span className="mini-orb shrink-0" aria-hidden="true" style={{ width: 28, height: 28, pointerEvents: 'none' }} />
          {active && (
            <span className="text-xs font-bold whitespace-nowrap">
              {work.paused ? `Paused ${sum.done}/${sum.total}` : `${sum.done}/${sum.total} active`}
            </span>
          )}
          {!active && badgeCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-black text-white"
              style={{ background: '#ff7a00', border: '2px solid #081024' }}
            >
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
