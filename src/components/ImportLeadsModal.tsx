import React, { useState } from 'react';
import { X, FileSpreadsheet, Upload } from 'lucide-react';
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
  const [fileName, setFileName] = useState('');

  if (!open) return null;

  const parseCSVText = (text: string): Lead[] => {
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) return [];

    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('businessname');

    const dataLines = hasHeader ? lines.slice(1) : lines;

    return dataLines.map((line) => {
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
            description: 'Imported via CSV',
            date: new Date().toISOString(),
          },
        ],
        outreachHistory: [],
      };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const text = await file.text();
    setCsvText(text);
  };

  const handleImport = async () => {
    try {
      setImporting(true);

      const parsed = parseCSVText(csvText);

      if (parsed.length === 0) {
        alert('No valid rows found.');
        return;
      }

      await importLeads(parsed);
      setCsvText('');
      setFileName('');
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
              Upload a CSV file or paste CSV text using this order:
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-2 break-all">
              businessName, category, city, phone, email, instagram, website, leadScore, priority, status, notes, dealValue
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 neo-button text-[var(--text-secondary)] hover:text-[var(--accent)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          {/* File Upload */}
          <div className="neo-in rounded-2xl p-5">
            <label className="flex flex-col items-center justify-center gap-3 cursor-pointer text-center">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
                <Upload size={22} className="text-[var(--accent)]" />
              </div>
              <div>
                <p className="font-semibold text-[var(--text-primary)]">
                  Upload CSV file
                </p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Choose a .csv file from your device
                </p>
                {fileName && (
                  <p className="text-xs text-[var(--accent)] mt-2">
                    Selected: {fileName}
                  </p>
                )}
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Example */}
          <div className="neo-in rounded-2xl p-4">
            <p className="text-sm text-[var(--text-secondary)] leading-7">
              Example CSV:
            </p>
            <pre className="text-xs text-[var(--text-primary)] mt-2 whitespace-pre-wrap overflow-x-auto">
{`businessName,category,city,phone,email,instagram,website,leadScore,priority,status,notes,dealValue
TradeCore Academy,Education,Lagos,+2349069584853,hello@tradecore.com,@tradecore,,85,High,New,Potential website redesign client,500
Nova Homes,Real Estate,Abuja,+2348000000000,contact@novahomes.com,@novahomes,https://novahomes.com,60,Medium,Interested,Needs a better modern website,2000`}
            </pre>
          </div>

          {/* Paste CSV */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text-primary)]">
              Or paste CSV text
            </label>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Paste your CSV rows here..."
              className="w-full min-h-[240px] rounded-2xl neo-in p-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none resize-none"
            />
          </div>

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
