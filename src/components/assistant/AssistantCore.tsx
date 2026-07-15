import React, { useMemo, useRef, useState, useEffect, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, Radar, Mail, BarChart3, FileText, Send, Mic,
} from 'lucide-react';
import AgentOrb, { OrbState } from './AgentOrb';
// Lazy-load the real 3D orb so it never bloats initial bundle.
// Falls back to the CSS orb while loading or if WebGL is unavailable.
const AgentOrb3D = lazy(() => import('./AgentOrb3D'));
import { useLeads } from '../../context/LeadContext';
import './assistant.css';

type Mode = 'full' | 'compact';

interface Msg {
  id: string;
  side: 'ai' | 'me';
  html: string;
}

/* ---- helpers ---- */
const uid = () => Math.random().toString(36).slice(2, 9);
const time = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const greeting = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  return 'evening';
};

/**
 * AssistantCore â€” the reusable Executive Agent experience.
 * Drives all three placements:
 *   (A) home hero, (B) /assistant route, (C) floating dock (compact mode).
 *
 * CHAT IS MOCKED: replace `runAgent` with the real agentService call once
 * its API is confirmed (Rule #1 â€” never generate against an assumed API).
 * The briefing + stats already pull LIVE data via useLeads().
 */
const AssistantCore: React.FC<{ mode?: Mode }> = ({ mode = 'full' }) => {
  const navigate = useNavigate();
  const { leads } = useLeads();

  /* live derived metrics (same logic family as Dashboard.tsx) */
  const m = useMemo(() => {
    const needsOutreach = leads.filter(
      (l: any) => l.status === 'New' && (!l.outreachHistory || l.outreachHistory.length === 0)
    ).length;
    const awaitingReply = leads.filter((l: any) => l.status === 'Pending Reply').length;
    const warm = leads.filter((l: any) => l.status === 'Interested' || l.status === 'Negotiating').length;
    const revenue = leads.reduce((a: number, l: any) => a + (Number(l.dealValue) || 0), 0);
    const readyDemos = leads.filter((l: any) => l.demoStatus === 'Ready').length;
    return { total: leads.length, needsOutreach, awaitingReply, warm, revenue, readyDemos };
  }, [leads]);

  /* orb state + boot sequence */
  const [orb, setOrb] = useState<OrbState>('boot');
  useEffect(() => {
    const t = setTimeout(() => setOrb('idle'), 2200);
    return () => clearTimeout(t);
  }, []);

  /* typewriter briefing */
  const briefingHTML = `You have <span class="num">${m.needsOutreach} leads</span> needing first outreach, <span class="num">${m.awaitingReply}</span> awaiting reply, and <span class="num">${m.readyDemos} demos</span> ready to send. Pipeline value is <span class="num">$${m.revenue.toLocaleString()}</span>. Want the daily brief?`;
  const [typed, setTyped] = useState('');
  useEffect(() => {
    let i = 0;
    const strip = briefingHTML.replace(/<[^>]+>/g, '');
    const tags = briefingHTML;
    const id = setInterval(() => {
      if (i >= strip.length) { clearInterval(id); return; }
      setTyped(strip.slice(0, ++i));
    }, 26);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefingHTML]);

  /* conversation */
  const [convo, setConvo] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [convo, thinking]);

  /* ---- MOCK agent brain (TODO: wire to agentService.run / toolExecutionSystem) ---- */
  const runAgent = (text: string) => {
    setOrb('thinking'); setThinking(true);
    const t = setTimeout(() => {
      setThinking(false); setOrb('idle');
      setConvo((c) => [...c, { id: uid(), side: 'ai', html: brain(text) }]);
    }, 850);
    return () => clearTimeout(t);
  };

  const send = (text?: string) => {
    const v = (text ?? input).trim();
    if (!v) return;
    setConvo((c) => [...c, { id: uid(), side: 'me', html: v }]);
    setInput('');
    runAgent(v);
  };

  const quick = [
    { icon: Zap, label: 'Daily Brief', primary: true, run: () => send('Give me my daily briefing') },
    { icon: Radar, label: 'Scan Leads', run: () => navigate('/finder') },
    { icon: Mail, label: 'Outreach', run: () => navigate('/outreach') },
    { icon: BarChart3, label: 'Pipeline', run: () => navigate('/deals') },
    { icon: FileText, label: 'Invoice', run: () => navigate('/invoices') },
  ];

  return (
    <div className={`cr-core cr-core--${mode}`}>
      {/* hero: orb + greeting (compact hides big greeting) */}
      {mode === 'full' && (
        <div className="flex flex-col items-center text-center">
          <Suspense fallback={<AgentOrb state={orb} size={240} />}>
            <AgentOrb3D state={orb} size={240} />
          </Suspense>
          <div className="cr-greet mt-4">
            <h1>Good {greeting()}, <b>Timothy</b>.</h1>
            <p className="cr-brief" dangerouslySetInnerHTML={{ __html: typed + '<span class="cr-caret"></span>' }} />
          </div>
        </div>
      )}

      {/* stat strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { v: m.total, l: 'Leads' },
          { v: m.warm, l: 'Warm' },
          { v: `$${(m.revenue / 1000).toFixed(1)}k`, l: 'Pipeline' },
        ].map((s) => (
          <div key={s.l} className="neo-in rounded-2xl p-3 text-center">
            <div className="text-xl font-black text-[var(--text-primary)]">{s.v}</div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mt-0.5">{s.l}</div>
          </div>
        ))}
      </div>

      {/* quick actions */}
      <div className="cr-actions">
        {quick.map((q) => (
          <button key={q.label} className={`cr-chip ${q.primary ? 'primary' : ''}`} onClick={q.run}>
            <q.icon /> {q.label}
          </button>
        ))}
      </div>

      {/* conversation */}
      <div ref={scrollRef} className="cr-convo" style={{ maxHeight: mode === 'compact' ? 320 : 360, overflowY: 'auto' }}>
        {convo.map((msg) => (
          <div key={msg.id} className={`cr-msg ${msg.side}`}>
            <div className={`cr-av ${msg.side}`}>{msg.side === 'ai' ? 'AI' : 'T'}</div>
            <div>
              <div className="cr-bubble" dangerouslySetInnerHTML={{ __html: msg.html }} />
            </div>
          </div>
        ))}
        {thinking && (
          <div className="cr-msg ai">
            <div className="cr-av ai">AI</div>
            <div className="cr-bubble cr-typing"><span><i /><i /><i /></span></div>
          </div>
        )}
      </div>

      {/* composer */}
      <div className="cr-composer">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask your assistantâ€¦"
        />
        <button
          className={`cr-icbtn mic ${listening ? 'live' : ''}`}
          onClick={() => {
            setListening(true); setOrb('listening');
            setTimeout(() => { setListening(false); setOrb('idle'); setInput('Scan for new leads'); }, 1600);
          }}
          aria-label="Voice"
        ><Mic /></button>
        <button className="cr-icbtn send" disabled={!input.trim()} onClick={() => send()} aria-label="Send"><Send /></button>
      </div>
    </div>
  );
};

/* ---- mock responses (replace with agentService) ---- */
function brain(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('brief')) {
    return `Here's your day, Timothy.<br>â€¢ A few leads still need first outreach<br>â€¢ Some are awaiting your reply<br>â€¢ Demos are ready to send<br><br>Recommendation: clear outreach first, then chase replies. <span class="cr-row"><button class="cr-mini go" data-go="/outreach">Go to Outreach</button></span>`;
  }
  if (t.includes('scan')) {
    return `Scan for new businesses on the Lead Finder. I've pre-loaded your filters (no website Â· services). <span class="cr-row"><button class="cr-mini go" data-go="/finder">Open Finder</button></span>`;
  }
  return `I'm your Executive Agent â€” I can scan leads, draft & send outreach, track your pipeline, and create invoices. What would you like to do?`;
}

export default AssistantCore;