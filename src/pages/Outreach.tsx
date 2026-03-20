import React, { useState } from 'react';
import { useLeads } from '../context/LeadContext';
import { 
  Send, 
  Mail, 
  CheckCircle, 
  ChevronRight,
  User,
  Search,
  FileText
} from 'lucide-react';
import { cn } from '../utils/cn';

const Outreach = () => {
  const { leads, updateLeadStatus } = useLeads();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [template, setTemplate] = useState('intro');
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedLead = leads.find(l => l.id === selectedLeadId);

  const templates = {
    intro: {
      subject: "Question about {business_name}'s website",
      body: "Hi,\n\nI was looking for {business_name} online and noticed your website could use some updates to get more customers.\n\nI've created a quick demo of what a modern site for your business could look like: {demo_link}\n\nLet me know if you'd like to discuss.\n\nBest,\n[Your Name]"
    },
    followup: {
      subject: "Re: Question about {business_name}'s website",
      body: "Hi again,\n\nJust wanted to follow up on my previous email. Did you get a chance to check out the demo site I made for {business_name}?\n\nHere is the link again: {demo_link}\n\nThanks,\n[Your Name]"
    }
  };

  const getPreview = () => {
    if (!selectedLead) return { subject: '', body: '' };
    
    const t = templates[template as keyof typeof templates];
    const demoLink = selectedLead.demoLink || "(No demo link yet)";
    
    return {
      subject: t.subject.replace(/{business_name}/g, selectedLead.businessName),
      body: t.body
        .replace(/{business_name}/g, selectedLead.businessName)
        .replace(/{demo_link}/g, demoLink)
    };
  };

  const handleSend = () => {
    if (!selectedLeadId) return;
    setIsSending(true);
    
    setTimeout(() => {
      updateLeadStatus(selectedLeadId, 'Email Sent');
      setIsSending(false);
      setSelectedLeadId(null);
    }, 1500);
  };

  const filteredLeads = leads.filter(l => 
    (l.status === 'New' || l.status === 'Demo Created') &&
    l.businessName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const preview = getPreview();

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6">
      {/* Lead List */}
      <div className="w-1/3 flex flex-col bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <h2 className="font-bold text-[var(--color-text-primary)] mb-4">Select Lead</h2>
          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={16} />
             <input 
               type="text" 
               placeholder="Search leads..." 
               className="w-full pl-9 pr-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {filteredLeads.map(lead => (
            <button
              key={lead.id}
              onClick={() => setSelectedLeadId(lead.id)}
              className={cn(
                "w-full text-left p-4 border-b border-[var(--color-border)] hover:bg-[var(--color-background)] transition-colors flex items-center justify-between group",
                selectedLeadId === lead.id ? "bg-[var(--color-accent)]/10 border-l-4 border-l-[var(--color-accent)]" : "border-l-4 border-l-transparent"
              )}
            >
              <div>
                <p className={cn("font-medium", selectedLeadId === lead.id ? "text-[var(--color-accent)]" : "text-[var(--color-text-primary)]")}>
                  {lead.businessName}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">{lead.city}</p>
              </div>
              <ChevronRight size={16} className={cn("text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity", selectedLeadId === lead.id && "opacity-100 text-[var(--color-accent)]")} />
            </button>
          ))}
          {filteredLeads.length === 0 && (
             <div className="p-8 text-center text-[var(--color-text-secondary)] text-sm">
               No leads available for outreach.
             </div>
          )}
        </div>
      </div>

      {/* Email Composer */}
      <div className="flex-1 flex flex-col bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
         {selectedLead ? (
           <>
             <div className="p-6 border-b border-[var(--color-border)] flex justify-between items-center">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-[var(--color-background)] flex items-center justify-center text-[var(--color-text-secondary)]">
                   <User size={20} />
                 </div>
                 <div>
                   <h2 className="font-bold text-[var(--color-text-primary)]">{selectedLead.businessName}</h2>
                   <p className="text-sm text-[var(--color-text-secondary)]">To: {selectedLead.email || "No email found (will log manually)"}</p>
                 </div>
               </div>
               
               <div className="flex items-center gap-2">
                 <select 
                   value={template}
                   onChange={(e) => setTemplate(e.target.value)}
                   className="bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--color-accent)]"
                 >
                   <option value="intro">Intro Email</option>
                   <option value="followup">Follow Up</option>
                 </select>
               </div>
             </div>

             <div className="flex-1 p-6 space-y-4 overflow-y-auto">
               <div className="space-y-2">
                 <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Subject</label>
                 <div className="p-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm font-medium">
                   {preview.subject}
                 </div>
               </div>
               
               <div className="space-y-2 h-full flex flex-col">
                 <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Message</label>
                 <div className="flex-1 p-4 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm whitespace-pre-wrap font-mono">
                   {preview.body}
                 </div>
               </div>
             </div>

             <div className="p-4 border-t border-[var(--color-border)] flex justify-between items-center bg-[var(--color-background)]">
                <p className="text-xs text-[var(--color-text-secondary)]">
                  <CheckCircle size={12} className="inline mr-1" />
                  Using {template} template
                </p>
                <button 
                  onClick={handleSend}
                  disabled={isSending}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:bg-blue-600 shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all"
                >
                  {isSending ? (
                    'Sending...' 
                  ) : (
                    <>
                      <Send size={16} /> Send Email
                    </>
                  )}
                </button>
             </div>
           </>
         ) : (
           <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-secondary)]">
             <Mail size={48} className="mb-4 opacity-20" />
             <p className="text-lg font-medium">Select a lead to start outreach</p>
             <p className="text-sm opacity-60">Choose a lead from the list on the left</p>
           </div>
         )}
      </div>
    </div>
  );
};

export default Outreach;
