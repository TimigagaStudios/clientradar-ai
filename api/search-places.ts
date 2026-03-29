import type { VercelRequest, VercelResponse } from '@vercel/node';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY as string;

type GoogleTextSearchResult = {
  name: string;
  formatted_address: string;
  rating?: number;
  user_ratings_total?: number;
  place_id: string;
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
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  try {
    if (!GOOGLE_PLACES_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Missing GOOGLE_PLACES_API_KEY',
      });
    }

    const { category, city } = req.body;

    if (!category || !city) {
      return res.status(400).json({
        success: false,
        error: 'Category and city are required',
      });
    }

    const query = `${category} in ${city}`;

    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&key=${GOOGLE_PLACES_API_KEY}`;

    const response = await fetch(searchUrl);
    const data = await response.json();

    if (!response.ok || data.status === 'REQUEST_DENIED') {
      return res.status(500).json({
        success: false,
        error: data.error_message || 'Google Places search request failed',
      });
    }

    const rawResults: GoogleTextSearchResult[] = data.results || [];

    const enrichedResults = await Promise.all(
      rawResults.slice(0, 10).map(async (place) => {
        try {
          const details = await fetchPlaceDetails(place.place_id);

          const website = details.website || undefined;
          const phone = details.formatted_phone_number || undefined;

          const outdatedWebsite = website ? Math.random() > 0.7 : false;

          return {
            businessName: place.name,
            address: place.formatted_address,
            rating: place.rating || 0,
            reviewCount: place.user_ratings_total || 0,
            website,
            phone,
            outdatedWebsite,
            mapLink: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          };
        } catch (detailsError) {
          console.error(`Failed to enrich place ${place.place_id}:`, detailsError);

          return {
            businessName: place.name,
            address: place.formatted_address,
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
