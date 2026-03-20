export type LeadStatus =
  | 'New'
  | 'Demo Created'
  | 'Email Sent'
  | 'Pending Reply'
  | 'Interested'
  | 'Negotiating'
  | 'Rejected'
  | 'Deal Closed';

export type LeadPriority = 'Low' | 'Medium' | 'High';

export interface Lead {
  id: string;
  businessName: string;
  category: string;
  city: string;
  rating: number;
  reviewCount: number;
  phone: string;
  email?: string;
  website?: string; // If undefined/null, means "No Website"
  outdatedWebsite?: boolean;
  leadScore: number;
  priority: LeadPriority;
  status: LeadStatus;
  notes?: string;
  demoLink?: string;
  dealValue?: number; // For revenue calculation
  createdAt: string;
  updatedAt: string;
  timeline: ActivityLog[];
}

export interface ActivityLog {
  id: string;
  type: 'Lead Found' | 'Demo Created' | 'Email Sent' | 'Client Replied' | 'Deal Closed' | 'Note Added' | 'Status Change';
  description: string;
  date: string;
}

export interface SearchResult {
  businessName: string;
  address: string;
  phone: string;
  website?: string;
  rating: number;
  reviewCount: number;
  mapLink?: string;
  outdatedWebsite?: boolean;
}
