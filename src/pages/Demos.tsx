import React, { useMemo, useState } from 'react';
import { useLeads } from '../context/LeadContext';
import {
  Globe,
  ExternalLink,
  Search,
  CheckCircle2,
  Clock,
  Eye,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../utils/cn';

const Demos = () => {
  const { leads } = useLeads();
  const [searchTerm, setSearchTerm] = useState('');

  const demoLeads = useMemo(() => {
    return leads.filter((lead) => lead.demoLink || lead.status === 'Demo Created');
  }, [leads]);

  const filteredDemos = useMemo(() => {
    return demoLeads.filter((lead) => {
      return (
        lead.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [demoLeads, searchTerm]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2 text-[var(--text-primary)]">
            Demo Tracking
          </h1>
          <p className="text-[var(--text-secondary)] font-medium">
            Monitor demos created for leads and track which opportunities are presentation-ready.
          </p>
        </div>

        <div className="neo-card px-5 py-4 inline-flex items-center gap-3">
          <Globe className="text-[var(--accent)]" size={20} />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-bold">
              Total Demos
            </p>
            <p className="text-xl font-black text-[var(--text-primary)]">
              {demoLeads.length}
            </p>
          </div>
        </div>
      </header>

      {/* Search */}
      <section className="neo-card p-6">
        <div className="relative max-w-md">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
            size={18}
          />
          <input
            type="text"
            placeholder="Search demos..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl neo-in text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </section>

      {/* Demo Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredDemos.map((lead) => (
          <div key={lead.id} className="neo-card p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  {lead.businessName}
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  {lead.city} • {lead.category}
                </p>
              </div>

              <div
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border',
                  lead.status === 'Demo Created'
                    ? 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                    : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                )}
              >
                {lead.status}
              </div>
            </div>

            <div className="space-y-4">
              <div className="neo-in p-4 rounded-2xl">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-bold mb-2">
                  Demo Link
                </p>

                {lead.demoLink ? (
                  <a
                    href={lead.demoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] hover:underline break-all text-sm"
                  >
                    {lead.demoLink}
                  </a>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">
                    No demo link saved yet
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="neo-in p-4 rounded-2xl">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-bold mb-1">
                    Lead Score
                  </p>
                  <p className="text-lg font-black text-[var(--text-primary)]">
                    {lead.leadScore}
                  </p>
                </div>

                <div className="neo-in p-4 rounded-2xl">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-bold mb-1">
                    Deal Value
                  </p>
                  <p className="text-lg font-black text-[var(--text-primary)]">
                    ${lead.dealValue?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  to={`/leads/${lead.id}`}
                  className="btn-neumorph px-4 py-2 text-sm gap-2"
                >
                  <Eye size={14} />
                  View Lead
                </Link>

                {lead.demoLink && (
                  <a
                    href={lead.demoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-neumorph-primary px-4 py-2 text-sm gap-2"
                  >
                    <ExternalLink size={14} />
                    Open Demo
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredDemos.length === 0 && (
          <div className="col-span-full neo-card p-10 text-center">
            <CheckCircle2
              className="mx-auto mb-4 text-[var(--text-secondary)] opacity-30"
              size={40}
            />
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">
              No demos tracked yet
            </h3>
            <p className="text-[var(--text-secondary)] max-w-xl mx-auto leading-8">
              Demo-ready leads and saved demo links will appear here as your outreach workflow expands.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Demos;
