import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Lead, ActivityLog, LeadStatus, OutreachLog, DemoStatus } from '../types';

interface LeadContextType {
  leads: Lead[];
  loading: boolean;
  addLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'timeline'>) => Promise<void>;
  updateLeadStatus: (id: string, status: LeadStatus) => Promise<void>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;
  addDemoLink: (id: string, link: string) => Promise<void>;
  addOutreachLog: (id: string, log: Omit<OutreachLog, 'id'>) => Promise<void>;
  updateDemoStatus: (id: string, demoStatus: DemoStatus) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  importLeads: (leads: Lead[]) => Promise<void>;
  getLeadsByStatus: (status: LeadStatus) => Lead[];
  resetData: () => Promise<void>;
  refreshLeads: () => Promise<void>;
}

const LeadContext = createContext<LeadContextType | undefined>(undefined);

function mapSupabaseLead(row: any): Lead {
  return {
    id: row.id,
    businessName: row.business_name,
    category: row.category,
    city: row.city,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    rating: row.rating || 0,
    reviewCount: row.review_count || 0,
    phone: row.phone || undefined,
    email: row.email || undefined,
    instagram: row.instagram || undefined,
    website: row.website || undefined,
    outdatedWebsite: row.outdated_website || false,
    leadScore: row.lead_score || 0,
    priority: row.priority,
    status: row.status,
    demoStatus: row.demo_status || 'Not Started',
    notes: row.notes || '',
    demoLink: row.demo_link || undefined,
    dealValue: row.deal_value || undefined,
    clientReplies: row.client_replies || [],   // Ã¢Åâ¦ NEW
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    timeline: row.timeline || [],
    outreachHistory: row.outreach_history || [],
  };
}

export const LeadProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshLeads = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/leads');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Failed to fetch leads');
      }

      const mapped = (result.data || []).map(mapSupabaseLead);
      setLeads(mapped);
    } catch (error) {
      console.error('Failed to refresh leads:', error);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshLeads();
  }, []);

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    const response = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || 'Failed to update lead');
    }

    await refreshLeads();
  };

  const updateLeadStatus = async (id: string, status: LeadStatus) => {
    await updateLead(id, { status });
  };

  const addDemoLink = async (id: string, link: string) => {
    await updateLead(id, {
      demoLink: link,
      demoStatus: 'Ready',
    });
  };

  const updateDemoStatus = async (id: string, demoStatus: DemoStatus) => {
    await updateLead(id, { demoStatus });
  };

  const addOutreachLog = async (id: string, log: Omit<OutreachLog, 'id'>) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;

    const outreachItem: OutreachLog = {
      ...log,
      id: crypto.randomUUID(),
    };

    await updateLead(id, {
      outreachHistory: [outreachItem, ...(lead.outreachHistory || [])],
    });
  };

  const deleteLead = async (id: string) => {
    const response = await fetch(`/api/leads/${id}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || 'Failed to delete lead');
    }

    await refreshLeads();
  };

  const addLead = async (leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'timeline'>) => {
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadData),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || 'Failed to add lead');
    }

    await refreshLeads();
  };

  const importLeads = async (newLeads: Lead[]) => {
    for (const lead of newLeads) {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      });
    }
    await refreshLeads();
  };

  const getLeadsByStatus = (status: LeadStatus) => {
    return leads.filter((lead) => lead.status === status);
  };

  const resetData = async () => {
    for (const lead of leads) {
      await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' });
    }
    await refreshLeads();
  };

  return (
    <LeadContext.Provider
      value={{
        leads,
        loading,
        addLead,
        updateLeadStatus,
        updateLead,
        addDemoLink,
        addOutreachLog,
        updateDemoStatus,
        deleteLead,
        importLeads,
        getLeadsByStatus,
        resetData,
        refreshLeads,
      }}
    >
      {children}
    </LeadContext.Provider>
  );
};

export const useLeads = () => {
  const context = useContext(LeadContext);
  if (!context) {
    throw new Error('useLeads must be used within a LeadProvider');
  }
  return context;
};