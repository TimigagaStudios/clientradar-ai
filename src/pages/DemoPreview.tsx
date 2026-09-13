import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mail, MapPin, Phone, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DemoPreview() {
  const { id } = useParams();
  const [job, setJob] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/demo-jobs?jobId=${encodeURIComponent(id)}`).then(async (response) => {
      const text = await response.text();
      let result: any;
      try { result = JSON.parse(text); } catch { throw new Error(`Demo API ${response.status}: ${text.slice(0, 160)}`); }
      if (!response.ok || !result.success) throw new Error(result.error || 'Demo not found');
      setJob(result.data);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Demo not found'));
  }, [id]);

  if (error) return <div className="min-h-screen grid place-items-center bg-[var(--bg)] p-6 text-[var(--text-primary)]"><div className="neo-card p-8 text-center"><p className="text-red-500">{error}</p><Link to="/demos" className="btn-neumorph mt-5 inline-flex">Back to demos</Link></div></div>;
  if (!job) return <div className="min-h-screen grid place-items-center bg-[var(--bg)] text-[var(--text-secondary)]">Loading demo...</div>;

  const content = job.content || {};
  const theme = content.theme || {};
  const pageStyle = { backgroundColor: theme.background || 'var(--bg)', color: theme.text || 'var(--text-primary)' };
  const surfaceStyle = { backgroundColor: theme.surface || 'rgba(255,255,255,0.05)' };
  const accentStyle = { color: theme.accent || 'var(--accent)' };
  return <main className="min-h-screen" style={pageStyle}>
    <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6"><Link to="/demos" className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ArrowLeft size={16} /> Back to Demo Factory</Link><span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em]" style={accentStyle}><Sparkles size={14} /> Demo concept</span></nav>
    <section className="mx-auto max-w-6xl px-6 pb-16 pt-12"><p className="text-sm font-bold uppercase tracking-[0.2em]" style={accentStyle}>{content.hero?.eyebrow || content.category}</p><h1 className="mt-4 max-w-4xl text-5xl font-black leading-tight md:text-7xl">{content.hero?.title || content.businessName}</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-secondary)]">{content.hero?.description}</p><button className="mt-8 rounded-2xl px-6 py-3 font-bold text-white shadow-lg" style={{ backgroundColor: theme.accent || 'var(--accent)' }}>{content.hero?.cta || 'Get in touch'}</button></section>
    <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-16 md:grid-cols-3">{(content.sections || []).map((section: any) => <article key={section.title} className="neo-card p-6" style={surfaceStyle}><CheckCircle2 className="mb-5" style={accentStyle} size={24} /><h2 className="text-xl font-bold">{section.title}</h2><p className="mt-3 leading-7 text-[var(--text-secondary)]">{section.body}</p></article>)}</section>
    <section className="mx-auto max-w-6xl px-6 pb-20"><div className="neo-card grid gap-5 p-6 md:grid-cols-3" style={surfaceStyle}><div className="flex items-center gap-3"><MapPin className="text-[var(--accent)]" size={18} />{content.city || 'Local business'}</div>{content.contact?.phone && <div className="flex items-center gap-3"><Phone className="text-[var(--accent)]" size={18} />{content.contact.phone}</div>}{content.contact?.email && <div className="flex items-center gap-3"><Mail className="text-[var(--accent)]" size={18} />{content.contact.email}</div>}</div><p className="mt-4 text-center text-xs text-[var(--text-secondary)]">{content.disclaimer}</p></section>
  </main>;
}
