import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { renderPreviewPage, sitePages } from '../lib/demoSite';
import { makeZip } from '../lib/zip';

// The public preview is visible to anyone with the link. The ZIP action is
// offered only after server-side owner verification, and is checked again on export.
export default function DemoSiteView({ content, jobId }: { content: any; jobId: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [page, setPage] = useState('home');
  const [owner, setOwner] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const pages = useMemo(() => sitePages(content), [content]);
  const html = useMemo(() => renderPreviewPage(content, page), [content, page]);

  useEffect(() => {
    let active = true; let revision = 0;
    const check = async (signedIn: boolean) => {
      const current = ++revision;
      if (active) setOwner(false);
      if (!signedIn) return;
      try {
        const response = await fetch('/api/demo-jobs?action=export-access', { cache: 'no-store' });
        if (active && current === revision) setOwner(response.ok);
      } catch { /* Hide the export action if verification fails. */ }
    };
    supabase.auth.getSession().then(({ data }) => void check(Boolean(data.session))).catch(() => undefined);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { void check(Boolean(session)); });
    return () => { active = false; revision += 1; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      const next = event.data && typeof event.data.crDemoPage === 'string' ? event.data.crDemoPage : '';
      if (next && pages.some((item) => item.key === next)) setPage(next);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [pages]);

  const download = async () => {
    if (exporting) return;
    setExporting(true); setExportError('');
    try {
      const response = await fetch(`/api/demo-jobs?action=export&jobId=${encodeURIComponent(jobId)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result?.success || !result.data?.files || typeof result.data.files !== 'object') throw new Error(result?.error || 'Could not export this website.');
      const name = String(content.businessName || 'demo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'demo';
      const url = URL.createObjectURL(makeZip(result.data.files, `${name}-website`));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `${name}-website.zip`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (reason) { setExportError(reason instanceof Error ? reason.message : 'Could not export this website.'); }
    finally { setExporting(false); }
  };

  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100dvh', backgroundColor: '#0b1026' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 14px', backgroundColor: '#0b1026', color: '#b6c0d9', borderBottom: '1px solid rgba(182,192,217,0.2)', fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
        <Link to="/demos" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#b6c0d9' }}><ArrowLeft size={12} /> Demo Factory</Link>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#ff7a00' }}><Sparkles size={12} /> Demo concept</span>
        {owner ? (
          <button type="button" disabled={exporting} onClick={() => void download()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, backgroundColor: '#ff7a00', color: '#111111', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}><Download size={12} /> {exporting ? 'Preparing...' : 'Owner ZIP'}</button>
        ) : <span style={{ width: 12 }} />}
      </div>
      {exportError && <p role="alert" style={{ margin: 0, padding: '8px 14px', color: '#fff', backgroundColor: '#7f1d1d', fontSize: 13 }}>{exportError}</p>}
      <iframe
        ref={frameRef}
        key={page}
        title={`${content.businessName || 'Business'} website demo`}
        srcDoc={html}
        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        style={{ flex: 1, width: '100%', border: 0, backgroundColor: '#ffffff' }}
      />
    </main>
  );
}
