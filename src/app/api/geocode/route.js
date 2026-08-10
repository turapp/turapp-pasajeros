// Proxy a Nominatim (OpenStreetMap) para autocompletado de direcciones.
// Se llama desde el servidor (no el navegador) porque Nominatim pide un
// User-Agent identificable y no se puede fijar ese header desde fetch()
// en el cliente. Gratis, sin llave, mismo proveedor que ya usa el mapa.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return Response.json([]);
  }

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: '5',
    countrycodes: 'co',
    addressdetails: '0',
    // bounded=1 hace que el viewbox sea un filtro estricto: solo Buenaventura,
    // no el resto de Colombia (antes solo era una preferencia, se colaban
    // resultados de Antioquia y otros departamentos).
    viewbox: '-77.15,3.98,-76.90,3.78',
    bounded: '1',
  });

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { 'User-Agent': 'Turapp-Buenaventura/1.0 (contacto@turapp.co)' },
    });
    if (!res.ok) return Response.json([]);
    const data = await res.json();
    const results = data.map((r) => ({
      display_name: r.display_name,
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
    }));
    return Response.json(results);
  } catch (err) {
    return Response.json([]);
  }
}
