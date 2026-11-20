import { useState } from 'react';

type Issue = { code: string; path: string; message: string };
const EDITABLE = /^(businessName|disclaimer|contact\.(email|phone|instagram)|hero\.(eyebrow|title|description|cta)|about\.(title|body)|closing\.(title|body|cta)|(?:services|highlights|process|faq|sections)\.\d+\.(?:title|body|question|answer)|showcase\.title|showcase\.items\.\d+\.(?:title|subtitle|detail))$/;

export default function QaCorrection({ jobId, fingerprint, issue, content, onSaved }: { jobId: string; fingerprint: string; issue: Issue; content: Record<string, unknown> | null; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [path, setPath] = useState(issue.code === 'missing_contact' ? 'contact.email' : issue.path);
  const [openedFingerprint, setOpenedFingerprint] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const missingContact = issue.code === 'missing_contact' && issue.path === 'contact';
  const showcase = content?.showcase && typeof content.showcase === 'object' && !Array.isArray(content.showcase) ? content.showcase as Record<string, unknown> : {};
  const items = Array.isArray(showcase.items) ? showcase.items.slice(0, 30) : [];
  const sampleOptions = issue.code === 'sample_showcase' && issue.path === 'showcase' ? items.flatMap((item, index) => item && typeof item === 'object' && !Array.isArray(item) ? ['title', 'subtitle', 'detail'].map(field => ({ path: `showcase.items.${index}.${field}`, label: `Item ${index + 1} - ${field}` })) : []) : [];
  const editable = EDITABLE.test(issue.path) || missingContact || sampleOptions.length > 0;
  const readValue = (field: string) => {
    let current: any = content;
    for (const key of field.split('.')) current = current && typeof current === 'object' ? current[key] : undefined;
    return typeof current === 'string' ? current : '';
  };
  const openEditor = () => {
    const field = sampleOptions.length ? sampleOptions[0].path : missingContact ? 'contact.email' : issue.path;
    setPath(field); setValue(readValue(field)); setOpenedFingerprint(fingerprint);
    setError(''); setOpen(true);
  };
  const chooseField = (field: string) => {
    if (value !== readValue(path) && !window.confirm('Discard your unsaved text and choose another field?')) return;
    setPath(field); setValue(readValue(field));
  };
  const save = async () => {
    if (!window.confirm('Approve your replacement text for this demo? This changes the demo and rechecks it, but does not send anything.')) return;
    setSaving(true); setError('');
    let saved = false;
    try {
      const response = await fetch('/api/demo-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'qa-correct', jobId, fingerprint: openedFingerprint, path, value, confirm: true }) });
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Could not save the correction.');
      saved = true;
      await onSaved(); setOpen(false);
    } catch (reason) {
      setError(saved ? 'Correction saved, but the review could not refresh. Reload the page before editing again.' : reason instanceof Error ? reason.message : 'Could not save the correction.');
      if (saved) setOpen(false);
    } finally { setSaving(false); }
  };
  return <li className="mb-2 break-words">
    <span>{issue.message} ({issue.path})</span>
    <p className="text-[var(--text-secondary)]">Suggested action: review this field and use only information you have confirmed.</p>
    {sampleOptions.length > 0 && <p className="text-[var(--text-secondary)]">Editing an item does not remove its sample label or approve sharing.</p>}
    {error && <p role="alert" className="text-red-500">{error}</p>}
    {editable && !open && <button type="button" onClick={openEditor} className="mt-1 text-[var(--accent)] font-bold">Review and enter a correction</button>}
    {open && <div className="mt-2 space-y-2">
      {missingContact && <label className="block text-xs">Contact field <select value={path} onChange={(event) => chooseField(event.target.value)} className="neo-in rounded-lg px-2 py-1"><option value="contact.email">Email</option><option value="contact.phone">Phone</option></select></label>}
      {sampleOptions.length > 0 && <label className="block text-xs">Showcase field <select value={path} onChange={(event) => chooseField(event.target.value)} className="neo-in max-w-full rounded-lg px-2 py-1">{sampleOptions.map(option => <option key={option.path} value={option.path}>{option.label}</option>)}</select></label>}
      <textarea value={value} onChange={(event) => setValue(event.target.value)} aria-label={`Replacement for ${path}`} maxLength={4000} rows={4} className="w-full rounded-xl neo-in px-3 py-2 text-sm text-[var(--text-primary)]" />
      <p className="text-[var(--text-secondary)]">Enter the exact approved wording. No new business facts will be filled in for you.</p>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={() => void save()} className="btn-neumorph px-3 py-2 font-bold disabled:opacity-50">{saving ? 'Saving...' : 'Approve correction'}</button><button type="button" disabled={saving} onClick={() => setOpen(false)} className="btn-neumorph px-3 py-2 disabled:opacity-50">Cancel</button></div>
    </div>}
  </li>;
}
