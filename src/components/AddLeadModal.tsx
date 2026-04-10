import React, { useState } from 'react';
import { X } from 'lucide-react';
import Button from './Button';
import { useLeads } from '../context/LeadContext';
import { useToast } from './ui/useToast';

interface AddLeadModalProps {
  open: boolean;
  onClose: () => void;
}

const AddLeadModal: React.FC<AddLeadModalProps> = ({ open, onClose }) => {
  const { addLead } = useLeads();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    businessName: '',
    category: '',
    city: '',
    phone: '',
    email: '',
    instagram: '',
    website: '',
    outdatedWebsite: false,
    leadScore: 50,
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    status: 'New' as const,
    demoStatus: 'Not Started' as const,
    notes: '',
    dealValue: '',
  });

  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);

      await addLead({
        businessName: formData.businessName,
        category: formData.category,
        city: formData.city,
        rating: 0,
        reviewCount: 0,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        instagram: formData.instagram || undefined,
        website: formData.website || undefined,
        outdatedWebsite: formData.outdatedWebsite,
        leadScore: Number(formData.leadScore),
        priority: formData.priority,
        status: formData.status,
        demoStatus: formData.demoStatus,
        notes: formData.notes,
        demoLink: undefined,
        dealValue: formData.dealValue ? Number(formData.dealValue) : undefined,
        outreachHistory: [],
      });

      showToast({
        type: 'success',
        title: 'Lead added',
        message: `${formData.businessName} was added successfully.`,
      });

      onClose();
      setFormData({
        businessName: '',
        category: '',
        city: '',
        phone: '',
        email: '',
        instagram: '',
        website: '',
        outdatedWebsite: false,
        leadScore: 50,
        priority: 'Medium',
        status: 'New',
        demoStatus: 'Not Started',
        notes: '',
        dealValue: '',
      });
    } catch (error) {
      console.error(error);
      showToast({
        type: 'error',
        title: 'Add lead failed',
        message: 'Could not save the lead. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const inputClasses =
    'w-full rounded-2xl neo-in px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none';

  return (
    <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl neo-card p-6 md:p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-[var(--text-primary)]">
              Add New Lead
            </h2>
            <p className="text-[var(--text-secondary)] mt-1">
              Manually create a lead and save it into ClientRadar.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 neo-button text-[var(--text-secondary)] hover:text-[var(--accent)]"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="businessName"
            placeholder="Business Name"
            value={formData.businessName}
            onChange={handleChange}
            className={inputClasses}
            required
          />

          <input
            name="category"
            placeholder="Category"
            value={formData.category}
            onChange={handleChange}
            className={inputClasses}
            required
          />

          <input
            name="city"
            placeholder="City"
            value={formData.city}
            onChange={handleChange}
            className={inputClasses}
            required
          />

          <input
            name="phone"
            placeholder="Phone"
            value={formData.phone}
            onChange={handleChange}
            className={inputClasses}
          />

          <input
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            className={inputClasses}
          />

          <input
            name="instagram"
            placeholder="Instagram"
            value={formData.instagram}
            onChange={handleChange}
            className={inputClasses}
          />

          <input
            name="website"
            placeholder="Website"
            value={formData.website}
            onChange={handleChange}
            className={inputClasses}
          />

          <input
            name="dealValue"
            placeholder="Potential Deal Value"
            value={formData.dealValue}
            onChange={handleChange}
            className={inputClasses}
          />

          <select
            name="priority"
            value={formData.priority}
            onChange={handleChange}
            className={inputClasses}
          >
            <option className="bg-[#0A0A0A] text-white" value="Low">
              Low Priority
            </option>
            <option className="bg-[#0A0A0A] text-white" value="Medium">
              Medium Priority
            </option>
            <option className="bg-[#0A0A0A] text-white" value="High">
              High Priority
            </option>
          </select>

          <input
            name="leadScore"
            type="number"
            placeholder="Lead Score"
            value={formData.leadScore}
            onChange={handleChange}
            className={inputClasses}
          />

          <div className="md:col-span-2">
            <textarea
              name="notes"
              placeholder="Notes"
              value={formData.notes}
              onChange={handleChange}
              className={`${inputClasses} min-h-[120px] resize-none`}
            />
          </div>

          <label className="md:col-span-2 flex items-center gap-3 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              name="outdatedWebsite"
              checked={formData.outdatedWebsite}
              onChange={handleChange}
            />
            Mark website as outdated
          </label>

          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Add Lead'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddLeadModal;
