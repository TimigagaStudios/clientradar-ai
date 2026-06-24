import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeads } from '../context/LeadContext';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Globe,
  Star,
  Clock,
  AlertCircle,
  ExternalLink,
  Save,
  Send,
  MoreVertical,
  Mail,
  CheckCircle2,
  XCircle,
  MonitorPlay,
  Sparkles,
  Brain,
} from 'lucide-react';
import { format } from 'date-fns';
import { LeadStatus, LeadPriority, DemoStatus } from '../types';
import { cn } from '../utils/cn';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/useToast';

type LeadNote = {
  id: string;
  content: string;
  created_at: string;
};

type OutreachLog = {
  id: string;
  type: string;
  subject: string;
  body: string;
  sent_at: string;
  channel: string;
};

const LeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
const {
  leads,
  loading,
  updateLeadStatus,
  addDemoLink,
  deleteLead,
  updateDemoStatus,
} = useLeads();

const lead = useMemo(
  () => leads.find((l) => String(l.id) === String(id)),
  [leads, id]
);

const leadLookupPending =
  !lead &&
  (!!id && (loading || leads.length === 0));
  const [demoUrl, setDemoUrl] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [outreachLogs, setOutreachLogs] = useState<OutreachLog[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchNotes = async () => {
      if (!id) return;

      try {
        const response = await fetch(`/api/lead-notes?leadId=${id}`);
        const result = await response.json();
        if (response.ok) setNotes(result.data || []);
      } catch (error) {
        console.error('Failed to fetch notes', error);
      }
    };

    const fetchOutreachLogs = async () => {
      if (!id) return;

      try {
        const response = await fetch(`/api/outreach-logs?leadId=${id}`);
        const result = await response.json();
        if (response.ok) setOutreachLogs(result.data || []);
      } catch (error) {
        console.error('Failed to fetch outreach logs', error);
      }
    };

    fetchNotes();
    fetchOutreachLogs();
  }, [id]);

if (loading || leadLookupPending) {
  return (
    <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
      Loading lead details...
    </div>
  );
}

