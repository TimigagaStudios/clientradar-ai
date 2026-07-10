import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { LeadStatus, LeadPriority } from '../types';
import { cn } from '../utils/cn';

const LeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { leads, loading, updateLeadStatus, addDemoLink } = useLeads();

const lead = useMemo(() => {
  return leads.find((l) => l.id === id);
}, [leads, id]);

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

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (demoUrl) {
      addDemoLink(lead.id, demoUrl);
      setDemoUrl('');
    }
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
          <button className="p-2.5 neo-button text-[var(--text-secondary)] hover:text-[var(--accent)]">
            <MoreVertical size={18} />
          </button>

          <button className="btn-neumorph-primary px-5 py-3 text-sm font-bold tracking-[0.08em] uppercase gap-2">
            <Send size={16} />
            Send Outreach
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
                    {lead.city}
                  </span>
                  <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full" />
                  <span>{lead.category}</span>
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
                    className="appearance-none rounded-xl neo-in px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
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
                    <Phone size={18} className="text-[var(--text-secondary)]" />
                    {lead.phone}
                  </div>

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

          {/* Demo */}
          <div className={cardClasses}>
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">
              Demo Website
            </h3>

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

          {/* Notes */}
          <div className={cardClasses}>
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">Notes</h3>
            <textarea
              className="w-full h-32 neo-in rounded-2xl p-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none resize-none"
              placeholder="Add notes about this lead..."
              defaultValue={lead.notes}
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
                {lead.outreachHistory.map((item) => (
                  <div
                    key={item.id}
                    className="neo-in p-4 rounded-2xl"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold">
                        <Mail size={16} className="text-[var(--accent)]" />
                        <span className="capitalize">{item.type} Email</span>
                      </div>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {format(new Date(item.sentAt), 'MMM d, yyyy h:mm a')}
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

        {/* Timeline */}
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
    </div>
  );
};

export default LeadDetail;