// This screen does not record or verify a currency, payment reference, tax,
// itemization or automatic payment verification. Do not infer these details.
export function invoiceAmount(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value).trim();
  if (!/^(?:\d{1,9})(?:\.\d{1,2})?$/.test(raw)) return null;
  const number = Number(raw);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function invoiceDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1000 || month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function amountLabel(value: unknown): string {
  const amount = invoiceAmount(value);
  return amount === null ? 'Amount unavailable' : amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const escapeHtml = (value: unknown): string => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const safeDate = (value: unknown): string => invoiceDate(value) ? String(value) : 'Not recorded';

// This is a printable internal record, not a verified tax invoice or receipt.
// Every dynamic field is escaped; no external scripts or images are included.
export function invoiceRecordHtml(row: { id?: unknown; business_name?: unknown; amount?: unknown; status?: unknown; due_date?: unknown; created_at?: unknown }): string {
  const created = typeof row.created_at === 'string' ? row.created_at.slice(0, 10) : '';
  const status = row.status === 'Paid' ? 'Manually marked paid - payment not independently verified' : row.status === 'Pending' ? 'Pending' : 'Unknown';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice record</title><style>body{font:16px/1.5 system-ui,sans-serif;color:#181818;background:#fff;margin:0;padding:32px}main{max-width:720px;margin:auto}h1{font-size:26px}dt{font-weight:700;margin-top:16px}dd{margin:2px 0;overflow-wrap:anywhere}.note{border:1px solid #aaa;padding:12px;margin-top:28px}@media print{body{padding:0}}</style></head><body><main><h1>Invoice record</h1><dl><dt>Record ID</dt><dd>${escapeHtml(row.id || 'Not recorded')}</dd><dt>Business</dt><dd>${escapeHtml(row.business_name || 'Not recorded')}</dd><dt>Created date</dt><dd>${escapeHtml(safeDate(created))}</dd><dt>Due date</dt><dd>${escapeHtml(safeDate(row.due_date))}</dd><dt>Amount</dt><dd>${escapeHtml(amountLabel(row.amount))} (currency not verified)</dd><dt>Status</dt><dd>${escapeHtml(status)}</dd></dl><p class="note">Internal record only. Currency, itemized services, tax, payment terms and payment verification are not verified here. Confirm all details and legal requirements before issuing an invoice or receipt.</p></main></body></html>`;
}
