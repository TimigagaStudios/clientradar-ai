import type { Lead, LeadPriority, SearchResult } from '../types';

// Shared by Lead Finder, FinderMap and the Master Agent chat:
// Strict two-route map lead qualification (email + phone required) and lead creation.

export type WebsitePreview = {
  officialUrl?: string;
  emails: string[];
  phones: string[];
  instagram: string | null;
  colors: string[];
  accent: string | null;
  darkDesign: boolean | null;
  fonts: string[];
  platform: string | null;
  mobileReady: boolean;
  secure: boolean;
  pagesRead: string[];
  summary: string;
};

export type CandidateScan =
  | { status: 'loading' }
  | { status: 'done'; data: WebsitePreview }
  | { status: 'failed'; error: string; nonOfficial?: boolean };

export type QualificationRoute = 'map-contact' | 'official-website' | 'none';
export type QualificationStatus = 'qualified' | 'needs_website_check' | 'checking' | 'incomplete';

export type CandidateQualification = {
  status: QualificationStatus;
  route: QualificationRoute;
  badge: string;
  detail: string;
  email: string | null;
  emailSource: 'map' | 'website' | null;
  phone: string | null;
  phoneSource: 'map' | 'website' | null;
  instagram: string | null;
  summary: string | null;
  canSave: boolean;
  canCheckSite: boolean;
};

const JUNK_EMAIL = /(\.(png|jpe?g|gif|webp|avif|ico|svg|css|js|woff2?|pdf|mp4)$)|^(no-?reply|donotreply|mailer-daemon)@|@[23]x\.|sentry|wixpress|example\.|domain\.com|email\.com|yourname|your-?email|name@|user@|test@|godaddy|schema\.org|w3\.org/i;
const NON_OFFICIAL_HOST = /(?:^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com|linkedin\.com|twitter\.com|x\.com|tiktok\.com|youtube\.com|youtu\.be|pinterest\.com|snapchat\.com|reddit\.com|yelp\.[a-z.]+|tripadvisor\.[a-z.]+|yellowpages\.[a-z.]+|yell\.com|trustpilot\.com|foursquare\.com|angi\.com|homeadvisor\.com|thumbtack\.com|houzz\.com|bark\.com|checkatrade\.com|nextdoor\.com|bbb\.org|booking\.com|expedia\.com|airbnb\.[a-z.]+|agoda\.com|hotels\.com|opentable\.com|ubereats\.com|doordash\.com|deliveroo\.[a-z.]+|just-eat\.[a-z.]+|grubhub\.com|linktr\.ee|beacons\.ai|bit\.ly|tinyurl\.com|t\.co|goo\.gl|wa\.me|whatsapp\.com|t\.me|telegram\.me|google\.[a-z.]+|maps\.apple\.com)$/i;

export function isValidLeadEmail(value?: string | null): boolean {
  const email = String(value || '').trim().toLowerCase().replace(/^mailto:/, '').split('?')[0].replace(/[.,;:]+$/, '');
  return email.length > 4 && email.length <= 100 && /^[a-z0-9._%+-]{1,64}@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) && !JUNK_EMAIL.test(email);
}

export function isValidLeadPhone(value?: string | null): boolean {
  const text = String(value || '').trim().replace(/^tel:/i, '').split(/[?;#]/)[0].trim();
  if (!text || text.length > 32) return false;
  if (/^(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(text) || /^\d{1,2}[-/.]\d{1,2}[-/.](?:19|20)\d{2}$/.test(text)) return false;
  if (/^-?\d{1,3}\.\d{4,}$/.test(text)) return false;
  const num = text.replace(/\D/g, '');
  if (num.length < 7 || num.length > 15) return false;
  if (/^(\d)\1{6,}$/.test(num) || /^(?:0123456|1234567)/.test(num)) return false;
  return true;
}

export function isOfficialBusinessWebsite(value?: string | null): boolean {
  const raw = String(value || '').trim();
  if (!raw) return false;
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase().replace(/^(?:www|m|mobile)\./, '');
    if (!hostname.includes('.') || /^[\d.]+$/.test(hostname) || hostname.includes(':')) return false;
    return !NON_OFFICIAL_HOST.test(hostname);
  } catch {
    return false;
  }
}

export async function requestCandidateWebsiteScan(website: string): Promise<CandidateScan> {
  try {
    const response = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'scan-candidate', website }),
    });
    const raw = await response.text();
    let body: any = null;
    try { body = JSON.parse(raw); } catch { /* not JSON */ }
    if (!response.ok || !body?.success) {
      return { status: 'failed', error: body?.error || 'Website check failed.' };
    }
    if (!body?.data?.read) {
      return {
        status: 'failed',
        nonOfficial: Boolean(body?.data?.nonOfficial),
        error: String(body?.data?.reason || 'Site could not be read.'),
      };
    }
    const data: WebsitePreview = {
      officialUrl: body.data.officialUrl || undefined,
      emails: Array.isArray(body.data.emails) ? body.data.emails.filter((e: unknown) => isValidLeadEmail(String(e || ''))) : [],
      phones: Array.isArray(body.data.phones) ? body.data.phones.filter((p: unknown) => isValidLeadPhone(String(p || ''))) : [],
      instagram: body.data.instagram || null,
      colors: Array.isArray(body.data.colors) ? body.data.colors : [],
      accent: /^#[0-9a-f]{6}$/i.test(String(body.data.accent || '')) ? body.data.accent : null,
      darkDesign: typeof body.data.darkDesign === 'boolean' ? body.data.darkDesign : null,
      fonts: Array.isArray(body.data.fonts) ? body.data.fonts : [],
      platform: body.data.platform || null,
      mobileReady: Boolean(body.data.mobileReady),
      secure: Boolean(body.data.secure),
      pagesRead: Array.isArray(body.data.pagesRead) ? body.data.pagesRead : [],
      summary: String(body.data.summary || ''),
    };
    return { status: 'done', data };
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : 'Site could not be read.' };
  }
}

