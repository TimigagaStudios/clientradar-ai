import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Loader2, ScanSearch } from 'lucide-react';
import type { SearchResult } from '../types';
import type { CandidateQualification } from '../lib/saveFound';

export type MapArea = { west: number; south: number; east: number; north: number };

type Props = {
  results: SearchResult[];
  area: MapArea | null;
  searching: boolean;
  stateOf: (result: SearchResult) => { saved: boolean; leadId?: string };
  qualifyOf: (result: SearchResult) => CandidateQualification;
  onSearchArea: (area: MapArea) => void;
  onSave: (result: SearchResult) => void;
  onCheckSite: (result: SearchResult) => void;
  onOpenLead: (leadId: string) => void;
};

const MAX_SPAN = 6; // degrees; the server refuses anything wider (a whole country at once)
const pinColor = (qual: CandidateQualification, saved: boolean) => {
  if (saved) return '#39d98a';
  if (qual.status === 'qualified') return '#ff7a00';
  if (qual.status === 'needs_website_check' || qual.status === 'checking') return '#6ea8ff';
  return '#64748b';
};

// World map for Lead Finder: move to any country or city, then search inside what is on screen.
export default function FinderMap({ results, area, searching, stateOf, qualifyOf, onSearchArea, onSave, onCheckSite, onOpenLead }: Props) {
  const node = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const live = useRef({ stateOf, qualifyOf, onSave, onCheckSite, onOpenLead });
  live.current = { stateOf, qualifyOf, onSave, onCheckSite, onOpenLead };
  const [tooWide, setTooWide] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!node.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: node.current,
        center: [10, 25],
        zoom: 1.1,
        attributionControl: { compact: true },
        style: {
          version: 8,
          sources: {
            satellite: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, attribution: 'Esri, Maxar, Earthstar Geographics' },
            labels: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19 },
          },
          layers: [
            { id: 'satellite', type: 'raster', source: 'satellite' },
            { id: 'labels', type: 'raster', source: 'labels' },
          ],
        },
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    const measure = () => {
      const b = map.getBounds();
      setTooWide(b.getEast() - b.getWest() > MAX_SPAN || b.getNorth() - b.getSouth() > MAX_SPAN);
    };
    map.on('moveend', measure);
    map.on('load', measure);
    return () => { markers.current.forEach((marker) => marker.remove()); markers.current = []; map.remove(); mapRef.current = null; };
  }, []);

  // Move to the searched place.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !area) return;
    try { map.fitBounds([[area.west, area.south], [area.east, area.north]], { padding: 24, duration: 900, maxZoom: 15 }); } catch { /* ignore */ }
  }, [area]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];
    results.forEach((result) => {
      if (!Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) return;
      const state = live.current.stateOf(result);
      const qual = live.current.qualifyOf(result);
      const popup = new maplibregl.Popup({ offset: 26, maxWidth: '270px' });
      popup.on('open', () => {
        const now = live.current.stateOf(result);
        const latestQual = live.current.qualifyOf(result);
        const card = document.createElement('div');
        card.style.cssText = 'font:13px/1.45 system-ui,sans-serif;color:#0b1220;min-width:185px';
        const name = document.createElement('strong');
        name.textContent = result.businessName;
        name.style.cssText = 'display:block;font-size:14px;margin-bottom:2px';
        const where = document.createElement('div');
        where.textContent = result.address || '';
        where.style.cssText = 'color:#475569;font-size:12px';
        const statusLine = document.createElement('div');
        statusLine.textContent = latestQual.badge;
        statusLine.style.cssText = `margin:6px 0 4px;font-size:11px;font-weight:700;color:${latestQual.canSave ? '#0f766e' : latestQual.canCheckSite ? '#1d4ed8' : '#64748b'}`;
        const facts = document.createElement('div');
        facts.textContent = [
          latestQual.email ? `Email: ${latestQual.email}` : 'Email missing',
          latestQual.phone ? `Phone: ${latestQual.phone}` : 'Phone missing',
        ].join(' | ');
        facts.style.cssText = 'margin:2px 0 8px;font-size:11px;color:#334155;word-break:break-word';
        const action = document.createElement('button');
        action.type = 'button';
        if (now.leadId) {
          action.textContent = 'Open lead profile';
          action.style.cssText = 'border:0;border-radius:999px;padding:7px 14px;font-weight:700;font-size:12px;color:#fff;background:#16794a;cursor:pointer';
        } else if (now.saved) {
          action.textContent = 'Saved';
          action.disabled = true;
          action.style.cssText = 'border:0;border-radius:999px;padding:7px 14px;font-weight:700;font-size:12px;color:#fff;background:#16794a;opacity:0.75';
        } else if (latestQual.canSave) {
          action.textContent = 'Save qualified lead';
          action.style.cssText = 'border:0;border-radius:999px;padding:7px 14px;font-weight:700;font-size:12px;color:#fff;background:#ff7a00;cursor:pointer';
        } else if (latestQual.canCheckSite) {
          action.textContent = latestQual.status === 'incomplete' ? 'Retry website check' : 'Check official site';
          action.style.cssText = 'border:0;border-radius:999px;padding:7px 14px;font-weight:700;font-size:12px;color:#fff;background:#2563eb;cursor:pointer';
        } else {
          action.textContent = 'Incomplete - cannot save';
          action.disabled = true;
          action.style.cssText = 'border:0;border-radius:999px;padding:7px 14px;font-weight:700;font-size:12px;color:#cbd5e1;background:#475569;cursor:not-allowed';
        }
        action.addEventListener('click', () => {
          const latest = live.current.stateOf(result);
          const currentQual = live.current.qualifyOf(result);
          if (latest.leadId) live.current.onOpenLead(latest.leadId);
          else if (!latest.saved && currentQual.canSave) { live.current.onSave(result); popup.remove(); }
          else if (!latest.saved && currentQual.canCheckSite) { live.current.onCheckSite(result); popup.remove(); }
        });
        card.append(name, where, statusLine, facts, action);
        popup.setDOMContent(card);
      });
      const marker = new maplibregl.Marker({ color: pinColor(qual, state.saved), scale: 0.8 }).setLngLat([result.longitude as number, result.latitude as number]).setPopup(popup).addTo(map);
      marker.getElement().setAttribute('aria-label', result.businessName);
      marker.getElement().style.cursor = 'pointer';
      markers.current.push(marker);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, stateOf, qualifyOf]);

  const searchHere = () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    onSearchArea({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
  };

  if (failed) return <p className="p-6 text-sm text-[var(--text-secondary)]">The map could not start on this device. Searching by city still works.</p>;

  return (
    <div className="relative">
      <div ref={node} data-finder-map className="h-[340px] w-full overflow-hidden rounded-2xl sm:h-[440px]" style={{ background: '#050b18' }} />
      <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-14">
        <button
          type="button"
          onClick={searchHere}
          disabled={tooWide || searching}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-lg disabled:cursor-not-allowed"
          style={{ background: tooWide ? 'rgba(8,16,34,0.82)' : 'var(--accent, #ff7a00)', border: '1px solid rgba(255,255,255,0.18)' }}
        >
          {searching ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} />}
          {tooWide ? 'Zoom in to a city or region' : searching ? 'Searching...' : 'Search this area'}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-secondary)]">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#ff7a00' }} />Qualified (email + phone)</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#6ea8ff' }} />Official website to check</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#39d98a' }} />Saved</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#64748b' }} />Incomplete</span>
      </div>
    </div>
  );
}
