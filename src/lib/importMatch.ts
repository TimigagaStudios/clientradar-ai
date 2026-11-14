// Duplicate checks for imported records. A match is only ever a warning for the owner to review:
// nothing is removed automatically.

export type Matchable = { name?: string; website?: string; phone?: string; city?: string };

const NOISE = /\b(ltd|limited|llc|inc|incorporated|co|company|corp|plc|gmbh|the|and)\b/g;
export const normName = (value: unknown) => String(value || '').toLowerCase().replace(/&/g, ' and ').replace(NOISE, ' ').replace(/[^a-z0-9]+/g, '');
export const normDomain = (value: unknown) => String(value || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
export const normPhone = (value: unknown) => String(value || '').replace(/\D/g, '').slice(-9);
const normCity = (value: unknown) => String(value || '').toLowerCase().split(',')[0].replace(/[^a-z]+/g, '');

// Returns why two records look like the same business, or '' when they do not.
export function sameBusiness(first: Matchable, second: Matchable): string {
  const phoneA = normPhone(first.phone);
  const phoneB = normPhone(second.phone);
  if (phoneA.length >= 7 && phoneA === phoneB) return 'same phone number';
  const domainA = normDomain(first.website);
  const domainB = normDomain(second.website);
  const shared = /^(facebook|instagram|linktr|wa|google|g|maps|yelp|tripadvisor|booking)\./;
  if (domainA && domainA === domainB && !shared.test(domainA)) return 'same website';
  const nameA = normName(first.name);
  const nameB = normName(second.name);
  if (nameA.length >= 3 && nameA === nameB) {
    const cityA = normCity(first.city);
    const cityB = normCity(second.city);
    if (!cityA || !cityB || cityA === cityB || cityA.includes(cityB) || cityB.includes(cityA)) return cityA && cityB ? 'same name and city' : 'same name';
  }
  return '';
}

// Folds repeated records together instead of just deleting them. Useful when one screenshot is a
// results list (name, category, rating) and another is the place card of the same business
// (phone, website, address): the first record is kept and its empty fields are filled from the repeat.
// Records that match a lead already saved are only removed; saved leads are never changed here.
export function mergeDuplicates<T extends Matchable & { id: string } & Record<string, any>>(records: T[], alreadySaved: (record: T) => boolean, fields: string[]) {
  const kept: T[] = [];
  const removedIds: string[] = [];
  const changedIds = new Set<string>();
  records.forEach((record) => {
    if (alreadySaved(record)) { removedIds.push(record.id); return; }
    const index = kept.findIndex((earlier) => sameBusiness(record, earlier));
    if (index < 0) { kept.push(record); return; }
    const merged: Record<string, any> = { ...kept[index] };
    fields.forEach((field) => {
      const empty = merged[field] === null || merged[field] === undefined || merged[field] === '';
      const value = record[field];
      if (empty && value !== null && value !== undefined && value !== '') { merged[field] = value; changedIds.add(merged.id); }
    });
    kept[index] = merged as T;
    removedIds.push(record.id);
  });
  return { kept, removedIds, changed: kept.filter((record) => changedIds.has(record.id)) };
}
