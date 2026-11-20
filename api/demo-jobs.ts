import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, requireOwner } from './lib/auth.js';
import { processDemoJob } from './lib/demo-job-process.js';
import { normalizeNewStyleLevel, tierRules } from './lib/demo-ai.js';
import type { DemoStyleLevel } from './lib/demo-ai.js';
import { applyOwnerCorrection } from './lib/_demo-qa.js';
import { checkDemoWithSources, evidenceDemoStatus, recordDemoCheck } from './lib/_qa-demo-agent.js';

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
    `Website address: ${lead.website ? 'Provided; availability not yet known' : 'Not provided'}`,
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
        const { stats: _stats, aiError: _aiError, qa: _qa, websiteAnalysis: _websiteAnalysis, ...publicContent } = (data[0].content || {}) as Record<string, unknown>;
        return res.status(200).json({ success: true, data: { ...data[0], content: publicContent } });
      }
      if (!(await requireOwner(req, res))) return;
      if (process.env.API_AUTH_DISABLED === 'true') return res.status(403).json({ success: false, error: 'Private demo reviews require authentication.' });
      const offsetValue = Number(req.query.offset || 0);
      const offset = Number.isInteger(offsetValue) && offsetValue >= 0 ? offsetValue : 0;
      const { data, error } = await supabase.from('demo_jobs').select('*, leads(*)').order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 99);
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true, data: (data || []).map((job: any) => ({ ...job, qaStatus: evidenceDemoStatus(job.content, job.leads) })) });
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
          // If content changed after our read, drop this count rather than
          // overwrite newer demo text or private QA information.
          await supabase.from('demo_jobs').update({ content: { ...row.content, stats: next } }).eq('id', viewId).eq('status', 'ready').eq('content', JSON.stringify(row.content));
        }
      }
      return res.status(200).json({ success: true });
    }
    if (!(await requireUser(req, res))) return;

    // Master Agent voice (kept here so no extra server function is needed).
    if (req.method === 'POST' && req.body?.action === 'speak') return handleSpeak(req, res);

    if (req.method === 'POST' && req.body?.action === 'qa-correct') {
      if (!(await requireOwner(req, res))) return;
      if (process.env.API_AUTH_DISABLED === 'true' || req.body?.confirm !== true) return res.status(403).json({ success: false, error: 'An authenticated owner must approve this correction.' });
      const jobId = typeof req.body?.jobId === 'string' ? req.body.jobId : '';
      const path = typeof req.body?.path === 'string' ? req.body.path : '';
      const value = req.body?.value;
      if (!/^[0-9a-f-]{36}$/i.test(jobId) || typeof value !== 'string') return res.status(400).json({ success: false, error: 'Demo, field and replacement text are required.' });
      const { data: job, error: readError } = await supabase.from('demo_jobs').select('id,lead_id,status,content,leads(*)').eq('id', jobId).maybeSingle();
      if (readError) return res.status(500).json({ success: false, error: readError.message });
      if (!job) return res.status(404).json({ success: false, error: 'Demo not found.' });
      if (job.status !== 'ready' || evidenceDemoStatus(job.content, job.leads) !== 'checked' || job.content?.qa?.fingerprint !== req.body?.fingerprint) return res.status(409).json({ success: false, error: 'The review is not current. Recheck before editing.' });
      const issueMatches = (issue: any) => issue?.path === path || (issue?.code === 'missing_contact' && issue?.path === 'contact' && ['contact.email', 'contact.phone'].includes(path)) || (issue?.code === 'sample_showcase' && issue?.path === 'showcase' && /^showcase\.items\.(?:0|[1-9]\d?)\.(?:title|subtitle|detail)$/.test(path));
      if (!Array.isArray(job.content.qa.issues) || !job.content.qa.issues.some(issueMatches)) return res.status(400).json({ success: false, error: 'This field is not part of the current review.' });
      let corrected: Record<string, unknown>;
      try { corrected = applyOwnerCorrection(job.content, path, value); } catch (error) { return res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Invalid correction.' }); }
      const content = await checkDemoWithSources(corrected, job.leads);
      if (content.qa && typeof content.qa === 'object') (content.qa as Record<string, unknown>).fixes = [{ path, description: 'Owner approved and supplied the replacement text.' }];
      const { data: saved, error: saveError } = await supabase.from('demo_jobs').update({ content }).eq('id', jobId).eq('status', 'ready').eq('content', JSON.stringify(job.content)).select('id');
      if (saveError) return res.status(500).json({ success: false, error: saveError.message });
      if (!saved?.length) return res.status(409).json({ success: false, error: 'Demo changed during correction. Recheck and try again.' });
      await recordDemoCheck(jobId, job.lead_id || null, content);
      return res.status(200).json({ success: true, data: { id: jobId, qaStatus: evidenceDemoStatus(content, job.leads), qa: content.qa } });
    }

    if (req.method === 'POST' && req.body?.action === 'qa-recheck') {
      if (!(await requireOwner(req, res))) return;
      if (process.env.API_AUTH_DISABLED === 'true') return res.status(403).json({ success: false, error: 'Private demo reviews require authentication.' });
      const jobId = typeof req.body?.jobId === 'string' ? req.body.jobId : '';
      if (!/^[0-9a-f-]{36}$/i.test(jobId)) return res.status(400).json({ success: false, error: 'jobId is required' });
      const { data: job, error: readError } = await supabase.from('demo_jobs').select('id,lead_id,status,content,leads(*)').eq('id', jobId).maybeSingle();
      if (readError) return res.status(500).json({ success: false, error: readError.message });
      if (!job) return res.status(404).json({ success: false, error: 'Demo not found' });
      if (job.status !== 'ready') return res.status(409).json({ success: false, error: 'Only ready demos can be checked.' });
      const content = await checkDemoWithSources(job.content, job.leads, { fixWhitespace: req.body?.qaMinor === true && process.env.API_AUTH_DISABLED !== 'true' });
      const { data: saved, error: saveError } = await supabase.from('demo_jobs').update({ content }).eq('id', jobId).eq('status', 'ready').eq('content', JSON.stringify(job.content)).select('id');
      if (saveError) return res.status(500).json({ success: false, error: saveError.message });
      if (!saved?.length) return res.status(409).json({ success: false, error: 'Demo changed during the check. Please try again.' });
      await recordDemoCheck(jobId, job.lead_id || null, content);
      return res.status(200).json({ success: true, data: { id: jobId, qaStatus: evidenceDemoStatus(content, job.leads), qa: content.qa } });
    }

    if (req.method === 'POST') {
      if (!(await requireOwner(req, res))) return;
      const { leadId, jobId, action } = req.body || {};
      if (process.env.API_AUTH_DISABLED === 'true' || req.body?.confirm !== true) return res.status(403).json({ success: false, error: 'An authenticated owner must approve demo creation or retry.' });
      const templateKey = TEMPLATE_KEYS.includes(req.body?.templateKey) ? req.body.templateKey : 'auto';
      const styleLevel = normalizeNewStyleLevel(req.body?.styleLevel);
      if (action === 'process' && jobId) {
        const data = await processDemoJob(supabase, jobId, { qaMinor: req.body?.qaMinor === true && process.env.API_AUTH_DISABLED !== 'true' });
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
