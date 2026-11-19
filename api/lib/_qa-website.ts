// Limited QA evidence: read the saved site's HTTPS home page only. The shared
// network helper pins public addresses and follows only bounded same-site
// redirects. A public website is not proof of ownership or factual accuracy.
import { isIP } from 'node:net';
import { findEmails, findPhones, isOfficialWebsiteUrl } from './_website.js';
import { isPublicIpv4, safeWebGet } from './_safe-web.js';

export const isPublicQaIpv4 = isPublicIpv4;

export type QaSiteEvidence = {
  status: 'available' | 'unavailable' | 'not_provided';
  checkedAt: string;
  host: string | null;
  emails: string[];
  phones: string[];
};

export async function readQaWebsite(raw: unknown): Promise<QaSiteEvidence> {
  const checkedAt = new Date().toISOString();
  const unavailable = (status: 'unavailable' | 'not_provided', host: string | null = null): QaSiteEvidence => ({ status, checkedAt, host, emails: [], phones: [] });
  if (typeof raw !== 'string' || !raw.trim()) return unavailable('not_provided');
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`); }
  catch { return unavailable('unavailable'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.port || isIP(host) || !isOfficialWebsiteUrl(url.toString())) return unavailable('unavailable');
  // Saved paths and query strings are not needed for this limited home check.
  const home = new URL(`https://${host}/`);
  try {
    const page = await safeWebGet(home, { maxBytes: 524288, timeoutMs: 6000, types: ['text/html'], agent: 'ClientRadarAI QA website check', siteHost: host });
    if (!page?.text) return unavailable('unavailable', host);
    return { status: 'available', checkedAt, host, emails: findEmails(page.text, host), phones: findPhones(page.text) };
  } catch { return unavailable('unavailable', host); }
}
