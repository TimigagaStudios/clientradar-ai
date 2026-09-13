import React, { useState, useEffect, useRef } from 'react';
import { Lead } from '../types';
import { useLeads } from '../context/LeadContext';
import { useToast } from './ui/useToast';
import { Camera, Loader2, X, Check, Wand2 } from 'lucide-react';

// npm install tesseract.js
import Tesseract from 'tesseract.js';

interface Props {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
}

type ExtractedFields = {
  businessName?: string;
  phone?: string;
  email?: string;
  website?: string;
  city?: string;
  category?: string;
};

// --- Improved OCR field extractor (matches AddLeadModal) ---
const extractFieldsFromText = (text: string): ExtractedFields => {
  const out: ExtractedFields = {};
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const lowerFull = text.toLowerCase();

  const emailMatch = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (emailMatch) out.email = emailMatch[0];

  const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
  if (phoneMatch) out.phone = phoneMatch[0];

  const webMatch = text.match(/(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?/gi);
  if (webMatch) {
    const filtered = webMatch.find(w => !w.includes('@') && !w.match(/\.(png|jpg|jpeg|gif|svg)$/i));
    if (filtered) out.website = filtered.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  // Business name - score each line
  let bestName = '';
  let bestScore = -99;
  lines.slice(0, 12).forEach((ln, idx) => {
    let score = 0;
    const wordCount = ln.split(/\s+/).length;
    const hasDigit = /\d/.test(ln);
    const hasEmail = ln.includes('@');
    const hasUrl = /https?:|\.com|\.net|\.org|www\./i.test(ln);
    const isAllCaps = ln === ln.toUpperCase() && /[A-Z]/.test(ln);
    const isTitleCase = ln.split(/\s+/).every(w => !w || /^[A-Z]/.test(w));
    const isAllLower = ln === ln.toLowerCase();

    score += Math.max(0, 5 - idx);
    if (wordCount >= 2 && wordCount <= 5) score += 3;
    if (wordCount === 1) score -= 1;
    if (isAllCaps && ln.length >= 4 && ln.length <= 50) score += 4;
    if (isTitleCase) score += 3;
    if (isAllLower) score -= 2;
    if (ln.length < 3 || ln.length > 60) score -= 5;
    if (hasEmail || hasUrl) score -= 10;
    if (hasDigit) score -= 4;
    if (/[|ÃÂ©Ã¢â¬Â¢ÃÂ·]/.test(ln)) score -= 3;

    if (score > bestScore && /[a-zA-Z]/.test(ln)) {
      bestScore = score;
      bestName = ln;
    }
  });
  if (bestName) out.businessName = bestName;

  const cityMatch = text.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)*),\s*([A-Z]{2})\s*(\d{5})?/);
  if (cityMatch) out.city = cityMatch[1];

  const categoryMap: Record<string, string[]> = {
    'Real Estate': ['real estate', 'realtor', 'broker', 'property', 'homes', 'realty'],
    'Restaurant': ['restaurant', 'grill', 'kitchen', 'diner', 'cafe', 'bistro', 'pizzeria', 'tacos'],
    'Dental': ['dental', 'dentist', 'orthodont', 'teeth'],
    'Law Firm': ['law', 'attorney', 'lawyer', 'legal', 'firm llp'],
    'Salon': ['salon', 'hair', 'barber', 'beauty', 'nails'],
    'Gym / Fitness': ['gym', 'fitness', 'yoga', 'crossfit', 'pilates'],
    'Auto Repair': ['auto', 'mechanic', 'tire', 'oil change', 'car wash'],
    'Plumbing': ['plumbing', 'plumber', 'drain'],
    'Electrician': ['electric', 'electrician'],
    'Roofing': ['roof', 'roofing'],
    'Education': ['school', 'academy', 'education', 'tutor', 'college', 'university', 'training'],
    'Medical': ['clinic', 'medical', 'doctor', 'health', 'urgent care'],
    'Spa': ['spa', 'massage', 'wellness'],
    'Hotel': ['hotel', 'motel', 'inn', 'lodging'],
    'Retail': ['shop', 'store', 'boutique', 'retail'],
    'Construction': ['construction', 'contractor', 'remodel'],
    'Photography': ['photo', 'photographer', 'studio photo'],
    'Marketing': ['marketing', 'agency', 'seo', 'digital'],
  };
  const searchText = (out.businessName + ' ' + lowerFull).toLowerCase();
  for (const [cat, kws] of Object.entries(categoryMap)) {
    if (kws.some(k => searchText.includes(k))) { out.category = cat; break; }
  }

  return out;
};

