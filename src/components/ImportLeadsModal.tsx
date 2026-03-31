import React, { useState } from 'react';
import { X, FileSpreadsheet } from 'lucide-react';
import Button from './Button';
import { useLeads } from '../context/LeadContext';
import { Lead } from '../types';

interface ImportLeadsModalProps {
  open: boolean;
  onClose: () => void;
}

const ImportLeadsModal: React.FC<ImportLeadsModalProps> = ({ open, onClose }) => {
  const { importLeads } = useLeads();
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);

  if (!open) return null;

  const parseCSV = (): Lead[] => {
    const lines = csvText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    return lines.map((line) => {
      const [
        businessName = '',
        category = '',
        city = '',
        phone = '',
        email = '',
        instagram = '',
        website = '',
        leadScore = '0',
        priority = 'Medium',
        status = 'New',
        notes = '',
        dealValue = '',
      ] = line.split(',').map((item) => item.trim());

      return {
        id: crypto.randomUUID(),
        businessName,
        category,
        city,
        rating: 0,
        reviewCount: 0,
        phone: phone || undefined,
        email: email || undefined,
        instagram: instagram || undefined,
        website: website || undefined,
        outdatedWebsite: false,
        leadScore: Number(leadScore) || 0,
        priority: (priority as Lead['priority']) || 'Medium',
        status: (status as Lead['status']) || 'New',
        notes,
        demoLink: undefined,
        dealValue: dealValue ? Number(dealValue) : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: [
          {
            id: crypto.randomUUID(),
            type: 'Lead Imported',
            description: 'Imported via CSV paste',
            date: new Date().toISOString(),
          },
        ],
        outreachHistory: [],
      };
    });
  };

  const handleImport = async () => {
    try {
      setImporting(true);

      const parsed = parseCSV();

      if (parsed.length === 0) {
        alert('No valid rows found.');
        return;
      }

      await importLeads(parsed);
      setCsvText('');
      onClose();
    } catch (error) {
      console.error(error);
      alert('Failed to import leads.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl neo-card p-6 md:p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <FileSpreadsheet size={24} className="text-[var(--accent)]" />
              Import Leads
            </h2>
            <p className="text-[var(--text-secondary)] mt-1">
              Paste CSV rows in this format:
              <br />
              <span className="text-xs">
                businessName, category, city, phone, email, instagram, website, leadScore, priority, status, notes, dealValue
              </span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 neo-button text-[var(--text-secondary)] hover:text-[var(--accent)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="neo-in rounded-2xl p-4">
            <p className="text-sm text-[var(--text-secondary)] leading-7">
              Example:
            </p>
            <pre className="text-xs text-[var(--text-primary)] mt-2 whitespace-pre-wrap">
{`TradeCore Academy,Education,Lagos,+2349069584853,hello@tradecore.com,@tradecore,,85,High,New,Potential website client,500
Nova Homes,Real Estate,Abuja,+2348000000000,contact@novahomes.com,@novahomes,https://novahomes.com,60,Medium,Interested,Needs redesign,2000`}
            </pre>
          </div>

          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Paste your CSV rows here..."
            className="w-full min-h-[260px] rounded-2xl neo-in p-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none resize-none"
          />

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={importing || !csvText.trim()}>
              {importing ? 'Importing...' : 'Import Leads'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportLeadsModal;
