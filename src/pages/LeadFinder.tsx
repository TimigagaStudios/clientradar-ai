import React, { useState } from 'react';
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
import { SearchResult, LeadPriority } from '../types';
import { cn } from '../utils/cn';

const LeadFinder = () => {
  const { addLead } = useLeads();
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const [searchParams, setSearchParams] = useState({
    category: '',
    city: '',
    radius: '10',
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);

    try {
      const response = await fetch('/api/search-places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: searchParams.category,
          city: searchParams.city,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Search failed');
      }

      setResults(result.data || []);
    } catch (error) {
      console.error(error);
      alert('Failed to fetch business results. Check API setup.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const calculateScore = (result: SearchResult): { score: number; priority: LeadPriority } => {
    let score = 0;

    if (!result.website) score += 40;
    else if (result.outdatedWebsite) score += 25;

    if (result.rating > 4) score += 20;
    if (result.reviewCount > 20) score += 15;

    let priority: LeadPriority = 'Low';
    if (score >= 70) priority = 'High';
    else if (score >= 40) priority = 'Medium';

    return { score, priority };
  };

  const handleSaveLead = (result: SearchResult, index: number) => {
    const { score, priority } = calculateScore(result);

    addLead({
      businessName: result.businessName,
      category: searchParams.category || 'General',
      city: searchParams.city || 'Unknown',
      rating: result.rating,
      reviewCount: result.reviewCount,
      phone: result.phone,
      website: result.website,
      outdatedWebsite: result.outdatedWebsite,
      leadScore: score,
      priority,
      status: 'New',
      notes: `Found via Lead Finder. Address: ${result.address}`,
    });

    setSavedIds((prev) => new Set(prev).add(`${index}`));
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
          Search local business opportunities and convert them into qualified leads.
        </p>
      </header>

      {/* Search Form */}
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
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                size={18}
              />
              <input
                type="text"
                placeholder="e.g. Dentist, Plumber"
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
              City
            </label>
            <div className="relative">
              <MapPin
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                size={18}
              />
              <input
                type="text"
                placeholder="e.g. Austin, TX"
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
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-[0.18em] ml-1">
              Radius
            </label>
            <select
              className={inputClasses}
              value={searchParams.radius}
              onChange={(e) =>
                setSearchParams({ ...searchParams, radius: e.target.value })
              }
            >
              <option className="bg-[#0A0A0A] text-white" value="5">
                5 km
              </option>
              <option className="bg-[#0A0A0A] text-white" value="10">
                10 km
              </option>
              <option className="bg-[#0A0A0A] text-white" value="25">
                25 km
              </option>
              <option className="bg-[#0A0A0A] text-white" value="50">
                50 km
              </option>
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

      {/* Results */}
      {results.length > 0 && (
        <section className="neo-card overflow-hidden">
          <div className="px-6 py-5 border-b border-black/8 dark:border-white/8 transition-colors duration-300">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              Search Results
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Review and save high-value opportunities into your lead database.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left border-collapse">
              <thead>
                <tr className="bg-black/[0.03] dark:bg-white/[0.02] border-b border-black/8 dark:border-white/8 transition-colors duration-300">
                  <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em]">
                    Business
                  </th>
                  <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em]">
                    Location
                  </th>
                  <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em]">
                    Website Status
                  </th>
                  <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em]">
                    Quality
                  </th>
                  <th className="p-4 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-[0.18em] text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-black/8 dark:divide-white/8">
                {results.map((result, idx) => {
                  const { score, priority } = calculateScore(result);
                  const isSaved = savedIds.has(`${idx}`);

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="p-4">
                        <p className="font-bold text-[var(--text-primary)]">
                          {result.businessName}
                        </p>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">
                          {result.phone || 'Phone not available'}
                        </p>
                      </td>

                      <td className="p-4 text-[var(--text-secondary)]">
                        {result.address}
                      </td>

                      <td className="p-4">
                        {!result.website ? (
                          <span className="flex items-center gap-1.5 text-red-400 bg-red-400/10 px-2.5 py-1 rounded-full text-xs w-fit">
                            <XCircle size={14} /> No Website
                          </span>
                        ) : result.outdatedWebsite ? (
                          <span className="flex items-center gap-1.5 text-orange-400 bg-orange-400/10 px-2.5 py-1 rounded-full text-xs w-fit">
                            <AlertCircle size={14} /> Outdated
                          </span>
                        ) : (
                          <a
                            href={result.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-blue-400 bg-blue-400/10 px-2.5 py-1 rounded-full text-xs w-fit hover:underline"
                          >
                            <Globe size={14} /> Visit Site
                          </a>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-1 mb-2">
                          <Star size={14} className="text-yellow-500 fill-yellow-500" />
                          <span className="text-[var(--text-primary)]">{result.rating}</span>
                          <span className="text-[var(--text-secondary)] text-xs">
                            ({result.reviewCount})
                          </span>
                        </div>

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
                        <button
                          onClick={() => handleSaveLead(result, idx)}
                          disabled={isSaved}
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {results.length === 0 && !isSearching && (
        <div className="neo-card p-10 text-center">
          <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">
            Start a lead search
          </h3>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto leading-8">
            Search by category and city to discover local businesses, identify
            weak digital presence, and save qualified opportunities into your lead engine.
          </p>
        </div>
      )}
    </div>
  );
};

export default LeadFinder;
