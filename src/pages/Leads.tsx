import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLeads } from '../context/LeadContext';
import {
  Search,
  MoreHorizontal,
  Send,
  Edit3,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lead, LeadPriority, LeadStatus } from '../types';
import { cn } from '../utils/cn';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/useToast';
import EditLeadModal from '../components/EditLeadModal';

const LeadCard: React.FC<{ lead: Lead }> = ({ lead }) => {
  const { updateLeadStatus, deleteLead } = useLeads();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const priorityColors: Record<LeadPriority, string> = {
    Low: 'text-gray-400',
    Medium: 'text-yellow-500',
    High: 'text-red-500',
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDeleteLead = async () => {
    await deleteLead(lead.id);
    setConfirmDeleteOpen(false);
    setMenuOpen(false);
    showToast({
      type: 'success',
      title: 'Lead deleted',
      message: `${lead.businessName} removed from pipeline.`,
    });
  };

  return (
    <div className="mb-6 relative">
      <div className="relative neo-card p-5">

        {/* ✅ Top action row */}
        <div className="flex justify-end gap-2 mb-3">
          <button
            className="w-10 h-10 flex items-center justify-center rounded-2xl neo-button"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/outreach');
            }}
          >
            <Send size={16} />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              className="w-10 h-10 flex items-center justify-center rounded-2xl neo-button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
            >
              <MoreHorizontal size={18} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 neo-card p-2 z-50">
                <button
                  onClick={() => {
                    setEditOpen(true);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                >
                  <Edit3 size={14} className="inline mr-2" />
                  Edit Lead
                </button>

                <button
                  onClick={() => updateLeadStatus(lead.id, 'Interested')}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                >
                  Mark Interested
                </button>

                <button
                  onClick={() => updateLeadStatus(lead.id, 'Rejected')}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                >
                  Mark Rejected
                </button>

                <button
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="w-full text-left px-4 py-3 rounded-xl text-red-500"
                >
                  Delete Lead
                </button>
              </div>
            )}
          </div>
        </div>

        <Link to={`/leads/${lead.id}`}>
          <h3 className="font-bold text-lg text-[var(--text-primary)]">
            {lead.businessName}
          </h3>

          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {lead.city} • {lead.category}
          </p>

          <div className="mt-4 flex justify-between pt-3 border-t border-black/8 dark:border-white/8">
            <div>
              <span className="text-xs text-[var(--text-secondary)] uppercase">
                Lead Score
              </span>
              <p className="font-bold text-lg">{lead.leadScore}</p>
            </div>

            <div>
              <span className="text-xs text-[var(--text-secondary)] uppercase">
                Priority
              </span>
              <p className={cn('font-medium', priorityColors[lead.priority])}>
                {lead.priority}
              </p>
            </div>
          </div>
        </Link>
      </div>

      <EditLeadModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        lead={lead}
      />

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

const Leads = () => {
  const { leads } = useLeads();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [searchTerm, setSearchTerm] = useState(initialQuery);

  useEffect(() => {
    setSearchTerm(searchParams.get('q') || '');
  }, [searchParams]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) =>
      lead.businessName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [leads, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
          size={18}
        />
        <input
          type="text"
          placeholder="Search businesses..."
          className="w-full pl-12 pr-4 py-3 rounded-2xl neo-in"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div>
        {filteredLeads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
};

export default Leads;