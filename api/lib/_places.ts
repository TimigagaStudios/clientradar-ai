// Business search tools. Google Places is used when its key works; when it is missing or
// refused (for example billing is not switched on), the free OpenStreetMap search answers
// instead. OpenStreetMap has fewer listings and no ratings, and nothing here is invented:
// missing phone, website or rating stays empty.

export interface FoundBusiness {
  businessName: string;
  address: string;
  latitude?: number;
  longitude?: number;
  rating: number;
  reviewCount: number;
  website: string | null;
  phone: string | null;
  mapLink: string;
  email?: string | null;
  category?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface BusinessSearch {
  businesses: FoundBusiness[];
  source: 'google' | 'geoapify' | 'openstreetmap';
  note: string | null;
  // Filled by the Geoapify search: the searched area, whether more results exist, and the free credits used.
  area?: { west: number; south: number; east: number; north: number } | null;
  hasMore?: boolean;
  credits?: number;
}

export type MapBounds = { west: number; south: number; east: number; north: number };

export function plainPlacesError(message: string) {
  if (/billing/i.test(message)) return 'Google Places needs billing switched on in Google Cloud';
  if (/api key|not authorized|denied/i.test(message)) return 'Google Places refused the key';
  return message.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 140) || 'Google Places search failed';
}

// A real check of a business website (replaces the old random "outdated" guess).
// It only reports a problem it actually saw on the page; when the site cannot be read, nothing is claimed.
export async function checkWebsite(url: string | null | undefined): Promise<{ outdated: boolean; note: string | null }> {
  if (!url) return { outdated: false, note: null };
  let parsed: URL;
  try { parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`); } catch { return { outdated: false, note: null }; }
  try {
    const response = await fetch(parsed.toString(), { signal: AbortSignal.timeout(3500), redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ClientRadarAI/1.0)' } });
    if (!response.ok) return { outdated: false, note: null };
    const html = (await response.text()).slice(0, 120_000);
    if (!/<html|<head|<body/i.test(html)) return { outdated: false, note: null };
    if (!/<meta[^>]+name=["']?viewport/i.test(html)) return { outdated: true, note: 'Not built for phones' };
    if (String(response.url || parsed.toString()).startsWith('http://')) return { outdated: true, note: 'No secure connection (https)' };
    return { outdated: false, note: null };
  } catch {
    return { outdated: false, note: null };
  }
}

export async function osmSearch(category: string, city: string, limit = 10): Promise<FoundBusiness[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${category} in ${city}`)}&format=jsonv2&limit=${limit}&addressdetails=1&extratags=1`;
  const response = await fetch(url, { headers: { 'User-Agent': 'ClientRadarAI/1.0 (lead research)', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`OpenStreetMap search returned ${response.status}`);
  const rows: any[] = await response.json();
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => String(row?.name || '').trim() && !['boundary', 'place', 'highway'].includes(String(row?.category)))
    .map((row) => {
      const tags = row.extratags || {};
      return {
        businessName: String(row.name).trim(),
        address: String(row.display_name || '').replace(`${row.name}, `, ''),
        latitude: Number(row.lat) || undefined,
        longitude: Number(row.lon) || undefined,
        rating: 0,
        reviewCount: 0,
        website: tags.website || tags['contact:website'] || null,
        phone: tags.phone || tags['contact:phone'] || null,
        mapLink: `https://www.google.com/maps/search/?api=1&query=${row.lat},${row.lon}`,
      };
    });
}

async function googleSearch(category: string, city: string, limit: number): Promise<FoundBusiness[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error('Google Places key is not set');
  const search = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(`${category} in ${city}`)}&key=${key}`, { signal: AbortSignal.timeout(12000) });
  const data: any = await search.json();
  if (!search.ok || data.status === 'REQUEST_DENIED') throw new Error(data.error_message || 'Google Places search failed');
  const places: any[] = (data.results || []).slice(0, limit);
  return Promise.all(
    places.map(async (place) => {
      let details: any = {};
      try {
        const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place.place_id)}&fields=website,formatted_phone_number&key=${key}`, { signal: AbortSignal.timeout(8000) });
        details = (await response.json())?.result || {};
      } catch {
        /* details are optional */
      }
      return {
        businessName: String(place.name || ''),
        address: String(place.formatted_address || ''),
        latitude: place.geometry?.location?.lat,
        longitude: place.geometry?.location?.lng,
        rating: Number(place.rating) || 0,
        reviewCount: Number(place.user_ratings_total) || 0,
        website: details.website || null,
        phone: details.formatted_phone_number || null,
        mapLink: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
      };
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Geoapify Places: the free worldwide business search (OpenStreetMap data, no ratings).
// Free plan: 3,000 credits a day, no card. One search costs 1 credit per 20 businesses returned,
// plus 1 credit to look up a city name. Needs GEOAPIFY_API_KEY in Vercel.
// ---------------------------------------------------------------------------------------------

