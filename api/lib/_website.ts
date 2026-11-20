// Website scan: reads a lead's own public website (home page, plus contact and about pages when
// they exist) and reports only what is actually written there: contact emails, phone numbers,
// social links, the brand colours, light or dark design, fonts and a few plain facts about the build.
// Used by the Lead Research Agent (to complete a lead) and by Demo Creation (to work with the
// business's real colours instead of assuming them). Nothing is guessed; an unreadable site gives null.
// The file name starts with "_" so Vercel does not count it as a server function.

import { findImages } from './_photos.js';
import { safeWebGet } from './_safe-web.js';
import { discoverLinkedPages, withoutBlocks, type SiteMapLink } from './_site-map.js';
import { parseRobots, robotsAllows } from './_robots.js';

export type SitePageEvidence = { host: string; path: string; title: string | null; heading: string | null; emails: string[]; phones: string[] };

export interface WebsiteScan {
  url: string;
  title: string | null;
  description: string | null;
  heading: string | null;
  emails: string[];
  phones: string[];
  instagram: string | null;
  facebook: string | null;
  colors: string[];
  accent: string | null;
  darkDesign: boolean | null;
  fonts: string[];
  platform: string | null;
  mobileReady: boolean;
  secure: boolean;
  pagesRead: string[];
  linkedPages: SiteMapLink[];
  sourcePages: SitePageEvidence[];
  extraPagesStatus: 'not_requested' | 'no_candidates' | 'robots_unavailable' | 'attempted';
  images: string[]; // pictures found on the business's own pages
}

const AGENT = 'Mozilla/5.0 (compatible; ClientRadarAI/1.0; website scan)';

// Social profiles, third-party directories, booking portals, map links and shorteners are NOT a business's own official website.
const NON_OFFICIAL_HOST = /(?:^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com|linkedin\.com|twitter\.com|x\.com|tiktok\.com|youtube\.com|youtu\.be|pinterest\.com|snapchat\.com|reddit\.com|yelp\.[a-z.]+|tripadvisor\.[a-z.]+|yellowpages\.[a-z.]+|yell\.com|trustpilot\.com|foursquare\.com|angi\.com|homeadvisor\.com|thumbtack\.com|houzz\.com|bark\.com|checkatrade\.com|nextdoor\.com|bbb\.org|booking\.com|expedia\.com|airbnb\.[a-z.]+|agoda\.com|hotels\.com|opentable\.com|ubereats\.com|doordash\.com|deliveroo\.[a-z.]+|just-eat\.[a-z.]+|grubhub\.com|linktr\.ee|beacons\.ai|bit\.ly|tinyurl\.com|t\.co|goo\.gl|wa\.me|whatsapp\.com|t\.me|telegram\.me|google\.[a-z.]+|maps\.apple\.com)$/i;

// Only ordinary public web addresses are fetched: no local, private or numeric hosts.
function safeUrl(value: string, base?: string): URL | null {
  let parsed: URL;
  try { parsed = new URL(base ? value : /^https?:\/\//i.test(value) ? value : `https://${value}`, base); } catch { return null; }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
  const host = parsed.hostname.toLowerCase();
  if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || /(^|\.)(localhost|local|internal|lan|home|corp)$/.test(host)) return null;
  if (parsed.port) return null;
  return parsed;
}

export function isOfficialWebsiteUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  const parsed = safeUrl(String(value).trim());
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase().replace(/^(?:www|m|mobile)\./, '');
  return !NON_OFFICIAL_HOST.test(host);
}

async function read(url: URL, ms: number, max: number, siteHost: string, type: 'text/html' | 'text/css'): Promise<{ text: string; finalUrl: string } | null> {
  try {
    return await safeWebGet(url, { timeoutMs: ms, maxBytes: max, types: [type], agent: AGENT, allowHttp: true, siteHost });
  } catch { return null; }
}

const decode = (value: string) => value.replace(/&amp;/g, '&').replace(/&#64;|&#x40;/gi, '@').replace(/&#46;|&#x2e;/gi, '.').replace(/&nbsp;/g, ' ').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');

// Cloudflare hides emails as a hex string; this turns them back into the written address.
function cloudflareEmail(hex: string) {
  try {
    const key = parseInt(hex.slice(0, 2), 16);
    let out = '';
    for (let index = 2; index < hex.length; index += 2) out += String.fromCharCode(parseInt(hex.slice(index, index + 2), 16) ^ key);
    return out;
  } catch { return ''; }
}

const JUNK_EMAIL = /(\.(png|jpe?g|gif|webp|avif|ico|svg|css|js|woff2?|pdf|mp4)$)|^(no-?reply|donotreply|mailer-daemon)@|@[23]x\.|sentry|wixpress|example\.|domain\.com|email\.com|yourname|your-?email|name@|user@|test@|godaddy|schema\.org|w3\.org/i;

export function isValidContactEmail(raw: unknown): boolean {
  const email = decode(String(raw || '')).trim().toLowerCase().replace(/^mailto:/, '').split('?')[0].replace(/[.,;:]+$/, '');
  return email.length > 4 && email.length <= 100 && /^[a-z0-9._%+-]{1,64}@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) && !JUNK_EMAIL.test(email);
}

export function isValidContactPhone(raw: unknown): boolean {
  const text = decode(String(raw || '')).trim().replace(/^tel:/i, '').split(/[?;#]/)[0].trim();
  if (!text || text.length > 32) return false;
  // Reject calendar dates (2026-11-16, 16/11/2026) and decimal coordinates (34.049544).
  if (/^(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(text) || /^\d{1,2}[-/.]\d{1,2}[-/.](?:19|20)\d{2}$/.test(text)) return false;
  if (/^-?\d{1,3}\.\d{4,}$/.test(text)) return false;
  const digits = text.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return false;
  if (/^(\d)\1{6,}$/.test(digits) || /^(?:0123456|1234567)/.test(digits)) return false;
  return true;
}

// Linear-time removal of non-visible blocks and tags. Malformed unterminated
// blocks are treated as unavailable text instead of repeatedly rescanning them.
function visibleText(html: string): string {
  const lower = html.toLowerCase();
  const out: string[] = [];
  let position = 0;
  while (position < html.length) {
    const open = lower.indexOf('<', position);
    if (open < 0) { out.push(html.slice(position)); break; }
    out.push(html.slice(position, open), ' ');
    const end = lower.indexOf('>', open + 1);
    if (end < 0) break;
    const tag = lower.slice(open + 1, Math.min(end, open + 30)).match(/^\s*(script|style|svg|noscript)(?:\s|\/|$)/)?.[1];
    if (!tag) { position = end + 1; continue; }
    const close = lower.indexOf(`</${tag}`, end + 1);
    if (close < 0) break;
    const closeEnd = lower.indexOf('>', close + tag.length + 2);
    if (closeEnd < 0) break;
    position = closeEnd + 1;
  }
  return decode(out.join(' '));
}

export function findEmails(html: string, siteHost: string): string[] {
  const found = new Set<string>();
  const add = (raw: string) => {
    const email = decode(raw).trim().toLowerCase().replace(/^mailto:/, '').split('?')[0].replace(/[.,;:]+$/, '');
    if (isValidContactEmail(email)) found.add(email);
  };
  (html.match(/mailto:[^"'\s<>]+/gi) || []).forEach((item) => { try { add(decodeURIComponent(item)); } catch { add(item); } });
  (html.match(/data-cfemail="([0-9a-f]+)"/gi) || []).forEach((item) => add(cloudflareEmail(item.replace(/data-cfemail="|"/gi, ''))));
  const visible = visibleText(html);
  (visible.match(/[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,100}\.[a-zA-Z]{2,}/g) || []).forEach(add);
  (visible.match(/[a-zA-Z0-9._%+-]{1,64}\s{0,10}(?:\[at\]|\(at\))\s{0,10}[a-zA-Z0-9.-]{1,100}\.[a-zA-Z]{2,}/gi) || []).forEach((item) => add(item.replace(/\s*(?:\[at\]|\(at\))\s*/i, '@')));
  // Addresses on the business's own domain come first; they are the most likely to be the right contact.
  const root = siteHost.replace(/^www\./, '');
  return [...found].sort((first, second) => Number(second.endsWith(`@${root}`)) - Number(first.endsWith(`@${root}`))).slice(0, 5);
}

// Extracts phone numbers from tel: links first, then plainly written visible contact numbers on the page.
export function findPhones(html: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const cleaned = decode(raw).replace(/^tel:/i, '').split(/[?;#]/)[0].replace(/\s+/g, ' ').replace(/^[\s:.,;-]+|[\s:.,;-]+$/g, '');
    if (!isValidContactPhone(cleaned)) return;
    const key = cleaned.replace(/\D/g, '').slice(-9);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(cleaned);
  };
  (html.match(/href=["']tel:([^"']+)["']/gi) || []).forEach((item) => {
    try { push(decodeURIComponent(item.replace(/href=["']tel:|["']/gi, ''))); } catch { /* skip */ }
  });
  const visible = visibleText(html);
  for (const match of visible.matchAll(/(?:tel(?:ephone)?|phone|call(?:\s+us)?|mobile|cell|office|desk|ph)\s*(?:number|no\.?)?\s*[:.-]?\s*(\+?\(?\d[\d \t().-]{5,20}\d)/gi)) {
    push(match[1].split('\n')[0]);
  }
  for (const match of visible.matchAll(/(?<![\w.])(\+\d{1,3}[ \t.-]?\(?\d{1,4}\)?[ \t.-]\d{2,4}[ \t.-]\d{2,5}(?:[ \t.-]\d{1,4})?)(?![\w.])/g)) {
    push(match[1]);
  }
  for (const match of visible.matchAll(/(?<![\w.])(\(\d{2,5}\)[ \t]*\d{3,4}[ \t.-]\d{3,5})(?![\w.])/g)) {
    push(match[1]);
  }
  return out.slice(0, 3);
}

function toHex(value: string): string | null {
  const text = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  if (/^#[0-9a-f]{3}$/.test(text)) return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`;
  const rgb = text.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (!rgb) return null;
  if (rgb[4] !== undefined && parseFloat(rgb[4]) === 0) return null;
  const part = (item: string) => Math.min(255, Number(item)).toString(16).padStart(2, '0');
  return `#${part(rgb[1])}${part(rgb[2])}${part(rgb[3])}`;
}

function tone(hex: string) {
  const red = parseInt(hex.slice(1, 3), 16) / 255;
  const green = parseInt(hex.slice(3, 5), 16) / 255;
  const blue = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const light = (max + min) / 2;
  const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
  return { light, sat };
}

// Counts how often each colour is used in the site's own styles. The most used strong colour is the brand colour.
export function readColors(css: string, themeColor: string | null) {
  const counts = new Map<string, number>();
  const bump = (hex: string | null, weight: number) => { if (hex) counts.set(hex, (counts.get(hex) || 0) + weight); };
  (css.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]{5,40}\)/g) || []).forEach((item) => bump(toHex(item), 1));
  // Colours named as the brand or used on buttons and links count for more than ones used once in a corner.
  (css.match(/--[\w-]*(primary|brand|accent|main|theme)[\w-]*\s*:\s*(#[0-9a-fA-F]{3,6}\b|rgba?\([^)]{5,40}\))/gi) || []).forEach((item) => bump(toHex(item.split(':')[1] || ''), 12));
  (css.match(/(\.btn|button|\.button|a:hover|\.cta)[^{}]{0,80}\{[^}]{0,300}background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6}\b|rgba?\([^)]{5,40}\))/gi) || []).forEach((item) => bump(toHex((item.match(/background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6}\b|rgba?\([^)]{5,40}\))/i) || [])[1] || ''), 6));
  const theme = themeColor ? toHex(themeColor) : null;
  if (theme) bump(theme, 15);
  const ranked = [...counts.entries()].sort((first, second) => second[1] - first[1]).map(([hex]) => hex);
  const strong = ranked.filter((hex) => { const { light, sat } = tone(hex); return sat >= 0.35 && light >= 0.2 && light <= 0.7; });
  // Light or dark design: the background set on the page body, when it is written plainly.
  const bodyRule = css.match(/(?:^|[},\s])(?:html\s*,\s*)?body\s*(?:,[^{]*)?\{[^}]*?background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6}\b|rgba?\([^)]{5,40}\))/i);
  const bodyHex = bodyRule ? toHex(bodyRule[1]) : null;
  const darkDesign = bodyHex ? tone(bodyHex).light < 0.3 : null;
  return { accent: strong[0] || null, colors: [...new Set([...strong.slice(0, 4), ...ranked.slice(0, 4)])].slice(0, 8), darkDesign };
}

const GENERIC_FONT = /^(inherit|initial|unset|sans-serif|serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace|cursive|arial|helvetica|helvetica neue|times|times new roman|georgia|verdana|tahoma|segoe ui|roboto mono|apple color emoji|segoe ui emoji|blinkmacsystemfont|-apple-system|var\(.*|fontawesome|font awesome.*|dashicons|eticons|icomoon|swiper-icons|star|woocommerce|genericons|slick|elementor-icons.*|eicons|bootstrap-icons|material icons.*)$/i;
function readFonts(html: string, css: string) {
  const names = new Map<string, number>();
  const add = (raw: string, weight: number) => { const name = raw.replace(/["']/g, '').replace(/\+/g, ' ').trim(); if (name && name.length <= 40 && !GENERIC_FONT.test(name)) names.set(name, (names.get(name) || 0) + weight); };
  (html.match(/fonts\.googleapis\.com\/css2?\?[^"'\s>]+/gi) || []).forEach((link) => (decode(link).match(/family=([^&:;|]+)/gi) || []).forEach((item) => { try { add(decodeURIComponent(item.replace(/family=/i, '')), 5); } catch { /* skip */ } }));
  (css.match(/font-family\s*:\s*([^;}{]+)/gi) || []).forEach((rule) => add((rule.split(':')[1] || '').split(',')[0], 1));
  return [...names.entries()].sort((first, second) => second[1] - first[1]).map(([name]) => name).slice(0, 3);
}

function platformOf(html: string) {
  if (/wp-content|wp-includes/i.test(html)) return 'WordPress';
  if (/static\.wixstatic\.com|wix\.com/i.test(html)) return 'Wix';
  if (/squarespace/i.test(html)) return 'Squarespace';
  if (/cdn\.shopify\.com/i.test(html)) return 'Shopify';
  if (/webflow/i.test(html)) return 'Webflow';
  if (/godaddy|wsimg\.com/i.test(html)) return 'GoDaddy builder';
  if (/weebly/i.test(html)) return 'Weebly';
  return null;
}

const strip = (value: string | undefined | null, max: number) => (value ? decode(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, max) || null : null);

// Evidence is a small, private owner-review aid, not a verified fact or an
// instruction for the model. Only successful reads are passed to this helper.
// Extract text contacts only; links and hidden/script content are not proof.
export function evidenceFromReadPages(pages: { text: string; finalUrl: string }[]): SitePageEvidence[] {
  const result: SitePageEvidence[] = []; const seen = new Set<string>();
  for (const page of pages.slice(0, 6)) {
    let url: URL; try { url = new URL(page.finalUrl); } catch { continue; }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || url.search || url.hash || url.pathname.length > 200) continue;
    const key = `${url.origin}${url.pathname}`; if (seen.has(key)) continue; seen.add(key);
    const html = withoutBlocks(page.text.slice(0, 524288)); const lower = html.toLowerCase();
    const firstTagText = (tag: 'title' | 'h1') => {
      const start = lower.search(new RegExp(`<${tag}\\b`));
      if (start < 0) return null;
      const openEnd = lower.indexOf('>', start + tag.length + 1);
      if (openEnd < 0 || openEnd - start > 2048) return null;
      const close = lower.indexOf(`</${tag}`, openEnd + 1);
      if (close < 0 || close - openEnd > 4096 || !/^\s*>/.test(lower.slice(close + tag.length + 2, close + tag.length + 12))) return null;
      return strip(html.slice(openEnd + 1, close), 140);
    };
    const title = firstTagText('title'); const heading = firstTagText('h1');
    const visible = visibleText(html);
    const clean = (value: string | null) => value ? value.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim() || null : null;
    result.push({ host: url.hostname, path: url.pathname || '/', title: clean(title), heading: clean(heading), emails: findEmails(visible, url.hostname).slice(0, 3), phones: findPhones(visible).slice(0, 3) });
  }
  return result;
}

export async function scanWebsite(address: string | null | undefined, options: { discoverMore?: boolean } = {}): Promise<WebsiteScan | null> {
  if (!address || !isOfficialWebsiteUrl(address)) return null;
  const start = safeUrl(String(address));
  if (!start) return null;
  const home = await read(start, 6000, 524_288, start.hostname, 'text/html');
  if (!home || !/<html|<head|<body/i.test(home.text)) return null;
  if (!isOfficialWebsiteUrl(home.finalUrl)) return null;
  const base = safeUrl(home.finalUrl) || start;
  const html = home.text;

  // Contact and about pages on the same site (at most two), and the site's own style sheets (at most three).
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)]
    .map((match) => ({ url: safeUrl(decode(match[1]), base.toString()), label: `${match[1]} ${match[2]}`.toLowerCase() }))
    .filter((item) => item.url && item.url.hostname.replace(/^www\./, '') === base.hostname.replace(/^www\./, '') && !/\.(pdf|jpe?g|png|zip|docx?)$/i.test(item.url.pathname));
  const pick = (test: RegExp) => links.find((item) => test.test(item.label))?.url || null;
  const extraPages = [pick(/contact|kontakt|contacto|contatti|nous-contacter|get-in-touch|reach-us|enquir|inquir|connect/), pick(/about|impressum|imprint|who-we-are|our-story|team|location|find-us/)]
    .filter((url): url is URL => Boolean(url)).filter((url, index, all) => url.pathname !== base.pathname && all.findIndex((other) => other.toString() === url.toString()) === index);
  const sheets = [...html.matchAll(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi)]
    .map((match) => (match[0].match(/href=["']([^"']+)["']/i) || [])[1])
    .filter((href): href is string => Boolean(href) && !/fonts\.googleapis|font-awesome|fontawesome|bootstrap-icons|swiper|slick|animate|aos\b/i.test(href))
    .map((href) => safeUrl(decode(href), base.toString())).filter((url): url is URL => Boolean(url) && url!.hostname.replace(/^www\./, '') === base.hostname.replace(/^www\./, '')).slice(0, 3);
  const [pages, styles] = await Promise.all([
    Promise.all(extraPages.map((url) => read(url, 5000, 300_000, base.hostname, 'text/html'))),
    Promise.all(sheets.map((url) => read(url, 5000, 400_000, base.hostname, 'text/css'))),
  ]);

  // Additional discovery is opt-in for demo generation only. The existing
  // homepage/contact/about scan above is unchanged and is not robots-aware.
  // For these new reads, use exact-origin robots rules; do not follow page or
  // robots redirects, fetch actions/query URLs, or treat failure as consent.
  let extraPagesStatus: WebsiteScan['extraPagesStatus'] = 'not_requested';
  let additional: { text: string; finalUrl: string }[] = [];
  const alreadyRead = [base.toString(), ...pages.filter((page): page is { text: string; finalUrl: string } => Boolean(page)).map((page) => page.finalUrl)];
  if (options.discoverMore) {
    const attempted = new Set([base.pathname, ...extraPages.map((url) => url.pathname)]);
    const candidates = discoverLinkedPages(html, base, alreadyRead).filter((item) =>
      ['Services', 'Products', 'Pricing', 'Portfolio', 'Blog'].includes(item.kind) && !item.read && !attempted.has(item.path) &&
      !/(?:^|\/)(?:logout|sign-?out|delete|remove|reset|unsubscribe|checkout|cart|admin|account|auth|login|session|token|register|api)(?:\/|$|[-_.])/i.test(item.path)
    );
    if (!candidates.length) extraPagesStatus = 'no_candidates';
    else {
      const robots = await safeWebGet(new URL('/robots.txt', base.origin), { timeoutMs: 1500, maxBytes: 524288, types: ['text/plain'], agent: AGENT, allowHttp: true, siteHost: base.hostname, noRedirect: true, reportNotFound: true }).catch(() => null);
      const policy = robots ? (robots.status === 404 ? { rules: [] } : parseRobots(robots.text)) : null;
      if (!policy) extraPagesStatus = 'robots_unavailable';
      else {
        extraPagesStatus = 'attempted';
        const chosen = candidates.filter((item) => robotsAllows(policy, item.path)).slice(0, 3);
        const fetched = await Promise.all(chosen.map((item) => safeWebGet(new URL(item.path, base.origin), { timeoutMs: 2000, maxBytes: 300000, types: ['text/html'], agent: AGENT, allowHttp: true, siteHost: base.hostname, noRedirect: true }).catch(() => null)));
        additional = fetched.filter((page): page is { text: string; finalUrl: string } => Boolean(page));
      }
    }
  }
  const allReads = [home, ...pages.filter((page): page is { text: string; finalUrl: string } => Boolean(page)), ...additional];
  // New page text is review-only and does not change saved lead contacts,
  // photos or brand facts. The caller may use read page kinds as rough cues.
  const allHtml = [html, ...pages.map((page) => page?.text || '')].join('\n');
  const inlineCss = (html.match(/<style[\s\S]*?<\/style>/gi) || []).join('\n') + (html.match(/style=["'][^"']+["']/gi) || []).join('\n');
  const css = `${inlineCss}\n${styles.map((sheet) => sheet?.text || '').join('\n')}`;
  const themeColor = (html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)/i) || [])[1] || null;
  const palette = readColors(css, themeColor);
  const phones = findPhones(allHtml);
  const social = (test: RegExp) => { const match = allHtml.match(test); return match ? match[0].replace(/["'\\].*$/, '') : null; };
  return {
    url: base.toString(),
    title: strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1], 140),
    description: strip((html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i) || [])[1], 240),
    heading: strip((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1], 140),
    emails: findEmails(allHtml, base.hostname),
    phones,
    instagram: social(/https?:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]{2,40}/i),
    facebook: social(/https?:\/\/(www\.)?facebook\.com\/[A-Za-z0-9_.\-/]{2,80}/i),
    colors: palette.colors,
    accent: palette.accent,
    darkDesign: palette.darkDesign,
    fonts: readFonts(html, css),
    platform: platformOf(html),
    mobileReady: /<meta[^>]+name=["']?viewport/i.test(html),
    secure: base.protocol === 'https:',
    pagesRead: allReads.map((page) => new URL(page.finalUrl).pathname),
    linkedPages: discoverLinkedPages(html, base, allReads.map((page) => page.finalUrl)),
    sourcePages: evidenceFromReadPages(allReads),
    extraPagesStatus,
    images: findImages(allHtml, base.toString()),
  };
}

// One plain line for the lead's notes, so the owner can see what the scan found.
export function scanSummary(scan: WebsiteScan) {
  const parts = [
    scan.emails.length ? `email ${scan.emails[0]}` : 'no email written on the site',
    scan.phones.length ? `phone ${scan.phones[0]}` : 'no phone written on the site',
    scan.accent ? `brand colour ${scan.accent}` : 'brand colour not clear',
    scan.darkDesign === null ? '' : scan.darkDesign ? 'dark design' : 'light design',
    scan.fonts.length ? `fonts ${scan.fonts.slice(0, 2).join(', ')}` : '',
    scan.platform ? `built with ${scan.platform}` : '',
    scan.mobileReady ? '' : 'mobile viewport tag not detected',
    scan.secure ? '' : 'no secure connection',
  ].filter(Boolean);
  return `Website scan (${new Date().toISOString().slice(0, 10)}): ${parts.join('; ')}.`;
}

// Completes a lead from its own website: fills ONLY empty contact fields and rewrites the scan line in the notes.
export async function scanLead(supabase: any, leadId: string) {
  const { data: lead } = await supabase.from('leads').select('id, business_name, website, email, phone, instagram, notes').eq('id', leadId).maybeSingle();
  if (!lead) return { ok: false as const, error: 'Lead not found' };
  if (!lead.website) return { ok: false as const, error: 'This lead has no website to scan' };
  const scan = await scanWebsite(lead.website);
  if (!scan) return { ok: false as const, error: 'The website could not be read (it may be down, blocking visitors, or built in a way that hides its text)' };
  const filled: string[] = [];
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (!lead.email && scan.emails[0]) { patch.email = scan.emails[0]; filled.push('email'); }
  if (!lead.phone && scan.phones[0]) { patch.phone = scan.phones[0]; filled.push('phone'); }
  if (!lead.instagram && scan.instagram) { patch.instagram = scan.instagram; filled.push('instagram'); }
  const kept = String(lead.notes || '').split('\n').filter((line) => !line.startsWith('Website scan ('));
  patch.notes = [...kept, scanSummary(scan)].filter(Boolean).join('\n');
  await supabase.from('leads').update(patch).eq('id', leadId);
  return { ok: true as const, businessName: String(lead.business_name || ''), scan, filled };
}
