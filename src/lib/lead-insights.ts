// Local display helpers. Saved scores, ratings and deal amounts are not changed.
export function savedRating(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 5 ? n : null;
}

// A missing rating contributes no reputation points; no rating is inferred.
export function reputationPoints(value: unknown): number {
  const rating = savedRating(value);
  return rating === null ? 0 : Math.min(25, Math.round(rating * 5));
}

// This is the sum of saved amounts on records marked closed, not cash received.
export function savedClosedValue(leads: { status?: unknown; dealValue?: unknown }[]): number {
  return leads.reduce((total, lead) => {
    const value = typeof lead.dealValue === 'number' || typeof lead.dealValue === 'string' ? Number(lead.dealValue) : NaN;
    return total + (lead.status === 'Deal Closed' && Number.isFinite(value) && value > 0 ? value : 0);
  }, 0);
}

export function hasTrackedDemo(lead: { demoLink?: unknown; demoStatus?: unknown }): boolean {
  return Boolean(lead.demoLink) || Boolean(lead.demoStatus && lead.demoStatus !== 'Not Started');
}
