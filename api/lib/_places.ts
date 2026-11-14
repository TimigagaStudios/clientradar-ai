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
}

export interface BusinessSearch {
  businesses: FoundBusiness[];
  source: 'google' | 'openstreetmap';
  note: string | null;
}

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

export async function findBusinesses(category: string, city: string, limit = 8): Promise<BusinessSearch> {
  try {
    return { businesses: await googleSearch(category, city, limit), source: 'google', note: null };
  } catch (error) {
    const reason = plainPlacesError(error instanceof Error ? error.message : '');
    const businesses = await osmSearch(category, city, limit + 2);
    return { businesses: businesses.slice(0, limit), source: 'openstreetmap', note: `${reason}, so the free OpenStreetMap search was used (fewer listings, no ratings).` };
  }
}
