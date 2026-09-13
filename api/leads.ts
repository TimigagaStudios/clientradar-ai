import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return res.status(500).json({
        success: false,
        error: 'Missing Supabase environment variables',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(200).json({
        success: true,
        data,
      });
    }

    if (req.method === 'POST') {
      const lead = req.body;

      const { data, error } = await supabase
        .from('leads')
        .insert([
          {
            business_name: lead.businessName,
            category: lead.category,
            city: lead.city,
            latitude: lead.latitude ?? null,
            longitude: lead.longitude ?? null,
            rating: lead.rating,
            review_count: lead.reviewCount,
            phone: lead.phone || null,
            email: lead.email || null,
            instagram: lead.instagram || null,
            website: lead.website || null,
            outdated_website: lead.outdatedWebsite || false,
            lead_score: lead.leadScore || 0,
            priority: lead.priority,
            status: lead.status,
            demo_status: lead.demoStatus || 'Not Started',
            notes: lead.notes || '',
            demo_link: lead.demoLink || null,
            deal_value: lead.dealValue || null,
            outreach_history: lead.outreachHistory || [],
            timeline: lead.timeline || [],
          },
        ])
        .select()
        .single();

      if (error) {
        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(200).json({
        success: true,
        data,
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  } catch (error) {
    console.error('Leads API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}
