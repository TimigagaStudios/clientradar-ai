import { scanLead } from './_website.js';

// Records Upkeep Agent: goes through saved leads and brings older records up to what ClientRadar
// can do today, so nothing has to be imported again. It only FILLS what is missing; it never
// overwrites what the owner typed and never invents a value.
// Each call does one small batch so it fits in a server call; the app calls it again while work remains.

export interface UpkeepResult {
  placed: number; // map position found from the street address
  approximate: number; // only the city was found: pin sits on the city centre
  notFound: number;
  scanned: number; // websites read
  emails: number; // emails found by those reads
  remaining: number; // leads still waiting after this batch
  skipped: string | null; // why map positions were not looked up (for example no key)
}

const today = () => new Date().toISOString().slice(0, 10);
const addLine = (notes: unknown, line: string) => [String(notes || '').trim(), line].filter(Boolean).join('\n');
const NOT_FOUND = 'Map position: not found';
const UNREADABLE = 'Website check: could not be read';

async function geocode(text: string, key: string): Promise<{ lat: number; lon: number; type: string; confidence: number } | null> {
  const response = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(text)}&format=json&limit=1&lang=en&apiKey=${key}`, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json' } });
  if (response.status === 401 || response.status === 403) throw new Error('Geoapify refused the key (check GEOAPIFY_API_KEY in Vercel)');
  if (response.status === 429) throw new Error('the free Geoapify daily limit was reached; it resets tomorrow');
  if (!response.ok) return null;
  const place = ((await response.json()) as any)?.results?.[0];
  const lat = Number(place?.lat);
  const lon = Number(place?.lon);
  if (!place || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, type: String(place.result_type || ''), confidence: Number(place.rank?.confidence ?? 0) };
}

const usableCity = (city: unknown) => { const value = String(city || '').trim(); return value && !/^unknown$/i.test(value) ? value : ''; };

export async function runUpkeep(supabase: any, options: { positions?: number; websites?: number } = {}): Promise<UpkeepResult> {
  const result: UpkeepResult = { placed: 0, approximate: 0, notFound: 0, scanned: 0, emails: 0, remaining: 0, skipped: null };
  const maxPositions = options.positions ?? 12;
  const maxWebsites = options.websites ?? 2;

  // 1. Leads with no map position (the Lead Globe needs one).
  const { data: unplacedRows } = await supabase.from('leads').select('id, business_name, city, notes').is('latitude', null).order('created_at', { ascending: false }).limit(400);
  const unplaced = (unplacedRows || []).filter((lead: any) => !String(lead.notes || '').includes(NOT_FOUND));
  const key = process.env.GEOAPIFY_API_KEY;
  let positionsLeft = unplaced.length;
  if (!key) {
    if (unplaced.length) result.skipped = 'Map positions need the free Geoapify key (GEOAPIFY_API_KEY in Vercel).';
    positionsLeft = 0;
  } else {
    for (const lead of unplaced.slice(0, maxPositions)) {
      const address = (String(lead.notes || '').match(/^Address:\s*(.+)$/m)?.[1] || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
      const city = usableCity(lead.city);
      let found: Awaited<ReturnType<typeof geocode>> = null;
      let exact = false;
      try {
        if (address && address !== 'not listed') {
          const hit = await geocode(city && !address.toLowerCase().includes(city.toLowerCase()) ? `${address}, ${city}` : address, key);
          // Only trust a street-level answer; anything vaguer counts as "city only".
          if (hit && hit.confidence >= 0.5 && ['building', 'amenity', 'street'].includes(hit.type)) { found = hit; exact = true; }
          else if (hit && !city) found = hit;
        }
        if (!found && city) found = await geocode(city, key);
      } catch (error) {
        result.skipped = error instanceof Error ? error.message : 'Map lookup failed';
        break;
      }
      positionsLeft -= 1;
      if (!found) {
        result.notFound += 1;
        await supabase.from('leads').update({ notes: addLine(lead.notes, `${NOT_FOUND} (${today()}). Add a street address or city, then remove this line to try again.`) }).eq('id', lead.id);
        continue;
      }
      if (exact) result.placed += 1; else result.approximate += 1;
      await supabase.from('leads').update({
        latitude: found.lat,
        longitude: found.lon,
        notes: addLine(lead.notes, exact ? `Map position: from the street address (${today()}).` : `Map position: approximate, centre of ${city || 'the area'} (${today()}).`),
      }).eq('id', lead.id);
    }
    if (result.skipped) positionsLeft = 0; // stop asking until the problem is fixed
  }

  // 2. Leads that have a website but no email, and whose site was never read.
  const { data: siteRows } = await supabase.from('leads').select('id, notes').not('website', 'is', null).is('email', null).order('created_at', { ascending: false }).limit(400);
  const unread = (siteRows || []).filter((lead: any) => { const notes = String(lead.notes || ''); return !notes.includes('Website scan (') && !notes.includes(UNREADABLE); });
  let websitesLeft = unread.length;
  for (const lead of unread.slice(0, maxWebsites)) {
    const scan = await scanLead(supabase, lead.id).catch(() => ({ ok: false as const, error: 'failed' }));
    websitesLeft -= 1;
    if (scan.ok) {
      result.scanned += 1;
      if (scan.filled.includes('email')) result.emails += 1;
    } else {
      await supabase.from('leads').update({ notes: addLine(lead.notes, `${UNREADABLE} (${today()}).`) }).eq('id', lead.id);
    }
  }

  result.remaining = Math.max(0, positionsLeft) + Math.max(0, websitesLeft);
  return result;
}

export function upkeepSummary(total: Pick<UpkeepResult, 'placed' | 'approximate' | 'notFound' | 'scanned' | 'emails'>) {
  const parts: string[] = [];
  const mapped = total.placed + total.approximate;
  if (mapped) parts.push(`placed ${mapped} ${mapped === 1 ? 'lead' : 'leads'} on the globe${total.approximate ? ` (${total.approximate} only to the city centre)` : ''}`);
  if (total.notFound) parts.push(`could not find a map position for ${total.notFound}`);
  if (total.scanned) parts.push(`read ${total.scanned} lead ${total.scanned === 1 ? 'website' : 'websites'} and found ${total.emails} ${total.emails === 1 ? 'email' : 'emails'}`);
  return parts.length ? `Records check: ${parts.join('; ')}.` : '';
}
