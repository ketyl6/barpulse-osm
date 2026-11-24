import { NextRequest, NextResponse } from 'next/server';

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

// Lokalny cache w pamięci procesu dla szybkości
const cache = new Map<string, { timestamp: number; data: { center: { lat: number; lon: number }; bars: BarItem[] } }>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minut

// Znane współrzędne głównych miast do natychmiastowego startu bez opóźnienia geokodera
const KNOWN_COORDS: Record<string, { lat: number; lon: number }> = {
  "rzeszów": { lat: 50.0412, lon: 21.9991 },
  "rzeszow": { lat: 50.0412, lon: 21.9991 },
  "kraków": { lat: 50.0647, lon: 19.9450 },
  "krakow": { lat: 50.0647, lon: 19.9450 },
  "warszawa": { lat: 52.2297, lon: 21.0122 },
  "wrocław": { lat: 51.1079, lon: 17.0385 },
  "wroclaw": { lat: 51.1079, lon: 17.0385 },
  "gdańsk": { lat: 54.3520, lon: 18.6466 },
  "gdansk": { lat: 54.3520, lon: 18.6466 },
  "poznań": { lat: 52.4064, lon: 16.9252 },
  "poznan": { lat: 52.4064, lon: 16.9252 },
  "katowice": { lat: 50.2649, lon: 19.0238 },
  "lublin": { lat: 51.2465, lon: 22.5684 },
  "łódź": { lat: 51.7592, lon: 19.4560 },
  "lodz": { lat: 51.7592, lon: 19.4560 },
  "szczecin": { lat: 53.4285, lon: 14.5528 }
};

// Lista publicznych serwerów Overpass API do odpytywania
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
];

export async function fetchBarsFromOSM(cityName: string, coordsOverride?: { lat: number; lon: number }) {
  const normalizedCity = cityName.trim();
  const cacheKey = normalizedCity.toLowerCase();

  // Sprawdź cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS && cached.data.bars.length > 0) {
    return cached.data;
  }

  let lat = coordsOverride?.lat;
  let lon = coordsOverride?.lon;

  // 1. Sprawdź znane koordynaty lub odpytaj Nominatim
  if (!lat || !lon) {
    const known = KNOWN_COORDS[cacheKey];
    if (known) {
      lat = known.lat;
      lon = known.lon;
    } else {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalizedCity)}&countrycodes=pl&limit=1`,
          {
            headers: {
              'User-Agent': 'BarPulse-OSM-Radar/2.0 (web-app: contact@barpulse.pl)',
              'Accept-Language': 'pl,en'
            },
            signal: AbortSignal.timeout(6000)
          }
        );

        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData && geoData.length > 0) {
            lat = parseFloat(geoData[0].lat);
            lon = parseFloat(geoData[0].lon);
          }
        }
      } catch {
        // Fallback do Rzeszowa jeśli geokodowanie zawiodło
      }
    }
  }

  if (!lat || !lon) {
    lat = 50.0412;
    lon = 21.9991;
  }

  // 2. Zapytanie do Overpass API po WSZYSTKIE lokale w promieniu 12 km
  const overpassQuery = `
    [out:json][timeout:25];
    (
      node["amenity"~"^(bar|pub|nightclub|biergarten)$"](around:12000,${lat},${lon});
      node["brewery"](around:12000,${lat},${lon});
      node["craft"="brewery"](around:12000,${lat},${lon});
      way["amenity"~"^(bar|pub|nightclub|biergarten)$"](around:12000,${lat},${lon});
      way["brewery"](around:12000,${lat},${lon});
    );
    out center;
  `;

  let overpassData: any = null;

  // Odpytuj dostępne serwery Overpass po kolei aż któryś odpowie
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: overpassQuery,
        headers: {
          'Content-Type': 'text/plain',
          'User-Agent': 'BarPulse-OSM-Radar/2.0'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (res.ok) {
        const json = await res.json();
        if (json && json.elements && json.elements.length > 0) {
          overpassData = json;
          break;
        }
      }
    } catch {
      // Przejdź do kolejnego serwera w pętli
    }
  }

  if (overpassData && overpassData.elements && overpassData.elements.length > 0) {
    const bars: BarItem[] = overpassData.elements
      .map((el: any) => {
        const barLat = el.lat || el.center?.lat;
        const barLon = el.lon || el.center?.lon;
        if (!barLat || !barLon) return null;

        const amenity = el.tags?.amenity;
        const name =
          el.tags?.name ||
          el.tags?.operator ||
          el.tags?.brand ||
          (amenity === 'pub'
            ? 'Pub'
            : amenity === 'nightclub'
            ? 'Klub Muzyczny'
            : amenity === 'biergarten'
            ? 'Ogródek Piwny'
            : 'Bar');

        let type = 'Bar';
        if (amenity === 'pub') type = 'Pub';
        else if (amenity === 'nightclub') type = 'Klub Muzyczny';
        else if (amenity === 'biergarten') type = 'Ogródek Piwny';
        else if (el.tags?.brewery || el.tags?.craft === 'brewery') type = 'Browar';
        else if (name.toLowerCase().includes('shot') || name.toLowerCase().includes('pijalnia') || name.toLowerCase().includes('wódk')) type = 'Shot Bar';
        else if (name.toLowerCase().includes('craft') || name.toLowerCase().includes('kraft')) type = 'Craft Beer';

        const street = el.tags?.['addr:street'];
        const house = el.tags?.['addr:housenumber'] || '';
        const address = street ? `${street} ${house}`.trim() : (el.tags?.['addr:place'] || el.tags?.['addr:suburb'] || `${cityName}, Centrum`);

        return {
          osmId: `${el.type}/${el.id}`,
          name,
          type,
          address,
          lat: barLat,
          lon: barLon,
          openingHours: el.tags?.opening_hours || null,
          phone: el.tags?.phone || null,
          website: el.tags?.website || null
        };
      })
      .filter(Boolean) as BarItem[];

    // Usuwanie duplikatów
    const uniqueBars: BarItem[] = [];
    const seen = new Set<string>();
    for (const b of bars) {
      const key = `${b.name.toLowerCase()}_${b.lat.toFixed(4)}_${b.lon.toFixed(4)}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueBars.push(b);
      }
    }

    if (uniqueBars.length > 0) {
      const result = {
        center: { lat, lon },
        bars: uniqueBars
      };
      cache.set(cacheKey, { timestamp: Date.now(), data: result });
      return result;
    }
  }

  // Jeśli serwery Overpass nie zwróciły wyników, zwróć pustą listę z prawidłowym centrum,
  // a klient przeglądarki podejmie próbę bezpośrednią
  return {
    center: { lat, lon },
    bars: []
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city') || 'Rzeszów';
  const latParam = searchParams.get('lat');
  const lonParam = searchParams.get('lon');

  const coordsOverride = latParam && lonParam ? {
    lat: parseFloat(latParam),
    lon: parseFloat(lonParam)
  } : undefined;

  try {
    const data = await fetchBarsFromOSM(city, coordsOverride);
    return NextResponse.json({
      city,
      center: data.center,
      totalCount: data.bars.length,
      bars: data.bars
    });
  } catch {
    return NextResponse.json({ error: 'Błąd podczas pobierania danych z OpenStreetMap' }, { status: 500 });
  }
}
