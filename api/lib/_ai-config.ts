// Shared free-first AI configuration. A key with no provider setting defaults to Gemini; an explicit
// provider value is respected. The key is only read server-side and is never returned to the browser.
export function aiConfig() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.DEMO_AI_API_KEY || '';
  const configured = String(process.env.DEMO_AI_PROVIDER || '').trim().toLowerCase();
  const provider = configured || (apiKey ? 'gemini' : 'fallback');
  return { apiKey, provider };
}

export function aiUnavailableReason(provider: string, apiKey: string, required = 'gemini') {
  if (!apiKey) return 'No Gemini API key is configured in Vercel (GEMINI_API_KEY or DEMO_AI_API_KEY).';
  if (provider !== required) return `DEMO_AI_PROVIDER is set to ${provider}; this action needs ${required}.`;
  return '';
}
