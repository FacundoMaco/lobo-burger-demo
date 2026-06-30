"use client";

import { useState, useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useCart } from "@/lib/cart-context";
import { Navbar } from "@/components/navbar";
import { UtensilsCrossed, Plus, Check, ChevronDown, Zap, Tag, Star, Phone, Clock, Bike, MapPin } from "lucide-react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const YELLOW = "#FFD600";
const RED = "#0D0000";
const DARK_RED = "#7F1D1D";
const CARD_BG = "#1A0000";

const categories = ["Todos", "Hamburguesas", "Salchipapas", "Bebidas", "Combos"];

const menuItems = [
  { id: 1, category: "Hamburguesas", name: "Lobo Clasica", description: "Carne 180g, lechuga, tomate, cebolla caramelizada y salsa lobo secreta.", price: 18, badge: null as string | null, originalPrice: null as number | null },
  { id: 2, category: "Hamburguesas", name: "Doble Lobo", description: "Doble carne 180g c/u, doble queso cheddar, pepinillos y mostaza artesanal.", price: 24, badge: "POPULAR", originalPrice: null },
  { id: 3, category: "Hamburguesas", name: "BBQ Wolf", description: "Carne 180g, salsa BBQ ahumada, cebolla crispy, queso suizo y jalapeños.", price: 22, badge: null, originalPrice: null },
  { id: 4, category: "Hamburguesas", name: "Crispy Wolf", description: "Pollo apanado crocante, salsa honey mustard, repollo morado y tomate.", price: 20, badge: null, originalPrice: null },
  { id: 5, category: "Hamburguesas", name: "La Bestia", description: "Doble carne 200g, bacon crujiente, huevo frito, doble queso y salsa especial.", price: 28, badge: "BESTSELLER", originalPrice: null },
  { id: 6, category: "Salchipapas", name: "Salchipapa Clasica", description: "Papas fritas golden, salchicha premium, ketchup y mayonesa.", price: 10, badge: null, originalPrice: null },
  { id: 7, category: "Salchipapas", name: "Salchipapa Lobo", description: "Papas fritas, chorizo artesanal, queso derretido y salsa lobo.", price: 14, badge: "ESPECIAL", originalPrice: null },
  { id: 8, category: "Salchipapas", name: "Salchipapa XL", description: "Porcion XL de papas, salchicha doble, tres salsas a eleccion y toppings.", price: 16, badge: null, originalPrice: null },
  { id: 9, category: "Salchipapas", name: "Salchipapa Mixta", description: "Papas, chorizo + salchicha, queso fundido, bacon bits y cebolla verde.", price: 18, badge: "NUEVO", originalPrice: null },
  { id: 10, category: "Bebidas", name: "Gaseosa", description: "Coca-Cola, Sprite, Fanta — fria y bien servida.", price: 5, badge: null, originalPrice: null },
  { id: 11, category: "Bebidas", name: "Limonada", description: "Limonada natural frozen con menta y azucar de cana.", price: 7, badge: null, originalPrice: null },
  { id: 12, category: "Bebidas", name: "Jugo Natural", description: "Maracuya, mango o naranja. Siempre del dia.", price: 8, badge: null, originalPrice: null },
  { id: 13, category: "Combos", name: "Combo Lobo", description: "Hamburguesa Lobo Clasica + Salchipapa Clasica + Gaseosa.", price: 25, badge: "AHORRA S/8", originalPrice: 33 },
  { id: 14, category: "Combos", name: "Combo Bestia", description: "La Bestia + Salchipapa XL + Jugo Natural. Para los que no se guardan nada.", price: 38, badge: "AHORRA S/13", originalPrice: 51 },
];

const promos = [
  { label: "Martes 2x1 Salchipapas", desc: "Valido de 12pm a 8pm los martes.", icon: Zap },
  { label: "Combo Lobo S/25", desc: "Precio normal S/33. Ahorras S/8.", icon: Tag },
  { label: "Primera visita -20%", desc: "Muéstrale esta pantalla al cajero.", icon: Star },
];

