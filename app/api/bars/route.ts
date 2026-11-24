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

// Znane współrzędne głównych miast do natychmiastowego centrowania mapy
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

// Pamięć podręczna na 30 minut
const cache = new Map<string, { timestamp: number; data: { center: { lat: number; lon: number }; bars: BarItem[] } }>();
const CACHE_TTL_MS = 1000 * 60 * 30;

export async function fetchBarsFromOSM(cityName: string, coordsOverride?: { lat: number; lon: number }) {
  const normalizedCity = cityName.trim();
  const cacheKey = normalizedCity.toLowerCase();

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS && cached.data.bars.length > 0) {
    return cached.data;
  }

  let lat = coordsOverride?.lat;
  let lon = coordsOverride?.lon;

  const known = KNOWN_COORDS[cacheKey];
  if (!lat || !lon) {
    if (known) {
      lat = known.lat;
      lon = known.lon;
    }
  }

  const userAgent = 'BarPulse-Radar-App/2.5 (OpenStreetMap student project; contact: info@barpulse.pl)';

  // Zapytania do oficjalnego API OpenStreetMap Nominatim w celu pobrania realnych lokali
  const queries = [
    `https://nominatim.openstreetmap.org/search?amenity=pub&city=${encodeURIComponent(normalizedCity)}&format=json&limit=50`,
    `https://nominatim.openstreetmap.org/search?amenity=bar&city=${encodeURIComponent(normalizedCity)}&format=json&limit=50`,
    `https://nominatim.openstreetmap.org/search?amenity=nightclub&city=${encodeURIComponent(normalizedCity)}&format=json&limit=40`,
    `https://nominatim.openstreetmap.org/search?q=pub+${encodeURIComponent(normalizedCity)}&format=json&limit=40`,
    `https://nominatim.openstreetmap.org/search?q=bar+${encodeURIComponent(normalizedCity)}&format=json&limit=40`,
    `https://nominatim.openstreetmap.org/search?q=klub+${encodeURIComponent(normalizedCity)}&format=json&limit=30`
  ];

  const results = await Promise.allSettled(
    queries.map(url =>
      fetch(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept-Language': 'pl,en'
        },
        signal: AbortSignal.timeout(6000)
      }).then(r => (r.ok ? r.json() : []))
    )
  );

  const rawElements: any[] = [];
  results.forEach(res => {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      rawElements.push(...res.value);
    }
  });

  const uniqueBars: BarItem[] = [];
  const seenNames = new Set<string>();

  for (const item of rawElements) {
    const bLat = parseFloat(item.lat);
    const bLon = parseFloat(item.lon);
    if (isNaN(bLat) || isNaN(bLon)) continue;

    // Pobierz i sformatuj nazwę
    let name = item.name;
    if (!name && item.display_name) {
      name = item.display_name.split(',')[0].trim();
    }
    if (!name || name.length < 2) continue;

    // Filtrujemy niepożądane obiekty jeśli nazwa to tylko np. "Polska" czy nazwa miasta
    if (name.toLowerCase() === normalizedCity.toLowerCase() || name.toLowerCase() === 'polska') {
      continue;
    }

    const key = name.toLowerCase().trim();
    if (seenNames.has(key)) continue;
    seenNames.add(key);

    // Kategoryzacja
    let type = 'Bar';
    const textToCheck = `${name} ${item.type || ''} ${item.class || ''} ${item.display_name || ''}`.toLowerCase();
    if (textToCheck.includes('pub') || textToCheck.includes('piw') || textToCheck.includes('beer')) {
      type = textToCheck.includes('craft') || textToCheck.includes('kraft') ? 'Craft Beer' : 'Pub';
    } else if (textToCheck.includes('nightclub') || textToCheck.includes('klub') || textToCheck.includes('club')) {
      type = 'Klub Muzyczny';
    } else if (textToCheck.includes('shot') || textToCheck.includes('pijalnia') || textToCheck.includes('wódk')) {
      type = 'Shot Bar';
    } else if (textToCheck.includes('browar') || textToCheck.includes('brewery')) {
      type = 'Browar';
    }

    // Adres
    let address = `${cityName}, Centrum`;
    if (item.display_name) {
      const parts = item.display_name.split(',');
      if (parts.length > 2) {
        address = `${parts[1]?.trim() || ''} ${parts[2]?.trim() || ''}`.trim();
      }
    }

    uniqueBars.push({
      osmId: `osm/${item.osm_type || 'node'}/${item.osm_id || Math.random().toString(36).substring(2, 9)}`,
      name,
      type,
      address,
      lat: bLat,
      lon: bLon
    });
  }

  // Ustal centrum
  if (!lat || !lon) {
    if (uniqueBars.length > 0) {
      lat = uniqueBars[0].lat;
      lon = uniqueBars[0].lon;
    } else {
      lat = 50.0412;
      lon = 21.9991;
    }
  }

  const result = {
    center: { lat, lon },
    bars: uniqueBars
  };

  if (uniqueBars.length > 0) {
    cache.set(cacheKey, { timestamp: Date.now(), data: result });
  }

  return result;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city') || 'Rzeszów';
  const latParam = searchParams.get('lat');
  const lonParam = searchParams.get('lon');

  const coordsOverride =
    latParam && lonParam
      ? {
          lat: parseFloat(latParam),
          lon: parseFloat(lonParam)
        }
      : undefined;

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
