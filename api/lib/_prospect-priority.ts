import { isValidContactEmail, isValidContactPhone } from './_website.js';

// A missing saved website is an unknown, not proof of absence. Syntax checks do
// not establish that contact details are correct, reachable or consented.
export function isPriorityProspect(lead: { website?: unknown; email?: unknown; phone?: unknown }): boolean {
  const missingWebsite = lead.website == null || (typeof lead.website === 'string' && !lead.website.trim());
  return missingWebsite && isValidContactEmail(lead.email) && isValidContactPhone(lead.phone);
}

// Preserve the existing order within each group and never alter stored scores.
export function prioritizeProspects<T extends { website?: unknown; email?: unknown; phone?: unknown }>(leads: T[]): T[] {
  const priority: T[] = []; const rest: T[] = [];
  for (const lead of leads) (isPriorityProspect(lead) ? priority : rest).push(lead);
  return [...priority, ...rest];
}
