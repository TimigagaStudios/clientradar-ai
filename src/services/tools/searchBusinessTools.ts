// src/services/tools/searchBusinessTool.ts

import { Tool } from '../toolRegistry';

export const searchBusinessTool: Tool = {
  name: 'search_business',
  description: 'Search for business information (name, category, location). Used by the Radar and Scout Agents.',
  parameters: {
    query: 'string (business name or keyword)',
    location: 'string (optional city or area)',
  },
  execute: async (params: any) => {
    // Placeholder for now.
    // Later this can connect to Google Places, Yelp, or manual database search.

    console.log(`[Tool] search_business called with:`, params);

    return {
      success: true,
      results: [
        {
          name: 'Example Business',
          category: 'Real Estate',
          city: params.location || 'Lagos',
          website: 'example.com',
        },
      ],
    };
  },
};