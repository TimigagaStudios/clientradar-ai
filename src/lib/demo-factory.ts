import type { Lead } from '../types';

export type DemoJobStatus = 'queued' | 'generating' | 'ready' | 'failed';

export type DemoStyleLevel = 'mid' | 'hybrid' | 'ultra';

export type DemoJob = {
  id: string;
  leadId: string;
  templateKey: string;
  styleLevel: DemoStyleLevel;
  generatedBy: 'ai' | 'fallback' | null;
  learned: boolean;
  aiError: string | null;
  status: DemoJobStatus;
  prompt: string;
  demoUrl: string | null;
  error: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string | null;
  startedAt: string | null;
  generatedAt: string | null;
  completedAt: string | null;
  views: number;
  lastViewedAt: string | null;
  firstViewedAt: string | null;
  websiteAnalysis: { status: 'partial' | 'unavailable' | 'not_provided'; checkedAt: string | null; pagesRead: string[] } | null;
  qaStatus: 'checked' | 'unchecked' | 'stale' | 'error';
  qa: { fingerprint?: string; checkedAt?: string; issues?: { code: string; path: string; message: string }[]; fixes?: { path: string; description: string }[]; agent?: { websiteStatus?: string; websiteCheckedAt?: string } } | null;
  qaContent: Record<string, unknown> | null;
};

export const demoTemplates = [
  { key: 'auto', label: 'Auto-select industry template' },
  { key: 'dental', label: 'Dental clinic' },
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'real-estate', label: 'Real estate' },
  { key: 'salon', label: 'Salon or beauty' },
  { key: 'professional-services', label: 'Professional services' },
] as const;

export const demoStyleLevels = [
  { key: 'mid', label: 'Mid-Level', hint: 'One clean page' },
  { key: 'hybrid', label: 'Hybrid', hint: 'Longer page with sample screens' },
  { key: 'ultra', label: 'Ultra Premium', hint: 'Multi-page with full sample flow' },
] as const;

export function styleLevelLabel(level: string) {
  return demoStyleLevels.find((item) => item.key === level)?.label || 'Mid-Level';
}

// "Opened 2 times - last 14 Nov, 09:30" or "Not opened yet".
export function describeDemoViews(job?: Pick<DemoJob, 'views' | 'lastViewedAt'> | null): string {
  if (!job || !job.views) return 'Not opened yet';
  const when = job.lastViewedAt ? new Date(job.lastViewedAt) : null;
  const last = when && !Number.isNaN(when.getTime()) ? ` - last ${when.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : '';
  return `Opened ${job.views} time${job.views === 1 ? '' : 's'}${last}`;
}

// Message the owner sends with a demo link. The owner always sends it personally.
export function buildDemoShare(lead: Pick<Lead, 'businessName' | 'phone' | 'email'>, demoLink: string) {
  const url = /^https?:/i.test(demoLink) ? demoLink : `${window.location.origin}${demoLink}`;
  const subject = `A website concept for ${lead.businessName}`;
  const text = `Hello, this is Timothy from Timigaga Studios. I put together a sample website concept for ${lead.businessName}. You can view it here: ${url}\n\nIt is only a sample and can be changed to fit you. Would you like me to walk you through it?`;
  const phone = String(lead.phone || '').trim();
  const digits = phone.startsWith('+') ? phone.replace(/\D/g, '') : '';
  return {
    url,
    subject,
    text,
    whatsapp: `https://wa.me/${digits}?text=${encodeURIComponent(text)}`,
    email: lead.email ? `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}` : '',
  };
}

// Deletes all demo jobs of one lead and clears its demo link and status.
export async function deleteLeadDemo(leadId: string): Promise<void> {
  const response = await fetch(`/api/demo-jobs?leadId=${encodeURIComponent(leadId)}`, { method: 'DELETE' });
  const text = await response.text();
  let result: any = null;
  try { result = JSON.parse(text); } catch { result = null; }
  if (!response.ok || !result?.success) throw new Error(result?.error || `Could not delete demo (${response.status}).`);
}

// Estimated project value per website level, in US dollars. The ranges rise by themselves as deals close:
// start-up prices to win the first clients, then growth prices, then full studio prices.
// One place to change every price in the app.
type ValueRanges = Record<DemoStyleLevel, { min: number; max: number; label: string }>;
export const PRICE_STAGES: { key: string; name: string; fromClosedDeals: number; ranges: ValueRanges }[] = [
  { key: 'launch', name: 'Launch prices', fromClosedDeals: 0, ranges: { mid: { min: 500, max: 1200, label: 'Mid-Level' }, hybrid: { min: 1200, max: 2500, label: 'Hybrid' }, ultra: { min: 2500, max: 5000, label: 'Ultra Premium' } } },
  { key: 'growth', name: 'Growth prices', fromClosedDeals: 5, ranges: { mid: { min: 1000, max: 2000, label: 'Mid-Level' }, hybrid: { min: 2000, max: 4000, label: 'Hybrid' }, ultra: { min: 4000, max: 9000, label: 'Ultra Premium' } } },
  { key: 'standard', name: 'Studio prices', fromClosedDeals: 15, ranges: { mid: { min: 1500, max: 3000, label: 'Mid-Level' }, hybrid: { min: 3000, max: 6000, label: 'Hybrid' }, ultra: { min: 6000, max: 15000, label: 'Ultra Premium' } } },
];

