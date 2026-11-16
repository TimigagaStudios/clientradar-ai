import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLeads } from '../context/LeadContext';
import {
  Search,
  MapPin,
  Globe,
  Star,
  Plus,
  Check,
  AlertCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { SearchResult } from '../types';
import { cn } from '../utils/cn';
import { useToast } from '../components/ui/useToast';
import FinderMap, { type MapArea } from '../components/FinderMap';
import {
  type CandidateQualification,
  type CandidateScan,
  evaluateLeadCandidate,
  existingLeadFor,
  foundKey,
  requestCandidateWebsiteScan,
  saveFoundBusiness,
  scoreFound,
} from '../lib/saveFound';

type LastSearch = { category: string; city: string; bounds: MapArea | null };
type RouteFilter = 'all' | 'map-contact' | 'official-website';

const LeadFinder = () => {
  const { leads, refreshLeads } = useLeads();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [savedIds, setSavedIds] = useState<Record<string, string>>({});
  const [area, setArea] = useState<MapArea | null>(null);
  const [last, setLast] = useState<LastSearch | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const [routeFilter, setRouteFilter] = useState<RouteFilter>('all');
  const [hideKnown, setHideKnown] = useState(true);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [knownKeys, setKnownKeys] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ done: number; total: number; mode: 'scan' | 'save' } | null>(null);
  const [candidateScans, setCandidateScans] = useState<Record<string, CandidateScan>>({});

  const [searchParams, setSearchParams] = useState({
    category: '',
    city: '',
  });
  const [howMany, setHowMany] = useState(20);

  const runSearch = async (query: LastSearch, offset: number) => {
    if (!query.category.trim()) {
      showToast({ type: 'error', title: 'Business type needed', message: 'Type a category first, for example Dentist.' });
      return;
    }
    setIsSearching(true);
    try {
      const response = await fetch('/api/search-places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: query.category, city: query.city, bounds: query.bounds, limit: howMany, offset }),
      });
      const text = await response.text();
      let result: any = null;
      try { result = JSON.parse(text); } catch { /* not JSON */ }
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Search failed');
      }
      const found: SearchResult[] = result.data || [];
      const merged = offset > 0 ? [...results, ...found.filter((item) => !results.some((old) => foundKey(old) === foundKey(item)))] : found;
      setResults(merged);
      if (offset === 0) {
        setCandidateScans({});
        setShowIncomplete(false);
      }
      const known = new Set(offset > 0 ? knownKeys : []);
      found.forEach((item) => { if (existingLeadFor(leads, item)) known.add(foundKey(item)); });
      setKnownKeys(known);
      setLast(query);
      setHasMore(Boolean(result.hasMore));
      setSource(String(result.source || 'google'));
      setNote(String(result.note || ''));
      if (offset === 0 && result.area && !query.bounds) setArea(result.area);
      showToast({
        type: 'success',
        title: 'Search complete',
        message: `${offset > 0 ? `${found.length} more loaded (${merged.length} in total).` : `${found.length} business result(s) loaded.`}${known.size ? ` ${known.size} already in your leads.` : ''}`,
      });
    } catch (error) {
      console.error(error);
      showToast({
        type: 'error',
        title: 'Search failed',
        message: error instanceof Error ? error.message : 'Failed to fetch business results.',
      });
      if (offset === 0) { setResults([]); setHasMore(false); }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSearch({ category: searchParams.category, city: searchParams.city, bounds: null }, 0);
  };

  const searchArea = (bounds: MapArea) => { void runSearch({ category: searchParams.category, city: '', bounds }, 0); };

  const calculateScore = scoreFound;

  const stateOf = useCallback((result: SearchResult) => {
    const key = foundKey(result);
    if (key in savedIds) return { saved: true, leadId: savedIds[key] || undefined };
    const existing = existingLeadFor(leads, result);
    return existing ? { saved: true, leadId: existing.id } : { saved: false };
  }, [savedIds, leads]);

  const qualifyOf = useCallback((result: SearchResult): CandidateQualification => {
    return evaluateLeadCandidate(result, candidateScans[foundKey(result)]);
  }, [candidateScans]);

  const checkCandidateSite = async (result: SearchResult, notify = true): Promise<CandidateQualification> => {
    const key = foundKey(result);
    if (!result.website) return evaluateLeadCandidate(result);
    setCandidateScans((current) => ({ ...current, [key]: { status: 'loading' } }));
    const outcome = await requestCandidateWebsiteScan(result.website);
    setCandidateScans((current) => ({ ...current, [key]: outcome }));
    const evaluated = evaluateLeadCandidate(result, outcome);
    if (notify) {
      showToast({
        type: evaluated.canSave ? 'success' : 'error',
        title: evaluated.badge,
        message: evaluated.canSave
          ? `${result.businessName} now has both email (${evaluated.email}) and phone (${evaluated.phone}). Review and tap Save Lead.`
          : `${result.businessName} moved to Incomplete: ${evaluated.detail}`,
      });
    }
    return evaluated;
  };

  const saveQualifiedOne = async (result: SearchResult) => {
    const qual = qualifyOf(result);
    if (!qual.canSave || !qual.email || !qual.phone) {
      throw new Error('Both a business email address and a phone number are required before saving.');
    }
    const enriched: SearchResult = {
      ...result,
      email: qual.email,
      phone: qual.phone,
      instagram: qual.instagram || result.instagram || undefined,
    };
    const id = await saveFoundBusiness(enriched, {
      category: last?.category || searchParams.category,
      city: last?.city || searchParams.city,
      source: source || 'Lead Finder',
      websiteScanSummary: qual.summary || undefined,
      qualificationRoute: qual.route,
      emailSource: qual.emailSource,
      phoneSource: qual.phoneSource,
    });
    setSavedIds((prev) => ({ ...prev, [foundKey(result)]: id }));
  };

  const handleSaveLead = async (result: SearchResult) => {
    const qual = qualifyOf(result);
    if (qual.status === 'checking') return;
    if (qual.canCheckSite && !qual.canSave) {
      await checkCandidateSite(result, true);
      return;
    }
    if (!qual.canSave) {
      showToast({
        type: 'error',
        title: 'Incomplete contact details',
        message: 'Only businesses with both an email address and a phone number can be saved.',
      });
      return;
    }
    try {
      await saveQualifiedOne(result);
      await refreshLeads();
      showToast({
        type: 'success',
        title: 'Qualified lead saved',
        message: `${result.businessName} was added with ${qual.email} and ${qual.phone}.`,
      });
    } catch (error) {
      console.error(error);
      showToast({ type: 'error', title: 'Save failed', message: error instanceof Error ? error.message : 'Could not save this lead.' });
    }
  };

  const baseVisible = useMemo(
    () => results.filter((item) => !hideKnown || !knownKeys.has(foundKey(item))),
    [results, hideKnown, knownKeys],
  );

  const partitioned = useMemo(() => {
    const qualified: { item: SearchResult; qual: CandidateQualification }[] = [];
    const pendingCheck: { item: SearchResult; qual: CandidateQualification }[] = [];
    const incomplete: { item: SearchResult; qual: CandidateQualification }[] = [];
    let route1Count = 0;
    let route2Count = 0;

    for (const item of baseVisible) {
      const qual = qualifyOf(item);
      if (qual.status === 'qualified') {
        if (qual.route === 'map-contact') route1Count += 1;
        else if (qual.route === 'official-website') route2Count += 1;
        if (routeFilter === 'all' || qual.route === routeFilter) qualified.push({ item, qual });
      } else if (qual.status === 'needs_website_check' || qual.status === 'checking') {
        if (routeFilter === 'all' || routeFilter === 'official-website') pendingCheck.push({ item, qual });
      } else {
        if (routeFilter === 'all' || qual.route === routeFilter) incomplete.push({ item, qual });
      }
    }

    return {
      qualified,
      pendingCheck,
      incomplete,
      active: [...qualified, ...pendingCheck],
      route1Count,
      route2Count,
    };
  }, [baseVisible, qualifyOf, routeFilter]);

  const pendingToScan = useMemo(
    () => partitioned.pendingCheck.filter(({ item, qual }) => !stateOf(item).saved && qual.status === 'needs_website_check').map(({ item }) => item),
    [partitioned.pendingCheck, stateOf],
  );

  const unsavedQualified = useMemo(
    () => partitioned.qualified.filter(({ item, qual }) => !stateOf(item).saved && qual.canSave).map(({ item }) => item),
    [partitioned.qualified, stateOf],
  );

  const mapResults = useMemo(
    () => (showIncomplete ? [...partitioned.active, ...partitioned.incomplete] : partitioned.active).map(({ item }) => item),
    [partitioned.active, partitioned.incomplete, showIncomplete],
  );

  const checkAllOfficialWebsites = async () => {
    if (!pendingToScan.length || bulk) return;
    setBulk({ done: 0, total: pendingToScan.length, mode: 'scan' });
    let newlyQualified = 0;
    let movedIncomplete = 0;
    for (const item of pendingToScan) {
      const evaluated = await checkCandidateSite(item, false);
      if (evaluated.canSave) newlyQualified += 1;
      else movedIncomplete += 1;
      setBulk((current) => (current ? { ...current, done: current.done + 1 } : null));
    }
    setBulk(null);
    showToast({
      type: newlyQualified > 0 ? 'success' : 'error',
      title: 'Official website check complete',
      message: `Checked ${pendingToScan.length} official ${pendingToScan.length === 1 ? 'website' : 'websites'}: ${newlyQualified} qualified with email + phone, ${movedIncomplete} incomplete.`,
    });
  };

  const saveAllQualified = async () => {
    if (!unsavedQualified.length || bulk) return;
    let done = 0;
    let failed = 0;
    setBulk({ done: 0, total: unsavedQualified.length, mode: 'save' });
    for (const item of unsavedQualified) {
      try { await saveQualifiedOne(item); } catch { failed += 1; }
      done += 1;
      setBulk({ done, total: unsavedQualified.length, mode: 'save' });
    }
    await refreshLeads();
    setBulk(null);
    showToast({
      type: failed ? 'error' : 'success',
      title: failed ? 'Some leads were not saved' : 'Qualified leads saved',
      message: `${done - failed} contact-qualified ${done - failed === 1 ? 'lead' : 'leads'} saved${failed ? `, ${failed} failed` : ''}.`,
    });
  };

  const inputClasses =
    'w-full rounded-2xl neo-in text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none px-4 py-3.5';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h1 className="text-3xl font-black tracking-tight mb-2 text-[var(--text-primary)]">
          Lead Finder
        </h1>
        <p className="text-[var(--text-secondary)] font-medium">
          Discover contactable business leads anywhere via two strict routes: (1) Map listing provides both email and phone, or (2) Official business website provides the missing contact so both email and phone are confirmed.
        </p>
      </header>

      <section className="neo-card p-6 md:p-8">
        <form
          onSubmit={handleSearch}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-[0.18em] ml-1">
              Category
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
              <input
                type="text"
                placeholder="e.g. Dentist, Real estate"
                className={`${inputClasses} pl-11`}
                value={searchParams.category}
                onChange={(e) =>
                  setSearchParams({ ...searchParams, category: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-[0.18em] ml-1">
              City (any country)
            </label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
              <input
                type="text"
                placeholder="e.g. Los Angeles, London, Dubai"
                className={`${inputClasses} pl-11`}
                value={searchParams.city}
                onChange={(e) =>
                  setSearchParams({ ...searchParams, city: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="finder-how-many" className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-[0.18em] ml-1">
              How many
            </label>
            <select
              id="finder-how-many"
              className={inputClasses}
              value={howMany}
              onChange={(e) => setHowMany(Number(e.target.value))}
            >
              <option value={20}>20 at a time</option>
              <option value={50}>50 at a time</option>
              <option value={100}>100 at a time</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSearching}
            className="btn-neumorph-primary px-6 py-3.5 text-sm uppercase tracking-[0.16em] font-bold"
          >
            {isSearching ? 'Searching...' : 'Find Leads'}
          </button>
        </form>
      </section>

      <section className="neo-card p-4 md:p-6">
        <div className="mb-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">World map</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Type a category above, move and zoom the map to any city or region, then press Search this area. Only qualified businesses with both email and phone can be saved.
          </p>
        </div>
        <FinderMap
          results={mapResults}
          area={area}
          searching={isSearching}
          stateOf={stateOf}
          qualifyOf={qualifyOf}
          onSearchArea={searchArea}
          onSave={(result) => void handleSaveLead(result)}
          onCheckSite={(result) => void checkCandidateSite(result, true)}
          onOpenLead={(leadId) => navigate(`/leads/${leadId}`)}
        />
        <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
          Business search{' '}
          <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" className="underline">Powered by Geoapify</a>
          {' '}-{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">&copy; OpenStreetMap contributors</a>
        </p>
      </section>

      {results.length > 0 && (
        <section className="neo-card overflow-hidden" data-finder-results>
          <div className="px-6 py-5 border-b border-black/8 dark:border-white/8 transition-colors duration-300 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  Qualified & Reviewable Candidates ({partitioned.active.length} of {baseVisible.length})
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Leads require both an email address and a phone number before they can be saved.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" data-qualified-count>
                  Qualified: {partitioned.qualified.length} ({partitioned.route1Count} map, {partitioned.route2Count} website)
                </span>
                <span className="px-3 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25" data-pending-count>
                  Official sites to check: {partitioned.pendingCheck.length}
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-500/15 text-[var(--text-secondary)] border border-white/10" data-incomplete-count>
                  Incomplete: {partitioned.incomplete.length}
                </span>
              </div>
            </div>

            {note && <p className="text-xs text-[var(--text-secondary)]" data-finder-note>{note}</p>}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <select
                aria-label="Filter by qualification route"
                value={routeFilter}
                onChange={(e) => setRouteFilter(e.target.value as RouteFilter)}
                className="rounded-full neo-in px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] outline-none"
              >
                <option value="all">All contactable routes</option>
                <option value="map-contact">Route 1: Map contacts ({partitioned.route1Count})</option>
                <option value="official-website">Route 2: Official website ({partitioned.route2Count + partitioned.pendingCheck.length})</option>
              </select>

              <label className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
                <input type="checkbox" checked={hideKnown} onChange={(e) => setHideKnown(e.target.checked)} />
                Hide ones already in my leads ({knownKeys.size})
              </label>

              {pendingToScan.length > 0 && (
                <button
                  type="button"
                  onClick={() => void checkAllOfficialWebsites()}
                  disabled={Boolean(bulk)}
                  data-check-all-sites
                  className="neo-button px-4 py-2 rounded-full text-sm font-semibold text-blue-400 disabled:opacity-50"
                >
                  {bulk?.mode === 'scan'
                    ? `Checking ${bulk.done} of ${bulk.total} official sites...`
                    : `Check ${pendingToScan.length} official ${pendingToScan.length === 1 ? 'website' : 'websites'}`}
                </button>
              )}

              <button
                type="button"
                onClick={() => void saveAllQualified()}
                disabled={!unsavedQualified.length || Boolean(bulk)}
                data-save-all-qualified
                className="neo-button px-4 py-2 rounded-full text-sm font-semibold text-[var(--text-primary)] disabled:opacity-50"
              >
                {bulk?.mode === 'save'
                  ? `Saving ${bulk.done} of ${bulk.total}...`
                  : unsavedQualified.length
                    ? `Save all ${unsavedQualified.length} qualified ${unsavedQualified.length === 1 ? 'lead' : 'leads'}`
                    : partitioned.qualified.length
                      ? 'All qualified leads saved'
                      : 'No qualified leads ready yet'}
              </button>
            </div>
          </div>

          {partitioned.active.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left border-collapse" data-qualified-table>
                <thead>
                  <tr className="bg-black/[0.03] dark:bg-white/[0.02] border-b border-black/8 dark:border-white/8 transition-colors duration-300">
                    <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em]">Business & Contacts</th>
                    <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em]">Location</th>
                    <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em]">Qualification & Official Site</th>
                    <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em]">Quality</th>
                    <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em] text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-black/8 dark:divide-white/8">
                  {partitioned.active.map(({ item: result, qual }) => {
                    const { score, priority } = calculateScore(result);
                    const state = stateOf(result);
                    const isSaved = state.saved;
                    const websiteScan = candidateScans[foundKey(result)];

                    return (
                      <tr
                        key={foundKey(result)}
                        className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="p-4">
                          <p className="font-bold text-[var(--text-primary)]">
                            {result.businessName}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)] mt-1 break-all">
                            {qual.email
                              ? `Email: ${qual.email} (${qual.emailSource || 'map'})`
                              : 'Email: check official site'}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                            {qual.phone
                              ? `Phone: ${qual.phone} (${qual.phoneSource || 'map'})`
                              : 'Phone: check official site'}
                          </p>
                          {result.category && (
                            <p className="text-[11px] text-[var(--text-secondary)] mt-1">{result.category}</p>
                          )}
                        </td>

                        <td className="p-4 text-[var(--text-secondary)] text-sm">
                          {result.address}
                        </td>

                        <td className="p-4 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
                                qual.status === 'qualified'
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : 'bg-blue-500/15 text-blue-400',
                              )}
                            >
                              {qual.status === 'qualified' ? <ShieldCheck size={13} /> : <Globe size={13} />}
                              {qual.badge}
                            </span>
                            <span className="text-[11px] text-[var(--text-secondary)]">
                              {qual.route === 'map-contact' ? 'Route 1' : 'Route 2'}
                            </span>
                          </div>

                          {result.website && (
                            <div className="flex flex-wrap items-center gap-2">
                              <a
                                href={/^https?:\/\//i.test(result.website) ? result.website : `https://${result.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
                              >
                                <Globe size={12} /> Visit official site
                              </a>
                              {result.outdatedWebsite && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-orange-400">
                                  <AlertCircle size={12} /> {result.websiteNote || 'Needs mobile/HTTPS upgrade'}
                                </span>
                              )}
                            </div>
                          )}

                          {websiteScan?.status === 'loading' && (
                            <p className="text-xs text-[var(--text-secondary)]">Reading public pages on the official domain...</p>
                          )}
                          {websiteScan?.status === 'done' && (
                            <div className="max-w-xs rounded-xl border border-white/10 bg-black/10 p-2.5 text-xs text-[var(--text-secondary)]" data-website-scan>
                              <p className="font-semibold text-[var(--text-primary)]">Official website checked ({websiteScan.data.pagesRead.length} page{websiteScan.data.pagesRead.length === 1 ? '' : 's'})</p>
                              <p className="mt-1 flex items-center gap-1.5">
                                Brand colour:{' '}
                                {websiteScan.data.accent ? (
                                  <>
                                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: websiteScan.data.accent }} />
                                    {websiteScan.data.accent}
                                  </>
                                ) : (
                                  'not clear'
                                )}
                              </p>
                              {websiteScan.data.fonts.length > 0 && <p>Fonts: {websiteScan.data.fonts.join(', ')}</p>}
                              {websiteScan.data.darkDesign !== null && <p>Look: {websiteScan.data.darkDesign ? 'dark' : 'light'} design</p>}
                            </div>
                          )}
                        </td>

                        <td className="p-4">
                          {result.rating > 0 ? (
                            <div className="flex items-center gap-1 mb-2">
                              <Star size={14} className="text-yellow-500 fill-yellow-500" />
                              <span className="text-[var(--text-primary)]">{result.rating}</span>
                              <span className="text-[var(--text-secondary)] text-xs">
                                ({result.reviewCount})
                              </span>
                            </div>
                          ) : (
                            <p className="mb-2 text-xs text-[var(--text-secondary)]">No rating available</p>
                          )}

                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'text-[10px] font-bold px-2 py-1 rounded-full border',
                                priority === 'High'
                                  ? 'text-red-400 border-red-400/30'
                                  : priority === 'Medium'
                                    ? 'text-yellow-400 border-yellow-400/30'
                                    : 'text-gray-400 border-gray-400/30',
                              )}
                            >
                              {priority} Priority
                            </span>
                            <span className="text-[10px] text-[var(--text-secondary)]">
                              Score: {score}
                            </span>
                          </div>
                        </td>

                        <td className="p-4 text-right">
                          {state.leadId ? (
                            <Link
                              to={`/leads/${state.leadId}`}
                              className="px-4 py-2 rounded-full text-sm font-semibold inline-flex items-center gap-2 bg-green-500/10 text-green-500 hover:underline"
                            >
                              <Check size={14} /> Open lead
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleSaveLead(result)}
                              disabled={isSaved || Boolean(bulk) || qual.status === 'checking'}
                              className={cn(
                                'px-4 py-2 rounded-full text-sm font-semibold transition-all inline-flex items-center gap-2',
                                isSaved
                                  ? 'bg-green-500/10 text-green-500 cursor-default'
                                  : qual.canSave
                                    ? 'neo-button text-[var(--text-primary)] hover:text-[var(--accent)]'
                                    : 'neo-button text-blue-400 hover:text-blue-300',
                              )}
                            >
                              {isSaved ? (
                                <><Check size={14} /> Saved</>
                              ) : qual.status === 'checking' ? (
                                'Checking site...'
                              ) : qual.canSave ? (
                                <><Plus size={14} /> Save Lead</>
                              ) : (
                                <><Globe size={14} /> Check official site</>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-sm text-[var(--text-secondary)]">
              No qualified or website-reviewable businesses match the current view.
              {partitioned.incomplete.length > 0 && ` ${partitioned.incomplete.length} incomplete ${partitioned.incomplete.length === 1 ? 'result is' : 'results are'} tucked into the Incomplete section below because email or phone is missing.`}
            </div>
          )}

          {partitioned.incomplete.length > 0 && (
            <div className="border-t border-black/8 dark:border-white/8" data-incomplete-section>
              <button
                type="button"
                onClick={() => setShowIncomplete((prev) => !prev)}
                data-toggle-incomplete
                className="w-full px-6 py-4 flex items-center justify-between gap-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
              >
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    Incomplete results ({partitioned.incomplete.length}) - missing email or phone, kept out of Save
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Strict qualification rule: businesses missing either email or phone are not saveable here.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)] shrink-0">
                  {showIncomplete ? <><ChevronUp size={15} /> Hide</> : <><ChevronDown size={15} /> Show</>}
                </span>
              </button>

              {showIncomplete && (
                <div className="overflow-x-auto border-t border-black/8 dark:border-white/8 bg-black/[0.015] dark:bg-white/[0.01]">
                  <table className="w-full min-w-[860px] text-left border-collapse" data-incomplete-table>
                    <thead>
                      <tr className="border-b border-black/8 dark:border-white/8">
                        <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em]">Business</th>
                        <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em]">Location</th>
                        <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em]">Why Incomplete</th>
                        <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em] text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/8 dark:divide-white/8">
                      {partitioned.incomplete.map(({ item: result, qual }) => {
                        const state = stateOf(result);
                        return (
                          <tr key={foundKey(result)} className="opacity-85">
                            <td className="p-4">
                              <p className="font-semibold text-[var(--text-primary)]">{result.businessName}</p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">
                                {qual.email ? `Email: ${qual.email} (${qual.emailSource || 'map'})` : 'Email: missing'}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                {qual.phone ? `Phone: ${qual.phone} (${qual.phoneSource || 'map'})` : 'Phone: missing'}
                              </p>
                            </td>
                            <td className="p-4 text-sm text-[var(--text-secondary)]">{result.address}</td>
                            <td className="p-4 space-y-1">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300">
                                <XCircle size={13} /> {qual.badge}
                              </span>
                              <p className="text-xs text-[var(--text-secondary)] max-w-md">{qual.detail}</p>
                              {result.website && (
                                <a
                                  href={/^https?:\/\//i.test(result.website) ? result.website : `https://${result.website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
                                >
                                  <Globe size={12} /> Open link
                                </a>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              {state.leadId ? (
                                <Link
                                  to={`/leads/${state.leadId}`}
                                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 bg-green-500/10 text-green-500 hover:underline"
                                >
                                  <Check size={13} /> Open lead
                                </Link>
                              ) : qual.canCheckSite ? (
                                <button
                                  type="button"
                                  onClick={() => void checkCandidateSite(result, true)}
                                  disabled={Boolean(bulk)}
                                  className="neo-button px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 text-[var(--text-primary)] disabled:opacity-50"
                                >
                                  <RefreshCw size={12} /> Retry check
                                </button>
                              ) : (
                                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                                  Incomplete - not saveable
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {hasMore && last && (
            <div className="px-6 py-5 border-t border-black/8 dark:border-white/8 text-center">
              <button
                type="button"
                onClick={() => void runSearch(last, results.length)}
                disabled={isSearching}
                className="neo-button px-5 py-2.5 rounded-full text-sm font-semibold text-[var(--text-primary)]"
              >
                {isSearching ? 'Loading...' : `Load ${howMany} more`}
              </button>
            </div>
          )}
        </section>
      )}

      {results.length === 0 && !isSearching && (
        <div className="neo-card p-10 text-center">
          <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">
            Start a contact-qualified lead search
          </h3>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto leading-8">
            Search by category and city, or use the world map. ClientRadar qualifies leads strictly when both an email address and a phone number are confirmed, either directly from the map listing or from the business&apos;s own official website.
          </p>
        </div>
      )}
    </div>
  );
};

export default LeadFinder;
