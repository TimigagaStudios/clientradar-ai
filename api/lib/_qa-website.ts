// Limited website evidence for QA. This is independent of the existing site
// scanner. It fetches one HTTPS page only, with no redirects or credentials.
// Only vetted, pinned public IPv4 addresses are used for the actual socket.
// A saved website is not proof it is official or that its contents are true.
import { Resolver } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { findEmails, findPhones, isOfficialWebsiteUrl } from './_website.js';

export type QaSiteEvidence = {
  status: 'available' | 'unavailable' | 'not_provided';
  checkedAt: string;
  host: string | null;
  emails: string[];
  phones: string[];
};

type Deps = {
  resolve4: (host: string) => Promise<string[]>;
  get: (url: URL, address: string) => Promise<string | null>;
  now: () => Date;
};

// Deny private, shared, link-local, multicast, reserved, documentation and
// benchmarking ranges. Reject noncanonical IPv4 and all IPv6/numeric hosts.
export function isPublicQaIpv4(address: string): boolean {
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

function resolve4(host: string): Promise<string[]> {
  const resolver = new Resolver();
  const timer = setTimeout(() => resolver.cancel(), 2500);
  return resolver.resolve4(host).finally(() => clearTimeout(timer));
}

function get(url: URL, address: string): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const finish = (value: string | null) => { if (!done) { done = true; if (deadline) clearTimeout(deadline); resolve(value); } };
    const req = request(url, {
      method: 'GET',
      headers: { 'User-Agent': 'ClientRadarAI QA website check', Accept: 'text/html' },
      // Keep the original host for HTTPS certificate verification and SNI but
      // pin the socket to the vetted address. No second DNS lookup is allowed.
      lookup: (_hostname, _options, callback) => callback(null, address, 4),
      timeout: 4000,
    }, (res) => {
      const contentType = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (res.statusCode !== 200 || contentType !== 'text/html') { res.destroy(); finish(null); return; }
      let size = 0;
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 131072) { res.destroy(); finish(null); return; }
        chunks.push(chunk);
      });
      res.on('end', () => finish(Buffer.concat(chunks).toString('utf8')));
      res.on('error', () => finish(null));
      res.on('aborted', () => finish(null));
    });
    deadline = setTimeout(() => { req.destroy(); finish(null); }, 4000);
    req.on('timeout', () => { req.destroy(); finish(null); });
    req.on('error', () => finish(null));
    req.end();
  });
}

const defaultDeps: Deps = { resolve4, get, now: () => new Date() };

export async function readQaWebsite(raw: unknown, deps: Deps = defaultDeps): Promise<QaSiteEvidence> {
  const checkedAt = deps.now().toISOString();
  const unavailable = (status: 'unavailable' | 'not_provided', host: string | null = null): QaSiteEvidence => ({ status, checkedAt, host, emails: [], phones: [] });
  if (typeof raw !== 'string' || !raw.trim()) return unavailable('not_provided');
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`); }
  catch { return unavailable('unavailable'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || isIP(host) || !isOfficialWebsiteUrl(url.toString())) return unavailable('unavailable');
  // No queries, path, fragment, cookies, authorization, redirects or links.
  url = new URL(`https://${host}/`);
  try {
    const addresses = await deps.resolve4(host);
    if (!Array.isArray(addresses) || !addresses.length || addresses.length > 32 || addresses.some((address) => !isPublicQaIpv4(address))) return unavailable('unavailable', host);
    const html = await deps.get(url, addresses[0]);
    if (typeof html !== 'string' || !html) return unavailable('unavailable', host);
    return { status: 'available', checkedAt, host, emails: findEmails(html, host), phones: findPhones(html) };
  } catch {
    return unavailable('unavailable', host);
  }
}