if (!lead && !leadLookupPending) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]">
      <p>Lead not found</p>
      <button
        onClick={() => navigate('/leads')}
        className="mt-4 text-[var(--accent)] hover:underline"
      >
        Back to Leads
      </button>
    </div>
  );
}

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateLeadStatus(lead.id, e.target.value as LeadStatus);
  };

  const handleDemoStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateDemoStatus(lead.id, e.target.value as DemoStatus);
  };

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (demoUrl) {
      addDemoLink(lead.id, demoUrl);
      setDemoUrl('');
      showToast({
        type: 'success',
        title: 'Demo link saved',
        message: 'The demo link has been attached to this lead.',
      });
    }
  };

  const handleAddNote = async () => {
    if (!noteInput.trim() || !id) return;

    try {
      const response = await fetch('/api/lead-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: id, content: noteInput }),
      });

      const result = await response.json();

      if (response.ok) {
        setNotes((prev) => [result.data, ...prev]);
        setNoteInput('');
        showToast({
          type: 'success',
          title: 'Note saved',
          message: 'Your note was added successfully.',
        });
      }
    } catch (error) {
      console.error('Failed to save note', error);
      showToast({
        type: 'error',
        title: 'Note failed',
        message: 'Could not save note.',
      });
    }
  };

  const handleSendOutreach = () => {
    navigate('/outreach');
  };

  const handleMarkInterested = async () => {
    await updateLeadStatus(lead.id, 'Interested');
    setMenuOpen(false);
    showToast({
      type: 'success',
      title: 'Lead updated',
      message: `${lead.businessName} marked as Interested.`,
    });
  };

  const handleMarkRejected = async () => {
    await updateLeadStatus(lead.id, 'Rejected');
    setMenuOpen(false);
    showToast({
      type: 'success',
      title: 'Lead updated',
      message: `${lead.businessName} marked as Rejected.`,
    });
  };

  const handleDeleteLead = async () => {
    await deleteLead(lead.id);
    setConfirmDeleteOpen(false);
    showToast({
      type: 'success',
      title: 'Lead deleted',
      message: `${lead.businessName} was removed from your pipeline.`,
    });
    navigate('/leads');
  };

  const statusOptions: LeadStatus[] = [
    'New',
    'Demo Created',
    'Email Sent',
    'Pending Reply',
    'Interested',
    'Negotiating',
    'Rejected',
    'Deal Closed',
  ];

  const demoStatusOptions: DemoStatus[] = [
    'Not Started',
    'In Progress',
    'Ready',
    'Sent',
  ];

  const demoStatusStyles: Record<string, string> = {
    'Not Started': 'bg-gray-500/10 text-gray-400 border-gray-400/20',
    'In Progress': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    Ready: 'bg-green-500/10 text-green-500 border-green-500/20',
    Sent: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  };

  const priorityColors: Record<LeadPriority, string> = {
    Low: 'text-gray-400',
    Medium: 'text-yellow-500',
    High: 'text-red-500',
  };

  const aiSummary = useMemo(() => {
    const reasons: string[] = [];
    const opportunities: string[] = [];

    if (!lead.website) {
      reasons.push('has no visible website');
      opportunities.push('offer a full website build');
    } else if (lead.outdatedWebsite) {
      reasons.push('has an outdated website');
      opportunities.push('pitch a redesign or modernization');
    } else {
      reasons.push('already has a web presence');
      opportunities.push('improve branding, UX, and conversion');
    }

    if (lead.leadScore >= 70) {
      reasons.push(`has a strong lead score of ${lead.leadScore}`);
    } else if (lead.leadScore >= 40) {
      reasons.push(`has a moderate lead score of ${lead.leadScore}`);
    } else {
      reasons.push(`has a lower lead score of ${lead.leadScore}`);
    }

    if (lead.priority === 'High') {
      opportunities.push('prioritize this lead for early follow-up');
    }

    if (lead.demoStatus === 'Ready') {
      opportunities.push('send the demo as soon as possible');
    }

    if (lead.status === 'Interested' || lead.status === 'Negotiating') {
      opportunities.push('move quickly toward proposal or closing');
    }

    const summary = `${lead.businessName} is a ${lead.priority.toLowerCase()}-priority ${lead.category.toLowerCase()} lead in ${lead.city} that ${reasons.join(
      ' and '
    )}.`;

    const nextStep =
      opportunities.length > 0
        ? `Recommended next step: ${opportunities[0]}.`
        : 'Recommended next step: continue qualification and monitor response.';

    return {
      summary,
      nextStep,
    };
  }, [lead]);

  const aiScoring = useMemo(() => {
    const strengths: string[] = [];
    const risks: string[] = [];
    const recommendation: string[] = [];

    if (!lead.website) {
      strengths.push('No website creates strong immediate opportunity.');
    } else if (lead.outdatedWebsite) {
      strengths.push('Outdated website gives a clear redesign angle.');
    } else {
      risks.push('Existing website may reduce urgency unless positioning is weak.');
    }

    if (lead.rating >= 4) {
      strengths.push('Strong review reputation suggests business credibility.');
    } else {
      risks.push('Lower review strength may reduce commercial urgency.');
    }

    if (lead.reviewCount >= 20) {
      strengths.push('Healthy review count suggests active customer demand.');
    } else {
      risks.push('Low review count may indicate weaker market traction.');
    }

    if (lead.priority === 'High') {
      strengths.push('Already classified as high priority.');
    }

    if (lead.demoStatus === 'Ready') {
      recommendation.push('Send the demo immediately while momentum is strong.');
    } else if (lead.demoStatus === 'In Progress') {
      recommendation.push('Finish the demo and prepare the outreach angle.');
    } else if (lead.status === 'New') {
      recommendation.push('Decide whether to create a demo or send a first-touch message.');
    } else if (lead.status === 'Interested') {
      recommendation.push('Move toward a proposal or direct next-step conversation.');
    } else {
      recommendation.push('Continue progressing this lead through the pipeline.');
    }

    return {
      strengths,
      risks,
      recommendation,
    };
  }, [lead]);

  const cardClasses = 'neo-card p-6 md:p-8';
  const inputClasses =
    'w-full rounded-2xl neo-in px-4 py-3.5 text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none';
  const labelClasses =
    'text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-[0.16em]';

  const currentDemoStatus = lead.demoStatus || 'Not Started';

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <button
          onClick={() => navigate('/leads')}
          className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Leads
        </button>

