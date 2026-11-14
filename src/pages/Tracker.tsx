import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Pencil, Plus, Trash2, TrendingUp, Wallet, X } from 'lucide-react';
import { useLeads } from '../context/LeadContext';
import { useToast } from '../components/ui/useToast';
import { priceStage } from '../lib/demo-factory';
import { cn } from '../utils/cn';

// Business Tracker: every tool, subscription and domain the studio uses, what it costs, when it is due,
// and how the running costs compare with closed deals. Card numbers are never stored.

type Item = { id?: string; name: string; kind: string; status: string; amount: number; currency: string; cycle: string; nextDue: string | null; paidWith: string; notes: string };

const EMPTY: Item = { name: '', kind: 'tool', status: 'paid', amount: 0, currency: 'USD', cycle: 'monthly', nextDue: null, paidWith: '', notes: '' };
const KIND_LABEL: Record<string, string> = { tool: 'Tool', subscription: 'Subscription', domain: 'Domain', other: 'Other' };
const STATUS_LABEL: Record<string, string> = { paid: 'Paying', free: 'Free tier', paused: 'Paused', cancelled: 'Cancelled' };
const STATUS_TONE: Record<string, string> = { paid: 'text-orange-400 bg-orange-400/10', free: 'text-green-500 bg-green-500/10', paused: 'text-yellow-500 bg-yellow-500/10', cancelled: 'text-gray-400 bg-gray-400/10' };
// The services ClientRadar itself is built on. Added only when you press the button, all as free tier for you to confirm.
const STARTERS = ['Vercel (hosting)', 'Supabase (database)', 'GitHub (code)', 'Geoapify (business search)', 'Google Gemini API (AI)', 'Brevo (email sending)'];

const money = (value: number, currency: string) => {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: value % 1 ? 2 : 0 }).format(value); } catch { return `${currency} ${value.toLocaleString()}`; }
};
const daysUntil = (date: string | null) => (date ? Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000) : null);
const dueText = (date: string | null) => {
  const days = daysUntil(date);
  if (days === null) return 'No due date';
  if (days < 0) return `Overdue by ${-days} ${days === -1 ? 'day' : 'days'}`;
  if (days === 0) return 'Due today';
  return `Due in ${days} ${days === 1 ? 'day' : 'days'} (${date})`;
};

