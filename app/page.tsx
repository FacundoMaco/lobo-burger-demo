"use client";

import { useState, useEffect, useRef } from "react";
import { useCart } from "@/lib/cart-context";
import { Navbar } from "@/components/navbar";
import { UtensilsCrossed, Plus, Check, ChevronDown, Zap, Tag, Star, Phone, Clock, Bike, MapPin } from "lucide-react";

const YELLOW = "#FFD600";
const DARK_RED = "#7F1D1D";
const CARD_BG = "#1A0000";

const categories = ["Todos", "Hamburguesas", "Salchipapas", "Bebidas", "Combos"];

const menuItems = [
  { id: 1,  category: "Hamburguesas", name: "Lobo Clasica",       description: "Carne 180g, lechuga, tomate, cebolla caramelizada y salsa lobo secreta.",         price: 18, badge: null as string | null, originalPrice: null as number | null },
  { id: 2,  category: "Hamburguesas", name: "Doble Lobo",         description: "Doble carne 180g c/u, doble queso cheddar, pepinillos y mostaza artesanal.",      price: 24, badge: "POPULAR",      originalPrice: null },
  { id: 3,  category: "Hamburguesas", name: "BBQ Wolf",           description: "Carne 180g, salsa BBQ ahumada, cebolla crispy, queso suizo y jalapeños.",          price: 22, badge: null,           originalPrice: null },
  { id: 4,  category: "Hamburguesas", name: "Crispy Wolf",        description: "Pollo apanado crocante, salsa honey mustard, repollo morado y tomate.",            price: 20, badge: null,           originalPrice: null },
  { id: 5,  category: "Hamburguesas", name: "La Bestia",          description: "Doble carne 200g, bacon crujiente, huevo frito, doble queso y salsa especial.",    price: 28, badge: "BESTSELLER",  originalPrice: null },
  { id: 6,  category: "Salchipapas", name: "Salchipapa Clasica",  description: "Papas fritas golden, salchicha premium, ketchup y mayonesa.",                      price: 10, badge: null,           originalPrice: null },
  { id: 7,  category: "Salchipapas", name: "Salchipapa Lobo",    description: "Papas fritas, chorizo artesanal, queso derretido y salsa lobo.",                   price: 14, badge: "ESPECIAL",    originalPrice: null },
  { id: 8,  category: "Salchipapas", name: "Salchipapa XL",      description: "Porcion XL de papas, salchicha doble, tres salsas a eleccion y toppings.",         price: 16, badge: null,           originalPrice: null },
  { id: 9,  category: "Salchipapas", name: "Salchipapa Mixta",   description: "Papas, chorizo + salchicha, queso fundido, bacon bits y cebolla verde.",           price: 18, badge: "NUEVO",        originalPrice: null },
  { id: 10, category: "Bebidas",     name: "Gaseosa",             description: "Coca-Cola, Sprite, Fanta — fria y bien servida.",                                  price: 5,  badge: null,           originalPrice: null },
  { id: 11, category: "Bebidas",     name: "Limonada",            description: "Limonada natural frozen con menta y azucar de cana.",                              price: 7,  badge: null,           originalPrice: null },
  { id: 12, category: "Bebidas",     name: "Jugo Natural",        description: "Maracuya, mango o naranja. Siempre del dia.",                                      price: 8,  badge: null,           originalPrice: null },
  { id: 13, category: "Combos",     name: "Combo Lobo",           description: "Hamburguesa Lobo Clasica + Salchipapa Clasica + Gaseosa.",                         price: 25, badge: "AHORRA S/8",  originalPrice: 33 },
  { id: 14, category: "Combos",     name: "Combo Bestia",         description: "La Bestia + Salchipapa XL + Jugo Natural. Para los que no se guardan nada.",       price: 38, badge: "AHORRA S/13", originalPrice: 51 },
];

const promos = [
  { label: "Martes 2x1 Salchipapas", desc: "Valido de 12pm a 8pm los martes.", icon: Zap },
  { label: "Combo Lobo S/25",         desc: "Precio normal S/33. Ahorras S/8.", icon: Tag },
  { label: "Primera visita -20%",     desc: "Muestrale esta pantalla al cajero.", icon: Star },
];

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
  const bg = text === "BESTSELLER" ? "#DC2626" : isPromo ? YELLOW : text === "POPULAR" ? "#1a5276" : text === "NUEVO" ? "#1e8449" : "#555";
  const color = isPromo ? DARK_RED : "#fff";
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: bg, color }}>
      {text}
    </span>
  );
}

