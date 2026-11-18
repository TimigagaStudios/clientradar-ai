// Parse demo-writer responses without inventing or reconstructing content.
// Extract at most one complete JSON object. Repairs are limited to JSON syntax:
// trailing commas outside strings and unescaped control characters in strings.
// Truncated, ambiguous or otherwise malformed responses still fail closed.

const MAX_RESPONSE_CHARS = 250000;
function isDemoObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, any>;
  const usefulText = (part: unknown) => typeof part === 'string' && part.trim().length > 0;
  return usefulText(item.hero?.title) || usefulText(item.about?.body)
    || (Array.isArray(item.services) && item.services.some((service: any) => usefulText(service?.title) && usefulText(service?.body)));
}

function repairJsonSyntax(input: string): string {
  let output = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inString) {
      if (escaped) {
        output += ch;
        escaped = false;
      } else if (ch === '\\') {
        output += ch;
        escaped = true;
      } else if (ch === '"') {
        output += ch;
        inString = false;
      } else if (ch.charCodeAt(0) < 32) {
        output += `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`;
      } else {
        output += ch;
      }
    } else if (ch === '"') {
      output += ch;
      inString = true;
    } else if (ch === ',') {
      let next = i + 1;
      while (next < input.length && /\s/.test(input[next])) next += 1;
      if (input[next] !== '}' && input[next] !== ']') output += ch;
    } else {
      output += ch;
    }
  }
  return output;
}

function parseCandidate(candidate: string): Record<string, unknown> | null {
  for (const source of [candidate, repairJsonSyntax(candidate)]) {
    try {
      const value: unknown = JSON.parse(source);
      if (isDemoObject(value)) return value;
    } catch {
      // Never reconstruct incomplete JSON or guess what the model meant.
    }
  }
  return null;
}

function extractSingleObject(input: string): string | null {
  const start = input.indexOf('{');
  if (start < 0) return null;
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = start; i < input.length; i += 1) {
    const ch = input[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') {
      if (stack.pop() !== (ch === '}' ? '{' : '[')) return null;
      if (stack.length === 0) {
        // Do not silently choose one of several objects or a JSON array.
        const outside = input.slice(0, start) + input.slice(i + 1);
        if (/[{}\[\]]/.test(outside)) return null;
        return input.slice(start, i + 1);
      }
    }
  }
  return null;
}

export function parseDemoJson(input: unknown): Record<string, unknown> {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Demo AI provider returned no content');
  if (input.length > MAX_RESPONSE_CHARS) throw new Error('Demo AI response was too large to process safely');
  const text = input.replace(/^\uFEFF/, '').trim();
  const direct = parseCandidate(text);
  if (direct) return direct;
  const extracted = extractSingleObject(text);
  const parsed = extracted ? parseCandidate(extracted) : null;
  if (parsed) return parsed;
  throw new Error('Demo AI response was not a complete usable JSON object');
}

export function demoResponseText(provider: string, body: any): string {
  const finish = provider === 'gemini' ? body?.candidates?.[0]?.finishReason : body?.choices?.[0]?.finish_reason;
  // When a finish reason is supplied, accept only an ordinary completion.
  // Missing reasons remain compatible with providers that omit the field.
  if (finish != null && (typeof finish !== 'string' || finish.toUpperCase() !== 'STOP')) {
    throw new Error('Demo AI response was incomplete or blocked');
  }
  if (provider === 'gemini') {
    const parts = body?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.filter((part: any) => part && part.thought !== true && typeof part.text === 'string').map((part: any) => part.text).join('');
  }
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter((part: any) => part && part.type === 'text' && typeof part.text === 'string').map((part: any) => part.text).join('');
  }
  return '';
}
