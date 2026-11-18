import OutreachHistory from '../components/OutreachHistory';
import Replies from './Replies';
import { useEffect, useState } from 'react';
import { useLeads } from '../context/LeadContext';
import {
  Send,
  Mail,
  ChevronRight,
  User,
  Search,
  Sparkles,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useToast } from '../components/ui/useToast';
import ListPager, { usePagedList } from '../components/ui/ListPager';
import { QaRequestError, useQaReview } from '../components/QaReviewDialog';
import DraftQa from '../components/DraftQa';

const Outreach = () => {
  const { leads, refreshLeads } = useLeads();
  const { showToast } = useToast();
  const { postWithQaReview, qaReviewDialog } = useQaReview();

  const [view, setView] = useState<'compose' | 'sent' | 'replies'>(() => {
    try { const saved = sessionStorage.getItem('cr-outreach-view'); return saved === 'sent' || saved === 'replies' ? saved : 'compose'; } catch { return 'compose'; }
  });
  useEffect(() => { try { sessionStorage.setItem('cr-outreach-view', view); } catch { /* optional */ } }, [view]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [template, setTemplate] = useState('intro');
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [uncertain, setUncertain] = useState<{ fingerprint: string; state: string; recipient?: string; subject?: string } | null>(null);

  const selectedLead = leads.find((l) => l.id === selectedLeadId);

  const templates = {
    intro: {
      subject: "Question about {business_name}'s website",
      body: `Hi,

I'm Timothy from Timigaga Studios. I would be happy to discuss a website for {business_name}.

{demo_note}

Let me know if you'd like to discuss.

Best,
Timigaga Studios`,
    },
    followup: {
      subject: "Re: Question about {business_name}'s website",
      body: `Hi,

I'm Timothy from Timigaga Studios. I would be happy to discuss a website for {business_name}.

{demo_note}

Let me know what you think.

Best,
Timigaga Studios`,
    },
  };

  useEffect(() => {
    const savedDraft = localStorage.getItem('clientradar-outreach-draft');

    if (!savedDraft) return;

    try {
      const parsed = JSON.parse(savedDraft);
      if (parsed.leadId) setSelectedLeadId(parsed.leadId);
      if (parsed.subject) setCustomSubject(parsed.subject);
      if (parsed.body) setCustomBody(parsed.body);

      if (parsed.type === 'Follow-up Email') {
        setTemplate('followup');
      } else {
        setTemplate('intro');
      }

      localStorage.removeItem('clientradar-outreach-draft');
    } catch (error) {
      console.error('Failed to load outreach draft', error);
    }
  }, []);

  const getPreview = () => {
    if (!selectedLead) return { subject: '', body: '' };

    const t = templates[template as keyof typeof templates];
    let demoUrl = '';
    try {
      if (selectedLead.demoLink) {
        const parsed = new URL(selectedLead.demoLink, window.location.origin);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') demoUrl = parsed.href;
      }
    } catch { /* An invalid link is not placed into an email. */ }
    const demoNote = demoUrl ? `Here is a sample website concept for ${selectedLead.businessName}:\n${demoUrl}\nIt is only a sample and can be changed.` : 'Please let me know if you would like to talk about your website needs.';

    const defaultSubject = t.subject.replace(/{business_name}/g, selectedLead.businessName);
    const defaultBody = t.body
      .replace(/{business_name}/g, selectedLead.businessName)
      .replace(/{demo_note}/g, demoNote);

    return {
      subject: customSubject || defaultSubject,
      body: customBody || defaultBody,
    };
  };

  const handleSend = async () => {
    if (!selectedLeadId || !selectedLead) return;

    if (!selectedLead.email) {
      showToast({
        type: 'error',
        title: 'Missing email',
        message: 'This lead does not have an email address yet.',
      });
      return;
    }

    if (!window.confirm(`Send this email to ${selectedLead.email} now?`)) return;
    setIsSending(true);

    try {
      const preview = getPreview();

      await postWithQaReview('/api/send-outreach', {
        leadId: selectedLeadId,
        mailKind: template,
        toEmail: selectedLead.email,
        toName: selectedLead.businessName,
        subject: preview.subject,
        body: preview.body,
        confirm: true,
      });

      await refreshLeads();
      setUncertain(null);

      showToast({
        type: 'success',
        title: 'Email accepted',
        message: `Brevo accepted the email to ${selectedLead.businessName}; delivery is not confirmed.`,
      });

      setSelectedLeadId(null);
      setCustomSubject('');
      setCustomBody('');
    } catch (error) {
      console.error(error);
      if (error instanceof QaRequestError && error.code === 'DIRECT_SEND_NEEDS_REVIEW' && typeof error.review?.fingerprint === 'string') setUncertain(error.review);
      showToast({
        type: 'error',
        title: 'Review send status',
        message: `${error instanceof Error ? error.message : 'Could not confirm the result.'} If the request reached Brevo, check there before trying again.`,
      });
    } finally {
      setIsSending(false);
    }
  };

  const resolveDirect = async (resolution: 'accepted' | 'not_sent') => {
    if (!uncertain || uncertain.state === 'sent') return;
    const detail = resolution === 'accepted' ? 'Brevo accepted this exact email' : 'Brevo did not accept this exact email';
    if (!window.confirm(`Have you checked Brevo and confirmed that ${detail}? This records your decision and does not send an email.`)) return;
    try {
      const response = await fetch('/api/send-outreach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resolve', fingerprint: uncertain.fingerprint, resolution, confirm: true }) });
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Could not record the provider result.');
      setUncertain(null); await refreshLeads();
      showToast({ type: 'success', title: 'Provider result recorded', message: resolution === 'accepted' ? 'Accepted is not proof of delivery. No new email was sent.' : 'No email was sent by this action. Review and approve again if you want to retry.' });
    } catch (error) { showToast({ type: 'error', title: 'Could not record result', message: error instanceof Error ? error.message : 'Check Brevo and try again.' }); }
  };

  const filteredLeads = leads.filter(
    (l) =>
      (l.status === 'New' ||
        l.status === 'Demo Created' ||
        l.status === 'Interested' ||
        l.status === 'Pending Reply') &&
      l.businessName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const outreachPager = usePagedList(filteredLeads, searchTerm, 10);

  const preview = getPreview();

  return (
    <div className="space-y-4 pb-24">
      {qaReviewDialog}
      {uncertain && <div className="neo-card p-4 text-sm text-[var(--text-primary)]" role="alert">
        <p>{uncertain.state === 'sent' ? 'This exact email is already recorded as accepted. It was not sent again.' : 'This send is in progress or uncertain. Check Brevo before continuing. An in-progress request can require a short wait.'}</p>
        {(uncertain.recipient || uncertain.subject) && <p className="mt-1 break-words">{uncertain.recipient || ''} {uncertain.subject ? `- ${uncertain.subject}` : ''}</p>}
        {uncertain.state !== 'sent' && <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => void resolveDirect('accepted')} className="neo-button rounded-full px-3 py-2">Provider accepted it</button><button type="button" onClick={() => void resolveDirect('not_sent')} className="neo-button rounded-full px-3 py-2">Provider did not accept it</button></div>}
      </div>}
      <nav className="flex flex-wrap gap-2" aria-label="Outreach sections">
        {(['compose', 'sent', 'replies'] as const).map((item) => <button type="button" key={item} onClick={() => setView(item)} aria-pressed={view === item} className={cn('rounded-full px-4 py-2 text-sm font-bold', view === item ? 'btn-neumorph-primary' : 'neo-button')}>
          {item === 'compose' ? 'Compose' : item === 'sent' ? 'Sent history' : 'Replies'}
        </button>)}
      </nav>
      {view === 'sent' && <OutreachHistory />}
      {view === 'replies' && <Replies />}
      {view === 'compose' && <div className="h-[calc(100vh-8rem)] flex flex-col xl:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="w-full xl:w-[360px] shrink-0 neo-card overflow-hidden flex flex-col">
        <div className="p-5 border-b border-black/8 dark:border-white/8 transition-colors duration-300">
          <h2 className="font-bold text-[var(--text-primary)] mb-4 text-lg">
            Outreach Queue
          </h2>

          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
              size={18}
            />
            <input
              type="text"
              placeholder="Search leads..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl neo-in text-sm text-[var(--text-primary)] outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {outreachPager.visible.map((lead) => (
            <button
              key={lead.id}
              onClick={() => setSelectedLeadId(lead.id)}
              className={cn(
                'w-full text-left px-5 py-4 border-b border-black/8 dark:border-white/8 transition-colors flex items-center justify-between group',
                selectedLeadId === lead.id
                  ? 'bg-[var(--accent)]/10'
                  : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
              )}
            >
              <div>
                <p
                  className={cn(
                    'font-semibold',
                    selectedLeadId === lead.id
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--text-primary)]'
                  )}
                >
                  {lead.businessName}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {lead.city}
                </p>
              </div>

              <ChevronRight
                size={16}
                className={cn(
                  'text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity',
                  selectedLeadId === lead.id && 'opacity-100 text-[var(--accent)]'
                )}
              />
            </button>
          ))}

          {filteredLeads.length === 0 && (
            <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
              No leads available for outreach.
            </div>
          )}

          <ListPager pager={outreachPager} noun="leads" compact className="m-3" />
        </div>
      </div>

      <div className="flex-1 neo-card overflow-hidden flex flex-col min-h-[600px]">
        {selectedLead ? (
          <>
            <div className="p-6 border-b border-black/8 dark:border-white/8 transition-colors duration-300 flex flex-col md:flex-row justify-between gap-4 md:items-center">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl neo-in flex items-center justify-center text-[var(--text-secondary)]">
                  <User size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-[var(--text-primary)]">
                    {selectedLead.businessName}
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)]">
                    To: {selectedLead.email || 'No email found'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="rounded-xl neo-in px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none"
                >
                  <option className="bg-[#0A0A0A] text-white" value="intro">
                    Intro Email
                  </option>
                  <option className="bg-[#0A0A0A] text-white" value="followup">
                    Follow Up
                  </option>
                </select>
              </div>
            </div>

            <div className="flex-1 p-6 space-y-5 overflow-y-auto">
              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-[0.18em]">
                  Subject
                </label>
                <textarea
                  value={customSubject || preview.subject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  rows={2}
                  className="w-full neo-in rounded-2xl p-4 text-[var(--text-primary)] text-sm font-medium outline-none resize-none"
                />
              </div>

              <div className="space-y-2 h-full flex flex-col">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-[0.18em]">
                  Message
                </label>
                <textarea
                  value={customBody || preview.body}
                  onChange={(e) => setCustomBody(e.target.value)}
                  className="flex-1 w-full neo-in rounded-2xl p-5 text-[var(--text-primary)] text-sm whitespace-pre-wrap leading-7 font-mono outline-none resize-none"
                />
              </div>
              <DraftQa subject={preview.subject} body={preview.body} />
            </div>

            <div className="p-5 border-t border-black/8 dark:border-white/8 transition-colors duration-300 flex flex-col sm:flex-row justify-between gap-4 sm:items-center bg-black/[0.02] dark:bg-white/[0.02]">
              <p className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                <Sparkles size={13} className="text-[var(--accent)]" />
                Using {template} template
              </p>

              <button
                onClick={handleSend}
                disabled={isSending}
                className="btn-neumorph-primary px-5 py-3 text-sm font-bold tracking-[0.08em] uppercase gap-2"
              >
                {isSending ? (
                  'Sending...'
                ) : (
                  <>
                    <Send size={16} />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-secondary)] px-6 text-center">
            <Mail size={52} className="mb-4 opacity-20" />
            <p className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              Select a lead to start outreach
            </p>
            <p className="text-sm opacity-70">
              Choose a lead from the queue and generate a cleaner outbound message flow.
            </p>
          </div>
        )}
      </div>
      </div>}
    </div>
  );
};

export default Outreach;