async function call(method: 'GET' | 'POST', body?: unknown) {
  const response = await fetch(method === 'GET' ? '/api/team?view=tracker' : '/api/team', method === 'GET' ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const raw = await response.text();
  let data: any = null;
  try { data = JSON.parse(raw); } catch { /* not JSON */ }
  if (!data) throw new Error('The server did not answer. If you just uploaded, wait for Vercel to finish.');
  if (!data.success) throw new Error(data.error || 'Something went wrong');
  return data;
}

const Tracker = () => {
  const { leads } = useLeads() as any;
  const { showToast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState('');
  const [failed, setFailed] = useState('');
  const [editing, setEditing] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await call('GET');
      setItems(data.data || []);
      setSetupNeeded(data.setupNeeded || '');
      setFailed('');
    } catch (error) {
      setFailed(error instanceof Error ? error.message : 'Could not load the tracker');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Costs per currency (no exchange rates are guessed): only items you are paying for count.
  const totals = useMemo(() => {
    const byCurrency: Record<string, { monthly: number; yearly: number }> = {};
    for (const item of items) {
      if (item.status !== 'paid' || item.cycle === 'one-time' || !item.amount) continue;
      const slot = (byCurrency[item.currency] ||= { monthly: 0, yearly: 0 });
      slot.monthly += item.cycle === 'yearly' ? item.amount / 12 : item.amount;
      slot.yearly += item.cycle === 'yearly' ? item.amount : item.amount * 12;
    }
    return byCurrency;
  }, [items]);
  const dueSoon = useMemo(() => items.filter((item) => item.status === 'paid' && item.nextDue && (daysUntil(item.nextDue) as number) <= 30).sort((a, b) => String(a.nextDue).localeCompare(String(b.nextDue))), [items]);
  const closed = useMemo(() => (leads || []).filter((lead: any) => lead.status === 'Deal Closed'), [leads]);
  const income = closed.reduce((sum: number, lead: any) => sum + (Number(lead.dealValue) || 0), 0);
  const stage = priceStage(closed.length);
  const usdYear = totals.USD?.yearly || 0;
  const otherCurrencies = Object.keys(totals).filter((code) => code !== 'USD');
  const shown = items.filter((item) => filter === 'all' || item.status === filter || item.kind === filter);

  const save = async (item: Item) => {
    setSaving(true);
    try {
      await call('POST', { action: 'tracker-save', item });
      setEditing(null);
      await load();
      showToast({ type: 'success', title: 'Saved', message: `${item.name} is in your tracker.` });
    } catch (error) {
      showToast({ type: 'error', title: 'Not saved', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };
  const remove = async (item: Item) => {
    if (!item.id || !window.confirm(`Remove ${item.name} from the tracker?`)) return;
    try { await call('POST', { action: 'tracker-delete', id: item.id }); await load(); } catch (error) { showToast({ type: 'error', title: 'Not removed', message: error instanceof Error ? error.message : 'Please try again.' }); }
  };
  const addStarters = async () => {
    setSaving(true);
    try {
      for (const name of STARTERS) {
        if (items.some((item) => item.name.toLowerCase() === name.toLowerCase())) continue;
        await call('POST', { action: 'tracker-save', item: { ...EMPTY, name, status: 'free', notes: 'Added as free tier. Change it if you pay for this.' } });
      }
      await load();
    } catch (error) {
      showToast({ type: 'error', title: 'Could not add them', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const inputClasses = 'w-full rounded-2xl neo-in text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none px-4 py-3';
  const labelClasses = 'text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.16em] ml-1';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2 text-[var(--text-primary)]">Business Tracker</h1>
          <p className="text-[var(--text-secondary)] font-medium">Everything the studio pays for or uses free: tools, subscriptions and domains, with due dates and running costs.</p>
        </div>
        <button type="button" onClick={() => setEditing({ ...EMPTY })} className="btn-neumorph-primary px-5 py-3 text-sm font-bold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2 self-start">
          <Plus size={16} /> Add item
        </button>
      </header>

      {setupNeeded && <div className="neo-card p-5 border border-amber-500/30 text-sm text-[var(--text-primary)]" role="status"><AlertTriangle size={16} className="inline mr-2 text-amber-500" />{setupNeeded}</div>}
      {failed && <div className="neo-card p-5 text-sm text-red-400" role="alert">{failed}</div>}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" data-tracker-totals>
        <div className="neo-card p-5">
          <p className={labelClasses}><Wallet size={12} className="inline mr-1" />Monthly cost</p>
          <p className="mt-2 text-2xl font-black text-[var(--text-primary)]">{money(totals.USD?.monthly || 0, 'USD')}</p>
          {otherCurrencies.map((code) => <p key={code} className="text-sm text-[var(--text-secondary)]">+ {money(totals[code].monthly, code)}</p>)}
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Yearly bills are spread over 12 months.</p>
        </div>
        <div className="neo-card p-5">
          <p className={labelClasses}>Yearly cost</p>
          <p className="mt-2 text-2xl font-black text-[var(--text-primary)]">{money(usdYear, 'USD')}</p>
          {otherCurrencies.map((code) => <p key={code} className="text-sm text-[var(--text-secondary)]">+ {money(totals[code].yearly, code)}</p>)}
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{items.filter((item) => item.status === 'paid').length} paying, {items.filter((item) => item.status === 'free').length} free, {items.filter((item) => item.status === 'paused').length} paused</p>
        </div>
        <div className="neo-card p-5">
          <p className={labelClasses}><TrendingUp size={12} className="inline mr-1" />Closed deals</p>
          <p className="mt-2 text-2xl font-black text-[var(--text-primary)]">{money(income, 'USD')}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{closed.length} closed {closed.length === 1 ? 'deal' : 'deals'}, all time, from your leads.</p>
        </div>
        <div className="neo-card p-5">
          <p className={labelClasses}>Profit or loss</p>
          <p className={cn('mt-2 text-2xl font-black', income - usdYear >= 0 ? 'text-green-500' : 'text-red-400')}>{money(income - usdYear, 'USD')}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Closed deals minus one year of USD costs.{otherCurrencies.length ? ' Other currencies are not included.' : ''}</p>
        </div>
      </section>

      <section className="neo-card p-5 sm:p-6" data-price-stage>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Your prices right now: {stage.name}</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Mid {money(stage.ranges.mid.min, 'USD')}-{money(stage.ranges.mid.max, 'USD')}, Hybrid {money(stage.ranges.hybrid.min, 'USD')}-{money(stage.ranges.hybrid.max, 'USD')}, Ultra {money(stage.ranges.ultra.min, 'USD')}-{money(stage.ranges.ultra.max, 'USD')}.
          {stage.next ? ` ${stage.dealsToNext} more closed ${stage.dealsToNext === 1 ? 'deal moves' : 'deals move'} the estimates up to ${stage.next.name}.` : ' This is the top stage.'}
        </p>
      </section>

      {dueSoon.length > 0 && (
        <section className="neo-card p-5 sm:p-6" data-due-soon>
          <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2"><CalendarClock size={18} /> Due in the next 30 days</h2>
          <ul className="mt-3 divide-y divide-slate-500/15">
            {dueSoon.map((item) => (
              <li key={item.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-[var(--text-primary)]">{item.name}</span>
                <span className={cn((daysUntil(item.nextDue) as number) < 0 ? 'text-red-400' : (daysUntil(item.nextDue) as number) <= 7 ? 'text-orange-400' : 'text-[var(--text-secondary)]')}>{money(item.amount, item.currency)} - {dueText(item.nextDue)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="neo-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">All items ({shown.length})</h2>
          <select aria-label="Show" className="rounded-2xl neo-in px-3 py-2 text-sm text-[var(--text-primary)] outline-none" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Everything</option>
            <option value="paid">Paying</option>
            <option value="free">Free tier</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
            <option value="domain">Domains</option>
            <option value="subscription">Subscriptions</option>
            <option value="tool">Tools</option>
          </select>
        </div>
        {loading ? <p className="mt-4 text-sm text-[var(--text-secondary)]">Loading...</p> : shown.length === 0 ? (
          <div className="mt-4 text-sm text-[var(--text-secondary)]">
            <p>Nothing here yet. Add your first tool, subscription or domain.</p>
            {items.length === 0 && !setupNeeded && (
              <button type="button" disabled={saving} onClick={() => void addStarters()} className="mt-3 neo-button px-4 py-2 rounded-full text-sm font-semibold text-[var(--text-primary)]">
                {saving ? 'Adding...' : 'Add the 6 services ClientRadar runs on (as free tier)'}
              </button>
            )}
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-slate-500/15" data-tracker-list>
            {shown.map((item) => (
              <li key={item.id} className="py-3.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[var(--text-primary)] break-words">{item.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)]">
                    <span className={cn('px-2 py-0.5 rounded-full font-semibold', STATUS_TONE[item.status])}>{STATUS_LABEL[item.status] || item.status}</span>
                    <span>{KIND_LABEL[item.kind] || item.kind}</span>
                    {item.status !== 'free' && <span>{money(item.amount, item.currency)} {item.cycle === 'one-time' ? 'once' : item.cycle}</span>}
                    {item.nextDue && <span>{dueText(item.nextDue)}</span>}
                    {item.paidWith && <span>Paid with {item.paidWith}</span>}
                  </p>
                  {item.notes && <p className="mt-1 text-xs text-[var(--text-secondary)] break-words">{item.notes}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" aria-label={`Edit ${item.name}`} onClick={() => setEditing({ ...item })} className="p-2 rounded-xl hover:bg-white/10 text-[var(--text-secondary)]"><Pencil size={16} /></button>
                  <button type="button" aria-label={`Remove ${item.name}`} onClick={() => void remove(item)} className="p-2 rounded-xl hover:bg-red-500/10 text-red-400"><Trash2 size={16} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Tracker item">
          <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); void save(editing); }} className="neo-card w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto p-5 sm:p-6 space-y-4 rounded-b-none sm:rounded-b-[inherit]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{editing.id ? 'Edit item' : 'Add item'}</h3>
              <button type="button" aria-label="Close" onClick={() => setEditing(null)} className="p-2 text-[var(--text-secondary)]"><X size={18} /></button>
            </div>
            <div className="space-y-1.5"><label className={labelClasses} htmlFor="tr-name">Name</label><input id="tr-name" required className={inputClasses} placeholder="e.g. Vercel Pro, timigaga.com" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><label className={labelClasses} htmlFor="tr-kind">Type</label><select id="tr-kind" className={inputClasses} value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value })}>{Object.entries(KIND_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
              <div className="space-y-1.5"><label className={labelClasses} htmlFor="tr-status">Status</label><select id="tr-status" className={inputClasses} value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>{Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
            </div>
            {editing.status !== 'free' && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><label className={labelClasses} htmlFor="tr-amount">Price</label><input id="tr-amount" type="number" inputMode="decimal" min="0" step="0.01" className={inputClasses} value={editing.amount || ''} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><label className={labelClasses} htmlFor="tr-currency">Currency</label><select id="tr-currency" className={inputClasses} value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })}>{['USD', 'NGN', 'GBP', 'EUR'].map((code) => <option key={code} value={code}>{code}</option>)}</select></div>
                <div className="space-y-1.5"><label className={labelClasses} htmlFor="tr-cycle">Billed</label><select id="tr-cycle" className={inputClasses} value={editing.cycle} onChange={(e) => setEditing({ ...editing, cycle: e.target.value })}><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="one-time">Once</option></select></div>
              </div>
            )}
            <div className="space-y-1.5"><label className={labelClasses} htmlFor="tr-due">Next due or renewal date</label><input id="tr-due" type="date" className={inputClasses} value={editing.nextDue || ''} onChange={(e) => setEditing({ ...editing, nextDue: e.target.value || null })} /></div>
            <div className="space-y-1.5"><label className={labelClasses} htmlFor="tr-card">Paid with (nickname only)</label><input id="tr-card" className={inputClasses} placeholder="e.g. Chipper card ending 1234" value={editing.paidWith} onChange={(e) => setEditing({ ...editing, paidWith: e.target.value })} /><p className="text-[11px] text-[var(--text-secondary)] ml-1">Never type a full card number here. It will be refused.</p></div>
            <div className="space-y-1.5"><label className={labelClasses} htmlFor="tr-notes">Notes</label><input id="tr-notes" className={inputClasses} placeholder="What it is for, plan name, limits" value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
            <button type="submit" disabled={saving} className="btn-neumorph-primary w-full px-6 py-3.5 text-sm uppercase tracking-[0.16em] font-bold">{saving ? 'Saving...' : 'Save'}</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Tracker;
