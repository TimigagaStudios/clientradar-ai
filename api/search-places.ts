import type { VercelRequest, VercelResponse } from '@vercel/node';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY as string;

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

    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&key=${GOOGLE_PLACES_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.status === 'REQUEST_DENIED') {
      return res.status(500).json({
        success: false,
        error: data.error_message || 'Google Places request failed',
      });
    }

    const formattedResults = (data.results || []).map((place: any) => ({
      businessName: place.name,
      address: place.formatted_address,
      rating: place.rating || 0,
      reviewCount: place.user_ratings_total || 0,
      website: undefined,
      phone: undefined,
      outdatedWebsite: false,
      mapLink: place.place_id
        ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
        : 'https://maps.google.com',
    }));

    return res.status(200).json({
      success: true,
      data: formattedResults,
    });
  } catch (error) {
    console.error('search-places error:', error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
