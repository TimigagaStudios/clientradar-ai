import React, { useState, useRef } from 'react';
import { X, Camera, Loader2, Check, Wand2, Upload } from 'lucide-react';
import Button from './Button';
import { useLeads } from '../context/LeadContext';
import { useToast } from './ui/useToast';

// npm install tesseract.js
import Tesseract from 'tesseract.js';

interface AddLeadModalProps {
  open: boolean;
  onClose: () => void;
}

type ExtractedFields = {
  businessName?: string;
  phone?: string;
  email?: string;
  website?: string;
  city?: string;
  category?: string;
};

// --- Improved OCR field extractor ---
const extractFieldsFromText = (text: string): ExtractedFields => {
  const out: ExtractedFields = {};
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const lowerFull = text.toLowerCase();

  // Email
  const emailMatch = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (emailMatch) out.email = emailMatch[0];

  // Phone
  const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
  if (phoneMatch) out.phone = phoneMatch[0];

  // Website
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

    // position bonus - earlier lines more likely to be the name
    score += Math.max(0, 5 - idx);
    // word count sweet spot
    if (wordCount >= 2 && wordCount <= 5) score += 3;
    if (wordCount === 1) score -= 1;
    // casing
    if (isAllCaps && ln.length >= 4 && ln.length <= 50) score += 4;
    if (isTitleCase) score += 3;
    if (isAllLower) score -= 2;
    // length
    if (ln.length < 3 || ln.length > 60) score -= 5;
    // penalize contact-like lines
    if (hasEmail || hasUrl) score -= 10;
    if (hasDigit) score -= 4;
    if (/[|Â©â€¢Â·]/.test(ln)) score -= 3;

    if (score > bestScore && /[a-zA-Z]/.test(ln)) {
      bestScore = score;
      bestName = ln;
    }
  });
  if (bestName) out.businessName = bestName;

  // City - "City, ST 12345"
  const cityMatch = text.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)*),\s*([A-Z]{2})\s*(\d{5})?/);
  if (cityMatch) out.city = cityMatch[1];

  // Category - expanded keyword map
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
    // prefer longer business name, otherwise first seen
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

  // OCR import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStep, setOcrStep] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [ocrPreviewUrls, setOcrPreviewUrls] = useState<string[]>([]);
  const [extracted, setExtracted] = useState<ExtractedFields | null>(null);

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

  const runOcrFiles = async (files: File[]) => {
    const take = files.slice(0, 5);
    setOcrRunning(true);
    setOcrProgress(0);
    setOcrText('');
    setExtracted(null);

    // preview urls
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
      setFormData(prev => ({
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
        message: `${take.length} image${take.length > 1 ? 's' : ''} processed - review fields and save.`,
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
    setFormData(prev => ({
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
      clearImport();
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
    'w-full rounded-2xl neo-in px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none bg-transparent';

  return (
    <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl neo-card p-6 md:p-8 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-[var(--text-primary)]">
              Add New Lead
            </h2>
            <p className="text-[var(--text-secondary)] mt-1">
              Manually create a lead, or import from a screenshot.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 neo-button text-[var(--text-secondary)] hover:text-[var(--accent)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Screenshot Import AI */}
        <div className="neo-in rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Wand2 size={15} className="text-[var(--accent)]" />
              Screenshot Import AI
            </p>
            {ocrPreviewUrls.length > 0 && !ocrRunning && (
              <button type="button" onClick={clearImport} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Clear</button>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            Snap a business listing, business card, or social bio. Extracts name, phone, email, website, city, category - in-browser, $0.
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
                <button type="button" onClick={applyExtracted} className="text-[var(--accent)] hover:underline inline-flex items-center gap-1">
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
            type="number"
            placeholder="Potential Deal Value ($)"
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
            placeholder="Lead Score (AI computes if left at 50)"
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
          <p className="md:col-span-2 text-[11px] text-[var(--text-secondary)] opacity-80">
            Lead Score / Priority are AI-computed by default in ClientRadar - override manually here if needed.
          </p>
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