// Everyday words -> Geoapify category keys (only keys listed in Geoapify's documentation). Checked in order.
const CATEGORY_WORDS: [RegExp, string[]][] = [
  [/driving school/, ['education.driving_school']],
  [/car wash/, ['service.vehicle.car_wash']],
  [/car dealer|dealership|car sales/, ['commercial.vehicle']],
  [/mechanic|auto repair|car repair|garage|tyre|tire/, ['service.vehicle.repair']],
  [/real estate|realt|estate agen|property|lettings|housing agen/, ['office.estate_agent', 'service.estate_agent']],
  [/orthodont|dentist|dental/, ['healthcare.dentist']],
  [/hospital/, ['healthcare.hospital']],
  [/pharmac|chemist|drugstore/, ['healthcare.pharmacy', 'commercial.health_and_beauty.pharmacy']],
  [/optician|optic|eyewear|eye care/, ['commercial.health_and_beauty.optician']],
  [/veterinar|\bvet\b|animal clinic/, ['pet.veterinary']],
  [/doctor|clinic|medical|physician|physio|chiropract|dermatolog/, ['healthcare.clinic_or_praxis']],
  [/fast food|burger|pizza|takeaway|take-away/, ['catering.fast_food']],
  [/restaurant|eatery|dining|grill|bistro|steakhouse|kitchen/, ['catering.restaurant']],
  [/cafe|coffee|tea house/, ['catering.cafe']],
  [/\bbar\b|\bpub\b|lounge|nightclub/, ['catering.bar', 'catering.pub']],
  [/baker/, ['commercial.food_and_drink.bakery']],
  [/hotel/, ['accommodation.hotel']],
  [/motel|guest ?house|hostel|lodging|accommodation|apartment rental|short.?let/, ['accommodation']],
  [/barber|hairdress|hair salon|\bsalon\b|\bhair\b/, ['service.beauty.hairdresser']],
  [/tattoo/, ['service.beauty.tattoo']],
  [/\bspa\b|massage/, ['service.beauty.spa', 'service.beauty.massage', 'leisure.spa']],
  [/beauty|nail|cosmetic|makeup|lash/, ['service.beauty']],
  [/gym|fitness|crossfit|pilates|yoga/, ['sport.fitness']],
  [/lawyer|attorney|law firm|legal|solicitor/, ['office.lawyer']],
  [/accountant|accounting|bookkeep|tax/, ['office.accountant', 'office.tax_advisor']],
  [/insurance/, ['office.insurance']],
  [/architect/, ['office.architect']],
  [/consult/, ['office.consulting']],
  [/software|it company|tech company|web design|digital agency/, ['office.it']],
  [/advertis|marketing agency/, ['office.advertising_agency']],
  [/travel/, ['office.travel_agent', 'service.travel_agency']],
  [/logistic|freight|shipping/, ['office.logistics']],
  [/laundr|dry clean/, ['service.cleaning']],
  [/electrician/, ['service.electrician']],
  [/carpent|joiner/, ['service.carpenter']],
  [/locksmith/, ['service.locksmith']],
  [/photograph/, ['service.photographer']],
  [/tailor|alteration/, ['service.tailor']],
  [/funeral/, ['service.funeral_directors']],
  [/\bpet\b|grooming/, ['pet.shop', 'pet.service']],
  [/kindergarten|daycare|day care|nursery|creche/, ['childcare']],
  [/university|college/, ['education.university', 'education.college']],
  [/school|academy/, ['education.school']],
  [/supermarket|grocer|convenience/, ['commercial.supermarket', 'commercial.convenience']],
  [/shoe/, ['commercial.clothing.shoes']],
  [/clothing|boutique|fashion|apparel/, ['commercial.clothing']],
  [/jewel/, ['commercial.jewelry']],
  [/furniture|interior/, ['commercial.furniture_and_interior']],
  [/electronic|phone shop|computer shop/, ['commercial.elektronics']],
  [/florist|flower/, ['commercial.florist']],
  [/hardware|building material|paint shop/, ['commercial.houseware_and_hardware']],
  [/bank\b/, ['service.financial.bank']],
  [/event|venue|banquet|wedding hall/, ['activity.events_venue']],
  [/brewer/, ['production.brewery']],
  [/factory|manufactur/, ['production.factory']],
  [/shop|store|retail/, ['commercial']],
  [/compan|office|business|firm|agency/, ['office.company']],
];

// Returns the category keys for a typed category. When nothing matches (for example "plumber" or
// "construction", which the map data has no category for), businesses are searched by NAME instead.
export function geoapifyCategories(category: string): { keys: string[]; byName: string | null } {
  const text = category.toLowerCase().trim();
  const hit = CATEGORY_WORDS.find(([test]) => test.test(text));
  if (hit) return { keys: hit[1], byName: null };
  return { keys: ['commercial', 'service', 'office', 'production', 'healthcare', 'catering'], byName: text.split(/\s+/)[0] || text };
}

const pretty = (key: string) => key.split('.').pop()!.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());

function geoapifyBusiness(feature: any, wanted: string[]): FoundBusiness | null {
  const info = feature?.properties || {};
  const raw = info.datasource?.raw || {};
  const name = String(info.name || raw.name || '').trim();
  const lat = Number(info.lat ?? feature?.geometry?.coordinates?.[1]);
  const lon = Number(info.lon ?? feature?.geometry?.coordinates?.[0]);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const first = (...values: unknown[]) => { const value = values.find((item) => typeof item === 'string' && item.trim()); return value ? String(value).split(';')[0].trim() : null; };
  const categories: string[] = Array.isArray(info.categories) ? info.categories : [];
  const own = categories.filter((key) => wanted.some((want) => key === want || key.startsWith(`${want}.`))).sort((a, b) => b.length - a.length)[0] || categories.sort((a, b) => b.length - a.length)[0];
  const address = first(info.address_line2, info.formatted) || '';
  return {
    businessName: name,
    address: address.replace(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},\\s*`), ''),
    latitude: lat,
    longitude: lon,
    rating: 0,
    reviewCount: 0,
    website: first(info.website, info.contact?.website, raw.website, raw['contact:website'], raw.url),
    phone: first(info.contact?.phone, info.phone, raw.phone, raw['contact:phone'], raw['contact:mobile']),
    email: first(info.contact?.email, info.email, raw.email, raw['contact:email']),
    category: own ? pretty(own) : null,
    city: first(info.city, info.town, info.village, info.county, info.state),
    country: first(info.country),
    mapLink: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`.trim())}`,
  };
}

export function plainGeoapifyError(status: number, message: string) {
  if (status === 401 || status === 403) return 'Geoapify refused the key (check GEOAPIFY_API_KEY in Vercel)';
  if (status === 429) return 'the free Geoapify daily limit was reached; it resets tomorrow';
  return `Geoapify search failed (${status}${message ? `: ${message.slice(0, 80)}` : ''})`;
}

async function geoapifyGet(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } });
  if (!response.ok) {
    let message = '';
    try { message = String((await response.json())?.message || ''); } catch { /* no body */ }
    throw new Error(plainGeoapifyError(response.status, message));
  }
  return response.json();
}

// Search by city name, or inside the map area the owner is looking at. Works in any country.
export async function geoapifySearch(options: { category: string; city?: string; bounds?: MapBounds | null; limit?: number; offset?: number }): Promise<BusinessSearch> {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) throw new Error('Geoapify key is not set');
  const limit = Math.max(1, Math.min(100, Math.round(options.limit || 20)));
  const offset = Math.max(0, Math.round(options.offset || 0));
  let area: MapBounds | null = null;
  let center: { lon: number; lat: number } | null = null;
  let credits = 0;
  let placeNote = '';
  if (options.bounds) {
    const { west, south, east, north } = options.bounds;
    if (![west, south, east, north].every(Number.isFinite) || east <= west || north <= south) throw new Error('The map area was not valid');
    if (east - west > 6 || north - south > 6) throw new Error('Zoom in closer first: search works on a city or region, not a whole country at once');
    area = { west: Math.max(-180, west), south: Math.max(-85, south), east: Math.min(180, east), north: Math.min(85, north) };
  } else {
    const city = String(options.city || '').trim();
    if (!city) throw new Error('Type a city or use the map area');
    const found: any = await geoapifyGet(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(city)}&format=json&limit=1&lang=en&apiKey=${key}`);
    credits += 1;
    const place = found?.results?.[0];
    if (!place || !Number.isFinite(Number(place.lat))) throw new Error(`Could not find a place called "${city}"`);
    center = { lon: Number(place.lon), lat: Number(place.lat) };
    const box = place.bbox;
    const usable = box && [box.lon1, box.lat1, box.lon2, box.lat2].every((value: unknown) => Number.isFinite(Number(value))) && Math.abs(box.lon2 - box.lon1) <= 6 && Math.abs(box.lat2 - box.lat1) <= 6 && Math.abs(box.lon2 - box.lon1) > 0.005;
    // A city has its own outline; an address or a tiny place gets a 10 km box around it.
    area = usable
      ? { west: Math.min(box.lon1, box.lon2), south: Math.min(box.lat1, box.lat2), east: Math.max(box.lon1, box.lon2), north: Math.max(box.lat1, box.lat2) }
      : { west: center.lon - 0.1, south: center.lat - 0.09, east: center.lon + 0.1, north: center.lat + 0.09 };
    placeNote = String(place.formatted || city);
  }
  center = center || { lon: (area.west + area.east) / 2, lat: (area.south + area.north) / 2 };
  const wanted = geoapifyCategories(options.category);
  const query = [
    `categories=${wanted.keys.join(',')}`,
    'conditions=named',
    `filter=rect:${area.west},${area.south},${area.east},${area.north}`,
    `bias=proximity:${center.lon},${center.lat}`,
    `limit=${limit}`,
    `offset=${offset}`,
    'lang=en',
    wanted.byName ? `name=${encodeURIComponent(wanted.byName)}` : '',
    `apiKey=${key}`,
  ].filter(Boolean).join('&');
  const data: any = await geoapifyGet(`https://api.geoapify.com/v2/places?${query}`);
  const features: any[] = Array.isArray(data?.features) ? data.features : [];
  credits += Math.max(1, Math.ceil(features.length / 20));
  const seen = new Set<string>();
  const businesses = features.map((feature) => geoapifyBusiness(feature, wanted.keys)).filter((item): item is FoundBusiness => {
    if (!item) return false;
    const id = `${item.businessName.toLowerCase()}|${item.latitude?.toFixed(4)}|${item.longitude?.toFixed(4)}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const notes = [
    placeNote ? `Searched in ${placeNote}.` : 'Searched inside the map area.',
    wanted.byName ? `The map data has no category for "${options.category}", so businesses with "${wanted.byName}" in their name were searched instead.` : '',
    'Free Geoapify search (OpenStreetMap data): no ratings, and phone or website only where listed.',
  ].filter(Boolean).join(' ');
  return { businesses, source: 'geoapify', note: notes, area, hasMore: features.length >= limit, credits };
}

// Which search answers: Geoapify when its key is set (free, worldwide), Google only when chosen with
// PLACES_PROVIDER=google, and the plain OpenStreetMap search as the last fallback.
export async function searchBusinesses(options: { category: string; city?: string; bounds?: MapBounds | null; limit?: number; offset?: number }): Promise<BusinessSearch> {
  const provider = String(process.env.PLACES_PROVIDER || '').toLowerCase();
  const limit = options.limit || 20;
  const city = String(options.city || '').trim();
  if (process.env.GEOAPIFY_API_KEY && provider !== 'google' && provider !== 'openstreetmap') {
    try {
      return await geoapifySearch(options);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Geoapify search failed';
      // Problems the owner must fix or act on are reported, not hidden behind a weaker search.
      if (!city || /Zoom in|map area|Could not find a place|Type a city/.test(reason)) throw new Error(reason);
      const businesses = await osmSearch(options.category, city, Math.min(limit, 10));
      return { businesses, source: 'openstreetmap', note: `${reason}, so the basic OpenStreetMap search was used (fewer listings).` };
    }
  }
  if (!city) throw new Error('Searching the map area needs the free Geoapify key (GEOAPIFY_API_KEY in Vercel). Type a city instead.');
  if (provider === 'openstreetmap') return { businesses: await osmSearch(options.category, city, Math.min(limit, 10)), source: 'openstreetmap', note: 'Basic OpenStreetMap search (fewer listings, no ratings).' };
  return findBusinessesClassic(options.category, city, Math.min(limit, 10));
}

async function findBusinessesClassic(category: string, city: string, limit = 8): Promise<BusinessSearch> {
  try {
    return { businesses: await googleSearch(category, city, limit), source: 'google', note: null };
  } catch (error) {
    const reason = plainPlacesError(error instanceof Error ? error.message : '');
    const businesses = await osmSearch(category, city, limit + 2);
    return { businesses: businesses.slice(0, limit), source: 'openstreetmap', note: `${reason}, so the free OpenStreetMap search was used (fewer listings, no ratings).` };
  }
}

// Used by the Lead Research Agent in the Master chat.
export async function findBusinesses(category: string, city: string, limit = 8): Promise<BusinessSearch> {
  return searchBusinesses({ category, city, limit });
}
