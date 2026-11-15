// Business Tracker: the bills, tools and domains the studio pays for (or uses on a free tier).
// Card numbers are never stored: "paidWith" is a nickname only, and anything that looks like a card number is refused.

const KINDS = ['tool', 'subscription', 'domain', 'other'];
const STATUSES = ['paid', 'free', 'paused', 'cancelled'];
const CYCLES = ['monthly', 'yearly', 'one-time'];
const text = (value: unknown, max: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const looksLikeCard = (value: string) => /(?:\d[ -]?){12,19}/.test(value);

const missingTable = (error: any) => error && (error.code === 'PGRST205' || error.code === '42P01' || /business_expenses/.test(String(error.message || '')));
const SETUP = 'The tracker table is not created yet. Run the file supabase/migrations/006_business_tracker.sql in the Supabase SQL Editor once.';

// The services ClientRadar itself runs on. The Records Upkeep Agent adds them to the tracker by itself,
// as free tier, with what the paid plan costs. Prices are reference figures with the date they were
// checked; a price of null means it was not confirmed and must be read on the provider's page.
const PRICE_CHECKED = '2026-11-14';
export const KNOWN_SERVICES: { key: string; name: string; inUse: () => boolean; upgradePrice: number | null; upgradeNote: string; notes: string }[] = [
  { key: 'vercel', name: 'Vercel (hosting)', inUse: () => true, upgradePrice: 20, upgradeNote: 'Pro plan, per user per month', notes: 'Runs the ClientRadar website and server. The free Hobby plan is reported to be for personal use; check the terms before taking paying clients.' },
  { key: 'supabase', name: 'Supabase (database and login)', inUse: () => true, upgradePrice: 25, upgradeNote: 'Pro plan per month, more with heavy use', notes: 'Stores leads, demos, tasks and this tracker. Free projects are reported to pause after 7 days without activity.' },
  { key: 'github', name: 'GitHub (code storage)', inUse: () => true, upgradePrice: null, upgradeNote: 'Free plan is enough; paid price not confirmed', notes: 'Holds the ClientRadar code that Vercel publishes.' },
  { key: 'geoapify', name: 'Geoapify (business search and map positions)', inUse: () => Boolean(process.env.GEOAPIFY_API_KEY), upgradePrice: 59, upgradeNote: 'First paid plan per month', notes: 'Free plan: 3,000 credits a day. Needed only if searches go past that.' },
  { key: 'gemini', name: 'Google Gemini API (AI writing, voice, screenshots)', inUse: () => Boolean(process.env.DEMO_AI_API_KEY || process.env.GEMINI_API_KEY), upgradePrice: null, upgradeNote: 'Pay per use (no fixed monthly price); prepaid from $5', notes: 'Free tier has daily limits. Paid use is charged by the amount of text read and written.' },
  { key: 'brevo', name: 'Brevo (email sending)', inUse: () => Boolean(process.env.BREVO_API_KEY), upgradePrice: null, upgradeNote: 'Paid price not confirmed; see brevo.com/pricing', notes: 'Sends outreach emails. Free plan has a daily sending limit.' },
  { key: 'unsplash', name: 'Unsplash (sample photos for demos)', inUse: () => Boolean(process.env.UNSPLASH_ACCESS_KEY), upgradePrice: null, upgradeNote: 'Free; higher limit after approval, no price reported', notes: 'Sample photographs for demos, marked as samples and credited. Free demo mode: about 50 requests an hour.' },
  { key: 'pexels', name: 'Pexels (sample photos for demos)', inUse: () => Boolean(process.env.PEXELS_API_KEY), upgradePrice: null, upgradeNote: 'Free; no paid plan reported', notes: 'Sample photographs for demos, marked as samples. Free key: about 200 requests an hour.' },
  { key: 'google-places', name: 'Google Places (business search with ratings)', inUse: () => Boolean(process.env.GOOGLE_PLACES_API_KEY), upgradePrice: null, upgradeNote: 'Pay per search; billing account required', notes: 'Key is set but billing is off, so it is not used. Geoapify answers instead.' },
];

// Adds any known service that is in use and not yet listed. Never changes or re-adds a row that exists
// (also when you marked it cancelled). Returns the names it added.
export async function ensureKnownServices(supabase: any): Promise<string[]> {
  try {
    const { data, error } = await supabase.from('business_expenses').select('service_key, name').limit(500);
    if (error) return [];
    const have = new Set((data || []).map((row: any) => row.service_key).filter(Boolean));
    const names = new Set((data || []).map((row: any) => String(row.name || '').toLowerCase().split(' (')[0]));
    const missing = KNOWN_SERVICES.filter((service) => service.inUse() && !have.has(service.key) && !names.has(service.name.toLowerCase().split(' (')[0]));
    if (!missing.length) return [];
    const { error: insertError } = await supabase.from('business_expenses').insert(missing.map((service) => ({
      name: service.name, kind: 'tool', status: 'free', amount: 0, currency: 'USD', cycle: 'monthly',
      service_key: service.key, upgrade_price: service.upgradePrice, upgrade_note: `${service.upgradeNote} (checked ${PRICE_CHECKED})`,
      notes: `${service.notes} Added automatically.`,
    })));
    return insertError ? [] : missing.map((service) => service.name);
  } catch {
    return [];
  }
}

const toItem = (row: any) => ({
  id: row.id, name: row.name, kind: row.kind, status: row.status, amount: Number(row.amount) || 0, currency: row.currency, cycle: row.cycle,
  nextDue: row.next_due || null, paidWith: row.paid_with || '', notes: row.notes || '', updatedAt: row.updated_at,
  auto: Boolean(row.service_key), upgradePrice: row.upgrade_price === null || row.upgrade_price === undefined ? null : Number(row.upgrade_price), upgradeNote: row.upgrade_note || '',
});

export async function listTracker(supabase: any) {
  const added = await ensureKnownServices(supabase);
  const { data, error } = await supabase.from('business_expenses').select('*').order('next_due', { ascending: true, nullsFirst: false }).limit(500);
  if (missingTable(error)) return { status: 200, json: { success: true, data: [], setupNeeded: SETUP } };
  if (error) return { status: 500, json: { success: false, error: String(error.message).slice(0, 200) } };
  const probe = await supabase.from('business_expenses').select('service_key').limit(1);
  const update = probe.error ? 'The tracker needs one small update before services can be added automatically: run supabase/migrations/006_business_tracker.sql in the Supabase SQL Editor again (it is safe to run twice).' : '';
  // Rows are hidden, not deleted, when an automatic service was removed, so it is not added again.
  return { status: 200, json: { success: true, data: (data || []).filter((row: any) => row.status !== 'removed').map(toItem), added, ...(update ? { setupNeeded: update } : {}) } };
}

export async function saveTracker(supabase: any, body: any) {
  const raw = body?.item || {};
  const name = text(raw.name, 80);
  if (!name) return { status: 400, json: { success: false, error: 'Give it a name, for example Vercel or timigaga.com' } };
  const paidWith = text(raw.paidWith, 60);
  const notes = text(raw.notes, 300);
  if (looksLikeCard(paidWith) || looksLikeCard(notes) || looksLikeCard(name)) {
    return { status: 400, json: { success: false, error: 'For safety, card numbers are not stored here. Use a nickname such as "Chipper card ending 1234".' } };
  }
  const amount = Math.max(0, Math.round((Number(raw.amount) || 0) * 100) / 100);
  const status = STATUSES.includes(raw.status) ? raw.status : 'paid';
  const due = typeof raw.nextDue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.nextDue) ? raw.nextDue : null;
  const row = {
    name,
    kind: KINDS.includes(raw.kind) ? raw.kind : 'tool',
    status,
    amount: status === 'free' ? 0 : amount,
    currency: (text(raw.currency, 3).toUpperCase().match(/^[A-Z]{3}$/) || ['USD'])[0],
    cycle: CYCLES.includes(raw.cycle) ? raw.cycle : 'monthly',
    next_due: due,
    paid_with: paidWith || null,
    notes: notes || null,
    updated_at: new Date().toISOString(),
  };
  const id = text(raw.id, 40);
  const query = id ? supabase.from('business_expenses').update(row).eq('id', id).select().single() : supabase.from('business_expenses').insert(row).select().single();
  const { data, error } = await query;
  if (missingTable(error)) return { status: 200, json: { success: false, error: SETUP } };
  if (error || !data) return { status: 500, json: { success: false, error: String(error?.message || 'Could not save').slice(0, 200) } };
  return { status: 200, json: { success: true, data: toItem(data) } };
}

