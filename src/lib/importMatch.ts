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
