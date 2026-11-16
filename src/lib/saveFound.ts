import type { Lead, LeadPriority, SearchResult } from '../types';

// Shared by Lead Finder and the Master Agent chat: turning a found business into a saved lead.

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

// A found business that is already in the lead list: same name with the same phone, website or spot on the map.
export function existingLeadFor(leads: Lead[], result: SearchResult): Lead | undefined {
  const name = plain(result.businessName);
  if (!name) return undefined;
  return leads.find((lead: any) => {
    if (plain(lead.businessName) !== name) return false;
    if (digits(result.phone).length >= 7 && digits(result.phone) === digits(lead.phone)) return true;
    if (host(result.website) && host(result.website) === host(lead.website)) return true;
    if (Number.isFinite(result.latitude) && Number.isFinite(lead.latitude)) {
      return Math.abs((result.latitude as number) - lead.latitude) < 0.002 && Math.abs((result.longitude as number) - lead.longitude) < 0.002;
    }
    return plain(lead.city) !== '' && plain(lead.city) === plain(result.city);
  });
}

// Saves one business and returns the new lead's id. The caller refreshes the lead list once at the end.
export async function saveFoundBusiness(result: SearchResult, typed: { category?: string; city?: string; source?: string; websiteScanSummary?: string }): Promise<string> {
  const { score, priority } = scoreFound(result);
  const response = await fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: result.businessName,
      category: typed.category || result.category || 'General',
      city: result.city || typed.city || 'Unknown',
      latitude: Number.isFinite(result.latitude) ? result.latitude : undefined,
      longitude: Number.isFinite(result.longitude) ? result.longitude : undefined,
      rating: result.rating || 0,
      reviewCount: result.reviewCount || 0,
      phone: result.phone,
      email: result.email,
      website: result.website,
      outdatedWebsite: Boolean(result.outdatedWebsite),
      leadScore: score,
      priority,
      status: 'New',
      demoStatus: 'Not Started',
      notes: [`Found via ${typed.source || 'Lead Finder'}. Address: ${result.address || 'not listed'}${result.country ? ` (${result.country})` : ''}`, typed.websiteScanSummary || ''].filter(Boolean).join('\n'),
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
