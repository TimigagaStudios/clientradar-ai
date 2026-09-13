import { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { ArrowLeft, Globe2, MapPin, RotateCcw, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLeads } from '../context/LeadContext';

type LeadPoint = { id: string; businessName: string; city: string; category: string; latitude: number; longitude: number; leadScore: number; status: string };
type GlobeRef = { pointOfView: (view: { lat: number; lng: number; altitude: number }, duration?: number) => void; controls: () => { autoRotate: boolean; autoRotateSpeed: number; enableZoom: boolean } };

const GEO_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

export default function LeadGlobe() {
  const { leads } = useLeads();
  const globeRef = useRef<GlobeRef | undefined>();
  const [countries, setCountries] = useState<unknown[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [globeReady, setGlobeReady] = useState(false);
  const [isSmallScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  const locatedLeads = useMemo<LeadPoint[]>(() => leads.filter((lead: any) => Number.isFinite(lead.latitude) && Number.isFinite(lead.longitude)).map((lead: any) => ({ id: lead.id, businessName: lead.businessName, city: lead.city, category: lead.category, latitude: lead.latitude, longitude: lead.longitude, leadScore: lead.leadScore || 0, status: lead.status })), [leads]);
  const filteredLeads = useMemo(() => locatedLeads.filter((lead) => `${lead.businessName} ${lead.city} ${lead.category}`.toLowerCase().includes(search.toLowerCase())), [locatedLeads, search]);
  const selected = locatedLeads.find((lead) => lead.id === selectedId);

  useEffect(() => {
    fetch(GEO_URL).then((response) => response.json()).then((data) => setCountries(data.features || [])).catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    try {
      const controls = globeRef.current?.controls();
      if (!controls) return;
      controls.autoRotate = !selected;
      controls.autoRotateSpeed = 0.32;
      controls.enableZoom = true;
    } catch {
      // Keep the page controls usable if WebGL is unavailable on a device.
    }
  }, [selected]);

  const focusLead = (lead: LeadPoint) => {
    setSelectedId(lead.id);
    try { globeRef.current?.pointOfView({ lat: lead.latitude, lng: lead.longitude, altitude: 0.62 }, 1100); } catch { /* WebGL fallback */ }
  };

  const resetView = () => {
    setSelectedId(null);
    try { globeRef.current?.pointOfView({ lat: 20, lng: 10, altitude: 2.35 }, 1100); } catch { /* WebGL fallback */ }
  };

  return <main className="relative -mx-4 -mt-8 min-h-[calc(100vh-8rem)] overflow-hidden bg-[#02040b] text-white sm:-mx-6 lg:-mx-8 xl:-mx-10">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(52,91,170,.2),transparent_34%),radial-gradient(circle_at_50%_78%,rgba(255,122,0,.11),transparent_34%)]" />
    <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: 'radial-gradient(circle at 12% 16%, #fff 0 1px, transparent 1.5px), radial-gradient(circle at 72% 11%, #8fb7ff 0 1px, transparent 1.5px), radial-gradient(circle at 88% 34%, #fff 0 1px, transparent 1.5px), radial-gradient(circle at 30% 42%, #739fff 0 1px, transparent 1.5px), radial-gradient(circle at 62% 56%, #fff 0 1px, transparent 1.5px), radial-gradient(circle at 18% 76%, #fff 0 1px, transparent 1.5px)', backgroundSize: '240px 190px, 310px 250px, 390px 300px, 280px 230px, 340px 270px, 420px 330px' }} />
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-black via-black/80 to-transparent" />

    <header className="pointer-events-auto absolute inset-x-0 top-5 z-30 flex items-center justify-center px-5 sm:top-7"><Link to="/dashboard" className="absolute left-5 flex items-center gap-2 text-sm font-semibold text-white/70 transition hover:text-white sm:left-10"><span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/10"><ArrowLeft size={16} /></span><span className="hidden sm:inline">Back to ClientRadar</span></Link><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-white/75"><Globe2 size={15} className="text-[var(--accent)]" /> Lead Globe</div><button type="button" onClick={resetView} className="absolute right-5 rounded-full border border-white/15 bg-black/20 p-3 text-white/70 backdrop-blur-md transition hover:border-white/35 hover:text-white sm:right-10" aria-label="Reset globe"><RotateCcw size={16} /></button></header>

    <div className="absolute inset-0 z-10 flex items-center justify-center pt-20 sm:pt-28">
      {isSmallScreen ? <div className="relative h-[min(76vw,470px)] w-[min(76vw,470px)] rounded-full bg-cover shadow-[0_0_80px_rgba(35,105,220,.35)]" style={{ backgroundImage: 'url(https://unpkg.com/three-globe/example/img/earth-night.jpg)', animation: 'clipiq-earth-spin 36s linear infinite' }} aria-label="Animated Earth preview"><div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,transparent_0_35%,rgba(0,0,0,.5)_72%,rgba(0,0,0,.9)_100%)]" />{filteredLeads.map((lead) => <button key={lead.id} type="button" onClick={() => focusLead(lead)} aria-label={`Focus ${lead.businessName}`} className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full p-1.5 ${selectedId === lead.id ? 'bg-[var(--accent)] text-white' : 'bg-white text-[var(--accent)]'}`} style={{ left: `${((lead.longitude + 180) / 360) * 100}%`, top: `${((90 - lead.latitude) / 180) * 100}%` }}><MapPin size={12} fill="currentColor" /></button>)}</div> : <Globe ref={globeRef as any} width={typeof window !== 'undefined' ? Math.min(window.innerWidth - (window.innerWidth >= 1024 ? 320 : 32), 920) : 900} height={typeof window !== 'undefined' ? Math.min(window.innerHeight, 820) : 700} backgroundColor="rgba(0,0,0,0)" rendererConfig={{ antialias: false, alpha: true, powerPreference: 'low-power' }} globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg" polygonsData={countries} polygonCapColor={() => 'rgba(74, 92, 153, 0.16)'} polygonSideColor={() => 'rgba(255, 122, 0, 0.14)'} polygonStrokeColor={() => 'rgba(255,255,255,0.12)'} polygonsTransitionDuration={500} pointsData={filteredLeads} pointLat="latitude" pointLng="longitude" pointColor={(point: any) => point.id === selectedId ? '#ff7a00' : '#a99bff'} pointRadius={(point: any) => point.id === selectedId ? 0.65 : 0.42} pointAltitude={0.025} pointsMerge={false} onGlobeReady={() => setGlobeReady(true)} onPointClick={(point: any) => focusLead(point)} />}
    </div>
    <style>{`@keyframes clipiq-earth-spin { from { background-position: 0% 50%; } to { background-position: 200% 50%; } }`}</style>

    <section className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-6 pb-8 sm:px-12 sm:pb-12"><div className="mx-auto max-w-6xl"><p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--accent)]">Live prospect map</p><h1 className="mt-3 max-w-2xl text-4xl font-black tracking-tight text-white sm:text-6xl">Every opportunity,<br /><span className="text-white/65">one world view.</span></h1><p className="mt-4 max-w-md text-sm leading-6 text-white/60">Drag to rotate. Scroll or pinch to zoom. Select a glowing lead marker to focus its region.</p><div className="pointer-events-auto mt-5 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center"><div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/45" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search a saved business..." className="w-full rounded-full border border-white/15 bg-black/35 px-11 py-3 text-sm text-white outline-none backdrop-blur-md placeholder:text-white/40 focus:border-[var(--accent)]" /></div><span className="text-xs text-white/50">{filteredLeads.length} mapped leads</span></div>{selected && <div className="pointer-events-auto mt-5 max-w-sm border-l-2 border-[var(--accent)] pl-4"><p className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">Focused region</p><p className="mt-1 text-lg font-bold">{selected.businessName}</p><p className="text-sm text-white/60">{selected.city} - {selected.category} - Score {selected.leadScore}</p><Link to={`/leads/${selected.id}`} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-white underline decoration-[var(--accent)] underline-offset-4">Open lead <MapPin size={13} /></Link></div>}</div></section>

    {locatedLeads.length === 0 && <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 px-6 text-center"><p className="text-sm text-white/55">No mapped leads yet</p><p className="mt-2 text-xs text-white/35">Save a Lead Finder result to place the first marker.</p></div>}
  </main>;
}
