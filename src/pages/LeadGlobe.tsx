import { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { ArrowLeft, Globe2, MapPin, RotateCcw, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLeads } from '../context/LeadContext';

type LeadPoint = {
  id: string; businessName: string; city: string; category: string;
  latitude: number; longitude: number; leadScore: number; status: string;
  phone?: string; email?: string; website?: string; rating?: number;
  reviewCount?: number; priority?: string; demoStatus?: string;
  demoLink?: string; dealValue?: number;
};
// One thing drawn on the globe: a single lead, or several nearby leads grouped into one dot with a count.
type GlobeSpot = { key: string; latitude: number; longitude: number; leads: LeadPoint[] };
// How wide a group is (in degrees) for each zoom level; 0 = every lead on its own.
// About 30 pixels on screen at that zoom, so dots never pile on top of each other.
const groupSize = (altitude: number) => (altitude > 1.9 ? 5 : altitude > 1.3 ? 3.2 : altitude > 0.85 ? 2 : altitude > 0.55 ? 1.3 : altitude > 0.35 ? 0.8 : altitude > 0.22 ? 0.5 : altitude > 0.14 ? 0.3 : 0.07);
const CLOSEST = 0.14; // below this the globe cannot zoom further
type GlobeRef = { pointOfView: (view: { lat: number; lng: number; altitude: number }, duration?: number) => void; controls: () => { autoRotate: boolean; autoRotateSpeed: number; enableZoom: boolean } };

export default function LeadGlobe() {
  const { leads } = useLeads();
  const globeRef = useRef<GlobeRef | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cell, setCell] = useState(groupSize(2.35));
  const altitudeRef = useRef(2.35);
  const [areaList, setAreaList] = useState<LeadPoint[] | null>(null); // the leads under the group dot that was tapped

  const locatedLeads = useMemo<LeadPoint[]>(() => leads
    .filter((lead: any) => Number.isFinite(lead.latitude) && Number.isFinite(lead.longitude))
    .map((lead: any) => ({
      id: lead.id, businessName: lead.businessName, city: lead.city, category: lead.category,
      latitude: lead.latitude, longitude: lead.longitude, leadScore: lead.leadScore || 0,
      status: lead.status, phone: lead.phone, email: lead.email, website: lead.website,
      rating: lead.rating, reviewCount: lead.reviewCount, priority: lead.priority,
      demoStatus: lead.demoStatus, demoLink: lead.demoLink, dealValue: lead.dealValue,
    })), [leads]);
  const filteredLeads = useMemo(() => locatedLeads.filter((lead) => `${lead.businessName} ${lead.city} ${lead.category}`.toLowerCase().includes(search.toLowerCase())), [locatedLeads, search]);
  const suggestions = useMemo(() => search.trim() ? filteredLeads.slice(0, 6) : [], [filteredLeads, search]);
  const selected = locatedLeads.find((lead) => lead.id === selectedId);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const previous = meta?.content || '';
    if (meta) meta.content = '#02040b';
    else { const created = document.createElement('meta'); created.name = 'theme-color'; created.content = '#02040b'; document.head.appendChild(created); }
    return () => { if (meta) meta.content = previous; };
  }, []);

  useEffect(() => {
    try {
      const controls = globeRef.current?.controls();
      if (!controls) return;
      controls.autoRotate = !selected;
      controls.autoRotateSpeed = 0.32;
      controls.enableZoom = true;
    } catch { /* WebGL controls are optional on unsupported devices. */ }
  }, [selected]);

  const focusLead = (lead: LeadPoint) => {
    setSelectedId(lead.id);
    try { globeRef.current?.pointOfView({ lat: lead.latitude, lng: lead.longitude, altitude: 0.62 }, 1100); } catch { /* WebGL fallback. */ }
  };

  const resetView = () => {
    setSelectedId(null);
    setAreaList(null);
    try { globeRef.current?.pointOfView({ lat: 20, lng: 10, altitude: 2.35 }, 1100); } catch { /* WebGL fallback. */ }
  };

  const markerColor = (point: LeadPoint) => {
    if (point.id === selectedId) return '#ff7a00';
    if (point.demoStatus === 'Ready') return '#39d98a';
    if (point.priority === 'High' || (point.dealValue || 0) >= 6000) return '#ff4d5f';
    if (point.priority === 'Medium' || (point.dealValue || 0) >= 3000) return '#f2c94c';
    return '#ffd08a';
  };

  // Zoomed out, nearby leads share one dot with a count; zooming in splits them. The selected lead always stands alone.
  const spots = useMemo<GlobeSpot[]>(() => {
    // Each lead joins the first group whose centre is within one group-width; otherwise it starts a new group.
    const groups: { lat: number; lng: number; leads: LeadPoint[] }[] = [];
    const out: GlobeSpot[] = [];
    for (const lead of filteredLeads) {
      if (lead.id === selectedId || cell === 0) { out.push({ key: `lead-${lead.id}-${lead.id === selectedId ? 'on' : 'off'}`, latitude: lead.latitude, longitude: lead.longitude, leads: [lead] }); continue; }
      const stretch = Math.max(0.2, Math.cos((lead.latitude * Math.PI) / 180));
      const home = groups.find((group) => Math.abs(group.lat - lead.latitude) <= cell && Math.abs(group.lng - lead.longitude) * stretch <= cell);
      if (home) home.leads.push(lead); else groups.push({ lat: lead.latitude, lng: lead.longitude, leads: [lead] });
    }
    for (const group of groups) {
      out.push({
        key: `group-${group.leads[0].id}-${group.leads.length}-${cell}`,
        latitude: group.leads.reduce((sum, lead) => sum + lead.latitude, 0) / group.leads.length,
        longitude: group.leads.reduce((sum, lead) => sum + lead.longitude, 0) / group.leads.length,
        leads: group.leads,
      });
    }
    return out;
  }, [filteredLeads, cell, selectedId]);

  const markerElement = (spot: GlobeSpot) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.style.pointerEvents = 'auto';
    element.style.cursor = 'pointer';
    element.style.border = '0';
    element.style.padding = '0';
    element.style.background = 'transparent';
    if (spot.leads.length > 1) {
      // A group: one soft dot with the number of leads; tapping it zooms in.
      const order = ['#ff4d5f', '#39d98a', '#f2c94c', '#ffd08a'];
      const color = order.find((tone) => spot.leads.some((lead) => markerColor(lead) === tone)) || '#ffd08a';
      const size = Math.min(38, 20 + Math.round(Math.log2(spot.leads.length) * 3.2));
      const cities = Array.from(new Set(spot.leads.map((lead) => lead.city).filter(Boolean)));
      element.title = `${spot.leads.length} leads${cities.length === 1 ? ` in ${cities[0]}` : ''}`;
      element.setAttribute('aria-label', `${element.title}. Zoom in`);
      element.setAttribute('data-globe-group', String(spot.leads.length));
      element.style.transform = 'translate(-50%, -50%)';
      const dot = document.createElement('span');
      dot.textContent = spot.leads.length > 999 ? '999+' : String(spot.leads.length);
      dot.style.cssText = `display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:999px;background:rgba(6,12,26,0.82);border:1.5px solid ${color};box-shadow:0 0 12px ${color}88;color:#fff;font:700 ${spot.leads.length > 99 ? 10 : 11}px/1 system-ui,sans-serif`;
      element.appendChild(dot);
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        // Tapping a numbered dot lists every business under it (strongest first) and moves closer.
        setAreaList(spot.leads.slice().sort((a, b) => b.leadScore - a.leadScore));
        setSelectedId(null);
        if (altitudeRef.current <= CLOSEST) return;
        try { globeRef.current?.pointOfView({ lat: spot.latitude, lng: spot.longitude, altitude: Math.max(0.1, altitudeRef.current * 0.42) }, 900); } catch { /* WebGL fallback. */ }
      });
      return element;
    }
    const point = spot.leads[0];
    const color = markerColor(point);
    element.title = point.businessName;
    element.setAttribute('aria-label', `Focus ${point.businessName}`);
    if (point.id === selectedId) {
      // The selected lead keeps the full pin.
      element.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 27 41" aria-hidden="true"><path fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1" d="M27,13.5 C27,19.074644 20.250001,27.000002 14.75,34.500002 C14.016665,35.500004 12.983335,35.500004 12.25,34.500002 C6.7499993,27.000002 0,19.222562 0,13.5 C0,6.0441559 6.0441559,0 13.5,0 C20.955844,0 27,6.0441559 27,13.5 Z"/><circle fill="#fff" cx="13.5" cy="13.5" r="5.5"/></svg>`;
      element.style.transform = 'translate(-50%, -85%)';
    } else {
      element.setAttribute('data-globe-dot', '1');
      element.style.transform = 'translate(-50%, -50%)';
      element.style.padding = '8px'; // keeps a comfortable tap area around the small dot
      const dot = document.createElement('span');
      dot.style.cssText = `display:block;width:11px;height:11px;border-radius:999px;background:${color};border:1.5px solid rgba(255,255,255,0.9);box-shadow:0 0 8px ${color}`;
      element.appendChild(dot);
    }
    element.addEventListener('click', (event) => { event.stopPropagation(); focusLead(point); });
    return element;
  };

  const onZoom = (view: { altitude: number }) => {
    altitudeRef.current = view.altitude;
    const next = groupSize(view.altitude);
    setCell((current) => (current === next ? current : next));
  };

  return <><div className="pointer-events-none fixed inset-0 z-[35] bg-black" style={{ backgroundImage: 'radial-gradient(circle at 12% 16%, #fff 0 1px, transparent 1.5px), radial-gradient(circle at 72% 11%, #8fb7ff 0 1px, transparent 1.5px), radial-gradient(circle at 88% 34%, #fff 0 1px, transparent 1.5px), radial-gradient(circle at 30% 42%, #739fff 0 1px, transparent 1.5px), radial-gradient(circle at 62% 56%, #fff 0 1px, transparent 1.5px)', backgroundSize: '240px 190px, 310px 250px, 390px 300px, 280px 230px, 340px 270px' }} />
    <main className="fixed inset-0 z-[36] h-[100dvh] min-h-0 w-screen overflow-hidden bg-black text-white">
      <header className="pointer-events-auto absolute inset-x-0 top-24 z-30 flex items-center justify-center px-5 sm:top-7"><Link to="/dashboard" className="absolute left-5 flex items-center gap-2 text-sm font-semibold text-white/70 sm:left-10"><span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/10"><ArrowLeft size={16} /></span><span className="hidden sm:inline">Back to ClientRadar</span></Link><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-white/75"><Globe2 size={15} className="text-[var(--accent)]" /> Lead Globe</div><button type="button" onClick={resetView} className="absolute right-5 rounded-full border border-white/15 bg-black/20 p-3 text-white/70 sm:right-10" aria-label="Reset globe"><RotateCcw size={16} /></button></header>
      <div className="absolute inset-0 z-10 flex items-center justify-center pt-32 sm:pt-36"><Globe ref={globeRef as any} width={typeof window !== 'undefined' ? Math.min(window.innerWidth >= 1024 ? window.innerWidth - 320 : window.innerWidth, 1100) : 900} height={typeof window !== 'undefined' ? Math.min(window.innerHeight, 820) : 700} backgroundColor="rgba(0,0,0,0)" rendererConfig={{ antialias: false, alpha: true, powerPreference: 'low-power' }} globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg" backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png" htmlElementsData={spots} htmlLat={(point: any) => point.latitude} htmlLng={(point: any) => point.longitude} htmlElement={markerElement as any} onZoom={onZoom as any} onGlobeReady={() => undefined} /></div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] h-[58%] bg-gradient-to-t from-black via-black/85 to-transparent" />
      <section className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-6 pb-8 sm:px-12 sm:pb-10"><div className="mx-auto max-w-6xl">{selected ? <div className="pointer-events-auto animate-in slide-in-from-bottom-8 fade-in duration-500"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--accent)]">Focused business</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">{selected.businessName}</h1><p className="mt-2 text-sm text-white/60">{selected.category} - {selected.city}</p></div><button type="button" onClick={() => setSelectedId(null)} className="rounded-full border border-white/20 bg-black/30 px-4 py-2 text-xs font-bold text-white/75">Back to globe</button></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Score', selected.leadScore], ['Status', selected.status], ['Priority', selected.priority || 'Unrated'], ['Demo', selected.demoStatus || 'Not Started']].map(([label, value]) => <div key={String(label)} className="border-l-2 border-[var(--accent)] pl-3"><span className="block text-[10px] uppercase tracking-wider text-white/45">{label}</span><strong className="text-sm">{value}</strong></div>)}</div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/60">{selected.phone && <span>{selected.phone}</span>}{selected.email && <span>{selected.email}</span>}{selected.website && <span>{selected.website}</span>}{selected.rating ? <span>{selected.rating.toFixed(1)} rating ({selected.reviewCount || 0} reviews)</span> : null}</div><div className="mt-4 flex flex-wrap items-center gap-4"><Link to={`/leads/${selected.id}`} className="text-sm font-bold underline decoration-[var(--accent)] underline-offset-4">Open full lead</Link>{selected.demoLink && <a href={selected.demoLink} target="_blank" rel="noreferrer" className="text-sm font-bold text-[var(--accent)]">Open demo</a>}<Link to={`/globe/city/${selected.id}`} className="text-sm font-bold text-[var(--accent)]">City view</Link></div></div> : areaList ? <div className="pointer-events-auto animate-in slide-in-from-bottom-8 fade-in duration-500" data-area-list><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--accent)]">Leads in this area</p><h1 className="mt-2 text-2xl font-black sm:text-4xl">{areaList.length} {areaList.length === 1 ? 'business' : 'businesses'}{new Set(areaList.map((lead) => lead.city)).size === 1 && areaList[0].city ? ` in ${areaList[0].city}` : ''}</h1></div><button type="button" onClick={() => setAreaList(null)} className="rounded-full border border-white/20 bg-black/30 px-4 py-2 text-xs font-bold text-white/75">Close list</button></div><div className="mt-4 max-h-[34vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#050812]/90">{areaList.map((lead) => <div key={lead.id} className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 last:border-b-0"><button type="button" onClick={() => focusLead(lead)} className="min-w-0 flex-1 text-left"><strong className="block truncate text-sm text-white">{lead.businessName}</strong><small className="block truncate text-white/45">{lead.city} - {lead.category} - score {lead.leadScore}</small></button><Link to={`/globe/city/${lead.id}`} className="shrink-0 text-xs font-bold text-[var(--accent)]">City view</Link><Link to={`/leads/${lead.id}`} className="shrink-0 text-xs font-bold text-white/70 underline">Open</Link></div>)}</div></div> : <div className="pointer-events-auto"><p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--accent)]">Live prospect map</p><h1 className="mt-3 max-w-2xl text-4xl font-black sm:text-6xl">Every opportunity,<br /><span className="text-white/65">one world view.</span></h1><p className="mt-4 max-w-md text-sm leading-6 text-white/60">Drag to rotate. Scroll or pinch to zoom. Select a lead marker to focus its region.</p><div className="relative mt-5 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center"><div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/45" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search a saved business..." className="w-full rounded-full border border-white/15 bg-black/35 px-11 py-3 text-sm text-white outline-none placeholder:text-white/40" />{suggestions.length > 0 && <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-2xl border border-white/15 bg-[#050812]/95 shadow-2xl">{suggestions.map((lead) => <button key={lead.id} type="button" onClick={() => { setSearch(lead.businessName); focusLead(lead); }} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-white/80 hover:bg-white/10"><span><strong className="block text-white">{lead.businessName}</strong><small className="text-white/45">{lead.city} - {lead.category}</small></span><span className="ml-3 text-xs font-bold text-[var(--accent)]">{lead.leadScore}</span></button>)}</div>}</div><span className="text-xs text-white/50">{filteredLeads.length} mapped leads</span></div></div>}</div></section>
      {locatedLeads.length === 0 && <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 -translate-y-1/2 px-6 text-center"><p className="text-sm text-white/55">No mapped leads yet</p><p className="mt-2 text-xs text-white/35">Save a Lead Finder result to place the first marker.</p></div>}
    </main></>;
}
