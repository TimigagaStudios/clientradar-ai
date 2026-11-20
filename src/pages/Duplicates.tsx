import BackLink from '../components/ui/BackLink';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ListPager, { usePagedList } from '../components/ui/ListPager';

// Duplicate review: business names saved more than once, side by side.
// Nothing is removed until you choose. "Different branches" keeps both and stops asking;
// "Merge into this one" attempts to move listed records and remove the other.

type DupLead = { id: string; name: string; category: string; city: string; address: string; phone: string; email: string; website: string; status: string; demoStatus: string; score: number; createdAt: string };
type Group = { key: string; name: string; hint: 'same' | 'unclear'; reason: string; leads: DupLead[] };

const call = async (url: string, body?: Record<string, unknown>) => {
  const response = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  let result: any = null;
  try { result = JSON.parse(await response.text()); } catch { /* not JSON */ }
  if (!response.ok || !result?.success) throw new Error(result?.error || `server error ${response.status}`);
  return result.data;
};

export default function Duplicates() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState<{ group: Group; keep: DupLead } | null>(null);
  const [done, setDone] = useState('');

  const load = useCallback(async () => {
    try { setGroups(await call('/api/team?view=duplicates')); setError(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load'); setGroups([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const separate = async (group: Group) => {
    setBusy(group.key);
    try { await call('/api/team', { action: 'duplicate-separate', ids: group.leads.map((lead) => lead.id) }); setDone(`Kept apart: ${group.name}. I will not ask about these again.`); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save'); }
    setBusy('');
  };
  const merge = async () => {
    if (!confirm) return;
    const { group, keep } = confirm;
    setConfirm(null);
    setBusy(group.key);
    try {
      // One removal at a time, so a failure never leaves a half-finished group unreported.
      for (const other of group.leads.filter((lead) => lead.id !== keep.id)) await call('/api/team', { action: 'duplicate-merge', keepId: keep.id, removeId: other.id, confirm: true });
      setDone(`Merge completed for ${group.name}. Review the kept lead and its related records; not all fields or relationships are combined.`);
      await load();
    } catch (reason) { const message = reason instanceof Error ? reason.message : 'Could not merge'; await load(); setError(`${message} Earlier merge steps may have changed records. Review before retrying.`); }
    setBusy('');
  };

  const row = (label: string, value: string) => (value ? <p className="text-xs text-[var(--text-secondary)] break-words"><span className="font-semibold text-[var(--text-primary)]">{label}:</span> {value}</p> : null);
  const dupPager = usePagedList(groups || [], 'duplicates', 10);

  return (
    <div className="space-y-6 pb-24" data-duplicates>
      <header>
        <BackLink fallback="/leads" className="text-sm font-bold text-[#FF7A00]">Back</BackLink>
        <h1 className="mt-2 text-2xl sm:text-3xl font-black text-[var(--text-primary)]">Duplicate review</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Business names saved more than once. Nothing is removed until you choose.</p>
      </header>
      {error && <p className="neo-card p-4 text-sm text-red-400" role="alert">{error}</p>}
      {done && <p className="neo-card p-4 text-sm text-green-500" role="status">{done}</p>}
      {groups === null && <p className="text-sm text-[var(--text-secondary)]">Checking your leads...</p>}
      {groups !== null && groups.length === 0 && !error && <p className="neo-card p-5 text-sm text-[var(--text-secondary)]">No business name is saved more than once.</p>}
      {dupPager.visible.map((group) => (
        <section key={group.key} className="neo-card p-5 sm:p-6 space-y-4" data-dup-group>
          <div>
            <h2 className="text-lg font-black text-[var(--text-primary)] break-words">{group.name} <span className="text-sm font-semibold text-[var(--text-secondary)]">({group.leads.length} records)</span></h2>
            <p className={`mt-1 text-sm font-semibold ${group.hint === 'same' ? 'text-[#FF7A00]' : 'text-[var(--text-secondary)]'}`}>{group.reason}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.leads.map((lead) => (
              <div key={lead.id} className="neo-in rounded-2xl p-4 space-y-1.5 min-w-0">
                <Link to={`/leads/${lead.id}`} className="text-sm font-bold text-[var(--text-primary)] underline break-words">{lead.name}</Link>
                {row('City', lead.city)}
                {row('Address', lead.address)}
                {row('Phone', lead.phone)}
                {row('Email', lead.email)}
                {row('Website', lead.website)}
                {row('Status', lead.status)}
                {row('Demo', lead.demoStatus)}
                {row('Saved', lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '')}
                <button type="button" disabled={busy === group.key} onClick={() => setConfirm({ group, keep: lead })} className="mt-2 rounded-full px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50" style={{ background: '#FF7A00' }}>Merge into this one</button>
              </div>
            ))}
          </div>
          <button type="button" disabled={busy === group.key} onClick={() => void separate(group)} className="neo-button rounded-full px-4 py-2 text-sm font-bold text-[var(--text-primary)] disabled:opacity-50">{busy === group.key ? 'Working...' : 'These are different businesses: keep all'}</button>
        </section>
      ))}
      <ListPager pager={dupPager} noun="duplicate groups" />
      {confirm && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} role="dialog" aria-modal="true" aria-label="Confirm merge">
          <div className="neo-card w-full max-w-md p-5 space-y-3">
            <h3 className="text-lg font-black text-[var(--text-primary)]">Merge {confirm.group.leads.length} records into one?</h3>
            <p className="text-sm text-[var(--text-secondary)]">The record you chose{confirm.keep.city ? ` (${confirm.keep.city})` : ''} stays. Missing fields are filled where possible, and the app attempts to move demo jobs, lead notes, outreach logs and agent records before removing the others. Not all fields or relationships are combined. Linked invoice records block removal. Merging is not transactional; some steps may complete even if a later step fails. This cannot be undone.</p>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => void merge()} className="rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: '#FF7A00' }}>Yes, merge</button>
              <button type="button" onClick={() => setConfirm(null)} className="neo-button rounded-full px-4 py-2 text-sm font-bold text-[var(--text-primary)]">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
