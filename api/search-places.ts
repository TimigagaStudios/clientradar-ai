import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './lib/auth.js';
import { recordTask } from './lib/_team.js';
import { checkWebsite, osmSearch, plainPlacesError } from './lib/_places.js';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY as string;

type GoogleTextSearchResult = {
  name: string;
  formatted_address: string;
  rating?: number;
  user_ratings_total?: number;
  place_id: string;
  geometry?: { location?: { lat?: number; lng?: number } };
};

async function fetchPlaceDetails(placeId: string) {
  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId
  )}&fields=website,formatted_phone_number&key=${GOOGLE_PLACES_API_KEY}`;

  const response = await fetch(detailsUrl);
  const data = await response.json();

  if (!response.ok || data.status === 'REQUEST_DENIED') {
    throw new Error(data.error_message || 'Place details request failed');
  }

  return data.result || {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireUser(req, res))) return;
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  try {
    const { category, city } = req.body;

    if (!category || !city) {
      return res.status(400).json({
        success: false,
        error: 'Category and city are required',
      });
    }

    // When Google Places cannot be used (no key, or billing not switched on), the free
    // OpenStreetMap search answers instead: fewer listings, no ratings, nothing invented.
    const useFreeSearch = async (reason: string) => {
      const found = await osmSearch(String(category), String(city));
      const results = await Promise.all(found.map(async (item) => {
        const check = await checkWebsite(item.website);
        return { ...item, website: item.website || undefined, phone: item.phone || undefined, outdatedWebsite: check.outdated, websiteNote: check.note || undefined };
      }));
      await recordTask({
        agentKey: 'lead-research',
        title: `Find ${category} in ${city}`,
        status: 'done',
        summary: `Searched "${category} in ${city}" with the free OpenStreetMap search and found ${results.length}.`,
        input: { category, city },
        output: { found: results.length, source: 'openstreetmap', googleError: reason },
      });
      return res.status(200).json({ success: true, data: results, source: 'openstreetmap', note: `${reason}; the free OpenStreetMap search was used.` });
    };

    if (!GOOGLE_PLACES_API_KEY) return await useFreeSearch('Google Places key is not set');

    const query = `${category} in ${city}`;

    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&key=${GOOGLE_PLACES_API_KEY}`;

    const response = await fetch(searchUrl);
    const data = await response.json();

    if (!response.ok || data.status === 'REQUEST_DENIED') {
      return await useFreeSearch(plainPlacesError(data.error_message || 'Google Places search request failed'));
    }

    const rawResults: GoogleTextSearchResult[] = data.results || [];

    const enrichedResults = await Promise.all(
      rawResults.slice(0, 10).map(async (place) => {
        try {
          const details = await fetchPlaceDetails(place.place_id);

          const website = details.website || undefined;
          const phone = details.formatted_phone_number || undefined;

          const websiteCheck = await checkWebsite(website);
          const outdatedWebsite = websiteCheck.outdated;

          return {
            businessName: place.name,
            address: place.formatted_address,
            latitude: place.geometry?.location?.lat,
            longitude: place.geometry?.location?.lng,
            rating: place.rating || 0,
            reviewCount: place.user_ratings_total || 0,
            website,
            phone,
            outdatedWebsite,
            websiteNote: websiteCheck.note || undefined,
            mapLink: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          };
        } catch (detailsError) {
          console.error(`Failed to enrich place ${place.place_id}:`, detailsError);

          return {
            businessName: place.name,
            address: place.formatted_address,
            latitude: place.geometry?.location?.lat,
            longitude: place.geometry?.location?.lng,
            rating: place.rating || 0,
            reviewCount: place.user_ratings_total || 0,
            website: undefined,
            phone: undefined,
            outdatedWebsite: false,
            mapLink: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          };
        }
      })
    );

    await recordTask({
      agentKey: 'lead-research',
      title: `Find ${category} in ${city}`,
      status: 'done',
      summary: `Searched "${category} in ${city}" and found ${enrichedResults.length} ${enrichedResults.length === 1 ? 'business' : 'businesses'}.`,
      input: { category, city },
      output: { found: enrichedResults.length },
    });

    return res.status(200).json({
      success: true,
      data: enrichedResults,
    });
  } catch (error) {
    console.error('search-places error:', error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
