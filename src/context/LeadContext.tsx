import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Lead, SearchResult, ActivityLog, LeadStatus, LeadPriority } from '../types';

interface LeadContextType {
  leads: Lead[];
  addLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'timeline'>) => void;
  updateLeadStatus: (id: string, status: LeadStatus) => void;
  addDemoLink: (id: string, link: string) => void;
  deleteLead: (id: string) => void;
  importLeads: (leads: Lead[]) => void;
  getLeadsByStatus: (status: LeadStatus) => Lead[];
  resetData: () => void;
}

const LeadContext = createContext<LeadContextType | undefined>(undefined);

const initialLeads: Lead[] = [
  {
    id: '1',
    businessName: 'Sunset Coffee Roasters',
    category: 'Cafe',
    city: 'San Diego',
    rating: 4.8,
    reviewCount: 124,
    phone: '(555) 123-4567',
    website: 'https://sunsetcoffee.com',
    outdatedWebsite: true,
    leadScore: 65,
    priority: 'Medium',
    status: 'New',
    notes: 'Website looks very old, not mobile responsive.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timeline: [
      {
        id: 'e1',
        type: 'Lead Found',
        description: 'Lead discovered via Maps search',
        date: new Date().toISOString()
      }
    ]
  },
  {
    id: '2',
    businessName: 'Elite Plumbing Services',
    category: 'Plumbing',
    city: 'San Diego',
    rating: 3.5,
    reviewCount: 12,
    phone: '(555) 987-6543',
    website: undefined,
    outdatedWebsite: false,
    leadScore: 85,
    priority: 'High',
    status: 'Demo Created',
    demoLink: 'https://demo-eliteplumbing.netlify.app',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    timeline: [
      {
        id: 'e2',
        type: 'Lead Found',
        description: 'Lead discovered via Maps search',
        date: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'e3',
        type: 'Demo Created',
        description: 'Created demo landing page',
        date: new Date().toISOString()
      }
    ]
  },
  {
    id: '3',
    businessName: 'Green Leaf Landscaping',
    category: 'Landscaping',
    city: 'Austin',
    rating: 4.9,
    reviewCount: 45,
    phone: '(555) 555-5555',
    website: 'https://greenleaf.com',
    outdatedWebsite: false,
    leadScore: 30,
    priority: 'Low',
    status: 'Deal Closed',
    dealValue: 1500,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date().toISOString(),
    timeline: [
      {
        id: 'e4',
        type: 'Lead Found',
        description: 'Lead discovered',
        date: new Date(Date.now() - 172800000).toISOString()
      },
      {
        id: 'e5',
        type: 'Deal Closed',
        description: 'Signed contract for $1500 website redesign',
        date: new Date().toISOString()
      }
    ]
  }
];

export const LeadProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [leads, setLeads] = useState<Lead[]>(() => {
    const saved = localStorage.getItem('leads');
    return saved ? JSON.parse(saved) : initialLeads;
  });

  useEffect(() => {
    localStorage.setItem('leads', JSON.stringify(leads));
  }, [leads]);

  const addLead = (leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'timeline'>) => {
    const newLead: Lead = {
      ...leadData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [
        {
          id: crypto.randomUUID(),
          type: 'Lead Found',
          description: 'Added to database manually',
          date: new Date().toISOString()
        }
      ]
    };
    setLeads(prev => [newLead, ...prev]);
  };

  const updateLeadStatus = (id: string, status: LeadStatus) => {
    setLeads(prev => prev.map(lead => {
      if (lead.id === id) {
        const newTimelineEvent: ActivityLog = {
          id: crypto.randomUUID(),
          type: status === 'Deal Closed' ? 'Deal Closed' : 'Status Change',
          description: `Status updated to ${status}`,
          date: new Date().toISOString()
        };
        
        // If closing deal, maybe assign a random value if not present? Or let user set it. 
        // For now we'll just update status.
        let dealValue = lead.dealValue;
        if (status === 'Deal Closed' && !dealValue) {
           dealValue = 2500; // Default deal value simulation
        }

        return {
          ...lead,
          status,
          dealValue,
          updatedAt: new Date().toISOString(),
          timeline: [newTimelineEvent, ...lead.timeline]
        };
      }
      return lead;
    }));
  };

  const addDemoLink = (id: string, link: string) => {
    setLeads(prev => prev.map(lead => {
      if (lead.id === id) {
        return {
          ...lead,
          demoLink: link,
          status: lead.status === 'New' ? 'Demo Created' : lead.status, // Auto update status if new
          updatedAt: new Date().toISOString(),
          timeline: [
            {
              id: crypto.randomUUID(),
              type: 'Demo Created',
              description: `Demo link added: ${link}`,
              date: new Date().toISOString()
            },
            ...lead.timeline
          ]
        };
      }
      return lead;
    }));
  };

  const deleteLead = (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
  };

  const importLeads = (newLeads: Lead[]) => {
    setLeads(prev => [...newLeads, ...prev]);
  };

  const getLeadsByStatus = (status: LeadStatus) => {
    return leads.filter(l => l.status === status);
  };

  const resetData = () => {
    setLeads(initialLeads);
    localStorage.removeItem('leads');
  };

  return (
    <LeadContext.Provider value={{ 
      leads, 
      addLead, 
      updateLeadStatus, 
      addDemoLink, 
      deleteLead,
      importLeads,
      getLeadsByStatus,
      resetData
    }}>
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
