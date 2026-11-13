import type { VercelRequest, VercelResponse } from '@vercel/node';

// Master Agent voice: turns text into natural speech with the Gemini text-to-speech model, using the same server-side key as the
// Demo Factory. The browser falls back to the device voice when this fails.
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
export async function handleSpeak(req: VercelRequest, res: VercelResponse) {
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
