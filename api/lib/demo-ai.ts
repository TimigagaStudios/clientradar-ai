type DemoLead = {
  business_name: string;
  category?: string;
  city?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  website?: string;
};

export async function generateDemoContent(lead: DemoLead, templateKey: string, prompt: string) {
  const provider = (process.env.DEMO_AI_PROVIDER || 'fallback').toLowerCase();
  const apiKey = process.env.DEMO_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (provider === 'fallback' || !apiKey) return null;

  const model = process.env.DEMO_AI_MODEL || 'gemini-2.0-flash';
  const instruction = `${prompt}\n\nReturn only valid JSON with this shape: {"hero":{"eyebrow":"","title":"","description":"","cta":""},"sections":[{"title":"","body":""}],"disclaimer":""}. Do not invent claims.`;
  let response: Response;

  if (provider === 'gemini') {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: instruction }] }] }),
    });
  } else if (provider === 'openrouter') {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, temperature: 0.3, messages: [{ role: 'user', content: instruction }] }),
    });
  } else {
    throw new Error(`Unsupported DEMO_AI_PROVIDER: ${provider}`);
  }

  if (!response.ok) throw new Error(`Demo AI provider returned HTTP ${response.status}`);
  const body = await response.json();
  const text = provider === 'gemini' ? body.candidates?.[0]?.content?.parts?.[0]?.text : body.choices?.[0]?.message?.content;
  if (!text) throw new Error('Demo AI provider returned no content');
  const jsonText = String(text).replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const parsed = JSON.parse(jsonText);
  return { ...parsed, businessName: lead.business_name, category: lead.category || 'Business', city: lead.city || '', templateKey, contact: { phone: lead.phone || null, email: lead.email || null, instagram: lead.instagram || null }, disclaimer: parsed.disclaimer || 'Demo concept content. Confirm business details before production use.' };
}