export function evaluateLeadCandidate(result: SearchResult, scanState?: CandidateScan): CandidateQualification {
  const rawEmail = isValidLeadEmail(result.email) ? String(result.email).trim().toLowerCase() : null;
  const rawPhone = isValidLeadPhone(result.phone) ? String(result.phone).trim() : null;

  // Server-enriched results from Master chat carry their original contact source if already scanned.
  const mapEmail = result.emailSource === 'website' ? null : rawEmail;
  const mapPhone = result.phoneSource === 'website' ? null : rawPhone;

  // Route 1: Map listing itself provides BOTH email and phone.
  if (mapEmail && mapPhone) {
    const scanDone = scanState?.status === 'done' ? scanState.data : null;
    return {
      status: 'qualified',
      route: 'map-contact',
      badge: 'Map has both contacts',
      detail: 'Email and phone provided directly by the map listing.',
      email: mapEmail,
      emailSource: 'map',
      phone: mapPhone,
      phoneSource: 'map',
      instagram: result.instagram || scanDone?.instagram || null,
      summary: scanDone?.summary || result.websiteScanSummary || null,
      canSave: true,
      canCheckSite: false,
    };
  }

  if (scanState?.status === 'loading') {
    return {
      status: 'checking',
      route: 'official-website',
      badge: 'Checking official website...',
      detail: 'Reading public pages on the official domain for email and phone.',
      email: mapEmail,
      emailSource: mapEmail ? 'map' : null,
      phone: mapPhone,
      phoneSource: mapPhone ? 'map' : null,
      instagram: result.instagram || null,
      summary: null,
      canSave: false,
      canCheckSite: false,
    };
  }

  // Route 2 after client-side website check.
  if (scanState?.status === 'done') {
    const siteEmail = scanState.data.emails[0] || null;
    const sitePhone = scanState.data.phones[0] || null;
    const finalEmail = mapEmail || siteEmail;
    const finalPhone = mapPhone || sitePhone;
    const emailSource = mapEmail ? 'map' : siteEmail ? 'website' : null;
    const phoneSource = mapPhone ? 'map' : sitePhone ? 'website' : null;

    if (finalEmail && finalPhone) {
      return {
        status: 'qualified',
        route: 'official-website',
        badge: emailSource === 'website' && phoneSource === 'website' ? 'Website checked - both found' : 'Website checked - both contacts complete',
        detail: `Email (${emailSource}) and phone (${phoneSource}) confirmed.`,
        email: finalEmail,
        emailSource,
        phone: finalPhone,
        phoneSource,
        instagram: result.instagram || scanState.data.instagram || null,
        summary: scanState.data.summary || null,
        canSave: true,
        canCheckSite: false,
      };
    }
    const missingBadge = !finalEmail && !finalPhone
      ? 'Website checked - email and phone missing'
      : !finalEmail
        ? 'Website checked - email missing'
        : 'Website checked - phone missing';
    const missingDetail = !finalEmail && !finalPhone
      ? 'Official website checked; neither email nor phone was published on the checked pages.'
      : !finalEmail
        ? `Official website checked; phone confirmed (${phoneSource}), but no public email was found.`
        : `Official website checked; email confirmed (${emailSource}), but no public phone was found.`;
    return {
      status: 'incomplete',
      route: 'official-website',
      badge: missingBadge,
      detail: missingDetail,
      email: finalEmail,
      emailSource,
      phone: finalPhone,
      phoneSource,
      instagram: result.instagram || scanState.data.instagram || null,
      summary: scanState.data.summary || null,
      canSave: false,
      canCheckSite: false,
    };
  }

  if (scanState?.status === 'failed') {
    if (scanState.nonOfficial) {
      return {
        status: 'incomplete',
        route: 'none',
        badge: 'Not an official website',
        detail: scanState.error,
        email: mapEmail,
        emailSource: mapEmail ? 'map' : null,
        phone: mapPhone,
        phoneSource: mapPhone ? 'map' : null,
        instagram: result.instagram || null,
        summary: null,
        canSave: false,
        canCheckSite: false,
      };
    }
    return {
      status: 'incomplete',
      route: 'official-website',
      badge: 'Site could not be read',
      detail: scanState.error,
      email: mapEmail,
      emailSource: mapEmail ? 'map' : null,
      phone: mapPhone,
      phoneSource: mapPhone ? 'map' : null,
      instagram: result.instagram || null,
      summary: null,
      canSave: false,
      canCheckSite: true,
    };
  }

  // Server-side website check already completed (Master chat Lead Research).
  if (result.websiteChecked) {
    if (result.websiteRead === false) {
      return {
        status: 'incomplete',
        route: 'official-website',
        badge: 'Site could not be read',
        detail: result.websiteError || 'Official website could not be read.',
        email: rawEmail,
        emailSource: rawEmail ? (result.emailSource || 'map') : null,
        phone: rawPhone,
        phoneSource: rawPhone ? (result.phoneSource || 'map') : null,
        instagram: result.instagram || null,
        summary: null,
        canSave: false,
        canCheckSite: isOfficialBusinessWebsite(result.website),
      };
    }
    const emailSource = rawEmail ? (result.emailSource || 'website') : null;
    const phoneSource = rawPhone ? (result.phoneSource || 'website') : null;
    if (rawEmail && rawPhone) {
      return {
        status: 'qualified',
        route: emailSource === 'map' && phoneSource === 'map' ? 'map-contact' : 'official-website',
        badge: emailSource === 'website' && phoneSource === 'website' ? 'Website checked - both found' : 'Website checked - both contacts complete',
        detail: `Email (${emailSource}) and phone (${phoneSource}) confirmed.`,
        email: rawEmail,
        emailSource,
        phone: rawPhone,
        phoneSource,
        instagram: result.instagram || null,
        summary: result.websiteScanSummary || null,
        canSave: true,
        canCheckSite: false,
      };
    }
    return {
      status: 'incomplete',
      route: 'official-website',
      badge: !rawEmail && !rawPhone ? 'Website checked - email and phone missing' : !rawEmail ? 'Website checked - email missing' : 'Website checked - phone missing',
      detail: !rawEmail ? 'Official website checked; no public email found.' : 'Official website checked; no public phone found.',
      email: rawEmail,
      emailSource,
      phone: rawPhone,
      phoneSource,
      instagram: result.instagram || null,
      summary: result.websiteScanSummary || null,
      canSave: false,
      canCheckSite: false,
    };
  }

  // Unchecked Route 2 candidate with an official website.
  if (isOfficialBusinessWebsite(result.website)) {
    return {
      status: 'needs_website_check',
      route: 'official-website',
      badge: 'Official website - check contacts',
      detail: mapPhone
        ? 'Map has phone; check official website for email.'
        : mapEmail
          ? 'Map has email; check official website for phone.'
          : 'Check official website for email and phone.',
      email: mapEmail,
      emailSource: mapEmail ? 'map' : null,
      phone: mapPhone,
      phoneSource: mapPhone ? 'map' : null,
      instagram: result.instagram || null,
      summary: null,
      canSave: false,
      canCheckSite: true,
    };
  }

  // No official website and missing at least one contact.
  if (result.website) {
    return {
      status: 'incomplete',
      route: 'none',
      badge: !mapEmail && !mapPhone ? 'Third-party link only - contacts missing' : !mapEmail ? 'Third-party link only - email missing' : 'Third-party link only - phone missing',
      detail: 'Listing points to a social or directory page instead of an official website.',
      email: mapEmail,
      emailSource: mapEmail ? 'map' : null,
      phone: mapPhone,
      phoneSource: mapPhone ? 'map' : null,
      instagram: result.instagram || null,
      summary: null,
      canSave: false,
      canCheckSite: false,
    };
  }

  return {
    status: 'incomplete',
    route: 'none',
    badge: !mapEmail && !mapPhone ? 'Email and phone missing' : !mapEmail ? 'Email missing' : 'Phone missing',
    detail: 'No official website listed and map data does not include both contacts.',
    email: mapEmail,
    emailSource: mapEmail ? 'map' : null,
    phone: mapPhone,
    phoneSource: mapPhone ? 'map' : null,
    instagram: result.instagram || null,
    summary: null,
    canSave: false,
    canCheckSite: false,
  };
}

