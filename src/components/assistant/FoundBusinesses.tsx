import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeads } from '../../context/LeadContext';
import type { SearchResult } from '../../types';
import { existingLeadFor, foundKey, saveFoundBusiness } from '../../lib/saveFound';

// The businesses a Lead Research task found, shown in the Master Agent chat with Save buttons.
// Nothing is saved until the owner presses a button.
export default function FoundBusinesses({ businesses, category, city }: { businesses: any[]; category?: string; city?: string }) {
  const { leads, refreshLeads } = useLeads();
  const navigate = useNavigate();
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [problem, setProblem] = useState('');

  const list: SearchResult[] = businesses.map((item) => ({
    ...item,
    website: item.website || undefined,
    phone: item.phone || undefined,
    email: item.email || undefined,
    category: item.category || undefined,
    city: item.city || undefined,
    country: item.country || undefined,
    outdatedWebsite: Boolean(item.outdatedWebsite),
    rating: Number(item.rating) || 0,
    reviewCount: Number(item.reviewCount) || 0,
  }));
  const leadIdOf = (item: SearchResult) => saved[foundKey(item)] ?? existingLeadFor(leads, item)?.id;
  const unsaved = list.filter((item) => leadIdOf(item) === undefined);
  const visible = showAll ? list : list.slice(0, 8);

  const save = async (items: SearchResult[]) => {
    if (busy) return;
    setProblem('');
    let failed = 0;
    for (let index = 0; index < items.length; index += 1) {
      setBusy(items.length > 1 ? `Saving ${index + 1} of ${items.length}...` : foundKey(items[index]));
      try {
        const id = await saveFoundBusiness(items[index], { category, city, source: 'the Lead Research Agent' });
        setSaved((prev) => ({ ...prev, [foundKey(items[index])]: id }));
      } catch { failed += 1; }
    }
    await refreshLeads();
    setBusy(null);
    if (failed) setProblem(`${failed} could not be saved. Try again.`);
  };

  return (
    <ul className="mt-2 space-y-1.5" data-found-list>
      {visible.map((business, index) => {
        const leadId = leadIdOf(business);
        return (
          <li key={index} className="text-xs text-[var(--text-primary)] break-words">
            <b>{business.businessName}</b>
            <span className="text-[var(--text-secondary)]">
              {' '}- {business.rating ? `${business.rating} stars (${business.reviewCount})` : 'no rating shown'} - {business.website ? 'has website' : 'no website listed'}{' '}
            </span>
            <a href={business.mapLink} target="_blank" rel="noreferrer" className="underline">Map</a>{' '}
            {leadId !== undefined ? (
              <button type="button" className="cr-chip" disabled={!leadId} onClick={() => leadId && navigate(`/leads/${leadId}`)}>{leadId ? 'Saved - open' : 'Saved'}</button>
            ) : (
              <button type="button" className="cr-chip" disabled={Boolean(busy)} onClick={() => void save([business])}>{busy === foundKey(business) ? 'Saving...' : 'Save'}</button>
            )}
          </li>
        );
      })}
      {list.length > 8 && (
        <li><button type="button" className="cr-chip" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show all ${list.length}`}</button></li>
      )}
      <li className="flex flex-wrap items-center gap-2">
        {unsaved.length > 0 ? (
          <button type="button" className="cr-chip primary" disabled={Boolean(busy)} onClick={() => void save(unsaved)}>
            {busy && busy.startsWith('Saving ') ? busy : `Save all ${unsaved.length} as leads`}
          </button>
        ) : (
          <span className="text-[11px] text-green-500">All of these are in your leads.</span>
        )}
      </li>
      {problem && <li className="text-[11px] text-red-400">{problem}</li>}
      <li className="text-[11px] text-[var(--text-secondary)]">Nothing is saved until you press Save.</li>
    </ul>
  );
}