function MenuCard({ item }: { item: typeof menuItems[0] }) {
  const { add, items } = useCart();
  const [added, setAdded] = useState(false);
  const inCart = items.find(i => i.id === item.id);

  const handleAdd = () => {
    add({ id: item.id, name: item.name, price: item.price });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div
      className="rounded-xl p-4 flex items-start gap-3 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: CARD_BG,
        border: `1px solid rgba(255,214,0,${inCart ? "0.5" : "0.12"})`,
        boxShadow: inCart ? "0 0 0 1px rgba(255,214,0,0.3)" : "none",
      }}
    >
      <div className="shrink-0 w-16 h-16 rounded-lg flex items-center justify-center" style={{ background: DARK_RED }}>
        <UtensilsCrossed size={22} style={{ color: YELLOW, opacity: 0.55 }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-semibold text-white text-sm leading-tight">{item.name}</span>
          {item.badge && <ItemBadge text={item.badge} />}
        </div>
        <p className="text-xs leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
          {item.description}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-bebas text-2xl leading-none" style={{ color: YELLOW }}>S/{item.price}</span>
            {item.originalPrice && (
              <span className="text-xs line-through" style={{ color: "rgba(255,255,255,0.25)" }}>S/{item.originalPrice}</span>
            )}
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 active:scale-95 cursor-pointer"
            style={{ background: added ? "#25D366" : YELLOW, color: DARK_RED }}
          >
            {added ? <Check size={13} /> : <Plus size={13} />}
            {added ? "Agregado" : inCart ? `Agregar (${inCart.qty})` : "Agregar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [active, setActive] = useState("Todos");
  const promosReveal = useReveal();
  const cartaReveal  = useReveal();

  const filtered = menuItems.filter(i => active === "Todos" || i.category === active);
  const grouped: Record<string, typeof menuItems> = {};
  if (active === "Todos") {
    for (const item of filtered) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }
  }

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen" style={{ background: "#0D0000" }}>
      <Navbar />

      {/* Hero */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center px-4 text-center"
        style={{
          background: "linear-gradient(135deg, #0D0000 0%, #3B0000 60%, #0D0000 100%)",
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40L40 0' stroke='%23DC2626' stroke-width='0.8' stroke-opacity='0.1'/%3E%3C/svg%3E\")",
        }}
      >
        <div className="hero-logo">
          <h1 className="font-bebas tracking-widest leading-none" style={{ fontSize: "clamp(72px,18vw,140px)" }}>
            <span className="text-white">LOBO </span>
            <span style={{ color: YELLOW }}>BURGER</span>
          </h1>
        </div>

        <p className="hero-tagline font-bebas text-2xl md:text-3xl tracking-[0.3em] mt-2" style={{ color: "rgba(255,255,255,0.65)" }}>
          Salvaje de Sabor
        </p>

        <p className="hero-sub text-sm mt-3 max-w-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
          Hamburguesas y salchipapas. Lun-Dom 12pm-11pm. Delivery disponible.
        </p>

        <div className="flex gap-3 mt-8">
          <button
            onClick={() => scrollTo("carta")}
            className="hero-btn-1 px-7 py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all duration-150 hover:brightness-110 active:scale-95 cursor-pointer"
            style={{ background: YELLOW, color: DARK_RED }}
          >
            Ver carta
          </button>
          <button
            onClick={() => scrollTo("promos")}
            className="hero-btn-2 px-7 py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all duration-150 hover:bg-white/10 active:scale-95 cursor-pointer"
            style={{ border: "2px solid rgba(255,255,255,0.4)", color: "#fff" }}
          >
            Promos de hoy
          </button>
        </div>

        <div className="absolute bottom-8 chevron-anim">
          <ChevronDown size={26} style={{ color: "rgba(255,255,255,0.3)" }} />
        </div>
      </section>

      {/* Promos */}
      <section id="promos" style={{ background: "#FFD600" }}>
        <div className="px-4 py-16 max-w-4xl mx-auto">
          <h2 className="font-bebas text-4xl md:text-5xl tracking-widest text-center mb-10" style={{ color: "#0D0000" }}>
            PROMOS DE HOY
          </h2>
          <div ref={promosReveal} className="reveal grid grid-cols-1 md:grid-cols-3 gap-4">
            {promos.map((p, i) => (
              <div
                key={i}
                className="rounded-xl p-6 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-1"
                style={{ background: "#0D0000", border: "1px solid rgba(255,214,0,0.4)" }}
              >
                <p.icon size={22} style={{ color: YELLOW }} />
                <div>
                  <p className="font-bebas text-xl tracking-wider text-white">{p.label}</p>
                  <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Carta */}
      <section id="carta" className="px-4 md:px-8 pb-28 md:pb-16 pt-14 max-w-3xl mx-auto">
        <h2 className="font-bebas text-4xl md:text-5xl tracking-widest text-center mb-8">
          NUESTRA <span style={{ color: YELLOW }}>CARTA</span>
        </h2>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className="shrink-0 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer"
              style={{
                background: active === cat ? YELLOW : "rgba(255,255,255,0.06)",
                color: active === cat ? DARK_RED : "rgba(255,255,255,0.45)",
                border: `1px solid ${active === cat ? YELLOW : "transparent"}`,
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div ref={cartaReveal} className="reveal">
          {active === "Todos" ? (
            Object.entries(grouped).map(([cat, items]) => (
              <div key={cat} className="mb-8">
                <h3
                  className="font-bebas text-2xl tracking-widest mb-4 pb-1"
                  style={{ color: YELLOW, borderBottom: "1px solid rgba(255,214,0,0.15)" }}
                >
                  {cat}
                </h3>
                <div className="flex flex-col gap-3">
                  {items.map(item => <MenuCard key={item.id} item={item} />)}
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map(item => <MenuCard key={item.id} item={item} />)}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 text-center" style={{ background: "#0D0000", borderTop: "1px solid rgba(255,214,0,0.2)" }}>
        <h3 className="font-bebas text-3xl tracking-widest">
          <span className="text-white">LOBO </span>
          <span style={{ color: YELLOW }}>BURGER</span>
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-4 mt-4" style={{ color: "rgba(255,255,255,0.45)" }}>
          <span className="flex items-center gap-1.5 text-sm"><Clock size={13} style={{ color: YELLOW }} />Lun-Dom 12pm-11pm</span>
          <span className="flex items-center gap-1.5 text-sm"><Bike size={13} style={{ color: YELLOW }} />Delivery disponible</span>
          <span className="flex items-center gap-1.5 text-sm"><Phone size={13} style={{ color: YELLOW }} />+51 974 983 862</span>
          <span className="flex items-center gap-1.5 text-sm"><MapPin size={13} style={{ color: YELLOW }} />Piura, Peru</span>
        </div>
        <p className="text-[11px] mt-5" style={{ color: "rgba(255,255,255,0.12)" }}>
          © 2025 Lobo Burger. Todos los derechos reservados.
        </p>
      </footer>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
