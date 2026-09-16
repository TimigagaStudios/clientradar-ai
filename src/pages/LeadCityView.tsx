import { useEffect, useRef } from 'react';
import { ArrowLeft, ExternalLink, MapPin, Phone, Star, Globe2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useLeads } from '../context/LeadContext';

export default function LeadCityView() {
  const { id } = useParams();
  const { leads } = useLeads();
  const lead = leads.find((item: any) => item.id === id) as any;
  const mapNode = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!lead || !Number.isFinite(lead.latitude) || !Number.isFinite(lead.longitude) || !mapNode.current) return;
    const map = new maplibregl.Map({
      container: mapNode.current,
      center: [lead.longitude, lead.latitude],
      zoom: 15,
      pitch: 35,
      bearing: -12,
      style: {
        version: 8,
        sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' } },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    const marker = new maplibregl.Marker({ color: '#ff7a00' }).setLngLat([lead.longitude, lead.latitude]).setPopup(new maplibregl.Popup({ offset: 28 }).setHTML(`<strong>${lead.businessName}</strong><br/><span>${lead.city || ''}</span>`)).addTo(map);
    marker.togglePopup();
    return () => { marker.remove(); map.remove(); };
  }, [lead]);

  if (!lead) return <div className="p-8 text-[var(--text-primary)]">Lead not found.</div>;
  return <div className="space-y-6 animate-in fade-in duration-500"><div className="flex flex-wrap items-center justify-between gap-4"><Link to="/globe" className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ArrowLeft size={16} /> Back to Lead Globe</Link><span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]"><Globe2 size={15} /> City detail</span></div><section className="neo-card overflow-hidden p-0"><div ref={mapNode} className="h-[55vh] min-h-[420px] w-full" /></section><section className="neo-card p-6"><div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Selected business</p><h1 className="mt-2 text-3xl font-black text-[var(--text-primary)]">{lead.businessName}</h1><p className="mt-1 text-[var(--text-secondary)]">{lead.category} - {lead.city}</p></div><Link to={`/leads/${lead.id}`} className="btn-neumorph-primary inline-flex items-center justify-center gap-2 px-4 py-2">View full lead</Link></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="neo-in rounded-2xl p-4"><MapPin className="mb-3 text-[var(--accent)]" size={18} /><p className="text-xs text-[var(--text-secondary)]">Coordinates</p><p className="mt-1 text-sm font-bold">{lead.latitude.toFixed(5)}, {lead.longitude.toFixed(5)}</p></div><div className="neo-in rounded-2xl p-4"><Star className="mb-3 text-[var(--accent)]" size={18} /><p className="text-xs text-[var(--text-secondary)]">Lead score</p><p className="mt-1 text-sm font-bold">{lead.leadScore || 0}</p></div><div className="neo-in rounded-2xl p-4"><Phone className="mb-3 text-[var(--accent)]" size={18} /><p className="text-xs text-[var(--text-secondary)]">Phone</p><p className="mt-1 text-sm font-bold">{lead.phone || 'Not provided'}</p></div></div><div className="mt-5 flex flex-wrap gap-4">{lead.website && <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]"><ExternalLink size={15} /> Open website</a>}<a href={`https://www.google.com/maps/search/?api=1&query=${lead.latitude},${lead.longitude}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Open Google Maps</a><a href={`https://maps.apple.com/?ll=${lead.latitude},${lead.longitude}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Open Apple Maps</a></div></section></div>;
}
