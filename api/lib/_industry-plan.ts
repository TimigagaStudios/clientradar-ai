// Initial page-planning cues, not an industry-specific website generator.
// Uses only the supplied category. Suggestions are not business facts, are not
// automatically rendered, and do not change the current demo or pricing tier.
type Profile = { key: string; label: string; test: RegExp; pages: string[] };
const profiles: Profile[] = [
  { key: 'beauty', label: 'Beauty and personal care', test: /\b(salons?|barbers?(?:hops?)?|hair|beauty|nails?|spas?|makeup|make-up|cosmetic studios?)\b/i, pages: ['Home', 'About', 'Services', 'Team', 'Gallery', 'Appointments', 'Contact'] },
  { key: 'dental', label: 'Dental', test: /\b(dental|dentists?|dentistry|orthodontic)\b/i, pages: ['Home', 'About', 'Dental team', 'Treatments', 'Patient information', 'Appointments', 'Contact'] },
  { key: 'healthcare', label: 'Healthcare', test: /\b(medical|physio(?:therapy)?|clinics?|healthcare|health care|specialist practices?)\b/i, pages: ['Home', 'About', 'Practitioners', 'Services', 'Patient information', 'Appointments', 'Contact'] },
  { key: 'food', label: 'Food and dining', test: /\b(restaurants?|cafes?|coffee|baker(?:y|ies|s)?|catering|dining|eater(?:y|ies))\b/i, pages: ['Home', 'About', 'Menu', 'Gallery', 'Reservations or enquiries', 'Contact'] },
  { key: 'hotel', label: 'Hotel and hospitality', test: /\b(hotels?|motels?|guesthouses?|guest houses?|lodging)\b/i, pages: ['Home', 'About', 'Rooms', 'Amenities', 'Reservations or enquiries', 'Contact'] },
  { key: 'property', label: 'Property and real estate', test: /\b(real estate|real-estate|realtors?|property|properties|lettings|rentals?)\b/i, pages: ['Home', 'About', 'Property listings', 'Agents', 'Viewing enquiries', 'Contact'] },
  { key: 'retail', label: 'Retail and commerce', test: /\b(retail|shops?|stores?|boutiques?|fashion|clothing|electronics|furniture|ecommerce|e-commerce|online retailers?)\b/i, pages: ['Home', 'About', 'Products', 'Product details', 'Customer information', 'Contact'] },
  { key: 'professional', label: 'Professional and local services', test: /\b(law|lawyers?|legal|accounting|accountants?|consulting|consultants?|marketing|cleaning|construction|photography|photographers?|education|automotive|auto repair)\b/i, pages: ['Home', 'About', 'Services', 'Team', 'Work or case studies', 'Enquiries', 'Contact'] },
];
export function industryPagePlan(category: unknown): { version: number; profile: string; matched: boolean; suggestedPages: string[] } {
  const value = typeof category === 'string' ? category.slice(0, 240).trim() : '';
  const match = profiles.find(profile => profile.test.test(value));
  return { version: 1, profile: match?.label || 'General business', matched: Boolean(match), suggestedPages: match?.pages || ['Home', 'About', 'Services', 'Contact'] };
}
