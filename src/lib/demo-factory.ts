import type { Lead } from '../types';

export type DemoJobStatus = 'queued' | 'generating' | 'ready' | 'failed';

export type DemoStyleLevel = 'mid' | 'hybrid' | 'ultra';

export type DemoJob = {
  id: string;
  leadId: string;
  templateKey: string;
  styleLevel: DemoStyleLevel;
  generatedBy: 'ai' | 'fallback' | null;
  status: DemoJobStatus;
  prompt: string;
  demoUrl: string | null;
  error: string | null;
  attempts: number;
  createdAt: string;
  completedAt: string | null;
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
  { key: 'hybrid', label: 'Hybrid', hint: 'Longer page with process' },
  { key: 'ultra', label: 'Ultra Premium', hint: 'Multi-page with FAQ' },
] as const;

export function styleLevelLabel(level: string) {
  return demoStyleLevels.find((item) => item.key === level)?.label || 'Mid-Level';
}

// Suggests a level from the lead's value and priority. The user can always override it.
export function suggestStyleLevel(lead?: Pick<Lead, 'priority' | 'dealValue'> | null): DemoStyleLevel {
  const value = Number(lead?.dealValue) || 0;
  if (lead?.priority === 'High' || value >= 5000) return 'ultra';
  if (lead?.priority === 'Medium' || value >= 1000) return 'hybrid';
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
    status: row.status,
    prompt: row.prompt,
    demoUrl: row.demo_url || null,
    error: row.error || null,
    attempts: row.attempts || 0,
    createdAt: row.created_at,
    completedAt: row.completed_at || null,
  };
}
