import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { buildDemoSite, renderPreviewPage, sitePages } from '../lib/demoSite';
import { makeZip } from '../lib/zip';

// Shows a demo that has its own design recipe: the real website files run inside an isolated frame.
// The ZIP button is only shown to the signed-in owner, never to a client opening the shared link.
export default function DemoSiteView({ content }: { content: any }) {
  const [page, setPage] = useState('home');
  const [owner, setOwner] = useState(false);
  const pages = useMemo(() => sitePages(content), [content]);
  const html = useMemo(() => renderPreviewPage(content, page), [content, page]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setOwner(Boolean(data.session))).catch(() => undefined);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const next = event.data && typeof event.data.crDemoPage === 'string' ? event.data.crDemoPage : '';
      if (next && pages.some((item) => item.key === next)) setPage(next);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [pages]);

  const download = () => {
    const name = String(content.businessName || 'demo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'demo';
    const url = URL.createObjectURL(makeZip(buildDemoSite(content), `${name}-website`));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${name}-website.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100dvh', backgroundColor: '#0b1026' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 14px', backgroundColor: '#0b1026', color: '#b6c0d9', borderBottom: '1px solid rgba(182,192,217,0.2)', fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
        <Link to="/demos" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#b6c0d9' }}><ArrowLeft size={12} /> Demo Factory</Link>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#ff7a00' }}><Sparkles size={12} /> Demo concept</span>
        {owner ? (
          <button type="button" onClick={download} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, backgroundColor: '#ff7a00', color: '#111111', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}><Download size={12} /> Website ZIP</button>
        ) : <span style={{ width: 12 }} />}
      </div>
      <iframe
        key={page}
        title={`${content.businessName || 'Business'} website demo`}
        srcDoc={html}
        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        style={{ flex: 1, width: '100%', border: 0, backgroundColor: '#ffffff' }}
      />
    </main>
  );
}
