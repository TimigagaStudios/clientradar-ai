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

  const locatedLeads = useMemo<LeadPoint[]>(() => leads.filter((lead: any) => Number.isFinite(lead.latitude) && Number.isFinite(lead.longitude)).map((lead: any) => ({ id: lead.id, businessName: lead.businessName, city: lead.city, category: lead.category, latitude: lead.latitude, longitude: lead.longitude, leadScore: lead.leadScore || 0, status: lead.status })), [leads]);
  const filteredLeads = useMemo(() => locatedLeads.filter((lead) => `${lead.businessName} ${lead.city} ${lead.category}`.toLowerCase().includes(search.toLowerCase())), [locatedLeads, search]);
  const selected = locatedLeads.find((lead) => lead.id === selectedId);

  useEffect(() => {
    fetch(GEO_URL).then((response) => response.json()).then((data) => setCountries(data.features || [])).catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    const controls = globeRef.current?.controls();
    if (!controls) return;
    controls.autoRotate = !selected;
    controls.autoRotateSpeed = 0.35;
    controls.enableZoom = true;
  }, [selected]);

  const focusLead = (lead: LeadPoint) => {
    setSelectedId(lead.id);
    globeRef.current?.pointOfView({ lat: lead.latitude, lng: lead.longitude, altitude: 0.65 }, 900);
  };

  const resetView = () => {
    setSelectedId(null);
    globeRef.current?.pointOfView({ lat: 20, lng: 10, altitude: 2.35 }, 900);
  };

  return <div className="space-y-8 animate-in fade-in duration-700">
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">Scout map</p><h1 className="mt-2 text-3xl font-black text-[var(--text-primary)]">Lead Globe</h1><p className="mt-2 max-w-2xl text-[var(--text-secondary)]">Spin the globe, zoom into a region, and inspect every saved business location.</p></div><div className="neo-card flex items-center gap-3 px-4 py-3 text-sm text-[var(--text-secondary)]"><Globe2 size={18} className="text-[var(--accent)]" />{locatedLeads.length} mapped leads</div></header>
    <section className="neo-card overflow-hidden p-3 sm:p-6"><div className="relative mx-auto flex min-h-[420px] items-center justify-center overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_50%_40%,rgba(255,122,0,.16),transparent_40%),var(--bg)]"><Globe ref={globeRef as any} width={760} height={Math.min(680, typeof window !== 'undefined' ? Math.max(420, window.innerWidth - 48) : 620)} backgroundColor="rgba(0,0,0,0)" globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg" bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png" backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png" polygonsData={countries} polygonCapColor={() => 'rgba(83, 96, 160, 0.28)'} polygonSideColor={() => 'rgba(255, 122, 0, 0.18)'} polygonStrokeColor={() => 'rgba(255,255,255,0.18)'} polygonsTransitionDuration={500} pointsData={filteredLeads} pointLat="latitude" pointLng="longitude" pointColor={(point: any) => point.id === selectedId ? '#ff7a00' : '#9b8cff'} pointRadius={(point: any) => point.id === selectedId ? 0.65 : 0.42} pointAltitude={0.025} pointsMerge={false} onPointClick={(point: any) => focusLead(point)} /></div><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a business on the globe..." className="neo-in w-full rounded-xl py-3 pl-10 pr-3 text-sm text-[var(--text-primary)] outline-none" /></div><button type="button" onClick={resetView} className="btn-neumorph inline-flex items-center justify-center gap-2 px-4 py-3 text-sm"><RotateCcw size={14} /> Reset globe</button></div></section>
    <section className="grid gap-6 lg:grid-cols-[1fr_1.5fr]"> <div className="neo-card p-6"><div className="flex items-center gap-2"><MapPin className="text-[var(--accent)]" size={18} /><h2 className="font-bold text-[var(--text-primary)]">Mapped businesses</h2></div><div className="mt-4 max-h-80 space-y-2 overflow-y-auto">{filteredLeads.length ? filteredLeads.map((lead) => <button type="button" key={lead.id} onClick={() => focusLead(lead)} className={`flex w-full items-center justify-between rounded-xl p-3 text-left transition-colors ${lead.id === selectedId ? 'bg-[var(--accent)]/15' : 'neo-in'}`}><span className="min-w-0"><span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{lead.businessName}</span><span className="block truncate text-xs text-[var(--text-secondary)]">{lead.city} - {lead.category}</span></span><span className="ml-3 text-xs font-bold text-[var(--accent)]">{lead.leadScore}</span></button>) : <p className="text-sm text-[var(--text-secondary)]">No saved leads have coordinates yet. Save new Lead Finder results to place pins.</p>}</div></div>{selected ? <div className="neo-card p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Selected region</p><h2 className="mt-2 text-2xl font-black text-[var(--text-primary)]">{selected.businessName}</h2><p className="mt-2 text-[var(--text-secondary)]">{selected.city} - {selected.category}</p><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="neo-in rounded-xl p-3"><span className="block text-xs text-[var(--text-secondary)]">Lead score</span><strong>{selected.leadScore}</strong></div><div className="neo-in rounded-xl p-3"><span className="block text-xs text-[var(--text-secondary)]">Status</span><strong>{selected.status}</strong></div></div><Link to={`/leads/${selected.id}`} className="btn-neumorph-primary mt-5 inline-flex items-center gap-2 px-4 py-2"><ArrowLeft size={14} /> View full lead</Link></div> : <div className="neo-card flex items-center justify-center p-6 text-center text-sm text-[var(--text-secondary)]">Tap a glowing pin or choose a business to zoom into its region.</div>}</section>
  </div>;
}