export async function deleteTracker(supabase: any, body: any) {
  const id = text(body?.id, 40);
  if (!id) return { status: 400, json: { success: false, error: 'id is required' } };
  const { data: row } = await supabase.from('business_expenses').select('service_key').eq('id', id).maybeSingle();
  const { error } = row?.service_key
    ? await supabase.from('business_expenses').update({ status: 'removed', updated_at: new Date().toISOString() }).eq('id', id)
    : await supabase.from('business_expenses').delete().eq('id', id);
  if (error) return { status: 500, json: { success: false, error: String(error.message).slice(0, 200) } };
  return { status: 200, json: { success: true } };
}

// One short line for the Master Agent: what is due in the next 7 days and what is overdue. Empty when nothing is.
export async function billsLine(supabase: any): Promise<string> {
  try {
    const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.from('business_expenses').select('name, amount, currency, next_due, status').eq('status', 'paid').not('next_due', 'is', null).lte('next_due', soon).order('next_due', { ascending: true }).limit(8);
    if (error || !data?.length) return '';
    return `Bills: ${data.map((row: any) => `${row.name} ${row.currency} ${Number(row.amount)} ${row.next_due < today ? `was due ${row.next_due} (overdue)` : `due ${row.next_due}`}`).join('; ')}.`;
  } catch {
    return '';
  }
}
