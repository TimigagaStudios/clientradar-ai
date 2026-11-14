// Screenshot Intelligence Agent tools: read a screenshot with the AI, keep what it found for
// review, and turn reviewed records into leads in the SAME leads table.
// The file name starts with "_" so Vercel does not count it as a server function.
// Rules: one image per call; nothing is guessed (unseen fields stay empty); uncertain records
// are kept and marked, never dropped; nothing becomes a lead until the owner imports it.

import { recordTask } from './_team.js';

export interface ExtractedBusiness {
  name: string;
  category: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  website: string;
  email: string;
  rating: number | null;
  reviewCount: number | null;
  description: string;
  confidence: number;
}

const text = (value: unknown, max: number) => (typeof value === 'string' || typeof value === 'number' ? String(value).replace(/\s+/g, ' ').trim().slice(0, max) : '');
const numberOrNull = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(/[^\d.]/g, '')) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

export function cleanBusiness(raw: any): ExtractedBusiness {
  const rating = numberOrNull(raw?.rating);
  const reviews = numberOrNull(raw?.reviewCount ?? raw?.reviews);
  const confidence = numberOrNull(raw?.confidence);
  const website = text(raw?.website, 200);
  return {
    name: text(raw?.name ?? raw?.businessName, 160),
    category: text(raw?.category, 80),
    address: text(raw?.address, 240),
    city: text(raw?.city, 80),
    country: text(raw?.country, 60),
    phone: text(raw?.phone, 40),
    website: /\.[a-z]{2,}/i.test(website) ? website : '',
    email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text(raw?.email, 120)) ? text(raw?.email, 120) : '',
    rating: rating !== null && rating >= 0 && rating <= 5 ? rating : null,
    reviewCount: reviews !== null && reviews >= 0 ? Math.round(reviews) : null,
    description: text(raw?.description, 300),
    confidence: confidence === null ? 0.5 : Math.max(0, Math.min(1, confidence > 1 ? confidence / 100 : confidence)),
  };
}

const PROMPT = [
  'This image is a screenshot that may list one or many businesses (for example an Apple Maps or Google Maps results list, an Apple Maps place card, a search results page, a directory, or a single business profile).',
  'Extract EVERY separate business visible, each as its own entry. Do not merge businesses and do not skip partly visible ones.',
  'For each business give: name, category, address, city, country, phone, website, email, rating (0 to 5), reviewCount, description (short, only from visible text), confidence (0 to 1: how sure you are this entry is read correctly).',
  'Only use text that is actually visible in the image. If a field is not visible, use null. Never guess a phone number, website, email, rating or address.',
  'If the name is cut off or unclear, still include the entry with a low confidence.',
  'Apple Maps layout: a results row usually shows the name, then a line such as "Dentist - Santa Monica" (the first part is the category, the second part is the city or neighbourhood), then a rating, a distance and an open or closed status. A place card shows one business with Call, Website and Directions buttons and a Details section with Hours, Phone, Website and Address: read the phone, website and address from that Details section.',
  'On an Apple Maps details page the business name may appear only as the small title at the very top of the sheet: use it as the name. Lines such as "Closed Today", "Hours", "Details", "Good to Know", "Report an Issue", "Pin" or "Claim This Place" are never a business name.',
  'On Apple Maps a block such as "Yelp (29)" above a star with "3.8" means rating 3.8 and reviewCount 29 from Yelp. Do not create entries for reviewers (people who wrote a review) or for Yelp itself.',
  'A distance such as "1.2 mi" or "3 km" is NOT an address: ignore it. Price marks such as "$$" are not a rating: ignore them.',
  'rating must be a star score from 0 to 5 only. If the screenshot shows a percentage instead (for example "92%" with a thumbs-up, which is how Apple Maps shows ratings), set rating to null, put the number of ratings in reviewCount, and write the percentage in description, for example "92% recommended on Apple Maps". Never convert a percentage into stars.',
  'If the rating comes from another service (for example Yelp or Tripadvisor), keep the star score and mention the service in description.',
  'Opening status or hours, when visible, go in description. Words on a button (Call, Website, Directions, Share, Save) are not a phone number or website: only use a real number or web address that is written out.',
  'Ignore adverts, sponsored rows, map pins and labels on the map itself, buttons, the search bar and the phone status bar. If there are no businesses, return an empty list.',
  'Return JSON only, in this shape: {"businesses":[{"name":"","category":"","address":"","city":"","country":"","phone":"","website":"","email":"","rating":null,"reviewCount":null,"description":"","confidence":0.9}]}',
].join('\n');

