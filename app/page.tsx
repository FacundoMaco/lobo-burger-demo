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

const BG = "#FFFDF8";
const PRIMARY = "#F5A623";
const PRIMARY_SOFT = "#FFEFC7";
const ACCENT = "#E63950";
const ACCENT_SOFT = "#FADADD";
const INK = "#241F1C";

const categories = ["Combos", "Burgers", "Pollo", "Complementos", "Bebidas"];

// Precios por confirmar con la carta oficial de Jaime.
const menuItems = [
  { id: 13, category: "Combos",       name: "Combo Lobo",            description: "Burger de la casa + Salchipapa Clasica + Gaseosa.",                              price: 25, badge: "AHORRA S/8" as string | null,  originalPrice: 33 as number | null, image: "/images/menu/a.webp" as string | null },
  { id: 14, category: "Combos",       name: "Combo Bestia",          description: "Burgazo + Salchipapa XL + Jugo Natural. Para los que no se guardan nada.",       price: 38, badge: "AHORRA S/13", originalPrice: 51,   image: "/images/menu/b.webp" },
  { id: 1,  category: "Burgers",      name: "Miami Night",           description: "Carne smash, queso derretido, papas al hilo y salsas de la casa.",               price: 18, badge: null,          originalPrice: null, image: "/images/menu/miami-night.webp" },
  { id: 2,  category: "Burgers",      name: "Doble Carne",           description: "Doble carne smash, doble queso cheddar y salsa lobo.",                           price: 24, badge: "POPULAR",     originalPrice: null, image: "/images/menu/doublecarne.webp" },
  { id: 3,  category: "Burgers",      name: "Bacon Cheese",          description: "Carne smash, bacon crocante, queso cheddar fundido y salsa lobo.",               price: 22, badge: null,          originalPrice: null, image: "/images/menu/baconcheese.webp" },
  { id: 5,  category: "Burgers",      name: "Burgazo",               description: "La mas pedida: doble carne, queso, papas al hilo y salsas de la casa.",          price: 28, badge: "BESTSELLER",  originalPrice: null, image: "/images/menu/burgazo.webp" },
  { id: 16, category: "Burgers",      name: "Tropical Burger",       description: "Carne smash con pina dorada, queso y salsa especial.",                           price: 23, badge: null,          originalPrice: null, image: "/images/menu/tropical-burger.webp" },
  { id: 17, category: "Burgers",      name: "Chori Royal",           description: "Chorizo artesanal, queso derretido y salsas de la casa.",                        price: 20, badge: null,          originalPrice: null, image: "/images/menu/choriroyal.webp" },
  { id: 4,  category: "Pollo",        name: "Burger de Pollo",       description: "Filete de pollo crocante, lechuga fresca y mayonesa de la casa.",                price: 20, badge: null,          originalPrice: null, image: "/images/menu/burgerpollodesi.webp" },
  { id: 15, category: "Pollo",        name: "Filete de Pollo Royal", description: "Filete de pollo a la plancha, queso derretido y salsa de la casa.",              price: 21, badge: "NUEVO",       originalPrice: null, image: "/images/menu/filete-de-pollo-royal.webp" },
  { id: 6,  category: "Complementos", name: "Salchipapa Clasica",    description: "Papas fritas golden, salchicha premium, ketchup y mayonesa.",                    price: 10, badge: null,          originalPrice: null, image: null },
  { id: 7,  category: "Complementos", name: "Salchipapa Lobo",       description: "Papas fritas, chorizo artesanal, queso derretido y salsa lobo.",                 price: 14, badge: "ESPECIAL",    originalPrice: null, image: null },
  { id: 8,  category: "Complementos", name: "Salchipapa XL",         description: "Porcion XL de papas, salchicha doble, tres salsas a eleccion y toppings.",       price: 16, badge: null,          originalPrice: null, image: null },
  { id: 9,  category: "Complementos", name: "Salchipobre",           description: "Papas fritas, salchicha, huevo frito y salsas — el clasico a lo pobre.",         price: 18, badge: null,          originalPrice: null, image: "/images/menu/salchipobre.webp" },
  { id: 10, category: "Bebidas",      name: "Gaseosa",               description: "Coca-Cola, Sprite, Fanta — fria y bien servida.",                                price: 5,  badge: null,          originalPrice: null, image: null },
  { id: 11, category: "Bebidas",      name: "Limonada",              description: "Limonada natural frozen con menta y azucar de cana.",                            price: 7,  badge: null,          originalPrice: null, image: null },
  { id: 12, category: "Bebidas",      name: "Jugo Natural",          description: "Maracuya, mango o naranja. Siempre del dia.",                                    price: 8,  badge: null,          originalPrice: null, image: null },
];

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

function MenuCard({ item }: { item: typeof menuItems[0] }) {
  const { add, update, items } = useCart();
  const [added, setAdded] = useState(false);
  const inCart = items.find(i => i.id === item.id);

  const handleAdd = () => {
    add({ id: item.id, name: item.name, price: item.price });
    setAdded(true);
    setTimeout(() => setAdded(false), 900);
  };

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1"
      style={{
        background: "#FFFFFF",
        border: `1px solid ${inCart ? "rgba(230,57,80,0.4)" : "rgba(36,31,28,0.1)"}`,
        boxShadow: inCart ? "0 4px 20px rgba(230,57,80,0.12)" : "0 4px 16px rgba(36,31,28,0.07)",
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

          {inCart ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => update(item.id, inCart.qty - 1)}
                aria-label={`Restar ${item.name}`}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
                style={{ background: "rgba(36,31,28,0.08)" }}
              >
                <Minus size={13} style={{ color: INK }} />
              </button>
              <span className="font-mono text-sm font-bold w-5 text-center" style={{ color: INK }}>{inCart.qty}</span>
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

      {/* Hero — carrusel de promociones (bloque primary) */}
      <section id="promos" style={{ background: PRIMARY }}>
        <div className="px-4 pt-10 pb-6 max-w-md mx-auto text-center">
          <h1 className="hero-logo font-bebas leading-none" style={{ fontSize: "clamp(34px,8vw,56px)", color: INK }}>
            LOBO <span style={{ color: "#FFFFFF" }}>BURGER</span>
          </h1>
          <p className="hero-tagline text-sm font-semibold uppercase tracking-[0.25em] mt-2 mb-8" style={{ color: "rgba(36,31,28,0.65)" }}>
            Salvaje de Sabor
          </p>
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

      {/* Footer */}
      <footer className="px-6 py-10 text-center" style={{ background: PRIMARY_SOFT }}>
        <p className="font-bebas text-2xl">
          <span style={{ color: INK }}>LOBO </span>
          <span style={{ color: ACCENT }}>BURGER</span>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 mt-4" style={{ color: "rgba(36,31,28,0.65)" }}>
          <span className="flex items-center gap-1.5 text-sm"><Clock size={13} style={{ color: ACCENT }} />Lun-Dom 12pm-11pm</span>
          <span className="flex items-center gap-1.5 text-sm"><Bike size={13} style={{ color: ACCENT }} />Delivery hasta ~7.5 km por sede</span>
          <span className="flex items-center gap-1.5 text-sm"><Phone size={13} style={{ color: ACCENT }} />+51 974 983 862</span>
          <span className="flex items-center gap-1.5 text-sm"><MapPin size={13} style={{ color: ACCENT }} />Av. Aviación 3877, La Calera - Surquillo</span>
          <span className="flex items-center gap-1.5 text-sm"><MapPin size={13} style={{ color: ACCENT }} />Av. Vargas Machuca 526, CT - SJM</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <a
            href="/libro-reclamaciones"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "#FFFFFF", border: `1.5px solid ${INK}`, color: INK }}
          >
            <BookText size={14} />
            Libro de Reclamaciones
          </a>
        </div>
        <p className="text-[11px] mt-5" style={{ color: "rgba(36,31,28,0.5)" }}>
          © 2026 Lobo Burger. Todos los derechos reservados. ·{" "}
          <a href="/terminos" className="underline">Términos y condiciones</a>
        </p>
      </footer>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
