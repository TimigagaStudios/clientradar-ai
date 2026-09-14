import React, { useState, useRef } from 'react';
import { X, Camera, Loader2, Check, Wand2 } from 'lucide-react';
import Button from './Button';
import { useLeads } from '../context/LeadContext';
import { useToast } from './ui/useToast';
import Tesseract from 'tesseract.js';
import { parseMapLink } from '../lib/map-link';

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
  address?: string;
};

// ==================== IMPROVED OCR EXTRACTOR ====================
const extractFieldsFromText = (text: string): ExtractedFields => {
  const out: ExtractedFields = {};
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const fullText = text.toLowerCase();

  // 1. Email
  const emailMatch = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (emailMatch) out.email = emailMatch[0];

  // 2. Phone - improved for +1 (213) 430-9112 style
  const phoneMatch = text.match(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) out.phone = phoneMatch[0];

  // 3. Website - improved
  const webMatch = text.match(/(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?/gi);
  if (webMatch) {
    const filtered = webMatch.find(w => 
      !w.includes('@') && 
      !w.match(/\.(png|jpg|jpeg|gif|svg)$/i) &&
      w.length > 4
    );
    if (filtered) out.website = filtered.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  // 4. Business Name (Strongly improved for Yelp/Google Maps screenshots)
  let bestName = '';
  let bestScore = -99;

  lines.slice(0, 8).forEach((line, idx) => {
    let score = 0;
    const wordCount = line.split(/\s+/).length;
    const hasDigit = /\d/.test(line);
    const hasEmail = line.includes('@');
    const hasUrl = /https?:|\.com|\.net|\.org|www\./i.test(line);
    const isTitleCase = line.split(/\s+/).every(w => /^[A-Z]/.test(w) || !w);
    const isAllCaps = line === line.toUpperCase() && /[A-Z]/.test(line);

    // Strong position bonus
    score += Math.max(0, 8 - idx);

    // Word count preference
    if (wordCount >= 2 && wordCount <= 6) score += 6;
    if (wordCount === 1) score -= 3;

    // Casing
    if (isTitleCase) score += 5;
    if (isAllCaps && line.length >= 4) score += 2;

    // Heavy penalties for noise
    if (hasEmail || hasUrl) score -= 20;
    if (hasDigit) score -= 8;
    if (/[|Ã¢â¬Â¢ÃÂ·ÃÂ©ÃâX]/.test(line)) score -= 8;
    if (line.length < 4 || line.length > 55) score -= 8;

    // Bonus for looking like a real business name
    if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(line)) score += 4;

    if (score > bestScore && /[a-zA-Z]/.test(line)) {
      bestScore = score;
      bestName = line;
    }
  });

  // Final cleanup: remove stray single letters and common UI noise
  if (bestName) {
    let cleaned = bestName
      .replace(/^[A-Z]\s+/, '')           // remove leading single letter (e.g. "M Pegasus")
      .replace(/\s+[A-Z]$/, '')           // remove trailing single letter (e.g. "Pegasus X")
      .replace(/\s+[ÃâX]\s*$/, '')         // remove close button artifacts
      .trim();

    // Only accept if it's still a reasonable name
    if (cleaned.length >= 4) {
      out.businessName = cleaned;
    }
  }

  // 5. Category + Location line (Yelp style: "Apartment Rental Agency ÃÂ· Downtown, Los Angeles")
  const categoryLocationMatch = text.match(/([A-Za-z\s&]+)\s*[ÃÂ·Ã¢â¬Â¢]\s*([A-Za-z\s,]+),\s*([A-Za-z\s]+)/);
  if (categoryLocationMatch) {
    if (!out.category) out.category = categoryLocationMatch[1].trim();
    if (!out.city) out.city = categoryLocationMatch[3].trim();
  }

  // 6. City from "City, ST ZIP" pattern
  const cityMatch = text.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)*),\s*([A-Z]{2})\s*\d{5}/);
  if (cityMatch && !out.city) out.city = cityMatch[1];

  // 7. Address (fallback)
  const addressMatch = text.match(/\d+\s+[A-Z][a-z]+\s+St/i);
  if (addressMatch && !out.city) {
    const parts = addressMatch[0].split(',');
    if (parts.length > 1) out.city = parts[1].trim();
  }

  // 8. Category keyword map (expanded)
  const categoryMap: Record<string, string[]> = {
    'Real Estate': ['real estate', 'realtor', 'broker', 'property', 'homes', 'realty', 'apartments'],
    'Restaurant': ['restaurant', 'grill', 'kitchen', 'diner', 'cafe', 'bistro', 'pizzeria'],
    'Dental': ['dental', 'dentist', 'orthodont'],
    'Law Firm': ['law', 'attorney', 'lawyer', 'legal'],
    'Salon': ['salon', 'hair', 'barber', 'beauty', 'nails'],
    'Gym / Fitness': ['gym', 'fitness', 'yoga', 'crossfit'],
    'Auto Repair': ['auto', 'mechanic', 'tire', 'car wash'],
    'Plumbing': ['plumbing', 'plumber'],
    'Electrician': ['electric', 'electrician'],
    'Education': ['school', 'academy', 'education', 'tutor'],
    'Medical': ['clinic', 'medical', 'doctor', 'health'],
    'Spa': ['spa', 'massage', 'wellness'],
    'Hotel': ['hotel', 'motel', 'inn'],
    'Retail': ['shop', 'store', 'boutique'],
    'Construction': ['construction', 'contractor'],
    'Photography': ['photo', 'photographer'],
    'Marketing': ['marketing', 'agency', 'seo'],
  };

  const searchText = (out.businessName + ' ' + fullText).toLowerCase();
  for (const [cat, kws] of Object.entries(categoryMap)) {
    if (kws.some(k => searchText.includes(k))) {
      out.category = cat;
      break;
    }
  }

  return out;
};

