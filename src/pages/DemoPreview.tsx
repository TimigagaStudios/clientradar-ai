import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { ArrowLeft, ArrowRight, CalendarCheck, CheckCircle2, ChevronDown, Home, Instagram, Mail, MapPin, Minus, Phone, Plus, ShoppingBag, Sparkles, UtensilsCrossed, X } from 'lucide-react';

type Pair = { title: string; body: string };
type Faq = { question: string; answer: string };
type PageKey = 'home' | 'about' | 'services' | 'showcase' | 'faq' | 'contact';
type ShowcaseKind = 'listings' | 'menu' | 'products' | 'booking';
type ShowcaseItem = { title: string; subtitle?: string; detail: string };

const SHOWCASE_TEXT: Record<ShowcaseKind, { nav: string; eyebrow: string; action: string; formTitle: string; formButton: string; extra: 'message' | 'date' | 'guests' | 'none' }> = {
  listings: { nav: 'Listings', eyebrow: 'Listings', action: 'Enquire', formTitle: 'Property enquiry', formButton: 'Send enquiry', extra: 'message' },
  menu: { nav: 'Menu', eyebrow: 'Menu', action: 'View', formTitle: 'Reserve a table', formButton: 'Request reservation', extra: 'guests' },
  products: { nav: 'Shop', eyebrow: 'Shop', action: 'Add to cart', formTitle: 'Checkout', formButton: 'Place order', extra: 'none' },
  booking: { nav: 'Book', eyebrow: 'Booking', action: 'Book this', formTitle: 'Request an appointment', formButton: 'Request booking', extra: 'date' },
};
const SHOWCASE_ICON = { listings: Home, menu: UtensilsCrossed, products: ShoppingBag, booking: CalendarCheck };

const DEFAULT_THEME = { background: '#0b1026', surface: '#131d3d', accent: '#ff7a00', text: '#f8fafc', muted: '#b6c0d9' };

const isHex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

// Picks black or white text so buttons stay readable on any accent color.
function readableOn(hex: string) {
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? '#111111' : '#ffffff';
}

function asPairs(value: unknown): Pair[] {
  return Array.isArray(value) ? value.filter((item) => item && item.title && item.body) : [];
}

function Reveal({ children, animated, className, style }: { children: ReactNode; animated: boolean; className?: string; style?: CSSProperties }) {
  if (!animated) return <div className={className} style={style}>{children}</div>;
  return (
    <motion.div className={className} style={style} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
      {children}
    </motion.div>
  );
}