// Sends ONE image to the AI and returns the businesses it can see.
export async function extractBusinesses(base64: string, mimeType: string): Promise<{ businesses: ExtractedBusiness[]; model: string }> {
  const provider = (process.env.DEMO_AI_PROVIDER || 'fallback').toLowerCase();
  const apiKey = process.env.GEMINI_API_KEY || process.env.DEMO_AI_API_KEY;
  if (provider !== 'gemini' || !apiKey) throw new Error('Screenshot import needs the AI key (DEMO_AI_PROVIDER and GEMINI_API_KEY in Vercel)');
  const model = process.env.SCREENSHOT_AI_MODEL || process.env.MASTER_AI_MODEL || process.env.DEMO_AI_MODEL || 'gemini-3.5-flash-lite';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: PROMPT }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  });
  if (response.status === 429) throw new Error('AI_LIMIT: the free AI limit was reached for the moment');
  if (!response.ok) throw new Error(`The AI service returned ${response.status}`);
  const body: any = await response.json();
  const raw = body?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || '';
  let parsed: any = null;
  try { parsed = JSON.parse(raw); } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) { try { parsed = JSON.parse(raw.slice(start, end + 1)); } catch { parsed = null; } }
  }
  if (!parsed) throw new Error('The AI answer could not be read. Try this image again.');
  const list: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed.businesses) ? parsed.businesses : [];
  // Entries with no readable name are kept (marked uncertain) as long as something else identifies them.
  const businesses = list.slice(0, 60).map(cleanBusiness).filter((item) => item.name || item.phone || item.website || item.address);
  return { businesses, model };
}

const tableMissing = (error: any) => ['PGRST205', '42P01'].includes(String(error?.code)) || /lead_import_records/i.test(String(error?.message || ''));
const columnMissing = (error: any) => ['PGRST204', '42703'].includes(String(error?.code)) || /column|schema cache/i.test(String(error?.message || ''));

// POST action "extract": one screenshot in, its businesses out (and kept for review when the table exists).
export async function handleExtract(supabase: any, body: any) {
  const image = String(body?.image || '');
  const mimeType = ['image/jpeg', 'image/png', 'image/webp'].includes(body?.mimeType) ? body.mimeType : 'image/jpeg';
  const batchId = text(body?.batchId, 60) || `batch-${Date.now()}`;
  const fileName = text(body?.fileName, 160) || 'screenshot';
  if (image.length < 1000) return { status: 400, json: { success: false, error: 'The image was empty' } };
  if (image.length > 4_200_000) return { status: 413, json: { success: false, error: 'The image is too large after shrinking' } };
  const startedAt = new Date();
  let found: Awaited<ReturnType<typeof extractBusinesses>>;
  try {
    found = await extractBusinesses(image, mimeType);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read the screenshot';
    const limit = message.startsWith('AI_LIMIT');
    return { status: limit ? 429 : 502, json: { success: false, limit, error: message.replace(/^AI_LIMIT: /, '') } };
  }
  const extractedAt = new Date().toISOString();
  let records = found.businesses.map((business, index) => ({ id: `local-${Date.now()}-${index}`, batchId, fileName, extractedAt, saved: false, ...business }));
  let saved = false;
  if (records.length) {
    const { data, error } = await supabase
      .from('lead_import_records')
      .insert(found.businesses.map((business) => ({ batch_id: batchId, file_name: fileName, data: business, confidence: business.confidence, status: 'pending' })))
      .select('id, created_at');
    if (!error && Array.isArray(data) && data.length === records.length) {
      saved = true;
      records = records.map((record, index) => ({ ...record, id: data[index].id, extractedAt: data[index].created_at || extractedAt, saved: true }));
    } else if (error && !tableMissing(error)) {
      console.error('Could not keep import records:', error.message);
    }
  }
  void startedAt;
  return { status: 200, json: { success: true, data: { records, saved, model: found.model } } };
}