const mergeExtracted = (a: ExtractedFields, b: ExtractedFields): ExtractedFields => {
  const pick = (x?: string, y?: string) => (!x ? y : !y ? x : y.length > x.length ? y : x);
  return {
    businessName: pick(a.businessName, b.businessName),
    phone: a.phone || b.phone,
    email: a.email || b.email,
    website: a.website || b.website,
    city: a.city || b.city,
    category: a.category || b.category,
    address: a.address || b.address,
  };
};

// ==================== COMPONENT ====================
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
    mapLink: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    outdatedWebsite: false,
    leadScore: 50,
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    status: 'New' as const,
    demoStatus: 'Not Started' as const,
    notes: '',
    dealValue: '',
  });

  const [saving, setSaving] = useState(false);

  // OCR state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStep, setOcrStep] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [ocrPreviewUrls, setOcrPreviewUrls] = useState<string[]>([]);
  const [extracted, setExtracted] = useState<ExtractedFields | null>(null);

  if (!open) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
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

      // Prefill form
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
        message: `${take.length} image${take.length > 1 ? 's' : ''} processed.`,
      });
    } catch (e) {
      console.error(e);
      showToast({ type: 'error', title: 'OCR failed', message: 'Could not read image.' });
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
    showToast({ type: 'success', title: 'Fields applied' });
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
        latitude: formData.latitude,
        longitude: formData.longitude,
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

      showToast({ type: 'success', title: 'Lead added' });
      onClose();
      // reset form...
    } catch (error) {
      showToast({ type: 'error', title: 'Add lead failed' });
    } finally {
      setSaving(false);
    }
  };

  const inputClasses = 'w-full rounded-2xl neo-in px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none bg-transparent';

  return (
    <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl neo-card p-6 md:p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-[var(--text-primary)]">Add New Lead</h2>
            <p className="text-[var(--text-secondary)] mt-1">Manually create a lead, or import from a screenshot.</p>
          </div>
          <button onClick={onClose} className="p-2 neo-button text-[var(--text-secondary)] hover:text-[var(--accent)]">
            <X size={18} />
          </button>
        </div>

        {/* Screenshot Import AI */}
        <div className="neo-in rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Wand2 size={15} className="text-[var(--accent)]" /> Screenshot Import AI
            </p>
            {ocrPreviewUrls.length > 0 && !ocrRunning && (
              <button type="button" onClick={clearImport} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Clear</button>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            Snap a business listing, business card, or social bio. Extracts name, phone, email, website, city, category.
          </p>

          <div className="flex gap-2 flex-wrap items-center">
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFilePicked} />
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
                {Object.entries(extracted).map(([k, v]) => v ? (
                  <div key={k}><span className="opacity-70">{k}:</span> <span className="text-[var(--text-primary)]">{String(v)}</span></div>
                ) : null)}
              </div>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input name="businessName" placeholder="Business Name" value={formData.businessName} onChange={handleChange} className={inputClasses} required />
          <input name="category" placeholder="Category" value={formData.category} onChange={handleChange} className={inputClasses} required />
          <input name="city" placeholder="City" value={formData.city} onChange={handleChange} className={inputClasses} required />
          <input name="phone" placeholder="Phone" value={formData.phone} onChange={handleChange} className={inputClasses} />
          <input name="email" placeholder="Email" value={formData.email} onChange={handleChange} className={inputClasses} />
          <div className="md:col-span-2 flex gap-2">
            <input name="mapLink" placeholder="Apple Maps or Google Maps link" value={formData.mapLink} onChange={handleChange} className={inputClasses} />
            <button type="button" onClick={() => { const parsed = parseMapLink(formData.mapLink); if (!parsed) return showToast({ type: 'error', title: 'Map link not recognized', message: 'Paste a full place link.' }); setFormData(prev => ({ ...prev, businessName: parsed.businessName || prev.businessName, city: parsed.address?.split(',').slice(-2, -1)[0]?.trim() || prev.city, latitude: parsed.latitude, longitude: parsed.longitude, notes: parsed.address ? `${prev.notes ? `${prev.notes}\n` : ''}Map address: ${parsed.address}` : prev.notes })); showToast({ type: 'success', title: 'Location extracted', message: 'The business name and coordinates were filled in.' }); }} className="shrink-0 rounded-2xl bg-[var(--accent)] px-4 text-xs font-bold text-white">Parse</button>
          </div>
          <input name="dealValue" type="number" placeholder="Potential Deal Value ($)" value={formData.dealValue} onChange={handleChange} className={inputClasses} />
          <select name="priority" value={formData.priority} onChange={handleChange} className={inputClasses}>
            <option value="Low">Low Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="High">High Priority</option>
          </select>

          <div className="md:col-span-2">
            <textarea name="notes" placeholder="Notes" value={formData.notes} onChange={handleChange} className={`${inputClasses} min-h-[100px] resize-none`} />
          </div>

          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add Lead'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddLeadModal;