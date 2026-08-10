const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Construye una URL de Static Maps. Sin API key, Google devuelve una imagen
// de error en vez del mapa — este helper es el único lugar que la añade.
// Google espera un parámetro "style" repetido por cada regla, no separado
// por comas, así que los arrays se expanden en vez de dejar que
// URLSearchParams los junte con toString().
export function staticMapUrl(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((v) => query.append(key, v));
    } else {
      query.append(key, value);
    }
  }
  if (GOOGLE_MAPS_API_KEY) query.append('key', GOOGLE_MAPS_API_KEY);
  return `https://maps.googleapis.com/maps/api/staticmap?${query.toString()}`;
}
