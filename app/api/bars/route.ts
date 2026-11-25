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

// Znane współrzędne głównych miast do natychmiastowego centrowania mapy
export const KNOWN_COORDS: Record<string, { lat: number; lon: number }> = {
  "rzeszów": { lat: 50.0381, lon: 22.0048 },
  "rzeszow": { lat: 50.0381, lon: 22.0048 },
  "kraków": { lat: 50.0614, lon: 19.9366 },
  "krakow": { lat: 50.0614, lon: 19.9366 },
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

// Słowa kluczowe wykluczające bary mleczne, rybne, bistro jedzeniowe, jadłodajnie
const EXCLUDED_BAR_KEYWORDS = [
  'mleczn', 'krówka', 'krowka', 'rybn', 'rybka', 'krokiecik', 'obiad',
  'pierog', 'bistro', 'domow', 'szalotka', 'stołówka', 'stolowka',
  'jadłodajnia', 'jadlodajnia', 'frykas', 'kebab', 'wietnam', 'chinczyk',
  'chińczyk', 'smoothie', 'sushi', 'lunch', 'pizzeria', 'cukiernia',
  'kawiarnia', 'cafe', 'garmaż', 'garmaz'
];

// Prawdziwe, najpopularniejsze bary i puby imprezowe/kraftowe dla kluczowych miast,
// gwarantujące, że miejsca takie jak Cybermachina, K20, Galway czy Lord Jack są ZAWSZE na mapie
export const VERIFIED_CITY_BARS: Record<string, BarItem[]> = {
  "rzeszów": [
    { osmId: "rz_k20", name: "K20 Pub (Multitap & Boardgames)", type: "Craft Beer", address: "Mikołaja Kopernika 4", lat: 50.0382, lon: 22.0031 },
    { osmId: "rz_cyber", name: "Cybermachina Game Pub", type: "Pub", address: "Jana Matejki 4", lat: 50.0381, lon: 22.0038 },
    { osmId: "rz_lordjack", name: "Lord Jack", type: "Pub & Restauracja", address: "Rynek 3-4", lat: 50.0381, lon: 22.0048 },
    { osmId: "rz_nora", name: "Pub Nora Aktora", type: "Pub", address: "Rynek 8", lat: 50.0378, lon: 22.0042 },
    { osmId: "rz_rdza", name: "RDZA Gastro & Cocktail Bar", type: "Bar", address: "Rynek 16", lat: 50.0375, lon: 22.0046 },
    { osmId: "rz_galway", name: "Irish Pub Galway", type: "Pub", address: "3 Maja 8", lat: 50.0370, lon: 22.0028 },
    { osmId: "rz_jameson", name: "The Jameson Pub", type: "Pub", address: "Stanisława Moniuszki 4", lat: 50.0388, lon: 22.0035 },
    { osmId: "rz_kraftownia", name: "Kraftownia", type: "Craft Beer", address: "Rynek 12", lat: 50.0375, lon: 22.0039 },
    { osmId: "rz_kuznia", name: "Kuźnia Pub", type: "Pub", address: "Mikołaja Kopernika 18", lat: 50.0390, lon: 22.0045 },
    { osmId: "rz_corner", name: "Corner Pub", type: "Pub", address: "Przesmyk 2", lat: 50.0380, lon: 22.0040 },
    { osmId: "rz_starybrowar", name: "Stary Browar Rzeszowski", type: "Browar", address: "Rynek 23", lat: 50.0372, lon: 22.0049 },
    { osmId: "rz_pijalnia", name: "Pijalnia Rzeszowska / Pijalnia Wódki i Piwa", type: "Shot Bar", address: "Grunwaldzka 1", lat: 50.0379, lon: 22.0032 },
    { osmId: "rz_palma", name: "Klub Pod Palmą", type: "Klub Muzyczny", address: "Cicha 4a", lat: 50.0270, lon: 21.9868 },
    { osmId: "rz_grand", name: "Grand Club", type: "Klub Muzyczny", address: "Tadeusza Kościuszki 9", lat: 50.0385, lon: 22.0035 },
    { osmId: "rz_soda", name: "Soda Club & Bar", type: "Klub Muzyczny", address: "Rynek 15", lat: 50.0376, lon: 22.0047 },
    { osmId: "rz_carpe", name: "Carpe Diem", type: "Klub Muzyczny", address: "Jagiellońska 6", lat: 50.0360, lon: 22.0020 },
    { osmId: "rz_speedway", name: "Speedway Pub", type: "Pub", address: "Hetmańska 69", lat: 50.0225, lon: 21.9920 },
    { osmId: "rz_morgan", name: "Morgan Pub", type: "Pub", address: "Ks. Józefa Jałowego 23a", lat: 50.0385, lon: 21.9960 }
  ],
  "kraków": [
    { osmId: "kr_cyber", name: "Cybermachina Game Pub", type: "Pub", address: "Stolarska 11", lat: 50.0601, lon: 19.9395 },
    { osmId: "kr_alchemia", name: "Alchemia", type: "Pub & Bar", address: "Estery 5", lat: 50.0515, lon: 19.9455 },
    { osmId: "kr_multiqlti", name: "Multi Qlti Tap Bar", type: "Craft Beer", address: "Szewska 21", lat: 50.0628, lon: 19.9338 },
    { osmId: "kr_houseofbeer", name: "House of Beer", type: "Craft Beer", address: "Św. Tomasza 35", lat: 50.0622, lon: 19.9412 },
    { osmId: "kr_wezzekrafta", name: "Weźże Krafta", type: "Craft Beer", address: "Dajwór 16", lat: 50.0528, lon: 19.9482 },
    { osmId: "kr_singer", name: "Singer Pub", type: "Pub", address: "Estery 22", lat: 50.0520, lon: 19.9460 },
    { osmId: "kr_wodka", name: "Wódka Cafe Bar", type: "Shot Bar", address: "Mikołajska 5", lat: 50.0618, lon: 19.9405 },
    { osmId: "kr_pijalnia", name: "Pijalnia Wódki i Piwa", type: "Shot Bar", address: "Floriańska 34", lat: 50.0635, lon: 19.9398 },
    { osmId: "kr_banialuka", name: "Banialuka", type: "Shot Bar", address: "Sławkowska 12", lat: 50.0635, lon: 19.9370 },
    { osmId: "kr_prozak", name: "Prozak 2.0", type: "Klub Muzyczny", address: "Plac Dominikański 6", lat: 50.0588, lon: 19.9388 },
    { osmId: "kr_teatro", name: "Teatro Cubano", type: "Klub Muzyczny", address: "Jagiellońska 10", lat: 50.0630, lon: 19.9340 }
  ],
  "warszawa": [
    { osmId: "waw_kufle", name: "Kufle i Kapsle", type: "Craft Beer", address: "Nowogrodzka 25", lat: 52.2285, lon: 21.0145 },
    { osmId: "waw_pawilony", name: "Pawilony Nowy Świat (Zagłębie Pubów)", type: "Pub", address: "Nowy Świat 22/28", lat: 52.2332, lon: 21.0205 },
    { osmId: "waw_klaps", name: "Pub Klaps (Pawilony)", type: "Shot Bar", address: "Nowy Świat 22/28 paw. 12", lat: 52.2331, lon: 21.0206 },
    { osmId: "waw_lenistwo", name: "Pub Lenistwo (Pawilony)", type: "Pub", address: "Nowy Świat 22/28 paw. 5", lat: 52.2333, lon: 21.0204 },
    { osmId: "waw_piwpaw", name: "PiwPaw Beer Heaven", type: "Craft Beer", address: "Foksal 16", lat: 52.2325, lon: 21.0215 },
    { osmId: "waw_planb", name: "Plan B", type: "Bar", address: "Aleja Wyzwolenia 18", lat: 52.2195, lon: 21.0185 },
    { osmId: "waw_pijalnia", name: "Pijalnia Wódki i Piwa", type: "Shot Bar", address: "Nowy Świat 19", lat: 52.2320, lon: 21.0195 }
  ],
  "wrocław": [
    { osmId: "wro_kontynuacja", name: "Kontynuacja (Legendarny Multitap)", type: "Craft Beer", address: "Ofiar Oświęcimskich 17", lat: 51.1072, lon: 17.0315 },
    { osmId: "wro_swjan", name: "Św. Jan – Pub Regionalny", type: "Craft Beer", address: "Rynek 19", lat: 51.1098, lon: 17.0312 },
    { osmId: "wro_pinta", name: "PINTA Wrocław", type: "Craft Beer", address: "Podwale 83 (OVO)", lat: 51.1075, lon: 17.0425 },
    { osmId: "wro_4hops", name: "4Hops Multitap", type: "Craft Beer", address: "Ofiar Oświęcimskich 46", lat: 51.1068, lon: 17.0345 },
    { osmId: "wro_szynkarnia", name: "Szynkarnia – Kraft i Kuchnia", type: "Craft Beer", address: "Św. Antoniego 15", lat: 51.1095, lon: 17.0268 }
  ]
};

export function isRealDrinkBar(name: string, type: string = '', displayName: string = ''): boolean {
  const text = `${name} ${type} ${displayName}`.toLowerCase();
  for (const kw of EXCLUDED_BAR_KEYWORDS) {
    if (text.includes(kw)) return false;
  }
  return true;
}

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

  const userAgent = 'BarPulse-Radar-App/3.0 (OpenStreetMap bar hunter; contact: info@barpulse.pl)';

  // Zapytania do oficjalnego API OpenStreetMap Nominatim
  const queries = [
    `https://nominatim.openstreetmap.org/search?amenity=pub&city=${encodeURIComponent(normalizedCity)}&format=json&limit=50`,
    `https://nominatim.openstreetmap.org/search?amenity=nightclub&city=${encodeURIComponent(normalizedCity)}&format=json&limit=50`,
    `https://nominatim.openstreetmap.org/search?amenity=bar&city=${encodeURIComponent(normalizedCity)}&format=json&limit=50`,
    `https://nominatim.openstreetmap.org/search?q=pub+${encodeURIComponent(normalizedCity)}&format=json&limit=40`,
    `https://nominatim.openstreetmap.org/search?q=craft+beer+${encodeURIComponent(normalizedCity)}&format=json&limit=40`,
    `https://nominatim.openstreetmap.org/search?q=cocktail+bar+${encodeURIComponent(normalizedCity)}&format=json&limit=40`
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

  // 1. Najpierw dodajemy zweryfikowane, kluczowe lokale dla danego miasta (jeśli istnieją w bazie stałej)
  const cityVerified = VERIFIED_CITY_BARS[cacheKey] || [];
  for (const b of cityVerified) {
    const key = b.name.toLowerCase().trim();
    seenNames.add(key);
    // Dodajemy też uproszczoną nazwę do filtra (np. "k20", "cybermachina")
    if (key.includes('cyber')) seenNames.add('cybermachina');
    if (key.includes('k20')) seenNames.add('k20 pub');
    uniqueBars.push(b);
  }

  // 2. Dodajemy lokale z OpenStreetMap – z bezwzględnym filtrowaniem niebędących barami
  for (const item of rawElements) {
    const bLat = parseFloat(item.lat);
    const bLon = parseFloat(item.lon);
    if (isNaN(bLat) || isNaN(bLon)) continue;

    let name = item.name;
    if (!name && item.display_name) {
      name = item.display_name.split(',')[0].trim();
    }
    if (!name || name.length < 2) continue;

    if (name.toLowerCase() === normalizedCity.toLowerCase() || name.toLowerCase() === 'polska') {
      continue;
    }

    // Odrzucenie barów mlecznych, rybnych, kawiarni itp.
    if (!isRealDrinkBar(name, item.type, item.display_name)) {
      continue;
    }

    const key = name.toLowerCase().trim();
    if (seenNames.has(key)) continue;
    seenNames.add(key);

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
      lat = 50.0381;
      lon = 22.0048;
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