<div className="flex items-center gap-5 shrink-0">
<div className="relative flex-shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
className="w-12 h-12 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-2xl neo-button text-[var(--text-secondary)] hover:text-[var(--accent)] shrink-0 touch-manipulation"
            >
              <MoreVertical size={18} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-3 w-56 neo-card p-2 z-50">
                <button
                  onClick={handleMarkInterested}
                  className="w-full text-left px-4 py-3 rounded-xl text-[var(--text-primary)] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                >
                  Mark Interested
                </button>
                <button
                  onClick={handleMarkRejected}
                  className="w-full text-left px-4 py-3 rounded-xl text-[var(--text-primary)] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                >
                  Mark Rejected
                </button>
                <button
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="w-full text-left px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                >
                  Delete Lead
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleSendOutreach}
            className="btn-neumorph-primary px-5 py-3 text-sm font-bold tracking-[0.08em] uppercase gap-2"
          >
            <Send size={16} />
            Send Outreach
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className={cardClasses}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 neo-in rounded-xl">
                <Sparkles size={18} className="text-[var(--accent)]" />
              </div>
              <h3 className="font-bold text-lg text-[var(--text-primary)]">
                AI Lead Summary
              </h3>
            </div>

            <div className="space-y-4">
              <div className="neo-in p-5 rounded-2xl">
                <p className="text-sm text-[var(--text-primary)] leading-7">
                  {aiSummary.summary}
                </p>
              </div>
              <div className="neo-in p-5 rounded-2xl">
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                  Recommended next action
                </p>
                <p className="text-sm text-[var(--text-secondary)] leading-7">
                  {aiSummary.nextStep}
                </p>
              </div>
            </div>
          </div>

          <div className={cardClasses}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 neo-in rounded-xl">
                <Brain size={18} className="text-[var(--accent)]" />
              </div>
              <h3 className="font-bold text-lg text-[var(--text-primary)]">
                AI Lead Scoring Assistant
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="neo-in p-5 rounded-2xl">
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                  Strengths
                </p>
                {aiScoring.strengths.length > 0 ? (
                  <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                    {aiScoring.strengths.map((item, index) => (
                      <li key={index}>• {item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">No major strengths yet.</p>
                )}
              </div>

              <div className="neo-in p-5 rounded-2xl">
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                  Risks
                </p>
                {aiScoring.risks.length > 0 ? (
                  <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                    {aiScoring.risks.map((item, index) => (
                      <li key={index}>• {item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">No significant risks detected.</p>
                )}
              </div>

              <div className="neo-in p-5 rounded-2xl">
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                  Recommendation
                </p>
                <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                  {aiScoring.recommendation.map((item, index) => (
                    <li key={index}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className={cardClasses}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">
                  {lead.businessName}
                </h1>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1">
                    <MapPin size={16} />
                    {lead.city}
                  </span>
                  <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full" />
                  <span>{lead.category}</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="text-right">
                  <span className="text-xs text-[var(--text-secondary)] uppercase block mb-2">
                    Status
                  </span>
                  <select
                    value={lead.status}
                    onChange={handleStatusChange}
                    className="appearance-none rounded-xl neo-in px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
                  >
                    {statusOptions.map((option) => (
                      <option key={option} value={option} className="bg-[#0A0A0A] text-white">
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border',
                    demoStatusStyles[currentDemoStatus]
                  )}
                >
                  {currentDemoStatus}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-black/8 dark:border-white/8">
              <div>
                <h3 className={`${labelClasses} mb-3`}>Contact Info</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-[var(--text-primary)]">
                    <Phone size={18} className="text-[var(--text-secondary)]" />
                    {lead.phone}
                  </div>

                  {lead.email && (
                    <div className="flex items-center gap-3 text-[var(--text-primary)]">
                      <Mail size={18} className="text-[var(--text-secondary)]" />
                      {lead.email}
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-[var(--text-primary)]">
                    <Globe size={18} className="text-[var(--text-secondary)]" />
                    {lead.website ? (
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--accent)] hover:underline truncate"
                      >
                        {lead.website}
                      </a>
                    ) : (
                      <span className="text-red-400 flex items-center gap-2">
                        <AlertCircle size={14} /> No Website
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h3 className={`${labelClasses} mb-3`}>Metrics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="neo-in p-4 rounded-2xl">
                    <span className="text-xs text-[var(--text-secondary)] block mb-1">
                      Rating
                    </span>
                    <div className="flex items-center gap-1 font-bold text-lg text-[var(--text-primary)]">
                      {lead.rating}
                      <Star size={14} className="text-yellow-500 fill-yellow-500" />
                    </div>
                  </div>

                  <div className="neo-in p-4 rounded-2xl">
                    <span className="text-xs text-[var(--text-secondary)] block mb-1">
                      Lead Score
                    </span>
                    <div
                      className={cn(
                        'font-bold text-lg',
                        lead.leadScore > 70
                          ? 'text-green-500'
                          : lead.leadScore > 40
                          ? 'text-yellow-500'
                          : 'text-gray-400'
                      )}
                    >
                      {lead.leadScore}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={cardClasses}>
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <MonitorPlay size={18} className="text-[var(--accent)]" />
              Demo Workflow
            </h3>

            <div className="space-y-5">
              <div>
                <label className={`${labelClasses} mb-3 block`}>Demo Status</label>
                <select
                  value={currentDemoStatus}
                  onChange={handleDemoStatusChange}
                  className="w-full rounded-2xl neo-in px-4 py-3 text-[var(--text-primary)] outline-none"
                >
                  {demoStatusOptions.map((status) => (
                    <option key={status} value={status} className="bg-[#0A0A0A] text-white">
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {lead.demoLink ? (
                <div className="flex items-center justify-between p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="bg-purple-500 text-white p-2 rounded-xl">
                      <Globe size={20} />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm text-purple-300 font-medium">Demo Available</p>
                      <a
                        href={lead.demoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:underline truncate block"
                      >
                        {lead.demoLink}
                      </a>
                    </div>
                  </div>

                  <a
                    href={lead.demoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-purple-500/20 rounded-xl transition-colors text-purple-400"
                  >
                    <ExternalLink size={20} />
                  </a>
                </div>
              ) : (
                <form onSubmit={handleDemoSubmit} className="flex gap-3">
                  <input
                    type="url"
                    placeholder="Paste demo website link here..."
                    className={`${inputClasses} flex-1`}
                    value={demoUrl}
                    onChange={(e) => setDemoUrl(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={!demoUrl}
                    className="btn-neumorph-primary px-5 py-3 text-sm font-semibold disabled:opacity-50"
                  >
                    Save
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className={cardClasses}>
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">Notes</h3>

            <div className="space-y-4">
              <textarea
                className="w-full h-28 neo-in rounded-2xl p-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none resize-none"
                placeholder="Add notes about this lead..."
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
              />

              <div className="flex justify-end">
                <button
                  onClick={handleAddNote}
                  className="inline-flex items-center gap-2 px-4 py-2 neo-button text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl text-sm font-medium transition-colors"
                >
                  <Save size={16} /> Save Note
                </button>
              </div>

              {notes.length > 0 ? (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div key={note.id} className="neo-in p-4 rounded-2xl">
                      <p className="text-sm text-[var(--text-primary)] leading-7">
                        {note.content}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-3">
                        {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="neo-in p-6 rounded-2xl text-[var(--text-secondary)] text-sm">
                  No notes yet for this lead.
                </div>
              )}
            </div>
          </div>

          <div className={cardClasses}>
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">
              Outreach History
            </h3>

            {outreachLogs.length > 0 ? (
              <div className="space-y-4">
                {outreachLogs.map((item) => (
                  <div key={item.id} className="neo-in p-4 rounded-2xl">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold">
                        <Mail size={16} className="text-[var(--accent)]" />
                        <span className="capitalize">{item.type} Email</span>
                      </div>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {format(new Date(item.sent_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                      {item.subject}
                    </p>

                    <p className="text-sm text-[var(--text-secondary)] leading-7 whitespace-pre-wrap">
                      {item.body}
                    </p>

                    <div className="mt-3 text-xs text-[var(--text-secondary)] uppercase tracking-[0.14em]">
                      Channel: {item.channel}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="neo-in p-6 rounded-2xl text-[var(--text-secondary)] text-sm">
                No outreach history yet for this lead.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className={cardClasses}>
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">
              Activity Journal
            </h3>

            <div className="relative pl-4 space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-0.5 before:bg-black/10 dark:before:bg-white/10">
              {lead.timeline.map((event, idx) => (
                <div key={event.id || idx} className="relative pl-6">
                  <div className="absolute left-[-5px] top-1.5 w-3 h-3 rounded-full bg-[var(--bg-secondary)] border-2 border-[var(--accent)] z-10" />
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {event.type}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {event.description}
                    </p>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1 flex items-center gap-1 opacity-70">
                      <Clock size={10} />
                      {format(new Date(event.date), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={cardClasses}>
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">
              Lead Value
            </h3>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-[var(--text-primary)]">
                ${lead.dealValue?.toLocaleString() || '0'}
              </span>
              <span className="text-[var(--text-secondary)] text-sm">
                potential value
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-2">
              Estimated based on standard website package pricing.
            </p>
          </div>

          <div className={cardClasses}>
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">
              Priority Signal
            </h3>
            <p className={cn('text-lg font-semibold', priorityColors[lead.priority])}>
              {lead.priority} Priority
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              Based on website status, reviews, rating, and lead score.
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete Lead"
        description={`Are you sure you want to permanently delete ${lead.businessName}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        onConfirm={handleDeleteLead}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
};

export default LeadDetail;