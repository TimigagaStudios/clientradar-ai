import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing lead id',
    });
  }

  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return res.status(500).json({
        success: false,
        error: 'Missing Supabase environment variables',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (req.method === 'PATCH') {
      const updates = req.body;

      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if ('status' in updates) payload.status = updates.status;
      if ('demoLink' in updates) payload.demo_link = updates.demoLink;
      if ('dealValue' in updates) payload.deal_value = updates.dealValue;
      if ('notes' in updates) payload.notes = updates.notes;
      if ('timeline' in updates) payload.timeline = updates.timeline;
      if ('outreachHistory' in updates) payload.outreach_history = updates.outreachHistory;

      const { data, error } = await supabase
        .from('leads')
        .update(payload)
        .eq('id', id)
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

    if (req.method === 'DELETE') {
      const { error } = await supabase.from('leads').delete().eq('id', id);

      if (error) {
        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(200).json({
        success: true,
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  } catch (error) {
    console.error('Lead detail API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}
