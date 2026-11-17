import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  Mail,
  Mic,
  Radar,
  RefreshCw,
  Send,
  Zap,
} from 'lucide-react';
import FluidOrb, { type OrbState } from './FluidOrb';
import { useLeads } from '../../context/LeadContext';
import FoundBusinesses from './FoundBusinesses';
import { enqueueWork, pauseWork, resumeWork, subscribeWork, workActive, workSummary, getWork, type WorkState } from '../../lib/workQueue';
import './assistant.css';

type Mode = 'full' | 'compact';

interface ChatTask {
  id: string;
  agentKey: string;
  agentName: string;
  title: string;
  status: string;
  summary?: string;
  error?: string | null;
  output?: any;
  link?: string;
}

interface Msg {
  id: string;
  side: 'ai' | 'me';
  html: string;
  tasks?: ChatTask[];
  note?: string;
}

const TASK_STATUS: Record<string, string> = {
  queued: 'Queued',
  waiting_approval: 'Needs approval',
  running: 'Working',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Declined',
};

// Text from the server is shown as text, never as markup.
const esc = (text: string) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CHAT_CLEARED_KEY = 'cr-chat-cleared-at';

// Turns recorded microphone samples into a small 16 kHz mono WAV, as base64. Returns '' when too short.
const encodeWav = (chunks: Float32Array[], sampleRate: number) => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const step = Math.max(1, Math.round(sampleRate / 16000));
  const length = Math.floor(total / step);
  if (length < 16000 * 0.4) return '';
  const all = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
  const view = new DataView(new ArrayBuffer(44 + length * 2));
  const text = (at: number, value: string) => { for (let index = 0; index < value.length; index += 1) view.setUint8(at + index, value.charCodeAt(index)); };
  const rate = Math.round(sampleRate / step);
  text(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, length * 2, true);
  for (let index = 0; index < length; index += 1) {
    let sum = 0;
    for (let inner = 0; inner < step; inner += 1) sum += all[index * step + inner];
    const sample = Math.max(-1, Math.min(1, sum / step));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  const bytes = new Uint8Array(view.buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
};

// One call to the AI team endpoint; throws with a plain reason.
const postTeam = async (body: Record<string, unknown>) => {
  const response = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let result: any = null;
  try { result = await response.json(); } catch { /* not JSON */ }
  if (!response.ok || !result?.success) {
    throw new Error(result?.error || (response.status === 404 ? 'the team server is not deployed yet' : `server error ${response.status}`));
  }
  return result.data;
};

const uid = () => Math.random().toString(36).slice(2, 9);

const VOICE_KEY = 'cr-voice-on';
const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
const audioContextClass = () => (typeof window === 'undefined' ? null : window.AudioContext || (window as any).webkitAudioContext || null);
const canVoice = () => canSpeak() || Boolean(audioContextClass());

// Turns a chat reply (which may contain markup) into plain sentences for speech.
const toSpeech = (html: string) =>
  html
    .replace(/<button[\s\S]*?<\/button>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '. ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s*\.(\s*\.)+/g, '.')
    .replace(/\s+/g, ' ')
    .trim();

const greeting = () => {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
};

/**
 * AssistantCore - reusable Executive Agent experience.
 *
 * Placements:
 *   (A) post-login home hero
 *   (B) dedicated /assistant route
 *   (C) floating dock using compact mode
 *
 * Chat is real: the Master Agent (POST /api/team) answers and hands tasks to specialists.
 * Briefing and metrics already use live LeadContext data.
 */
const AUTOPILOT_COOLDOWN_MS = 180000;
const AUTOPILOT_TS_KEY = 'cr-autopilot-last-ts';

interface AutopilotState {
  started: string[];
  approvals: { id: string; title: string; link: string; kind: 'outreach' | 'followup' }[];
  suggestions: { label: string; prompt?: string; route?: string }[];
  checkedAt: string;
}

const AssistantCore: React.FC<{ mode?: Mode }> = ({ mode = 'full' }) => {
  const navigate = useNavigate();
  const { leads, refreshLeads } = useLeads();

  const metrics = useMemo(() => {
    const needsOutreach = leads.filter(
      (lead: any) =>
        lead.status === 'New' &&
        (!lead.outreachHistory || lead.outreachHistory.length === 0)
    ).length;

    const awaitingReply = leads.filter(
      (lead: any) => lead.status === 'Pending Reply'
    ).length;

    const warm = leads.filter(
      (lead: any) =>
        lead.status === 'Interested' || lead.status === 'Negotiating'
    ).length;

    const revenue = leads.reduce(
      (total: number, lead: any) => total + (Number(lead.dealValue) || 0),
      0
    );

    const readyDemos = leads.filter(
      (lead: any) => lead.demoStatus === 'Ready'
    ).length;

    return {
      total: leads.length,
      needsOutreach,
      awaitingReply,
      warm,
      revenue,
      readyDemos,
    };
  }, [leads]);

  const [presenceState, setPresenceState] = useState<OrbState>('boot');
  const [workState, setWorkState] = useState<WorkState>(getWork);
  const [autopilotBusy, setAutopilotBusy] = useState(false);
  const [autopilot, setAutopilot] = useState<AutopilotState | null>(null);
  const prevDoneRef = useRef(0);

  useEffect(() => subscribeWork((next) => {
    setWorkState(next);
    const doneNow = next.items.filter((item) => item.status === 'done').length;
    if (doneNow > prevDoneRef.current) {
      prevDoneRef.current = doneNow;
      void refreshLeads();
    } else if (next.items.length === 0) {
      prevDoneRef.current = 0;
    }
  }), [refreshLeads]);

  // Real number from the Demo Factory: how many demos clients have opened.
  const [openedDemos, setOpenedDemos] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/demo-jobs')
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (cancelled || !Array.isArray(result?.data)) return;
        setOpenedDemos(result.data.filter((row: any) => Number(row?.content?.stats?.views) > 0).length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const openedText = openedDemos > 0 ? ` ${openedDemos} of your demos ${openedDemos === 1 ? 'has' : 'have'} been opened by a client.` : '';
  const fallbackBriefing = `I audited your pipeline: ${metrics.needsOutreach} leads need first outreach, ${metrics.awaitingReply} are awaiting reply, and ${metrics.readyDemos} demos are ready to send.${openedText} Pipeline value is $${metrics.revenue.toLocaleString()}.`;

  // Proactive arrival autopilot: scans the pipeline on arrival and whenever the owner comes back active,
  // auto-queues small-batch missing demos, stages outreach/follow-up drafts into waiting_approval (never sending without approval),
  // runs bounded upkeep, and refreshes the executive briefing.
  const [briefing, setBriefing] = useState<{ headline: string; brief: string; nextStep: string; signature: string; isNew: boolean } | null>(null);
  const [briefingFailed, setBriefingFailed] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const autopilotLockRef = useRef(false);

  const runAutopilotScan = useCallback(async (force = false) => {
    if (autopilotLockRef.current) return;
    if (!force) {
      try {
        const lastRun = Number(sessionStorage.getItem(AUTOPILOT_TS_KEY) || 0);
        if (lastRun && Date.now() - lastRun < AUTOPILOT_COOLDOWN_MS && briefing) return;
      } catch { /* sessionStorage unavailable */ }
    }
    autopilotLockRef.current = true;
    setAutopilotBusy(true);
    setPresenceState((current) => (current === 'speaking' || current === 'listening' ? current : 'thinking'));
    const stored = (() => { try { return localStorage.getItem('cr-briefing-sig') || ''; } catch { return ''; } })();

    try {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'autopilot', sig: stored }),
      });
      const result = response.ok ? await response.json().catch(() => null) : null;
      if (!result?.success || !result?.data) {
        setBriefingFailed(true);
        setPresenceState((current) => (current === 'thinking' || current === 'boot' ? 'idle' : current));
        return;
      }
      const data = result.data;
      if (data.briefing) {
        setBriefing(data.briefing);
        setBriefingFailed(false);
        try { localStorage.setItem('cr-briefing-sig', String(data.briefing.signature || '')); } catch { /* ignore */ }
      }
      setAutopilot({
        started: Array.isArray(data.started) ? data.started : [],
        approvals: Array.isArray(data.approvals) ? data.approvals : [],
        suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
        checkedAt: String(data.checkedAt || new Date().toISOString()),
      });
      try { sessionStorage.setItem(AUTOPILOT_TS_KEY, String(Date.now())); } catch { /* ignore */ }

      if (Array.isArray(data.queue) && data.queue.length > 0) {
        enqueueWork(data.queue);
        setPresenceState((current) => (current === 'speaking' ? current : 'delegating'));
      } else {
        setPresenceState((current) => (current === 'thinking' || current === 'boot' ? 'idle' : current));
      }
    } catch {
      setBriefingFailed(true);
      setPresenceState((current) => (current === 'thinking' || current === 'boot' ? 'idle' : current));
    } finally {
      autopilotLockRef.current = false;
      setAutopilotBusy(false);
    }
  }, [briefing]);

  useEffect(() => {
    void runAutopilotScan(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void runAutopilotScan(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [runAutopilotScan]);
  const briefingText = briefing?.headline || (briefingFailed ? fallbackBriefing : '');
  const [typed, setTyped] = useState('');

  useEffect(() => {
    let index = 0;
    setTyped('');

    const interval = window.setInterval(() => {
      if (index >= briefingText.length) {
        window.clearInterval(interval);
        return;
      }

      index += 1;
      setTyped(briefingText.slice(0, index));
    }, 26);

    return () => window.clearInterval(interval);
  }, [briefingText]);

  const [conversation, setConversation] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const agentTimerRef = useRef<number | null>(null);
  const microphoneTimerRef = useRef<number | null>(null);
  const speakTimerRef = useRef<number | null>(null);

  // Voice: tap the orb to hear the briefing; replies are then spoken too.
  const [voiceOn, setVoiceOn] = useState(() => {
    try { return localStorage.getItem(VOICE_KEY) === '1'; } catch { return false; }
  });
  const [voiceUsed, setVoiceUsed] = useState(() => {
    try { return localStorage.getItem(VOICE_KEY) !== null; } catch { return false; }
  });
  const [voiceLevel, setVoiceLevel] = useState<number | null>(null);
  const levelTimerRef = useRef<number | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const rememberVoice = (on: boolean) => {
    setVoiceOn(on);
    setVoiceUsed(true);
    try { localStorage.setItem(VOICE_KEY, on ? '1' : '0'); } catch { /* storage blocked */ }
  };

  // Natural voice (server) with real loudness; the device voice is the fallback.
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCacheRef = useRef<{ text: string; audio: Promise<ArrayBuffer> } | null>(null);
  const speakSeqRef = useRef(0);
  const loadingVoiceRef = useRef(false);
  const levelFrameRef = useRef(0);
  const [voiceNote, setVoiceNote] = useState('');

  // Must run inside a tap or key press so the phone allows sound.
  const unlockAudio = () => {
    try {
      const AudioContextCtor = audioContextClass();
      if (!AudioContextCtor) return null;
      if (!audioContextRef.current) audioContextRef.current = new AudioContextCtor();
      if (audioContextRef.current.state === 'suspended') void audioContextRef.current.resume();
      return audioContextRef.current;
    } catch {
      return null;
    }
  };

  const stopSpeaking = () => {
    speakSeqRef.current += 1;
    loadingVoiceRef.current = false;
    if (canSpeak()) window.speechSynthesis.cancel();
    utteranceRef.current = null;
    const source = audioSourceRef.current;
    audioSourceRef.current = null;
    if (source) {
      try { source.stop(); } catch { /* already stopped */ }
    }
    if (levelFrameRef.current) cancelAnimationFrame(levelFrameRef.current);
    levelFrameRef.current = 0;
    setVoiceLevel(null);
  };

  // Plays the natural voice. Resolves false when it is not possible on this device; throws with the reason when the server cannot do it.
  // Asks the server for the spoken audio. The latest text is kept, so the briefing can be
  // prepared before the tap and a repeat costs no new request.
  const fetchVoice = (text: string): Promise<ArrayBuffer> => {
    if (audioCacheRef.current?.text === text) return audioCacheRef.current.audio;
    const audio = (async () => {
      const response = await fetch('/api/demo-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'speak', text }),
      });
      if (!response.ok || !(response.headers.get('content-type') || '').startsWith('audio/')) {
        let reason = `error ${response.status}`;
        try { reason = (await response.json()).error || reason; } catch { /* not JSON */ }
        throw new Error(reason);
      }
      return response.arrayBuffer();
    })();
    audioCacheRef.current = { text, audio };
    audio.catch(() => {
      if (audioCacheRef.current?.audio === audio) audioCacheRef.current = null;
    });
    return audio;
  };

  const speakNatural = async (text: string, seq: number): Promise<boolean> => {
    const context = unlockAudio();
    if (!context) return false;
    const bytes = await fetchVoice(text);
    if (seq !== speakSeqRef.current) return true;
    const buffer = await context.decodeAudioData(bytes.slice(0));
    if (seq !== speakSeqRef.current) return true;

    const source = context.createBufferSource();
    source.buffer = buffer;
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    analyser.connect(context.destination);
    const samples = new Uint8Array(analyser.fftSize);
    let lastPush = 0;
    const tick = (now: number) => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (let index = 0; index < samples.length; index += 1) {
        const value = (samples[index] - 128) / 128;
        sum += value * value;
      }
      if (now - lastPush > 60) {
        lastPush = now;
        setVoiceLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4.5));
      }
      levelFrameRef.current = requestAnimationFrame(tick);
    };
    source.onended = () => {
      if (audioSourceRef.current !== source) return;
      audioSourceRef.current = null;
      if (levelFrameRef.current) cancelAnimationFrame(levelFrameRef.current);
      levelFrameRef.current = 0;
      setVoiceLevel(null);
      setPresenceState((current) => (current === 'speaking' ? 'idle' : current));
    };
    audioSourceRef.current = source;
    setPresenceState('speaking');
    source.start();
    levelFrameRef.current = requestAnimationFrame(tick);
    return true;
  };

  // Returns true when speech started. The orb stays in the speaking state until the voice ends.
  const speak = (text: string) => {
    if (!canSpeak() || !text) return false;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 1;
      utterance.onstart = () => setPresenceState('speaking');
      // Word boundaries stand in for loudness, where the browser reports them.
      utterance.onboundary = () => {
        setVoiceLevel(1);
        if (levelTimerRef.current !== null) window.clearTimeout(levelTimerRef.current);
        levelTimerRef.current = window.setTimeout(() => setVoiceLevel(0.15), 130);
      };
      const finish = () => {
        if (utteranceRef.current !== utterance) return;
        utteranceRef.current = null;
        setVoiceLevel(null);
        setPresenceState((current) => (current === 'speaking' ? 'idle' : current));
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      utteranceRef.current = utterance;
      setPresenceState('speaking');
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      return false;
    }
  };

  // Natural voice first; if it cannot be used, the device voice reads the text.
  const say = async (text: string) => {
    stopSpeaking();
    const seq = speakSeqRef.current;
    loadingVoiceRef.current = true;
    setPresenceState('thinking');
    let reason = '';
    try {
      if (await speakNatural(text, seq)) {
        if (seq === speakSeqRef.current) { loadingVoiceRef.current = false; setVoiceNote(''); }
        return;
      }
    } catch (error) {
      reason = error instanceof Error ? error.message : 'unknown reason';
    }
    if (seq !== speakSeqRef.current) return;
    loadingVoiceRef.current = false;
    if (reason) setVoiceNote(`Natural voice not used: ${reason}. Using the phone voice.`);
    if (!speak(text)) setPresenceState('idle');
  };

  // Once the voice has been used, prepare the briefing audio quietly after the numbers settle,
  // so the tap answers at once.
  useEffect(() => {
    if (!voiceUsed || !audioContextClass() || !briefingText) return undefined;
    const timer = window.setTimeout(() => {
      fetchVoice(`Good ${greeting()}, Timothy. ${briefingText}`).catch(() => undefined);
    }, 2500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefingText, voiceUsed]);

  // Speak the briefing as soon as it is on screen, when voice is on. Phones block sound
  // until the first tap, so the first tap anywhere starts it instead.
  const briefingSpokenRef = useRef(false);
  useEffect(() => {
    if (!briefingText || !voiceOn || briefingSpokenRef.current) return;
    const context = unlockAudio();
    if (context && context.state === 'suspended') return;
    briefingSpokenRef.current = true;
    void say(`Good ${greeting()}, Timothy. ${briefingText}`);
  }, [briefingText, voiceOn]);
  useEffect(() => {
    if (!voiceOn) return;
    const onFirstTap = (event: PointerEvent) => {
      if (briefingSpokenRef.current || !briefingText) return;
      if (event.target instanceof Element && event.target.closest('[data-float-orb]')) return;
      briefingSpokenRef.current = true;
      void say(`Good ${greeting()}, Timothy. ${briefingText}`);
    };
    window.addEventListener('pointerdown', onFirstTap);
    return () => window.removeEventListener('pointerdown', onFirstTap);
  }, [briefingText, voiceOn]);

  const handleOrbTap = () => {
    if (!canVoice()) return;
    if (utteranceRef.current || audioSourceRef.current || loadingVoiceRef.current) {
      stopSpeaking();
      setPresenceState('idle');
      rememberVoice(false);
      return;
    }
    rememberVoice(true);
    unlockAudio();
    void say(`Good ${greeting()}, Timothy. ${briefingText}`);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [conversation, thinking]);

  useEffect(
    () => () => {
      if (agentTimerRef.current !== null) {
        window.clearTimeout(agentTimerRef.current);
      }
      releaseRecorder();
      if (microphoneTimerRef.current !== null) {
        window.clearTimeout(microphoneTimerRef.current);
      }
      if (speakTimerRef.current !== null) {
        window.clearTimeout(speakTimerRef.current);
      }
      if (levelTimerRef.current !== null) {
        window.clearTimeout(levelTimerRef.current);
      }
      if (canSpeak()) window.speechSynthesis.cancel();
      if (levelFrameRef.current) cancelAnimationFrame(levelFrameRef.current);
      try { audioSourceRef.current?.stop(); } catch { /* already stopped */ }
      void audioContextRef.current?.close().catch(() => undefined);
    },
    []
  );

  const patchTask = (taskId: string, patch: Partial<ChatTask>) =>
    setConversation((current) =>
      current.map((message) =>
        message.tasks ? { ...message, tasks: message.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)) } : message
      )
    );

  // One specialist runs one task in its own server call.
  const runTask = async (task: ChatTask, approve = false): Promise<ChatTask> => {
    patchTask(task.id, { status: 'running', error: null });
    try {
      const data = await postTeam({ action: 'run', taskId: task.id, approve });
      patchTask(task.id, { status: data.status, summary: data.summary, error: data.error, output: data.output });
      // An approved batch hands its tasks to the work queue, which runs them one by one on any page.
      if (Array.isArray(data.output?.queue) && data.output.queue.length) enqueueWork(data.output.queue);
      return { ...task, ...data };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown reason';
      patchTask(task.id, { status: 'failed', error: reason });
      return { ...task, status: 'failed', error: reason, summary: `Could not finish "${task.title}": ${reason}` };
    }
  };

  // The Master Agent reports the results; the orb shows success or concern first.
  const reportResults = (results: ChatTask[]) => {
    const text = results.map((result) => result.summary || '').join(' ').trim();
    setConversation((current) => [...current, { id: uid(), side: 'ai', html: esc(text) }]);
    setPresenceState(results.every((result) => result.status === 'done') ? 'success' : 'error');
    // Home-dashboard chat and task results stay text-only. Only the startup briefing may speak here.
    speakTimerRef.current = window.setTimeout(() => {
      speakTimerRef.current = null;
      setPresenceState('idle');
    }, 1400);
  };

  const approveTask = async (task: ChatTask) => {
    if (voiceOn) unlockAudio();
    stopSpeaking();
    setPresenceState('delegating');
    reportResults([await runTask(task, true)]);
  };

  const declineTask = async (task: ChatTask) => {
    try {
      await postTeam({ action: 'cancel', taskId: task.id });
      patchTask(task.id, { status: 'cancelled' });
    } catch (error) {
      patchTask(task.id, { error: error instanceof Error ? error.message : 'Could not decline' });
    }
  };

  const runAgent = async (text: string) => {
    if (speakTimerRef.current !== null) {
      window.clearTimeout(speakTimerRef.current);
      speakTimerRef.current = null;
    }

    stopSpeaking();
    // "Hold on" and "continue" control the running work queue directly; no AI call is needed.
    const word = text.trim().toLowerCase().replace(/[.!?]+$/, '');
    if (/^(hold on|hold up|pause|wait|stop|stop for now|not now)( please)?$/.test(word) && workActive() && !getWork().paused) {
      pauseWork();
      setConversation((current) => [...current, { id: uid(), side: 'ai', html: esc('Paused. The demo being built right now will finish, then I wait. Say continue when you are ready.') }]);
      return;
    }
    if (/^(continue|resume|go on|go ahead|carry on|ok continue)( please)?$/.test(word) && getWork().paused) {
      resumeWork();
      setConversation((current) => [...current, { id: uid(), side: 'ai', html: esc('Continuing with the rest of the queue.') }]);
      return;
    }
    setPresenceState('thinking');
    setThinking(true);

    const history = conversation.slice(-6).map((message) => `${message.side === 'me' ? 'Timothy' : 'Master Agent'}: ${toSpeech(message.html)}`);
    let data: any;
    try {
      data = await postTeam({ action: 'chat', message: text, history });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown reason';
      setThinking(false);
      setConversation((current) => [...current, { id: uid(), side: 'ai', html: esc(`I could not reach the team server: ${reason}.`) }]);
      setPresenceState('error');
      speakTimerRef.current = window.setTimeout(() => {
        setPresenceState('idle');
        speakTimerRef.current = null;
      }, 2600);
      return;
    }

    const reply = String(data.reply || '');
    const tasks: ChatTask[] = Array.isArray(data.tasks) ? data.tasks : [];
    const note = data.source === 'rules' ? (data.aiError ? `AI not used: ${data.aiError}. Simple mode answered.` : 'Answered from your database; AI was not needed.') : undefined;
    setThinking(false);
    setConversation((current) => [...current, { id: uid(), side: 'ai', html: esc(reply), tasks, note }]);

    // Tasks that need no approval start straight away, one after another.
    const ready = tasks.filter((task) => task.status === 'queued');
    if (ready.length) {
      setPresenceState('delegating');
      const results: ChatTask[] = [];
      for (const task of ready) results.push(await runTask(task));
      reportResults(results);
      return;
    }

    // Home-dashboard chat answers are always silent, even when the startup briefing voice is on.
    setPresenceState('success');
    speakTimerRef.current = window.setTimeout(() => {
      setPresenceState('idle');
      speakTimerRef.current = null;
    }, Math.min(4200, 1200 + reply.length * 9));
  };

  const send = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value) return;

    setConversation((current) => [
      ...current,
      { id: uid(), side: 'me', html: esc(value) },
    ]);
    setInput('');
    if (voiceOn) unlockAudio();
    void runAgent(value);
  };

  // The saved conversation comes back from the task records, on any device.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/team?view=chat')
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        const turns = result?.data?.turns;
        if (cancelled || !Array.isArray(turns)) return;
        let cutoff = 0;
        try { cutoff = Number(localStorage.getItem(CHAT_CLEARED_KEY) || 0); } catch { /* storage blocked */ }
        const restored: Msg[] = [];
        for (const turn of turns) {
          if (new Date(turn.createdAt).getTime() <= cutoff) continue;
          const tasks: ChatTask[] = Array.isArray(turn.tasks) ? turn.tasks : [];
          restored.push({ id: `${turn.id}-q`, side: 'me', html: esc(turn.message) });
          restored.push({ id: `${turn.id}-a`, side: 'ai', html: esc(turn.reply), tasks });
          const finished = tasks.filter((task) => (task.status === 'done' || task.status === 'failed') && task.summary);
          if (finished.length) restored.push({ id: `${turn.id}-r`, side: 'ai', html: esc(finished.map((task) => task.summary).join(' ')) });
        }
        if (restored.length) setConversation((current) => [...restored, ...current]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Hides the conversation on this device. The task records stay on the AI Team page.
  const clearChat = () => {
    try { localStorage.setItem(CHAT_CLEARED_KEY, String(Date.now())); } catch { /* storage blocked */ }
    setConversation([]);
  };

  // Voice input: record from the microphone, turn it into text on the server, then send it.
  const recorderRef = useRef<{ stream: MediaStream; source: MediaStreamAudioSourceNode; node: ScriptProcessorNode; chunks: Float32Array[]; rate: number; timer: number } | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [micNote, setMicNote] = useState('');

  const releaseRecorder = () => {
    const recorder = recorderRef.current;
    if (!recorder) return null;
    recorderRef.current = null;
    window.clearTimeout(recorder.timer);
    try { recorder.node.disconnect(); recorder.source.disconnect(); } catch { /* already disconnected */ }
    recorder.stream.getTracks().forEach((track) => track.stop());
    return recorder;
  };

  const finishRecording = async () => {
    const recorder = releaseRecorder();
    if (!recorder) return;
    setListening(false);
    const audio = encodeWav(recorder.chunks, recorder.rate);
    if (!audio) {
      setMicNote('I did not hear anything. Tap the microphone and try again.');
      setPresenceState('idle');
      return;
    }
    setTranscribing(true);
    setPresenceState('thinking');
    setMicNote('Writing down what you said...');
    try {
      const data = await postTeam({ action: 'transcribe', audio, mimeType: 'audio/wav' });
      const heard = String(data?.text || '').trim();
      if (!heard) {
        setMicNote('I could not make out any words. Try again or type.');
        setPresenceState('idle');
      } else {
        setMicNote('');
        send(heard);
      }
    } catch (error) {
      setMicNote(`Voice input failed: ${error instanceof Error ? error.message : 'unknown reason'}.`);
      setPresenceState('idle');
    } finally {
      setTranscribing(false);
    }
  };

  const toggleMic = async () => {
    if (recorderRef.current) return void finishRecording();
    if (transcribing) return;
    const context = unlockAudio();
    if (!context || !navigator.mediaDevices?.getUserMedia) {
      setMicNote('Voice input is not available in this browser. Please type.');
      return;
    }
    stopSpeaking();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const source = context.createMediaStreamSource(stream);
      const node = context.createScriptProcessor(4096, 1, 1);
      const silent = context.createGain();
      silent.gain.value = 0;
      const chunks: Float32Array[] = [];
      node.onaudioprocess = (event) => { chunks.push(new Float32Array(event.inputBuffer.getChannelData(0))); };
      source.connect(node);
      node.connect(silent);
      silent.connect(context.destination);
      recorderRef.current = { stream, source, node, chunks, rate: context.sampleRate, timer: window.setTimeout(() => void finishRecording(), 30000) };
      setListening(true);
      setPresenceState('listening');
      setMicNote('Listening... tap the microphone again when you finish.');
    } catch {
      setMicNote('The microphone was not allowed. Allow it for this site, or type instead.');
    }
  };

  const queueSummary = workSummary(workState);
  const queueRunning = workActive() && !workState.paused;

  // While background work runs, Autopilot scans, or the owner types, the orb stays visibly alive.
  const orbState: OrbState =
    presenceState === 'speaking' || presenceState === 'listening' || presenceState === 'error'
      ? presenceState
      : autopilotBusy || thinking
        ? 'thinking'
        : queueRunning
          ? 'delegating'
          : presenceState === 'idle' && input.trim()
            ? 'listening'
            : presenceState;

  const quickActions = [
    {
      icon: Zap,
      label: 'Daily Brief',
      primary: true,
      run: () => send('Give me my daily briefing'),
    },
    {
      icon: Radar,
      label: 'Scan Leads',
      run: () => navigate('/finder'),
    },
    {
      icon: Mail,
      label: 'Outreach',
      run: () => navigate('/outreach'),
    },
    {
      icon: BarChart3,
      label: 'Pipeline',
      run: () => navigate('/deals'),
    },
    {
      icon: FileText,
      label: 'Invoice',
      run: () => navigate('/invoices'),
    },
  ];

  return (
    <div className={`cr-core cr-core--${mode}`}>
      {mode === 'full' && (
        <div className="cr-hero flex flex-col items-center text-center">
          <div className="cr-presence-stage">
            <FluidOrb
              state={orbState}
              size={408}
              level={voiceLevel}
              onTap={canVoice() ? handleOrbTap : undefined}
              tapLabel={presenceState === 'speaking' ? 'Stop speaking' : 'Hear your briefing'}
            />
          </div>

          <div className="cr-greet">
            {canVoice() && !voiceUsed && (
              <p className="fluid-orb-hint">Tap the orb to hear your briefing</p>
            )}
            {voiceNote && <p className="fluid-orb-hint" role="status">{voiceNote}</p>}
            <h1>
              Good {greeting()}, <b>Timothy</b>.
            </h1>
            <p className="cr-brief">
              {typed}
              <span className="cr-caret" />
            </p>
            {briefing && (
              <div className="mt-2 space-y-2">
                <p className="text-xs font-bold text-[#FF7A00]">Next: {briefing.nextStep}</p>
                {!showBrief ? (
                  <button type="button" onClick={() => setShowBrief(true)} className="neo-button rounded-full px-3.5 py-1.5 text-xs font-bold text-[var(--text-primary)]">Show the full brief</button>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">{briefing.brief}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <section className="neo-in rounded-2xl p-3.5 sm:p-4 space-y-3 text-left" data-master-autopilot>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${autopilotBusy || queueRunning ? 'bg-[#FF7A00] animate-pulse' : 'bg-emerald-500'}`}
              aria-hidden="true"
            />
            <span className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
              {autopilotBusy
                ? 'Master Autopilot - scanning pipeline...'
                : queueRunning
                  ? `Master Autopilot - building (${queueSummary.done}/${queueSummary.total} done)`
                  : workState.paused && workActive()
                    ? 'Master Autopilot - queue paused'
                    : 'Master Autopilot - active & monitoring'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void runAutopilotScan(true)}
            disabled={autopilotBusy}
            data-autopilot-refresh
            className="neo-button rounded-full px-3 py-1 text-[11px] font-bold text-[var(--text-primary)] inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw size={12} className={autopilotBusy ? 'animate-spin' : ''} />
            {autopilotBusy ? 'Scanning...' : 'Run scan now'}
          </button>
        </div>

        {workActive() && (
          <div className="rounded-xl border border-black/10 dark:border-white/10 px-3 py-2.5 space-y-1.5" data-autopilot-queue>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 min-w-0 truncate">
                <Clock3 size={13} className="text-[#FF7A00] shrink-0" />
                <span className="truncate">
                  {workState.paused
                    ? `Paused (${queueSummary.left} left)`
                    : queueSummary.running
                      ? queueSummary.running.title
                      : `${queueSummary.left} queued`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => (workState.paused ? resumeWork() : pauseWork())}
                className="neo-button rounded-full px-2.5 py-1 text-[11px] font-bold text-[var(--text-primary)] shrink-0"
              >
                {workState.paused ? 'Resume' : 'Pause'}
              </button>
            </div>
            <div className="h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${queueSummary.total ? Math.round(((queueSummary.done + queueSummary.failed) / queueSummary.total) * 100) : 0}%`,
                  background: '#FF7A00',
                }}
              />
            </div>
          </div>
        )}

        {autopilot && autopilot.started.length > 0 && (
          <ul className="space-y-1.5 text-xs text-[var(--text-secondary)]">
            {autopilot.started.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                <span className="break-words">{line}</span>
              </li>
            ))}
          </ul>
        )}

        {autopilot && autopilot.approvals.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5" data-autopilot-approvals>
            {autopilot.approvals.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.link)}
                className="rounded-full px-3.5 py-1.5 text-xs font-bold text-white"
                style={{ background: '#FF7A00' }}
              >
                Review & approve: {item.title}
              </button>
            ))}
          </div>
        )}

        {autopilot && autopilot.suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5" data-autopilot-suggestions>
            {autopilot.suggestions.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => (item.route ? navigate(item.route) : item.prompt ? send(item.prompt) : undefined)}
                className="neo-button rounded-full px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] hover:text-[#FF7A00]"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-3 gap-3">
        {[
          { value: metrics.total, label: 'Leads' },
          { value: metrics.warm, label: 'Warm' },
          {
            value: `$${(metrics.revenue / 1000).toFixed(1)}k`,
            label: 'Pipeline',
          },
        ].map((stat) => (
          <div key={stat.label} className="neo-in rounded-2xl p-3 text-center">
            <div className="text-xl font-black text-[var(--text-primary)]">
              {stat.value}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      <div className="cr-actions">
        {quickActions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.label}
              className={`cr-chip ${action.primary ? 'primary' : ''}`}
              onClick={action.run}
              type="button"
            >
              <Icon />
              {action.label}
            </button>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        className="cr-convo"
        style={{
          maxHeight: mode === 'compact' ? 320 : 360,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {conversation.map((message) => (
          <div key={message.id} className={`cr-msg ${message.side}`}>
            <div className={`cr-av ${message.side}`}>
              {message.side === 'ai' ? <span className="mini-orb" aria-hidden="true" /> : 'T'}
            </div>
            <div className="cr-msg-body">
              <div
                className="cr-bubble"
                dangerouslySetInnerHTML={{ __html: message.html }}
              />
              {message.note && <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{message.note}</p>}
              {message.tasks?.map((task) => (
                <div key={task.id} className="mt-2 neo-in rounded-2xl p-3 text-sm" data-task-status={task.status}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-[var(--text-primary)]">{task.agentName}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${task.status === 'failed' ? 'text-red-400' : task.status === 'done' ? 'text-green-500' : 'text-[var(--text-secondary)]'}`}>
                      {TASK_STATUS[task.status] || task.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[var(--text-secondary)] break-words">{task.title}</p>
                  {task.status === 'waiting_approval' && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {task.link ? <button type="button" className="cr-chip primary" onClick={() => navigate(task.link as string)} data-task-link>Review drafts</button> : <button type="button" className="cr-chip primary" onClick={() => void approveTask(task)}>Approve</button>}
                      <button type="button" className="cr-chip" onClick={() => void declineTask(task)}>Not now</button>
                    </div>
                  )}
                  {task.link && (task.status === 'running' || task.status === 'done') && <div className="mt-2"><button type="button" className="cr-chip" onClick={() => navigate(task.link as string)}>Open drafts</button></div>}
                  {task.status === 'failed' && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button type="button" className="cr-chip" onClick={() => void approveTask(task)}>Try again</button>
                    </div>
                  )}
                  {task.error && <p className="mt-1 text-xs text-red-400 break-words">{task.error}</p>}
                  {task.output?.note && <p className="mt-1 text-[11px] text-[var(--text-secondary)] break-words">{task.output.note}</p>}
                  {Array.isArray(task.output?.businesses) && task.output.businesses.length > 0 && (
                    <FoundBusinesses businesses={task.output.businesses} category={task.output?.category} city={task.output?.city} />
                  )}
                  {task.output?.demoUrl && (
                    <a href={task.output.demoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold underline text-[var(--text-primary)]">Open demo</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="cr-msg ai">
            <div className="cr-av ai"><span className="mini-orb" aria-hidden="true" /></div>
            <div className="cr-bubble cr-typing">
              <span>
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        )}
      </div>

      {(micNote || conversation.length > 0) && (
        <div className="flex items-center justify-between gap-3 px-1 text-[11px] text-[var(--text-secondary)]">
          <span role="status">{micNote}</span>
          {conversation.length > 0 && (
            <button type="button" className="underline shrink-0" onClick={clearChat}>Clear chat</button>
          )}
        </div>
      )}

      <div className="cr-composer">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') send();
          }}
          placeholder="Ask your assistant..."
        />

        <button
          className={`cr-icbtn mic ${listening ? 'live' : ''}`}
          onClick={() => void toggleMic()}
          aria-pressed={listening}
          disabled={transcribing}
          aria-label="Voice"
          type="button"
        >
          <Mic />
        </button>

        <button
          className="cr-icbtn send"
          disabled={!input.trim()}
          onClick={() => send()}
          aria-label="Send"
          type="button"
        >
          <Send />
        </button>
      </div>
    </div>
  );
};


export default AssistantCore;
