import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser } from './lib/auth.js';
import { processDemoJob } from './lib/demo-job-process.js';
import { normalizeStyleLevel, tierRules } from './lib/demo-ai.js';
import type { DemoStyleLevel } from './lib/demo-ai.js';

const TEMPLATE_KEYS = ['auto', 'dental', 'restaurant', 'real-estate', 'salon', 'professional-services'];

function buildPrompt(lead: any, templateKey: string, styleLevel: DemoStyleLevel) {
  return [
    'Create a polished, mobile-first demo website for this business.',
    `Business name: ${lead.business_name}`,
    `Industry: ${lead.category || 'General business'}`,
    `Location: ${lead.city || 'Not provided'}`,
    `Phone: ${lead.phone || 'Not provided'}`,
    `Email: ${lead.email || 'Not provided'}`,
    `Instagram: ${lead.instagram || 'Not provided'}`,
    `Website status: ${lead.website ? 'Existing website' : 'No website found'}`,
    `Template: ${templateKey}`,
    ...tierRules(styleLevel),
    'Do not invent medical, legal, financial, awards, pricing, review, or performance claims.',
    'Return structured website content only; the template controls layout and code.',
  ].join('\n');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Master Agent voice: turns text into natural speech with the Gemini text-to-speech model, using the same server-side key as the
// Demo Factory. The browser falls back to the device voice when this fails.
// Kept in this file on purpose: every file under api/ counts as a server function on Vercel.
// Optional settings (names only): ASSISTANT_VOICE_MODEL, ASSISTANT_VOICE.

const VOICES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'];
const MAX_CHARACTERS = 700;

// Finds the first base64 audio block anywhere in the provider's answer.
function findAudio(node: any, depth = 0): { data: string; mime: string } | null {
  if (!node || typeof node !== 'object' || depth > 8) return null;
  if (typeof node.data === 'string' && node.data.length > 200) {
    const mime = String(node.mime_type || node.mimeType || '');
    if (node.type === 'audio' || mime.startsWith('audio/')) return { data: node.data, mime: mime || 'audio/wav' };
  }
  for (const value of Array.isArray(node) ? node : Object.values(node)) {
    const found = findAudio(value, depth + 1);
    if (found) return found;
  }
  return null;
}

// The caller must already have checked the login.
async function handleSpeak(req: VercelRequest, res: VercelResponse) {
  try {
    const text = String(req.body?.text || '').replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARACTERS);
    if (!text) return res.status(400).json({ success: false, error: 'text is required' });

    const apiKey = process.env.GEMINI_API_KEY || process.env.DEMO_AI_API_KEY;
    if (!apiKey || (process.env.DEMO_AI_PROVIDER || '').toLowerCase() !== 'gemini') return res.status(501).json({ success: false, error: 'voice is not set up' });

    const model = process.env.ASSISTANT_VOICE_MODEL || 'gemini-3.8-flash-tts';
    const requested = String(req.body?.voice || process.env.ASSISTANT_VOICE || '');
    const voice = VOICES.find((name) => name.toLowerCase() === requested.toLowerCase()) || 'Sulafat';

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        model,
        input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: 'warm, calm and confident, like a trusted personal assistant' }] }] }],
        response_format: { type: 'audio' },
        generation_config: { speech_config: [{ voice }] },
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 160);
      const error = response.status === 429 ? 'free voice limit reached, try again in a minute' : `voice service returned ${response.status} for ${model}: ${detail}`;
      return res.status(response.status === 429 ? 429 : 502).json({ success: false, error });
    }

    const audio = findAudio(await response.json());
    if (!audio) return res.status(502).json({ success: false, error: `voice service returned no audio for ${model}` });

    const bytes = Buffer.from(audio.data, 'base64');
    res.setHeader('Content-Type', audio.mime.startsWith('audio/') ? audio.mime : 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Assistant-Voice', voice);
    return res.status(200).send(bytes);
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError' ? 'voice service took too long' : error instanceof Error ? error.message : 'voice error';
    return res.status(502).json({ success: false, error: message });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ success: false, error: 'Missing Supabase environment variables' });
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (req.method === 'GET') {
      const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : '';
      if (jobId) {
        // Public: this is what a client sees when opening a demo link. Only the demo itself is returned, never the lead record.
        const { data, error } = await supabase.from('demo_jobs').select('id, status, template_key, content, demo_url').eq('id', jobId).limit(1);
        if (error) return res.status(500).json({ success: false, error: error.message });
        if (!data?.[0]) return res.status(404).json({ success: false, error: 'Demo not found' });
        const { stats: _stats, aiError: _aiError, ...publicContent } = (data[0].content || {}) as Record<string, unknown>;
        return res.status(200).json({ success: true, data: { ...data[0], content: publicContent } });
      }
      if (!(await requireUser(req, res))) return;
      const { data, error } = await supabase.from('demo_jobs').select('*, leads(*)').order('created_at', { ascending: false }).limit(100);
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true, data });
    }
    if (req.method === 'POST' && req.body?.action === 'view') {
      // Public: the demo page reports that a visitor opened it. Counted in content.stats; views closer than 5 seconds apart count once.
      const viewId = typeof req.body?.jobId === 'string' ? req.body.jobId : '';
      if (!/^[0-9a-f-]{36}$/i.test(viewId)) return res.status(400).json({ success: false, error: 'jobId is required' });
      const { data: row } = await supabase.from('demo_jobs').select('id, status, content').eq('id', viewId).maybeSingle();
      if (row && row.status === 'ready' && row.content) {
        const stats = row.content.stats || {};
        const now = new Date();
        if (now.getTime() - (Date.parse(stats.lastViewedAt || '') || 0) > 5000) {
          const next = { views: (Number(stats.views) || 0) + 1, firstViewedAt: stats.firstViewedAt || now.toISOString(), lastViewedAt: now.toISOString() };
          await supabase.from('demo_jobs').update({ content: { ...row.content, stats: next } }).eq('id', viewId);
        }
      }
      return res.status(200).json({ success: true });
    }
    if (!(await requireUser(req, res))) return;

    // Master Agent voice (kept here so no extra server function is needed).
    if (req.method === 'POST' && req.body?.action === 'speak') return handleSpeak(req, res);

    if (req.method === 'POST') {
      const { leadId, jobId, action } = req.body || {};
      const templateKey = TEMPLATE_KEYS.includes(req.body?.templateKey) ? req.body.templateKey : 'auto';
      const styleLevel = normalizeStyleLevel(req.body?.styleLevel);
      if (action === 'process' && jobId) {
        const data = await processDemoJob(supabase, jobId);
        return res.status(200).json({ success: true, data });
      }
      if (!leadId) return res.status(400).json({ success: false, error: 'leadId is required' });
      const { data: lead, error: leadError } = await supabase.from('leads').select('*').eq('id', leadId).single();
      if (leadError || !lead) return res.status(404).json({ success: false, error: 'Lead not found' });
      const { data: activeJob } = await supabase.from('demo_jobs').select('id,status').eq('lead_id', leadId).in('status', ['queued', 'generating']).maybeSingle();
      if (activeJob) return res.status(409).json({ success: false, error: 'This lead already has a demo job in progress.', data: activeJob });
      const prompt = buildPrompt(lead, templateKey, styleLevel);
      const { data, error } = await supabase.from('demo_jobs').insert({ lead_id: leadId, template_key: `${templateKey}:${styleLevel}`, status: 'queued', prompt }).select().single();
      if (error) return res.status(500).json({ success: false, error: error.message });
      await supabase.from('leads').update({ demo_status: 'In Progress', updated_at: new Date().toISOString() }).eq('id', leadId);
      return res.status(201).json({ success: true, data });
    }
    if (req.method === 'DELETE') {
      // Removes every demo job of one lead and clears the lead's demo link, so a new demo can be made.
      const leadId = typeof req.query.leadId === 'string' ? req.query.leadId : (typeof req.body?.leadId === 'string' ? req.body.leadId : '');
      if (!leadId) return res.status(400).json({ success: false, error: 'leadId is required' });
      const { data: removed, error } = await supabase.from('demo_jobs').delete().eq('lead_id', leadId).select('id');
      if (error) return res.status(500).json({ success: false, error: error.message });
      const { error: leadError } = await supabase.from('leads').update({ demo_status: 'Not Started', demo_link: null, updated_at: new Date().toISOString() }).eq('id', leadId);
      if (leadError) return res.status(500).json({ success: false, error: leadError.message });
      return res.status(200).json({ success: true, data: { leadId, removedJobs: removed?.length || 0 } });
    }
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('demo-jobs API error:', error);
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Demo job server error' });
  }
}
