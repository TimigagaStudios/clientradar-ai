import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import AssistantCore from '../components/assistant/AssistantCore';

/**
 * AssistantPage â€” full Executive Agent experience.
 * Placed at /assistant. This is placement (B) in the A/B/C architecture.
 */
const AssistantPage = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <AssistantCore mode="full" />

      <div className="flex justify-center">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 px-5 py-3 neo-in rounded-2xl hover:opacity-90 transition-opacity text-[var(--text-primary)] font-semibold"
        >
          <LayoutDashboard size={18} className="text-[var(--accent)]" />
          Command Center
        </button>
      </div>
    </div>
  );
};

export default AssistantPage;