import React, { useState, useMemo } from 'react';
import { useLeads } from '../context/LeadContext';
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  Globe, 
  Phone, 
  Star, 
  MapPin,
  ExternalLink,
  Send,
  Plus,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Lead, LeadPriority, LeadStatus } from '../types';
import { cn } from '../utils/cn';

const LeadCard: React.FC<{ lead: Lead }> = ({ lead }) => {
  const { updateLeadStatus } = useLeads();

  const statusColors: Record<LeadStatus, string> = {
    'New': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'Demo Created': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    'Email Sent': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    'Pending Reply': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    'Interested': 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    'Negotiating': 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    'Rejected': 'bg-red-500/10 text-red-500 border-red-500/20',
    'Deal Closed': 'bg-green-500/10 text-green-500 border-green-500/20',
  };

  const priorityColors: Record<LeadPriority, string> = {
    'Low': 'text-gray-400',
    'Medium': 'text-yellow-500',
    'High': 'text-red-500',
  };

  return (
    <div className="group break-inside-avoid mb-6 relative">
      <Link to={`/leads/${lead.id}`} className="block">
        <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] overflow-hidden hover:shadow-lg hover:border-[var(--color-accent)] transition-all duration-300 hover:-translate-y-1">
          <div className="p-5">
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-lg text-[var(--color-text-primary)] leading-tight">{lead.businessName}</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1 flex items-center gap-1">
                  <MapPin size={12} />
                  {lead.city} • {lead.category}
                </p>
              </div>
              <div className={cn("px-2 py-1 rounded-full text-xs font-medium border", statusColors[lead.status])}>
                {lead.status}
              </div>
            </div>

            {/* Stats / Info */}
            <div className="space-y-3 mb-4">
               <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                 <div className="flex items-center text-yellow-500">
                   <Star size={14} fill="currentColor" />
                   <span className="ml-1 text-[var(--color-text-primary)]">{lead.rating}</span>
                 </div>
                 <span>({lead.reviewCount} reviews)</span>
               </div>

               <div className="flex items-center gap-2 text-sm">
                  {lead.website ? (
                    lead.outdatedWebsite ? (
                      <span className="flex items-center gap-1.5 text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded text-xs">
                        <AlertCircle size={12} /> Outdated Website
                      </span>
                    ) : (
                      <a href={lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-400 hover:underline bg-blue-400/10 px-2 py-0.5 rounded text-xs" onClick={(e) => e.stopPropagation()}>
                        <Globe size={12} /> Has Website
                      </a>
                    )
                  ) : (
                    <span className="flex items-center gap-1.5 text-red-400 bg-red-400/10 px-2 py-0.5 rounded text-xs">
                      <XCircle size={12} /> No Website
                    </span>
                  )}
               </div>

               <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider">Lead Score</span>
                    <span className={cn("font-bold text-lg", lead.leadScore > 70 ? 'text-green-500' : lead.leadScore > 40 ? 'text-yellow-500' : 'text-gray-400')}>
                      {lead.leadScore}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider">Priority</span>
                    <span className={cn("font-medium text-sm flex items-center gap-1", priorityColors[lead.priority])}>
                      {lead.priority}
                    </span>
                  </div>
               </div>
            </div>

            {/* Demo Link Indicator */}
            {lead.demoLink && (
              <div className="mt-3 bg-purple-500/10 border border-purple-500/20 rounded-lg p-2 flex items-center gap-2 text-xs text-purple-400">
                <CheckCircle2 size={14} />
                <span className="truncate flex-1">Demo Ready</span>
                <ExternalLink size={12} />
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Hover Actions (Desktop) */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity hidden lg:flex gap-1">
         <button className="p-1.5 bg-[var(--color-card)] border border-[var(--color-border)] rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] shadow-lg" title="Send Outreach">
            <Send size={14} />
         </button>
         <button className="p-1.5 bg-[var(--color-card)] border border-[var(--color-border)] rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] shadow-lg" title="More Options">
            <MoreHorizontal size={14} />
         </button>
      </div>
    </div>
  );
};

const Leads = () => {
  const { leads } = useLeads();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('All');

  const filters = [
    'All',
    'No Website',
    'Outdated Website',
    'High Priority',
    'Demo Ready',
    'Pending Reply',
    'Closed Deals'
  ];

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch = lead.businessName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            lead.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            lead.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      switch (activeFilter) {
        case 'No Website': return !lead.website;
        case 'Outdated Website': return lead.outdatedWebsite;
        case 'High Priority': return lead.priority === 'High';
        case 'Demo Ready': return !!lead.demoLink || lead.status === 'Demo Created';
        case 'Pending Reply': return lead.status === 'Pending Reply';
        case 'Closed Deals': return lead.status === 'Deal Closed';
        default: return true;
      }
    });
  }, [leads, searchTerm, activeFilter]);

  return (
    <div className="h-full flex flex-col">
      {/* Search and Filter Header */}
      <div className="sticky top-0 z-30 bg-[var(--color-background)]/95 backdrop-blur-sm pb-4 pt-1 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={20} />
          <input 
            type="text" 
            placeholder="Search businesses, cities, or categories..." 
            className="w-full pl-10 pr-4 py-3 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {filters.map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border",
                activeFilter === filter
                  ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                  : "bg-[var(--color-card)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-text-secondary)]"
              )}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Masonry Grid */}
      <div className="masonry-grid flex-1 pb-10">
        {filteredLeads.map(lead => (
          <div key={lead.id} className="masonry-item">
            <LeadCard lead={lead} />
          </div>
        ))}
        {filteredLeads.length === 0 && (
          <div className="col-span-full py-20 text-center text-[var(--color-text-secondary)]">
            <p className="text-lg">No leads found matching your criteria.</p>
            <button 
              onClick={() => {setActiveFilter('All'); setSearchTerm('');}}
              className="mt-4 text-[var(--color-accent)] hover:underline"
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