export function scoreFound(result: Pick<SearchResult, 'website' | 'outdatedWebsite' | 'rating' | 'reviewCount'>): { score: number; priority: LeadPriority } {
  let score = 0;
  if (!result.website) score += 40;
  else if (result.outdatedWebsite) score += 25;
  if (result.rating > 4) score += 20;
  if (result.reviewCount > 20) score += 15;
  let priority: LeadPriority = 'Low';
  if (score >= 70) priority = 'High';
  else if (score >= 40) priority = 'Medium';
  return { score, priority };
}

const digits = (value?: string | null) => String(value || '').replace(/\D/g, '').slice(-9);
const host = (value?: string | null) => String(value || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
const plain = (value?: string | null) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const cleanMail = (value?: string | null) => String(value || '').trim().toLowerCase();

// A found business that is already in the lead list: same name with the same email, phone, website or spot on the map.
export function existingLeadFor(leads: Lead[], result: SearchResult): Lead | undefined {
  const name = plain(result.businessName);
  if (!name) return undefined;
  return leads.find((lead: any) => {
    if (plain(lead.businessName) !== name) return false;
    if (cleanMail(result.email) && cleanMail(result.email) === cleanMail(lead.email)) return true;
    if (digits(result.phone).length >= 7 && digits(result.phone) === digits(lead.phone)) return true;
    if (host(result.website) && host(result.website) === host(lead.website)) return true;
    if (Number.isFinite(result.latitude) && Number.isFinite(lead.latitude)) {
      return Math.abs((result.latitude as number) - lead.latitude) < 0.002 && Math.abs((result.longitude as number) - lead.longitude) < 0.002;
    }
    return plain(lead.city) !== '' && plain(lead.city) === plain(result.city);
  });
}

// Saves one contact-qualified business and returns the new lead's id.
export async function saveFoundBusiness(
  result: SearchResult,
  typed: {
    category?: string;
    city?: string;
    source?: string;
    websiteScanSummary?: string;
    qualificationRoute?: QualificationRoute;
    emailSource?: 'map' | 'website' | null;
    phoneSource?: 'map' | 'website' | null;
  },
): Promise<string> {
  if (!isValidLeadEmail(result.email) || !isValidLeadPhone(result.phone)) {
    throw new Error('Only leads with both a valid business email address and a phone number can be saved.');
  }
  const { score, priority } = scoreFound(result);
  const routeNote = typed.qualificationRoute === 'map-contact'
    ? 'Qualification: Route 1 (map listing provided both email and phone).'
    : typed.qualificationRoute === 'official-website'
      ? `Qualification: Route 2 (official website checked; email from ${typed.emailSource || 'website'}, phone from ${typed.phoneSource || 'website'}).`
      : '';
  const response = await fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requireCompleteContacts: true,
      businessName: result.businessName,
      category: typed.category || result.category || 'General',
      city: result.city || typed.city || 'Unknown',
      latitude: Number.isFinite(result.latitude) ? result.latitude : undefined,
      longitude: Number.isFinite(result.longitude) ? result.longitude : undefined,
      rating: result.rating || 0,
      reviewCount: result.reviewCount || 0,
      phone: String(result.phone).trim(),
      email: String(result.email).trim().toLowerCase(),
      instagram: result.instagram || undefined,
      website: result.website,
      outdatedWebsite: Boolean(result.outdatedWebsite),
      leadScore: score,
      priority,
      status: 'New',
      demoStatus: 'Not Started',
      notes: [
        `Found via ${typed.source || 'Lead Finder'}. Address: ${result.address || 'not listed'}${result.country ? ` (${result.country})` : ''}`,
        routeNote,
        typed.websiteScanSummary || result.websiteScanSummary || '',
      ].filter(Boolean).join('\n'),
      outreachHistory: [],
    }),
  });
  const text = await response.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (!response.ok || !body?.success) throw new Error(body?.error || 'Could not save this lead');
  return String(body.data?.id || '');
}

export const foundKey = (result: SearchResult) => `${plain(result.businessName)}|${Number(result.latitude).toFixed(4)}|${Number(result.longitude).toFixed(4)}`;
