// Photographs for demo websites.
// 1. The business's OWN pictures, read from its current website (shown as they are, no label needed).
// 2. Otherwise SAMPLE photographs of the business type from Unsplash (UNSPLASH_ACCESS_KEY) or,
//    when that key is not set, from Pexels (PEXELS_API_KEY),
//    always marked "Sample photo" on the page and credited to the photographer in the footer.
// A picture is never presented as the business itself unless it came from the business's own site.
// Without a website and without a key, the demo keeps its designed artwork.

export type DemoPhoto = { url: string; kind: 'own' | 'sample'; alt: string; credit?: string; link?: string; source?: 'unsplash' | 'pexels' };

const BAD = /logo|icon|sprite|avatar|pixel|badge|favicon|placeholder|loader|spinner|flag|payment|captcha|emoji|gravatar|\.svg(\?|$)|\.gif(\?|$)/i;

// Pictures on the business's own pages: the share image first, then large content images.
export function findImages(html: string, base: string): string[] {
  const found: string[] = [];
  const add = (value: string | undefined) => {
    if (!value) return;
    try {
      const url = new URL(value.replace(/&amp;/g, '&').trim(), base);
      if (url.protocol !== 'https:' || BAD.test(url.pathname) || url.toString().length > 600) return;
      if (!found.includes(url.toString())) found.push(url.toString());
    } catch { /* not a usable address */ }
  };
  add((html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)/i) || [])[1]);
  add((html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) || [])[1]);
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const width = Number((tag.match(/\bwidth=["']?(\d+)/i) || [])[1] || 0);
    const height = Number((tag.match(/\bheight=["']?(\d+)/i) || [])[1] || 0);
    if ((width && width < 300) || (height && height < 200) || BAD.test(tag)) continue;
    add((tag.match(/\b(?:data-src|data-lazy-src|src)=["']([^"']+)["']/i) || [])[1]);
    if (found.length >= 8) break;
  }
  return found.slice(0, 8);
}

const hash = (text: string) => { let value = 7; for (let index = 0; index < text.length; index += 1) value = (value * 31 + text.charCodeAt(index)) >>> 0; return value; };

const UTM = 'utm_source=clientradar_ai&utm_medium=referral';

// Unsplash: pictures are loaded from Unsplash's own addresses, the photographer and Unsplash are credited
// with links, and each picture used is reported to Unsplash, as its API guidelines ask.
async function unsplashPhotos(query: string, seed: string, count: number, key: string): Promise<DemoPhoto[]> {
  try {
    const page = 1 + (hash(seed) % 3);
    const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${Math.min(20, count + 6)}&page=${page}&orientation=landscape&content_filter=high`, { headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' }, signal: AbortSignal.timeout(7000) });
    if (!response.ok) return [];
    const photos = ((await response.json()) as any)?.results;
    if (!Array.isArray(photos)) return [];
    const usable = photos.filter((photo: any) => /^https:\/\/images\.unsplash\.com\//.test(String(photo?.urls?.regular || '')));
    const start = usable.length > count ? hash(`${seed}:start`) % (usable.length - count + 1) : 0;
    const chosen = usable.slice(start, start + count);
    // Tell Unsplash which pictures were used (required by its guidelines). A failure here changes nothing.
    await Promise.all(chosen.map((photo: any) => (/^https:\/\/api\.unsplash\.com\//.test(String(photo?.links?.download_location || '')) ? fetch(photo.links.download_location, { headers: { Authorization: `Client-ID ${key}` }, signal: AbortSignal.timeout(4000) }).catch(() => null) : null)));
    return chosen.map((photo: any) => {
      const profile = /^https:\/\/unsplash\.com\/@[\w.-]+$/.test(String(photo?.user?.links?.html || '')) ? `${photo.user.links.html}?${UTM}` : `https://unsplash.com/?${UTM}`;
      return { url: String(photo.urls.regular), kind: 'sample' as const, source: 'unsplash' as const, alt: String(photo.alt_description || `${query} sample photo`).slice(0, 140), credit: String(photo?.user?.name || 'Unsplash').slice(0, 80), link: profile };
    });
  } catch {
    return [];
  }
}

// Sample photographs for a business type. Returns [] when no key is set or the service cannot be reached.
export async function samplePhotos(category: string, seed: string, count: number): Promise<DemoPhoto[]> {
  if (count < 1) return [];
  const query = String(category || '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().slice(0, 60) || 'small business';
  if (process.env.UNSPLASH_ACCESS_KEY) {
    const found = await unsplashPhotos(query, seed, count, process.env.UNSPLASH_ACCESS_KEY);
    if (found.length) return found;
  }
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  try {
    const page = 1 + (hash(seed) % 3); // different demos of one trade start on different pictures
    const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${Math.min(15, count + 4)}&page=${page}&orientation=landscape`, { headers: { Authorization: key }, signal: AbortSignal.timeout(7000) });
    if (!response.ok) return [];
    const photos = ((await response.json()) as any)?.photos;
    if (!Array.isArray(photos)) return [];
    const start = photos.length > count ? hash(`${seed}:start`) % (photos.length - count + 1) : 0;
    return photos.slice(start, start + count)
      .filter((photo: any) => photo?.src?.large && /^https:\/\/images\.pexels\.com\//.test(photo.src.large))
      .map((photo: any) => ({ url: String(photo.src.large), kind: 'sample' as const, source: 'pexels' as const, alt: String(photo.alt || `${query} sample photo`).slice(0, 140), credit: String(photo.photographer || 'Pexels').slice(0, 80), link: /^https:\/\/www\.pexels\.com\//.test(String(photo.url)) ? String(photo.url) : 'https://www.pexels.com' }));
  } catch {
    return [];
  }
}

// The business's own pictures first; sample photographs fill what is left.
export async function demoPhotos(input: { ownImages?: string[]; businessName: string; category: string; seed: string; count: number }): Promise<DemoPhoto[]> {
  const own: DemoPhoto[] = (input.ownImages || []).slice(0, input.count).map((url) => ({ url, kind: 'own', alt: `${input.businessName}` }));
  if (own.length >= input.count) return own;
  return [...own, ...(await samplePhotos(input.category, input.seed, input.count - own.length))];
}

export const photosPossible = (website: unknown) => Boolean(process.env.UNSPLASH_ACCESS_KEY) || Boolean(process.env.PEXELS_API_KEY) || Boolean(website);
