import React, { useMemo, useState } from 'react';
import { useLeads } from '../context/LeadContext';
import { DollarSign, Handshake, TrendingUp, Search, CheckCircle2, XCircle, Clock3, Edit2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../utils/cn';

const Deals = () => {
  const { leads, updateLead } = useLeads() as any;
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStage, setActiveStage] = useState('All');
  const [editingDeal, setEditingDeal] = useState<string | null>(null);
  const [tempDealValue, setTempDealValue] = useState('');

  const stages = ['All', 'Interested', 'Negotiating', 'Deal Closed', 'Rejected'];

  const dealLeads = useMemo(() => {
    return leads.filter((lead: any) =>
      ['Interested', 'Negotiating', 'Deal Closed', 'Rejected'].includes(lead.status)
    );
  }, [leads]);

  const filteredDeals = useMemo(() => {
    return dealLeads.filter((lead: any) => {
      const matchesSearch =
        lead.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.category || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStage = activeStage === 'All' || lead.status === activeStage;
      return matchesSearch && matchesStage;
    });
  }, [dealLeads, searchTerm, activeStage]);

  const totalPipelineValue = useMemo(() => {
    return dealLeads
      .filter((lead: any) => lead.status === 'Interested' || lead.status === 'Negotiating')
      .reduce((acc: number, lead: any) => acc + (Number(lead.dealValue) || 0), 0);
  }, [dealLeads]);

  const totalClosedValue = useMemo(() => {
    return dealLeads
      .filter((lead: any) => lead.status === 'Deal Closed')
      .reduce((acc: number, lead: any) => acc + (Number(lead.dealValue) || 0), 0);
  }, [dealLeads]);

  const interestedCount = dealLeads.filter((lead: any) => lead.status === 'Interested').length;
  const negotiatingCount = dealLeads.filter((lead: any) => lead.status === 'Negotiating').length;
  const closedCount = dealLeads.filter((lead: any) => lead.status === 'Deal Closed').length;

  const statusStyles: Record<string, string> = {
    Interested: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    Negotiating: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    'Deal Closed': 'bg-green-500/10 text-green-500 border-green-500/20',
    Rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  // === NEW: Inline Deal Value Editing (B) ===
  const handleSaveDealValue = async (leadId: string) => {
    const value = Number(tempDealValue);
    if (!value || value <= 0) return;

    await updateLead(leadId, { dealValue: value });
    setEditingDeal(null);
    setTempDealValue('');
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2 text-[var(--text-primary)]">
            Deals Pipeline
          </h1>
          <p className="text-[var(--text-secondary)] font-medium">
            Track commercial opportunities, negotiation progress, and closed revenue.
          </p>
        </div>
        <div className="rounded-2xl neo-card px-5 py-4 inline-flex items-center gap-3">
          <DollarSign className="text-[var(--accent)]" size={20} />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-bold">
              Closed Revenue
            </p>
            <p className="text-xl font-black text-[var(--text-primary)]">
              ${totalClosedValue.toLocaleString()}
            </p>
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="neo-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-2xl neo-in">
              <Handshake size={20} className="text-[var(--accent)]" />
            </div>
          </div>
          <p className="text-2xl font-black text-[var(--text-primary)]">{interestedCount}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-semibold mt-2">Interested</p>
        </div>

        <div className="neo-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-2xl neo-in">
              <Clock3 size={20} className="text-[var(--accent)]" />
            </div>
          </div>
          <p className="text-2xl font-black text-[var(--text-primary)]">{negotiatingCount}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-semibold mt-2">Negotiating</p>
        </div>

        <div className="neo-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-2xl neo-in">
              <TrendingUp size={20} className="text-[var(--accent)]" />
            </div>
          </div>
          <p className="text-2xl font-black text-[var(--text-primary)]">${totalPipelineValue.toLocaleString()}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-semibold mt-2">Pipeline Value</p>
        </div>

        <div className="neo-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-2xl neo-in">
              <CheckCircle2 size={20} className="text-[var(--accent)]" />
            </div>
          </div>
          <p className="text-2xl font-black text-[var(--text-primary)]">{closedCount}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-semibold mt-2">Closed Deals</p>
        </div>
      </div>

      {/* Controls */}
      <section className="neo-card p-6 md:p-8 space-y-5">
        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
            <input
              type="text"
              placeholder="Search deal leads..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl neo-in text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none bg-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {stages.map((stage) => (
              <button
                key={stage}
                onClick={() => setActiveStage(stage)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                  activeStage === stage
                    ? 'bg-[var(--accent)] text-white shadow-[0_10px_24px_rgba(255,122,0,0.22)]'
                    : 'neo-button text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                {stage}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Deal List with Enhanced Revenue Features (B) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredDeals.map((lead: any) => (
          <Link
            key={lead.id}
            to={`/leads/${lead.id}`}
            className="neo-card p-6 hover:-translate-y-1 transition-all duration-300 block"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-bold text-[var(--text-primary)] truncate">{lead.businessName}</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  {lead.city || 'N/A'} - {lead.category || 'Business'}
                </p>
              </div>
              <div className={cn('px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap', statusStyles[lead.status] || 'bg-gray-500/10 text-gray-400 border-gray-400/20')}>
                {lead.status}
              </div>
            </div>

            {/* Deal Value + Inline Editing */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-black/8 dark:border-white/8">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)] font-bold mb-1">Deal Value</p>
                {editingDeal === lead.id ? (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={tempDealValue}
                      onChange={(e) => setTempDealValue(e.target.value)}
                      className="w-full rounded-xl neo-in px-3 py-2 text-sm"
                      placeholder="5000"
                    />
                    <button
                      onClick={() => handleSaveDealValue(lead.id)}
                      className="px-3 py-2 bg-[var(--accent)] text-white rounded-xl text-xs font-medium"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-black text-[var(--text-primary)]">
                      ${Number(lead.dealValue || 0).toLocaleString()}
                    </p>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingDeal(lead.id);
                        setTempDealValue(lead.dealValue || '');
                      }}
                      className="text-[var(--text-secondary)] hover:text-[var(--accent)]"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)] font-bold mb-1">Priority</p>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{lead.priority || 'Medium'}</p>
              </div>
            </div>
          </Link>
        ))}

        {filteredDeals.length === 0 && (
          <div className="col-span-full neo-card p-10 text-center">
            <XCircle className="mx-auto mb-4 text-[var(--text-secondary)] opacity-30" size={40} />
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">No deals found</h3>
            <p className="text-[var(--text-secondary)] max-w-xl mx-auto leading-8">
              No commercial leads match the current search or pipeline filter.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Deals;