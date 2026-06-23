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

  // ✅ FIXED: use loading + no local lead state
  const {
    leads,
    loading,
    updateLeadStatus,
    addDemoLink,
    deleteLead,
    updateDemoStatus
  } = useLeads();

  const lead = leads.find((l) => l.id === id);

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
    if (!id) return;

    const fetchNotes = async () => {
      try {
        const response = await fetch(`/api/lead-notes?leadId=${id}`);
        const result = await response.json();
        if (response.ok) setNotes(result.data || []);
      } catch (error) {
        console.error('Failed to fetch notes', error);
      }
    };

    const fetchOutreachLogs = async () => {
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

  // ✅ FIXED: Proper loading guard
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
        Loading lead details...
      </div>
    );
  }

  if (!lead) {
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

        <div className="flex items-center gap-4 shrink-0">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="w-11 h-11 flex items-center justify-center rounded-2xl neo-button text-[var(--text-secondary)] hover:text-[var(--accent)] shrink-0"
            >
              <MoreVertical size={20} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-3 w-56 neo-card p-2 z-50">
                <button
                  onClick={handleMarkInterested}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                >
                  Mark Interested
                </button>
                <button
                  onClick={handleMarkRejected}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                >
                  Mark Rejected
                </button>
                <button
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="w-full text-left px-4 py-3 rounded-xl text-red-500"
                >
                  Delete Lead
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleSendOutreach}
            className="btn-neumorph-primary px-5 py-3 text-sm font-bold uppercase"
          >
            <Send size={16} />
            Send Outreach
          </button>
        </div>
      </div>

      {/* ✅ KEEP YOUR ENTIRE ORIGINAL JSX BELOW THIS EXACTLY AS IT WAS */}

      {/* From AI Lead Summary down to Priority Signal stays untouched */}

      {/* I am not rewriting those sections because they are already correct in your file */}

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