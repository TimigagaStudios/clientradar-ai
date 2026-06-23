import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeads } from '../context/LeadContext';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Globe,
  Star,
  Clock,
  AlertCircle,
  ExternalLink,
  Save,
  Send,
  MoreVertical,
  Mail,
  MonitorPlay,
  Sparkles,
  Brain,
} from 'lucide-react';
import { format } from 'date-fns';
import { LeadStatus, LeadPriority, DemoStatus } from '../types';
import { cn } from '../utils/cn';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/useToast';

type LeadNote = {
  id: string;
  content: string;
  created_at: string;
};

type OutreachLog = {
  id: string;
  type: string;
  subject: string;
  body: string;
  sent_at: string;
  channel: string;
};

const LeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const {
    leads,
    loading,
    updateLeadStatus,
    addDemoLink,
    deleteLead,
    updateDemoStatus,
  } = useLeads();

  // ✅ derive lead directly from context
  const lead = leads.find((l) => l.id === id);

  const [demoUrl, setDemoUrl] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [outreachLogs, setOutreachLogs] = useState<OutreachLog[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!id) return;

    const fetchNotes = async () => {
      try {
        const response = await fetch(`/api/lead-notes?leadId=${id}`);
        const result = await response.json();
        if (response.ok) setNotes(result.data || []);
      } catch (error) {
        console.error('Failed to fetch notes', error);
      }
    };

    const fetchOutreachLogs = async () => {
      try {
        const response = await fetch(`/api/outreach-logs?leadId=${id}`);
        const result = await response.json();
        if (response.ok) setOutreachLogs(result.data || []);
      } catch (error) {
        console.error('Failed to fetch outreach logs', error);
      }
    };

    fetchNotes();
    fetchOutreachLogs();
  }, [id]);

  // ✅ Proper loading guard
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
        Loading lead details...
      </div>
    );
  }

  // ✅ Only show not found if loading is done
  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]">
        <p>Lead not found</p>
        <button
          onClick={() => navigate('/leads')}
          className="mt-4 text-[var(--accent)] hover:underline"
        >
          Back to Leads
        </button>
      </div>
    );
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateLeadStatus(lead.id, e.target.value as LeadStatus);
  };

  const handleDemoStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateDemoStatus(lead.id, e.target.value as DemoStatus);
  };

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (demoUrl) {
      addDemoLink(lead.id, demoUrl);
      setDemoUrl('');
      showToast({
        type: 'success',
        title: 'Demo link saved',
        message: 'The demo link has been attached to this lead.',
      });
    }
  };

  const handleDeleteLead = async () => {
    await deleteLead(lead.id);
    setConfirmDeleteOpen(false);
    navigate('/leads');
  };

  const priorityColors: Record<LeadPriority, string> = {
    Low: 'text-gray-400',
    Medium: 'text-yellow-500',
    High: 'text-red-500',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <button
          onClick={() => navigate('/leads')}
          className="flex items-center gap-2 text-[var(--text-secondary)]"
        >
          <ArrowLeft size={20} />
          Back to Leads
        </button>

        <div className="flex items-center gap-4">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="w-11 h-11 flex items-center justify-center rounded-2xl neo-button"
            >
              <MoreVertical size={20} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-3 w-56 neo-card p-2 z-50">
                <button
                  onClick={() => updateLeadStatus(lead.id, 'Interested')}
                  className="w-full px-4 py-3 text-left rounded-xl"
                >
                  Mark Interested
                </button>

                <button
                  onClick={() => updateLeadStatus(lead.id, 'Rejected')}
                  className="w-full px-4 py-3 text-left rounded-xl"
                >
                  Mark Rejected
                </button>

                <button
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="w-full px-4 py-3 text-left rounded-xl text-red-500"
                >
                  Delete Lead
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/outreach')}
            className="btn-neumorph-primary px-5 py-3 text-sm font-bold uppercase"
          >
            Send Outreach
          </button>
        </div>
      </div>

      {/* Rest of your existing layout stays the same */}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete Lead"
        description={`Are you sure you want to delete ${lead.businessName}?`}
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        onConfirm={handleDeleteLead}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
};

export default LeadDetail;