// The price stage for a number of closed deals, plus how many more deals move it up.
export function priceStage(closedDeals: number) {
  const closed = Math.max(0, Math.floor(Number(closedDeals) || 0));
  const index = PRICE_STAGES.reduce((best, stage, i) => (closed >= stage.fromClosedDeals ? i : best), 0);
  const next = PRICE_STAGES[index + 1] || null;
  return { ...PRICE_STAGES[index], next, dealsToNext: next ? next.fromClosedDeals - closed : 0 };
}

// Kept for older code: the full studio ranges.
export const VALUE_RANGES: ValueRanges = PRICE_STAGES[2].ranges;

// An estimate inside the lead's level range: a higher lead score and a missing website push it up. Not a quote.
export function estimateLeadValue(lead: Pick<Lead, 'priority' | 'dealValue' | 'website'> | null | undefined, score: number, closedDeals = 0): { value: number; level: DemoStyleLevel; min: number; max: number; label: string; stage: string } {
  const stage = priceStage(closedDeals);
  const level: DemoStyleLevel = lead?.priority === 'High' ? 'ultra' : lead?.priority === 'Medium' ? 'hybrid' : 'mid';
  const range = stage.ranges[level];
  const position = Math.max(0, Math.min(1, (Number(score) || 0) / 100 * 0.8 + (lead?.website ? 0 : 0.2)));
  return { value: Math.round((range.min + (range.max - range.min) * position) / 50) * 50, level, min: range.min, max: range.max, label: range.label, stage: stage.name };
}

// Suggests a level from the lead's value and priority. The user can always override it.
export function suggestStyleLevel(lead?: Pick<Lead, 'priority' | 'dealValue'> | null, closedDeals = 0): DemoStyleLevel {
  const value = Number(lead?.dealValue) || 0;
  const ranges = priceStage(closedDeals).ranges;
  if (lead?.priority === 'High' || value >= ranges.ultra.min) return 'ultra';
  if (lead?.priority === 'Medium' || value >= ranges.hybrid.min) return 'hybrid';
  return 'mid';
}

// template_key is stored as "template:level"; older jobs have no level and count as Mid-Level.
export function splitTemplateKey(value: unknown): { template: string; level: DemoStyleLevel } {
  const [template, level] = String(value || 'auto').split(':');
  return { template: template || 'auto', level: level === 'hybrid' || level === 'ultra' ? level : 'mid' };
}

export function buildDemoPrompt(lead: Lead, templateKey = 'auto') {
  return [
    'Create a polished, mobile-first demo website for this business.',
    `Business name: ${lead.businessName}`,
    `Industry: ${lead.category || 'General business'}`,
    `Location: ${lead.city || 'Not provided'}`,
    `Phone: ${lead.phone || 'Not provided'}`,
    `Email: ${lead.email || 'Not provided'}`,
    `Instagram: ${lead.instagram || 'Not provided'}`,
    `Website status: ${lead.website ? 'Existing website' : 'No website found'}`,
    `Template: ${templateKey}`,
    'Include a hero section, services, about, trust points, contact section, and a clear WhatsApp/call-to-action.',
    'Do not invent medical, legal, financial, awards, pricing, or performance claims. Use safe placeholders where information is unavailable.',
    'Return a structured website content plan; the template engine will handle layout and code generation.',
  ].join('\n');
}

export function mapDemoJob(row: any): DemoJob {
  const { template, level } = splitTemplateKey(row.template_key);
  const generatedBy = row.content?.generatedBy;
  return {
    id: row.id,
    leadId: row.lead_id,
    templateKey: template,
    styleLevel: level,
    generatedBy: generatedBy === 'ai' || generatedBy === 'fallback' ? generatedBy : null,
    learned: generatedBy === 'fallback' && Boolean(row.content?.learnedFrom),
    aiError: typeof row.content?.aiError === 'string' ? row.content.aiError : null,
    status: row.status,
    prompt: row.prompt,
    demoUrl: row.demo_url || null,
    error: row.error || null,
    attempts: row.attempts || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at || null,
    startedAt: row.started_at || null,
    generatedAt: row.generated_at || null,
    completedAt: row.completed_at || null,
    views: Number(row.content?.stats?.views) || 0,
    lastViewedAt: typeof row.content?.stats?.lastViewedAt === 'string' ? row.content.stats.lastViewedAt : null,
    firstViewedAt: typeof row.content?.stats?.firstViewedAt === 'string' ? row.content.stats.firstViewedAt : null,
    websiteAnalysis: ['partial', 'unavailable', 'not_provided'].includes(row.content?.websiteAnalysis?.status) ? { status: row.content.websiteAnalysis.status, checkedAt: typeof row.content.websiteAnalysis.checkedAt === 'string' ? row.content.websiteAnalysis.checkedAt : null, pagesRead: Array.isArray(row.content.websiteAnalysis.pagesRead) ? row.content.websiteAnalysis.pagesRead.filter((path: unknown): path is string => typeof path === 'string').slice(0, 3) : [] } : null,
    qaStatus: ['checked', 'unchecked', 'stale', 'error'].includes(row.qaStatus) ? row.qaStatus : 'unchecked',
    qa: row.content?.qa && typeof row.content.qa === 'object' ? row.content.qa : null,
    qaContent: row.content && typeof row.content === 'object' ? row.content : null,
  };
}
