import React, {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  FileText,
  Mail,
  Mic,
  Radar,
  Send,
  Zap,
} from 'lucide-react';
import AgentOrb, { type OrbState } from './AgentOrb';
import { useLeads } from '../../context/LeadContext';
import './assistant.css';

// Lazy-load the 3D orb so it does not block the initial application bundle.
const AgentOrb3D = lazy(() => import('./AgentOrb3D'));

type Mode = 'full' | 'compact';

interface Msg {
  id: string;
  side: 'ai' | 'me';
  html: string;
}

interface Particle {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  delay: number;
}

// Deliberate crescent/spiral particle composition based on the first visual
// reference. These particles belong to the atmosphere, never to the orb mesh.
const PARTICLES: Particle[] = [
  { x: 111, y: 67, radius: 7.2, opacity: 0.95, delay: 0.00 },
  { x: 137, y: 58, radius: 6.4, opacity: 0.92, delay: 0.18 },
  { x: 164, y: 54, radius: 5.2, opacity: 0.86, delay: 0.36 },
  { x: 190, y: 58, radius: 4.0, opacity: 0.78, delay: 0.54 },
  { x: 213, y: 68, radius: 3.0, opacity: 0.64, delay: 0.72 },
  { x: 91, y: 89, radius: 7.6, opacity: 0.96, delay: 0.12 },
  { x: 121, y: 82, radius: 7.0, opacity: 0.94, delay: 0.30 },
  { x: 151, y: 80, radius: 6.1, opacity: 0.90, delay: 0.48 },
  { x: 180, y: 84, radius: 4.8, opacity: 0.80, delay: 0.66 },
  { x: 207, y: 94, radius: 3.5, opacity: 0.67, delay: 0.84 },
  { x: 78, y: 116, radius: 7.4, opacity: 0.94, delay: 0.24 },
  { x: 109, y: 108, radius: 7.1, opacity: 0.95, delay: 0.42 },
  { x: 141, y: 107, radius: 6.5, opacity: 0.91, delay: 0.60 },
  { x: 172, y: 112, radius: 5.2, opacity: 0.83, delay: 0.78 },
  { x: 199, y: 124, radius: 3.8, opacity: 0.68, delay: 0.96 },
  { x: 74, y: 147, radius: 6.7, opacity: 0.90, delay: 0.36 },
  { x: 104, y: 140, radius: 6.8, opacity: 0.93, delay: 0.54 },
  { x: 136, y: 142, radius: 6.1, opacity: 0.89, delay: 0.72 },
  { x: 165, y: 151, radius: 4.9, opacity: 0.78, delay: 0.90 },
  { x: 189, y: 166, radius: 3.2, opacity: 0.61, delay: 1.08 },
  { x: 83, y: 177, radius: 5.8, opacity: 0.82, delay: 0.48 },
  { x: 112, y: 173, radius: 5.9, opacity: 0.87, delay: 0.66 },
  { x: 140, y: 181, radius: 5.0, opacity: 0.78, delay: 0.84 },
  { x: 164, y: 195, radius: 3.6, opacity: 0.62, delay: 1.02 },
  { x: 98, y: 205, radius: 4.4, opacity: 0.68, delay: 0.60 },
  { x: 124, y: 207, radius: 4.2, opacity: 0.70, delay: 0.78 },
  { x: 145, y: 221, radius: 3.0, opacity: 0.54, delay: 0.96 },
  { x: 116, y: 234, radius: 2.6, opacity: 0.44, delay: 0.84 },
];

const uid = () => Math.random().toString(36).slice(2, 9);

const greeting = () => {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
};

/**
 * AssistantCore â€” reusable Executive Agent experience.
 *
 * Placements:
 *   (A) post-login home hero
 *   (B) dedicated /assistant route
 *   (C) floating dock using compact mode
 *
 * Chat remains mocked until the confirmed agentService API is supplied.
 * Briefing and metrics already use live LeadContext data.
 */
