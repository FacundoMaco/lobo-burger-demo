export type Sede = {
  id: "surquillo" | "sjm";
  nombre: string;
  direccion: string;
  lat: number;
  lng: number;
};

// Radio de reparto por sede. El aviso de la web y los terminos hablan de ~7.5 km.
export const RADIO_DELIVERY_KM = 7.5;

export const SEDES: Sede[] = [
  {
    id: "surquillo",
    nombre: "Surquillo",
    direccion: "Av. Aviación 3877, La Calera - Surquillo",
    lat: -12.1058,
    lng: -77.0006,
  },
  {
    id: "sjm",
    nombre: "San Juan de Miraflores",
    direccion: "Av. Vargas Machuca 526, CT - SJM",
    lat: -12.1595,
    lng: -76.9713,
  },
];

// Haversine: distancia en km entre dos puntos.
export function distanciaKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function sedeMasCercana(punto: { lat: number; lng: number }): {
  sede: Sede;
  km: number;
  dentroDeZona: boolean;
} {
  let mejor = SEDES[0];
  let mejorKm = distanciaKm(punto, SEDES[0]);
  for (const s of SEDES.slice(1)) {
    const km = distanciaKm(punto, s);
    if (km < mejorKm) {
      mejor = s;
      mejorKm = km;
    }
  }
  return { sede: mejor, km: mejorKm, dentroDeZona: mejorKm <= RADIO_DELIVERY_KM };
}
