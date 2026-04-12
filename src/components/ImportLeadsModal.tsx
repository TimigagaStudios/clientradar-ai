import React, { useMemo, useState } from 'react';
import { X, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import Button from './Button';
import { useLeads } from '../context/LeadContext';
import { Lead } from '../types';
import { useToast } from './ui/useToast';

interface ImportLeadsModalProps {
  open: boolean;
  onClose: () => void;
}

type ParsedRow = Lead & {
  validationErrors?: string[];
  duplicate?: boolean;
};

const ImportLeadsModal: React.FC<ImportLeadsModalProps> = ({ open, onClose }) => {
  const { importLeads, leads } = useLeads();
  const { showToast } = useToast();
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [hasPreviewed, setHasPreviewed] = useState(false);

  if (!open) return null;

  const existingNames = new Set(leads.map((lead) => lead.businessName.toLowerCase().trim()));
  const existingEmails = new Set(
    leads
      .map((lead) => lead.email?.toLowerCase().trim())
      .filter(Boolean) as string[]
  );

  const isValidEmail = (email: string) => {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const parseCSVText = (text: string): ParsedRow[] => {
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

      const validationErrors: string[] = [];

      if (!businessName) validationErrors.push('Missing business name');
      if (!category) validationErrors.push('Missing category');
      if (!city) validationErrors.push('Missing city');
      if (email && !isValidEmail(email)) validationErrors.push('Invalid email format');

      const duplicate =
        existingNames.has(businessName.toLowerCase()) ||
        (!!email && existingEmails.has(email.toLowerCase()));

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
        demoStatus: 'Not Started',
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
        validationErrors,
        duplicate,
      };
    });
  };

  const previewRows = useMemo(() => parseCSVText(csvText), [csvText, leads]);

  const validRows = useMemo(
    () =>
      previewRows.filter(
        (row) => (!row.validationErrors || row.validationErrors.length === 0) && !row.duplicate
      ),
    [previewRows]
  );

  const invalidRows = useMemo(
    () =>
      previewRows.filter(
        (row) => row.validationErrors && row.validationErrors.length > 0
      ),
    [previewRows]
  );

  const duplicateRows = useMemo(
    () => previewRows.filter((row) => row.duplicate),
    [previewRows]
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const text = await file.text();
    setCsvText(text);
    setHasPreviewed(false);
  };

  const handlePreview = () => {
    setHasPreviewed(true);
  };

  const handleImport = async () => {
    try {
      setImporting(true);

      if (validRows.length === 0) {
        showToast({
          type: 'error',
          title: 'Import failed',
          message: 'There are no valid rows available to import.',
        });
        return;
      }

      await importLeads(validRows);

      setCsvText('');
      setFileName('');
      setHasPreviewed(false);
      onClose();

      showToast({
        type: 'success',
        title: 'Import successful',
        message: `${validRows.length} valid lead(s) imported successfully.`,
      });
    } catch (error) {
      console.error(error);
      showToast({
        type: 'error',
        title: 'Import failed',
        message: 'Could not import leads. Please review your data and try again.',
      });
    } finally {
      setImporting(false);
    }
  };

  const resetState = () => {
    setCsvText('');
    setFileName('');
    setHasPreviewed(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl neo-card p-6 md:p-8 max-h-[90vh] overflow-y-auto">
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
            onClick={resetState}
            className="p-2 neo-button text-[var(--text-secondary)] hover:text-[var(--accent)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
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

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--text-primary)]">
              Or paste CSV text
            </label>
            <textarea
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setHasPreviewed(false);
              }}
              placeholder="Paste your CSV rows here..."
              className="w-full min-h-[220px] rounded-2xl neo-in p-4 text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none resize-none"
            />
          </div>

          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div className="text-sm text-[var(--text-secondary)]">
              {hasPreviewed ? (
                <span className="inline-flex items-center gap-2 text-green-500">
                  <CheckCircle2 size={16} />
                  {validRows.length} valid row(s), {invalidRows.length} invalid, {duplicateRows.length} duplicate(s)
                </span>
              ) : (
                <span>Preview your rows before importing</span>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={resetState}>
                Cancel
              </Button>

              <Button
                variant="secondary"
                onClick={handlePreview}
                disabled={!csvText.trim()}
              >
                Preview
              </Button>

              <Button
                onClick={handleImport}
                disabled={importing || !hasPreviewed || validRows.length === 0}
              >
                {importing ? 'Importing...' : 'Confirm Import'}
              </Button>
            </div>
          </div>

          {hasPreviewed && (
            <div className="space-y-4">
              {invalidRows.length > 0 && (
                <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-4 text-sm text-yellow-200">
                  <div className="flex items-center gap-2 font-semibold mb-2">
                    <AlertTriangle size={16} />
                    Invalid rows detected
                  </div>
                  <p>Rows missing required fields or using invalid email formats will not be imported.</p>
                </div>
              )}

              {duplicateRows.length > 0 && (
                <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-4 text-sm text-orange-200">
                  <div className="flex items-center gap-2 font-semibold mb-2">
                    <AlertTriangle size={16} />
                    Duplicate rows detected
                  </div>
                  <p>Rows matching existing business names or emails will be skipped.</p>
                </div>
              )}

              <div className="neo-card p-4 overflow-x-auto">
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">
                  Import Preview
                </h3>

                {previewRows.length === 0 ? (
                  <p className="text-[var(--text-secondary)] text-sm">
                    No valid rows detected. Make sure each row contains at least businessName, category, and city.
                  </p>
                ) : (
                  <table className="w-full min-w-[1000px] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-black/8 dark:border-white/8">
                        <th className="p-3 text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Business</th>
                        <th className="p-3 text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Category</th>
                        <th className="p-3 text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">City</th>
                        <th className="p-3 text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Email</th>
                        <th className="p-3 text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Phone</th>
                        <th className="p-3 text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Priority</th>
                        <th className="p-3 text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Status</th>
                        <th className="p-3 text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Validation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => {
                        const isInvalid = row.validationErrors && row.validationErrors.length > 0;
                        const isDuplicate = row.duplicate;

                        return (
                          <tr
                            key={row.id}
                            className="border-b border-black/6 dark:border-white/6 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                          >
                            <td className="p-3 text-[var(--text-primary)] font-medium">{row.businessName}</td>
                            <td className="p-3 text-[var(--text-secondary)]">{row.category}</td>
                            <td className="p-3 text-[var(--text-secondary)]">{row.city}</td>
                            <td className="p-3 text-[var(--text-secondary)]">{row.email || '—'}</td>
                            <td className="p-3 text-[var(--text-secondary)]">{row.phone || '—'}</td>
                            <td className="p-3 text-[var(--text-secondary)]">{row.priority}</td>
                            <td className="p-3 text-[var(--text-secondary)]">{row.status}</td>
                            <td className="p-3">
                              {isInvalid ? (
                                <span className="text-red-400 text-xs">
                                  {row.validationErrors?.join(', ')}
                                </span>
                              ) : isDuplicate ? (
                                <span className="text-orange-400 text-xs">Duplicate</span>
                              ) : (
                                <span className="text-green-500 text-xs">Valid</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportLeadsModal;