const mergeExtracted = (a: ExtractedFields, b: ExtractedFields): ExtractedFields => {
  const pick = (x?: string, y?: string) => {
    if (!x) return y;
    if (!y) return x;
    return y.length > x.length ? y : x;
  };
  return {
    businessName: pick(a.businessName, b.businessName),
    phone: a.phone || b.phone,
    email: a.email || b.email,
    website: a.website || b.website,
    city: a.city || b.city,
    category: a.category || b.category,
  };
};

const EditLeadModal: React.FC<Props> = ({ open, onClose, lead }) => {
  const { updateLead } = useLeads() as any;
  const { showToast } = useToast();

  const [form, setForm] = useState<any>({});

  // OCR import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStep, setOcrStep] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [ocrPreviewUrls, setOcrPreviewUrls] = useState<string[]>([]);
  const [extracted, setExtracted] = useState<ExtractedFields | null>(null);

  useEffect(() => {
    if (lead) {
      setForm({
        businessName: lead.businessName || '',
        city: (lead as any).city || '',
        category: lead.category || '',
        phone: (lead as any).phone || '',
        website: (lead as any).website || '',
        email: (lead as any).email || '',
        rating: (lead as any).rating || '',
        reviewCount: (lead as any).reviewCount || 0,
        leadScore: (lead as any).leadScore || 0,
        priority: (lead as any).priority || 'Medium',
        dealValue: (lead as any).dealValue || '',
      });
      // reset import state when switching leads
      setOcrText('');
      ocrPreviewUrls.forEach(u => URL.revokeObjectURL(u));
      setOcrPreviewUrls([]);
      setExtracted(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead]);

  if (!open || !lead) return null;

  const handleChange = (key: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [key]: value }));
  };

  const runOcrFiles = async (files: File[]) => {
    const take = files.slice(0, 5);
    setOcrRunning(true);
    setOcrProgress(0);
    setOcrText('');
    setExtracted(null);

    ocrPreviewUrls.forEach(u => URL.revokeObjectURL(u));
    const previews = take.map(f => URL.createObjectURL(f));
    setOcrPreviewUrls(previews);

    let merged: ExtractedFields = {};
    let allText = '';

    try {
      for (let i = 0; i < take.length; i++) {
        const file = take[i];
        setOcrStep(`Reading ${i + 1}/${take.length}...`);
        const { data } = await Tesseract.recognize(file, 'eng', {
          logger: m => {
            if (m.status === 'recognizing text' && m.progress) {
              const base = i / take.length;
              const part = (m.progress as number) / take.length;
              setOcrProgress(Math.round((base + part) * 100));
            }
          },
        });
        const text = data.text || '';
        allText += (allText ? '\n\n---\n\n' : '') + text;
        const fields = extractFieldsFromText(text);
        merged = mergeExtracted(merged, fields);
      }
      setOcrText(allText);
      setExtracted(merged);

      // Prefill empty form fields only
      setForm((prev: any) => ({
        ...prev,
        businessName: prev.businessName || merged.businessName || prev.businessName,
        phone: prev.phone || merged.phone || prev.phone,
        email: prev.email || merged.email || prev.email,
        website: prev.website || merged.website || prev.website,
        city: prev.city || merged.city || prev.city,
        category: prev.category || merged.category || prev.category,
      }));

      showToast({
        type: 'success',
        title: 'Screenshot imported',
        message: `${take.length} image${take.length > 1 ? 's' : ''} processed - review and save.`,
      });
    } catch (e) {
      console.error(e);
      showToast({ type: 'error', title: 'OCR failed', message: 'Could not read that image. Try a clearer screenshot.' });
    } finally {
      setOcrRunning(false);
      setOcrStep('');
      setOcrProgress(100);
    }
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) runOcrFiles(files);
    e.target.value = '';
  };

  const applyExtracted = () => {
    if (!extracted) return;
    setForm((prev: any) => ({
      ...prev,
      businessName: extracted.businessName || prev.businessName,
      phone: extracted.phone || prev.phone,
      email: extracted.email || prev.email,
      website: extracted.website || prev.website,
      city: extracted.city || prev.city,
      category: extracted.category || prev.category,
    }));
    showToast({ type: 'success', title: 'Fields applied', message: 'Imported values copied to form.' });
  };

  const clearImport = () => {
    setOcrText('');
    ocrPreviewUrls.forEach(u => URL.revokeObjectURL(u));
    setOcrPreviewUrls([]);
    setExtracted(null);
    setOcrProgress(0);
    setOcrStep('');
  };

  const handleSave = async () => {
    await updateLead(lead.id, {
      ...form,
      rating: Number(form.rating) || 0,
      reviewCount: Number(form.reviewCount) || 0,
      leadScore: Number(form.leadScore) || 0,
      dealValue: form.dealValue ? Number(form.dealValue) : null,
    });
    showToast({
      type: 'success',
      title: 'Lead updated',
      message: `${form.businessName} updated successfully.`,
    });
    onClose();
  };

  const inputCls = "w-full neo-in px-4 py-3 rounded-xl outline-none text-[var(--text-primary)] bg-transparent placeholder-[var(--text-secondary)]";
  const labelCls = "text-[11px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold mb-1 block";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="neo-card w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            Edit Lead
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl neo-button text-[var(--text-secondary)]" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Screenshot Import AI */}
        <div className="neo-in rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Wand2 size={15} className="text-[var(--accent)]" />
              Screenshot Import AI
            </p>
            {ocrPreviewUrls.length > 0 && !ocrRunning && (
              <button onClick={clearImport} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Clear</button>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            Upload a business listing screenshot, business card, or social bio. Text is extracted in-browser - $0 cost.
          </p>

          <div className="flex gap-2 flex-wrap items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onFilePicked}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={ocrRunning}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl neo-button text-sm font-medium text-[var(--text-primary)] disabled:opacity-50"
            >
              {ocrRunning ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              {ocrRunning ? (ocrStep || `Reading... ${ocrProgress}%`) : 'Import from Screenshot'}
            </button>
            <span className="text-xs text-[var(--text-secondary)]">Camera or Photo Library - up to 5 images</span>
            {ocrPreviewUrls.length > 0 && (
              <div className="flex gap-1 flex-wrap w-full mt-1">
                {ocrPreviewUrls.map((url, i) => (
                  <img key={i} src={url} alt={`import ${i+1}`} className="h-12 rounded-lg border border-black/10 dark:border-white/10 object-cover" />
                ))}
              </div>
            )}
          </div>

          {extracted && (
            <div className="mt-3 neo-in rounded-xl p-3 text-xs text-[var(--text-secondary)]">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-[var(--text-primary)]">Extracted fields</span>
                <button onClick={applyExtracted} className="text-[var(--accent)] hover:underline inline-flex items-center gap-1">
                  <Check size={12} /> Apply all
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                {Object.entries(extracted).map(([k,v]) => v ? (
                  <div key={k}><span className="opacity-70">{k}:</span> <span className="text-[var(--text-primary)]">{String(v)}</span></div>
                ) : null)}
                {!Object.values(extracted).some(Boolean) && <span>No fields detected - try a clearer image.</span>}
              </div>
              {ocrText && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[var(--text-secondary)]">View OCR text</summary>
                  <pre className="whitespace-pre-wrap text-[11px] mt-1 max-h-32 overflow-auto opacity-80">{ocrText}</pre>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Business Name</label>
            <input
              value={form.businessName || ''}
              onChange={(e) => handleChange('businessName', e.target.value)}
              placeholder="Business Name"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Phone</label>
              <input
                value={form.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+1 (555) 000-0000"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="hello@business.com"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Website</label>
            <input
              value={form.website || ''}
              onChange={(e) => handleChange('website', e.target.value)}
              placeholder="example.com"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>City</label>
              <input
                value={form.city || ''}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="City"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <input
                value={form.category || ''}
                onChange={(e) => handleChange('category', e.target.value)}
                placeholder="Category"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Latitude</label>
              <input type="number" step="any" min="-90" max="90" value={form.latitude ?? ''} onChange={(e) => handleChange('latitude', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="e.g. 34.0522" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Longitude</label>
              <input type="number" step="any" min="-180" max="180" value={form.longitude ?? ''} onChange={(e) => handleChange('longitude', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="e.g. -118.2437" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Rating</label>
              <input
                type="number"
                step="0.1"
                value={form.rating || ''}
                onChange={(e) => handleChange('rating', e.target.value)}
                placeholder="4.5"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Reviews</label>
              <input
                type="number"
                value={form.reviewCount || ''}
                onChange={(e) => handleChange('reviewCount', e.target.value)}
                placeholder="23"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Lead Score <span className="normal-case opacity-60">AI</span></label>
              <input
                type="number"
                value={form.leadScore || ''}
                onChange={(e) => handleChange('leadScore', e.target.value)}
                placeholder="0-100"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Deal Value ($)</label>
              <input
                type="number"
                value={form.dealValue || ''}
                onChange={(e) => handleChange('dealValue', e.target.value)}
                placeholder="750"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Priority</label>
            <select
              value={form.priority || 'Medium'}
              onChange={(e) => handleChange('priority', e.target.value)}
              className={inputCls}
            >
              <option value="Low">Low Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="High">High Priority</option>
            </select>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1 opacity-80">
              Rating / Score / Priority are AI-computed by default - override manually here if needed.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-black/8 dark:border-white/8">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white font-medium btn-neumorph-primary"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditLeadModal;