// Bounded, credential-free website fetching. A hostname is resolved and vetted
// for each hop, then the socket is pinned to a vetted IPv4 address. This helper
// deliberately supports only ordinary web ports and same-site www redirects.
import { Resolver } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { isIP } from 'node:net';

export function isPublicIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split('.').map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || (b === 88 && c === 99) || b === 168)) return false;
  if (a === 198 && ((b === 18 || b === 19) || (b === 51 && c === 100))) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

const siteKey = (host: string) => host.toLowerCase().replace(/^www\./, '');
function validUrl(url: URL, site: string, allowHttp: boolean): boolean {
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) return false;
  if (url.username || url.password || url.port || url.toString().length > 4096) return false;
  if (!host.includes('.') || isIP(host) || !/^[a-z0-9.-]+$/.test(host)) return false;
  if (/(^|\.)(localhost|local|internal|lan|home|corp)$/.test(host)) return false;
  return siteKey(host) === site;
}

async function resolvePublic(host: string, remaining: number): Promise<string | null> {
  const resolver = new Resolver();
  const timer = setTimeout(() => resolver.cancel(), Math.min(2500, remaining));
  try {
    const addresses = await resolver.resolve4(host);
    if (!Array.isArray(addresses) || !addresses.length || addresses.length > 32 || addresses.some((ip) => !isPublicIpv4(ip))) return null;
    return addresses[0];
  } catch { return null; } finally { clearTimeout(timer); }
}

type Response = { status: number; location: string; text: string | null };
function requestPage(url: URL, address: string, remaining: number, maxBytes: number, types: string[], agent: string, reportNotFound: boolean): Promise<Response | null> {
  return new Promise((resolve) => {
    let finished = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: Response | null) => { if (!finished) { finished = true; if (deadline) clearTimeout(deadline); resolve(result); } };
    const sender = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = sender(url, {
      method: 'GET', agent: false, family: 4,
      headers: { 'User-Agent': agent, Accept: types.join(','), 'Accept-Encoding': 'identity' },
      lookup: (_hostname, _options, callback) => callback(null, address, 4),
      timeout: remaining,
    }, (res) => {
      const status = res.statusCode || 0;
      const location = typeof res.headers.location === 'string' ? res.headers.location : '';
      if ([301, 302, 303, 307, 308].includes(status)) { res.destroy(); finish({ status, location, text: null }); return; }
      // Only an explicit 404 is distinct from a denial, rate limit, server or
      // network error. Opt-in callers can conservatively handle missing robots.
      if (status === 404 && reportNotFound) { res.destroy(); finish({ status, location: '', text: '' }); return; }
      const type = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const encoding = String(res.headers['content-encoding'] || 'identity').trim().toLowerCase();
      const length = Number(res.headers['content-length']);
      if (status !== 200 || !types.includes(type) || (encoding && encoding !== 'identity') || (Number.isFinite(length) && length > maxBytes)) { res.destroy(); finish(null); return; }
      let size = 0;
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) { res.destroy(); finish(null); return; }
        chunks.push(chunk);
      });
      res.on('end', () => finish({ status, location: '', text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', () => finish(null));
      res.on('aborted', () => finish(null));
    });
    deadline = setTimeout(() => { req.destroy(); finish(null); }, remaining);
    req.on('timeout', () => { req.destroy(); finish(null); });
    req.on('error', () => finish(null));
    req.end();
  });
}

export async function safeWebGet(input: URL, options: { maxBytes: number; timeoutMs: number; types: string[]; agent: string; allowHttp?: boolean; siteHost?: string; noRedirect?: boolean; reportNotFound?: boolean }): Promise<{ text: string; finalUrl: string; status?: number } | null> {
  const start = Date.now();
  const site = siteKey(options.siteHost || input.hostname);
  const seen = new Set<string>();
  let url = new URL(input.toString());
  for (let hop = 0; hop <= 3; hop += 1) {
    // Do not transmit saved query strings, fragments or credentials.
    if (!validUrl(url, site, options.allowHttp === true)) return null;
    url.search = ''; url.hash = '';
    const addressKey = url.toString();
    if (seen.has(addressKey)) return null;
    seen.add(addressKey);
    let remaining = options.timeoutMs - (Date.now() - start);
    if (remaining <= 0) return null;
    const ip = await resolvePublic(url.hostname, remaining);
    if (!ip) return null;
    remaining = options.timeoutMs - (Date.now() - start);
    if (remaining <= 0) return null;
    const response = await requestPage(url, ip, remaining, options.maxBytes, options.types, options.agent, options.reportNotFound === true);
    if (!response) return null;
    if (response.status === 404 && options.reportNotFound) return { text: '', finalUrl: url.toString(), status: 404 };
    if (response.status === 200 && response.text !== null) return { text: response.text, finalUrl: url.toString() };
    if (options.noRedirect || !response.location || hop === 3) return null;
    let next: URL;
    try { next = new URL(response.location, url); } catch { return null; }
    // Do not downgrade a secure connection or follow an off-site redirect.
    if (url.protocol === 'https:' && next.protocol !== 'https:') return null;
    url = next;
  }
  return null;
}
