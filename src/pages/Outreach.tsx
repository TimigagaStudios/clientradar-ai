import React, { useState } from 'react';
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

const Outreach = () => {
  const { leads, updateLeadStatus, addOutreachLog, updateDemoStatus } = useLeads();
  const { showToast } = useToast();

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [template, setTemplate] = useState('intro');
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedLead = leads.find((l) => l.id === selectedLeadId);

  const templates = {
    intro: {
      subject: "Question about {business_name}'s website",
      body: `Hi,

I was looking for {business_name} online and noticed your website could use some updates to help attract more customers.

I've created a quick demo of what a modern site for your business could look like:
{demo_link}

Let me know if you'd like to discuss.

Best,
Timigaga Studios`,
    },
    followup: {
      subject: "Re: Question about {business_name}'s website",
      body: `Hi again,

Just following up on my previous message. Did you get a chance to check the demo concept for {business_name}?

Here is the link again:
{demo_link}

Let me know what you think.

Best,
Timigaga Studios`,
    },
  };

  const getPreview = () => {
    if (!selectedLead) return { subject: '', body: '' };

    const t = templates[template as keyof typeof templates];
    const demoLink = selectedLead.demoLink || '(No demo link yet)';

    return {
      subject: t.subject.replace(/{business_name}/g, selectedLead.businessName),
      body: t.body
        .replace(/{business_name}/g, selectedLead.businessName)
        .replace(/{demo_link}/g, demoLink),
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

    setIsSending(true);

    try {
      const preview = getPreview();

      const response = await fetch('/api/send-outreach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toEmail: selectedLead.email,
          toName: selectedLead.businessName,
          subject: preview.subject,
          body: preview.body,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Failed to send outreach email');
      }

      await addOutreachLog(selectedLeadId, {
        type: template as 'intro' | 'followup',
        subject: preview.subject,
        body: preview.body,
        sentAt: new Date().toISOString(),
        channel: 'email',
      });

      await updateLeadStatus(selectedLeadId, 'Email Sent');

      if (
        selectedLead.demoLink ||
        selectedLead.demoStatus === 'Ready' ||
        selectedLead.status === 'Demo Created'
      ) {
        await updateDemoStatus(selectedLeadId, 'Sent');
      }

      showToast({
        type: 'success',
        title: 'Outreach sent',
        message: `Email successfully sent to ${selectedLead.businessName}.`,
      });

      setSelectedLeadId(null);
    } catch (error) {
      console.error(error);
      showToast({
        type: 'error',
        title: 'Send failed',
        message: error instanceof Error ? error.message : 'Failed to send outreach email.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const filteredLeads = leads.filter(
    (l) =>
      (l.status === 'New' ||
        l.status === 'Demo Created' ||
        l.status === 'Interested' ||
        l.status === 'Pending Reply') &&
      l.businessName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const preview = getPreview();

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col xl:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Lead List */}
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
          {filteredLeads.map((lead) => (
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
        </div>
      </div>

      {/* Composer */}
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
                <div className="neo-in rounded-2xl p-4 text-[var(--text-primary)] text-sm font-medium">
                  {preview.subject}
                </div>
              </div>

              <div className="space-y-2 h-full flex flex-col">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-[0.18em]">
                  Message
                </label>
                <div className="flex-1 neo-in rounded-2xl p-5 text-[var(--text-primary)] text-sm whitespace-pre-wrap leading-7 font-mono">
                  {preview.body}
                </div>
              </div>
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
    </div>
  );
};

export default Outreach;
