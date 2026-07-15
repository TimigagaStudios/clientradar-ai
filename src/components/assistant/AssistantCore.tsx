import React, {
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
import AgentPresence, {
  type AgentPresenceState,
} from './AgentPresence';
import { useLeads } from '../../context/LeadContext';
import './assistant.css';

type Mode = 'full' | 'compact';

interface Msg {
  id: string;
  side: 'ai' | 'me';
  html: string;
}

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

  const [presenceState, setPresenceState] =
    useState<AgentPresenceState>('boot');

  useEffect(() => {
    const timeout = window.setTimeout(() => setPresenceState('idle'), 2200);
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

    setPresenceState('thinking');
    setThinking(true);

    agentTimerRef.current = window.setTimeout(() => {
      setThinking(false);
      setPresenceState('idle');
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
    setPresenceState('listening');

    microphoneTimerRef.current = window.setTimeout(() => {
      setListening(false);
      setPresenceState('idle');
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
          <div className="cr-presence-stage">
            <AgentPresence state={presenceState} size={300} />
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