const AssistantCore: React.FC<{ mode?: Mode }> = ({ mode = 'full' }) => {
  const navigate = useNavigate();
  const { leads } = useLeads();

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

  const [orb, setOrb] = useState<OrbState>('boot');

  useEffect(() => {
    const timeout = window.setTimeout(() => setOrb('idle'), 2200);
    return () => window.clearTimeout(timeout);
  }, []);

  const briefingText = `You have ${metrics.needsOutreach} leads needing first outreach, ${metrics.awaitingReply} awaiting reply, and ${metrics.readyDemos} demos ready to send. Pipeline value is $${metrics.revenue.toLocaleString()}. Want the daily brief?`;
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
      if (microphoneTimerRef.current !== null) {
        window.clearTimeout(microphoneTimerRef.current);
      }
    },
    []
  );

  // Mock agent response. Replace only after the current complete agentService
  // file confirms the real API contract.
  const runAgent = (text: string) => {
    if (agentTimerRef.current !== null) {
      window.clearTimeout(agentTimerRef.current);
    }

    setOrb('thinking');
    setThinking(true);

    agentTimerRef.current = window.setTimeout(() => {
      setThinking(false);
      setOrb('idle');
      setConversation((current) => [
        ...current,
        { id: uid(), side: 'ai', html: brain(text) },
      ]);
      agentTimerRef.current = null;
    }, 850);
  };

  const send = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value) return;

    setConversation((current) => [
      ...current,
      { id: uid(), side: 'me', html: value },
    ]);
    setInput('');
    runAgent(value);
  };

  const startSimulatedListening = () => {
    if (microphoneTimerRef.current !== null) {
      window.clearTimeout(microphoneTimerRef.current);
    }

    setListening(true);
    setOrb('listening');

    microphoneTimerRef.current = window.setTimeout(() => {
      setListening(false);
      setOrb('idle');
      setInput('Scan for new leads');
      microphoneTimerRef.current = null;
    }, 1600);
  };

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
          <div className="cr-orb-stage">
            <div className="cr-orb-atmosphere" aria-hidden="true" />

            <svg
              className="cr-particle-field"
              viewBox="0 0 320 300"
              aria-hidden="true"
            >
              <defs>
                <filter id="cr-particle-soft-glow" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="2.2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <g filter="url(#cr-particle-soft-glow)">
                {PARTICLES.map((particle, index) => (
                  <circle
                    key={`${particle.x}-${particle.y}-${index}`}
                    className="cr-particle-dot"
                    cx={particle.x}
                    cy={particle.y}
                    r={particle.radius}
                    style={
                      {
                        '--cr-dot-opacity': particle.opacity,
                        '--cr-dot-delay': `${particle.delay}s`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </g>
            </svg>

            <div className="cr-orb-stage__orb">
              <Suspense fallback={<AgentOrb state={orb} size={240} />}>
                <AgentOrb3D state={orb} size={240} />
              </Suspense>
            </div>
          </div>

          <div className="cr-greet">
            <h1>
              Good {greeting()}, <b>Timothy</b>.
            </h1>
            <p className="cr-brief">
              {typed}
              <span className="cr-caret" />
            </p>
          </div>
        </div>
      )}

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
        }}
      >
        {conversation.map((message) => (
          <div key={message.id} className={`cr-msg ${message.side}`}>
            <div className={`cr-av ${message.side}`}>
              {message.side === 'ai' ? 'AI' : 'T'}
            </div>
            <div>
              <div
                className="cr-bubble"
                dangerouslySetInnerHTML={{ __html: message.html }}
              />
            </div>
          </div>
        ))}

        {thinking && (
          <div className="cr-msg ai">
            <div className="cr-av ai">AI</div>
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

      <div className="cr-composer">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') send();
          }}
          placeholder="Ask your assistantâ€¦"
        />

        <button
          className={`cr-icbtn mic ${listening ? 'live' : ''}`}
          onClick={startSimulatedListening}
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

function brain(text: string): string {
  const normalisedText = text.toLowerCase();

  if (normalisedText.includes('brief')) {
    return `Here's your day, Timothy.<br />
â€¢ A few leads still need first outreach<br />
â€¢ Some are awaiting your reply<br />
â€¢ Demos are ready to send<br /><br />
Recommendation: clear outreach first, then chase replies. <span class="cr-row"><button class="cr-mini go" data-go="/outreach">Go to Outreach</button></span>`;
  }

  if (normalisedText.includes('scan')) {
    return `Scan for new businesses on the Lead Finder. I've pre-loaded your filters (no website Â· services). <span class="cr-row"><button class="cr-mini go" data-go="/finder">Open Finder</button></span>`;
  }

  return `I'm your Executive Agent â€” I can scan leads, draft and send outreach, track your pipeline, and create invoices. What would you like to do?`;
}

export default AssistantCore;