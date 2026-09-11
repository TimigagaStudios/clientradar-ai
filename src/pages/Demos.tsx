import React, { useEffect, useMemo, useState } from 'react';
import { useLeads } from '../context/LeadContext';
import { Globe, ExternalLink, Search, CheckCircle2, Eye, MonitorPlay, Plus, Rocket, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../utils/cn';
import { demoTemplates, mapDemoJob } from '../lib/demo-factory';

const Demos = () => {
  const { leads, updateDemoStatus } = useLeads() as any;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [templateKey, setTemplateKey] = useState('auto');
  const [demoJobs, setDemoJobs] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [jobError, setJobError] = useState('');

  const refreshJobs = async () => {
    const response = await fetch('/api/demo-jobs');
    const result = await response.json();
    if (response.ok) setDemoJobs((result.data || []).map(mapDemoJob));
  };

  useEffect(() => {
    void refreshJobs();
  }, []);

  const handleCreateDemo = async () => {
    if (!selectedLeadId) return setJobError('Choose a lead first.');
    setCreating(true);
    setJobError('');
    try {
      const response = await fetch('/api/demo-jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: selectedLeadId, templateKey }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not queue demo.');
      await updateDemoStatus(selectedLeadId, 'In Progress');
      await fetch('/api/demo-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: result.data.id, action: 'process' }) });
      await refreshJobs();
      setSelectedLeadId('');
    } catch (error) {
      setJobError(error instanceof Error ? error.message : 'Could not queue demo.');
    } finally {
      setCreating(false);
    }
  };

  const demoLeads = useMemo(() => {
    return leads.filter((lead: any) => lead.demoLink || lead.demoStatus);
  }, [leads]);

  const filteredDemos = useMemo(() => {
    return demoLeads.filter((lead: any) => {
      const matchesSearch =
        lead.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.category || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || (lead.demoStatus || 'Not Started') === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [demoLeads, searchTerm, statusFilter]);

  const statusStyles: Record<string, string> = {
    'Not Started': 'bg-gray-500/10 text-gray-400 border-gray-400/20',
    'In Progress': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    Ready: 'bg-green-500/10 text-green-500 border-green-500/20',
    Sent: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2 text-[var(--text-primary)]">
            Demo Tracking
          </h1>
          <p className="text-[var(--text-secondary)] font-medium">
            Track demo progress, readiness, and sent status across active opportunities.
          </p>
        </div>
        <div className="neo-card px-5 py-4 inline-flex items-center gap-3">
          <MonitorPlay className="text-[var(--accent)]" size={20} />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-bold">
              Demo Leads
            </p>
            <p className="text-xl font-black text-[var(--text-primary)]">
              {demoLeads.length}
            </p>
          </div>
        </div>
      </header>

      <section className="neo-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Rocket className="text-[var(--accent)]" size={20} />
          <div><h2 className="font-bold text-[var(--text-primary)]">Demo Factory</h2><p className="text-sm text-[var(--text-secondary)]">Queue a website demo for one lead. The worker will generate the preview later.</p></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
          <select value={selectedLeadId} onChange={(event) => setSelectedLeadId(event.target.value)} className="neo-in rounded-2xl px-4 py-3 bg-transparent text-[var(--text-primary)] outline-none">
            <option value="">Choose a lead without a demo</option>
            {leads.filter((lead: any) => !lead.demoLink && lead.demoStatus !== 'In Progress').map((lead: any) => <option key={lead.id} value={lead.id}>{lead.businessName} — {lead.category || 'Business'}</option>)}
          </select>
          <select value={templateKey} onChange={(event) => setTemplateKey(event.target.value)} className="neo-in rounded-2xl px-4 py-3 bg-transparent text-[var(--text-primary)] outline-none">
            {demoTemplates.map((template) => <option key={template.key} value={template.key}>{template.label}</option>)}
          </select>
          <button type="button" onClick={() => void handleCreateDemo()} disabled={creating || !selectedLeadId} className="btn-neumorph-primary px-5 py-3 inline-flex items-center justify-center gap-2 disabled:opacity-50"><Plus size={16} />{creating ? 'Queueing...' : 'Generate Demo'}</button>
        </div>
        {jobError && <p className="text-sm text-red-500">{jobError}</p>}
      </section>

      {demoJobs.length > 0 && <section className="neo-card p-6 space-y-4"><div className="flex items-center gap-2"><Clock3 size={18} className="text-[var(--accent)]" /><h2 className="font-bold text-[var(--text-primary)]">Demo queue</h2></div><div className="space-y-2">{demoJobs.slice(0, 8).map((job: any) => { const lead = leads.find((item: any) => item.id === job.leadId); return <div key={job.id} className="flex items-center justify-between gap-3 neo-in rounded-2xl px-4 py-3"><div className="min-w-0"><p className="font-semibold text-[var(--text-primary)] truncate">{lead?.businessName || 'Lead demo'}</p><p className="text-xs text-[var(--text-secondary)]">{job.templateKey} · {job.status}</p></div><span className={cn('text-xs font-bold uppercase', job.status === 'failed' ? 'text-red-500' : job.status === 'ready' ? 'text-green-500' : 'text-[var(--accent)]')}>{job.status}</span></div>; })}</div></section>}

      {/* Controls */}
      <section className="neo-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
            <input
              type="text"
              placeholder="Search demos..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl neo-in text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none bg-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {['All', 'Not Started', 'In Progress', 'Ready', 'Sent'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                  statusFilter === status
                    ? 'bg-[var(--accent)] text-white shadow-[0_10px_24px_rgba(255,122,0,0.22)]'
                    : 'neo-button text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredDemos.map((lead: any) => {
          const demoStatus = lead.demoStatus || 'Not Started';
          return (
            <div key={lead.id} className="neo-card p-6 hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-[var(--text-primary)] truncate">
                    {lead.businessName}
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    {lead.city || 'N/A'} - {lead.category || 'Business'}
                  </p>
                </div>
                <div className={cn('px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap', statusStyles[demoStatus] || 'bg-gray-500/10 text-gray-400 border-gray-400/20')}>
                  {demoStatus}
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
                    <p className="text-sm text-[var(--text-secondary)]">No demo link saved yet</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="neo-in p-4 rounded-2xl">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-bold mb-1">
                      Lead Score
                    </p>
                    <p className="text-lg font-black text-[var(--text-primary)]">
                      {lead.leadScore ?? 0}
                    </p>
                  </div>
                  <div className="neo-in p-4 rounded-2xl">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-bold mb-1">
                      Deal Value
                    </p>
                    <p className="text-lg font-black text-[var(--text-primary)]">
                      ${(Number(lead.dealValue) || 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Link to={`/leads/${lead.id}`} className="btn-neumorph px-4 py-2 text-sm gap-2 inline-flex items-center">
                    <Eye size={14} />
                    View Lead
                  </Link>
                  {lead.demoLink && (
                    <a
                      href={lead.demoLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-neumorph-primary px-4 py-2 text-sm gap-2 inline-flex items-center"
                    >
                      <ExternalLink size={14} />
                      Open Demo
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filteredDemos.length === 0 && (
          <div className="col-span-full neo-card p-10 text-center">
            <CheckCircle2 className="mx-auto mb-4 text-[var(--text-secondary)] opacity-30" size={40} />
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">No demos tracked yet</h3>
            <p className="text-[var(--text-secondary)] max-w-xl mx-auto leading-8">
              Demo-ready leads and saved demo links will appear here as your workflow grows.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Demos;
