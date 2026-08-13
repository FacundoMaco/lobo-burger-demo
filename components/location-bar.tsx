"use client";

import { useCart } from "@/lib/cart-context";
import { Store, Bike, MapPin } from "lucide-react";

const PRIMARY = "#F5A623";
const ACCENT = "#E63950";
const INK = "#241F1C";

export function LocationBar() {
  const { fulfillmentMode, setFulfillmentMode, address, setAddress } = useCart();
  const unset = fulfillmentMode === null;

  return (
    <div
      className="px-4 py-3"
      style={{
        background: "#FFFDF8",
        borderBottom: `2px solid ${unset ? ACCENT : "rgba(36,31,28,0.1)"}`,
      }}
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center gap-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider shrink-0" style={{ color: unset ? ACCENT : "rgba(36,31,28,0.55)" }}>
          {unset ? "¿Cómo quieres tu pedido?" : "Tu pedido:"}
        </span>

        <div className="flex gap-2">
          <button
            onClick={() => setFulfillmentMode("pickup")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer"
            style={{
              background: fulfillmentMode === "pickup" ? PRIMARY : "#FFFFFF",
              color: INK,
              border: `1.5px solid ${fulfillmentMode === "pickup" ? PRIMARY : "rgba(36,31,28,0.25)"}`,
            }}
          >
            <Store size={13} />
            Recojo en tienda
          </button>
          <button
            onClick={() => setFulfillmentMode("delivery")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer"
            style={{
              background: fulfillmentMode === "delivery" ? PRIMARY : "#FFFFFF",
              color: INK,
              border: `1.5px solid ${fulfillmentMode === "delivery" ? PRIMARY : "rgba(36,31,28,0.25)"}`,
            }}
          >
            <Bike size={13} />
            Delivery
          </button>
        </div>

        {fulfillmentMode === "delivery" && (
          <div className="flex items-center gap-2 flex-1 sm:max-w-sm">
            <MapPin size={14} className="shrink-0" style={{ color: ACCENT }} />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Tu dirección de entrega..."
              aria-label="Dirección de entrega"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus-visible:ring-2"
              style={{ background: "#FFFFFF", border: "1.5px solid rgba(36,31,28,0.25)", color: INK }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
