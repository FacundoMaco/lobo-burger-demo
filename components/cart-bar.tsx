"use client";

import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { ShoppingBag } from "lucide-react";

const PRIMARY = "#F5A623";
const INK = "#241F1C";

export function CartBar() {
  const pathname = usePathname();
  const { count, total, open, setOpen } = useCart();

  if (count === 0 || open || pathname === "/checkout") return null;

  return (
    <button
      onClick={() => setOpen(true)}
      className="cart-bar fixed left-3 right-3 z-40 md:hidden flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl transition-transform duration-150 active:scale-[0.98] cursor-pointer"
      style={{
        bottom: "calc(4.5rem + env(safe-area-inset-bottom))",
        background: INK,
        color: "#FFFFFF",
        boxShadow: "0 8px 28px rgba(36,31,28,0.35)",
      }}
      aria-label={`Ver pedido, ${count} items, total S/${total}`}
    >
      <span className="flex items-center gap-2">
        <span className="relative flex items-center justify-center w-7 h-7 rounded-full" style={{ background: PRIMARY, color: INK }}>
          <ShoppingBag size={15} />
        </span>
        <span className="text-xs font-bold uppercase tracking-wider">
          {count} {count === 1 ? "item" : "items"}
        </span>
      </span>
      <span className="font-bebas text-sm leading-none">
        Ver pedido · <span className="font-mono">S/{total}</span>
      </span>
    </button>
  );
}
