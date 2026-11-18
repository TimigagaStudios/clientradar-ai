import { useEffect, useMemo, useRef, useState } from 'react';
import { useLeads } from '../context/LeadContext';
import { ExternalLink, Search, CheckCircle2, Eye, MonitorPlay, Plus, Rocket, Clock3, Trash2, Share2, Mail, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../utils/cn';
import { buildDemoShare, deleteLeadDemo, describeDemoViews, demoStyleLevels, demoTemplates, mapDemoJob, styleLevelLabel, suggestStyleLevel } from '../lib/demo-factory';
import ListPager, { usePagedList } from '../components/ui/ListPager';
import QaCorrection from '../components/QaCorrection';

const parseDemoResponse = async (response: Response) => {
  const text = await response.text();
  try { return JSON.parse(text); } catch { throw new Error(`Demo API ${response.status}: ${text.slice(0, 180)}`); }
};

const Demos = () => {
  const { leads, updateDemoStatus, refreshLeads } = useLeads() as any;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [templateKey, setTemplateKey] = useState('auto');
  const [styleLevel, setStyleLevel] = useState('ultra');
  const [suggestedLevel, setSuggestedLevel] = useState('');

  const handleSelectLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    const lead = leads.find((item: any) => item.id === leadId);
    const suggestion = lead ? suggestStyleLevel(lead, leads.filter((item: any) => item.status === 'Deal Closed').length) : '';
    setSuggestedLevel(suggestion);
    // Introductory high-premium phase: default every business to Ultra Premium unless manually changed in the dropdown.
    setStyleLevel('ultra');
  };
  const [demoJobs, setDemoJobs] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [jobError, setJobError] = useState('');
  const [checkingJobId, setCheckingJobId] = useState('');
  const refreshRevision = useRef(0);

  const refreshJobs = async () => {
    const revision = ++refreshRevision.current;
    const all: any[] = [];
    for (let offset = 0; ; offset += 100) {
      const response = await fetch(`/api/demo-jobs?offset=${offset}`);
      const result = await parseDemoResponse(response);
      if (!response.ok || !Array.isArray(result.data)) throw new Error(result.error || 'Could not load demo reviews.');
      all.push(...result.data.map(mapDemoJob));
      if (result.data.length < 100) break;
    }
    if (revision === refreshRevision.current) setDemoJobs(all);
  };

  useEffect(() => {
    const refresh = () => void refreshJobs().catch((error) => setJobError(error instanceof Error ? error.message : 'Could not load demo reviews.'));
    refresh();
    const interval = window.setInterval(refresh, 30000);
    return () => window.clearInterval(interval);
  }, []);

  const handleCreateDemo = async () => {
    if (!selectedLeadId) return setJobError('Choose a lead first.');
    if (!window.confirm(`Approve creating this ${styleLevelLabel(styleLevel)} demo? No email will be sent.`)) return;
    setCreating(true);
    setJobError('');
    try {
      const response = await fetch('/api/demo-jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: selectedLeadId, templateKey, styleLevel, confirm: true }),
      });
      const result = await parseDemoResponse(response);
      if (!response.ok) throw new Error(result.error || 'Could not queue demo.');
      await updateDemoStatus(selectedLeadId, 'In Progress');
      const processResponse = await fetch('/api/demo-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: result.data.id, action: 'process', confirm: true }) });
      const processResult = await parseDemoResponse(processResponse);
      if (!processResponse.ok) throw new Error(processResult.error || 'Demo processing failed.');
      await refreshLeads();
      await refreshJobs();
      setSelectedLeadId('');
      setSuggestedLevel('');
    } catch (error) {
      setJobError(error instanceof Error ? error.message : 'Could not queue demo.');
    } finally {
      setCreating(false);
    }
  };

  const retryDemo = async (jobId: string) => {
    if (!window.confirm('Approve retrying this demo build? No email will be sent.')) return;
    setJobError('');
    try {
      const response = await fetch('/api/demo-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId, action: 'process', confirm: true }) });
      const result = await parseDemoResponse(response);
      if (!response.ok) throw new Error(result.error || 'Could not retry demo.');
      await refreshLeads();
      await refreshJobs();
    } catch (error) {
      setJobError(error instanceof Error ? error.message : 'Could not retry demo.');
    }
  };

  const recheckQa = async (jobId: string) => {
    setJobError('');
    setCheckingJobId(jobId);
    try {
      const response = await fetch('/api/demo-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'qa-recheck', jobId }) });
      const result = await parseDemoResponse(response);
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not check this demo.');
      await refreshJobs();
    } catch (error) {
      setJobError(error instanceof Error ? error.message : 'Could not check this demo.');
    } finally {
      setCheckingJobId('');
    }
  };

  const [shareNote, setShareNote] = useState<{ leadId: string; text: string } | null>(null);
  const handleShare = async (lead: any) => {
    const share = buildDemoShare(lead, lead.demoLink);
    try {
      if (navigator.share) {
        await navigator.share({ title: share.subject, text: share.text });
        setShareNote({ leadId: lead.id, text: 'Sharing opened. ClientRadar cannot confirm whether the message was sent.' });
        return;
      }
      await navigator.clipboard.writeText(share.text);
      setShareNote({ leadId: lead.id, text: 'Message copied. Paste it wherever you want to send it.' });
    } catch (error) {
      if ((error as any)?.name !== 'AbortError') setShareNote({ leadId: lead.id, text: `Could not share. Link: ${share.url}` });
    }
  };

  const [deletingLeadId, setDeletingLeadId] = useState('');
  const handleDeleteDemo = async (leadId: string, name: string) => {
    if (!leadId || deletingLeadId) return;
    if (!window.confirm(`Delete the demo for ${name}? Its preview link will stop working. The lead itself is kept.`)) return;
    setDeletingLeadId(leadId);
    setJobError('');
    try {
      await deleteLeadDemo(leadId);
      await refreshLeads();
      await refreshJobs();
      handleSelectLead(leadId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setJobError(error instanceof Error ? error.message : 'Could not delete demo.');
    } finally {
      setDeletingLeadId('');
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

  const queuePager = usePagedList(demoJobs, 'demo-queue', 10);
  const demoPager = usePagedList(filteredDemos, `${searchTerm}|${statusFilter}`, 10);
  const leadsWithoutDemo = useMemo(
    () => leads.filter((lead: any) => !lead.demoLink && lead.demoStatus !== 'In Progress'),
    [leads],
  );

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
              Leads Tracked
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
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3">
          <select value={selectedLeadId} onChange={(event) => handleSelectLead(event.target.value)} className="neo-in min-w-0 w-full rounded-2xl px-4 py-3 bg-transparent text-[var(--text-primary)] outline-none">
            <option value="">Choose a lead without a demo{leadsWithoutDemo.length > 250 ? ' (showing top 250)' : ''}</option>
            {leadsWithoutDemo.slice(0, 250).map((lead: any) => <option key={lead.id} value={lead.id}>{lead.businessName} - {lead.category || 'Business'}</option>)}
          </select>
          <select value={templateKey} onChange={(event) => setTemplateKey(event.target.value)} className="neo-in min-w-0 w-full rounded-2xl px-4 py-3 bg-transparent text-[var(--text-primary)] outline-none">
            {demoTemplates.map((template) => <option key={template.key} value={template.key}>{template.label}</option>)}
          </select>
          <select value={styleLevel} onChange={(event) => setStyleLevel(event.target.value)} aria-label="Demo style level" className="neo-in min-w-0 w-full rounded-2xl px-4 py-3 bg-transparent text-[var(--text-primary)] outline-none">
            {demoStyleLevels.map((level) => <option key={level.key} value={level.key}>{level.label} - {level.hint}</option>)}
          </select>
          <button type="button" onClick={() => void handleCreateDemo()} disabled={creating || !selectedLeadId} className="btn-neumorph-primary px-5 py-3 inline-flex items-center justify-center gap-2 disabled:opacity-50"><Plus size={16} />{creating ? 'Queueing...' : 'Generate Demo'}</button>
        </div>
        {suggestedLevel && <p className="text-xs text-[var(--text-secondary)]">Introductory high-premium default: <span className="font-bold text-[var(--text-primary)]">Ultra Premium</span> selected for all businesses right now (standard priority/value fit: <span className="font-semibold text-[var(--text-primary)]">{styleLevelLabel(suggestedLevel)}</span>). You can switch levels anytime.</p>}
        {jobError && <p className="text-sm text-red-500">{jobError}</p>}
      </section>

      {demoJobs.length > 0 && <section className="neo-card p-6 space-y-4">
        <div className="flex items-center gap-2"><Clock3 size={18} className="text-[var(--accent)]" /><h2 className="font-bold text-[var(--text-primary)]">Demo queue</h2></div>
        <div className="space-y-2">{queuePager.visible.map((job: any) => {
          const lead = leads.find((item: any) => item.id === job.leadId);
          return <div key={job.id} className="neo-in rounded-2xl px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0"><p className="font-semibold text-[var(--text-primary)] truncate">{lead?.businessName || 'Lead demo'}</p>
                <p className="text-xs text-[var(--text-secondary)]">{styleLevelLabel(job.styleLevel)} - {job.templateKey} - {job.status} - attempt {job.attempts}{job.generatedBy ? (job.generatedBy === 'ai' ? ' - AI written' : job.learned ? ' - built-in text, AI style' : ' - built-in text') : ''}</p>
                {job.status === 'ready' && <p className={cn('text-xs font-semibold', job.views ? 'text-green-500' : 'text-[var(--text-secondary)]')}>{describeDemoViews(job)}</p>}
                {job.aiError && <p className="text-xs text-yellow-500 truncate">AI not used: {job.aiError}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-3"><span className={cn('text-xs font-bold uppercase', job.status === 'failed' ? 'text-red-500' : job.status === 'ready' ? 'text-green-500' : 'text-[var(--accent)]')}>{job.status}</span>
                {job.status === 'ready' && <><button type="button" disabled={Boolean(checkingJobId)} onClick={() => void recheckQa(job.id)} className="text-xs font-bold text-[var(--accent)]">{checkingJobId === job.id ? 'Checking...' : `Recheck (${job.qaStatus})`}</button>{job.demoUrl && <a href={job.demoUrl} className="text-xs font-bold text-[var(--accent)]">Open</a>}</>}
                {job.status === 'failed' && <button type="button" onClick={() => void retryDemo(job.id)} className="text-xs font-bold text-[var(--accent)]">Retry</button>}
                <button type="button" onClick={() => void handleDeleteDemo(job.leadId, lead?.businessName || 'this lead')} disabled={deletingLeadId === job.leadId} aria-label="Delete demo" className="text-xs font-bold text-red-500 disabled:opacity-50">{deletingLeadId === job.leadId ? 'Deleting...' : 'Delete'}</button>
              </div>
            </div>
            {job.status === 'ready' && <details className="mt-2 text-xs text-[var(--text-primary)]"><summary className="cursor-pointer font-bold">Quality details: {job.qaStatus}</summary>
              <p className="mt-2 text-[var(--text-secondary)]">Last loaded result. Recheck after changes on another device. These limited checks do not verify facts, visuals, links, security or legal compliance.</p>
              {job.qaStatus === 'checked' && <>
                <p className="mt-2">{job.qa?.issues?.length || 0} possible issue(s).</p>
                <p className="mt-1 text-[var(--text-secondary)]">Website contact check: {job.qa?.agent?.websiteStatus === 'available' ? 'home page read' : job.qa?.agent?.websiteStatus === 'not_provided' ? 'no website supplied' : 'unavailable'}. This does not verify all business facts.</p>
                {Array.isArray(job.qa?.issues) && job.qa.issues.length > 0 && <ul className="mt-2 list-disc pl-5">{job.qa.issues.map((issue: any, index: number) => <QaCorrection key={`${issue.code}-${issue.path}-${index}`} jobId={job.id} fingerprint={job.qa.fingerprint || ''} issue={issue} content={job.qaContent} onSaved={refreshJobs} />)}</ul>}
                {Array.isArray(job.qa?.fixes) && job.qa.fixes.length > 0 && <ul className="mt-2 list-disc pl-5 text-[var(--text-secondary)]">{job.qa.fixes.map((fix: any, index: number) => <li key={`${fix.path}-${index}`}>{fix.description} ({fix.path})</li>)}</ul>}
              </>}
              {job.qaStatus === 'stale' && <p className="mt-2 text-yellow-500">The content, saved lead or review age may have changed, or this is an older check. Recheck before relying on it.</p>}
              {job.qaStatus === 'error' && <p className="mt-2 text-red-500">The check failed. Recheck this demo.</p>}
              {job.qaStatus === 'unchecked' && <p className="mt-2">This demo has not been checked.</p>}
            </details>}
          </div>;
        })}</div>
        <ListPager pager={queuePager} noun="demo jobs" compact />
      </section>}

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
          <div className="flex min-w-0 gap-2 overflow-x-auto no-scrollbar">
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
        {demoPager.visible.map((lead: any) => {
          const demoStatus = lead.demoStatus || 'Not Started';
          const readyJob = demoJobs.find((job: any) => {
            if (job.leadId !== lead.id || job.status !== 'ready' || !job.demoUrl || !lead.demoLink) return false;
            try {
              const linked = new URL(lead.demoLink, window.location.origin);
              const preview = new URL(job.demoUrl, window.location.origin);
              return linked.origin === window.location.origin && preview.origin === window.location.origin && linked.pathname === preview.pathname;
            } catch { return false; }
          });
          const share = lead.demoLink ? buildDemoShare(lead, lead.demoLink) : null;
          const qaNeedsReview = !readyJob || readyJob.qaStatus !== 'checked' || !Array.isArray(readyJob.qa?.issues) || readyJob.qa.issues.length > 0;
          const allowExternalShare = () => {
            const details = readyJob?.qaStatus === 'checked' && Array.isArray(readyJob.qa?.issues) ? (readyJob.qa.issues.map((issue: any) => issue.message).join('\n') || 'No issues in the last loaded check.') : `Last loaded quality status: ${readyJob?.qaStatus || 'unavailable'}`;
            // External apps cannot hold a server-side send lock. Cached reviews
            // may have changed in another session, so never silently pass one.
            const question = qaNeedsReview ? 'Override this quality review?' : 'Continue even though this loaded review may have changed?';
            return window.confirm(`Review the Quality check panel and recheck if needed. ${details}\n\nThese limited checks do not verify all facts, links or visual quality. The result may have changed since it was loaded.\n\n${question}`) && window.confirm('Open an external sharing app? You will control any actual send there.');
          };
          return (
            <div key={lead.id} className="neo-card min-w-0 p-4 sm:p-5" data-demo-card>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold text-[var(--text-primary)] break-words">
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

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--text-secondary)]">
                <span>{lead.demoLink ? 'Demo link available' : 'No demo link yet'}</span>
                <span>Score: {lead.leadScore ?? 'Unknown'}</span>
                <span>Deal value: {lead.dealValue == null ? 'Not set' : `$${Number(lead.dealValue).toLocaleString()}`}</span>
              </div>
              {lead.demoLink && <p className={cn('mt-3 text-xs font-semibold', qaNeedsReview ? 'text-yellow-500' : 'text-[var(--text-secondary)]')} role={qaNeedsReview ? 'status' : undefined}>
                {readyJob ? (readyJob.qaStatus === 'checked' && Array.isArray(readyJob.qa?.issues) ? (readyJob.qa.issues.length ? `Quality check: ${readyJob.qa.issues.length} possible issue(s)` : 'Quality check: checked') : (readyJob.qaStatus === 'checked' ? 'Quality review unavailable' : `Quality check: ${readyJob.qaStatus}`)) : 'Quality review unavailable for this link'}
              </p>}
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
              <details className="mt-4 border-t border-white/10 pt-3" data-demo-details>
                <summary className="cursor-pointer text-sm font-bold text-[var(--accent)]">More details and actions</summary>
                <div className="mt-4 space-y-4">
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

                {readyJob && (
                  <div className="neo-in p-4 rounded-2xl">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-bold mb-1">
                      Demo Opens
                    </p>
                    <p className={cn('text-sm font-bold', readyJob.views ? 'text-green-500' : 'text-[var(--text-secondary)]')}>
                      {describeDemoViews(readyJob)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">Opens can include your own visits and repeat visits.</p>
                  </div>
                )}

                {readyJob && (
                  <section className="neo-in p-4 rounded-2xl" aria-label="Demo quality review">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-[var(--text-primary)]">Quality check: {readyJob.qaStatus}</p>
                      <button type="button" onClick={() => void recheckQa(readyJob.id)} disabled={Boolean(checkingJobId)} className="btn-neumorph px-3 py-2 text-xs disabled:opacity-50">{checkingJobId === readyJob.id ? 'Checking...' : 'Recheck'}</button>
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">Status is from the last loaded data; recheck after changes on another device. Limited content screening only: it does not verify facts, visual layout, links, security or legal compliance.</p>
                    {readyJob.qaStatus === 'stale' && <p className="mt-2 text-xs text-yellow-500">The content, saved lead or review age may have changed, or this is an older check. Recheck before relying on it.</p>}
                    {readyJob.qaStatus === 'error' && <p className="mt-2 text-xs text-red-500">The check failed. Recheck this demo.</p>}
                    {readyJob.qaStatus === 'unchecked' && <p className="mt-2 text-xs text-[var(--text-secondary)]">This demo has not been checked.</p>}
                    {readyJob.qaStatus === 'checked' && <>
                      <p className="mt-2 text-xs text-[var(--text-secondary)]">{Array.isArray(readyJob.qa?.issues) ? `${readyJob.qa.issues.length} possible issue(s) found.` : 'Review unavailable.'}</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">Website contact check: {readyJob.qa?.agent?.websiteStatus === 'available' ? 'home page read' : readyJob.qa?.agent?.websiteStatus === 'not_provided' ? 'no website supplied' : 'unavailable'}. This does not verify all business facts.</p>
                      {Array.isArray(readyJob.qa?.issues) && readyJob.qa.issues.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-[var(--text-primary)]">{readyJob.qa.issues.map((issue: any, index: number) => <QaCorrection key={`${issue.code}-${issue.path}-${index}`} jobId={readyJob.id} fingerprint={readyJob.qa.fingerprint || ''} issue={issue} content={readyJob.qaContent} onSaved={refreshJobs} />)}</ul>}
                      {Array.isArray(readyJob.qa?.fixes) && readyJob.qa.fixes.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-[var(--text-secondary)]">{readyJob.qa.fixes.map((fix: any, index: number) => <li key={`${fix.path}-${index}`}>{fix.description} ({fix.path})</li>)}</ul>}
                    </>}
                  </section>
                )}
                {lead.demoLink && !readyJob && <p className="text-xs text-[var(--text-secondary)]">Quality review unavailable for this link. The job may be outside the loaded list.</p>}

                {share && (
                  <div className="neo-in p-4 rounded-2xl">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] font-bold mb-3">
                      Send To Client
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => { if (allowExternalShare()) void handleShare(lead); }} className="btn-neumorph px-3 py-2 text-sm gap-2 inline-flex items-center">
                        <Share2 size={14} /> Share
                      </button>
                      <a href={share.whatsapp} target="_blank" rel="noopener noreferrer" onClick={(event) => { if (!allowExternalShare()) { event.preventDefault(); return; } setShareNote({ leadId: lead.id, text: 'Sharing opened. ClientRadar cannot confirm whether the message was sent.' }); }} className="btn-neumorph px-3 py-2 text-sm gap-2 inline-flex items-center">
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                      {share.email && (
                        <a href={share.email} onClick={(event) => { if (!allowExternalShare()) { event.preventDefault(); return; } setShareNote({ leadId: lead.id, text: 'Sharing opened. ClientRadar cannot confirm whether the message was sent.' }); }} className="btn-neumorph px-3 py-2 text-sm gap-2 inline-flex items-center">
                          <Mail size={14} /> Email
                        </a>
                      )}
                    </div>
                    {shareNote?.leadId === lead.id && <p className="mt-2 text-xs text-[var(--text-secondary)] break-all">{shareNote?.text}</p>}
                  </div>
                )}

                  <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => void handleDeleteDemo(lead.id, lead.businessName)}
                    disabled={deletingLeadId === lead.id}
                    className="btn-neumorph px-4 py-2 text-sm gap-2 inline-flex items-center text-red-500 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    {deletingLeadId === lead.id ? 'Deleting...' : 'Delete Demo'}
                  </button>
                  </div>
                </div>
              </details>
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

      <ListPager pager={demoPager} noun="demos" />
    </div>
  );
};

export default Demos;