// GET ?view=imports: records still waiting for review (so a closed tab or another device can carry on).
export async function listPendingImports(supabase: any) {
  const { data, error } = await supabase.from('lead_import_records').select('id, batch_id, file_name, data, confidence, created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(600);
  if (error) return { ready: !tableMissing(error), records: [] as any[] };
  return {
    ready: true,
    records: (data || []).map((row: any) => ({ ...cleanBusiness(row.data), confidence: Number(row.confidence ?? row.data?.confidence ?? 0.5), id: row.id, batchId: row.batch_id, fileName: row.file_name || 'screenshot', extractedAt: row.created_at, saved: true })),
  };
}

const isUuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

// POST action "import-update": save an edit, or mark records as removed. Best-effort.
export async function handleImportUpdate(supabase: any, body: any) {
  const now = new Date().toISOString();
  const removeIds = (Array.isArray(body?.removeIds) ? body.removeIds : []).filter(isUuid).slice(0, 600);
  if (removeIds.length) await supabase.from('lead_import_records').update({ status: 'removed', updated_at: now }).in('id', removeIds);
  if (isUuid(body?.id) && body?.data) await supabase.from('lead_import_records').update({ data: cleanBusiness(body.data), updated_at: now }).eq('id', body.id);
  return { status: 200, json: { success: true } };
}

function scoreLead(business: ExtractedBusiness) {
  let score = 0;
  if (!business.website) score += 40;
  if ((business.rating || 0) > 4) score += 20;
  if ((business.reviewCount || 0) > 20) score += 15;
  return { score, priority: score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low' };
}

// POST action "import-save": reviewed records become leads in the normal leads table.
export async function handleImportSave(supabase: any, body: any) {
  const incoming: any[] = (Array.isArray(body?.records) ? body.records : []).slice(0, 200);
  const usable = incoming.map((raw) => ({ raw, business: cleanBusiness(raw) })).filter((item) => item.business.name);
  if (!usable.length) return { status: 400, json: { success: false, error: 'No records with a business name were sent' } };
  const startedAt = new Date();
  const now = startedAt.toISOString();
  const rows = usable.map(({ raw, business }) => {
    const { score, priority } = scoreLead(business);
    const batchId = text(raw.batchId, 60);
    const fileName = text(raw.fileName, 160);
    const extractedAt = typeof raw.extractedAt === 'string' && !Number.isNaN(Date.parse(raw.extractedAt)) ? raw.extractedAt : now;
    const sourceLine = `Imported from screenshot "${fileName || 'screenshot'}"${batchId ? ` (batch ${batchId})` : ''} on ${extractedAt.slice(0, 10)}. AI confidence ${Math.round(business.confidence * 100)}%.`;
    const notes = [sourceLine, business.address ? `Address: ${business.address}` : '', business.description ? `Seen on listing: ${business.description}` : ''].filter(Boolean).join('\n');
    const base = {
      business_name: business.name,
      category: business.category || 'Uncategorised',
      city: business.city || business.country || 'Unknown',
      latitude: null,
      longitude: null,
      rating: business.rating ?? 0,
      review_count: business.reviewCount ?? 0,
      phone: business.phone || null,
      email: business.email || null,
      instagram: null,
      website: business.website || null,
      outdated_website: false,
      lead_score: score,
      priority,
      status: 'New',
      demo_status: 'Not Started',
      notes,
      demo_link: null,
      deal_value: null,
      outreach_history: [],
      timeline: [],
    };
    const source = { address: business.address || null, source: 'screenshot', source_batch_id: batchId || null, source_ref: fileName || null, source_confidence: business.confidence, source_extracted_at: extractedAt };
    return { base, source };
  });
  // With migration 005 the source is stored in its own columns; without it the same facts stay in the notes.
  let sourceColumns = true;
  let result = await supabase.from('leads').insert(rows.map((row) => ({ ...row.base, ...row.source }))).select('id, business_name');
  if (result.error && columnMissing(result.error)) {
    sourceColumns = false;
    result = await supabase.from('leads').insert(rows.map((row) => row.base)).select('id, business_name');
  }
  if (result.error || !Array.isArray(result.data)) {
    const message = String(result.error?.message || 'Could not save the leads').slice(0, 200);
    await recordTask({ agentKey: 'screenshot-intelligence', title: `Import ${rows.length} leads from screenshots`, status: 'failed', summary: `Could not import ${rows.length} leads from screenshots: ${message}`, error: message, startedAt });
    return { status: 500, json: { success: false, error: message } };
  }
  const created: any[] = result.data;
  const ids = usable.map((item) => item.raw.id).filter(isUuid);
  if (ids.length) await supabase.from('lead_import_records').update({ status: 'imported', updated_at: now }).in('id', ids);
  const batches = [...new Set(usable.map((item) => text(item.raw.batchId, 60)).filter(Boolean))];
  const files = new Set(usable.map((item) => text(item.raw.fileName, 160)).filter(Boolean)).size;
  await recordTask({
    agentKey: 'screenshot-intelligence',
    title: `Import ${created.length} leads from screenshots`,
    status: 'done',
    summary: `Imported ${created.length} ${created.length === 1 ? 'lead' : 'leads'} from ${files || 1} ${files === 1 ? 'screenshot' : 'screenshots'} after your review.`,
    input: { batches, records: usable.length },
    output: { imported: created.length, sourceColumns },
    startedAt,
  });
  return { status: 200, json: { success: true, data: { imported: created.length, importedIds: usable.map((item) => item.raw.id), sourceColumns } } };
}