export default function DemoPreview() {
  const { id } = useParams();
  const [job, setJob] = useState<any>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState<PageKey>('home');
  const [openFaq, setOpenFaq] = useState(0);
  const [activeItem, setActiveItem] = useState(-1);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [formChoice, setFormChoice] = useState('');
  const [formNotice, setFormNotice] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/demo-jobs?jobId=${encodeURIComponent(id)}`).then(async (response) => {
      const text = await response.text();
      let result: any;
      try { result = JSON.parse(text); } catch { throw new Error(`Demo API ${response.status}: ${text.slice(0, 160)}`); }
      if (!response.ok || !result.success) throw new Error(result.error || 'Demo not found');
      setJob(result.data);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Demo not found'));
  }, [id]);

  // Tell the server a visitor opened this demo: once per browser session, and never for the logged-in owner.
  useEffect(() => {
    if (!id || !job) return;
    const key = `demo-viewed-${id}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { /* storage blocked: still count */ }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) return;
      void fetch('/api/demo-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'view', jobId: id }), keepalive: true }).catch(() => undefined);
    }).catch(() => undefined);
  }, [id, job]);

  if (error) return <div className="min-h-screen grid place-items-center bg-[var(--bg)] p-6 text-[var(--text-primary)]"><div className="neo-card p-8 text-center"><p className="text-red-500">{error}</p><Link to="/demos" className="btn-neumorph mt-5 inline-flex">Back to demos</Link></div></div>;
  if (!job) return <div className="min-h-screen grid place-items-center bg-[var(--bg)] text-[var(--text-secondary)]">Loading demo...</div>;

  const content = job.content || {};
  const rawTheme = content.theme || {};
  const theme = {
    background: isHex(rawTheme.background) ? rawTheme.background : DEFAULT_THEME.background,
    surface: isHex(rawTheme.surface) ? rawTheme.surface : DEFAULT_THEME.surface,
    accent: isHex(rawTheme.accent) ? rawTheme.accent : DEFAULT_THEME.accent,
    text: isHex(rawTheme.text) ? rawTheme.text : DEFAULT_THEME.text,
    muted: isHex(rawTheme.muted) ? rawTheme.muted : DEFAULT_THEME.muted,
  };
  const level: 'mid' | 'hybrid' | 'ultra' = content.styleLevel === 'ultra' || content.styleLevel === 'hybrid' ? content.styleLevel : 'mid';
  const animated = level !== 'mid';
  const multiPage = level === 'ultra';

  const businessName: string = content.businessName || job.leads?.business_name || 'Business';
  const hero = content.hero || {};
  const about = content.about || {};
  const closing = content.closing || {};
  const legacy = asPairs(content.sections);
  const services = asPairs(content.services);
  const highlights = asPairs(content.highlights);
  const process = asPairs(content.process);
  const faq: Faq[] = Array.isArray(content.faq) ? content.faq.filter((item: any) => item && item.question && item.answer) : [];
  const showcaseKind: ShowcaseKind = ['listings', 'menu', 'products', 'booking'].includes(content.showcase?.kind) ? content.showcase.kind : 'booking';
  const showcaseItems: ShowcaseItem[] = Array.isArray(content.showcase?.items) ? content.showcase.items.filter((item: any) => item && item.title && item.detail) : [];
  const showcaseText = SHOWCASE_TEXT[showcaseKind];
  const ShowcaseIcon = SHOWCASE_ICON[showcaseKind];
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const contact = content.contact || {};
  const instagram = typeof contact.instagram === 'string' ? contact.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '') : '';

  const border = `1px solid ${theme.muted}33`;
  const muted: CSSProperties = { color: theme.muted };
  const accentText: CSSProperties = { color: theme.accent };
  const card: CSSProperties = { backgroundColor: theme.surface, border, borderRadius: 24 };
  const primaryButton: CSSProperties = { backgroundColor: theme.accent, color: readableOn(theme.accent) };
  const wrap = 'mx-auto w-full max-w-6xl px-5 sm:px-8';

  const pages: { key: PageKey; label: string }[] = [
    { key: 'home', label: 'Home' },
    { key: 'about', label: 'About' },
    { key: 'services', label: 'Services' },
    ...(showcaseItems.length ? [{ key: 'showcase' as PageKey, label: showcaseText.nav }] : []),
    ...(faq.length ? [{ key: 'faq' as PageKey, label: 'FAQ' }] : []),
    { key: 'contact', label: 'Contact' },
  ];
  const goTo = (key: PageKey) => { setPage(key); window.scrollTo({ top: 0 }); };
  const show = (key: PageKey) => !multiPage || page === key;
  const contactAction = () => {
    if (multiPage) return goTo('contact');
    document.getElementById('demo-contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  const field: CSSProperties = { backgroundColor: theme.background, color: theme.text, border, borderRadius: 14 };
  const changeCart = (index: number, amount: number) => setCart((current) => {
    const next = { ...current, [index]: Math.max(0, (current[index] || 0) + amount) };
    if (!next[index]) delete next[index];
    return next;
  });
  const chooseItem = (index: number) => {
    setFormNotice(false);
    if (showcaseKind === 'products') return changeCart(index, 1);
    setFormChoice(showcaseItems[index]?.title || '');
    if (multiPage) setActiveItem(index);
    if (showcaseKind !== 'menu') document.getElementById('demo-showcase-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const heading = (eyebrow: string, title: string) => (
    <div className="mb-8 max-w-2xl">
      <p className="text-xs font-bold uppercase tracking-[0.2em]" style={accentText}>{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">{title}</h2>
    </div>
  );

  return (
    <main className="min-h-screen" style={{ backgroundColor: theme.background, color: theme.text }}>
      <div className="px-5 py-2 text-center text-[11px] font-bold uppercase tracking-[0.18em] sm:px-8" style={{ backgroundColor: theme.surface, color: theme.muted, borderBottom: border }}>
        <Link to="/demos" className="mr-3 inline-flex items-center gap-1 align-middle" style={muted}><ArrowLeft size={12} /> Demo Factory</Link>
        <span className="inline-flex items-center gap-1 align-middle" style={accentText}><Sparkles size={12} /> Demo concept</span>
      </div>

      <header className="sticky top-0 z-20" style={{ backgroundColor: theme.background, borderBottom: border }}>
        <div className={`${wrap} flex items-center justify-between gap-4 py-4`}>
          <button type="button" onClick={() => goTo('home')} className="min-w-0 truncate text-left text-lg font-black tracking-tight">{businessName}</button>
          {multiPage && (
            <nav className="hidden items-center gap-1 md:flex" aria-label="Demo pages">
              {pages.map((item) => (
                <button key={item.key} type="button" onClick={() => goTo(item.key)} className="rounded-full px-4 py-2 text-sm font-semibold transition-colors" style={page === item.key ? primaryButton : muted}>{item.label}</button>
              ))}
            </nav>
          )}
          <button type="button" onClick={contactAction} className="shrink-0 rounded-full px-5 py-2.5 text-sm font-bold" style={primaryButton}>{hero.cta || 'Get in touch'}</button>
        </div>
        {multiPage && (
          <nav className="flex gap-2 overflow-x-auto px-5 pb-3 md:hidden" aria-label="Demo pages">
            {pages.map((item) => (
              <button key={item.key} type="button" onClick={() => goTo(item.key)} className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold" style={page === item.key ? primaryButton : { ...muted, border }}>{item.label}</button>
            ))}
          </nav>
        )}
      </header>

      {show('home') && (
        <section className={`${wrap} pb-16 pt-14 sm:pb-24 sm:pt-20`}>
          <Reveal animated={animated}>
            <p className="text-sm font-bold uppercase tracking-[0.2em]" style={accentText}>{hero.eyebrow || content.category}</p>
            <h1 className={`mt-4 max-w-4xl font-black leading-[1.05] ${level === 'mid' ? 'text-4xl sm:text-6xl' : 'text-5xl sm:text-7xl'}`}>{hero.title || businessName}</h1>
            {hero.description && <p className="mt-6 max-w-2xl text-lg leading-8" style={muted}>{hero.description}</p>}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button type="button" onClick={contactAction} className="inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 font-bold shadow-lg" style={primaryButton}>{hero.cta || 'Get in touch'} <ArrowRight size={16} /></button>
              {content.city && <span className="inline-flex items-center gap-2 text-sm" style={muted}><MapPin size={16} style={accentText} />{content.city}</span>}
            </div>
          </Reveal>
        </section>
      )}

      {show('home') && legacy.length > 0 && services.length === 0 && (
        <section className={`${wrap} grid gap-5 pb-16 md:grid-cols-3`}>
          {legacy.map((item) => <article key={item.title} className="p-6" style={card}><CheckCircle2 className="mb-5" style={accentText} size={24} /><h2 className="text-xl font-bold">{item.title}</h2><p className="mt-3 leading-7" style={muted}>{item.body}</p></article>)}
        </section>
      )}

      {show('about') && about.body && (
        <section className={`${wrap} pb-16 sm:pb-24 ${multiPage ? 'pt-14' : ''}`}>
          <Reveal animated={animated} className="grid gap-8 p-7 sm:p-10 md:grid-cols-[1fr_1.4fr]" style={card}>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em]" style={accentText}>About</p>
              <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">{about.title || `About ${businessName}`}</h2>
            </div>
            <p className="text-lg leading-8" style={muted}>{about.body}</p>
          </Reveal>
        </section>
      )}

      {show('services') && services.length > 0 && (
        <section className={`${wrap} pb-16 sm:pb-24 ${multiPage ? 'pt-14' : ''}`}>
          {heading('Services', 'What we offer')}
          <div className={`grid gap-5 sm:grid-cols-2 ${services.length === 4 ? '' : 'lg:grid-cols-3'}`}>
            {services.map((item, index) => (
              <Reveal key={item.title} animated={animated} className="p-6" style={card}>
                <span className="text-sm font-black" style={accentText}>{String(index + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 text-xl font-bold">{item.title}</h3>
                <p className="mt-3 leading-7" style={muted}>{item.body}</p>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {show('showcase') && showcaseItems.length > 0 && (
        <section className={`${wrap} pb-16 sm:pb-24 ${multiPage ? 'pt-14' : ''}`}>
          {heading(showcaseText.eyebrow, content.showcase?.title || showcaseText.nav)}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {showcaseItems.map((item, index) => (
              <Reveal key={`${item.title}-${index}`} animated={animated} className="flex flex-col overflow-hidden" style={card}>
                <div className="relative grid h-36 place-items-center" style={{ background: `linear-gradient(135deg, ${theme.accent}55, ${theme.background})` }}>
                  <ShowcaseIcon size={40} style={accentText} />
                  <span className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ backgroundColor: theme.background, color: theme.muted }}>Sample</span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  {item.subtitle && <p className="text-xs font-bold uppercase tracking-[0.16em]" style={accentText}>{item.subtitle}</p>}
                  <h3 className="mt-2 text-lg font-bold">{item.title}</h3>
                  <p className="mt-2 flex-1 leading-7" style={muted}>{item.detail}</p>
                  {showcaseKind === 'products' && cart[index] ? (
                    <div className="mt-4 inline-flex items-center gap-3 self-start rounded-full px-2 py-1.5" style={{ border }}>
                      <button type="button" aria-label={`Remove one ${item.title}`} onClick={() => changeCart(index, -1)} className="grid h-8 w-8 place-items-center rounded-full" style={primaryButton}><Minus size={14} /></button>
                      <span className="min-w-5 text-center font-bold">{cart[index]}</span>
                      <button type="button" aria-label={`Add one ${item.title}`} onClick={() => changeCart(index, 1)} className="grid h-8 w-8 place-items-center rounded-full" style={primaryButton}><Plus size={14} /></button>
                    </div>
                  ) : (showcaseKind !== 'menu' || multiPage) && (
                    <button type="button" onClick={() => chooseItem(index)} className="mt-4 self-start rounded-full px-4 py-2 text-sm font-bold" style={primaryButton}>{showcaseText.action}</button>
                  )}
                </div>
              </Reveal>
            ))}
          </div>

          {multiPage && activeItem >= 0 && showcaseItems[activeItem] && (
            <div className="mt-6 p-6 sm:p-8" style={{ ...card, borderColor: theme.accent }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em]" style={accentText}>Sample {showcaseItems[activeItem].subtitle ? `- ${showcaseItems[activeItem].subtitle}` : 'details'}</p>
                  <h3 className="mt-2 text-2xl font-black">{showcaseItems[activeItem].title}</h3>
                </div>
                <button type="button" aria-label="Close details" onClick={() => setActiveItem(-1)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ border, color: theme.text }}><X size={16} /></button>
              </div>
              <p className="mt-4 max-w-2xl text-lg leading-8" style={muted}>{showcaseItems[activeItem].detail}</p>
              <p className="mt-4 text-sm" style={muted}>Photos, full details and live availability are added when the real site is built.</p>
            </div>
          )}

          <form id="demo-showcase-form" onSubmit={(event) => { event.preventDefault(); setFormNotice(true); }} className="mt-6 grid gap-4 p-6 sm:p-8 md:grid-cols-2" style={card}>
            <div className="md:col-span-2">
              <h3 className="text-2xl font-black">{showcaseText.formTitle}</h3>
              {showcaseKind === 'products' && <p className="mt-2" style={muted}>{cartCount ? `${cartCount} item${cartCount === 1 ? '' : 's'} in your cart.` : 'Your cart is empty. Add a product above.'}</p>}
            </div>
            {showcaseKind === 'products' && cartCount > 0 && (
              <ul className="space-y-2 md:col-span-2">
                {Object.keys(cart).map((key) => <li key={key} className="flex items-center justify-between gap-4 px-4 py-3" style={field}><span className="min-w-0 truncate">{showcaseItems[Number(key)]?.title}</span><span className="font-bold">x {cart[Number(key)]}</span></li>)}
              </ul>
            )}
            {showcaseKind !== 'products' && showcaseKind !== 'menu' && (
              <label className="text-sm font-semibold md:col-span-2">{showcaseKind === 'listings' ? 'Listing' : 'Service'}
                <select value={formChoice} onChange={(event) => setFormChoice(event.target.value)} className="mt-2 w-full px-4 py-3 outline-none" style={field}>
                  <option value="">Choose one</option>
                  {showcaseItems.map((item, index) => <option key={`${item.title}-${index}`} value={item.title}>{item.title}</option>)}
                </select>
              </label>
            )}
            <label className="text-sm font-semibold">Your name<input type="text" autoComplete="name" className="mt-2 w-full px-4 py-3 outline-none" style={field} /></label>
            <label className="text-sm font-semibold">Phone or email<input type="text" className="mt-2 w-full px-4 py-3 outline-none" style={field} /></label>
            {(showcaseText.extra === 'date' || showcaseText.extra === 'guests') && <label className="text-sm font-semibold">Preferred date<input type="date" className="mt-2 w-full px-4 py-3 outline-none" style={field} /></label>}
            {showcaseText.extra === 'guests' && <label className="text-sm font-semibold">Guests<input type="number" min={1} max={20} defaultValue={2} className="mt-2 w-full px-4 py-3 outline-none" style={field} /></label>}
            {showcaseText.extra === 'message' && <label className="text-sm font-semibold md:col-span-2">Message<textarea rows={3} className="mt-2 w-full px-4 py-3 outline-none" style={field} /></label>}
            <div className="flex flex-wrap items-center gap-4 md:col-span-2">
              <button type="submit" disabled={showcaseKind === 'products' && !cartCount} className="rounded-2xl px-6 py-3 font-bold disabled:opacity-50" style={primaryButton}>{showcaseText.formButton}</button>
              {formNotice && <p role="status" className="text-sm font-semibold" style={accentText}>This is a demo. Nothing was sent - this form is connected when the site goes live.</p>}
            </div>
          </form>
        </section>
      )}

      {show('home') && highlights.length > 0 && (
        <section className={`${wrap} pb-16 sm:pb-24`}>
          {heading('Why choose us', `Why ${businessName}`)}
          <div className={`grid gap-5 sm:grid-cols-2 ${highlights.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
            {highlights.map((item) => (
              <Reveal key={item.title} animated={animated} className="p-6" style={card}>
                <CheckCircle2 style={accentText} size={24} />
                <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
                <p className="mt-2 leading-7" style={muted}>{item.body}</p>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {show('about') && process.length > 0 && (
        <section className={`${wrap} pb-16 sm:pb-24`}>
          {heading('How it works', 'A simple process')}
          <div className={`grid gap-5 sm:grid-cols-2 ${process.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
            {process.map((item, index) => (
              <Reveal key={item.title} animated={animated} className="p-6" style={{ borderTop: `3px solid ${theme.accent}`, backgroundColor: theme.surface, borderRadius: 16 }}>
                <p className="text-xs font-bold uppercase tracking-[0.18em]" style={accentText}>Step {index + 1}</p>
                <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
                <p className="mt-2 leading-7" style={muted}>{item.body}</p>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {show('faq') && faq.length > 0 && (
        <section className={`${wrap} pb-16 sm:pb-24 ${multiPage ? 'pt-14' : ''}`}>
          {heading('FAQ', 'Common questions')}
          <div className="max-w-3xl space-y-3">
            {faq.map((item, index) => (
              <div key={item.question} style={card}>
                <button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)} aria-expanded={openFaq === index} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-bold">
                  {item.question}
                  <ChevronDown size={18} className="shrink-0 transition-transform" style={{ ...accentText, transform: openFaq === index ? 'rotate(180deg)' : 'none' }} />
                </button>
                {openFaq === index && <p className="px-6 pb-6 leading-7" style={muted}>{item.answer}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {show('contact') && (
        <section id="demo-contact" className={`${wrap} pb-20 ${multiPage ? 'pt-14' : ''}`}>
          <Reveal animated={animated} className="p-7 sm:p-10" style={card}>
            <h2 className="text-3xl font-black leading-tight sm:text-4xl">{closing.title || 'Get in touch'}</h2>
            {closing.body && <p className="mt-4 max-w-2xl text-lg leading-8" style={muted}>{closing.body}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              {contact.phone && <a href={`tel:${String(contact.phone).replace(/[^+\d]/g, '')}`} className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-bold" style={primaryButton}><Phone size={16} />{contact.phone}</a>}
              {contact.email && <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-bold" style={{ border, color: theme.text }}><Mail size={16} style={accentText} />{contact.email}</a>}
              {instagram && <a href={`https://instagram.com/${encodeURIComponent(instagram)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-bold" style={{ border, color: theme.text }}><Instagram size={16} style={accentText} />@{instagram}</a>}
              {!contact.phone && !contact.email && !instagram && <p style={muted}>Contact details will be added before this site goes live.</p>}
            </div>
            {content.city && <p className="mt-6 inline-flex items-center gap-2 text-sm" style={muted}><MapPin size={16} style={accentText} />{content.city}</p>}
          </Reveal>
        </section>
      )}

      <footer style={{ borderTop: border }}>
        <div className={`${wrap} flex flex-col gap-2 py-8 text-sm sm:flex-row sm:items-center sm:justify-between`} style={muted}>
          <p className="font-bold" style={{ color: theme.text }}>{businessName}</p>
          <p className="text-xs">{content.disclaimer || 'Demo concept content. Confirm business details before production use.'}</p>
        </div>
      </footer>
    </main>
  );
}
