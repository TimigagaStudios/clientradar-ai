import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLeads } from '../context/LeadContext';
import {
  Search,
  MoreHorizontal,
  Star,
  MapPin,
  Send,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lead, LeadPriority, LeadStatus } from '../types';
import { cn } from '../utils/cn';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/useToast';
import EditLeadModal from '../components/EditLeadModal';

// --- AI score fallback (same logic as LeadDetail, no paid LLM) ---
const computeAiLeadScore = (lead: Lead): number => {
  const hasWebsite = !!lead.website;
  const rating = Number((lead as any).rating) || 0;
  let score = 0;
  score += hasWebsite ? 15 : 35; // Website Status / 35
  score += Math.min(25, Math.round((rating || 3.5) * 5)); // Rating / 25
  score += lead.category ? 15 : 5; // Business Activity / 20
  score += ((lead as any).phone ? 10 : 0) + (hasWebsite ? 5 : 0) + 5; // Contact / 20
  return Math.min(100, score);
};

const LeadCard: React.FC<{ lead: Lead }> = ({ lead }) => {
  const { updateLeadStatus, deleteLead } = useLeads();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
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
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const displayScore = lead.leadScore && lead.leadScore > 0 ? lead.leadScore : computeAiLeadScore(lead);
  const ratingVal = Number((lead as any).rating) || 0;
  const reviewCount = Number((lead as any).reviewCount) || 0;

  const handleMarkInterested = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await updateLeadStatus(lead.id, 'Interested');
    setMenuOpen(false);
    showToast({
      type: 'success',
      title: 'Lead updated',
      message: `${lead.businessName} marked as Interested.`,
    });
  };

  const handleMarkRejected = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
    setMenuOpen(false);
    showToast({
      type: 'success',
      title: 'Lead deleted',
      message: `${lead.businessName} removed from pipeline.`,
    });
  };

  const handleSendOutreach = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/outreach?leadId=${encodeURIComponent(lead.id)}`);
  };

  return (
    <div className="group break-inside-avoid mb-6 relative">
      <Link to={`/leads/${lead.id}`} className="block">
        <div className="neo-card p-5 hover:-translate-y-1 transition-all duration-300">
          {/* Header - with right padding reserved for action buttons */}
          <div className="mb-3 pr-20 sm:pr-24">
            <h3 className="font-bold text-lg text-[var(--text-primary)] leading-tight">
              {lead.businessName}
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1.5 flex items-center gap-1 flex-wrap">
              <MapPin size={12} className="flex-shrink-0" />
              <span>{lead.city} â€¢ {lead.category}</span>
            </p>
            {/* Status chip moved here - no longer collides with action buttons */}
            <div className="mt-2.5">
              <span className={cn('inline-block px-2.5 py-1 rounded-full text-xs font-medium border', statusColors[lead.status])}>
                {lead.status}
              </span>
            </div>
          </div>

          <div className="space-y-3 mb-1">
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <div className="flex items-center text-yellow-500">
                <Star size={14} fill="currentColor" />
                <span className="ml-1 text-[var(--text-primary)]">
                  {ratingVal > 0 ? ratingVal : 'N/A'}
                </span>
              </div>
              {reviewCount > 0 && <span>({reviewCount} reviews)</span>}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-black/8 dark:border-white/8">
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                  Lead Score
                </span>
                <span className={cn(
                  "font-bold text-lg",
                  displayScore > 70 ? "text-green-500" : displayScore > 40 ? "text-yellow-500" : "text-gray-400"
                )}>
                  {displayScore}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                  Priority
                </span>
                <span className={cn('font-medium text-sm', priorityColors[lead.priority])}>
                  {lead.priority}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>

      {/* Action buttons - top right, now with clear space */}
      <div className="absolute top-3 right-3 flex gap-1.5 z-10">
        <button
          className="p-2 rounded-xl neo-button text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
          onClick={handleSendOutreach}
          aria-label="Send outreach"
          title="Send outreach"
        >
          <Send size={14} />
        </button>
        <div className="relative" ref={menuRef}>
          <button
            className="p-2 rounded-xl neo-button text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            aria-label="Lead actions"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <>
              {/* mobile scrim */}
              <div className="fixed inset-0 z-40 sm:hidden" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
              <div 
                className="absolute right-0 top-10 w-52 max-w-[calc(100vw-2rem)] neo-card p-2 z-50 shadow-2xl"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditOpen(true);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-[var(--text-primary)] text-sm flex items-center gap-2"
                >
                  <Edit3 size={14} /> Edit Lead
                </button>
                <button
                  onClick={handleMarkInterested}
                  className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-[var(--text-primary)] text-sm"
                >
                  Mark Interested
                </button>
                <button
                  onClick={handleMarkRejected}
                  className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-[var(--text-primary)] text-sm"
                >
                  Mark Rejected
                </button>
                <div className="my-1 border-t border-black/8 dark:border-white/8" />
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmDeleteOpen(true);
                  }}
                  className="w-full text-left px-4 py-2.5 rounded-xl text-red-500 hover:bg-red-500/10 text-sm"
                >
                  Delete Lead
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <EditLeadModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        lead={lead}
      />
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete Lead"
        description={`Are you sure you want to permanently delete ${lead.businessName}?`}
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        onConfirm={handleDeleteLead}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
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
          return (lead as any).outdatedWebsite;
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
            placeholder="Search businesses..."
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
                  ? 'bg-[var(--accent)] text-white'
                  : 'neo-button text-[var(--text-secondary)]'
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
          <div className="text-center py-12 text-[var(--text-secondary)] col-span-full">
            No leads match your filter.
          </div>
        )}
      </div>
    </div>
  );
};

export default Leads;