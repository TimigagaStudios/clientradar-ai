import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Lead, ActivityLog, LeadStatus, OutreachLog } from '../types';

interface LeadContextType {
  leads: Lead[];
  loading: boolean;
  addLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'timeline'>) => Promise<void>;
  updateLeadStatus: (id: string, status: LeadStatus) => Promise<void>;
  addDemoLink: (id: string, link: string) => Promise<void>;
  addOutreachLog: (id: string, log: Omit<OutreachLog, 'id'>) => Promise<void>;
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
    rating: row.rating || 0,
    reviewCount: row.review_count || 0,
    phone: row.phone || undefined,
    website: row.website || undefined,
    outdatedWebsite: row.outdated_website || false,
    leadScore: row.lead_score || 0,
    priority: row.priority,
    status: row.status,
    notes: row.notes || '',
    demoLink: row.demo_link || undefined,
    dealValue: row.deal_value || undefined,
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

  const addLead = async (leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'timeline'>) => {
    const payload = {
      ...leadData,
      timeline: [
        {
          id: crypto.randomUUID(),
          type: 'Lead Found',
          description: 'Added to database manually',
          date: new Date().toISOString(),
        },
      ],
      outreachHistory: [],
    };

    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || 'Failed to add lead');
    }

    await refreshLeads();
  };

  const updateLeadStatus = async (id: string, status: LeadStatus) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;

    const newTimelineEvent: ActivityLog = {
      id: crypto.randomUUID(),
      type: status === 'Deal Closed' ? 'Deal Closed' : 'Status Change',
      description: `Status updated to ${status}`,
      date: new Date().toISOString(),
    };

    let dealValue = lead.dealValue;
    if (status === 'Deal Closed' && !dealValue) {
      dealValue = 2500;
    }

    const response = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status,
        dealValue,
        timeline: [newTimelineEvent, ...(lead.timeline || [])],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || 'Failed to update lead status');
    }

    await refreshLeads();
  };

  const addDemoLink = async (id: string, link: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;

    const updatedStatus = lead.status === 'New' ? 'Demo Created' : lead.status;

    const newTimelineEvent: ActivityLog = {
      id: crypto.randomUUID(),
      type: 'Demo Created',
      description: `Demo link added: ${link}`,
      date: new Date().toISOString(),
    };

    const response = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        demoLink: link,
        status: updatedStatus,
        timeline: [newTimelineEvent, ...(lead.timeline || [])],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || 'Failed to add demo link');
    }

    await refreshLeads();
  };

  const addOutreachLog = async (id: string, log: Omit<OutreachLog, 'id'>) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;

    const outreachItem: OutreachLog = {
      ...log,
      id: crypto.randomUUID(),
    };

    const newTimelineEvent: ActivityLog = {
      id: crypto.randomUUID(),
      type: 'Outreach Sent',
      description: `Sent ${log.type} email outreach`,
      date: new Date().toISOString(),
    };

    const response = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outreachHistory: [outreachItem, ...(lead.outreachHistory || [])],
        timeline: [newTimelineEvent, ...(lead.timeline || [])],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || 'Failed to add outreach log');
    }

    await refreshLeads();
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

  const importLeads = async (newLeads: Lead[]) => {
    for (const lead of newLeads) {
      await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessName: lead.businessName,
          category: lead.category,
          city: lead.city,
          rating: lead.rating,
          reviewCount: lead.reviewCount,
          phone: lead.phone,
          website: lead.website,
          outdatedWebsite: lead.outdatedWebsite,
          leadScore: lead.leadScore,
          priority: lead.priority,
          status: lead.status,
          notes: lead.notes,
          demoLink: lead.demoLink,
          dealValue: lead.dealValue,
          timeline: lead.timeline || [],
          outreachHistory: lead.outreachHistory || [],
        }),
      });
    }

    await refreshLeads();
  };

  const getLeadsByStatus = (status: LeadStatus) => {
    return leads.filter((lead) => lead.status === status);
  };

  const resetData = async () => {
    for (const lead of leads) {
      await fetch(`/api/leads/${lead.id}`, {
        method: 'DELETE',
      });
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
        addDemoLink,
        addOutreachLog,
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
  if (context === undefined) {
    throw new Error('useLeads must be used within a LeadProvider');
  }
  return context;
};