function ItemBadge({ text }: { text: string }) {
  const isPromo = text.startsWith("AHORRA");
  const bg = text === "BESTSELLER" ? RED : isPromo ? YELLOW : text === "POPULAR" ? "#1a5276" : text === "NUEVO" ? "#1e8449" : "#555";
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
      className="menu-card rounded-xl p-4 flex items-start gap-3 transition-all"
      style={{ background: CARD_BG, border: `1px solid rgba(255,214,0,${inCart ? "0.5" : "0.1"})` }}
    >
      <div className="shrink-0 w-16 h-16 rounded-lg flex items-center justify-center" style={{ background: DARK_RED }}>
        <UtensilsCrossed size={24} style={{ color: YELLOW, opacity: 0.6 }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-bold text-white text-sm leading-tight">{item.name}</span>
          {item.badge && <ItemBadge text={item.badge} />}
        </div>
        <p className="text-xs leading-relaxed mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>
          {item.description}
        </p>
        <div className="flex items-center justify-between">
          <div>
            <span className="font-bebas text-2xl leading-none" style={{ color: YELLOW }}>S/{item.price}</span>
            {item.originalPrice && (
              <span className="text-xs line-through ml-2" style={{ color: "rgba(255,255,255,0.3)" }}>S/{item.originalPrice}</span>
            )}
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
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
  const heroRef = useRef<HTMLElement>(null);
  const promosRef = useRef<HTMLElement>(null);
  const cartaRef = useRef<HTMLElement>(null);
  const chevronRef = useRef<HTMLDivElement>(null);

  const filtered = menuItems.filter(i => active === "Todos" || i.category === active);
  const grouped: Record<string, typeof menuItems> = {};
  if (active === "Todos") {
    for (const item of filtered) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }
  }

  // Hero GSAP animation
  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(".hero-logo", { y: 60, opacity: 0, duration: 0.8 })
      .from(".hero-tagline", { y: 30, opacity: 0, duration: 0.6 }, "-=0.4")
      .from(".hero-sub", { y: 20, opacity: 0, duration: 0.5 }, "-=0.3")
      .from(".hero-btn", { y: 20, opacity: 0, duration: 0.5, stagger: 0.1 }, "-=0.2");

    // Chevron yoyo
    if (chevronRef.current) {
      gsap.to(chevronRef.current, { y: 8, duration: 0.8, ease: "power1.inOut", yoyo: true, repeat: -1 });
    }
  }, { scope: heroRef });

  // Promos ScrollTrigger
  useGSAP(() => {
    gsap.from(".promo-card", {
      y: 40,
      opacity: 0,
      duration: 0.6,
      stagger: 0.15,
      ease: "power2.out",
      scrollTrigger: {
        trigger: promosRef.current,
        start: "top 80%",
        once: true,
      },
    });
  }, { scope: promosRef });

  // Carta ScrollTrigger
  useGSAP(() => {
    gsap.from(".menu-card", {
      y: 30,
      opacity: 0,
      duration: 0.5,
      stagger: 0.07,
      ease: "power2.out",
      scrollTrigger: {
        trigger: cartaRef.current,
        start: "top 75%",
        once: true,
      },
    });
  }, { scope: cartaRef });

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen" style={{ background: "#0D0000" }}>
      <Navbar />

      {/* Hero */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex flex-col items-center justify-center px-4 text-center"
        style={{
          background: `linear-gradient(135deg, #0D0000 0%, #3B0000 60%, #0D0000 100%)`,
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40L40 0' stroke='%23DC2626' stroke-width='0.8' stroke-opacity='0.12'/%3E%3C/svg%3E\")",
        }}
      >
        <div className="hero-logo">
          <h1
            className="font-bebas tracking-widest leading-none"
            style={{ fontSize: "clamp(72px,18vw,140px)" }}
          >
            <span className="text-white">LOBO </span>
            <span style={{ color: YELLOW }}>BURGER</span>
          </h1>
        </div>

        <p className="hero-tagline font-bebas text-3xl md:text-4xl tracking-[0.3em] mt-2" style={{ color: "rgba(255,255,255,0.7)" }}>
          Salvaje de Sabor
        </p>

        <p className="hero-sub text-sm mt-3 max-w-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
          Hamburguesas y salchipapas. Lun-Dom 12pm-11pm. Delivery disponible.
        </p>

        <div className="flex gap-3 mt-8">
          <button
            onClick={() => scrollTo("carta")}
            className="hero-btn px-8 py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all hover:brightness-110 active:scale-95"
            style={{ background: YELLOW, color: DARK_RED }}
          >
            Ver carta
          </button>
          <button
            onClick={() => scrollTo("promos")}
            className="hero-btn px-8 py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all hover:bg-white/10 active:scale-95"
            style={{ border: `2px solid rgba(255,255,255,0.5)`, color: "#fff" }}
          >
            Promos de hoy
          </button>
        </div>

        <div ref={chevronRef} className="absolute bottom-8">
          <ChevronDown size={28} style={{ color: "rgba(255,255,255,0.35)" }} />
        </div>
      </section>

      {/* Promos */}
      <section id="promos" ref={promosRef} style={{ background: "#FFD600" }}>
        <div className="px-4 py-16 max-w-4xl mx-auto">
          <h2 className="font-bebas text-4xl md:text-5xl tracking-widest text-center mb-10" style={{ color: "#0D0000" }}>
            PROMOS DE HOY
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {promos.map((p, i) => (
              <div
                key={i}
                className="promo-card rounded-xl p-6 flex flex-col gap-3"
                style={{ background: "#0D0000", border: `1px solid rgba(255,214,0,0.5)` }}
              >
                <p.icon size={24} style={{ color: YELLOW }} />
                <div>
                  <p className="font-bebas text-xl tracking-wider text-white">{p.label}</p>
                  <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Carta */}
      <section id="carta" ref={cartaRef} className="px-4 md:px-8 pb-28 md:pb-16 max-w-3xl mx-auto">
        <h2 className="font-bebas text-4xl md:text-5xl tracking-widest text-center mb-8">
          NUESTRA <span style={{ color: YELLOW }}>CARTA</span>
        </h2>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className="shrink-0 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
              style={{
                background: active === cat ? YELLOW : "rgba(0,0,0,0.25)",
                color: active === cat ? DARK_RED : "rgba(255,255,255,0.5)",
                border: `1px solid ${active === cat ? YELLOW : "transparent"}`,
              }}
            >
              {cat}
            </button>
          ))}
        </div>

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
      </section>

      {/* Footer */}
      <footer
        className="px-6 py-10 text-center"
        style={{ background: "#0D0000", borderTop: "1px solid rgba(255,214,0,0.3)" }}
      >
        <h3 className="font-bebas text-3xl tracking-widest">
          <span className="text-white">LOBO </span>
          <span style={{ color: YELLOW }}>BURGER</span>
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-4 mt-4" style={{ color: "rgba(255,255,255,0.5)" }}>
          <div className="flex items-center gap-1.5 text-sm">
            <Clock size={14} style={{ color: YELLOW }} />
            <span>Lun-Dom 12pm-11pm</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Bike size={14} style={{ color: YELLOW }} />
            <span>Delivery disponible</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Phone size={14} style={{ color: YELLOW }} />
            <span>+51 974 983 862</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <MapPin size={14} style={{ color: YELLOW }} />
            <span>Piura, Peru</span>
          </div>
        </div>
        <p className="text-[11px] mt-5" style={{ color: "rgba(255,255,255,0.15)" }}>© 2025 Lobo Burger. Todos los derechos reservados.</p>
      </footer>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
