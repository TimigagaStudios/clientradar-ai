import { useState } from 'react';

type Issue = { code: string; path: string; message: string };
const EDITABLE = /^(businessName|disclaimer|contact\.(email|phone|instagram)|hero\.(eyebrow|title|description|cta)|about\.(title|body)|closing\.(title|body|cta)|(?:services|highlights|process|faq|sections)\.\d+\.(?:title|body|question|answer))$/;

export default function QaCorrection({ jobId, fingerprint, issue, content, onSaved }: { jobId: string; fingerprint: string; issue: Issue; content: Record<string, unknown> | null; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [path, setPath] = useState(issue.code === 'missing_contact' ? 'contact.email' : issue.path);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const missingContact = issue.code === 'missing_contact' && issue.path === 'contact';
  const editable = EDITABLE.test(issue.path) || missingContact;
  const openEditor = () => {
    let current: any = content;
    for (const key of path.split('.')) current = current && typeof current === 'object' ? current[key] : undefined;
    setValue(typeof current === 'string' ? current : '');
    setError('');
    setOpen(true);
  };
  const save = async () => {
    if (!window.confirm('Approve your replacement text for this demo? This changes the demo and rechecks it, but does not send anything.')) return;
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/demo-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'qa-correct', jobId, fingerprint, path, value, confirm: true }) });
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Could not save the correction.');
      setOpen(false); await onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save the correction.'); }
    finally { setSaving(false); }
  };
  return <li className="mb-2 break-words">
    <span>{issue.message} ({issue.path})</span>
    <p className="text-[var(--text-secondary)]">Suggested action: review this field and use only information you have confirmed.</p>
    {editable && !open && <button type="button" onClick={openEditor} className="mt-1 text-[var(--accent)] font-bold">Review and enter a correction</button>}
    {open && <div className="mt-2 space-y-2">
      {missingContact && <label className="block text-xs">Contact field <select value={path} onChange={(event) => { setPath(event.target.value); setValue(''); }} className="neo-in rounded-lg px-2 py-1"><option value="contact.email">Email</option><option value="contact.phone">Phone</option></select></label>}
      <textarea value={value} onChange={(event) => setValue(event.target.value)} aria-label={`Replacement for ${path}`} maxLength={4000} rows={4} className="w-full rounded-xl neo-in px-3 py-2 text-sm text-[var(--text-primary)]" />
      <p className="text-[var(--text-secondary)]">Enter the exact approved wording. No new business facts will be filled in for you.</p>
      {error && <p role="alert" className="text-red-500">{error}</p>}
      <div className="flex gap-2"><button type="button" disabled={saving} onClick={() => void save()} className="btn-neumorph px-3 py-2 font-bold disabled:opacity-50">{saving ? 'Saving...' : 'Approve correction'}</button><button type="button" onClick={() => setOpen(false)} className="btn-neumorph px-3 py-2">Cancel</button></div>
    </div>}
  </li>;
}
