// Business Tracker: the bills, tools and domains the studio pays for (or uses on a free tier).
// Card numbers are never stored: "paidWith" is a nickname only, and anything that looks like a card number is refused.

const KINDS = ['tool', 'subscription', 'domain', 'other'];
const STATUSES = ['paid', 'free', 'paused', 'cancelled'];
const CYCLES = ['monthly', 'yearly', 'one-time'];
const text = (value: unknown, max: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const looksLikeCard = (value: string) => /(?:\d[ -]?){12,19}/.test(value);

const missingTable = (error: any) => error && (error.code === 'PGRST205' || error.code === '42P01' || /business_expenses/.test(String(error.message || '')));
const SETUP = 'The tracker table is not created yet. Run the file supabase/migrations/006_business_tracker.sql in the Supabase SQL Editor once.';

const toItem = (row: any) => ({
  id: row.id, name: row.name, kind: row.kind, status: row.status, amount: Number(row.amount) || 0, currency: row.currency, cycle: row.cycle,
  nextDue: row.next_due || null, paidWith: row.paid_with || '', notes: row.notes || '', updatedAt: row.updated_at,
});

export async function listTracker(supabase: any) {
  const { data, error } = await supabase.from('business_expenses').select('*').order('next_due', { ascending: true, nullsFirst: false }).limit(500);
  if (missingTable(error)) return { status: 200, json: { success: true, data: [], setupNeeded: SETUP } };
  if (error) return { status: 500, json: { success: false, error: String(error.message).slice(0, 200) } };
  return { status: 200, json: { success: true, data: (data || []).map(toItem) } };
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
  const { error } = await supabase.from('business_expenses').delete().eq('id', id);
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
