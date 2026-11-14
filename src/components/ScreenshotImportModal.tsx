import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Images, Loader2, Pencil, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { useLeads } from '../context/LeadContext';
import { useToast } from './ui/useToast';
import { foldIncoming, mergeDuplicates, sameBusiness } from '../lib/importMatch';

// AI Screenshot Import. Many screenshots in, one record per business out, reviewed by the
// owner, then saved into the normal leads list. Images are shrunk on the device and sent
// one at a time, so a large batch never has to fit in a single upload.

const BATCH_LIMIT_MB = Number((import.meta as any).env?.VITE_IMPORT_BATCH_MB) > 0 ? Number((import.meta as any).env.VITE_IMPORT_BATCH_MB) : 100;
const IMAGE_LIMIT_MB = 30;
const FORMATS = /\.(jpe?g|png|webp|heic|heif)$/i;
const LOW_CONFIDENCE = 0.6;

type Shot = { id: string; file: File; batchId: string; url: string; status: 'waiting' | 'reading' | 'done' | 'failed'; found: number; error: string; joined?: number };
type ImportRecord = {
  id: string; batchId: string; fileName: string; extractedAt: string; saved: boolean; confidence: number;
  name: string; category: string; address: string; city: string; country: string; phone: string; website: string; email: string;
  rating: number | null; reviewCount: number | null; description: string; merged?: number;
};
const MERGE_FIELDS = ['name', 'category', 'address', 'city', 'country', 'phone', 'website', 'email', 'rating', 'reviewCount', 'description'];

const uid = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const megabytes = (bytes: number) => (bytes / 1048576).toFixed(bytes > 10485760 ? 0 : 1);
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

// Shrinks an image on the device to a size the AI reads well and the server accepts.
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('This image format could not be opened on this device'));
      element.src = url;
    });
    let scale = Math.min(1, 1500 / image.naturalWidth, Math.sqrt(6_000_000 / (image.naturalWidth * image.naturalHeight)));
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This device could not prepare the image');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/jpeg', 0.82).split(',')[1] || '';
      if (data.length > 1000 && data.length < 3_300_000) return data;
      scale *= 0.75;
    }
    throw new Error('This image is too large to send, even after shrinking');
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function postTeam(body: Record<string, unknown>) {
  const response = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const raw = await response.text();
  let result: any = null;
  try { result = JSON.parse(raw); } catch { result = null; }
  if (!result) throw Object.assign(new Error(response.status === 413 ? 'The image was too large for the server' : response.status === 504 ? 'The server took too long. Try again.' : `The server answered ${response.status}`), { limit: false });
  if (!response.ok || !result.success) throw Object.assign(new Error(result.error || 'Request failed'), { limit: Boolean(result.limit) });
  return result.data;
}

const ScreenshotImportModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { leads, refreshLeads } = useLeads() as any;
  const { showToast } = useToast();
  const picker = useRef<HTMLInputElement>(null);
  const stopRef = useRef(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [records, setRecords] = useState<ImportRecord[]>([]);
  const recordsRef = useRef<ImportRecord[]>([]);
  useEffect(() => { recordsRef.current = records; }, [records]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState('');
  const [rejected, setRejected] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');
  const [storeReady, setStoreReady] = useState(true);

  // Carry on with records left waiting from an earlier visit or another device.
  useEffect(() => {
    if (!open) return;
    fetch('/api/team?view=imports').then((response) => response.json()).then((result) => {
      const waiting: ImportRecord[] = result?.data?.records || [];
      setStoreReady(result?.data?.ready !== false);
      if (waiting.length) setRecords((current) => (current.length ? current : waiting));
    }).catch(() => undefined);
  }, [open]);

  // Warnings shown beside each record: possible duplicates, low confidence, missing details.
  const flags = useMemo(() => {
    const map: Record<string, { duplicate: string; low: boolean; missing: string[] }> = {};
    records.forEach((record, index) => {
      let duplicate = '';
      const existing = (leads || []).find((lead: any) => sameBusiness(record, { name: lead.businessName, website: lead.website, phone: lead.phone, city: lead.city }));
      if (existing) duplicate = `Already in your leads: ${existing.businessName} (${sameBusiness(record, { name: existing.businessName, website: existing.website, phone: existing.phone, city: existing.city })})`;
      if (!duplicate) {
        const earlier = records.slice(0, index).find((other) => sameBusiness(record, other));
        if (earlier) duplicate = `Same as "${earlier.name || 'another record'}" above (${sameBusiness(record, earlier)})`;
      }
      const missing = [!record.name ? 'name' : '', !record.phone ? 'phone' : '', !record.website ? 'website' : '', !record.email ? 'email' : ''].filter(Boolean);
      map[record.id] = { duplicate, low: record.confidence < LOW_CONFIDENCE, missing };
    });
    return map;
  }, [records, leads]);

  const verified = (record: ImportRecord) => Boolean(record.name) && !flags[record.id]?.duplicate && !flags[record.id]?.low;
  const duplicateCount = records.filter((record) => flags[record.id]?.duplicate).length;
  const uncertainCount = records.filter((record) => flags[record.id]?.low || !record.name).length;
  const chosen = records.filter((record) => selected.has(record.id) && record.name);
  const done = shots.filter((shot) => shot.status === 'done' || shot.status === 'failed').length;
  const waitingShots = shots.filter((shot) => shot.status === 'waiting' || shot.status === 'failed');

  const addFiles = (list: FileList | null) => {
    if (!list || !list.length) return;
    const batchId = `B${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}-${uid().slice(-4)}`;
    const problems: string[] = [];
    const accepted: Shot[] = [];
    let total = 0;
    Array.from(list).forEach((file) => {
      const isImage = file.type.startsWith('image/') || FORMATS.test(file.name);
      if (!isImage) return problems.push(`${file.name}: not an image (use JPG, PNG, WebP or HEIC)`);
      if (file.size > IMAGE_LIMIT_MB * 1048576) return problems.push(`${file.name}: ${megabytes(file.size)} MB is over the ${IMAGE_LIMIT_MB} MB limit for one image`);
      if (total + file.size > BATCH_LIMIT_MB * 1048576) return problems.push(`${file.name}: left out, this batch reached the ${BATCH_LIMIT_MB} MB limit. Add it as another batch.`);
      total += file.size;
      accepted.push({ id: uid(), file, batchId, url: URL.createObjectURL(file), status: 'waiting', found: 0, error: '' });
    });
    setRejected(problems);
    setShots((current) => [...current, ...accepted]);
    if (picker.current) picker.current.value = '';
  };

  const removeShot = (id: string) => setShots((current) => {
    const shot = current.find((item) => item.id === id);
    if (shot) URL.revokeObjectURL(shot.url);
    return current.filter((item) => item.id !== id);
  });

  const patchShot = (id: string, patch: Partial<Shot>) => setShots((current) => current.map((shot) => (shot.id === id ? { ...shot, ...patch } : shot)));

  // Reads the waiting screenshots one after another, so the free AI limit is respected.
  const start = async () => {
    const queue = shots.filter((shot) => shot.status === 'waiting' || shot.status === 'failed');
    if (!queue.length || running) return;
    stopRef.current = false;
    setRunning(true);
    setNotice('');
    for (const shot of queue) {
      if (stopRef.current) break;
      patchShot(shot.id, { status: 'reading', error: '' });
      try {
        const image = await shrink(shot.file);
        let data: any = null;
        for (let attempt = 0; attempt < 3 && !data; attempt += 1) {
          try {
            data = await postTeam({ action: 'extract', image, mimeType: 'image/jpeg', batchId: shot.batchId, fileName: shot.file.name });
          } catch (error: any) {
            if (!error?.limit || attempt === 2 || stopRef.current) throw error;
            setNotice('The free AI limit was reached. Waiting 30 seconds, then carrying on...');
            await wait(30000);
            setNotice('');
          }
        }
        const found: ImportRecord[] = data?.records || [];
        if (data && data.saved === false && found.length) setStoreReady(false);
        // Screenshots of the same business in one batch (top of the card + its details page) join into one record.
        const folded = foldIncoming(recordsRef.current, found, MERGE_FIELDS);
        recordsRef.current = folded.records;
        setRecords(folded.records);
        if (folded.removedIds.length) void postTeam({ action: 'import-update', removeIds: folded.removedIds }).catch(() => undefined);
        folded.changed.forEach((record) => { void postTeam({ action: 'import-update', id: record.id, data: record }).catch(() => undefined); });
        patchShot(shot.id, { status: 'done', found: found.length, joined: folded.removedIds.length });
      } catch (error) {
        patchShot(shot.id, { status: 'failed', error: error instanceof Error ? error.message : 'Could not read this screenshot' });
      }
    }
    setRunning(false);
  };

  // New records start selected only when they are verified; uncertain ones stay visible but unticked.
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    const fresh = records.filter((record) => !seen.current.has(record.id));
    if (!fresh.length) return;
    fresh.forEach((record) => seen.current.add(record.id));
    setSelected((current) => {
      const next = new Set(current);
      fresh.forEach((record) => { if (verified(record)) next.add(record.id); });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, flags]);

  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const removeRecords = (ids: string[]) => {
    if (!ids.length) return;
    setRecords((current) => current.filter((record) => !ids.includes(record.id)));
    setSelected((current) => { const next = new Set(current); ids.forEach((id) => next.delete(id)); return next; });
    void postTeam({ action: 'import-update', removeIds: ids }).catch(() => undefined);
  };

  // Repeats inside this list are folded into the first record (keeping any extra phone, website or
  // address); records that match a lead you already have are removed.
  const mergeAndRemove = () => {
    const saved = (record: ImportRecord) => (leads || []).some((lead: any) => sameBusiness(record, { name: lead.businessName, website: lead.website, phone: lead.phone, city: lead.city }));
    const result = mergeDuplicates(records, saved, MERGE_FIELDS);
    if (!result.removedIds.length) return;
    setRecords(result.kept);
    setSelected((current) => { const next = new Set(current); result.removedIds.forEach((id) => next.delete(id)); return next; });
    void postTeam({ action: 'import-update', removeIds: result.removedIds }).catch(() => undefined);
    result.changed.forEach((record) => { void postTeam({ action: 'import-update', id: record.id, data: record }).catch(() => undefined); });
  };

  const editField = (id: string, field: keyof ImportRecord, value: string) => setRecords((current) => current.map((record) => {
    if (record.id !== id) return record;
    if (field === 'rating' || field === 'reviewCount') return { ...record, [field]: value.trim() === '' || Number.isNaN(Number(value)) ? null : Number(value) };
    return { ...record, [field]: value };
  }));

  const finishEdit = (id: string) => {
    setEditing('');
    const record = records.find((item) => item.id === id);
    if (record) void postTeam({ action: 'import-update', id, data: record }).catch(() => undefined);
  };

  const importChosen = async () => {
    if (!chosen.length || importing) return;
    setImporting(true);
    let imported = 0;
    try {
      for (let index = 0; index < chosen.length; index += 100) {
        const part = chosen.slice(index, index + 100);
        const data = await postTeam({ action: 'import-save', records: part });
        imported += Number(data?.imported || 0);
        const ids = part.map((record) => record.id);
        setRecords((current) => current.filter((record) => !ids.includes(record.id)));
        setSelected((current) => { const next = new Set(current); ids.forEach((id) => next.delete(id)); return next; });
      }
      await refreshLeads();
      showToast({ type: 'success', title: `${imported} ${imported === 1 ? 'lead' : 'leads'} imported`, message: 'They are in your leads list now.' });
    } catch (error) {
      if (imported) await refreshLeads();
      showToast({ type: 'error', title: 'Import stopped', message: `${imported} imported. ${error instanceof Error ? error.message : 'Please try again.'}` });
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;
  const close = () => { if (!importing) { stopRef.current = true; onClose(); } };
  const input = 'w-full neo-in px-3 py-2 rounded-xl outline-none text-sm text-[var(--text-primary)] bg-transparent';
  const chip = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold';
  const fields: { key: keyof ImportRecord; label: string }[] = [
    { key: 'name', label: 'Business name' }, { key: 'category', label: 'Category' }, { key: 'phone', label: 'Phone' }, { key: 'website', label: 'Website' },
    { key: 'email', label: 'Email' }, { key: 'city', label: 'City' }, { key: 'address', label: 'Address' }, { key: 'rating', label: 'Rating' }, { key: 'reviewCount', label: 'Reviews' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-3 sm:p-4" onClick={close}>
      <div className="neo-card w-full max-w-3xl p-5 md:p-8 max-h-[92vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2"><Images size={20} className="text-[var(--accent)]" />AI Screenshot Import</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Add screenshots of business listings (Apple Maps, Google Maps or any directory). The AI reads every business into its own record for you to review before anything is saved.</p>
          </div>
          <button onClick={close} className="p-2 rounded-xl neo-button text-[var(--text-secondary)]" aria-label="Close" disabled={importing}><X size={16} /></button>
        </div>

        <div className="neo-in rounded-2xl p-5 text-center">
          <Upload size={24} className="mx-auto mb-2 text-[var(--text-secondary)]" />
          <input ref={picker} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={(event) => addFiles(event.target.files)} />
          <button type="button" onClick={() => picker.current?.click()} disabled={running} className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white font-medium disabled:opacity-50">{shots.length ? 'Add another batch' : 'Choose screenshots'}</button>
          <p className="text-[11px] text-[var(--text-secondary)] mt-3">Tip: for each business add two screenshots, the top of its card and its details page. They are joined into one lead.</p>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">JPG, PNG, WebP or HEIC. Up to {BATCH_LIMIT_MB} MB per batch, any number of batches.</p>
        </div>

        {rejected.length > 0 && (
          <div className="mt-3 rounded-2xl border border-amber-500/40 p-3 text-xs text-amber-500">
            <p className="font-semibold mb-1">{rejected.length} {rejected.length === 1 ? 'file was' : 'files were'} not added:</p>
            {rejected.slice(0, 6).map((line) => <p key={line}>{line}</p>)}
            {rejected.length > 6 && <p>and {rejected.length - 6} more.</p>}
          </div>
        )}

        {shots.length > 0 && (
          <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-sm">
              <span className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{shots.length}</strong> {shots.length === 1 ? 'screenshot' : 'screenshots'} ({megabytes(shots.reduce((sum, shot) => sum + shot.file.size, 0))} MB), {done} read</span>
              <div className="flex gap-2">
                {running
                  ? <button type="button" onClick={() => { stopRef.current = true; }} className="px-4 py-2 rounded-xl neo-button text-sm text-[var(--text-primary)]">Stop after this one</button>
                  : waitingShots.length > 0 && <button type="button" onClick={start} className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium">{done ? `Read remaining ${waitingShots.length}` : `Read ${waitingShots.length} with AI`}</button>}
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mb-3"><div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${shots.length ? (done / shots.length) * 100 : 0}%` }} /></div>
            {notice && <p className="text-xs text-amber-500 mb-2">{notice}</p>}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-56 overflow-y-auto pr-1">
              {shots.map((shot) => (
                <div key={shot.id} className="relative rounded-xl overflow-hidden neo-in" title={shot.error || shot.file.name}>
                  <img src={shot.url} alt={shot.file.name} className="w-full h-24 object-cover" />
                  <div className="px-1.5 py-1 text-[10px] leading-tight text-[var(--text-secondary)]">
                    {shot.status === 'waiting' && 'Waiting'}
                    {shot.status === 'reading' && <span className="inline-flex items-center gap-1 text-[var(--accent)]"><Loader2 size={10} className="animate-spin" />Reading</span>}
                    {shot.status === 'done' && <span className="text-emerald-500">{shot.found} found{shot.joined ? `, ${shot.joined} joined` : ''}</span>}
                    {shot.status === 'failed' && <span className="text-red-500">Failed: {shot.error.slice(0, 60)}</span>}
                  </div>
                  {shot.status !== 'reading' && <button type="button" onClick={() => removeShot(shot.id)} aria-label={`Remove ${shot.file.name}`} className="absolute top-1 right-1 grid place-items-center w-6 h-6 rounded-full bg-black/70 text-white"><X size={12} /></button>}
                </div>
              ))}
            </div>
          </div>
        )}

        {records.length > 0 && (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h3 className="font-bold text-[var(--text-primary)]">Review: {records.length} {records.length === 1 ? 'business' : 'businesses'} found</h3>
              <span className="text-sm text-[var(--text-secondary)]">{chosen.length} selected</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-3">{duplicateCount} possible {duplicateCount === 1 ? 'duplicate' : 'duplicates'}, {uncertainCount} uncertain. Marked records are kept here for you to decide; nothing is thrown away for you.</p>
            {!storeReady && <p className="text-xs text-amber-500 mb-3">These records are only held in this tab until the database step for this feature is done. Import them before closing.</p>}
            <div className="flex flex-wrap gap-2 mb-3 text-xs">
              <button type="button" onClick={() => setSelected(new Set(records.filter(verified).map((record) => record.id)))} className="px-3 py-2 rounded-xl neo-button text-[var(--text-primary)]">Select all verified</button>
              <button type="button" onClick={() => setSelected(new Set())} className="px-3 py-2 rounded-xl neo-button text-[var(--text-primary)]">Select none</button>
              {duplicateCount > 0 && <button type="button" onClick={mergeAndRemove} className="px-3 py-2 rounded-xl neo-button text-[var(--text-primary)]">Merge and remove {duplicateCount} {duplicateCount === 1 ? 'duplicate' : 'duplicates'}</button>}
            </div>
            <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
              {records.map((record) => {
                const flag = flags[record.id] || { duplicate: '', low: false, missing: [] };
                const open_ = editing === record.id;
                return (
                  <div key={record.id} className="neo-in rounded-2xl p-3">
                    <div className="flex items-start gap-3">
                      <button type="button" role="checkbox" aria-checked={selected.has(record.id)} aria-label={`Select ${record.name || 'record'}`} disabled={!record.name} onClick={() => toggle(record.id)} className={`mt-0.5 grid place-items-center w-6 h-6 shrink-0 rounded-md border ${selected.has(record.id) ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-[var(--text-secondary)] text-transparent'} disabled:opacity-40`}><Check size={14} /></button>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[var(--text-primary)] break-words">{record.name || 'Name not readable'}</p>
                        <p className="text-xs text-[var(--text-secondary)] break-words">{[record.category, record.city || record.address, record.phone, record.website, record.email, record.rating !== null ? `${record.rating} stars${record.reviewCount !== null ? ` (${record.reviewCount})` : ''}` : ''].filter(Boolean).join(' | ') || 'No other details visible'}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className={`${chip} ${flag.low ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'}`}>{Math.round(record.confidence * 100)}% sure</span>
                          {(record.merged || 0) > 1 && <span className={`${chip} bg-emerald-500/15 text-emerald-500`}>Joined from {record.merged} screenshots</span>}
                          {flag.duplicate && <span className={`${chip} bg-red-500/15 text-red-500`}><AlertTriangle size={11} />{flag.duplicate}</span>}
                          {flag.missing.length > 0 && <span className={`${chip} bg-black/10 dark:bg-white/10 text-[var(--text-secondary)]`}>Missing: {flag.missing.join(', ')}</span>}
                          <span className={`${chip} bg-black/10 dark:bg-white/10 text-[var(--text-secondary)]`}>{record.fileName}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button type="button" onClick={() => (open_ ? finishEdit(record.id) : setEditing(record.id))} aria-label={open_ ? 'Finish editing' : `Edit ${record.name || 'record'}`} className="p-2 rounded-xl neo-button text-[var(--text-secondary)]">{open_ ? <Check size={14} /> : <Pencil size={14} />}</button>
                        <button type="button" onClick={() => removeRecords([record.id])} aria-label={`Remove ${record.name || 'record'}`} className="p-2 rounded-xl neo-button text-[var(--text-secondary)]"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {open_ && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                        {fields.map((field) => (
                          <label key={field.key} className="text-[11px] font-semibold text-[var(--text-secondary)]">{field.label}
                            <input className={`${input} mt-1`} value={record[field.key] === null ? '' : String(record[field.key])} onChange={(event) => editField(record.id, field.key, event.target.value)} inputMode={field.key === 'rating' || field.key === 'reviewCount' ? 'decimal' : undefined} />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={importChosen} disabled={!chosen.length || importing || running} className="mt-4 w-full px-5 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2">
              {importing ? <><Loader2 size={16} className="animate-spin" />Importing...</> : <>Import {chosen.length} selected {chosen.length === 1 ? 'lead' : 'leads'}</>}
            </button>
            {running && <p className="text-[11px] text-[var(--text-secondary)] mt-2 text-center">Still reading screenshots. You can review while it works; import when it finishes.</p>}
          </div>
        )}

        {!shots.length && !records.length && (
          <p className="text-xs text-[var(--text-secondary)] mt-4 inline-flex items-start gap-2"><RotateCcw size={14} className="mt-0.5 shrink-0" />Keep this window open while screenshots are being read. Records already read are kept for review if you come back later.</p>
        )}
      </div>
    </div>
  );
};

export default ScreenshotImportModal;
