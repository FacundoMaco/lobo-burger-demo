"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useCart } from "@/lib/cart-context";
import { ChevronLeft, ChevronRight, Plus, Check } from "lucide-react";

const PRIMARY = "#F5A623";
const ACCENT = "#E63950";
const ACCENT_SOFT = "#FADADD";
const PRIMARY_SOFT = "#FFEFC7";
const INK = "#241F1C";

export type HeroPromo = {
  id: number;
  name: string;
  price: number;
  tag?: string;
  placeholder: string;
  image?: string;
};

const AUTOPLAY_MS = 4500;

function PromoSlide({ promo, index }: { promo: HeroPromo; index: number }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    add({ id: promo.id, name: promo.name, price: promo.price });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  const blockColor = index % 2 === 0 ? ACCENT_SOFT : PRIMARY_SOFT;

  return (
    <div className="snap-center shrink-0 w-full px-1">
      <div
        className="rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "#FFFFFF", boxShadow: "0 6px 24px rgba(36,31,28,0.12)" }}
      >
        <div
          className="relative w-full flex items-center justify-center"
          style={{ paddingTop: "52%", background: blockColor }}
        >
          {promo.image ? (
            <Image
              src={promo.image}
              alt={promo.name}
              fill
              priority={index === 0}
              sizes="(max-width: 768px) 100vw, 640px"
              className="object-cover"
            />
          ) : (
            <span
              className="absolute inset-0 flex items-center justify-center font-mono text-xs px-4 text-center"
              style={{ color: "rgba(36,31,28,0.5)" }}
            >
              [{promo.placeholder}]
            </span>
          )}
          {promo.tag && (
            <span
              className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
              style={{ background: ACCENT, color: "#FFFFFF" }}
            >
              {promo.tag}
            </span>
          )}
        </div>

        <div className="p-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bebas text-lg leading-tight truncate" style={{ color: INK }}>
              {promo.name}
            </p>
            <p className="font-mono text-xl font-bold mt-1" style={{ color: INK }}>
              S/{promo.price}
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="shrink-0 flex items-center gap-1.5 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150 active:scale-95 cursor-pointer"
            style={{ background: added ? "#1E9E4A" : PRIMARY, color: added ? "#FFFFFF" : INK }}
          >
            {added ? <Check size={14} /> : <Plus size={14} />}
            {added ? "Agregado" : "Agregar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PromoSlider({ promos }: { promos: HeroPromo[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = promos.length;

  const scrollToSlide = (i: number) => {
    const el = trackRef.current;
    const child = el?.children[i] as HTMLElement | undefined;
    if (!el || !child) return;
    el.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => {
      const children = Array.from(el.children) as HTMLElement[];
      let closest = 0;
      let minDist = Infinity;
      children.forEach((child, i) => {
        const dist = Math.abs(child.offsetLeft - el.scrollLeft);
        if (dist < minDist) { minDist = dist; closest = i; }
      });
      setActive(closest);
    };
    const stopAutoplay = () => setPaused(true);
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", stopAutoplay, { passive: true });
    el.addEventListener("wheel", stopAutoplay, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", stopAutoplay);
      el.removeEventListener("wheel", stopAutoplay);
    };
  }, []);

  // ref espejo para que el intervalo lea el slide actual sin reiniciarse
  const activeRef = useRef(0);
  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    if (paused) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      scrollToSlide((activeRef.current + 1) % total);
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, total]);

  const manual = (i: number) => {
    setPaused(true);
    scrollToSlide((i + total) % total);
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth gap-4"
        aria-label="Carrusel de promociones"
      >
        {promos.map((p, i) => (
          <PromoSlide key={p.id} promo={p} index={i} />
        ))}
      </div>

      {/* Flechas */}
      <button
        onClick={() => manual(active - 1)}
        aria-label="Promoción anterior"
        className="hidden sm:flex absolute left-[-18px] top-[38%] w-10 h-10 rounded-full items-center justify-center transition-all active:scale-90 cursor-pointer"
        style={{ background: "#FFFFFF", color: INK, boxShadow: "0 2px 12px rgba(36,31,28,0.2)" }}
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={() => manual(active + 1)}
        aria-label="Promoción siguiente"
        className="hidden sm:flex absolute right-[-18px] top-[38%] w-10 h-10 rounded-full items-center justify-center transition-all active:scale-90 cursor-pointer"
        style={{ background: "#FFFFFF", color: INK, boxShadow: "0 2px 12px rgba(36,31,28,0.2)" }}
      >
        <ChevronRight size={18} />
      </button>

      {/* Dots */}
      <div className="flex justify-center gap-2 mt-5">
        {promos.map((_, i) => (
          <button
            key={i}
            onClick={() => manual(i)}
            aria-label={`Ir a promoción ${i + 1} de ${total}`}
            className="h-2 rounded-full transition-all duration-200 cursor-pointer"
            style={{
              width: active === i ? "22px" : "8px",
              background: active === i ? INK : "rgba(36,31,28,0.3)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
