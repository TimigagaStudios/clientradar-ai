import type { Lead } from '../types';

export type DemoJobStatus = 'queued' | 'generating' | 'ready' | 'failed';

export type DemoJob = {
  id: string;
  leadId: string;
  templateKey: string;
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
  return {
    id: row.id,
    leadId: row.lead_id,
    templateKey: row.template_key,
    status: row.status,
    prompt: row.prompt,
    demoUrl: row.demo_url || null,
    error: row.error || null,
    attempts: row.attempts || 0,
    createdAt: row.created_at,
    completedAt: row.completed_at || null,
  };
}
