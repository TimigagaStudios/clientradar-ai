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
} from 'lucide-react';
import { SearchResult } from '../types';
import { cn } from '../utils/cn';
import { useToast } from '../components/ui/useToast';
import FinderMap, { type MapArea } from '../components/FinderMap';
import { existingLeadFor, foundKey, saveFoundBusiness, scoreFound } from '../lib/saveFound';

type LastSearch = { category: string; city: string; bounds: MapArea | null };

const LeadFinder = () => {
  const { leads, refreshLeads } = useLeads();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [savedIds, setSavedIds] = useState<Record<string, string>>({}); // result key -> new lead id
  const [area, setArea] = useState<MapArea | null>(null);
  const [last, setLast] = useState<LastSearch | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const [onlyNoSite, setOnlyNoSite] = useState(false);
  const [hideKnown, setHideKnown] = useState(true);
  const [knownKeys, setKnownKeys] = useState<Set<string>>(new Set()); // found by this search but already in the leads
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);

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
      // Businesses that were already saved before this search are remembered, so they can be hidden.
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

  // Saved in this visit, or already in the lead list from before.
  const stateOf = useCallback((result: SearchResult) => {
    const key = foundKey(result);
    if (key in savedIds) return { saved: true, leadId: savedIds[key] || undefined };
    const existing = existingLeadFor(leads, result);
    return existing ? { saved: true, leadId: existing.id } : { saved: false };
  }, [savedIds, leads]);

  const saveOne = async (result: SearchResult) => {
    const id = await saveFoundBusiness(result, { category: last?.category || searchParams.category, city: last?.city || searchParams.city });
    setSavedIds((prev) => ({ ...prev, [foundKey(result)]: id }));
  };

  const handleSaveLead = async (result: SearchResult) => {
    try {
      await saveOne(result);
      await refreshLeads();
      showToast({
        type: 'success',
        title: 'Lead saved',
        message: `${result.businessName} was added to your lead database.`,
      });
    } catch (error) {
      console.error(error);
      showToast({
        type: 'error',
        title: 'Save failed',
        message: 'Could not save this lead.',
      });
    }
  };

  const shown = useMemo(() => results.filter((item) => (!onlyNoSite || !item.website) && (!hideKnown || !knownKeys.has(foundKey(item)))), [results, onlyNoSite, hideKnown, knownKeys]);
  const unsaved = shown.filter((item) => !stateOf(item).saved);

  const saveAll = async () => {
    const list = unsaved;
    if (!list.length || bulk) return;
    let done = 0;
    let failed = 0;
    setBulk({ done: 0, total: list.length });
    for (const item of list) {
      try { await saveOne(item); } catch { failed += 1; }
      done += 1;
      setBulk({ done, total: list.length });
    }
    await refreshLeads();
    setBulk(null);
    showToast({
      type: failed ? 'error' : 'success',
      title: failed ? 'Some leads were not saved' : 'Leads saved',
      message: `${done - failed} saved${failed ? `, ${failed} failed` : ''}.`,
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
          Search businesses in any country: type a city, or move the map and search what is on screen.
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
            Type a category above, move and zoom the map to any city or region, then press Search this area. Tap a pin to save it.
          </p>
        </div>
        <FinderMap
          results={shown}
          area={area}
          searching={isSearching}
          stateOf={stateOf}
          onSearchArea={searchArea}
          onSave={(result) => void handleSaveLead(result)}
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
          <div className="px-6 py-5 border-b border-black/8 dark:border-white/8 transition-colors duration-300">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              Search Results ({shown.length}{shown.length !== results.length ? ` of ${results.length}` : ''})
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Review and save high-value opportunities into your lead database.
            </p>
            {note && <p className="text-xs text-[var(--text-secondary)] mt-2" data-finder-note>{note}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
                <input type="checkbox" checked={onlyNoSite} onChange={(e) => setOnlyNoSite(e.target.checked)} />
                Only without a website ({results.filter((item) => !item.website).length})
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
                <input type="checkbox" checked={hideKnown} onChange={(e) => setHideKnown(e.target.checked)} />
                Hide ones already in my leads ({knownKeys.size})
              </label>
              <button
                type="button"
                onClick={() => void saveAll()}
                disabled={!unsaved.length || Boolean(bulk)}
                className="neo-button px-4 py-2 rounded-full text-sm font-semibold text-[var(--text-primary)] disabled:opacity-50"
              >
                {bulk ? `Saving ${bulk.done} of ${bulk.total}...` : unsaved.length ? `Save all ${unsaved.length} shown` : 'All shown are saved'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left border-collapse">
              <thead>
                <tr className="bg-black/[0.03] dark:bg-white/[0.02] border-b border-black/8 dark:border-white/8 transition-colors duration-300">
                  <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em]">Business</th>
                  <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em]">Location</th>
                  <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em]">Website Status</th>
                  <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em]">Quality</th>
                  <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em] text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-black/8 dark:divide-white/8">
                {shown.map((result) => {
                  const { score, priority } = calculateScore(result);
                  const state = stateOf(result);
                  const isSaved = state.saved;

                  return (
                    <tr
                      key={foundKey(result)}
                      className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="p-4">
                        <p className="font-bold text-[var(--text-primary)]">
                          {result.businessName}
                        </p>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">
                          {result.phone || 'Phone not available'}
                        </p>
                        {result.category && (
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{result.category}</p>
                        )}
                      </td>

                      <td className="p-4 text-[var(--text-secondary)]">
                        {result.address}
                      </td>

                      <td className="p-4">
                        {!result.website ? (
                          <span className="flex items-center gap-1.5 text-red-400 bg-red-400/10 px-2.5 py-1 rounded-full text-xs w-fit">
                            <XCircle size={14} /> {source === 'google' ? 'No Website' : 'No website listed'}
                          </span>
                        ) : result.outdatedWebsite ? (
                          <span className="flex items-center gap-1.5 text-orange-400 bg-orange-400/10 px-2.5 py-1 rounded-full text-xs w-fit">
                            <AlertCircle size={14} /> {result.websiteNote || 'Outdated'}
                          </span>
                        ) : (
                          <a
                            href={/^https?:\/\//i.test(result.website) ? result.website : `https://${result.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-blue-400 bg-blue-400/10 px-2.5 py-1 rounded-full text-xs w-fit hover:underline"
                          >
                            <Globe size={14} /> Visit Site
                          </a>
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
                                : 'text-gray-400 border-gray-400/30'
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
                            onClick={() => handleSaveLead(result)}
                            disabled={isSaved || Boolean(bulk)}
                            className={cn(
                              'px-4 py-2 rounded-full text-sm font-semibold transition-all inline-flex items-center gap-2',
                              isSaved
                                ? 'bg-green-500/10 text-green-500 cursor-default'
                                : 'neo-button text-[var(--text-primary)] hover:text-[var(--accent)]'
                            )}
                          >
                            {isSaved ? (
                              <>
                                <Check size={14} /> Saved
                              </>
                            ) : (
                              <>
                                <Plus size={14} /> Save Lead
                              </>
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
            Start a lead search
          </h3>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto leading-8">
            Search by category and city, or use the world map, to discover businesses anywhere, identify
            weak digital presence, and save qualified opportunities into your lead engine.
          </p>
        </div>
      )}
    </div>
  );
};

export default LeadFinder;
