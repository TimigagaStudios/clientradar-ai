import React, { useState, useEffect } from 'react';
import { Lead } from '../types';
import { useLeads } from '../context/LeadContext';
import { useToast } from './ui/useToast';
import ConfirmDialog from './ui/ConfirmDialog';

interface Props {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
}

const EditLeadModal: React.FC<Props> = ({ open, onClose, lead }) => {
  const { updateLead } = useLeads();
  const { showToast } = useToast();

  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (lead) {
      setForm({
        businessName: lead.businessName,
        city: lead.city,
        category: lead.category,
        rating: lead.rating,
        reviewCount: lead.reviewCount,
        leadScore: lead.leadScore,
        priority: lead.priority,
        dealValue: lead.dealValue || '',
      });
    }
  }, [lead]);

  if (!open || !lead) return null;

  const handleChange = (key: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await updateLead(lead.id, {
      ...form,
      rating: Number(form.rating),
      reviewCount: Number(form.reviewCount),
      leadScore: Number(form.leadScore),
      dealValue: form.dealValue ? Number(form.dealValue) : null,
    });

    showToast({
      type: 'success',
      title: 'Lead updated',
      message: `${form.businessName} updated successfully.`,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="neo-card w-full max-w-lg p-6 space-y-5">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          Edit Lead
        </h2>

        <div className="space-y-4">

          <input
            value={form.businessName || ''}
            onChange={(e) => handleChange('businessName', e.target.value)}
            placeholder="Business Name"
            className="w-full neo-in px-4 py-3 rounded-xl outline-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              value={form.city || ''}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="City"
              className="neo-in px-4 py-3 rounded-xl outline-none"
            />
            <input
              value={form.category || ''}
              onChange={(e) => handleChange('category', e.target.value)}
              placeholder="Category"
              className="neo-in px-4 py-3 rounded-xl outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              value={form.rating || 0}
              onChange={(e) => handleChange('rating', e.target.value)}
              placeholder="Rating"
              className="neo-in px-4 py-3 rounded-xl outline-none"
            />
            <input
              type="number"
              value={form.reviewCount || 0}
              onChange={(e) => handleChange('reviewCount', e.target.value)}
              placeholder="Reviews"
              className="neo-in px-4 py-3 rounded-xl outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              value={form.leadScore || 0}
              onChange={(e) => handleChange('leadScore', e.target.value)}
              placeholder="Lead Score"
              className="neo-in px-4 py-3 rounded-xl outline-none"
            />
            <input
              type="number"
              value={form.dealValue || ''}
              onChange={(e) => handleChange('dealValue', e.target.value)}
              placeholder="Deal Value ($)"
              className="neo-in px-4 py-3 rounded-xl outline-none"
            />
          </div>

          <select
            value={form.priority || 'Medium'}
            onChange={(e) => handleChange('priority', e.target.value)}
            className="w-full neo-in px-4 py-3 rounded-xl outline-none"
          >
            <option value="Low">Low Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="High">High Priority</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[var(--text-secondary)]"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-[var(--accent)] text-white font-medium"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditLeadModal;