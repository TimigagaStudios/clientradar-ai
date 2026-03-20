import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeads } from '../context/LeadContext';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Globe, 
  Star, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Save,
  Send,
  MoreVertical,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { LeadStatus, LeadPriority } from '../types';
import { cn } from '../utils/cn';

const LeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { leads, updateLeadStatus, addDemoLink } = useLeads();
  const [lead, setLead] = useState(leads.find(l => l.id === id));
  const [demoUrl, setDemoUrl] = useState('');

  useEffect(() => {
    setLead(leads.find(l => l.id === id));
  }, [leads, id]);

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-secondary)]">
        <p>Lead not found</p>
        <button onClick={() => navigate('/leads')} className="mt-4 text-[var(--color-accent)]">Back to Leads</button>
      </div>
    );
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateLeadStatus(lead.id, e.target.value as LeadStatus);
  };

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (demoUrl) {
      addDemoLink(lead.id, demoUrl);
      setDemoUrl('');
    }
  };

  const statusOptions: LeadStatus[] = [
    'New', 'Demo Created', 'Email Sent', 'Pending Reply', 
    'Interested', 'Negotiating', 'Rejected', 'Deal Closed'
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <button 
          onClick={() => navigate('/leads')}
          className="flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Leads
        </button>
        <div className="flex items-center gap-3">
           <button className="p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-card)] rounded-lg">
             <MoreVertical size={20} />
           </button>
           <button className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:bg-blue-600 shadow-lg shadow-blue-500/20">
             <Send size={16} /> Send Outreach
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card */}
          <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-6 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">{lead.businessName}</h1>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-[var(--color-text-secondary)]">
                  <span className="flex items-center gap-1"><MapPin size={16} /> {lead.city}</span>
                  <span className="w-1 h-1 bg-[var(--color-text-secondary)] rounded-full"></span>
                  <span>{lead.category}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                 <div className="text-right">
                    <span className="text-xs text-[var(--color-text-secondary)] uppercase block mb-1">Status</span>
                    <div className="relative">
                      <select 
                        value={lead.status}
                        onChange={handleStatusChange}
                        className="appearance-none bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] pl-3 pr-8 py-1.5 rounded-lg text-sm focus:outline-none focus:border-[var(--color-accent)] cursor-pointer hover:border-[var(--color-text-secondary)] transition-colors"
                      >
                        {statusOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--color-text-secondary)]">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-[var(--color-border)]">
               <div>
                 <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Contact Info</h3>
                 <div className="space-y-3">
                   <div className="flex items-center gap-3 text-[var(--color-text-primary)]">
                     <Phone size={18} className="text-[var(--color-text-secondary)]" />
                     {lead.phone}
                   </div>
                   <div className="flex items-center gap-3 text-[var(--color-text-primary)]">
                     <Globe size={18} className="text-[var(--color-text-secondary)]" />
                     {lead.website ? (
                       <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline truncate">
                         {lead.website}
                       </a>
                     ) : (
                       <span className="text-red-400 flex items-center gap-2"><AlertCircle size={14} /> No Website</span>
                     )}
                   </div>
                 </div>
               </div>

               <div>
                 <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Metrics</h3>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="bg-[var(--color-background)] p-3 rounded-lg border border-[var(--color-border)]">
                     <span className="text-xs text-[var(--color-text-secondary)] block mb-1">Rating</span>
                     <div className="flex items-center gap-1 font-bold text-lg text-[var(--color-text-primary)]">
                       {lead.rating} <Star size={14} className="text-yellow-500 fill-yellow-500" />
                     </div>
                   </div>
                   <div className="bg-[var(--color-background)] p-3 rounded-lg border border-[var(--color-border)]">
                     <span className="text-xs text-[var(--color-text-secondary)] block mb-1">Lead Score</span>
                     <div className={cn("font-bold text-lg", lead.leadScore > 70 ? 'text-green-500' : 'text-yellow-500')}>
                       {lead.leadScore}
                     </div>
                   </div>
                 </div>
               </div>
            </div>
          </div>

          {/* Demo Link Section */}
          <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-6">
            <h3 className="font-bold text-lg text-[var(--color-text-primary)] mb-4">Demo Website</h3>
            {lead.demoLink ? (
              <div className="flex items-center justify-between p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="bg-purple-500 text-white p-2 rounded-lg">
                    <Globe size={20} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm text-purple-200 font-medium">Demo Available</p>
                    <a href={lead.demoLink} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline truncate block">
                      {lead.demoLink}
                    </a>
                  </div>
                </div>
                <a href={lead.demoLink} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-purple-500/20 rounded-lg transition-colors text-purple-400">
                  <ExternalLink size={20} />
                </a>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} className="flex gap-2">
                <input 
                  type="url" 
                  placeholder="Paste demo website link here..." 
                  className="flex-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent)]"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                />
                <button 
                  type="submit"
                  disabled={!demoUrl}
                  className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Save
                </button>
              </form>
            )}
          </div>

          {/* Notes Section */}
          <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-6">
             <h3 className="font-bold text-lg text-[var(--color-text-primary)] mb-4">Notes</h3>
             <textarea 
               className="w-full h-32 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4 text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
               placeholder="Add notes about this lead..."
               defaultValue={lead.notes}
             ></textarea>
             <div className="flex justify-end mt-3">
               <button className="flex items-center gap-2 px-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-lg text-sm font-medium transition-colors">
                 <Save size={16} /> Save Notes
               </button>
             </div>
          </div>
        </div>

        {/* Sidebar Column (Timeline) */}
        <div className="space-y-6">
           <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-6">
             <h3 className="font-bold text-lg text-[var(--color-text-primary)] mb-4">Activity Journal</h3>
             <div className="relative pl-4 space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-0.5 before:bg-[var(--color-border)]">
               {lead.timeline.map((event, idx) => (
                 <div key={event.id || idx} className="relative pl-6">
                   <div className="absolute left-[-5px] top-1.5 w-3 h-3 rounded-full bg-[var(--color-card)] border-2 border-[var(--color-accent)] z-10"></div>
                   <div>
                     <p className="text-sm font-medium text-[var(--color-text-primary)]">{event.type}</p>
                     <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{event.description}</p>
                     <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 flex items-center gap-1 opacity-70">
                       <Clock size={10} />
                       {format(new Date(event.date), 'MMM d, yyyy h:mm a')}
                     </p>
                   </div>
                 </div>
               ))}
             </div>
           </div>

           <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-6">
             <h3 className="font-bold text-lg text-[var(--color-text-primary)] mb-4">Lead Value</h3>
             <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-[var(--color-text-primary)]">
                  ${lead.dealValue?.toLocaleString() || '0'}
                </span>
                <span className="text-[var(--color-text-secondary)] text-sm">potential value</span>
             </div>
             <p className="text-xs text-[var(--color-text-secondary)] mt-2">
               Estimated based on standard website package pricing.
             </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetail;
