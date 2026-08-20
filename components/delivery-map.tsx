"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { SEDES, RADIO_DELIVERY_KM, sedeMasCercana } from "@/lib/sedes";
import { Crosshair, Loader2 } from "lucide-react";

const PRIMARY = "#F5A623";
const ACCENT = "#E63950";
const INK = "#241F1C";
const OK = "#1E9E4A";

export type Ubicacion = {
  lat: number;
  lng: number;
  km: number;
  sede: string;
  dentroDeZona: boolean;
};

// Centro por defecto: punto medio entre las dos sedes.
const CENTRO = { lat: -12.1327, lng: -76.986 };

export function DeliveryMap({
  value,
  onChange,
}: {
  value: Ubicacion | null;
  onChange: (u: Ubicacion) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !boxRef.current) return;

      const inicio = value ?? CENTRO;
      const map = L.map(boxRef.current, {
        center: [inicio.lat, inicio.lng],
        zoom: value ? 16 : 12,
        scrollWheelZoom: false,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      // Sedes + su radio de cobertura
      for (const s of SEDES) {
        L.circle([s.lat, s.lng], {
          radius: RADIO_DELIVERY_KM * 1000,
          color: PRIMARY,
          weight: 1,
          fillColor: PRIMARY,
          fillOpacity: 0.07,
        }).addTo(map);

        L.marker([s.lat, s.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="background:${INK};color:#fff;font-size:10px;font-weight:700;padding:3px 7px;border-radius:999px;white-space:nowrap">${s.nombre}</div>`,
            iconSize: [0, 0],
          }),
        }).addTo(map);
      }

      const pinIcon = L.divIcon({
        className: "",
        html: `<div style="width:22px;height:22px;border-radius:50%;background:${ACCENT};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([inicio.lat, inicio.lng], {
        draggable: true,
        icon: pinIcon,
      }).addTo(map);
      markerRef.current = marker;

      const emitir = (lat: number, lng: number) => {
        const { sede, km, dentroDeZona } = sedeMasCercana({ lat, lng });
        onChangeRef.current({ lat, lng, km, sede: sede.nombre, dentroDeZona });
      };

      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        emitir(lat, lng);
      });

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        emitir(e.latlng.lat, e.latlng.lng);
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Solo se monta una vez; los updates entran por setLatLng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usarMiUbicacion = () => {
    if (!navigator.geolocation) {
      setGeoError("Tu navegador no permite compartir ubicación");
      return;
    }
    setGeoError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        markerRef.current?.setLatLng([lat, lng]);
        mapRef.current?.setView([lat, lng], 16);
        const { sede, km, dentroDeZona } = sedeMasCercana({ lat, lng });
        onChangeRef.current({ lat, lng, km, sede: sede.nombre, dentroDeZona });
        setLocating(false);
      },
      () => {
        setGeoError("No pudimos obtener tu ubicación. Mueve el pin manualmente.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(36,31,28,0.55)" }}>
          Ubicación exacta
        </label>
        <button
          type="button"
          onClick={usarMiUbicacion}
          disabled={locating}
          className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer transition-all active:scale-95 disabled:opacity-60"
          style={{ background: PRIMARY, color: INK }}
        >
          {locating ? <Loader2 size={13} className="animate-spin" /> : <Crosshair size={13} />}
          {locating ? "Buscando..." : "Usar mi ubicación"}
        </button>
      </div>

      <div
        ref={boxRef}
        className="w-full rounded-xl overflow-hidden"
        style={{ height: 240, border: "1.5px solid rgba(36,31,28,0.2)", zIndex: 0 }}
      />

      <p className="text-[11px] mt-2" style={{ color: "rgba(36,31,28,0.5)" }}>
        Arrastra el pin o toca el mapa para marcar dónde entregamos.
      </p>

      {geoError && <p className="text-xs mt-1" style={{ color: ACCENT }}>{geoError}</p>}

      {value && (
        <p
          className="text-xs mt-2 px-3 py-2 rounded-lg"
          style={{
            background: value.dentroDeZona ? "rgba(30,158,74,0.1)" : "#FADADD",
            color: value.dentroDeZona ? OK : "#9B1C30",
          }}
        >
          {value.dentroDeZona
            ? `Dentro de zona — a ${value.km.toFixed(1)} km de la sede ${value.sede}.`
            : `Fuera de zona: estás a ${value.km.toFixed(1)} km de la sede ${value.sede} y repartimos hasta ${RADIO_DELIVERY_KM} km. Puedes elegir recojo en tienda.`}
        </p>
      )}
    </div>
  );
}
