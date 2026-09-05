"use client";

import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { X, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";

const PRIMARY = "#F5A623";
const INK = "#241F1C";

export function CartDrawer() {
  const router = useRouter();
  const { items, update, remove, total, count, open, setOpen } = useCart();

  if (!open) return null;

  const goToCheckout = () => {
    setOpen(false);
    router.push("/checkout");
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)} />

      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm flex flex-col"
        style={{ background: "#FFFDF8", borderLeft: "1px solid rgba(36,31,28,0.12)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(36,31,28,0.1)" }}
        >
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} style={{ color: PRIMARY }} />
            <span className="font-bebas text-lg" style={{ color: INK }}>
              TU PEDIDO
              {count > 0 && (
                <span className="ml-2 text-sm font-sans font-semibold" style={{ color: "rgba(36,31,28,0.55)" }}>
                  ({count} {count === 1 ? "item" : "items"})
                </span>
              )}
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Cerrar carrito"
            className="transition-colors cursor-pointer"
            style={{ color: "rgba(36,31,28,0.45)" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <ShoppingBag size={40} style={{ color: "rgba(36,31,28,0.15)" }} />
              <p className="text-sm" style={{ color: "rgba(36,31,28,0.5)" }}>Agrega items desde la carta</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.lineId}
                className="flex items-center gap-3 py-3"
                style={{ borderBottom: "1px solid rgba(36,31,28,0.08)" }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight" style={{ color: INK }}>{item.name}</p>
                  <p className="font-mono text-xs mt-0.5" style={{ color: "rgba(36,31,28,0.55)" }}>
                    S/{item.price} c/u
                  </p>
                  {(item.pan || item.papas) && (
                    <p className="font-mono text-xs mt-0.5" style={{ color: "rgba(36,31,28,0.55)" }}>
                      {[item.pan, item.papas].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {item.cremas && item.cremas.length > 0 && (
                    <p className="font-mono text-xs mt-0.5" style={{ color: "rgba(36,31,28,0.55)" }}>
                      Cremas: {item.cremas.join(", ")}
                    </p>
                  )}
                  {item.comentario && (
                    <p className="text-xs mt-0.5 italic" style={{ color: "rgba(36,31,28,0.55)" }}>
                      &quot;{item.comentario}&quot;
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => update(item.lineId, item.qty - 1)}
                    aria-label={`Restar ${item.name}`}
                    className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
                    style={{ background: "rgba(36,31,28,0.08)" }}
                  >
                    <Minus size={11} style={{ color: INK }} />
                  </button>
                  <span className="text-sm font-bold w-5 text-center" style={{ color: INK }}>{item.qty}</span>
                  <button
                    onClick={() => update(item.lineId, item.qty + 1)}
                    aria-label={`Sumar ${item.name}`}
                    className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
                    style={{ background: "rgba(245,166,35,0.25)" }}
                  >
                    <Plus size={11} style={{ color: INK }} />
                  </button>
                </div>
                <span className="font-mono text-sm font-bold w-14 text-right" style={{ color: INK }}>
                  S/{item.price * item.qty}
                </span>
                <button
                  onClick={() => remove(item.lineId)}
                  aria-label={`Quitar ${item.name} del pedido`}
                  className="transition-colors ml-1 cursor-pointer"
                  style={{ color: "rgba(36,31,28,0.3)" }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Subtotal + CTA */}
        {items.length > 0 && (
          <div className="px-5 py-5" style={{ borderTop: "1px solid rgba(36,31,28,0.1)" }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm uppercase tracking-wider" style={{ color: "rgba(36,31,28,0.55)" }}>Subtotal</span>
              <span className="font-mono text-2xl font-bold leading-none" style={{ color: INK }}>
                S/{total}
              </span>
            </div>
            <button
              onClick={goToCheckout}
              className="w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all hover:brightness-105 active:scale-95 cursor-pointer"
              style={{ background: PRIMARY, color: INK }}
            >
              Continuar al pago
            </button>
          </div>
        )}
      </div>
    </>
  );
}
