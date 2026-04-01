import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLeads } from '../context/LeadContext';
import {
  Search,
  MoreHorizontal,
  Globe,
  Star,
  MapPin,
  ExternalLink,
  Send,
  Plus,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lead, LeadPriority, LeadStatus } from '../types';
import { cn } from '../utils/cn';

const LeadCard: React.FC<{ lead: Lead }> = ({ lead }) => {
  const { updateLeadStatus, deleteLead } = useLeads();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const statusColors: Record<LeadStatus, string> = {
    New: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'Demo Created': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    'Email Sent': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    'Pending Reply': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    Interested: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    Negotiating: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    Rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
    'Deal Closed': 'bg-green-500/10 text-green-500 border-green-500/20',
  };

  const priorityColors: Record<LeadPriority, string> = {
    Low: 'text-gray-400',
    Medium: 'text-yellow-500',
    High: 'text-red-500',
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkInterested = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await updateLeadStatus(lead.id, 'Interested');
    setMenuOpen(false);
  };

  const handleMarkRejected = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await updateLeadStatus(lead.id, 'Rejected');
    setMenuOpen(false);
  };

  const handleDeleteLead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(`Delete ${lead.businessName}?`);
    if (!confirmed) return;

    await deleteLead(lead.id);
    setMenuOpen(false);
  };

  const handleSendOutreach = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate('/outreach');
  };

  return (
    <div className="group break-inside-avoid mb-6 relative">
      <Link to={`/leads/${lead.id}`} className="block">
        <div className="neo-card p-5 hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-lg text-[var(--text-primary)] leading-tight">
                {lead.businessName}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1 flex items-center gap-1">
                <MapPin size={12} />
                {lead.city} • {lead.category}
              </p>
            </div>

            <div className={cn('px-2 py-1 rounded-full text-xs font-medium border', statusColors[lead.status])}>
              {lead.status}
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <div className="flex items-center text-yellow-500">
                <Star size={14} fill="currentColor" />
                <span className="ml-1 text-[var(--text-primary)]">{lead.rating}</span>
              </div>
              <span>({lead.reviewCount} reviews)</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              {lead.website ? (
                lead.outdatedWebsite ? (
                  <span className="flex items-center gap-1.5 text-orange-400 bg-orange-400/10 px-2 py-1 rounded-full text-xs">
                    <AlertCircle size={12} /> Outdated Website
                  </span>
                ) : (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-blue-400 hover:underline bg-blue-400/10 px-2 py-1 rounded-full text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Globe size={12} /> Has Website
                  </a>
                )
              ) : (
                <span className="flex items-center gap-1.5 text-red-400 bg-red-400/10 px-2 py-1 rounded-full text-xs">
                  <XCircle size={12} /> No Website
                </span>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-black/8 dark:border-white/8">
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                  Lead Score
                </span>
                <span
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
                </span>
              </div>

              <div className="flex flex-col items-end">
                <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                  Priority
                </span>
                <span className={cn('font-medium text-sm flex items-center gap-1', priorityColors[lead.priority])}>
                  {lead.priority}
                </span>
              </div>
            </div>
          </div>

          {lead.demoLink && (
            <div className="mt-3 bg-purple-500/10 border border-purple-500/20 rounded-xl p-2.5 flex items-center gap-2 text-xs text-purple-400">
              <CheckCircle2 size={14} />
              <span className="truncate flex-1">Demo Ready</span>
              <ExternalLink size={12} />
            </div>
          )}
        </div>
      </Link>

      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity hidden lg:flex gap-2">
        <button
          className="p-2 neo-button text-[var(--text-secondary)] hover:text-[var(--accent)]"
          title="Send Outreach"
          onClick={handleSendOutreach}
        >
          <Send size={14} />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            className="p-2 neo-button text-[var(--text-secondary)] hover:text-[var(--accent)]"
            title="More Options"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
          >
            <MoreHorizontal size={14} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-52 neo-card p-2 z-50">
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
                onClick={handleDeleteLead}
                className="w-full text-left px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
              >
                Delete Lead
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Leads = () => {
  const { leads } = useLeads();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState<string>('All');

  useEffect(() => {
    setSearchTerm(searchParams.get('q') || '');
  }, [searchParams]);

  const filters = [
    'All',
    'No Website',
    'Outdated Website',
    'High Priority',
    'Demo Ready',
    'Pending Reply',
    'Closed Deals',
  ];

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch =
        lead.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.category.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      switch (activeFilter) {
        case 'No Website':
          return !lead.website;
        case 'Outdated Website':
          return lead.outdatedWebsite;
        case 'High Priority':
          return lead.priority === 'High';
        case 'Demo Ready':
          return !!lead.demoLink || lead.status === 'Demo Created';
        case 'Pending Reply':
          return lead.status === 'Pending Reply';
        case 'Closed Deals':
          return lead.status === 'Deal Closed';
        default:
          return true;
      }
    });
  }, [leads, searchTerm, activeFilter]);

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="sticky top-0 z-20 bg-[var(--bg)]/90 backdrop-blur-xl pb-4 pt-1 space-y-4">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
            size={18}
          />
          <input
            type="text"
            placeholder="Search businesses, cities, or categories..."
            className="w-full pl-12 pr-4 py-3 rounded-2xl neo-in text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                activeFilter === filter
                  ? 'bg-[var(--accent)] text-white shadow-[0_10px_24px_rgba(255,122,0,0.22)]'
                  : 'neo-button text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="masonry-grid flex-1 pb-10">
        {filteredLeads.map((lead) => (
          <div key={lead.id} className="masonry-item">
            <LeadCard lead={lead} />
          </div>
        ))}

        {filteredLeads.length === 0 && (
          <div className="col-span-full neo-card p-10 text-center">
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">
              No leads found
            </h3>
            <p className="text-[var(--text-secondary)] max-w-xl mx-auto leading-8">
              No leads match your current search or filter selection.
            </p>
            <button
              onClick={() => {
                setActiveFilter('All');
                setSearchTerm('');
              }}
              className="mt-4 text-[var(--accent)] hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leads;
