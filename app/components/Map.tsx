'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Beer,
  Wine,
  Flame,
  Building2,
  CheckCircle2,
  MapPin,
  Navigation,
  Compass,
  Search,
  SlidersHorizontal,
  ExternalLink,
  X,
  Sparkles,
  Info,
  Plus
} from 'lucide-react';

export interface BarItem {
  osmId: string;
  name: string;
  type: string;
  address: string;
  lat: number;
  lon: number;
  openingHours?: string | null;
  phone?: string | null;
  website?: string | null;
}

interface MapProps {
  bars: BarItem[];
  center: { lat: number; lon: number } | null;
  teamVisits: string[];
  onToggleVisit: (bar: BarItem) => void;
  userLoc: { lat: number; lon: number } | null;
  cityName?: string;
  onReportBar?: (bar: { name: string; type: string; address: string; lat: number; lon: number }) => Promise<void>;
}

// Obliczanie odległości w linii prostej (Haversine)
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // promień Ziemi w metrach
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function InteractiveMap({
  bars,
  center,
  teamVisits,
  onToggleVisit,
  userLoc,
  cityName = 'Miasto',
  onReportBar
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userCircleRef = useRef<L.Circle | null>(null);

  const [selectedBar, setSelectedBar] = useState<BarItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unvisited' | 'visited' | 'pub' | 'bar' | 'club'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Stan zgłaszania barów przez użytkownika
  const [isReportingMode, setIsReportingMode] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportCoords, setReportCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [reportName, setReportName] = useState('');
  const [reportType, setReportType] = useState('Pub');
  const [reportAddress, setReportAddress] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [isMapMoving, setIsMapMoving] = useState(false);

  // Funkcja aktywująca tryb celownika i dodawania lokalu
  const startAddBarMode = () => {
    let baseCoords = { lat: 50.0381, lon: 22.0048 };
    if (mapInstanceRef.current) {
      const c = mapInstanceRef.current.getCenter();
      baseCoords = { lat: c.lat, lon: c.lng };
    } else if (center) {
      baseCoords = center;
    }
    setReportCoords(baseCoords);
    setReportAddress(`${cityName}, Centrum`);
    setIsReportingMode(true);
    setReportModalOpen(false); // Najpierw celujesz mapą, a potem klikasz "Zatwierdź punkt"
  };

  // Inicjalizacja instancji Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = center?.lat || 50.0381;
      const initialLon = center?.lon || 22.0048;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLon],
        zoom: 14,
        zoomControl: false,
        attributionControl: false
      });

      // Czyste, darmowe kafelki OpenStreetMap 100% BEZ KLUCZA API z filtrem dark mode
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
        className: 'dark-map-tiles'
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;
      mapInstanceRef.current = map;

      // Zapobiega szarym kafelkom przy pierwszym załadowaniu
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    }

    return () => {
      // Czyszczenie przy demontażu
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Aktualizacja centrum mapy po zmianie miasta
  useEffect(() => {
    if (mapInstanceRef.current && center) {
      mapInstanceRef.current.flyTo([center.lat, center.lon], 14, {
        duration: 1.2
      });
    }
  }, [center]);

  // Znacznik lokalizacji użytkownika
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (userLoc) {
      const userHtml = `
        <div class="relative flex items-center justify-center">
          <span class="absolute w-8 h-8 rounded-full bg-blue-500/30 animate-ping"></span>
          <span class="relative flex h-5 w-5 rounded-full bg-blue-500 border-2 border-white shadow-[0_0_15px_#3b82f6]"></span>
        </div>
      `;

      const userIcon = L.divIcon({
        className: 'custom-marker-icon',
        html: userHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker([userLoc.lat, userLoc.lon], { icon: userIcon }).addTo(map);
        userCircleRef.current = L.circle([userLoc.lat, userLoc.lon], {
          radius: 120,
          color: '#3b82f6',
          weight: 1,
          fillColor: '#3b82f6',
          fillOpacity: 0.08
        }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng([userLoc.lat, userLoc.lon]);
        userCircleRef.current?.setLatLng([userLoc.lat, userLoc.lon]);
      }
    }
  }, [userLoc]);

  // Śledzenie przesuwania mapy w trybie celownika
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const onMoveStart = () => {
      if (isReportingMode) setIsMapMoving(true);
    };

    const onMove = () => {
      if (isReportingMode) {
        const c = map.getCenter();
        setReportCoords({ lat: c.lat, lon: c.lng });
      }
    };

    const onMoveEnd = () => {
      if (isReportingMode) {
        setIsMapMoving(false);
        const c = map.getCenter();
        setReportCoords({ lat: c.lat, lon: c.lng });
      }
    };

    map.on('movestart', onMoveStart);
    map.on('move', onMove);
    map.on('moveend', onMoveEnd);

    return () => {
      map.off('movestart', onMoveStart);
      map.off('move', onMove);
      map.off('moveend', onMoveEnd);
    };
  }, [isReportingMode]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (isReportingMode) {
      mapContainerRef.current.style.cursor = 'crosshair';
    } else {
      mapContainerRef.current.style.cursor = '';
    }
  }, [isReportingMode]);

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportName.trim() || !reportCoords) return;
    setSubmittingReport(true);
    try {
      if (onReportBar) {
        await onReportBar({
          name: reportName.trim(),
          type: reportType,
          address: reportAddress.trim() || `${cityName}, Centrum`,
          lat: reportCoords.lat,
          lon: reportCoords.lon
        });
      }
      setReportModalOpen(false);
      setIsReportingMode(false);
      setReportName('');
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([reportCoords.lat, reportCoords.lon], 16, { duration: 1 });
      }
    } catch (err: any) {
      alert(err.message || 'Błąd podczas dodawania');
    } finally {
      setSubmittingReport(false);
    }
  };

  // Filtrowanie listy barów
  const filteredBars = useMemo(() => {
    return bars.filter(bar => {
      // Wyszukiwanie tekstowe
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = bar.name.toLowerCase().includes(query);
        const matchAddress = bar.address.toLowerCase().includes(query);
        const matchType = bar.type.toLowerCase().includes(query);
        if (!matchName && !matchAddress && !matchType) return false;
      }

      const isVisited = teamVisits.includes(bar.osmId);

      // Filtr kategorii / statusu
      if (filterType === 'visited') return isVisited;
      if (filterType === 'unvisited') return !isVisited;
      if (filterType === 'pub') return bar.type.toLowerCase().includes('pub') || bar.type.toLowerCase().includes('craft') || bar.type.toLowerCase().includes('browar');
      if (filterType === 'club') return bar.type.toLowerCase().includes('klub');
      if (filterType === 'bar') return !bar.type.toLowerCase().includes('klub') && !bar.type.toLowerCase().includes('pub');

      return true;
    });
  }, [bars, searchQuery, filterType, teamVisits]);

  // Rysowanie markerów na mapie Leaflet
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const layer = markersLayerRef.current;
    layer.clearLayers();

    filteredBars.forEach(bar => {
      const isVisited = teamVisits.includes(bar.osmId);
      const isClub = bar.type.toLowerCase().includes('klub');
      const isShot = bar.type.toLowerCase().includes('shot');

      let iconSvg = '';
      if (isClub) {
        iconSvg = `<svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>`;
      } else if (isShot) {
        iconSvg = `<svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"></path></svg>`;
      } else {
        iconSvg = `<svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z"></path></svg>`;
      }

      const statusClass = isVisited ? 'visited' : 'unvisited';

      const markerHtml = `
        <div class="barpulse-pin-wrapper">
          <div class="barpulse-radar-wave ${statusClass}"></div>
          <div class="barpulse-pin ${statusClass}" title="${bar.name}">
            ${iconSvg}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-marker-icon',
        html: markerHtml,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const barLat = parseFloat(String(bar.lat));
      const barLon = parseFloat(String(bar.lon));
      if (isNaN(barLat) || isNaN(barLon)) return;

      const marker = L.marker([barLat, barLon], { icon: customIcon });

      marker.on('click', () => {
        setSelectedBar(bar);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([barLat, barLon], 16, {
            duration: 0.8
          });
        }
      });

      marker.addTo(layer);
    });
  }, [filteredBars, teamVisits]);

  // Wycentrowanie na lokalizacji użytkownika
  const handleLocateMe = () => {
    if (!userLoc) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            if (mapInstanceRef.current) {
              mapInstanceRef.current.flyTo([loc.lat, loc.lon], 16, { duration: 1 });
            }
          },
          () => alert('Nie udało się pobrać Twojej lokalizacji.')
        );
      }
      return;
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([userLoc.lat, userLoc.lon], 16, { duration: 1 });
    }
  };

  // Statystyki
  const visitedCountInCity = useMemo(() => {
    return bars.filter(b => teamVisits.includes(b.osmId)).length;
  }, [bars, teamVisits]);

  const percentageInCity = bars.length > 0 ? Math.round((visitedCountInCity / bars.length) * 100) : 0;

  // Obliczenie dystansu dla wybranego baru
  const selectedBarDistance = useMemo(() => {
    if (!selectedBar || !userLoc) return null;
    return getDistanceMeters(userLoc.lat, userLoc.lon, selectedBar.lat, selectedBar.lon);
  }, [selectedBar, userLoc]);

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none">
      {/* KONTENER MAPY LEAFLET */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* CENTRALNY CELOWNIK Z RUCHOMĄ PINEZKĄ W TRYBIE DODAWANIA (Działa perfekcyjnie na telefonie i komputerze) */}
      {isReportingMode && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="relative flex flex-col items-center justify-center -translate-y-6">
            {/* Animowany neonowy celownik */}
            <div className={`relative flex items-center justify-center transition-transform duration-200 ${isMapMoving ? 'scale-125 -translate-y-3' : 'scale-100'}`}>
              <span className="absolute -top-1 w-12 h-12 rounded-full bg-amber-500/30 animate-ping"></span>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 font-black text-xl flex items-center justify-center shadow-[0_0_30px_#f59e0b] border-2 border-white">
                📍
              </div>
            </div>
            {/* Ciekawe oznaczenie punktu pod pinezką */}
            <div className="w-3 h-1.5 bg-black/60 rounded-full blur-[1px] mt-1"></div>
            {/* Etykieta celownika */}
            <div className="mt-2 bg-slate-950/95 text-amber-400 text-[11px] font-black px-3 py-1 rounded-full border border-amber-500/50 shadow-2xl flex items-center gap-1.5 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              {isMapMoving ? 'Ustalanie współrzędnych...' : 'Punkt wejścia do lokalu'}
            </div>
          </div>
        </div>
      )}

      {/* PASEK WYSZUKIWANIA, PRZYCISK ZGŁASZANIA I FILTRY (GÓRA) */}
      <div className="absolute top-3 left-3 right-3 sm:left-6 sm:right-6 sm:max-w-xl z-30 space-y-2 pointer-events-auto">
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl">
          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder={`Szukaj lokalu w ${cityName}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-8 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            onClick={startAddBarMode}
            className="px-3.5 py-2.5 rounded-xl border transition flex items-center justify-center gap-1.5 text-xs font-black shadow-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:brightness-110 active:scale-95 cursor-pointer whitespace-nowrap"
            title="Dodaj nowy bar"
          >
            <Plus size={16} className="stroke-[3]" />
            <span>Dodaj bar</span>
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-xl border transition flex items-center justify-center ${
              showFilters || filterType !== 'all'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Filtry"
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {/* PRZEWIJANE CHIPSY FILTRÓW */}
        {showFilters && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar animate-in fade-in slide-in-from-top-2">
            {[
              { id: 'all', label: 'Wszystkie' },
              { id: 'unvisited', label: '⚡ Nieodwiedzone' },
              { id: 'visited', label: '✓ Odwiedzone' },
              { id: 'pub', label: '🍺 Puby i Craft' },
              { id: 'club', label: '🍸 Kluby' },
              { id: 'bar', label: '🥃 Bary' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap border transition ${
                  filterType === f.id
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900/80 backdrop-blur text-slate-400 border-white/5 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* BANER INFORMACYJNY TRYBU CELOWNIKA I PRZYCISK ZATWIERDZENIA PUNKTU */}
        {isReportingMode && (
          <div className="bg-slate-900/95 backdrop-blur-xl text-white p-3 rounded-2xl shadow-2xl border border-amber-500/50 z-30 animate-in fade-in slide-in-from-top-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Sparkles size={16} /> Przesuwaj mapę pod celownikiem!
              </span>
              <button
                onClick={() => setIsReportingMode(false)}
                className="px-2 py-0.5 bg-slate-800 text-slate-400 hover:text-white rounded-lg text-[10px] font-bold"
              >
                Anuluj
              </button>
            </div>
            <div className="text-[11px] text-slate-300">
              Ustaw żółtą pinezkę na wejściu do baru, a następnie kliknij:
            </div>
            <button
              onClick={() => {
                if (mapInstanceRef.current) {
                  const c = mapInstanceRef.current.getCenter();
                  setReportCoords({ lat: c.lat, lon: c.lng });
                  setReportAddress(`${cityName}, Współrzędne: ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`);
                }
                setReportModalOpen(true);
              }}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl text-xs hover:brightness-110 active:scale-95 transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 size={16} /> USTAW TEN PUNKT I WPISZ NAZWĘ
            </button>
          </div>
        )}
      </div>

      {/* STATYSTYKI ZDOBYWANIA MIASTA (PRAWA GÓRA DLA DESKTOPU) */}
      <div className="absolute top-3 right-3 sm:right-6 hidden md:flex items-center gap-3 bg-slate-900/90 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-2xl shadow-xl z-20">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
          <Sparkles size={18} />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Postęp w {cityName}</div>
          <div className="text-sm font-black text-white flex items-center gap-1.5">
            <span className="text-amber-400">{visitedCountInCity}</span> / {bars.length} lokali
            <span className="text-xs text-slate-500 font-medium">({percentageInCity}%)</span>
          </div>
        </div>
      </div>

      {/* PRZYCISKI KONTROLNE (PRAWY BOK) */}
      <div className="absolute right-4 bottom-24 sm:bottom-12 flex flex-col gap-2 z-20">
        <button
          onClick={startAddBarMode}
          className="w-12 h-12 bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 font-black rounded-2xl flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition cursor-pointer"
          title="Dodaj bar w tym mieście"
        >
          <Plus size={24} className="stroke-[3]" />
        </button>

        <button
          onClick={handleLocateMe}
          className="w-12 h-12 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center text-amber-400 shadow-2xl hover:scale-105 active:scale-95 transition"
          title="Centruj na mnie"
        >
          <Compass size={22} className={userLoc ? 'text-blue-400' : 'text-slate-400'} />
        </button>

        <button
          onClick={() => {
            if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
          }}
          className="w-12 h-12 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-2xl hover:scale-105 active:scale-95 transition"
          title="Przybliż"
        >
          +
        </button>

        <button
          onClick={() => {
            if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
          }}
          className="w-12 h-12 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-2xl hover:scale-105 active:scale-95 transition"
          title="Oddal"
        >
          -
        </button>
      </div>

      {/* MINI STATYSTYKA MOBILNA (LEWY DÓŁ) */}
      <div className="absolute left-4 bottom-24 sm:bottom-6 md:hidden z-20 bg-slate-900/90 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl text-[10px] font-bold text-white shadow-lg flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
        {visitedCountInCity}/{bars.length} ({percentageInCity}%)
      </div>

      {/* MODAL / KARTA WYBRANEGO BARU (DOLNA SZUFLADA) */}
      {selectedBar && (
        <div className="absolute bottom-20 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-20 sm:w-96 bg-slate-900/95 backdrop-blur-2xl border border-amber-500/30 p-5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-40 animate-in fade-in slide-in-from-bottom-6">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {selectedBar.type}
                </span>
                {teamVisits.includes(selectedBar.osmId) && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 size={11} /> Odwiedzony
                  </span>
                )}
              </div>
              <h3 className="text-xl font-black text-white leading-tight">{selectedBar.name}</h3>
            </div>
            <button
              onClick={() => setSelectedBar(null)}
              className="text-slate-400 hover:text-white bg-slate-800/80 w-7 h-7 rounded-full flex items-center justify-center transition"
            >
              <X size={15} />
            </button>
          </div>

          <div className="space-y-1.5 text-xs text-slate-300 mb-5">
            <p className="flex items-center gap-2 text-slate-400">
              <MapPin size={14} className="text-amber-400 flex-shrink-0" />
              <span className="truncate">{selectedBar.address}</span>
            </p>

            {selectedBarDistance !== null && (
              <p className="flex items-center gap-2 text-blue-400 font-semibold">
                <Navigation size={14} className="flex-shrink-0" />
                <span>{formatDistance(selectedBarDistance)} od Ciebie</span>
              </p>
            )}

            {selectedBar.openingHours && (
              <p className="flex items-center gap-2 text-slate-400">
                <Info size={14} className="text-slate-500 flex-shrink-0" />
                <span>Godziny: {selectedBar.openingHours}</span>
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onToggleVisit(selectedBar)}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg ${
                teamVisits.includes(selectedBar.osmId)
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:brightness-110 shadow-amber-500/20'
              }`}
            >
              {teamVisits.includes(selectedBar.osmId) ? (
                <>
                  <CheckCircle2 size={16} /> ODWIEDZONO (ODZNACZ)
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> OZNACZ JAKO ODWIEDZONY
                </>
              )}
            </button>

            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${selectedBar.lat},${selectedBar.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl flex items-center justify-center transition border border-white/5"
              title="Wyznacz trasę"
            >
              <ExternalLink size={18} />
            </a>
          </div>
        </div>
      )}

      {/* MODAL ZGŁASZANIA NOWEGO BARU */}
      {reportModalOpen && reportCoords && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 z-[3000] animate-in fade-in">
          <form
            onSubmit={handleSubmitReport}
            className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-1 border-b border-white/5">
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Plus className="text-amber-500 stroke-[3]" size={20} /> Zgłoś lokal do bazy
              </h3>
              <button
                type="button"
                onClick={() => {
                  setReportModalOpen(false);
                  setIsReportingMode(false);
                }}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Wskazówka o wybranym punkcie */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-start gap-2.5">
              <span className="text-xl">📍</span>
              <div className="text-xs text-amber-200/90 leading-relaxed">
                Punkt lokalu został wybrany celownikiem na mapie. Wpisz nazwę i kliknij <span className="font-bold text-amber-400">„Zapisz bar”</span>.
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-bold block mb-1">Nazwa lokalu *</label>
              <input
                type="text"
                required
                value={reportName}
                onChange={e => setReportName(e.target.value)}
                placeholder="np. K20 Pub, Cybermachina..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-white outline-none focus:border-amber-500"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 font-bold block mb-1">Typ lokalu</label>
              <select
                value={reportType}
                onChange={e => setReportType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-white outline-none focus:border-amber-500"
              >
                <option value="Pub">Pub</option>
                <option value="Craft Beer">Craft Beer / Piwo Rzemieślnicze</option>
                <option value="Bar">Bar</option>
                <option value="Klub Muzyczny">Klub Muzyczny</option>
                <option value="Shot Bar">Shot Bar</option>
                <option value="Browar">Browar</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-bold block mb-1">Adres / ulica</label>
              <input
                type="text"
                value={reportAddress}
                onChange={e => setReportAddress(e.target.value)}
                placeholder="np. ul. Kopernika 4, Rynek..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-white outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-white/5 font-mono">
              <span>Współrzędne GPS:</span>
              <span className="text-amber-400 font-bold">{reportCoords.lat.toFixed(5)}, {reportCoords.lon.toFixed(5)}</span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setReportModalOpen(false);
                  setIsReportingMode(false);
                }}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={submittingReport || !reportName.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl text-xs hover:brightness-110 active:scale-95 transition shadow-lg shadow-amber-500/20"
              >
                {submittingReport ? 'Zapisywanie w bazie...' : 'Zapisz bar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
