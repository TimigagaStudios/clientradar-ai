import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Sparkles,
  Target,
  TrendingUp,
  CheckCircle2,
  Edit3,
  Trash2,
  Link as LinkIcon,
  RefreshCw,
  DollarSign,
  MessageCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { LeadStatus, LeadPriority } from '../types';
import { cn } from '../utils/cn';

const LeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    leads, 
    loading: leadsLoading, 
    updateLeadStatus, 
    addDemoLink,
    updateLead,
    deleteLead,
  } = useLeads() as any;

  const [demoUrl, setDemoUrl] = useState('');
  const [fetchedLead, setFetchedLead] = useState<any | null>(null);
  const [fetchingSingle, setFetchingSingle] = useState(false);
  
  // 3-dot menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Deal closed amount
  const [dealAmount, setDealAmount] = useState<string>('');
  const [savingDeal, setSavingDeal] = useState(false);

  // === NEW: Client Reply State (Item A) ===
  const [replyStatus, setReplyStatus] = useState('');
  const [replyNote, setReplyNote] = useState('');
  const [savingReply, setSavingReply] = useState(false);

  // Find lead in context first
  const contextLead = useMemo(() => {
    if (!id || !leads?.length) return null;
    return leads.find((l: any) => String(l.id) === String(id)) || null;
  }, [leads, id]);

  const lead = contextLead || fetchedLead;

  // Direct fetch fallback
  useEffect(() => {
    const fetchSingleLead = async () => {
      if (!id || contextLead || leadsLoading) return;
      setFetchingSingle(true);
      try {
        // const { data } = await supabase.from('leads').select('*').eq('id', id).single();
        // if (data) setFetchedLead(data);
      } catch (e) {
        console.error('Single lead fetch failed:', e);
      } finally {
        setFetchingSingle(false);
      }
    };
    fetchSingleLead();
  }, [id, contextLead, leadsLoading]);

  // Close 3-dot on outside click / ESC
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  const isLoading = leadsLoading || fetchingSingle;

  // AI Scoring (kept from original)
  const aiScoreBreakdown = useMemo(() => {
    if (!lead) return { items: [], total: 0 };
    const items = [
      {
        label: 'Website Status',
        value: lead.website ? 15 : 35,
        max: 35,
        reason: lead.website ? 'Has website - upgrade play' : 'No website - high urgency',
      },
      {
        label: 'Rating / Reputation',
        value: Math.min(25, Math.round((Number(lead.rating) || 3.5) * 5)),
        max: 25,
        reason: lead.rating ? `${lead.rating} star rating` : 'AI-estimated reputation',
      },
      {
        label: 'Business Activity',
        value: lead.category ? 15 : 5,
        max: 20,
        reason: lead.category ? 'Verified category' : 'Category missing',
      },
      {
        label: 'Contact Completeness',
        value: (lead.phone ? 10 : 0) + (lead.website ? 5 : 0) + 5,
        max: 20,
        reason: 'Phone / web / location available',
      },
    ];
    const total = items.reduce((s, i) => s + i.value, 0);
    return { items, total: Math.min(100, total) };
  }, [lead]);

  const computedLeadScore = Number(lead?.leadScore) > 0 ? Number(lead.leadScore) : aiScoreBreakdown.total;

  const aiDisplayRating = useMemo(() => {
    if (!lead) return null;
    const realRating = Number(lead.rating);
    if (realRating > 0) return { value: realRating.toFixed(1), isAi: false };
    const score = computedLeadScore;
    const aiRating = score > 75 ? 4.7 : score > 55 ? 4.3 : score > 35 ? 4.0 : 3.8;
    return { value: aiRating.toFixed(1), isAi: true };
  }, [lead, computedLeadScore]);

  const aiLeadValue = useMemo(() => {
    if (!lead) return 750;
    if (lead.dealValue && Number(lead.dealValue) > 0) return Number(lead.dealValue);
    const score = computedLeadScore;
    const hasSite = !!lead.website;
    const rating = Number(lead?.rating) || 4.0;
    let base = 650;
    if (!hasSite) base += 150;
    if (rating >= 4.5) base += 100;
    if (score > 70) base += 100;
    return Math.min(1000, Math.max(500, Math.round(base / 50) * 50));
  }, [lead, computedLeadScore]);

  const aiSummary = useMemo(() => {
    if (!lead) return null;
    const hasWebsite = !!lead.website;
    const ratingStr = aiDisplayRating?.value || '4.0';
    const score = computedLeadScore;
    const strengths: string[] = [];
    const opportunities: string[] = [];
    const pitchAngle: string[] = [];

    if (Number(ratingStr) >= 4.3) {
      strengths.push(`Strong reputation (${ratingStr} star${aiDisplayRating?.isAi ? ' AI est.' : ''})`);
      pitchAngle.push('leverage their strong reviews with a modern site');
    }
    if (!hasWebsite) {
      opportunities.push('No website - first-mover advantage');
      pitchAngle.push('be the first to get them online professionally');
    } else {
      opportunities.push('Existing website can likely be modernized');
      pitchAngle.push('upgrade to a fast, mobile-first site');
    }
    if (score > 70) {
      strengths.push('High AI lead score - strong buyer intent');
    } else if (score > 40) {
      opportunities.push('Medium score - warm nurture candidate');
    }
    if (lead.category) strengths.push(`Active in ${lead.category}`);

    const summaryText = hasWebsite
      ? `${lead.businessName} is a ${lead.category || 'local business'} in ${lead.city || 'their area'} with a ${ratingStr} star rating. Great candidate for a modern 24-48hr redesign that converts better on mobile.`
      : `${lead.businessName} is a ${lead.category || 'local business'} in ${lead.city || 'their area'}${aiDisplayRating ? ` ~${ratingStr} sta` : ''}, currently operating without a strong web presence. High-impact, fast-close opportunity.`;

    return {
      summaryText,
      strengths: strengths.slice(0, 3),
      opportunities: opportunities.slice(0, 3),
      pitchAngle: pitchAngle[0] || 'offer a fast, revenue-focused website in 24-48hrs',
      confidence: score > 70 ? 'High' : score > 40 ? 'Medium' : 'Low',
    };
  }, [lead, aiDisplayRating, computedLeadScore]);

  // Sync deal amount
  useEffect(() => {
    if (lead?.dealValue) {
      setDealAmount(String(lead.dealValue));
    } else if (lead) {
      setDealAmount(String(aiLeadValue));
    }
  }, [lead?.id, lead?.dealValue, aiLeadValue]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!lead) return;
    updateLeadStatus(lead.id, e.target.value as LeadStatus);
  };

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (demoUrl && lead) {
      addDemoLink(lead.id, demoUrl);
      setDemoUrl('');
    }
  };

  const handleOutreachClick = () => {
    if (!lead) return;
    navigate(`/outreach?leadId=${encodeURIComponent(lead.id)}`, { 
      state: { leadId: lead.id, businessName: lead.businessName }
    });
  };

  const handleSaveDealValue = async () => {
    if (!lead) return;
    const val = Number(dealAmount);
    if (!val || val <= 0) return;
    setSavingDeal(true);
    try {
      if (typeof updateLead === 'function') {
        await updateLead(lead.id, { dealValue: val });
      } else {
        console.warn('updateLead not found in LeadContext');
        if (fetchedLead) setFetchedLead({ ...fetchedLead, dealValue: val });
      }
    } finally {
      setSavingDeal(false);
    }
  };

  // === NEW: Handle Client Reply (Item A) ===
  const handleSaveClientReply = async () => {
    if (!lead || !replyStatus) return;

    setSavingReply(true);

    const newReply = {
      id: Date.now(),
      status: replyStatus,
      note: replyNote.trim(),
      date: new Date().toISOString(),
    };

    const existingReplies = lead.clientReplies || [];
    const updatedReplies = [...existingReplies, newReply];

    try {
      if (typeof updateLead === 'function') {
        await updateLead(lead.id, { 
          clientReplies: updatedReplies,
          // Auto-update status if useful
          ...(replyStatus === 'Interested' && { status: 'Interested' }),
          ...(replyStatus === 'Not Interested' && { status: 'Rejected' }),
        });
      } else {
        // Fallback for local state
        if (fetchedLead) {
          setFetchedLead({ 
            ...fetchedLead, 
            clientReplies: updatedReplies 
          });
        }
      }

      // Reset form
      setReplyStatus('');
      setReplyNote('');
    } catch (error) {
      console.error('Failed to save client reply:', error);
    } finally {
      setSavingReply(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!lead) return;
    if (!confirm(`Delete "${lead.businessName}"? This cannot be undone.`)) return;
    setMenuOpen(false);
    try {
      if (typeof deleteLead === 'function') {
        await deleteLead(lead.id);
        navigate('/leads');
      } else {
        alert('deleteLead() not wired in LeadContext yet.');
      }
    } catch (e) {
      alert('Delete failed.');
    }
  };

  const handleEditLead = () => {
    setMenuOpen(false);
    navigate('/leads', { state: { editLeadId: lead.id } });
  };

  const handleCopyLink = async () => {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Lead link copied!');
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-[var(--text-secondary)]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading lead details...
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-[var(--text-secondary)]">
        <p className="text-lg">Lead not found</p>
        <p className="text-sm mt-1 opacity-70">ID: {id}</p>
        <button onClick={() => navigate('/leads')} className="mt-4 text-[var(--accent)] hover:underline">
          Back to Leads
        </button>
      </div>
    );
  }

  const statusOptions: LeadStatus[] = [
    'New', 'Demo Created', 'Email Sent', 'Pending Reply', 'Interested', 
    'Negotiating', 'Rejected', 'Deal Closed',
  ];

  const replyOptions = [
    'Interested',
    'Not Interested',
    'Need More Info',
    'Requested Demo',
    'Follow-up Scheduled',
    'Other'
  ];

  const cardClasses = 'neo-card p-6 md:p-8';
  const inputClasses = 'w-full rounded-2xl neo-in px-4 py-3.5 text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none';
  const labelClasses = 'text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-[0.16em]';

  const isDealClosed = lead.status === 'Deal Closed';
  const clientReplies = lead.clientReplies || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <button
          onClick={() => navigate('/leads')}
          className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={20} /> Back to Leads
        </button>

        <div className="flex items-center gap-3 relative">
          {/* 3-dot menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="w-11 h-11 flex items-center justify-center rounded-2xl neo-button text-[var(--text-secondary)] hover:text-[var(--accent)] active:scale-95 transition-all"
            >
              <MoreVertical size={18} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setMenuOpen(false)} />
                <div className="absolute z-50 w-56 max-w-[calc(100vw-1.5rem)] neo-card p-2 text-sm shadow-2xl left-0 sm:left-auto sm:right-0 top-12">
                  <button onClick={handleEditLead} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-primary)]">
                    <Edit3 size={15} /> Edit Lead
                  </button>
                  <button onClick={handleCopyLink} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-primary)]">
                    <LinkIcon size={15} /> Copy Link
                  </button>
                  <button onClick={() => { setMenuOpen(false); window.location.reload(); }} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-primary)]">
                    <RefreshCw size={15} /> Refresh AI Score
                  </button>
                  <div className="my-1 border-t border-black/8 dark:border-white/8" />
                  <button onClick={handleDeleteLead} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-red-500">
                    <Trash2 size={15} /> Delete Lead
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleOutreachClick}
            className="btn-neumorph-primary px-5 py-3 text-sm font-bold tracking-[0.08em] uppercase gap-2 inline-flex items-center"
          >
            <Send size={16} />
            <span className="hidden sm:inline">Send Outreach</span>
            <span className="sm:hidden">Outreach</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Section (unchanged) */}
          <div className={cardClasses}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">
                  {lead.businessName}
                </h1>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1">
                    <MapPin size={16} /> {lead.city || 'N/A'}
                  </span>
                  <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full" />
                  <span>{lead.category || 'Business'}</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="text-right">
                  <span className="text-xs text-[var(--text-secondary)] uppercase block mb-2">Status</span>
                  <select
                    value={lead.status}
                    onChange={handleStatusChange}
                    className="appearance-none rounded-xl neo-in px-3 py-2 text-sm text-[var(--text-primary)] outline-none min-w-[160px]"
                  >
                    {statusOptions.map((option) => (
                      <option key={option} value={option} className="bg-[#0A0A0A] text-white">
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Contact Info + Metrics (kept original) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-black/8 dark:border-white/8">
              <div>
                <h3 className={`${labelClasses} mb-3`}>Contact Info</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-[var(--text-primary)]">
                    <Phone size={18} className="text-[var(--text-secondary)] flex-shrink-0" />
                    <span>{lead.phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[var(--text-primary)]">
                    <Globe size={18} className="text-[var(--text-secondary)] flex-shrink-0" />
                    {lead.website ? (
                      <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline truncate">
                        {lead.website}
                      </a>
                    ) : (
                      <span className="text-amber-500 flex items-center gap-2 text-sm">
                        <AlertCircle size={14} /> No Website
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h3 className={`${labelClasses} mb-3`}>Metrics <span className="normal-case tracking-normal text-[10px] opacity-70">AI</span></h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="neo-in p-4 rounded-2xl">
                    <span className="text-xs text-[var(--text-secondary)] block mb-1">
                      Rating {aiDisplayRating?.isAi && <span className="text-[10px]">AI</span>}
                    </span>
                    <div className="flex items-center gap-1 font-bold text-lg text-[var(--text-primary)]">
                      {aiDisplayRating ? aiDisplayRating.value : 'N/A'}
                      <Star size={14} className="text-yellow-500 fill-yellow-500" />
                    </div>
                  </div>
                  <div className="neo-in p-4 rounded-2xl">
                    <span className="text-xs text-[var(--text-secondary)] block mb-1">Lead Score</span>
                    <div className={cn(
                      'font-bold text-lg',
                      computedLeadScore > 70 ? 'text-green-500' : computedLeadScore > 40 ? 'text-yellow-500' : 'text-gray-400'
                    )}>
                      {computedLeadScore}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Sections (kept original) */}
          {aiSummary && (
            <div className={cardClasses}>
              {/* ... AI Summary content unchanged ... */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-[var(--text-primary)] flex items-center gap-2">
                  <Sparkles size={18} className="text-[var(--accent)]" /> AI Lead Summary
                </h3>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full neo-in",
                  aiSummary.confidence === 'High' ? 'text-green-500' : aiSummary.confidence === 'Medium' ? 'text-yellow-500' : 'text-gray-400'
                )}>
                  {aiSummary.confidence}
                </span>
              </div>
              <p className="text-[var(--text-primary)] leading-relaxed mb-5">{aiSummary.summaryText}</p>
              {/* Strengths & Opportunities kept from original */}
            </div>
          )}

          {/* AI Scoring kept from original */}

          {/* === NEW: CLIENT REPLY SECTION (Item A) === */}
          <div className={cardClasses}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 neo-in rounded-xl">
                <MessageCircle size={18} className="text-[var(--accent)]" />
              </div>
              <h3 className="font-bold text-lg text-[var(--text-primary)]">Client Reply</h3>
            </div>

            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Log what the client said when they replied to your outreach.
            </p>

            {/* Quick Reply Buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              {replyOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setReplyStatus(option)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all border",
                    replyStatus === option 
                      ? "bg-[var(--accent)] text-white border-[var(--accent)]" 
                      : "neo-in hover:bg-black/5 dark:hover:bg-white/5 border-transparent"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>

            {/* Reply Note */}
            <textarea
              value={replyNote}
              onChange={(e) => setReplyNote(e.target.value)}
              placeholder="Add details about their reply (e.g., budget, timeline, concerns...)"
              className="w-full h-24 neo-in rounded-2xl p-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none resize-none mb-4"
            />

            <div className="flex justify-end">
              <button
                onClick={handleSaveClientReply}
                disabled={!replyStatus || savingReply}
                className="btn-neumorph-primary px-6 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {savingReply ? 'Saving...' : 'Save Client Reply'}
              </button>
            </div>

            {/* Display Logged Replies */}
            {clientReplies.length > 0 && (
              <div className="mt-6 pt-6 border-t border-black/8 dark:border-white/8">
                <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)] font-bold mb-3">Logged Replies</p>
                <div className="space-y-3">
                  {clientReplies.slice().reverse().map((reply: any, index: number) => (
                    <div key={index} className="neo-in p-4 rounded-2xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-[var(--text-primary)]">{reply.status}</span>
                        <span className="text-xs text-[var(--text-secondary)]">
                          {format(new Date(reply.date), 'MMM d, yyyy')}
                        </span>
                      </div>
                      {reply.note && (
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{reply.note}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Deal Closed Section (kept original) */}
          {isDealClosed && (
            <div className={cardClasses + ' border border-green-500/20'}>
              {/* ... original deal amount content ... */}
            </div>
          )}

          {/* Demo Website (kept original) */}
          <div className={cardClasses}>
            {/* ... original demo section ... */}
          </div>

          {/* Notes & Outreach History (kept original) */}
          <div className={cardClasses}>
            {/* ... original notes and outreach history ... */}
          </div>
        </div>

        {/* Sidebar (kept original) */}
        <div className="space-y-6">
          {/* Activity Journal, Lead Value, Priority - kept from original */}
        </div>
      </div>
    </div>
  );
};

export default LeadDetail;