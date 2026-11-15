// Duplicate leads: business names saved more than once.
// Nothing is removed automatically. The owner decides per pair: "different branches" (kept apart
// and not asked again) or "merge" (one lead keeps everything, the other is removed).

export const SEPARATE_MARK = 'Duplicate check: separate business';

// "Coldwell Banker", "coldwell banker." and "Coldwell Banker LLC" compare equal.
export const nameKey = (name: unknown) => String(name || '').toLowerCase().replace(/&/g, ' and ').replace(/\b(ltd|limited|llc|inc|plc|co|company|corp|corporation|the)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
export const keptApart = (lead: any) => String(lead?.notes || '').includes(SEPARATE_MARK);

const digits = (value: unknown) => String(value || '').replace(/\D/g, '').slice(-9);
const host = (value: unknown) => String(value || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
const plain = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export type DuplicateGroup = { key: string; name: string; hint: 'same' | 'unclear'; reason: string; leads: any[] };

// Why two leads look like one business. Only real matching details count; a shared name alone is "unclear".
function compare(leads: any[]): { hint: 'same' | 'unclear'; reason: string } {
  const shared = (pick: (lead: any) => string, least: number) => { const values = leads.map(pick).filter((value) => value.length >= least); return values.length > 1 && new Set(values).size < values.length; };
  if (shared((lead) => digits(lead.phone), 7)) return { hint: 'same', reason: 'Same phone number: very likely one business saved twice.' };
  if (shared((lead) => plain(lead.address), 8)) return { hint: 'same', reason: 'Same address: very likely one business saved twice.' };
  if (shared((lead) => plain(lead.email), 6)) return { hint: 'same', reason: 'Same email address: very likely one business saved twice.' };
  const cities = new Set(leads.map((lead) => plain(lead.city)).filter(Boolean));
  if (cities.size > 1) return { hint: 'unclear', reason: 'Same name in different cities: probably different branches.' };
  if (shared((lead) => host(lead.website), 4)) return { hint: 'unclear', reason: 'Same name and website but different contact details: may be branches of one company.' };
  return { hint: 'unclear', reason: 'Same name; the other details differ or are missing. Check before merging.' };
}

export async function listDuplicates(supabase: any): Promise<DuplicateGroup[]> {
  const { data, error } = await supabase.from('leads').select('id, business_name, category, city, address, phone, email, website, status, demo_status, lead_score, notes, created_at').order('created_at', { ascending: true }).limit(3000);
  if (error || !data) return [];
  const groups = new Map<string, any[]>();
  data.filter((lead: any) => !keptApart(lead)).forEach((lead: any) => { const key = nameKey(lead.business_name); if (!key) return; groups.set(key, [...(groups.get(key) || []), lead]); });
  return [...groups.entries()].filter(([, leads]) => leads.length > 1).map(([key, leads]) => ({
    key, name: String(leads[0].business_name), ...compare(leads),
    leads: leads.map((lead) => ({ id: lead.id, name: lead.business_name, category: lead.category || '', city: lead.city || '', address: lead.address || '', phone: lead.phone || '', email: lead.email || '', website: lead.website || '', status: lead.status || '', demoStatus: lead.demo_status || '', score: lead.lead_score || 0, createdAt: lead.created_at })),
  })).sort((first, second) => (first.hint === second.hint ? second.leads.length - first.leads.length : first.hint === 'same' ? -1 : 1));
}

// "These are different businesses": each lead gets a line in its notes and is not reported again.
export async function keepApart(supabase: any, ids: string[]) {
  const { data } = await supabase.from('leads').select('id, notes').in('id', ids.slice(0, 20));
  const stamp = `${SEPARATE_MARK} (${new Date().toISOString().slice(0, 10)})`;
  for (const lead of data || []) {
    if (keptApart(lead)) continue;
    await supabase.from('leads').update({ notes: [String(lead.notes || '').trim(), stamp].filter(Boolean).join('\n'), updated_at: new Date().toISOString() }).eq('id', lead.id);
  }
  return (data || []).length;
}

// Merge: the kept lead takes every detail it is missing from the other, the other's demos, notes,
// outreach history and task records move over, and only then is the other lead removed.
export async function mergeLeads(supabase: any, keepId: string, removeId: string) {
  if (!keepId || !removeId || keepId === removeId) throw new Error('Choose two different leads');
  const { data: pair } = await supabase.from('leads').select('*').in('id', [keepId, removeId]);
  const keep = (pair || []).find((lead: any) => lead.id === keepId);
  const remove = (pair || []).find((lead: any) => lead.id === removeId);
  if (!keep || !remove) throw new Error('One of the leads no longer exists');
  if (nameKey(keep.business_name) !== nameKey(remove.business_name)) throw new Error('Only leads with the same business name can be merged');
  const filled: string[] = [];
  const patch: Record<string, unknown> = {};
  Object.keys(remove).forEach((column) => {
    if (['id', 'created_at', 'updated_at', 'notes'].includes(column)) return;
    const mine = keep[column];
    const theirs = remove[column];
    const empty = mine === null || mine === undefined || mine === '' || (column === 'demo_status' && mine === 'Not Started') || (column === 'lead_score' && !mine);
    if (empty && theirs !== null && theirs !== undefined && theirs !== '') { patch[column] = theirs; filled.push(column); }
  });
  const otherNotes = String(remove.notes || '').trim();
  patch.notes = [String(keep.notes || '').trim(), otherNotes && !String(keep.notes || '').includes(otherNotes) ? otherNotes : '', `Merged with a duplicate record on ${new Date().toISOString().slice(0, 10)}.`].filter(Boolean).join('\n');
  patch.updated_at = new Date().toISOString();
  const { error: saveError } = await supabase.from('leads').update(patch).eq('id', keepId);
  if (saveError) throw new Error(saveError.message);
  // Everything attached to the removed lead moves to the kept one first, so nothing is lost with it.
  const moved: Record<string, number> = {};
  for (const table of ['demo_jobs', 'lead_notes', 'outreach_logs', 'agent_tasks', 'agent_activity']) {
    try {
      const { data: rows, error } = await supabase.from(table).update({ lead_id: keepId }).eq('lead_id', removeId).select('id');
      if (error) throw new Error(`Could not move ${table.replace('_', ' ')}: ${error.message}`);
      moved[table] = (rows || []).length;
    } catch (reason) {
      // A table that does not exist in this project is skipped; any other failure stops before deleting.
      const message = reason instanceof Error ? reason.message : String(reason);
      if (!/does not exist|schema cache|PGRST205|42P01/i.test(message)) throw new Error(message);
    }
  }
  const { error: deleteError } = await supabase.from('leads').delete().eq('id', removeId);
  if (deleteError) throw new Error(deleteError.message);
  return { name: String(keep.business_name), filled, moved };
}
