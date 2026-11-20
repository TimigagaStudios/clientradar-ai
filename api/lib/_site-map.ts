// Limited, private discovery from HTML already fetched by the existing scanner.
// This does not fetch any new page, execute scripts, or prove linked content.
export type SiteMapLink = { path: string; label: string; kind: string; read: boolean };
const MAX_LINKS = 20;
const MAX_ANCHORS = 500;
const kinds: [string, RegExp][] = [
  ['About', /\b(about|our story|who we are|team)\b/],
  ['Services', /\b(service|services|what we do)\b/],
  ['Products', /\b(product|products|shop|store)\b/],
  ['Pricing', /\b(pricing|prices|plans)\b/],
  ['Contact', /\b(contact|enquiry|inquiry|get in touch)\b/],
  ['Portfolio', /\b(portfolio|projects|gallery|work|listings|properties)\b/],
  ['Blog', /\b(blog|news|articles|insights)\b/],
  ['Booking', /\b(book|booking|appointments|reservation)\b/],
];
const text = (value: string) => value.replace(/<[^>]{0,512}>/g, ' ').replace(/&amp;/gi, '&').replace(/&nbsp;/gi, ' ').replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

// Drop non-visible script/style blocks in linear time before looking for links.
function withoutBlocks(html: string): string {
  const lower = html.toLowerCase(); const out: string[] = []; let position = 0;
  while (position < html.length) {
    const open = lower.indexOf('<', position);
    if (open < 0) { out.push(html.slice(position)); break; }
    out.push(html.slice(position, open));
    const end = lower.indexOf('>', open + 1);
    if (end < 0) break;
    const tag = lower.slice(open + 1, Math.min(end, open + 30)).match(/^\s*(script|style|svg|noscript)(?:\s|\/|$)/)?.[1];
    if (!tag) { out.push(html.slice(open, end + 1)); position = end + 1; continue; }
    const close = lower.indexOf(`</${tag}`, end + 1);
    if (close < 0) break;
    const closeEnd = lower.indexOf('>', close + tag.length + 2);
    if (closeEnd < 0) break;
    position = closeEnd + 1;
  }
  return out.join('');
}

export function discoverLinkedPages(html: string, base: URL, readUrls: string[]): SiteMapLink[] {
  const read = new Set(readUrls); const result: SiteMapLink[] = []; const seen = new Set<string>();
  const add = (url: URL, label: string, kind: string) => {
    const path = url.pathname || '/';
    if (path.length > 200 || seen.has(path)) return;
    seen.add(path); result.push({ path, label, kind, read: read.has(`${url.origin}${path}`) });
  };
  add(base, base.pathname === '/' ? 'Home' : 'Starting page', base.pathname === '/' ? 'Home' : 'Other');
  const input = withoutBlocks(html.slice(0, 524288));
  let inspected = 0;
  for (const match of input.matchAll(/<a\b[^>]{0,2048}\bhref=["']([^"']{1,2048})["'][^>]{0,2048}>([\s\S]{0,300}?)<\/a\s*>/gi)) {
    if (++inspected > MAX_ANCHORS) break;
    const href = match[1].replace(/&amp;/gi, '&').trim();
    if (href.startsWith('#')) continue;
    let url: URL; try { url = new URL(href, base); } catch { continue; }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || url.search || url.origin !== base.origin) continue;
    if (/\.(?:pdf|zip|docx?|xlsx?|jpe?g|png|webp|gif|svg|mp4|xml|json)$/i.test(url.pathname)) continue;
    const label = text(match[2]); if (!label) continue;
    const clue = `${url.pathname.replace(/[-_/]+/g, ' ')} ${label}`.toLowerCase();
    const kind = kinds.find(([, pattern]) => pattern.test(clue))?.[0] || 'Other';
    add(url, label, kind);
  }
  // Favor important recognized page types but do not invent missing pages.
  const rank = (kind: string) => kinds.findIndex(([name]) => name === kind) + 1;
  const first = result.shift();
  result.sort((a, b) => (a.kind === 'Other' ? 99 : rank(a.kind)) - (b.kind === 'Other' ? 99 : rank(b.kind)));
  return (first ? [first, ...result] : result).slice(0, MAX_LINKS);
}
