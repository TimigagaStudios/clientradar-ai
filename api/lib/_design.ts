// Design DNA: gives every demo its own design recipe and keeps recipes from repeating.
// The recipe is chosen by code (not by the AI) so variety is guaranteed, then saved in content.design.
// File name starts with "_" so Vercel does not count it as a server function.

export type DesignDna = {
  version: 1;
  seed: number;
  signature: string;
  hero: string;
  fonts: string;
  palette: string;
  colorSource: 'brand' | 'palette';
  colors: { bg: string; surface: string; text: string; muted: string; accent: string; alt: string };
  shape: string;
  nav: string;
  services: string;
  highlights: string;
  closing: string;
  art: string;
  align: string;
  order: number;
};

const AXES = {
  hero: ['split', 'full', 'type', 'form', 'stack', 'offset'],
  fonts: ['playfair', 'fraunces', 'grotesk', 'dmserif', 'sora', 'cormorant', 'archivo', 'jakarta', 'baskerville', 'outfit'],
  shape: ['sharp', 'soft', 'round', 'outline'],
  nav: ['bar', 'center', 'pill', 'minimal'],
  services: ['cards', 'list', 'alt', 'bento'],
  highlights: ['icons', 'numbers', 'band'],
  closing: ['band', 'card', 'split'],
  art: ['mesh', 'arches', 'rings', 'stripes', 'blocks', 'monogram'],
  align: ['left', 'center'],
} as const;
const ORDERS = 5;

const PALETTES: Record<string, DesignDna['colors']> = {
  'ivory-forest': { bg: '#f6f3ec', surface: '#ffffff', text: '#1d2a24', muted: '#5f6b64', accent: '#1f6f50', alt: '#d9e6dc' },
  'white-cobalt': { bg: '#ffffff', surface: '#f3f6fb', text: '#0f1b33', muted: '#55617a', accent: '#1f4fd8', alt: '#dbe6ff' },
  'midnight-gold': { bg: '#0d1117', surface: '#161c26', text: '#f4efe6', muted: '#a9a393', accent: '#d4a94a', alt: '#2a2416' },
  'blush-wine': { bg: '#fbf1ee', surface: '#ffffff', text: '#3a1620', muted: '#7d5a62', accent: '#9b2242', alt: '#f3d5d8' },
  'sand-terracotta': { bg: '#f4ece1', surface: '#fbf6ee', text: '#2e2019', muted: '#78655a', accent: '#c2552d', alt: '#ecd3c0' },
  'ink-mint': { bg: '#0b1f1e', surface: '#11302e', text: '#effaf7', muted: '#9fc2bb', accent: '#45d6b5', alt: '#143b38' },
  'stone-black': { bg: '#efefec', surface: '#ffffff', text: '#111111', muted: '#5c5c58', accent: '#111111', alt: '#dcdcd6' },
  'navy-orange': { bg: '#0b1026', surface: '#131d3d', text: '#f8fafc', muted: '#b6c0d9', accent: '#ff7a00', alt: '#1c2850' },
  'sky-navy': { bg: '#eef6fb', surface: '#ffffff', text: '#0c2740', muted: '#557089', accent: '#0b6fb8', alt: '#cfe6f5' },
  'plum-lilac': { bg: '#1a1024', surface: '#261636', text: '#f7f0ff', muted: '#b9a6cf', accent: '#b98cff', alt: '#33204a' },
  'cream-olive': { bg: '#f7f5e8', surface: '#fffef6', text: '#26280f', muted: '#6b6d4c', accent: '#6c7a1d', alt: '#e3e6c2' },
  'white-coral': { bg: '#fffdfb', surface: '#fff3ee', text: '#231815', muted: '#6f5d57', accent: '#f0553a', alt: '#ffd9cf' },
  'charcoal-lime': { bg: '#141614', surface: '#1d211d', text: '#f3f6ee', muted: '#a4ab9c', accent: '#b6e33a', alt: '#2a3020' },
  'slate-teal': { bg: '#f1f5f5', surface: '#ffffff', text: '#102a2c', muted: '#557073', accent: '#0e8a8a', alt: '#cfe7e6' },
};
const PALETTE_KEYS = Object.keys(PALETTES);
const COMPARED = ['hero', 'fonts', 'palette', 'shape', 'nav', 'services', 'highlights', 'closing', 'art', 'align', 'order'] as const;

function hashText(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

function randomFrom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToHsl(hex: string) {
  const red = parseInt(hex.slice(1, 3), 16) / 255;
  const green = parseInt(hex.slice(3, 5), 16) / 255;
  const blue = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const light = (max + min) / 2;
  const spread = max - min;
  if (!spread) return { h: 0, s: 0, l: light };
  const sat = spread / (1 - Math.abs(2 * light - 1));
  let hue = max === red ? ((green - blue) / spread) % 6 : max === green ? (blue - red) / spread + 2 : (red - green) / spread + 4;
  hue = (hue * 60 + 360) % 360;
  return { h: hue, s: sat, l: light };
}

function hslToHex(hue: number, sat: number, light: number) {
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const base = light - chroma / 2;
  const [red, green, blue] = hue < 60 ? [chroma, second, 0] : hue < 120 ? [second, chroma, 0] : hue < 180 ? [0, chroma, second] : hue < 240 ? [0, second, chroma] : hue < 300 ? [second, 0, chroma] : [chroma, 0, second];
  const part = (value: number) => Math.round((value + base) * 255).toString(16).padStart(2, '0');
  return `#${part(red)}${part(green)}${part(blue)}`;
}

// Finds a usable brand colour (not grey, not near white or black) among colours read from the lead's own website.
export function brandAccent(colors: unknown): string | null {
  if (!Array.isArray(colors)) return null;
  for (const color of colors) {
    if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) continue;
    const { s, l } = hexToHsl(color);
    if (s >= 0.35 && l >= 0.22 && l <= 0.68) return color.toLowerCase();
  }
  return null;
}

