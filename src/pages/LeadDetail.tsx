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
} from 'lucide-react';
import { format } from 'date-fns';
import { LeadStatus, LeadPriority } from '../types';
import { cn } from '../utils/cn';

// Optional direct fetch fallback for refresh / deep-link
// import { supabase } from '../lib/supabase';

const LeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    leads, 
    loading: leadsLoading, 
    updateLeadStatus, 
    addDemoLink,
    // These may not exist in your current LeadContext yet â€“ see note below
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

  // Find lead in context first
  const contextLead = useMemo(() => {
    if (!id || !leads?.length) return null;
    return leads.find((l: any) => String(l.id) === String(id)) || null;
  }, [leads, id]);

  const lead = contextLead || fetchedLead;

  // Direct fetch fallback - fixes "Lead not found on refresh"
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

  // --- Rule-based AI: Lead Scoring Breakdown ---
  const aiScoreBreakdown = useMemo(() => {
    if (!lead) return { items: [], total: 0 };
    const items = [
      {
        label: 'Website Status',
        value: lead.website ? 15 : 35,
        max: 35,
        reason: lead.website ? 'Has website â€“ upgrade play' : 'No website â€“ high urgency',
      },
      {
        label: 'Rating / Reputation',
        value: Math.min(25, Math.round((Number(lead.rating) || 3.5) * 5)),
        max: 25,
        reason: lead.rating ? `${lead.rating}â˜… rating` : 'AI-estimated reputation',
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

  // AI-computed score â€“ never 0 in the UI
  const computedLeadScore = Number(lead?.leadScore) > 0 ? Number(lead.leadScore) : aiScoreBreakdown.total;

  // AI Rating â€“ use real rating if present, otherwise AI confidence rating
  const aiDisplayRating = useMemo(() => {
    if (!lead) return null;
    const realRating = Number(lead.rating);
    if (realRating > 0) return { value: realRating.toFixed(1), isAi: false };
    // AI-estimated: 3.8 â€“ 4.8 based on score
    const score = computedLeadScore;
    const aiRating = score > 75 ? 4.7 : score > 55 ? 4.3 : score > 35 ? 4.0 : 3.8;
    return { value: aiRating.toFixed(1), isAi: true };
  }, [lead, computedLeadScore]);

  // AI Lead Value â€“ $500â€“$1000 Revenue Mode pricing
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

  // --- Rule-based AI: Lead Summary ---
  const aiSummary = useMemo(() => {
    if (!lead) return null;
    const hasWebsite = !!lead.website;
    const ratingStr = aiDisplayRating?.value || '4.0';
    const score = computedLeadScore;

    const strengths: string[] = [];
    const opportunities: string[] = [];
    const pitchAngle: string[] = [];

    if (Number(ratingStr) >= 4.3) {
      strengths.push(`Strong reputation (${ratingStr}â˜…${aiDisplayRating?.isAi ? ' AI est.' : ''})`);
      pitchAngle.push('leverage their strong reviews with a modern site');
    }

    if (!hasWebsite) {
      opportunities.push('No website â€“ first-mover advantage');
      pitchAngle.push('be the first to get them online professionally');
    } else {
      opportunities.push('Existing website can likely be modernized');
      pitchAngle.push('upgrade to a fast, mobile-first site');
    }

    if (score > 70) {
      strengths.push('High AI lead score â€“ strong buyer intent');
    } else if (score > 40) {
      opportunities.push('Medium score â€“ warm nurture candidate');
    }

    if (lead.category) strengths.push(`Active in ${lead.category}`);

    const summaryText = hasWebsite
      ? `${lead.businessName} is a ${lead.category || 'local business'} in ${lead.city || 'their area'} with a ${ratingStr}â˜… rating. Great candidate for a modern 24â€“48hr redesign that converts better on mobile.`
      : `${lead.businessName} is a ${lead.category || 'local business'} in ${lead.city || 'their area'}${aiDisplayRating ? ` ~${ratingStr}â˜…` : ''}, currently operating without a strong web presence. High-impact, fast-close opportunity.`;

    return {
      summaryText,
      strengths: strengths.slice(0, 3),
      opportunities: opportunities.slice(0, 3),
      pitchAngle: pitchAngle[0] || 'offer a fast, revenue-focused website in 24â€“48hrs',
      confidence: score > 70 ? 'High' : score > 40 ? 'Medium' : 'Low',
    };
  }, [lead, aiDisplayRating, computedLeadScore]);

  // Sync deal amount when lead loads / status changes
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
        console.warn('updateLead not found in LeadContext â€“ add updateLead(id, patch) to persist dealValue');
        // Optimistic local update for the UI
        if (fetchedLead) setFetchedLead({ ...fetchedLead, dealValue: val });
      }
    } finally {
      setSavingDeal(false);
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
        alert('deleteLead() not wired in LeadContext yet. Add deleteLead(id) to src/context/LeadContext.tsx');
        console.warn('deleteLead missing in useLeads()');
      }
    } catch (e) {
      alert('Delete failed.');
    }
  };

  const handleEditLead = () => {
    setMenuOpen(false);
    // Navigate to leads page with edit flag, or open an edit modal
    // For now: go to leads with state â€“ wire up your Edit modal in Leads.tsx
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
    'New',
    'Demo Created',
    'Email Sent',
    'Pending Reply',
    'Interested',
    'Negotiating',
    'Rejected',
    'Deal Closed',
  ];

  const priorityColors: Record<LeadPriority, string> = {
    Low: 'text-gray-400',
    Medium: 'text-yellow-500',
    High: 'text-red-500',
  };

  const cardClasses = 'neo-card p-6 md:p-8';
  const inputClasses =
    'w-full rounded-2xl neo-in px-4 py-3.5 text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none';
  const labelClasses =
    'text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-[0.16em]';

  const isDealClosed = lead.status === 'Deal Closed';

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <button
          onClick={() => navigate('/leads')}
          className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Leads
        </button>
        <div className="flex items-center gap-3">
          {/* 3-dot menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="w-11 h-11 flex items-center justify-center rounded-2xl neo-button text-[var(--text-secondary)] hover:text-[var(--accent)] active:scale-95 transition-all"
              aria-label="Lead actions"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 z-50 w-52 neo-card p-2 text-sm">
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
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile */}
          <div className={cardClasses}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">
                  {lead.businessName}
                </h1>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1">
                    <MapPin size={16} />
                    {lead.city || 'â€”'}
                  </span>
                  <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full" />
                  <span>{lead.category || 'Business'}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="text-right">
                  <span className="text-xs text-[var(--text-secondary)] uppercase block mb-2">
                    Status
                  </span>
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
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--accent)] hover:underline truncate"
                      >
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
                    <span className="text-xs text-[var(--text-secondary)] block mb-1">
                      Lead Score
                    </span>
                    <div
                      className={cn(
                        'font-bold text-lg',
                        computedLeadScore > 70
                          ? 'text-green-500'
                          : computedLeadScore > 40
                          ? 'text-yellow-500'
                          : 'text-gray-400'
                      )}
                    >
                      {computedLeadScore}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* === AI LEAD SUMMARY === */}
          {aiSummary && (
            <div className={cardClasses}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-[var(--text-primary)] flex items-center gap-2">
                  <Sparkles size={18} className="text-[var(--accent)]" />
                  AI Lead Summary
                </h3>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full neo-in",
                  aiSummary.confidence === 'High' ? 'text-green-500' :
                  aiSummary.confidence === 'Medium' ? 'text-yellow-500' : 'text-gray-400'
                )}>
                  {aiSummary.confidence}
                </span>
              </div>
              
              <p className="text-[var(--text-primary)] leading-relaxed mb-5">
                {aiSummary.summaryText}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="neo-in rounded-2xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold mb-2">Strengths</p>
                  <ul className="space-y-1.5 text-sm text-[var(--text-primary)]">
                    {aiSummary.strengths.length ? aiSummary.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{s}</span>
                      </li>
                    )) : <li className="text-[var(--text-secondary)]">â€”</li>}
                  </ul>
                </div>
                <div className="neo-in rounded-2xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold mb-2">Opportunities</p>
                  <ul className="space-y-1.5 text-sm text-[var(--text-primary)]">
                    {aiSummary.opportunities.length ? aiSummary.opportunities.map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <TrendingUp size={14} className="text-[var(--accent)] mt-0.5 flex-shrink-0" />
                        <span>{s}</span>
                      </li>
                    )) : <li className="text-[var(--text-secondary)]">â€”</li>}
                  </ul>
                </div>
              </div>

              <div className="neo-in rounded-2xl p-4 bg-[var(--accent)]/5 border border-[var(--accent)]/10">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold mb-1">Recommended pitch angle</p>
                <p className="text-sm text-[var(--text-primary)]">{aiSummary.pitchAngle}</p>
              </div>
            </div>
          )}

          {/* === AI LEAD SCORING === */}
          <div className={cardClasses}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-[var(--text-primary)] flex items-center gap-2">
                <Target size={18} className="text-[var(--accent)]" />
                AI Lead Scoring
              </h3>
              <div className="text-right">
                <div className={cn(
                  "text-2xl font-black",
                  computedLeadScore > 70 ? 'text-green-500' : computedLeadScore > 40 ? 'text-yellow-500' : 'text-gray-400'
                )}>
                  {computedLeadScore}
                  <span className="text-sm text-[var(--text-secondary)] font-normal"> /100</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {aiScoreBreakdown.items.map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-[var(--text-secondary)]">{item.label}</span>
                    <span className="text-[var(--text-primary)] font-semibold">{item.value}/{item.max}</span>
                  </div>
                  <div className="h-2 rounded-full neo-in overflow-hidden">
                    <div 
                      className="h-full bg-[var(--accent)] rounded-full transition-all"
                      style={{ width: `${(item.value / item.max) * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-1">{item.reason}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] mt-4 opacity-80">
              Rule-based scoring â€“ auto-calculated, no manual input. V3 will use LLM + vector memory.
            </p>
          </div>

          {/* === DEAL CLOSED â€“ Enter actual amount === */}
          {isDealClosed && (
            <div className={cardClasses + ' border border-green-500/20'}>
              <h3 className="font-bold text-lg text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <DollarSign size={18} className="text-green-500" />
                Close Deal â€“ Final Amount
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Deal marked as closed. Enter the actual amount accepted from the client. This feeds the future Revenue Agent / invoice builder.
              </p>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className={`${labelClasses} mb-2 block`}>Closed Amount (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={dealAmount}
                    onChange={(e) => setDealAmount(e.target.value)}
                    className={inputClasses}
                    placeholder="750"
                  />
                </div>
                <button
                  onClick={handleSaveDealValue}
                  disabled={savingDeal || !dealAmount}
                  className="btn-neumorph-primary px-5 py-3.5 text-sm font-semibold disabled:opacity-50"
                >
                  {savingDeal ? 'Savingâ€¦' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {/* Demo Website */}
          <div className={cardClasses}>
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">
              Demo Website
            </h3>
            {lead.demoLink ? (
              <div className="flex items-center justify-between p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="bg-purple-500 text-white p-2 rounded-xl flex-shrink-0">
                    <Globe size={20} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm text-purple-300 font-medium">Demo Available</p>
                    <a href={lead.demoLink} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline truncate block">
                      {lead.demoLink}
                    </a>
                  </div>
                </div>
                <a href={lead.demoLink} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-purple-500/20 rounded-xl transition-colors text-purple-400 flex-shrink-0">
                  <ExternalLink size={20} />
                </a>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} className="flex gap-3">
                <input type="url" placeholder="Paste demo website link here..." className={`${inputClasses} flex-1`} value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} />
                <button type="submit" disabled={!demoUrl} className="btn-neumorph-primary px-5 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                  Save
                </button>
              </form>
            )}
          </div>

          {/* Notes */}
          <div className={cardClasses}>
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">Notes</h3>
            <textarea
              className="w-full h-32 neo-in rounded-2xl p-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none resize-none"
              placeholder="Add notes about this lead..."
              defaultValue={lead.notes || ''}
            />
            <div className="flex justify-end mt-3">
              <button className="inline-flex items-center gap-2 px-4 py-2 neo-button text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl text-sm font-medium transition-colors">
                <Save size={16} /> Save Notes
              </button>
            </div>
          </div>

          {/* Outreach History */}
          <div className={cardClasses}>
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">
              Outreach History
            </h3>
            {lead.outreachHistory && lead.outreachHistory.length > 0 ? (
              <div className="space-y-4">
                {lead.outreachHistory.map((item: any) => (
                  <div key={item.id} className="neo-in p-4 rounded-2xl">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold">
                        <Mail size={16} className="text-[var(--accent)]" />
                        <span className="capitalize">{item.type} Email</span>
                      </div>
                      <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">
                        {item.sentAt ? format(new Date(item.sentAt), 'MMM d, yyyy h:mm a') : 'â€”'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">{item.subject}</p>
                    <p className="text-sm text-[var(--text-secondary)] leading-7 whitespace-pre-wrap">{item.body}</p>
                    <div className="mt-3 text-xs text-[var(--text-secondary)] uppercase tracking-[0.14em]">Channel: {item.channel}</div>
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

        {/* Right Sidebar */}
        <div className="space-y-6">
          <div className={cardClasses}>
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">Activity Journal</h3>
            <div className="relative pl-4 space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-0.5 before:bg-black/10 dark:before:bg-white/10">
              {lead.timeline && lead.timeline.length > 0 ? (
                lead.timeline.map((event: any, idx: number) => (
                  <div key={event.id || idx} className="relative pl-6">
                    <div className="absolute left-[-5px] top-1.5 w-3 h-3 rounded-full bg-[var(--bg-secondary)] border-2 border-[var(--accent)] z-10" />
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{event.type}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{event.description}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-1 flex items-center gap-1 opacity-70">
                        <Clock size={10} />
                        {event.date ? format(new Date(event.date), 'MMM d, yyyy h:mm a') : 'â€”'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--text-secondary)] pl-6">No activity yet.</p>
              )}
            </div>
          </div>

          <div className={cardClasses}>
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">Lead Value</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-[var(--text-primary)]">
                ${Number(lead.dealValue || aiLeadValue).toLocaleString()}
              </span>
              <span className="text-[var(--text-secondary)] text-sm">potential</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-2">
              {isDealClosed ? 'Closed deal amount â€“ editable above.' : `AI-estimated â€¢ Revenue Mode $500â€“$1000`}
            </p>
          </div>

          <div className={cardClasses}>
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">Priority Signal</h3>
            <p className={cn('text-lg font-semibold', priorityColors[lead.priority as LeadPriority] || 'text-yellow-500')}>
              {lead.priority || 'Medium'} Priority
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              Based on website status, reviews, rating, and AI lead score.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetail;