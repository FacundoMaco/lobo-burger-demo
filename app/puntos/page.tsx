"use client";

import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/navbar";
import {
  Gift, Crown, Star, Shield, Zap,
  UtensilsCrossed, Percent, Trophy, ArrowRight, Clock,
} from "lucide-react";

const LEVELS = [
  { name: "Cachorro",       min: 0,   max: 99,       color: "#888",    icon: Star   },
  { name: "Lobo",           min: 100, max: 299,      color: "#4a9eed", icon: Shield },
  { name: "Alpha",          min: 300, max: 599,      color: "#DC2626", icon: Zap    },
  { name: "Jefe de Manada", min: 600, max: Infinity, color: "#FFD600", icon: Crown  },
];

const REWARDS = [
  { pts: 50,  title: "Salchipapa Clásica", description: "Gratis con tu próximo pedido",       icon: UtensilsCrossed },
  { pts: 100, title: "–15% en tu pedido",  description: "Descuento directo al total",          icon: Percent         },
  { pts: 200, title: "Combo Lobo Gratis",  description: "Hamburguesa + salchipapa + gaseosa", icon: Gift            },
  { pts: 500, title: "Burgazo Doble Gratis", description: "Nuestra hamburguesa insignia",     icon: Trophy          },
];

export default function PuntosPage() {
  return (
    <div className="min-h-screen" style={{ background: "#0A0A0A", color: "#fff" }}>
      <Navbar />

      {/* Header Teaser */}
      <section className="relative px-6 pt-16 pb-12 text-center overflow-hidden border-b border-neutral-900">
        <div
          className="absolute inset-0 pointer-events-none opacity-15"
          style={{
            background: "radial-gradient(circle at 50% 20%, rgba(255,214,0,0.3) 0%, transparent 70%)",
          }}
        />

        <div className="max-w-xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4" style={{ background: "rgba(255,214,0,0.15)", color: "#FFD600", border: "1px solid rgba(255,214,0,0.3)" }}>
            <Clock size={12} /> Próximamente en todas las sedes
          </div>

          <div className="flex justify-center mb-3">
            <Image
              src="/images/lobo-badge.png"
              alt="Club de la Manada"
              width={76}
              height={76}
              priority
              className="w-20 h-20 rounded-full object-contain shadow-xl"
            />
          </div>

          <h1 className="font-bebas text-4xl md:text-5xl tracking-wider leading-none text-white">
            CLUB DE <span style={{ color: "#FFD600" }}>LA MANADA</span>
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-neutral-400 max-w-md mx-auto">
            Estamos preparando el programa de fidelización de Lobo Burger. Muy pronto acumularás Wolfpoints con cada compra en web o mostrador para canjear premios salvajes.
          </p>

          <div className="mt-6 flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-lg"
              style={{ background: "#FFD600", color: "#000" }}
            >
              Ir a la Carta y Pedir
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* Preview de Niveles */}
      <section className="px-4 py-12 max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="font-bebas text-2xl tracking-widest text-neutral-300">NIVELES DE LA MANADA</h2>
          <p className="text-xs text-neutral-500 mt-1">Sube de rango y desbloquea mayores beneficios</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
          {LEVELS.map(lvl => {
            const Icon = lvl.icon;
            return (
              <div
                key={lvl.name}
                className="rounded-2xl p-4 text-center border"
                style={{ background: "#121212", borderColor: "#1f1f1f" }}
              >
                <div
                  className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: `${lvl.color}18`, color: lvl.color }}
                >
                  <Icon size={20} />
                </div>
                <p className="font-bebas text-lg leading-tight tracking-wider" style={{ color: lvl.color }}>
                  {lvl.name}
                </p>
                <p className="text-[11px] text-neutral-500 font-mono mt-1">
                  {lvl.max === Infinity ? `+${lvl.min} pts` : `${lvl.min}–${lvl.max} pts`}
                </p>
              </div>
            );
          })}
        </div>

        {/* Preview de Premios a Canjear */}
        <div className="text-center mb-6">
          <h2 className="font-bebas text-2xl tracking-widest text-neutral-300">PREMIOS POR PUNTOS</h2>
          <p className="text-xs text-neutral-500 mt-1">Lo que podrás reclamar directamente en caja</p>
        </div>

        <div className="space-y-3">
          {REWARDS.map(r => {
            const Icon = r.icon;
            return (
              <div
                key={r.title}
                className="rounded-xl p-4 flex items-center justify-between border"
                style={{ background: "#121212", borderColor: "#1c1c1c" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-neutral-900 flex items-center justify-center text-neutral-400">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white">{r.title}</p>
                    <p className="text-xs text-neutral-500">{r.description}</p>
                  </div>
                </div>
                <span className="font-bebas text-xl font-bold tracking-wider" style={{ color: "#FFD600" }}>
                  {r.pts} PTS
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
