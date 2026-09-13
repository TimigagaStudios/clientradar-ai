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

export type DemoStatus = 'Not Started' | 'In Progress' | 'Ready' | 'Sent';

export type ActivityLog = {
  id: string;
  type: string;
  description: string;
  date: string;
};

export type OutreachLog = {
  id: string;
  type: 'intro' | 'followup';
  subject: string;
  body: string;
  sentAt: string;
  channel: 'email';
};

export type Lead = {
  id: string;
  businessName: string;
  category: string;
  city: string;
  latitude?: number;
  longitude?: number;
  rating: number;
  reviewCount: number;
  phone?: string;
  email?: string;
  instagram?: string;
  website?: string;
  outdatedWebsite: boolean;
  leadScore: number;
  priority: LeadPriority;
  status: LeadStatus;
  demoStatus?: DemoStatus;
  notes?: string;
  demoLink?: string;
  dealValue?: number;
  createdAt: string;
  updatedAt: string;
  timeline: ActivityLog[];
  outreachHistory?: OutreachLog[];
};

export type SearchResult = {
  businessName: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  outdatedWebsite: boolean;
  rating: number;
  reviewCount: number;
  mapLink: string;
};
