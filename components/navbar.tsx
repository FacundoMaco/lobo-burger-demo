"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BookOpen, Tag, Star, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart-context";

const navLinks = [
  { href: "/", label: "Carta", icon: BookOpen },
  { href: "/promos", label: "Promos", icon: Tag },
  { href: "/puntos", label: "Puntos (Pronto)", icon: Star },
];

const PRIMARY = "#F5A623";
const ACCENT = "#E63950";
const INK = "#241F1C";
const BG = "#FFFDF8";

export function Navbar() {
  const pathname = usePathname();
  const { count, setOpen } = useCart();

  return (
    <>
      {/* Desktop top nav */}
      <nav
        className="sticky top-0 z-40 hidden md:flex items-center justify-between px-6 py-3"
        style={{
          background: "rgba(255,253,248,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(36,31,28,0.1)",
        }}
      >
        <Link href="/" className="flex items-center gap-2 group">
          <Image
            src="/images/lobo-logo-official.png"
            alt="Lobo Burger"
            width={170}
            height={32}
            priority
            className="h-7 w-auto object-contain transition-transform group-hover:scale-105"
          />
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
                  color: active ? ACCENT : "rgba(36,31,28,0.65)",
                  background: active ? "rgba(230,57,80,0.08)" : "transparent",
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <button
          onClick={() => setOpen(true)}
          className="relative flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
          style={{ background: PRIMARY, color: INK }}
        >
          <ShoppingCart size={16} />
          {count > 0 ? `Ver pedido (${count})` : "Carrito"}
        </button>
      </nav>

      {/* Mobile top bar */}
      <nav
        className="sticky top-0 z-40 flex md:hidden items-center justify-between px-4 py-3"
        style={{
          background: "rgba(255,253,248,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(36,31,28,0.1)",
        }}
      >
        <Link href="/" className="flex items-center">
          <Image
            src="/images/lobo-logo-official.png"
            alt="Lobo Burger"
            width={130}
            height={24}
            priority
            className="h-5.5 w-auto object-contain"
          />
        </Link>

        <button
          onClick={() => setOpen(true)}
          aria-label={count > 0 ? `Ver pedido, ${count} items` : "Ver carrito"}
          className="relative p-2 rounded-lg transition-colors cursor-pointer"
          style={{ background: "rgba(245,166,35,0.18)" }}
        >
          <ShoppingCart size={20} style={{ color: INK }} />
          {count > 0 && (
            <span
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: ACCENT, color: "#FFFFFF" }}
            >
              {count}
            </span>
          )}
        </button>
      </nav>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden items-center justify-around py-2"
        style={{ background: BG, borderTop: "1px solid rgba(36,31,28,0.12)" }}
      >
        {navLinks.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 py-1 px-4 rounded-lg transition-all"
              style={{ color: active ? ACCENT : "rgba(36,31,28,0.55)" }}
            >
              <Icon size={20} />
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          );
        })}

        <button
          onClick={() => setOpen(true)}
          className="relative flex flex-col items-center gap-1 py-1 px-4 rounded-lg transition-all cursor-pointer"
          style={{ color: count > 0 ? ACCENT : "rgba(36,31,28,0.55)" }}
        >
          <div className="relative">
            <ShoppingCart size={20} />
            {count > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                style={{ background: ACCENT, color: "#FFFFFF" }}
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
