// Website scan: reads a lead's own public website (home page, plus contact and about pages when
// they exist) and reports only what is actually written there: contact emails, phone numbers,
// social links, the brand colours, light or dark design, fonts and a few plain facts about the build.
// Used by the Lead Research Agent (to complete a lead) and by Demo Creation (to work with the
// business's real colours instead of assuming them). Nothing is guessed; an unreadable site gives null.
// The file name starts with "_" so Vercel does not count it as a server function.

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
}

const AGENT = { 'User-Agent': 'Mozilla/5.0 (compatible; ClientRadarAI/1.0; website scan)', Accept: 'text/html,text/css,*/*' };

// Only ordinary public web addresses are fetched: no local, private or numeric hosts.
function safeUrl(value: string, base?: string): URL | null {
  let parsed: URL;
  try { parsed = new URL(base ? value : /^https?:\/\//i.test(value) ? value : `https://${value}`, base); } catch { return null; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  const host = parsed.hostname.toLowerCase();
  if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || /(^|\.)(localhost|local|internal|lan|home|corp)$/.test(host)) return null;
  if (parsed.port && !['80', '443'].includes(parsed.port)) return null;
  return parsed;
}

async function read(url: URL, ms: number, max: number): Promise<{ text: string; finalUrl: string } | null> {
  try {
    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(ms), redirect: 'follow', headers: AGENT });
    if (!response.ok) return null;
    return { text: (await response.text()).slice(0, max), finalUrl: String(response.url || url.toString()) };
  } catch {
    return null;
  }
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

const JUNK_EMAIL = /(\.(png|jpe?g|gif|webp|svg|css|js|woff2?)$)|sentry|wixpress|example\.|domain\.com|email\.com|yourname|your-?email|name@|user@|test@|godaddy|schema\.org|w3\.org/i;

export function findEmails(html: string, siteHost: string): string[] {
  const found = new Set<string>();
  const add = (raw: string) => {
    const email = decode(raw).trim().toLowerCase().replace(/^mailto:/, '').split('?')[0].replace(/[.,;:]+$/, '');
    if (/^[a-z0-9._%+-]{1,64}@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) && !JUNK_EMAIL.test(email) && email.length <= 100) found.add(email);
  };
  (html.match(/mailto:[^"'\s<>]+/gi) || []).forEach((item) => { try { add(decodeURIComponent(item)); } catch { add(item); } });
  (html.match(/data-cfemail="([0-9a-f]+)"/gi) || []).forEach((item) => add(cloudflareEmail(item.replace(/data-cfemail="|"/gi, ''))));
  const visible = decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' '));
  (visible.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).forEach(add);
  (visible.match(/[a-zA-Z0-9._%+-]+\s*(?:\[at\]|\(at\))\s*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || []).forEach((item) => add(item.replace(/\s*(?:\[at\]|\(at\))\s*/i, '@')));
  // Addresses on the business's own domain come first; they are the most likely to be the right contact.
  const root = siteHost.replace(/^www\./, '');
  return [...found].sort((first, second) => Number(second.endsWith(`@${root}`)) - Number(first.endsWith(`@${root}`))).slice(0, 5);
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

export async function scanWebsite(address: string | null | undefined): Promise<WebsiteScan | null> {
  if (!address) return null;
  const start = safeUrl(String(address));
  if (!start) return null;
  const home = await read(start, 5000, 400_000);
  if (!home || !/<html|<head|<body/i.test(home.text)) return null;
  const base = safeUrl(home.finalUrl) || start;
  const html = home.text;

  // Contact and about pages on the same site (at most two), and the site's own style sheets (at most three).
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)]
    .map((match) => ({ url: safeUrl(decode(match[1]), base.toString()), label: `${match[1]} ${match[2]}`.toLowerCase() }))
    .filter((item) => item.url && item.url.hostname.replace(/^www\./, '') === base.hostname.replace(/^www\./, '') && !/\.(pdf|jpe?g|png|zip|docx?)$/i.test(item.url.pathname));
  const pick = (test: RegExp) => links.find((item) => test.test(item.label))?.url || null;
  const extraPages = [pick(/contact|kontakt|get-in-touch|reach-us|enquir|inquir/), pick(/about|impressum|who-we-are|our-story|team/)]
    .filter((url): url is URL => Boolean(url)).filter((url, index, all) => url.pathname !== base.pathname && all.findIndex((other) => other.toString() === url.toString()) === index);
  const sheets = [...html.matchAll(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi)]
    .map((match) => (match[0].match(/href=["']([^"']+)["']/i) || [])[1])
    .filter((href): href is string => Boolean(href) && !/fonts\.googleapis|font-awesome|fontawesome|bootstrap-icons|swiper|slick|animate|aos\b/i.test(href))
    .map((href) => safeUrl(decode(href), base.toString())).filter((url): url is URL => Boolean(url)).slice(0, 3);
  const [pages, styles] = await Promise.all([
    Promise.all(extraPages.map((url) => read(url, 4000, 300_000))),
    Promise.all(sheets.map((url) => read(url, 4000, 400_000))),
  ]);

  const allHtml = [html, ...pages.map((page) => page?.text || '')].join('\n');
  const inlineCss = (html.match(/<style[\s\S]*?<\/style>/gi) || []).join('\n') + (html.match(/style=["'][^"']+["']/gi) || []).join('\n');
  const css = `${inlineCss}\n${styles.map((sheet) => sheet?.text || '').join('\n')}`;
  const themeColor = (html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)/i) || [])[1] || null;
  const palette = readColors(css, themeColor);
  const phones = [...new Set((allHtml.match(/href=["']tel:([^"']+)["']/gi) || []).map((item) => { try { return decodeURIComponent(item.replace(/href=["']tel:|["']/gi, '')).trim(); } catch { return ''; } }).filter((item) => item.replace(/\D/g, '').length >= 7))].slice(0, 3);
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
    pagesRead: [base.pathname || '/', ...extraPages.filter((_, index) => pages[index]).map((url) => url.pathname)],
  };
}

// One plain line for the lead's notes, so the owner can see what the scan found.
export function scanSummary(scan: WebsiteScan) {
  const parts = [
    scan.emails.length ? `email ${scan.emails[0]}` : 'no email written on the site',
    scan.accent ? `brand colour ${scan.accent}` : 'brand colour not clear',
    scan.darkDesign === null ? '' : scan.darkDesign ? 'dark design' : 'light design',
    scan.fonts.length ? `fonts ${scan.fonts.slice(0, 2).join(', ')}` : '',
    scan.platform ? `built with ${scan.platform}` : '',
    scan.mobileReady ? '' : 'not built for phones',
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
