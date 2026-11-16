import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, ChevronUp, ExternalLink, Globe, Loader2, Plus, RefreshCw } from 'lucide-react';
import { useLeads } from '../../context/LeadContext';
import { useToast } from '../ui/useToast';
import {
  type CandidateQualification,
  type CandidateScan,
  evaluateLeadCandidate,
  existingLeadFor,
  foundKey,
  requestCandidateWebsiteScan,
  saveFoundBusiness,
} from '../../lib/saveFound';
import type { SearchResult } from '../../types';

// Results from a Lead Research task in the Master Agent chat:
// enforces the same strict two-route qualification (email + phone required) as Lead Finder.

type Output = { category?: string; city?: string; source?: string; businesses?: SearchResult[] };

export default function FoundBusinesses({ output }: { output: Record<string, unknown> }) {
  const data = output as Output;
  const list = Array.isArray(data.businesses) ? data.businesses : [];
  const { leads, refreshLeads } = useLeads();
  const { showToast } = useToast();
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [scans, setScans] = useState<Record<string, CandidateScan>>({});
  const [showIncomplete, setShowIncomplete] = useState(false);

  if (!list.length) return null;

  const stateOf = (item: SearchResult) => {
    const key = foundKey(item);
    if (key in saved) return { done: true, id: saved[key] };
    const known = existingLeadFor(leads, item);
    return known ? { done: true, id: known.id } : { done: false, id: '' };
  };

  const qualifyOf = (item: SearchResult): CandidateQualification => evaluateLeadCandidate(item, scans[foundKey(item)]);

  const checkOneSite = async (item: SearchResult, notify = true) => {
    const key = foundKey(item);
    if (!item.website) return evaluateLeadCandidate(item);
    setScans((prev) => ({ ...prev, [key]: { status: 'loading' } }));
    const outcome = await requestCandidateWebsiteScan(item.website);
    setScans((prev) => ({ ...prev, [key]: outcome }));
    const evaluated = evaluateLeadCandidate(item, outcome);
    if (notify) {
      showToast({
        type: evaluated.canSave ? 'success' : 'error',
        title: evaluated.badge,
        message: evaluated.canSave
          ? `${item.businessName} qualified with ${evaluated.email} and ${evaluated.phone}.`
          : `${item.businessName}: ${evaluated.detail}`,
      });
    }
    return evaluated;
  };

  const saveOne = async (item: SearchResult) => {
    const qual = qualifyOf(item);
    if (!qual.canSave || !qual.email || !qual.phone) {
      throw new Error('Both email and phone are required before saving.');
    }
    const id = await saveFoundBusiness(
      {
        ...item,
        email: qual.email,
        phone: qual.phone,
        instagram: qual.instagram || item.instagram || undefined,
      },
      {
        category: data.category,
        city: data.city,
        source: `Master chat (${data.source || 'Lead Research'})`,
        websiteScanSummary: qual.summary || undefined,
        qualificationRoute: qual.route,
        emailSource: qual.emailSource,
        phoneSource: qual.phoneSource,
      },
    );
    setSaved((prev) => ({ ...prev, [foundKey(item)]: id }));
  };

  const handleSave = async (item: SearchResult) => {
    const key = foundKey(item);
    const qual = qualifyOf(item);
    if (qual.canCheckSite && !qual.canSave) {
      await checkOneSite(item, true);
      return;
    }
    if (!qual.canSave) return;
    setBusy(key);
    try {
      await saveOne(item);
      await refreshLeads();
      showToast({ type: 'success', title: 'Qualified lead saved', message: `${item.businessName} added to your leads.` });
    } catch (error) {
      showToast({ type: 'error', title: 'Save failed', message: error instanceof Error ? error.message : 'Could not save.' });
    } finally {
      setBusy(null);
    }
  };

  const activeRows = list.filter((item) => {
    const q = qualifyOf(item);
    return q.status === 'qualified' || q.status === 'needs_website_check' || q.status === 'checking';
  });
  const incompleteRows = list.filter((item) => qualifyOf(item).status === 'incomplete');
  const pendingSites = activeRows.filter((item) => !stateOf(item).done && qualifyOf(item).status === 'needs_website_check');
  const unsavedQualified = activeRows.filter((item) => !stateOf(item).done && qualifyOf(item).canSave);

  const checkAllSites = async () => {
    if (!pendingSites.length || busy) return;
    setBusy('scan');
    let ok = 0;
    for (const item of pendingSites) {
      const res = await checkOneSite(item, false);
      if (res.canSave) ok += 1;
    }
    setBusy(null);
    showToast({
      type: ok > 0 ? 'success' : 'error',
      title: 'Website check complete',
      message: `Checked ${pendingSites.length} official ${pendingSites.length === 1 ? 'site' : 'sites'}: ${ok} qualified with email + phone.`,
    });
  };

  const handleSaveAll = async () => {
    if (!unsavedQualified.length || busy) return;
    setBusy('all');
    let ok = 0;
    for (const item of unsavedQualified) {
      try { await saveOne(item); ok += 1; } catch { /* reported below */ }
    }
    await refreshLeads();
    setBusy(null);
    showToast({
      type: ok === unsavedQualified.length ? 'success' : 'error',
      title: ok ? `${ok} qualified ${ok === 1 ? 'lead' : 'leads'} saved` : 'Save failed',
      message: ok === unsavedQualified.length ? 'Added to your leads.' : `${unsavedQualified.length - ok} could not be saved.`,
    });
  };

  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-2.5 text-xs" data-found-businesses>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-[var(--text-secondary)]">
          {unsavedQualified.length} qualified ready | {incompleteRows.length} incomplete
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {pendingSites.length > 0 && (
            <button
              type="button"
              onClick={() => void checkAllSites()}
              disabled={Boolean(busy)}
              className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
              style={{ background: '#2563eb' }}
            >
              {busy === 'scan' ? 'Checking...' : `Check ${pendingSites.length} ${pendingSites.length === 1 ? 'site' : 'sites'}`}
            </button>
          )}
          {unsavedQualified.length > 0 && (
            <button
              type="button"
              onClick={() => void handleSaveAll()}
              disabled={Boolean(busy)}
              className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
              style={{ background: 'var(--accent, #ff7a00)' }}
            >
              {busy === 'all' ? 'Saving...' : `Save all ${unsavedQualified.length} qualified`}
            </button>
          )}
        </div>
      </div>

      {activeRows.length > 0 ? (
        <ul className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
          {activeRows.map((item) => {
            const key = foundKey(item);
            const state = stateOf(item);
            const qual = qualifyOf(item);
            return (
              <li key={key} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2.5 py-1.5">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--text-primary)]">{item.businessName}</p>
                  <p className="truncate text-[11px] text-[var(--text-secondary)]">
                    {qual.badge}
                    {qual.email ? ` - ${qual.email}` : ''}
                    {qual.phone ? ` - ${qual.phone}` : ''}
                  </p>
                  {item.website && (
                    <a
                      href={/^https?:\/\//i.test(item.website) ? item.website : `https://${item.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:underline"
                    >
                      <ExternalLink size={10} />Official site
                    </a>
                  )}
                </div>
                {state.done ? (
                  state.id ? (
                    <Link to={`/leads/${state.id}`} className="shrink-0 rounded-full bg-green-500/15 px-2.5 py-1 text-[11px] font-semibold text-green-400">
                      <Check size={11} className="mr-1 inline" />Open
                    </Link>
                  ) : (
                    <span className="shrink-0 text-[11px] font-semibold text-green-400">Saved</span>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSave(item)}
                    disabled={Boolean(busy) || qual.status === 'checking'}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:border-white/40 disabled:opacity-50"
                  >
                    {busy === key || qual.status === 'checking' ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : qual.canSave ? (
                      <><Plus size={11} />Save</>
                    ) : (
                      <><Globe size={11} />Check site</>
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-1.5 text-[11px] text-[var(--text-secondary)]">
          None of these candidates had both email and phone confirmed yet.
        </p>
      )}

      {incompleteRows.length > 0 && (
        <div className="mt-2 border-t border-white/10 pt-2">
          <button
            type="button"
            onClick={() => setShowIncomplete((prev) => !prev)}
            className="flex w-full items-center justify-between text-left text-[11px] font-semibold text-[var(--text-secondary)]"
          >
            <span>Incomplete ({incompleteRows.length}) - missing email or phone</span>
            <span className="inline-flex items-center gap-0.5">
              {showIncomplete ? <><ChevronUp size={12} />Hide</> : <><ChevronDown size={12} />Show</>}
            </span>
          </button>
          {showIncomplete && (
            <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto pr-1">
              {incompleteRows.map((item) => {
                const qual = qualifyOf(item);
                const state = stateOf(item);
                return (
                  <li key={foundKey(item)} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/15 px-2 py-1 opacity-80">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--text-primary)]">{item.businessName}</p>
                      <p className="truncate text-[10px] text-amber-300">{qual.badge}</p>
                    </div>
                    {state.done && state.id ? (
                      <Link to={`/leads/${state.id}`} className="shrink-0 text-[10px] font-semibold text-green-400 hover:underline">Open</Link>
                    ) : qual.canCheckSite ? (
                      <button
                        type="button"
                        onClick={() => void checkOneSite(item, true)}
                        disabled={Boolean(busy)}
                        className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--text-primary)]"
                      >
                        <RefreshCw size={10} />Retry
                      </button>
                    ) : (
                      <span className="shrink-0 text-[10px] text-[var(--text-secondary)]">Not saveable</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
