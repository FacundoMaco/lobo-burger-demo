"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Tag, Star, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart-context";

const navLinks = [
  { href: "/", label: "Carta", icon: BookOpen },
  { href: "/promos", label: "Promos", icon: Tag },
  { href: "/puntos", label: "Mis Puntos", icon: Star },
];

const RED = "#B71C1C";
const YELLOW = "#FFD600";
const DARK_RED = "#7B0000";

export function Navbar() {
  const pathname = usePathname();
  const { count, setOpen } = useCart();

  return (
    <>
      {/* Desktop top nav */}
      <nav
        className="sticky top-0 z-40 hidden md:flex items-center justify-between px-6 py-3"
        style={{
          background: `rgba(123,0,0,0.97)`,
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid rgba(255,214,0,0.2)`,
        }}
      >
        <Link href="/" className="flex items-center gap-2">
          <span className="font-bebas text-2xl tracking-widest text-white">
            LOBO <span style={{ color: YELLOW }}>BURGER</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {navLinks.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="px-4 py-2 rounded-md text-sm font-semibold transition-all"
                style={{
                  color: active ? YELLOW : "rgba(255,255,255,0.6)",
                  background: active ? "rgba(255,214,0,0.1)" : "transparent",
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <button
          onClick={() => setOpen(true)}
          className="relative flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all hover:scale-105 active:scale-95"
          style={{ background: YELLOW, color: DARK_RED }}
        >
          <ShoppingCart size={16} />
          {count > 0 ? `Ver pedido (${count})` : "Carrito"}
        </button>
      </nav>

      {/* Mobile top bar */}
      <nav
        className="sticky top-0 z-40 flex md:hidden items-center justify-between px-4 py-3"
        style={{
          background: "rgba(123,0,0,0.97)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,214,0,0.2)",
        }}
      >
        <Link href="/" className="font-bebas text-xl tracking-widest text-white">
          LOBO <span style={{ color: YELLOW }}>BURGER</span>
        </Link>

        <button
          onClick={() => setOpen(true)}
          className="relative p-2 rounded-lg transition-colors"
          style={{ background: "rgba(255,214,0,0.15)" }}
        >
          <ShoppingCart size={20} className="text-white" />
          {count > 0 && (
            <span
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: YELLOW, color: DARK_RED }}
            >
              {count}
            </span>
          )}
        </button>
      </nav>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden items-center justify-around py-2"
        style={{ background: DARK_RED, borderTop: `1px solid rgba(255,214,0,0.2)` }}
      >
        {navLinks.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 py-1 px-4 rounded-lg transition-all"
              style={{ color: active ? YELLOW : "rgba(255,255,255,0.4)" }}
            >
              <Icon size={20} />
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          );
        })}

        <button
          onClick={() => setOpen(true)}
          className="relative flex flex-col items-center gap-1 py-1 px-4 rounded-lg transition-all"
          style={{ color: count > 0 ? YELLOW : "rgba(255,255,255,0.4)" }}
        >
          <div className="relative">
            <ShoppingCart size={20} />
            {count > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                style={{ background: YELLOW, color: DARK_RED }}
              >
                {count}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold">Pedido</span>
        </button>
      </nav>
    </>
  );
}
