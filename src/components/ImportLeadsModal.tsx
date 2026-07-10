import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Loader2, Check } from 'lucide-react';
import { useLeads } from '../context/LeadContext';
import { useToast } from './ui/useToast';

interface ImportLeadsModalProps {
  open: boolean;
  onClose: () => void;
}

type CsvRow = Record<string, string>;

const parseCSV = (text: string): CsvRow[] => {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) return [];
  
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ''));
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    const row: CsvRow = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  });
};

const normKey = (row: CsvRow, keys: string[]) => {
  for (const k of keys) {
    const found = Object.keys(row).find(rk => rk.replace(/[^a-z]/g, '') === k.replace(/[^a-z]/g, ''));
    if (found && row[found]) return row[found].trim();
  }
  return '';
};

const ImportLeadsModal: React.FC<ImportLeadsModalProps> = ({ open, onClose }) => {
  const { addLead } = useLeads() as any;
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(0);

  if (!open) return null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      setRows(parsed);
      setDone(0);
      if (parsed.length === 0) {
        showToast({ type: 'error', title: 'Empty CSV', message: 'No data rows found. Check headers.' });
      }
    } catch (err) {
      showToast({ type: 'error', title: 'Parse failed', message: 'Could not read CSV file.' });
    }
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    let ok = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const businessName = normKey(r, ['businessname', 'name', 'company', 'business']);
      const category = normKey(r, ['category', 'type', 'industry']);
      const city = normKey(r, ['city', 'location', 'address']);
      if (!businessName) continue;

      try {
        await addLead({
          businessName,
          category: category || 'General',
          city: city || 'Unknown',
          rating: 0,
          reviewCount: 0,
          phone: normKey(r, ['phone', 'tel', 'mobile']) || undefined,
          email: normKey(r, ['email', 'mail']) || undefined,
          instagram: normKey(r, ['instagram', 'ig', 'social']) || undefined,
          website: normKey(r, ['website', 'url', 'site', 'web']) || undefined,
          outdatedWebsite: false,
          leadScore: 50,
          priority: 'Medium' as const,
          status: 'New' as const,
          demoStatus: 'Not Started' as const,
          notes: normKey(r, ['notes', 'note', 'comment', 'description']) || `Imported from ${fileName}`,
          demoLink: undefined,
          dealValue: undefined,
          outreachHistory: [],
        });
        ok++;
        setDone(ok);
      } catch (e) {
        console.error('Import row failed', r, e);
      }
    }
    setImporting(false);
    showToast({
      type: 'success',
      title: 'Import complete',
      message: `${ok} of ${rows.length} leads imported.`,
    });
    setRows([]);
    setFileName('');
    onClose();
  };

  const close = () => {
    if (importing) return;
    setRows([]);
    setFileName('');
    onClose();
  };

  const preview = rows.slice(0, 10);
  const inputCls = "w-full neo-in px-4 py-3 rounded-xl outline-none text-[var(--text-primary)] bg-transparent";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4" onClick={close}>
      <div
        className="neo-card w-full max-w-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <FileText size={20} className="text-[var(--accent)]" />
              Import Leads - CSV
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Upload a CSV file. Headers: businessName, category, city, phone, email, website, notes
            </p>
          </div>
          <button onClick={close} className="p-2 rounded-xl neo-button text-[var(--text-secondary)]" aria-label="Close" disabled={importing}>
            <X size={16} />
          </button>
        </div>

        {!rows.length ? (
          <div className="neo-in rounded-2xl p-8 text-center">
            <Upload size={28} className="mx-auto mb-3 text-[var(--text-secondary)]" />
            <p className="text-[var(--text-primary)] font-semibold mb-1">Choose a CSV file</p>
            <p className="text-xs text-[var(--text-secondary)] mb-4">businessName, category, city, phone, email, website, notes</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFile}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white font-medium"
            >
              Select CSV
            </button>
            <p className="text-[11px] text-[var(--text-secondary)] mt-3 opacity-80">
              Tip: export a sample from Google Sheets / Excel as CSV UTF-8
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">{rows.length}</strong> rows found in <strong>{fileName}</strong>
              </span>
              <button
                onClick={() => { setRows([]); setFileName(''); }}
                disabled={importing}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                Choose different file
              </button>
            </div>

            <div className="neo-in rounded-2xl p-3 max-h-64 overflow-auto text-xs">
              <table className="w-full">
                <thead className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                  <tr>
                    <th className="text-left py-2 pr-3">Business</th>
                    <th className="text-left py-2 pr-3">Category</th>
                    <th className="text-left py-2 pr-3">City</th>
                    <th className="text-left py-2">Phone / Email</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--text-primary)]">
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t border-black/5 dark:border-white/5">
                      <td className="py-2 pr-3 truncate max-w-[160px]">{normKey(r, ['businessname','name','company']) || '-'}</td>
                      <td className="py-2 pr-3">{normKey(r, ['category','type']) || '-'}</td>
                      <td className="py-2 pr-3">{normKey(r, ['city','location']) || '-'}</td>
                      <td className="py-2 truncate max-w-[160px]">{normKey(r, ['phone','tel']) || normKey(r, ['email']) || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 10 && (
                <p className="text-[11px] text-[var(--text-secondary)] mt-2">Showing first 10 of {rows.length} rows</p>
              )}
            </div>

            {importing && (
              <div className="text-sm text-[var(--text-secondary)]">
                Importing... {done} / {rows.length}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-5 mt-5 border-t border-black/8 dark:border-white/8">
          <button
            onClick={close}
            disabled={importing}
            className="px-4 py-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!rows.length || importing}
            className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white font-medium disabled:opacity-50 inline-flex items-center gap-2"
          >
            {importing ? <><Loader2 size={16} className="animate-spin" /> Importing {done}/{rows.length}</> : <><Check size={16} /> Import {rows.length} Leads</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportLeadsModal;