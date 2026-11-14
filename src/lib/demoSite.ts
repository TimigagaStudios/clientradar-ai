// Demo site builder. Turns a demo's saved content plus its design recipe (content.design)
// into real website files: HTML pages, css/styles.css and js/site.js.
// The same files are shown in the live preview and packed into the ZIP download.
// All business text is escaped, and facts that are missing become visible placeholders.

export type SiteFiles = Record<string, string>;
export type SitePage = { key: string; file: string; label: string };

type Pair = { title: string; body: string };
type Colors = { bg: string; surface: string; text: string; muted: string; accent: string; alt: string };

const FONTS: Record<string, { head: string; body: string; query: string; weight: number; track: string; upper: boolean; scale: number }> = {
  playfair: { head: "'Playfair Display', Georgia, serif", body: "'Inter', system-ui, sans-serif", query: 'family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600', weight: 700, track: '-0.01em', upper: false, scale: 1 },
  fraunces: { head: "'Fraunces', Georgia, serif", body: "'Work Sans', system-ui, sans-serif", query: 'family=Fraunces:wght@500;600&family=Work+Sans:wght@400;500;600', weight: 600, track: '-0.02em', upper: false, scale: 1 },
  grotesk: { head: "'Space Grotesk', system-ui, sans-serif", body: "'Inter', system-ui, sans-serif", query: 'family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600', weight: 700, track: '-0.03em', upper: false, scale: 1 },
  dmserif: { head: "'DM Serif Display', Georgia, serif", body: "'DM Sans', system-ui, sans-serif", query: 'family=DM+Serif+Display&family=DM+Sans:wght@400;500;700', weight: 400, track: '-0.01em', upper: false, scale: 1.06 },
  sora: { head: "'Sora', system-ui, sans-serif", body: "'Sora', system-ui, sans-serif", query: 'family=Sora:wght@400;500;700', weight: 700, track: '-0.03em', upper: false, scale: 0.94 },
  cormorant: { head: "'Cormorant Garamond', Georgia, serif", body: "'Jost', system-ui, sans-serif", query: 'family=Cormorant+Garamond:wght@500;600&family=Jost:wght@400;500', weight: 500, track: '0', upper: false, scale: 1.18 },
  archivo: { head: "'Archivo', system-ui, sans-serif", body: "'Archivo', system-ui, sans-serif", query: 'family=Archivo:wght@400;500;800', weight: 800, track: '-0.01em', upper: true, scale: 0.9 },
  jakarta: { head: "'Plus Jakarta Sans', system-ui, sans-serif", body: "'Plus Jakarta Sans', system-ui, sans-serif", query: 'family=Plus+Jakarta+Sans:wght@400;500;800', weight: 800, track: '-0.03em', upper: false, scale: 0.96 },
  baskerville: { head: "'Libre Baskerville', Georgia, serif", body: "'Source Sans 3', system-ui, sans-serif", query: 'family=Libre+Baskerville:wght@400;700&family=Source+Sans+3:wght@400;600', weight: 700, track: '-0.01em', upper: false, scale: 0.92 },
  outfit: { head: "'Outfit', system-ui, sans-serif", body: "'Outfit', system-ui, sans-serif", query: 'family=Outfit:wght@400;500;600', weight: 600, track: '-0.02em', upper: false, scale: 1 },
};

const SHAPES: Record<string, { radius: string; big: string; button: string }> = {
  sharp: { radius: '0px', big: '0px', button: '0px' },
  soft: { radius: '14px', big: '20px', button: '10px' },
  round: { radius: '28px', big: '40px', button: '999px' },
  outline: { radius: '6px', big: '8px', button: '6px' },
};

const ORDERS = [
  ['about', 'services', 'highlights', 'showcase', 'process', 'faq'],
  ['highlights', 'services', 'about', 'showcase', 'process', 'faq'],
  ['services', 'about', 'showcase', 'highlights', 'process', 'faq'],
  ['about', 'highlights', 'showcase', 'services', 'faq', 'process'],
  ['services', 'highlights', 'process', 'about', 'showcase', 'faq'],
];

const SHOWCASE: Record<string, { nav: string; action: string; formTitle: string; formButton: string; extra: 'message' | 'date' | 'guests' | 'none' }> = {
  listings: { nav: 'Listings', action: 'Enquire', formTitle: 'Property enquiry', formButton: 'Send enquiry', extra: 'message' },
  menu: { nav: 'Menu', action: 'Reserve', formTitle: 'Reserve a table', formButton: 'Request reservation', extra: 'guests' },
  products: { nav: 'Shop', action: 'Add to order', formTitle: 'Your order', formButton: 'Place order', extra: 'none' },
  booking: { nav: 'Book', action: 'Book this', formTitle: 'Request an appointment', formButton: 'Request booking', extra: 'date' },
};

const DEFAULT_COLORS: Colors = { bg: '#0b1026', surface: '#131d3d', text: '#f8fafc', muted: '#b6c0d9', accent: '#ff7a00', alt: '#1c2850' };

const ICON = {
  arrow: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  phone: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  menu: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  camera: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg>',
};