function brandColors(accent: string, dark: boolean): DesignDna['colors'] {
  const { h, s, l } = hexToHsl(accent);
  if (dark) return { bg: hslToHex(h, 0.35, 0.08), surface: hslToHex(h, 0.3, 0.13), text: hslToHex(h, 0.3, 0.96), muted: hslToHex(h, 0.15, 0.72), accent: l < 0.5 ? hslToHex(h, s, 0.6) : accent, alt: hslToHex(h, 0.35, 0.19) };
  return { bg: hslToHex(h, 0.3, 0.97), surface: '#ffffff', text: hslToHex(h, 0.35, 0.12), muted: hslToHex(h, 0.12, 0.4), accent: l > 0.55 ? hslToHex(h, s, 0.42) : accent, alt: hslToHex(h, 0.45, 0.9) };
}

// Two categories count as the same trade when they share a word stem ("dental clinic" and "dentist").
function stems(category: unknown) {
  return String(category || '').toLowerCase().split(/[^a-z]+/).filter((word) => word.length >= 4).map((word) => word.slice(0, 4));
}
export function sameTrade(first: unknown, second: unknown) {
  const left = stems(first);
  const right = new Set(stems(second));
  return left.some((stem) => right.has(stem));
}

function differences(candidate: Record<string, unknown>, earlier: Record<string, unknown>) {
  return COMPARED.reduce((count, axis) => count + (String(candidate[axis]) === String(earlier[axis]) ? 0 : 1), 0);
}

export type EarlierDesign = { category?: unknown; design?: Record<string, unknown> | null };

// Tries many recipes and keeps the one that is furthest from every earlier demo,
// counting demos in the same trade much more strictly than demos in other trades.
export function pickDesignDna(input: { seedText: string; category?: unknown; brandColors?: unknown; earlier?: EarlierDesign[] }): DesignDna {
  const random = randomFrom(hashText(input.seedText));
  const choose = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  const brand = brandAccent(input.brandColors);
  const earlier = (input.earlier || []).filter((item) => item.design && typeof item.design === 'object');
  let best: DesignDna | null = null;
  let bestScore = -1;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const dark = random() < 0.35;
    const palette = brand ? (dark ? 'brand-dark' : 'brand-light') : choose(PALETTE_KEYS);
    const candidate: DesignDna = {
      version: 1,
      seed: Math.floor(random() * 1_000_000),
      signature: '',
      hero: choose(AXES.hero),
      fonts: choose(AXES.fonts),
      palette,
      colorSource: brand ? 'brand' : 'palette',
      colors: brand ? brandColors(brand, dark) : PALETTES[palette],
      shape: choose(AXES.shape),
      nav: choose(AXES.nav),
      services: choose(AXES.services),
      highlights: choose(AXES.highlights),
      closing: choose(AXES.closing),
      art: choose(AXES.art),
      align: choose(AXES.align),
      order: Math.floor(random() * ORDERS),
    };
    let score = 99;
    for (const item of earlier) {
      const same = sameTrade(input.category, item.category);
      const design = item.design as Record<string, unknown>;
      let distance = differences(candidate as unknown as Record<string, unknown>, design) + (same ? 0 : 4);
      // The three things people notice first must never all repeat inside one trade.
      if (same && design.hero === candidate.hero && design.fonts === candidate.fonts && design.palette === candidate.palette) distance = 0;
      if (same && design.hero === candidate.hero && design.palette === candidate.palette) distance -= 2;
      score = Math.min(score, distance);
    }
    if (score > bestScore) { best = candidate; bestScore = score; }
    if (!earlier.length) break;
  }
  const result = best as DesignDna;
  result.signature = COMPARED.map((axis) => String((result as unknown as Record<string, unknown>)[axis])).join('|');
  return result;
}

// Plain words for the AI writer so the copy matches the look.
export function describeDesign(design: DesignDna) {
  const mood: Record<string, string> = { playfair: 'classic and refined', fraunces: 'warm and characterful', grotesk: 'modern and technical', dmserif: 'elegant and confident', sora: 'clean and contemporary', cormorant: 'luxurious and quiet', archivo: 'bold and direct', jakarta: 'friendly and modern', baskerville: 'traditional and trustworthy', outfit: 'simple and approachable' };
  return `Design direction for this site: ${mood[design.fonts] || 'modern'} typography, a ${design.hero} style opening section and a ${design.shape} visual language. Match the writing voice to that mood and keep the hero title under 9 words.`;
}

// Reads the recipes of earlier demos so a new one can avoid them. Never blocks a build if it fails.
export async function loadEarlierDesigns(supabase: any, excludeId: string): Promise<EarlierDesign[]> {
  try {
    const { data, error } = await supabase.from('demo_jobs').select('id, category:content->>category, design:content->design').neq('id', excludeId).order('created_at', { ascending: false }).limit(200);
    if (error || !Array.isArray(data)) return [];
    return data.filter((row: any) => row && row.design);
  } catch {
    return [];
  }
}
