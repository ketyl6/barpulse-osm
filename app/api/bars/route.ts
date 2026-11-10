import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city') || 'Rzeszów';

  try {
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&countrycodes=pl`,
      { headers: { 'User-Agent': 'BarPulseOpenSourceApp/1.0' } }
    );
    const geoData = await geoRes.json();

    if (!geoData || geoData.length === 0) {
      return NextResponse.json({ error: 'Nie znaleziono miasta' }, { status: 404 });
    }

    const lat = parseFloat(geoData[0].lat);
    const lon = parseFloat(geoData[0].lon);

    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"="bar"](around:6000,${lat},${lon});
        node["amenity"="pub"](around:6000,${lat},${lon});
        node["amenity"="nightclub"](around:6000,${lat},${lon});
        way["amenity"="bar"](around:6000,${lat},${lon});
        way["amenity"="pub"](around:6000,${lat},${lon});
        way["amenity"="nightclub"](around:6000,${lat},${lon});
      );
      out center;
    `;

    const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQuery,
      headers: { 'Content-Type': 'text/plain' }
    });

    const overpassData = await overpassRes.json();

    const bars = overpassData.elements
      .map((el: any) => {
        const barLat = el.lat || el.center?.lat;
        const barLon = el.lon || el.center?.lon;
        const name = el.tags?.name;

        if (!name || !barLat || !barLon) return null;

        return {
          osmId: `${el.type}/${el.id}`,
          name: name,
          type: el.tags.amenity === 'pub' ? 'Pub' : el.tags.amenity === 'nightclub' ? 'Klub' : 'Bar',
          street: el.tags['addr:street'] ? `${el.tags['addr:street']} ${el.tags['addr:housenumber'] || ''}` : 'Centrum',
          lat: barLat,
          lon: barLon,
          openingHours: el.tags.opening_hours || null
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      city,
      center: { lat, lon },
      totalCount: bars.length,
      bars
    });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd podczas pobierania danych z OpenStreetMap' }, { status: 500 });
  }
}