export function esc(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const isHex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
const oneOf = (value: unknown, list: string[], fallback: string) => (list.includes(String(value)) ? String(value) : fallback);

function readableOn(hex: string) {
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? '#111111' : '#ffffff';
}

function pairs(value: unknown): Pair[] {
  return Array.isArray(value) ? value.filter((item) => item && item.title && item.body).map((item) => ({ title: String(item.title), body: String(item.body) })) : [];
}

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

type Model = ReturnType<typeof readContent>;

function readContent(content: any) {
  const design = content?.design || {};
  const rawColors = design.colors || {};
  const colors: Colors = {
    bg: isHex(rawColors.bg) ? rawColors.bg : DEFAULT_COLORS.bg,
    surface: isHex(rawColors.surface) ? rawColors.surface : DEFAULT_COLORS.surface,
    text: isHex(rawColors.text) ? rawColors.text : DEFAULT_COLORS.text,
    muted: isHex(rawColors.muted) ? rawColors.muted : DEFAULT_COLORS.muted,
    accent: isHex(rawColors.accent) ? rawColors.accent : DEFAULT_COLORS.accent,
    alt: isHex(rawColors.alt) ? rawColors.alt : DEFAULT_COLORS.alt,
  };
  const level: 'mid' | 'hybrid' | 'ultra' = content?.styleLevel === 'ultra' || content?.styleLevel === 'hybrid' ? content.styleLevel : 'mid';
  const kind = oneOf(content?.showcase?.kind, Object.keys(SHOWCASE), 'booking');
  const contact = content?.contact || {};
  const instagram = typeof contact.instagram === 'string' ? contact.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '') : '';
  const name = String(content?.businessName || 'Business');
  return {
    name,
    initials: name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'B',
    category: String(content?.category || ''),
    city: String(content?.city || ''),
    level,
    multi: level === 'ultra',
    motion: true,
    rich: level !== 'mid',
    hero: content?.hero || {},
    about: content?.about || {},
    closing: content?.closing || {},
    services: pairs(content?.services),
    highlights: pairs(content?.highlights),
    process: pairs(content?.process),
    faq: (Array.isArray(content?.faq) ? content.faq : []).filter((item: any) => item && item.question && item.answer) as { question: string; answer: string }[],
    kind,
    showcaseTitle: String(content?.showcase?.title || SHOWCASE[kind].nav),
    showcase: (Array.isArray(content?.showcase?.items) ? content.showcase.items : []).filter((item: any) => item && item.title && item.detail) as { title: string; subtitle?: string; detail: string }[],
    phone: contact.phone ? String(contact.phone) : '',
    email: contact.email ? String(contact.email) : '',
    instagram,
    photos: (Array.isArray(content?.photos) ? content.photos : []).filter((photo: any) => photo && typeof photo.url === 'string' && /^https:\/\/[^\s"'<>]+$/.test(photo.url)).slice(0, 12).map((photo: any) => ({ url: String(photo.url), sample: photo.kind !== 'own', alt: String(photo.alt || ''), credit: String(photo.credit || ''), link: typeof photo.link === 'string' && /^https:\/\/www\.pexels\.com\//.test(photo.link) ? photo.link : 'https://www.pexels.com' })) as { url: string; sample: boolean; alt: string; credit: string; link: string }[],
    disclaimer: String(content?.disclaimer || 'Demo concept content. Confirm business details before production use.'),
    colors,
    onAccent: readableOn(colors.accent),
    fonts: FONTS[String(design.fonts)] ? String(design.fonts) : 'jakarta',
    shape: oneOf(design.shape, Object.keys(SHAPES), 'soft'),
    heroKind: oneOf(design.hero, ['split', 'full', 'type', 'form', 'stack', 'offset'], 'split'),
    nav: oneOf(design.nav, ['bar', 'center', 'pill', 'minimal'], 'bar'),
    servicesKind: oneOf(design.services, ['cards', 'list', 'alt', 'bento'], 'cards'),
    highlightsKind: oneOf(design.highlights, ['icons', 'numbers', 'band'], 'icons'),
    closingKind: oneOf(design.closing, ['band', 'card', 'split'], 'card'),
    art: oneOf(design.art, ['mesh', 'arches', 'rings', 'stripes', 'blocks', 'monogram'], 'mesh'),
    align: oneOf(design.align, ['left', 'center'], 'left'),
    order: ORDERS[Math.abs(Number(design.order) || 0) % ORDERS.length],
    seed: Number(design.seed) || 1,
  };
}

// Designed artwork drawn from the site's own colours. Used where photographs will go later,
// so no stock or invented photos of the business are ever shown.
let artCount = 0;
let shownPhotos = new Set<number>(); // which photographs this page really shows (for the credit line)
function art(model: Model, variant: number) {
  const { accent, alt, surface, text } = model.colors;
  const random = seeded(model.seed * 31 + variant * 977);
  const num = (min: number, max: number) => Math.round(min + random() * (max - min));
  artCount += 1;
  const id = `a${artCount}`;
  let body = '';
  if (model.art === 'mesh') {
    body = `<defs><filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="38"/></filter></defs><rect width="400" height="400" fill="${alt}"/><g filter="url(#${id})"><circle cx="${num(40, 160)}" cy="${num(60, 180)}" r="${num(90, 130)}" fill="${accent}" opacity=".85"/><circle cx="${num(240, 360)}" cy="${num(220, 340)}" r="${num(100, 150)}" fill="${accent}" opacity=".5"/><circle cx="${num(220, 340)}" cy="${num(40, 140)}" r="${num(60, 100)}" fill="${surface}" opacity=".9"/><circle cx="${num(40, 140)}" cy="${num(280, 380)}" r="${num(60, 110)}" fill="${text}" opacity=".35"/></g>`;
  } else if (model.art === 'arches') {
    const arch = (x: number, width: number, top: number, opacity: number, fill: string) => `<path d="M${x} 400V${top + width / 2}a${width / 2} ${width / 2} 0 0 1 ${width} 0V400z" fill="${fill}" opacity="${opacity}"/>`;
    body = `<rect width="400" height="400" fill="${alt}"/>${arch(num(20, 50), 150, num(110, 170), 1, accent)}${arch(num(150, 190), 130, num(40, 100), 0.55, accent)}${arch(num(250, 270), 120, num(170, 230), 0.9, surface)}<circle cx="${num(300, 350)}" cy="${num(50, 90)}" r="26" fill="${text}" opacity=".5"/>`;
  } else if (model.art === 'rings') {
    const cx = num(120, 280);
    const cy = num(140, 260);
    body = `<rect width="400" height="400" fill="${alt}"/>${[40, 80, 120, 160, 200, 240, 280].map((radius, index) => `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${accent}" stroke-width="${index % 2 ? 2 : 10}" opacity="${(0.9 - index * 0.1).toFixed(2)}"/>`).join('')}<circle cx="${cx}" cy="${cy}" r="18" fill="${text}"/>`;
  } else if (model.art === 'stripes') {
    const gap = num(26, 44);
    body = `<defs><pattern id="${id}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(${num(25, 60)})"><rect width="${Math.round(gap / 2)}" height="${gap}" fill="${accent}"/></pattern></defs><rect width="400" height="400" fill="${alt}"/><rect width="400" height="400" fill="url(#${id})" opacity=".85"/><circle cx="${num(110, 290)}" cy="${num(120, 280)}" r="${num(70, 110)}" fill="${surface}"/>`;
  } else if (model.art === 'blocks') {
    const fills = [accent, surface, text, alt, accent];
    let cells = '';
    for (let row = 0; row < 4; row += 1) for (let column = 0; column < 4; column += 1) {
      const fill = fills[num(0, fills.length - 1)];
      const round = random() < 0.3 ? 50 : 0;
      cells += `<rect x="${column * 100 + 4}" y="${row * 100 + 4}" width="92" height="92" rx="${round}" fill="${fill}" opacity="${fill === text ? 0.55 : 1}"/>`;
    }
    body = `<rect width="400" height="400" fill="${alt}"/>${cells}`;
  } else {
    body = `<rect width="400" height="400" fill="${accent}"/><circle cx="${num(280, 360)}" cy="${num(40, 120)}" r="${num(90, 140)}" fill="${model.onAccent}" opacity=".12"/><text x="200" y="262" text-anchor="middle" font-size="190" style="font-family:var(--font-head);font-weight:var(--head-weight)" fill="${model.onAccent}">${esc(model.initials)}</text>`;
  }
  // A soft light-to-shade finish and a fine grain, so the artwork reads as a finished image and not flat shapes.
  const finish = `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".2"/><stop offset=".55" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity=".32"/></linearGradient><filter id="${id}n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0"/></filter></defs><rect width="400" height="400" fill="url(#${id}g)"/><rect width="400" height="400" filter="url(#${id}n)" opacity=".16"/>`;
  const drawn = `<svg class="art" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Decorative artwork">${body}${finish}</svg>`;
  // A photograph sits on top of the artwork when one is known: the business's own picture, or a
  // sample photograph that is always marked as a sample. If it fails to load, the artwork shows instead.
  const place = variant >= 10 ? variant - 8 : variant - 1;
  const photo = model.photos[place];
  if (!photo) return drawn;
  shownPhotos.add(place);
  return `<span class="pic">${drawn}<img src="${esc(photo.url)}" alt="${esc(photo.alt || model.name)}" loading="${variant === 1 ? 'eager' : 'lazy'}" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('nopic');this.remove()">${photo.sample ? '<em class="pic-tag">Sample photo</em>' : ''}</span>`;
}

// A visible, clearly labelled gap for a fact that is not known yet. Never filled with a guess.
const placeholder = (label: string) => `<span class="ph" title="Placeholder: replace before launch">${esc(label)}</span>`;

function pageList(model: Model): SitePage[] {
  if (!model.multi) return [{ key: 'home', file: 'index.html', label: 'Home' }];
  return [
    { key: 'home', file: 'index.html', label: 'Home' },
    { key: 'about', file: 'about.html', label: 'About' },
    { key: 'services', file: 'services.html', label: 'Services' },
    ...(model.showcase.length ? [{ key: 'showcase', file: 'showcase.html', label: SHOWCASE[model.kind].nav }] : []),
    ...(model.faq.length ? [{ key: 'faq', file: 'faq.html', label: 'FAQ' }] : []),
    { key: 'contact', file: 'contact.html', label: 'Contact' },
  ];
}

function link(model: Model, key: string) {
  if (!model.multi) return key === 'home' ? 'href="#top"' : `href="#${key}"`;
  const page = pageList(model).find((item) => item.key === key) || pageList(model)[0];
  return `href="${page.file}" data-page="${page.key}"`;
}

function head(_model: Model, eyebrow: string, title: string) {
  return `<div class="sh"><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2></div>`;
}

function header(model: Model, current: string) {
  const items = model.multi
    ? pageList(model).filter((page) => page.key !== 'home').map((page) => `<a ${link(model, page.key)}${page.key === current ? ' aria-current="page"' : ''}>${esc(page.label)}</a>`)
    : [
        '<a href="#about">About</a>',
        '<a href="#services">Services</a>',
        ...(model.showcase.length ? [`<a href="#showcase">${esc(SHOWCASE[model.kind].nav)}</a>`] : []),
        ...(model.faq.length ? ['<a href="#faq">FAQ</a>'] : []),
        '<a href="#contact">Contact</a>',
      ];
  return `<header class="hd"><div class="wrap hd-in"><a class="logo" ${link(model, 'home')}>${esc(model.name)}</a><nav class="links" id="site-nav">${items.join('')}</nav><a class="btn btn-sm hd-cta" ${link(model, 'contact')}>${esc(model.hero.cta || 'Get in touch')}</a><button class="menu-btn" type="button" data-menu aria-controls="site-nav" aria-expanded="false" aria-label="Open menu">${ICON.menu}</button></div></header>`;
}

function facts(model: Model) {
  const items = [
    model.city ? `<span>${ICON.pin}${esc(model.city)}</span>` : '',
    model.phone ? `<a href="tel:${esc(model.phone.replace(/[^+\d]/g, ''))}" target="_top">${ICON.phone}${esc(model.phone)}</a>` : `<span>${ICON.phone}${placeholder('Add phone number')}</span>`,
  ].filter(Boolean);
  return `<div class="facts">${items.join('')}</div>`;
}

function enquiryForm(title: string, button: string, extra: string, id = '') {
  const extraField = extra === 'date' ? '<label>Preferred date<input type="date" name="date"></label>'
    : extra === 'guests' ? '<label>Guests<input type="number" name="guests" min="1" max="30" value="2"></label>'
    : extra === 'message' ? '<label>Message<textarea name="message" rows="3" placeholder="How can we help?"></textarea></label>' : '';
  return `<form class="card form" data-demo-form${id ? ` id="${id}"` : ''}><h3 data-form-title>${esc(title)}</h3><p class="choice" data-choice hidden></p><label>Name<input type="text" name="name" autocomplete="name" required></label><label>Phone or email<input type="text" name="contact" required></label>${extraField}<button class="btn" type="submit">${esc(button)}</button><p class="notice" data-notice hidden>Demo form: nothing was sent. On the live site this goes straight to the business.</p></form>`;
}

// The business name inside the main headline is picked out in the accent colour.
function highlight(model: Model, title: string) {
  const at = title.toLowerCase().indexOf(model.name.toLowerCase());
  if (at < 0 || model.name.length < 3 || model.name.length >= title.length) {
    const words = title.split(' ');
    if (words.length < 4) return esc(title);
    const cut = words.length - Math.min(2, Math.floor(words.length / 3));
    return `${esc(words.slice(0, cut).join(' '))} <span class="hl">${esc(words.slice(cut).join(' '))}</span>`;
  }
  return `${esc(title.slice(0, at))}<span class="hl">${esc(title.slice(at, at + model.name.length))}</span>${esc(title.slice(at + model.name.length))}`;
}

// A slow moving line of the real service names, category and city.
function marquee(model: Model) {
  const words = [...model.services.map((item) => item.title), model.category, model.city].filter(Boolean);
  if (words.length < 3 || model.heroKind === 'type') return '';
  const run = words.map((word) => `<span>${esc(word)}</span><i></i>`).join('');
  return `<div class="mq" aria-hidden="true"><div class="mq-in">${run}${run}${run}</div></div>`;
}

// A call-to-action strip in the middle of the page, using the real phone number when it is known.
function ctaStrip(model: Model) {
  const call = model.phone ? `<a class="btn btn-light" href="tel:${esc(model.phone.replace(/[^+\d]/g, ''))}" target="_top">${ICON.phone}Call ${esc(model.phone)}</a>` : '';
  return `<section class="cta-strip"><div class="wrap"><div class="cta-in rv"><div><p class="cta-k">${esc(model.category || 'Get in touch')}</p><h2>Have a question for ${esc(model.name)}?</h2><p>Call or send a message. It only takes a minute.</p></div><div class="actions">${call}<a class="btn ${call ? 'btn-line' : 'btn-light'}" ${link(model, 'contact')}>${esc(model.hero.cta || 'Get in touch')}${ICON.arrow}</a></div></div></div></section>`;
}

// Real facts only: where the business is, what it does, how to reach it.
function aboutFacts(model: Model) {
  const rows = [
    model.city ? `<li><span>Based in</span><strong>${esc(model.city)}</strong></li>` : '',
    model.category ? `<li><span>What we do</span><strong>${esc(model.category)}</strong></li>` : '',
    `<li><span>Call us</span><strong>${model.phone ? `<a href="tel:${esc(model.phone.replace(/[^+\d]/g, ''))}" target="_top">${esc(model.phone)}</a>` : placeholder('Add phone number')}</strong></li>`,
  ].filter(Boolean).join('');
  return `<ul class="af">${rows}</ul>`;
}

// On phones: a bar that stays at the bottom with the two actions that matter.
function mobileBar(model: Model) {
  const call = model.phone ? `<a class="mb-call" href="tel:${esc(model.phone.replace(/[^+\d]/g, ''))}" target="_top">${ICON.phone}Call</a>` : '';
  return `<div class="mbar" data-mbar>${call}<a class="mb-go" ${link(model, 'contact')}>${esc(model.hero.cta || 'Get in touch')}${ICON.arrow}</a></div>`;
}

function heroSection(model: Model) {
  const eyebrow = `<p class="eyebrow">${esc(model.hero.eyebrow || model.category)}</p>`;
  const title = `<h1>${highlight(model, String(model.hero.title || model.name))}</h1>`;
  const lead = model.hero.description ? `<p class="lead">${esc(model.hero.description)}</p>` : '';
  const buttons = `<div class="actions"><a class="btn" ${link(model, 'contact')}>${esc(model.hero.cta || 'Get in touch')}${ICON.arrow}</a><a class="btn btn-ghost" ${link(model, 'services')}>Our services</a></div>`;
  const kind = model.heroKind;
  if (kind === 'full') return `<section class="hero hero-full" id="top"><div class="hero-bg">${art(model, 1)}</div><div class="wrap"><div class="hero-panel rv">${eyebrow}${title}${lead}${buttons}${facts(model)}</div></div></section>`;
  if (kind === 'type') {
    const ticker = model.services.slice(0, 5).map((item) => `<span>${esc(item.title)}</span>`).join('');
    return `<section class="hero hero-type" id="top"><div class="wrap rv">${eyebrow}${title}${lead}${buttons}${facts(model)}</div>${ticker ? `<div class="ticker" aria-hidden="true"><div class="wrap">${ticker}</div></div>` : ''}</section>`;
  }
  if (kind === 'form') return `<section class="hero hero-form" id="top"><div class="wrap hero-grid"><div class="rv">${eyebrow}${title}${lead}${facts(model)}</div><div class="rv">${enquiryForm('Quick enquiry', 'Send enquiry', 'message')}</div></div></section>`;
  if (kind === 'stack') return `<section class="hero hero-stack" id="top"><div class="wrap rv">${eyebrow}${title}${lead}${buttons}</div><div class="wrap"><div class="hero-band rv">${art(model, 1)}<div class="band-card card">${facts(model)}</div></div></div></section>`;
  if (kind === 'offset') return `<section class="hero hero-offset" id="top"><div class="wrap hero-grid"><div class="hero-art rv">${art(model, 1)}<div class="float-card card"><strong>${esc(model.name)}</strong>${facts(model)}</div></div><div class="rv">${eyebrow}${title}${lead}${buttons}</div></div></section>`;
  return `<section class="hero hero-split" id="top"><div class="wrap hero-grid"><div class="rv">${eyebrow}${title}${lead}${buttons}${facts(model)}</div><div class="hero-art rv">${art(model, 1)}${model.category ? `<span class="chip chip-a">${esc(model.category)}</span>` : ''}${model.city ? `<span class="chip chip-b">${ICON.pin}${esc(model.city)}</span>` : ''}</div></div></section>`;
}

function aboutSection(model: Model) {
  const title = model.about.title || `About ${model.name}`;
  const body = `<p class="lead">${esc(model.about.body || '')}</p>${aboutFacts(model)}`;
  // Openings made only of words or a form have no picture, so the first photograph is shown here instead.
  const variant = model.heroKind === 'type' || model.heroKind === 'form' ? 1 : 2;
  if (model.align === 'center') return `<section class="sec about about-center" id="about"><div class="wrap narrow rv">${head(model, 'About', title)}${body}${model.photos[variant - 1] ? `<div class="frame frame-wide">${art(model, variant)}</div>` : ''}</div></section>`;
  return `<section class="sec about" id="about"><div class="wrap two"><div class="rv">${head(model, 'About', title)}${body}</div><div class="frame rv">${art(model, variant)}</div></div></section>`;
}

function servicesSection(model: Model, limit = 99) {
  const list = model.services.slice(0, limit);
  if (!list.length) return '';
  const number = (index: number) => String(index + 1).padStart(2, '0');
  let body = '';
  if (model.servicesKind === 'list') body = `<div class="svc-list">${list.map((item, index) => `<article class="rv"><span class="no">${number(index)}</span><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p></article>`).join('')}</div>`;
  else if (model.servicesKind === 'alt') body = `<div class="svc-alt">${list.map((item, index) => `<article class="rv"><span class="no">${number(index)}</span><div><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p></div></article>`).join('')}</div>`;
  else if (model.servicesKind === 'bento') body = `<div class="svc-bento">${list.map((item, index) => `<article class="card rv"><span class="no">${number(index)}</span><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p></article>`).join('')}</div>`;
  else body = `<div class="svc-cards">${list.map((item) => `<article class="card rv"><span class="tick">${ICON.check}</span><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p></article>`).join('')}</div>`;
  const more = model.multi && limit < model.services.length ? `<p class="more"><a class="btn btn-ghost" ${link(model, 'services')}>All services${ICON.arrow}</a></p>` : '';
  return `<section class="sec services" id="services"><div class="wrap">${head(model, 'Services', 'What we offer')}${body}${more}</div></section>`;
}

function highlightsSection(model: Model) {
  if (!model.highlights.length) return '';
  const items = model.highlights.map((item, index) => `<article class="rv">${model.highlightsKind === 'numbers' ? `<span class="big">${index + 1}</span>` : `<span class="tick">${ICON.check}</span>`}<h3>${esc(item.title)}</h3><p>${esc(item.body)}</p></article>`).join('');
  return `<section class="sec highlights hl-${model.highlightsKind}" id="highlights"><div class="wrap">${head(model, 'Why choose us', `Why ${model.name}`)}<div class="hl-grid">${items}</div></div></section>`;
}

function processSection(model: Model) {
  if (!model.process.length) return '';
  const style = model.seed % 2 ? 'steps' : 'timeline';
  return `<section class="sec process" id="process"><div class="wrap">${head(model, 'How it works', 'A simple process')}<ol class="pr-${style}">${model.process.map((item, index) => `<li class="rv"><span class="step">${index + 1}</span><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p></li>`).join('')}</ol></div></section>`;
}

function showcaseSection(model: Model) {
  if (!model.showcase.length) return '';
  const text = SHOWCASE[model.kind];
  const cards = model.showcase.map((item, index) => `<article class="card rv">${model.multi ? `<div class="thumb">${art(model, 10 + index)}</div>` : ''}${item.subtitle ? `<p class="tag">${esc(item.subtitle)}</p>` : ''}<h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p><button class="btn btn-sm btn-ghost" type="button" data-choose="${esc(item.title)}">${esc(text.action)}</button></article>`).join('');
  return `<section class="sec showcase" id="showcase"><div class="wrap">${head(model, text.nav, model.showcaseTitle)}<p class="sample">Sample content: replace with the real ${esc(text.nav.toLowerCase())} before launch.</p><div class="sc-grid">${cards}</div><div class="sc-form">${enquiryForm(text.formTitle, text.formButton, text.extra, 'showcase-form')}</div></div></section>`;
}

function faqSection(model: Model) {
  if (!model.faq.length) return '';
  return `<section class="sec faq" id="faq"><div class="wrap narrow">${head(model, 'FAQ', 'Common questions')}${model.faq.map((item, index) => `<details class="card rv"${index === 0 ? ' open' : ''}><summary>${esc(item.question)}</summary><p>${esc(item.answer)}</p></details>`).join('')}</div></section>`;
}

function contactRows(model: Model) {
  return [
    `<li>${ICON.phone}${model.phone ? `<a href="tel:${esc(model.phone.replace(/[^+\d]/g, ''))}" target="_top">${esc(model.phone)}</a>` : placeholder('Add phone number')}</li>`,
    `<li>${ICON.mail}${model.email ? `<a href="mailto:${esc(model.email)}" target="_top">${esc(model.email)}</a>` : placeholder('Add email address')}</li>`,
    model.instagram ? `<li>${ICON.camera}<a href="https://instagram.com/${encodeURIComponent(model.instagram)}" target="_blank" rel="noopener noreferrer">@${esc(model.instagram)}</a></li>` : '',
    `<li>${ICON.pin}${model.city ? `${esc(model.city)} ` : ''}${placeholder('Add street address')}</li>`,
    `<li>${ICON.check}${placeholder('Add opening hours')}</li>`,
  ].join('');
}

function closingSection(model: Model, withForm: boolean) {
  const title = `<h2>${esc(model.closing.title || 'Get in touch')}</h2>`;
  const body = model.closing.body ? `<p class="lead">${esc(model.closing.body)}</p>` : '';
  const rows = `<ul class="contact-list">${contactRows(model)}</ul>`;
  const form = withForm ? enquiryForm('Send a message', 'Send message', 'message') : '';
  if (model.closingKind === 'band') return `<section class="closing closing-band" id="contact"><div class="wrap narrow rv">${title}${body}${rows}</div>${form ? `<div class="wrap narrow">${form}</div>` : ''}</section>`;
  if (model.closingKind === 'split') return `<section class="sec closing closing-split" id="contact"><div class="wrap two"><div class="rv">${title}${body}</div><div class="rv">${rows}${form}</div></div></section>`;
  return `<section class="sec closing closing-card" id="contact"><div class="wrap"><div class="card big-card rv">${title}${body}${rows}</div>${form ? `<div class="narrow after">${form}</div>` : ''}</div></section>`;
}

function footer(model: Model) {
  const where = [model.category, model.city].filter(Boolean).map(esc).join(' &middot; ');
  const links = model.multi
    ? pageList(model).map((page) => `<a ${link(model, page.key)}>${esc(page.label)}</a>`)
    : ['<a href="#about">About</a>', '<a href="#services">Services</a>', ...(model.process.length ? ['<a href="#process">How it works</a>'] : []), '<a href="#contact">Contact</a>'];
  const reach = [
    model.phone ? `<a href="tel:${esc(model.phone.replace(/[^+\d]/g, ''))}" target="_top">${esc(model.phone)}</a>` : '',
    model.email ? `<a href="mailto:${esc(model.email)}" target="_top">${esc(model.email)}</a>` : '',
    model.instagram ? `<a href="https://instagram.com/${encodeURIComponent(model.instagram)}" target="_blank" rel="noopener noreferrer">@${esc(model.instagram)}</a>` : '',
  ].filter(Boolean);
  const samples = model.photos.filter((photo, index) => photo.sample && shownPhotos.has(index));
  const names = samples.filter((photo, index, all) => photo.credit && all.findIndex((other) => other.credit === photo.credit) === index).slice(0, 8).map((photo) => `<a href="${esc(photo.link)}" target="_blank" rel="noopener noreferrer">${esc(photo.credit)}</a>`).join(', ');
  const credit = samples.length ? `<p class="small credit">Sample photos provided by <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a>${names ? ` (photos by ${names})` : ''}. They show the type of business, not this business. Replace with real photographs before launch.</p>` : '';
  return `<footer class="ft"><div class="wrap ft-top"><div class="ft-brand"><p class="logo">${esc(model.name)}</p>${where ? `<p>${where}</p>` : ''}</div><nav class="ft-col" aria-label="Footer"><p class="ft-h">Explore</p>${links.join('')}</nav>${reach.length ? `<div class="ft-col"><p class="ft-h">Contact</p>${reach.join('')}</div>` : ''}</div><div class="wrap ft-in"><div><p class="small">${esc(model.disclaimer)}</p>${credit}</div><a class="ft-up" href="#top">Back to top</a></div></footer>`;
}

function pageBody(model: Model, key: string) {
  const sections: Record<string, () => string> = {
    about: () => aboutSection(model),
    services: () => servicesSection(model),
    highlights: () => highlightsSection(model),
    showcase: () => showcaseSection(model),
    process: () => processSection(model),
    faq: () => faqSection(model),
  };
  const title = (eyebrow: string, text: string) => `<section class="page-top"><div class="wrap rv"><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(text)}</h1></div></section>`;
  if (!model.multi) {
    const built = model.order.map((name) => sections[name]()).filter(Boolean);
    built.splice(Math.min(3, built.length), 0, ctaStrip(model));
    return heroSection(model) + marquee(model) + built.join('') + closingSection(model, false);
  }
  if (key === 'about') return title(model.name, model.about.title || 'About us') + aboutSection(model) + processSection(model) + closingSection(model, false);
  if (key === 'services') return title(model.category || 'Services', 'Services') + servicesSection(model) + highlightsSection(model) + closingSection(model, false);
  if (key === 'showcase') return title(model.name, SHOWCASE[model.kind].nav) + showcaseSection(model);
  if (key === 'faq') return title(model.name, 'Questions and answers') + faqSection(model) + closingSection(model, false);
  if (key === 'contact') return title(model.name, 'Contact') + closingSection(model, true);
  const home = model.order[0] === 'services' || model.order[0] === 'highlights'
    ? [highlightsSection(model), servicesSection(model, 3), aboutSection(model)]
    : [aboutSection(model), servicesSection(model, 3), highlightsSection(model)];
  return heroSection(model) + marquee(model) + home.join('') + ctaStrip(model) + closingSection(model, false);
}

// The premium finish shared by every level: depth, light, movement and clear calls to action.
// Hybrid and Ultra add more on top (pointer light on cards, drifting glow, headline reveal).
function premium(model: Model) {
  const { accent, bg } = model.colors;
  const dark = readableOn(bg) === '#ffffff';
  const shade = dark ? 'rgba(0,0,0,.55)' : 'rgba(20,24,40,.16)';
  const css: string[] = [];
  css.push(`body{overflow-x:hidden}
::selection{background:${accent};color:var(--on-accent)}
.bar{position:fixed;top:0;left:0;height:3px;width:0;background:linear-gradient(90deg,${accent},${accent}99);z-index:60;pointer-events:none}
.hd{background:${bg}d9;-webkit-backdrop-filter:saturate(1.4) blur(14px);backdrop-filter:saturate(1.4) blur(14px);transition:box-shadow .3s ease}
.hd.scrolled{box-shadow:0 14px 34px -22px ${shade}}
.links a{position:relative}
@media(min-width:860px){.links a::after{content:"";position:absolute;left:0;right:0;bottom:-6px;height:2px;background:var(--accent);transform:scaleX(0);transform-origin:left;transition:transform .3s ease}.links a:hover::after,.links a[aria-current]::after{transform:scaleX(1)}}
.hero{position:relative;overflow:hidden;isolation:isolate}
.hero::before{content:"";position:absolute;z-index:-1;width:min(900px,130vw);aspect-ratio:1/1;right:-22%;top:-38%;background:radial-gradient(closest-side,${accent}${dark ? '47' : '30'},transparent 70%);pointer-events:none}
.hero::after{content:"";position:absolute;z-index:-1;inset:0;background-image:radial-gradient(${dark ? '#ffffff' : '#000000'}14 1px,transparent 1px);background-size:26px 26px;-webkit-mask-image:linear-gradient(180deg,#000,transparent 85%);mask-image:linear-gradient(180deg,#000,transparent 85%);pointer-events:none}
.hero-full::before,.hero-full::after{display:none}
.hero h1{text-wrap:balance}
.hl{color:var(--accent)}
@supports((-webkit-background-clip:text) or (background-clip:text)){.hl{background:linear-gradient(100deg,${accent},color-mix(in srgb,${accent} 62%,var(--text)));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}}
.hero-art,.frame,.hero-band{box-shadow:0 40px 80px -40px ${shade},0 0 0 1px var(--line)}
.chip{position:absolute;display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;background:${bg}e6;color:var(--text);border:1px solid var(--line);font-size:.86rem;font-weight:600;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 16px 30px -18px ${shade}}
.chip svg{color:var(--accent)}
.chip-a{top:18px;left:18px}.chip-b{bottom:18px;right:18px}
.pic{position:relative;display:block;width:100%;height:100%;border-radius:inherit;overflow:hidden}
.pic img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;transition:transform 1.2s cubic-bezier(.2,.7,.2,1)}
.pic-tag{position:absolute;left:10px;bottom:10px;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,.62);color:#fff;font-size:.68rem;font-style:normal;font-weight:600;letter-spacing:.04em}
.nopic .pic-tag{display:none}
.hero-offset .hero-art .pic{border-radius:var(--radius-big);box-shadow:0 40px 80px -40px ${shade}}
.hero-art:hover .pic img,.frame:hover .pic img,.thumb:hover .pic img{transform:scale(1.05)}
.frame-wide{aspect-ratio:16/9;margin-top:34px}
.credit{margin-top:8px}.credit a{text-decoration:underline}
.hero-offset .hero-art{box-shadow:none}.hero-offset .hero-art .art{box-shadow:0 40px 80px -40px ${shade}}
.ft .logo{text-align:left}
.btn{position:relative;overflow:hidden;box-shadow:0 14px 28px -14px ${accent}b3;transition:transform .25s ease,box-shadow .25s ease,opacity .2s ease}
.btn:hover{transform:translateY(-3px);opacity:1;box-shadow:0 20px 36px -14px ${accent}cc}
.btn svg{transition:transform .25s ease}.btn:hover svg{transform:translateX(4px)}
.btn::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-18deg);transition:left .6s ease}
.btn:hover::after{left:130%}
.btn-ghost,.btn-line{box-shadow:none}.btn-ghost::after,.btn-line::after{display:none}
.btn-ghost:hover{box-shadow:none;border-color:var(--accent);color:var(--accent)}
.card{transition:transform .3s ease,box-shadow .3s ease,border-color .3s ease;position:relative}
.svc-cards .card:hover,.svc-bento .card:hover,.sc-grid .card:hover{transform:translateY(-6px);border-color:${accent}8c;box-shadow:0 28px 50px -30px ${shade}}
.svc-cards .card::before,.svc-bento .card::before{content:"";position:absolute;left:26px;right:26px;top:0;height:3px;background:var(--accent);transform:scaleX(0);transform-origin:left;transition:transform .4s ease}
.svc-cards .card:hover::before,.svc-bento .card:hover::before{transform:scaleX(1)}
.tick{background:linear-gradient(140deg,${accent},${accent}b3);color:var(--on-accent);box-shadow:0 10px 20px -10px ${accent}cc}
.svc-list article,.svc-alt article{transition:padding .3s ease,background .3s ease}
@media(hover:hover){.svc-list article:hover,.svc-alt article:hover{padding-left:14px;background:linear-gradient(90deg,${accent}14,transparent 60%)}}
.sh h2,.cta-in h2,.closing h2{text-wrap:balance}
.mq{overflow:hidden;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:18px 0;background:var(--bg)}
.mq-in{display:flex;align-items:center;gap:28px;width:max-content;animation:mq 38s linear infinite;font-family:var(--font-head);font-weight:var(--head-weight);font-size:1.05rem;letter-spacing:var(--head-track);white-space:nowrap${FONTS[model.fonts].upper ? ';text-transform:uppercase' : ''}}
.mq-in i{width:8px;height:8px;border-radius:50%;background:var(--accent);flex:none}
@keyframes mq{to{transform:translateX(-33.333%)}}
.af{list-style:none;margin:30px 0 0;padding:0;display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));text-align:left}
.af li{padding:16px 18px;border:1px solid var(--line);border-radius:var(--radius);background:${dark ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.6)'};display:grid;gap:4px}
.af span{font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.af strong{font-family:var(--font-head);font-weight:var(--head-weight);font-size:1.05rem;letter-spacing:var(--head-track);overflow-wrap:anywhere}
.cta-strip{padding:28px 0;background:var(--bg)!important}
.cta-in{position:relative;overflow:hidden;display:grid;gap:24px;align-items:center;padding:36px 26px;border-radius:var(--radius-big);background:linear-gradient(125deg,${accent},color-mix(in srgb,${accent} 70%,#000));color:var(--on-accent)}
.cta-in::before{content:"";position:absolute;width:420px;height:420px;right:-140px;top:-200px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.28),transparent);pointer-events:none}
.cta-in>*{position:relative}
.cta-in p{opacity:.9;margin-top:10px}.cta-k{font-size:.76rem;letter-spacing:.16em;text-transform:uppercase;font-weight:600;margin:0 0 10px!important}
.cta-in .actions{margin-top:0}
.btn-light{background:var(--on-accent);color:${accent};border-color:var(--on-accent);box-shadow:0 14px 28px -14px rgba(0,0,0,.45)}
.btn-light:hover{box-shadow:0 20px 36px -14px rgba(0,0,0,.5)}
.btn-line{background:transparent;color:var(--on-accent);border-color:currentColor}
@media(min-width:860px){.cta-in{grid-template-columns:1.2fr auto;padding:52px 56px}.cta-strip{padding:40px 0}}
.pr-steps .step,.pr-timeline .step{box-shadow:0 10px 22px -10px ${accent}cc}
.faq details{transition:border-color .3s ease}.faq details[open]{border-color:${accent}8c}
.ft{padding:0;background:${dark ? 'rgba(0,0,0,.22)' : 'rgba(0,0,0,.035)'}}
.ft-top{display:grid;gap:28px;padding-top:48px;padding-bottom:36px}
.ft-brand .logo{font-size:1.5rem;white-space:normal}
.ft-col{display:grid;gap:10px;align-content:start}.ft-col a{color:var(--text);opacity:.85;width:max-content;max-width:100%;overflow-wrap:anywhere}.ft-col a:hover{color:var(--accent);opacity:1}
.ft-h{font-size:.74rem;letter-spacing:.16em;text-transform:uppercase;font-weight:600;color:var(--muted)}
.ft-in{border-top:1px solid var(--line);padding-top:20px;padding-bottom:96px;align-items:center}
.ft-up{font-weight:600;color:var(--text);justify-self:start}.ft-up:hover{color:var(--accent)}
@media(min-width:860px){.ft-top{grid-template-columns:1.4fr 1fr 1fr;padding-top:64px}.ft-in{grid-template-columns:1fr auto;padding-bottom:28px}.ft .small{text-align:left}.ft-up{justify-self:end}}
.mbar{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:40;display:flex;gap:8px;padding:8px;border-radius:999px;background:${bg}eb;border:1px solid var(--line);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 20px 40px -18px ${shade};transform:translateY(140%);transition:transform .35s ease}
.mbar.show{transform:none}
.mbar a{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;border-radius:999px;font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 14px}
.mb-call{border:1px solid var(--line);color:var(--text);flex:0 0 auto!important}.mb-go{background:var(--accent);color:var(--on-accent)}
@media(min-width:860px){.mbar{display:none}}
@media(prefers-reduced-motion:reduce){.mq-in{animation:none}.btn,.card,.mbar{transition:none}}`);
  if (model.rich) css.push(`.hero::before{animation:glow 16s ease-in-out infinite alternate}
@keyframes glow{to{transform:translate(-14%,12%) scale(1.15)}}
.hero-art .art,.frame .art{transition:transform 1.2s cubic-bezier(.2,.7,.2,1)}.hero-art:hover .art,.frame:hover .art{transform:scale(1.05)}
.card{--mx:50%;--my:50%}
.card>*{position:relative}
.svc-cards .card,.svc-bento .card,.sc-grid .card{background-image:radial-gradient(260px circle at var(--mx) var(--my),${accent}24,transparent 70%)}
.chip-a{animation:bob 6s ease-in-out infinite}.chip-b{animation:bob 7s ease-in-out -2s infinite}
@keyframes bob{50%{transform:translateY(-8px)}}
@media(prefers-reduced-motion:reduce){.hero::before,.chip-a,.chip-b{animation:none}}`);
  if (model.level === 'ultra') css.push(`.js .hero h1 .w{display:inline-block;opacity:0;transform:translateY(.5em);transition:opacity .7s ease,transform .7s cubic-bezier(.2,.7,.2,1)}.js .hero h1.go .w{opacity:1;transform:none}
body{animation:pagein .5s ease both}@keyframes pagein{from{opacity:0}}
.page-top{position:relative;overflow:hidden;isolation:isolate}.page-top::before{content:"";position:absolute;z-index:-1;width:700px;height:700px;right:-200px;top:-420px;background:radial-gradient(closest-side,${accent}40,transparent 70%)}
@media(prefers-reduced-motion:reduce){.js .hero h1 .w{opacity:1;transform:none;transition:none}body{animation:none}}`);
  return css.join('\n');
}

function styles(model: Model) {
  const font = FONTS[model.fonts];
  const shape = SHAPES[model.shape];
  const { bg, surface, text, muted, accent, alt } = model.colors;
  const outline = model.shape === 'outline';
  const h1 = (min: number, vw: number, max: number) => `clamp(${(min * font.scale).toFixed(2)}rem, ${(vw * font.scale).toFixed(2)}vw, ${(max * font.scale).toFixed(2)}rem)`;
  const centered = model.align === 'center';
  const parts: string[] = [];
  parts.push(`/* ${model.name}: design recipe ${model.heroKind} / ${model.fonts} / ${model.shape} / ${model.nav} / ${model.servicesKind} / ${model.highlightsKind} / ${model.closingKind} / ${model.art} */
:root{--bg:${bg};--surface:${surface};--text:${text};--muted:${muted};--accent:${accent};--on-accent:${model.onAccent};--alt:${alt};--line:${text}26;--radius:${shape.radius};--radius-big:${shape.big};--radius-btn:${shape.button};--font-head:${font.head};--font-body:${font.body};--head-weight:${font.weight};--head-track:${font.track}}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:1.02rem;line-height:1.65;-webkit-font-smoothing:antialiased}
img,svg{max-width:100%}
a{color:inherit;text-decoration:none}
h1,h2,h3{font-family:var(--font-head);font-weight:var(--head-weight);letter-spacing:var(--head-track);line-height:1.08;margin:0${font.upper ? ';text-transform:uppercase' : ''}}
h1{font-size:${h1(2.3, 6.2, 4.4)}}
h2{font-size:${h1(1.8, 4, 2.9)}}
h3{font-size:${(1.2 * Math.max(font.scale, 0.95)).toFixed(2)}rem;line-height:1.25}
p{margin:0}
.wrap{width:100%;max-width:1120px;margin:0 auto;padding:0 20px}
.narrow{max-width:780px}
.sec{padding:64px 0}
.sec:nth-of-type(even){background:var(--surface)}
.lead{font-size:1.14rem;color:var(--muted);margin-top:18px;max-width:60ch}
.sh{margin-bottom:34px;max-width:680px${centered ? ';margin-left:auto;margin-right:auto;text-align:center' : ''}}
.sh h2{margin-top:12px}
.art{display:block;width:100%;height:100%}
.two{display:grid;gap:36px;align-items:center}
.frame{aspect-ratio:1/1;border-radius:var(--radius-big);overflow:hidden${outline ? ';border:2px solid var(--text)' : ''}}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;padding:12px 24px;border-radius:var(--radius-btn);background:var(--accent);color:var(--on-accent);font:600 1rem var(--font-body);border:2px solid var(--accent);cursor:pointer;transition:transform .2s ease,opacity .2s ease}
.btn:hover{transform:translateY(-2px);opacity:.92}
.btn-ghost{background:transparent;color:var(--text);border-color:var(--line)}
.btn-sm{min-height:42px;padding:8px 18px;font-size:.92rem}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.card{background:${outline ? 'transparent' : 'var(--surface)'};border:${outline ? '2px solid var(--text)' : '1px solid var(--line)'};border-radius:var(--radius);padding:26px${outline ? ';box-shadow:5px 5px 0 var(--accent)' : model.shape === 'soft' ? ';box-shadow:0 12px 30px -18px rgba(0,0,0,.35)' : ''}}
.sec:nth-of-type(even) .card{background:${outline ? 'transparent' : 'var(--bg)'}}
.card h3{margin-bottom:8px}
.card p,.svc-list p,.svc-alt p,.hl-grid p,.process p{color:var(--muted)}
.tick{display:inline-grid;place-items:center;width:40px;height:40px;border-radius:${model.shape === 'sharp' ? '0' : '50%'};background:var(--alt);color:var(--accent);margin-bottom:16px}
.ph{display:inline-block;padding:2px 10px;border:1.5px dashed var(--muted);border-radius:6px;color:var(--muted);font-size:.86rem;font-style:italic}
.facts{display:flex;flex-wrap:wrap;gap:10px 22px;margin-top:26px;font-size:.95rem;color:var(--muted)}
.facts>*{display:inline-flex;align-items:center;gap:8px}
.facts svg{color:var(--accent)}
.sample,.small{font-size:.85rem;color:var(--muted)}
.sample{margin:-14px 0 24px${centered ? ';text-align:center' : ''}}
.more{margin-top:28px${centered ? ';text-align:center' : ''}}
.page-top{padding:56px 0 8px}
.page-top h1{margin-top:12px}
@media(min-width:860px){.sec{padding:96px 0}.two{grid-template-columns:1fr 1fr;gap:64px}}`);

  // Small label above headings: its style follows the shape language.
  if (model.shape === 'round') parts.push('.eyebrow{display:inline-block;padding:6px 14px;border-radius:999px;background:var(--alt);color:var(--accent);font-size:.78rem;font-weight:600;letter-spacing:.06em}');
  else if (model.shape === 'sharp') parts.push('.eyebrow{display:inline-flex;align-items:center;gap:12px;color:var(--accent);font-size:.76rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase}.eyebrow::before{content:"";width:36px;height:1px;background:var(--accent)}');
  else if (outline) parts.push('.eyebrow{display:inline-block;padding:4px 10px;border:2px solid var(--text);background:var(--accent);color:var(--on-accent);font-size:.76rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}');
  else parts.push('.eyebrow{color:var(--accent);font-size:.8rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase}');

  // Header and navigation.
  parts.push(`.hd{position:sticky;top:0;z-index:30;background:var(--bg);border-bottom:1px solid var(--line)}
.hd-in{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:68px;position:relative}
.logo{font-family:var(--font-head);font-weight:var(--head-weight);font-size:1.2rem;letter-spacing:var(--head-track);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap${font.upper ? ';text-transform:uppercase' : ''}}
.links{display:none;position:absolute;top:100%;left:0;right:0;flex-direction:column;gap:4px;padding:14px 20px 20px;background:var(--bg);border-bottom:1px solid var(--line)}
.links a{padding:10px 0;font-weight:500}
.links a[aria-current],.links a:hover{color:var(--accent)}
.hd.open .links{display:flex}
.menu-btn{display:inline-grid;place-items:center;width:46px;height:46px;background:transparent;color:var(--text);border:1px solid var(--line);border-radius:var(--radius-btn);cursor:pointer;flex:none}
.hd-cta{display:none}`);
  if (model.nav === 'minimal') parts.push('@media(min-width:860px){.hd-cta{display:inline-flex;margin-left:auto}.links{left:auto;right:20px;width:280px;border:1px solid var(--line);border-radius:var(--radius)}}');
  else {
    parts.push('@media(min-width:860px){.links{display:flex;position:static;flex-direction:row;gap:28px;padding:0;background:none;border:0;font-size:.95rem}.menu-btn{display:none}.hd-cta{display:inline-flex}}');
    if (model.nav === 'center') parts.push('@media(min-width:860px){.hd-in{display:grid;grid-template-columns:1fr auto 1fr}.links{order:-1}.logo{font-size:1.5rem;text-align:center}.hd-cta{justify-self:end}}');
    if (model.nav === 'pill') parts.push('.hd{background:transparent;border:0;padding-top:12px}.hd-in{max-width:1080px;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:0 10px 0 24px;min-height:60px;width:calc(100% - 28px)}.links{top:calc(100% + 8px);border:1px solid var(--line);border-radius:24px}.menu-btn{border-radius:50%}');
  }

  // Opening section: one of six structures.
  parts.push('.hero{padding:56px 0 64px}.hero h1{margin-top:16px}.hero-grid{display:grid;gap:40px;align-items:center}.hero-art{position:relative;aspect-ratio:4/5;max-height:560px;border-radius:var(--radius-big);overflow:hidden}@media(min-width:860px){.hero{padding:88px 0 96px}}');
  if (model.heroKind === 'split') parts.push(`@media(min-width:860px){.hero-grid{grid-template-columns:1.1fr .9fr;gap:64px}}${outline ? '.hero-art{border:2px solid var(--text);box-shadow:8px 8px 0 var(--accent)}' : ''}`);
  if (model.heroKind === 'full') parts.push('.hero-full{position:relative;padding:0;min-height:min(88vh,760px);display:flex;align-items:flex-end}.hero-bg{position:absolute;inset:0}.hero-full .wrap{position:relative}.hero-panel{background:var(--bg);padding:28px 24px;margin:180px 0 28px;max-width:640px;border-radius:var(--radius-big);border:1px solid var(--line)}@media(min-width:860px){.hero-full{padding:0}.hero-panel{padding:44px;margin-bottom:56px}}');
  if (model.heroKind === 'type') parts.push(`.hero-type{text-align:center;padding-bottom:0}.hero-type h1{font-size:${h1(2.7, 9.5, 7)};max-width:14ch;margin-left:auto;margin-right:auto}.hero-type .lead{margin-left:auto;margin-right:auto}.hero-type .actions,.hero-type .facts{justify-content:center}.ticker{margin-top:56px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:16px 0}.ticker .wrap{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 28px;font-family:var(--font-head);font-size:1.02rem;color:var(--muted)}.ticker span+span::before{content:"/";margin-right:28px;color:var(--accent)}@media(min-width:860px){.hero-type{padding-bottom:0}}`);
  if (model.heroKind === 'form') parts.push('.hero-form{background:var(--alt)}.hero-form .form{background:var(--bg)}@media(min-width:860px){.hero-grid{grid-template-columns:1.15fr .85fr;gap:56px}}');
  if (model.heroKind === 'stack') parts.push('.hero-stack{text-align:center;padding-bottom:0}.hero-stack h1{max-width:18ch;margin-left:auto;margin-right:auto}.hero-stack .lead{margin-left:auto;margin-right:auto}.hero-stack .actions{justify-content:center}.hero-band{position:relative;margin-top:48px;height:clamp(240px,42vw,460px);border-radius:var(--radius-big) var(--radius-big) 0 0;overflow:hidden}.band-card{position:absolute;left:16px;right:16px;bottom:16px;padding:14px 20px;background:var(--bg)}.band-card .facts{margin-top:0;justify-content:center}@media(min-width:860px){.hero-stack{padding-bottom:0}.band-card{left:auto;right:28px;bottom:28px}}');
  if (model.heroKind === 'offset') parts.push('.hero-offset .hero-art{overflow:visible;aspect-ratio:1/1;margin-bottom:36px}.hero-offset .hero-art .art{border-radius:var(--radius-big)}.float-card{position:absolute;left:16px;right:16px;bottom:-32px;background:var(--bg);padding:18px 20px}.float-card .facts{margin-top:8px}@media(min-width:860px){.hero-grid{grid-template-columns:.9fr 1.1fr;gap:72px}.float-card{left:auto;right:-36px;max-width:320px}}');

  // Services: one of four structures.
  if (model.servicesKind === 'cards') parts.push('.svc-cards{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}');
  if (model.servicesKind === 'list') parts.push('.svc-list article{display:grid;gap:8px 28px;padding:26px 0;border-top:1px solid var(--line)}.svc-list article:last-child{border-bottom:1px solid var(--line)}.svc-list .no{font-family:var(--font-head);color:var(--accent);font-size:1rem}@media(min-width:860px){.svc-list article{grid-template-columns:70px 1fr 1.4fr;align-items:baseline}.svc-list h3{font-size:1.5rem}}');
  if (model.servicesKind === 'alt') parts.push('.svc-alt{display:grid;gap:34px}.svc-alt article{display:flex;gap:22px;align-items:flex-start;max-width:680px}.svc-alt .no{font-family:var(--font-head);font-weight:var(--head-weight);font-size:3.4rem;line-height:.9;color:var(--accent);opacity:.9;min-width:1.5em}.svc-alt h3{font-size:1.45rem;margin-bottom:6px}@media(min-width:860px){.svc-alt article:nth-child(even){margin-left:auto;flex-direction:row-reverse;text-align:right}}');
  if (model.servicesKind === 'bento') parts.push('.svc-bento{display:grid;gap:18px}.svc-bento .no{display:block;font-family:var(--font-head);color:var(--accent);margin-bottom:28px}.svc-bento article:first-child,.sec:nth-of-type(even) .svc-bento article:first-child{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}.svc-bento article:first-child p,.svc-bento article:first-child .no{color:var(--on-accent);opacity:.88}@media(min-width:860px){.svc-bento{grid-template-columns:repeat(6,1fr)}.svc-bento article{grid-column:span 2}.svc-bento article:first-child{grid-column:span 4}.svc-bento article:first-child h3{font-size:2rem}.svc-bento article:nth-child(3):nth-last-child(2),.svc-bento article:nth-child(4):last-child{grid-column:span 3}.svc-bento article:nth-child(3):last-child,.svc-bento article:nth-child(6):last-child{grid-column:span 6}}');

  // Reasons to choose the business: one of three structures.
  parts.push('.hl-grid{display:grid;gap:28px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.hl-grid h3{margin-bottom:8px}');
  if (model.highlightsKind === 'numbers') parts.push('.hl-numbers .big{display:block;font-family:var(--font-head);font-weight:var(--head-weight);font-size:4.2rem;line-height:1;color:transparent;-webkit-text-stroke:1.5px var(--accent);margin-bottom:14px}.hl-numbers article{border-top:1px solid var(--line);padding-top:22px}');
  if (model.highlightsKind === 'band') parts.push('.sec.hl-band,.sec.hl-band:nth-of-type(even){background:var(--alt)}.hl-band .hl-grid{gap:0}.hl-band article{padding:24px 0;border-top:1px solid var(--line)}.hl-band .tick{background:var(--accent);color:var(--on-accent)}@media(min-width:860px){.hl-band article{padding:8px 28px;border-top:0;border-left:1px solid var(--line)}.hl-band article:first-child{padding-left:0;border-left:0}}');

  parts.push(`.process ol{list-style:none;margin:0;padding:0}.process h3{margin-bottom:6px}
.step{display:inline-grid;place-items:center;width:44px;height:44px;border-radius:${model.shape === 'sharp' || outline ? '0' : '50%'};background:var(--accent);color:var(--on-accent);font-weight:700;margin-bottom:16px}
.pr-steps{display:grid;gap:28px;grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}
.pr-timeline{max-width:680px;border-left:2px solid var(--line);margin-left:21px!important${centered ? ';margin-right:auto!important;margin-left:auto!important' : ''}}
.pr-timeline li{position:relative;padding:0 0 34px 44px}.pr-timeline li:last-child{padding-bottom:0}.pr-timeline .step{position:absolute;left:-23px;top:-6px;margin:0}
.sc-grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.sc-grid .card{display:flex;flex-direction:column;align-items:flex-start;gap:6px}.sc-grid .btn{margin-top:auto}.sc-grid p{margin-bottom:12px}
.thumb{width:calc(100% + 52px);margin:-26px -26px 14px;aspect-ratio:16/10;overflow:hidden;border-radius:var(--radius) var(--radius) 0 0}
.tag{font-size:.76rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)!important;font-weight:600;margin:0!important}
.sc-form{max-width:560px;margin:40px ${centered ? 'auto' : '0'} 0}
.form{display:grid;gap:14px}.form label{display:grid;gap:6px;font-size:.88rem;font-weight:600}
.form input,.form textarea{width:100%;padding:12px 14px;font:inherit;font-weight:400;color:var(--text);background:transparent;border:1px solid var(--line);border-radius:var(--radius-btn);min-height:46px}
.form textarea{border-radius:${model.shape === 'round' ? '20px' : 'var(--radius-btn)'}}
.form input:focus,.form textarea:focus{outline:2px solid var(--accent);outline-offset:1px}
.notice,.choice{font-size:.9rem;color:var(--accent)!important}
.faq details{padding:0;margin-bottom:12px}.faq summary{cursor:pointer;list-style:none;padding:20px 24px;font-weight:600;display:flex;justify-content:space-between;gap:16px}.faq summary::-webkit-details-marker{display:none}.faq summary::after{content:"+";color:var(--accent);font-size:1.3rem;line-height:1}.faq details[open] summary::after{content:"-"}.faq details p{padding:0 24px 22px}
.contact-list{list-style:none;margin:28px 0 0;padding:0;display:grid;gap:14px}.contact-list li{display:flex;align-items:center;flex-wrap:wrap;gap:10px}.contact-list svg{color:var(--accent);flex:none}.contact-list a{font-weight:600;border-bottom:1px solid currentColor}
.ft{border-top:1px solid var(--line);padding:36px 0;color:var(--muted);font-size:.92rem}.ft-in{display:grid;gap:14px}.ft .logo{color:var(--text);margin-bottom:4px}
@media(min-width:860px){.ft-in{grid-template-columns:1fr 1fr;align-items:end}.ft .small{text-align:right}}`);

  // Closing and contact: one of three structures.
  if (model.closingKind === 'band') parts.push('.closing-band{background:var(--accent);color:var(--on-accent);padding:72px 0;text-align:center}.closing-band .lead{color:inherit;opacity:.88;margin-left:auto;margin-right:auto}.closing-band .contact-list{justify-items:center}.closing-band .contact-list svg{color:inherit}.closing-band .ph{color:inherit;border-color:currentColor;opacity:.85}.closing-band .form{margin-top:40px;text-align:left;background:var(--bg);color:var(--text)}@media(min-width:860px){.closing-band{padding:104px 0}.closing-band .contact-list{grid-template-columns:repeat(2,auto);justify-content:center;gap:14px 40px}}');
  if (model.closingKind === 'card') parts.push('.big-card{padding:32px 24px}.after{margin-top:28px}@media(min-width:860px){.big-card{padding:64px}.big-card .contact-list{grid-template-columns:1fr 1fr}}');
  if (model.closingKind === 'split') parts.push('.closing-split .two{align-items:start}.closing-split .contact-list{margin-top:0}.closing-split .contact-list li{padding:14px 0;border-bottom:1px solid var(--line)}.closing-split .form{margin-top:28px}');

  parts.push(premium(model));
  if (model.motion) parts.push('.js .rv{opacity:0;transform:translateY(18px);transition:opacity .6s ease,transform .6s ease}.js .rv.in{opacity:1;transform:none}@media(prefers-reduced-motion:reduce){.js .rv{opacity:1;transform:none;transition:none}html{scroll-behavior:auto}}');
  return parts.join('\n');
}

const SCRIPT = `// Small behaviours: menu, gentle reveal on scroll, sample enquiry forms.
(function () {
  document.documentElement.classList.add('js');
  var header = document.querySelector('.hd');
  var menu = document.querySelector('[data-menu]');
  if (header && menu) {
    menu.addEventListener('click', function () {
      var open = header.classList.toggle('open');
      menu.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    header.querySelectorAll('.links a').forEach(function (item) {
      item.addEventListener('click', function () { header.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); });
    });
  }
  document.querySelectorAll('a[href^="#"]').forEach(function (item) {
    item.addEventListener('click', function (event) {
      var target = document.getElementById(item.getAttribute('href').slice(1));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  var items = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window) {
    var watcher = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) { entry.target.classList.add('in'); watcher.unobserve(entry.target); } });
    }, { threshold: 0.08 });
    items.forEach(function (item) { watcher.observe(item); });
  } else {
    items.forEach(function (item) { item.classList.add('in'); });
  }
  // Cards in a row arrive one after another.
  items.forEach(function (item) {
    var group = item.parentNode ? Array.prototype.filter.call(item.parentNode.children, function (child) { return child.classList.contains('rv'); }) : [];
    var place = group.indexOf(item);
    if (place > 0) item.style.transitionDelay = Math.min(place, 5) * 90 + 'ms';
  });
  // Reading progress line, header shadow and the phone action bar.
  var bar = document.querySelector('[data-bar]');
  var mbar = document.querySelector('[data-mbar]');
  var busy = false;
  function onScroll() {
    busy = false;
    var top = window.pageYOffset || document.documentElement.scrollTop || 0;
    var full = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.width = (full > 0 ? Math.min(100, (top / full) * 100) : 0) + '%';
    if (header) header.classList.toggle('scrolled', top > 12);
    if (mbar) mbar.classList.toggle('show', top > 420 && top < full - 260);
  }
  window.addEventListener('scroll', function () { if (!busy) { busy = true; window.requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  var level = document.body.getAttribute('data-level');
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Hybrid and Ultra: a soft light follows the pointer across cards.
  if (level !== 'mid' && !calm) {
    document.querySelectorAll('.card').forEach(function (card) {
      card.addEventListener('pointermove', function (event) {
        var box = card.getBoundingClientRect();
        card.style.setProperty('--mx', (event.clientX - box.left) + 'px');
        card.style.setProperty('--my', (event.clientY - box.top) + 'px');
      });
    });
  }
  // Ultra: the main headline arrives word by word.
  if (level === 'ultra' && !calm) {
    var title = document.querySelector('.hero h1');
    if (title) {
      var count = 0;
      var wrap = function (node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (child) {
          if (child.nodeType === 3) {
            var piece = document.createDocumentFragment();
            child.textContent.split(/(\\s+)/).forEach(function (word) {
              if (!word) return;
              if (/^\\s+$/.test(word)) { piece.appendChild(document.createTextNode(' ')); return; }
              var span = document.createElement('span');
              span.className = 'w';
              span.style.transitionDelay = (count++ * 70) + 'ms';
              span.textContent = word;
              piece.appendChild(span);
            });
            node.replaceChild(piece, child);
          } else if (child.nodeType === 1) wrap(child);
        });
      };
      wrap(title);
      window.setTimeout(function () { title.classList.add('go'); }, 60);
    }
  }
  var chosen = [];
  document.querySelectorAll('[data-choose]').forEach(function (button) {
    button.addEventListener('click', function () {
      var form = document.getElementById('showcase-form');
      if (!form) return;
      var name = button.getAttribute('data-choose');
      if (chosen.indexOf(name) < 0) chosen.push(name);
      var line = form.querySelector('[data-choice]');
      line.hidden = false;
      line.textContent = 'Selected: ' + chosen.join(', ');
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
  document.querySelectorAll('[data-demo-form]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      form.querySelector('[data-notice]').hidden = false;
    });
  });
})();
`;

// Only used inside the app preview: page links ask the app to show another page.
const PREVIEW_BRIDGE = `document.addEventListener('click', function (event) {
  var item = event.target && event.target.closest ? event.target.closest('a[data-page]') : null;
  if (!item) return;
  event.preventDefault();
  parent.postMessage({ crDemoPage: item.getAttribute('data-page') }, '*');
});`;

function document_(model: Model, page: SitePage, inline: boolean) {
  shownPhotos = new Set<number>();
  const font = FONTS[model.fonts];
  const title = page.key === 'home' ? `${model.name}${model.city ? ` | ${model.city}` : ''}` : `${page.label} | ${model.name}`;
  const description = String(model.hero.description || model.about.body || '').slice(0, 155);
  const css = inline ? `<style>${styles(model)}</style>` : '<link rel="stylesheet" href="css/styles.css">';
  const script = inline ? `<script>${SCRIPT}${PREVIEW_BRIDGE}</script>` : '<script src="js/site.js" defer></script>';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${font.query}&amp;display=swap">
${css}
</head>
<body data-level="${model.level}">
<div class="bar" data-bar></div>
${header(model, page.key)}
<main>
${pageBody(model, page.key)}
</main>
${footer(model)}
${mobileBar(model)}
${script}
</body>
</html>
`;
}

export function hasDesign(content: any) {
  return Boolean(content && content.design && content.design.version);
}

export function sitePages(content: any): SitePage[] {
  return pageList(readContent(content));
}

// One complete page with its styles and script inside it, for the in-app preview frame.
export function renderPreviewPage(content: any, pageKey: string) {
  const model = readContent(content);
  const pages = pageList(model);
  artCount = 0;
  return document_(model, pages.find((page) => page.key === pageKey) || pages[0], true);
}

// The full website as separate files, ready to unzip and host anywhere. Contains no keys or secrets.
export function buildDemoSite(content: any): SiteFiles {
  const model = readContent(content);
  const pages = pageList(model);
  const files: SiteFiles = {};
  pages.forEach((page) => { artCount = 0; files[page.file] = document_(model, page, false); });
  files['css/styles.css'] = `${styles(model)}\n`;
  files['js/site.js'] = SCRIPT;
  const slug = model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'demo-site';
  files['package.json'] = `${JSON.stringify({ name: slug, version: '1.0.0', private: true, description: `Website concept for ${model.name}`, scripts: { start: 'npx serve .' } }, null, 2)}\n`;
  files['.env.example'] = '# This website is plain HTML, CSS and JavaScript and needs no keys or secrets.\n# If a contact form service is added later, put its key NAME here and keep the value out of Git.\n';
  files['README.md'] = [
    `# ${model.name}: website concept`,
    '',
    'A complete static website: open `index.html` in any browser, or upload the whole folder to any web host (Vercel, Netlify, cPanel).',
    'To preview it locally with a small server, run `npm start` in this folder.',
    '',
    '## Files',
    ...pages.map((page) => `- \`${page.file}\`: ${page.label} page`),
    '- `css/styles.css`: all colours, fonts and layout',
    '- `js/site.js`: menu, scroll animation and the sample forms',
    '',
    '## Before this goes live',
    '- Replace every dashed placeholder (search the HTML for `class="ph"`): phone, email, street address, opening hours.',
    model.photos.some((photo) => photo.sample) ? '- Photos marked "Sample photo" come from Pexels and show the type of business, not this business. Replace them with real photographs. Keep the Pexels credit in the footer while any sample photo remains.' : '',
    model.photos.some((photo) => !photo.sample) ? '- Unmarked photos were read from the business\'s current website and still load from there. Confirm with the owner that they may be used, then save copies into this folder.' : '',
    '- Replace any remaining decorative artwork with real photographs of the business.',
    model.showcase.length ? `- The ${SHOWCASE[model.kind].nav.toLowerCase()} section holds SAMPLE content. Replace it with real items.` : '',
    '- The forms are samples and send nothing. Connect them to an email or form service.',
    '- Confirm every statement with the business owner. Nothing here is a verified claim, award, review or price.',
    '',
    '## Design recipe',
    `Opening: ${model.heroKind}. Fonts: ${model.fonts}. Shapes: ${model.shape}. Navigation: ${model.nav}. Services: ${model.servicesKind}. Reasons: ${model.highlightsKind}. Closing: ${model.closingKind}. Artwork: ${model.art}.`,
    `Colours: background ${model.colors.bg}, text ${model.colors.text}, accent ${model.colors.accent}.`,
    '',
  ].filter((line, index, all) => line !== '' || all[index - 1] !== '').join('\n');
  return files;
}
