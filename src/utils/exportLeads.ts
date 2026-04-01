import { Lead } from '../types';

function escapeCSVValue(value: unknown) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);

  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function exportLeadsToCSV(leads: Lead[]) {
  const headers = [
    'businessName',
    'category',
    'city',
    'phone',
    'email',
    'instagram',
    'website',
    'leadScore',
    'priority',
    'status',
    'notes',
    'dealValue',
  ];

  const rows = leads.map((lead) => [
    lead.businessName,
    lead.category,
    lead.city,
    lead.phone || '',
    lead.email || '',
    lead.instagram || '',
    lead.website || '',
    lead.leadScore,
    lead.priority,
    lead.status,
    lead.notes || '',
    lead.dealValue || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCSVValue).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'clientradar-leads.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
