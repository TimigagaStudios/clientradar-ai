import React, { useState } from 'react';
import { useLeads } from '../context/LeadContext';
import { 
  Search, 
  MapPin, 
  Globe, 
  Phone, 
  Star, 
  Plus, 
  Check, 
  AlertCircle,
  XCircle,
  ExternalLink
} from 'lucide-react';
import { SearchResult, LeadPriority } from '../types';
import { cn } from '../utils/cn';

const LeadFinder = () => {
  const { addLead, leads } = useLeads();
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const [searchParams, setSearchParams] = useState({
    category: '',
    city: '',
    radius: '10'
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    
    // Simulate API delay
    setTimeout(() => {
      const mockResults: SearchResult[] = Array.from({ length: 8 }).map((_, i) => {
        const hasWebsite = Math.random() > 0.4;
        const outdated = hasWebsite && Math.random() > 0.7;
        const rating = (3 + Math.random() * 2).toFixed(1);
        
        return {
          businessName: `${searchParams.category || 'Business'} ${i + 1}`,
          address: `${100 + i} Main St, ${searchParams.city || 'City'}`,
          phone: `(555) ${100 + i}-${2000 + i}`,
          website: hasWebsite ? `https://business${i}.com` : undefined,
          outdatedWebsite: outdated,
          rating: parseFloat(rating),
          reviewCount: Math.floor(Math.random() * 100),
          mapLink: 'https://maps.google.com'
        };
      });
      setResults(mockResults);
      setIsSearching(false);
    }, 1500);
  };

  const calculateScore = (result: SearchResult): { score: number, priority: LeadPriority } => {
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
      priority: priority,
      status: 'New',
      notes: `Found via Lead Finder. Address: ${result.address}`
    });

    setSavedIds(prev => new Set(prev).add(`${index}`));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Lead Finder</h1>
        <p className="text-[var(--color-text-secondary)]">Find local businesses and generate leads automatically.</p>
      </div>

      {/* Search Form */}
      <div className="bg-[var(--color-card)] p-6 rounded-xl border border-[var(--color-border)]">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">Category</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={18} />
              <input 
                type="text" 
                placeholder="e.g. Dentist, Plumber" 
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent)]"
                value={searchParams.category}
                onChange={e => setSearchParams({...searchParams, category: e.target.value})}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">City</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={18} />
              <input 
                type="text" 
                placeholder="e.g. Austin, TX" 
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent)]"
                value={searchParams.city}
                onChange={e => setSearchParams({...searchParams, city: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">Radius (km)</label>
            <select 
              className="w-full px-4 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
              value={searchParams.radius}
              onChange={e => setSearchParams({...searchParams, radius: e.target.value})}
            >
              <option value="5">5 km</option>
              <option value="10">10 km</option>
              <option value="25">25 km</option>
              <option value="50">50 km</option>
            </select>
          </div>

          <button 
            type="submit" 
            disabled={isSearching}
            className="w-full py-2.5 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors shadow-lg shadow-blue-500/20"
          >
            {isSearching ? 'Searching...' : 'Find Leads'}
          </button>
        </form>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--color-background)] border-b border-[var(--color-border)]">
                  <th className="p-4 font-medium text-[var(--color-text-secondary)]">Business</th>
                  <th className="p-4 font-medium text-[var(--color-text-secondary)]">Location</th>
                  <th className="p-4 font-medium text-[var(--color-text-secondary)]">Website Status</th>
                  <th className="p-4 font-medium text-[var(--color-text-secondary)]">Rating</th>
                  <th className="p-4 font-medium text-[var(--color-text-secondary)] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {results.map((result, idx) => {
                  const { score, priority } = calculateScore(result);
                  const isSaved = savedIds.has(`${idx}`);

                  return (
                    <tr key={idx} className="hover:bg-[var(--color-background)] transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-[var(--color-text-primary)]">{result.businessName}</p>
                        <p className="text-sm text-[var(--color-text-secondary)]">{result.phone}</p>
                      </td>
                      <td className="p-4 text-[var(--color-text-secondary)]">
                        {result.address}
                      </td>
                      <td className="p-4">
                        {!result.website ? (
                           <span className="flex items-center gap-1.5 text-red-400 bg-red-400/10 px-2 py-1 rounded text-xs w-fit">
                             <XCircle size={14} /> No Website
                           </span>
                        ) : result.outdatedWebsite ? (
                           <span className="flex items-center gap-1.5 text-orange-400 bg-orange-400/10 px-2 py-1 rounded text-xs w-fit">
                             <AlertCircle size={14} /> Outdated
                           </span>
                        ) : (
                           <a href={result.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-400 bg-blue-400/10 px-2 py-1 rounded text-xs w-fit hover:underline">
                             <Globe size={14} /> Visit Site
                           </a>
                        )}
                      </td>
                      <td className="p-4">
                         <div className="flex items-center gap-1">
                           <Star size={14} className="text-yellow-500 fill-yellow-500" />
                           <span className="text-[var(--color-text-primary)]">{result.rating}</span>
                           <span className="text-[var(--color-text-secondary)] text-xs">({result.reviewCount})</span>
                         </div>
                         <div className="mt-1 flex items-center gap-2">
                           <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", 
                             priority === 'High' ? 'text-red-400 border-red-400/30' : 
                             priority === 'Medium' ? 'text-yellow-400 border-yellow-400/30' : 
                             'text-gray-400 border-gray-400/30'
                           )}>
                             {priority} Priority
                           </span>
                           <span className="text-[10px] text-[var(--color-text-secondary)]">Score: {score}</span>
                         </div>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleSaveLead(result, idx)}
                          disabled={isSaved}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ml-auto",
                            isSaved 
                              ? "bg-green-500/10 text-green-500 cursor-default" 
                              : "bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
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
        </div>
      )}
    </div>
  );
};

export default LeadFinder;
