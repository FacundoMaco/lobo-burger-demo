"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useCart } from "@/lib/cart-context";
import { Navbar } from "@/components/navbar";
import { LocalReel } from "@/components/local-reel";
import { LocationBar } from "@/components/location-bar";
import { PromoSlider, type HeroPromo } from "@/components/promo-slider";
import { CheeseDrip } from "@/components/cheese-drip";
import { Plus, Minus, Check, Phone, Clock, Bike, MapPin, BookText } from "lucide-react";
import { MENU_ITEMS as menuItems, CATEGORIES as categories, type MenuItem, CATEGORIAS_CON_CREMAS, CREMAS_OPCIONES, CREMAS_MAX, CATEGORIAS_CON_PAN_PAPAS, PAN_OPCIONES, PAPAS_OPCIONES } from "@/lib/menu";

const BG = "#FFFDF8";
const PRIMARY = "#F5A623";
const PRIMARY_SOFT = "#FFEFC7";
const ACCENT = "#E63950";
const ACCENT_SOFT = "#FADADD";
const INK = "#241F1C";


const heroPromos: HeroPromo[] = [
  { id: 13, name: "Combo Lobo",            price: 25, tag: "AHORRA S/8",  placeholder: "Foto: Combo Lobo",      image: "/images/menu/a.webp" },
  { id: 14, name: "Combo Bestia",          price: 38, tag: "AHORRA S/13", placeholder: "Foto: Combo Bestia",    image: "/images/menu/b.webp" },
  { id: 2,  name: "Doble Carne",           price: 24, tag: "POPULAR",     placeholder: "Foto: Doble Carne",     image: "/images/menu/doublecarne.webp" },
  { id: 6,  name: "Martes 2x1 Salchipapa", price: 10, tag: "SOLO MARTES", placeholder: "Foto: Salchipapa 2x1",  image: "/images/menu/salchipobre.webp" },
];

function placeholderColor(category: string): string {
  switch (category) {
    case "Combos":       return ACCENT_SOFT;
    case "Burgers":      return PRIMARY_SOFT;
    case "Pollo":        return "#FFE8D1";
    case "Complementos": return "#FFF3C4";
    case "Bebidas":      return "#DDF0EE";
    default:             return PRIMARY_SOFT;
  }
}

function useReveal(rootMargin = "0px 0px -60px 0px") {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add("visible"); obs.disconnect(); } },
      { rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);
  return ref;
}

function ItemBadge({ text }: { text: string }) {
  const isPromo = text.startsWith("AHORRA");
  const bg = text === "BESTSELLER" || isPromo ? ACCENT : text === "POPULAR" ? INK : text === "NUEVO" ? "#1E9E4A" : "#6B6560";
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: bg, color: "#FFFFFF" }}>
      {text}
    </span>
  );
}

function MenuCard({ item }: { item: MenuItem }) {
  const { add, update, items } = useCart();
  const [added, setAdded] = useState(false);
  const [pickingCremas, setPickingCremas] = useState(false);
  const [cremas, setCremas] = useState<string[]>([]);
  const [pan, setPan] = useState(PAN_OPCIONES[0]);
  const [papas, setPapas] = useState(PAPAS_OPCIONES[1]);
  const lineas = items.filter(i => i.id === item.id);
  const enCarrito = lineas.reduce((s, l) => s + l.qty, 0);
  const llevaCremas = CATEGORIAS_CON_CREMAS.includes(item.category);
  const llevaPanPapas = CATEGORIAS_CON_PAN_PAPAS.includes(item.category);

  const confirmAdd = (cremasElegidas?: string[], panElegido?: string, papasElegido?: string) => {
    add({
      id: item.id,
      name: item.name,
      price: item.price,
      cremas: cremasElegidas?.length ? cremasElegidas : undefined,
      pan: llevaPanPapas ? panElegido : undefined,
      papas: llevaPanPapas ? papasElegido : undefined,
    });
    setAdded(true);
    setPickingCremas(false);
    setCremas([]);
    setPan(PAN_OPCIONES[0]);
    setPapas(PAPAS_OPCIONES[1]);
    setTimeout(() => setAdded(false), 900);
  };

  // Sin guard de "ya esta en el carrito": cada unidad de un producto con
  // cremas se pregunta aparte. Antes, la segunda unidad heredaba en silencio
  // las cremas de la primera y la comanda imprimia "2x ... Cremas: X, Y" sin
  // que el cliente lo hubiera elegido para esa unidad.
  const handleAdd = () => {
    if (llevaCremas) {
      setPickingCremas(true);
      return;
    }
    confirmAdd();
  };

  const toggleCrema = (c: string) => {
    setCremas(prev => {
      if (prev.includes(c)) return prev.filter(x => x !== c);
      if (prev.length >= CREMAS_MAX) return prev;
      return [...prev, c];
    });
  };

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1"
      style={{
        background: "#FFFFFF",
        border: `1px solid ${enCarrito > 0 ? "rgba(230,57,80,0.4)" : "rgba(36,31,28,0.1)"}`,
        boxShadow: enCarrito > 0 ? "0 4px 20px rgba(230,57,80,0.12)" : "0 4px 16px rgba(36,31,28,0.07)",
      }}
    >
      <div className="relative w-full" style={{ paddingTop: "62%", background: placeholderColor(item.category) }}>
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <span
            className="absolute inset-0 flex items-center justify-center font-mono text-[11px] px-3 text-center"
            style={{ color: "rgba(36,31,28,0.45)" }}
          >
            [Foto: {item.name}]
          </span>
        )}
        {item.badge && (
          <span className="absolute top-3 right-3">
            <ItemBadge text={item.badge} />
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <h3 className="font-bebas text-base leading-tight" style={{ color: INK }}>{item.name}</h3>
        <p className="text-xs leading-relaxed" style={{ color: "rgba(36,31,28,0.6)" }}>{item.description}</p>

        <div
          className="flex items-center justify-between mt-auto pt-3"
          style={{ borderTop: "1px solid rgba(36,31,28,0.07)" }}
        >
          <div>
            <span className="font-mono text-lg font-bold leading-none" style={{ color: INK }}>S/{item.price}</span>
            {item.originalPrice && (
              <span className="font-mono text-xs line-through ml-2" style={{ color: "rgba(36,31,28,0.35)" }}>S/{item.originalPrice}</span>
            )}
          </div>

          {enCarrito > 0 ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => update(lineas[lineas.length - 1].lineId, lineas[lineas.length - 1].qty - 1)}
                aria-label={`Restar ${item.name}`}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
                style={{ background: "rgba(36,31,28,0.08)" }}
              >
                <Minus size={13} style={{ color: INK }} />
              </button>
              <span className="font-mono text-sm font-bold w-5 text-center" style={{ color: INK }}>{enCarrito}</span>
              <button
                onClick={handleAdd}
                aria-label={`Sumar ${item.name}`}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
                style={{ background: PRIMARY }}
              >
                <Plus size={13} style={{ color: INK }} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleAdd}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150 active:scale-95 cursor-pointer"
              style={{ background: added ? "#1E9E4A" : PRIMARY, color: added ? "#FFFFFF" : INK }}
            >
              {added ? <Check size={13} /> : <Plus size={13} />}
              {added ? "Agregado" : "Agregar"}
            </button>
          )}
        </div>

        {pickingCremas && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(36,31,28,0.07)" }}>
            {llevaPanPapas && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "rgba(36,31,28,0.6)" }}>
                  Tipo de pan
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {PAN_OPCIONES.map(p => (
                    <button
                      key={p}
                      onClick={() => setPan(p)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer"
                      style={{
                        background: pan === p ? PRIMARY : "rgba(36,31,28,0.06)",
                        color: pan === p ? INK : "rgba(36,31,28,0.65)",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "rgba(36,31,28,0.6)" }}>
                  Papas
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {PAPAS_OPCIONES.map(p => (
                    <button
                      key={p}
                      onClick={() => setPapas(p)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer"
                      style={{
                        background: papas === p ? PRIMARY : "rgba(36,31,28,0.06)",
                        color: papas === p ? INK : "rgba(36,31,28,0.65)",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </>
            )}
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "rgba(36,31,28,0.6)" }}>
              {enCarrito > 0 ? `Cremas para la unidad #${enCarrito + 1} (max ${CREMAS_MAX})` : `Cremas (max ${CREMAS_MAX})`}
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {CREMAS_OPCIONES.map(c => {
                const selected = cremas.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleCrema(c)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer"
                    style={{
                      background: selected ? PRIMARY : "rgba(36,31,28,0.06)",
                      color: selected ? INK : "rgba(36,31,28,0.65)",
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setPickingCremas(false); setCremas([]); setPan(PAN_OPCIONES[0]); setPapas(PAPAS_OPCIONES[1]); }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase"
                style={{ background: "rgba(36,31,28,0.08)", color: INK }}
              >
                Cancelar
              </button>
              <button
                onClick={() => confirmAdd(cremas, pan, papas)}
                className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase"
                style={{ background: PRIMARY, color: INK }}
              >
                Agregar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [active, setActive] = useState("Combos");
  const cartaReveal = useReveal();

  const filtered = menuItems.filter(i => i.category === active);

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      <Navbar />
      <LocationBar />

      {/* Hero — Identidad Oficial & Carrusel de Promociones */}
      <section id="promos" className="relative overflow-hidden" style={{ background: PRIMARY }}>
        <div className="px-4 pt-8 pb-6 max-w-md mx-auto text-center relative z-10">
          {/* Logotipo Oficial Auténtico de Lobo Burger */}
          <div className="flex flex-col items-center justify-center mb-4">
            <div className="my-2 transition-transform hover:scale-105">
              <Image
                src="/images/lobo-logo-official.png"
                alt="Lobo Burger"
                width={440}
                height={82}
                priority
                className="w-72 sm:w-80 md:w-96 h-auto object-contain drop-shadow-md"
              />
            </div>
            <p className="hero-tagline text-xs font-bold uppercase tracking-[0.22em] mt-1.5 text-black/75">
              Hamburguesas & Broaster · Surquillo & SJM
            </p>
          </div>

          <PromoSlider promos={heroPromos} />
        </div>
      </section>

      {/* Goteo de queso — firma de marca, uso único */}
      <div style={{ background: BG }}>
        <CheeseDrip fill={PRIMARY} />
      </div>

      {/* Carta */}
      <section id="carta" className="px-4 md:px-8 pb-28 md:pb-16 pt-10">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-bebas text-2xl md:text-4xl text-center mb-8" style={{ color: INK }}>
            NUESTRA <span style={{ color: ACCENT }}>CARTA</span>
          </h2>

          {/* Chips de categoría */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-8 no-scrollbar sm:justify-center">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className="shrink-0 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer"
                style={{
                  background: active === cat ? ACCENT : "#FFFFFF",
                  color: active === cat ? "#FFFFFF" : INK,
                  border: `1.5px solid ${active === cat ? ACCENT : "rgba(36,31,28,0.2)"}`,
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid de productos */}
          <div ref={cartaReveal} className="reveal grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {filtered.map(item => <MenuCard key={item.id} item={item} />)}
          </div>
        </div>
      </section>

      {/* Local */}
      <LocalReel />

      {/* Footer con Branding Oficial Limpio */}
      <footer className="relative overflow-hidden px-6 py-12 text-center" style={{ background: PRIMARY_SOFT }}>
        <div className="relative z-10 flex flex-col items-center">
          <Image
            src="/images/lobo-logo-official.png"
            alt="Lobo Burger"
            width={180}
            height={34}
            className="h-7 w-auto object-contain mb-3"
          />
          <div className="flex flex-wrap items-center justify-center gap-4 mt-4 max-w-3xl" style={{ color: "rgba(36,31,28,0.75)" }}>
            <span className="flex items-center gap-1.5 text-xs font-semibold"><Clock size={13} style={{ color: ACCENT }} />Lun-Dom 12pm-11pm</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold"><Bike size={13} style={{ color: ACCENT }} />Delivery Surquillo & SJM</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold"><Phone size={13} style={{ color: ACCENT }} />+51 974 983 862</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold"><MapPin size={13} style={{ color: ACCENT }} />Av. Aviación 3877, La Calera - Surquillo</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold"><MapPin size={13} style={{ color: ACCENT }} />Av. Vargas Machuca 526, CT - SJM</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <a
              href="/libro-reclamaciones"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-neutral-50 transition-colors"
              style={{ background: "#FFFFFF", border: `1.5px solid ${INK}`, color: INK }}
            >
              <BookText size={14} />
              Libro de Reclamaciones
            </a>
          </div>
          <p className="text-[11px] mt-6" style={{ color: "rgba(36,31,28,0.5)" }}>
            © 2026 Lobo Burger. Hecho para comer salvaje. ·{" "}
            <a href="/terminos" className="underline">Términos y condiciones</a>
          </p>
        </div>
      </footer>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
