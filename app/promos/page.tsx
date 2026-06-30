"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Share2, Check, Clock, Calendar, Utensils, Sparkles, Flame, Cake } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type PromoItem = {
  id: number;
  icon: LucideIcon;
  title: string;
  description: string;
  conditions: string;
  vigencia: string;
  time: string;
  status: "ACTIVO" | "PRONTO";
};

const promos: PromoItem[] = [
  {
    id: 1,
    icon: Utensils,
    title: "Martes 2x1 Salchipapas",
    description: "Pide una salchipapa y llevas dos. Todos los martes, sin excepcion.",
    conditions: "Valido martes de 12pm a 8pm. Aplica en Salchipapa Clasica y Lobo. No acumulable.",
    vigencia: "Todos los martes",
    time: "12pm – 8pm",
    status: "ACTIVO",
  },
  {
    id: 2,
    icon: Sparkles,
    title: "Primera Visita -20%",
    description: "Tu primera vez en Lobo Burger tiene que ser memorable. Descuento en todo tu pedido.",
    conditions: "Solo primera visita. Mostrar esta pantalla al pedir. No acumulable con otras promos.",
    vigencia: "Permanente",
    time: "Todo el horario",
    status: "ACTIVO",
  },
  {
    id: 3,
    icon: Flame,
    title: "Combo Lobo a S/20",
    description: "El Combo Lobo completo (hamburguesa + salchipapa + gaseosa) por solo S/20. Solo por web.",
    conditions: "Precio exclusivo para clientes que muestren esta pantalla. Precio regular S/25.",
    vigencia: "Mes de junio",
    time: "Todo el horario",
    status: "ACTIVO",
  },
  {
    id: 4,
    icon: Cake,
    title: "Cumpleanero Come Gratis",
    description: "El dia de tu cumpleanos, tu Lobo Clasica va por cuenta de la casa.",
    conditions: "Presenta tu DNI vigente el dia exacto de tu cumpleanos. Una por persona.",
    vigencia: "Todo el ano",
    time: "Todo el horario",
    status: "PRONTO",
  },
];

export default function PromosPage() {
  const [copied, setCopied] = useState<number | null>(null);

  const handleShare = async (promoId: number) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/promos`);
      setCopied(promoId);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(promoId);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#0D0000" }}>
      <Navbar />

      {/* Header */}
      <section
        className="relative px-6 py-14 text-center overflow-hidden"
        style={{ background: "#FFD600" }}
      >
        <div className="relative z-10">
          <div className="flex justify-center mb-3">
            <Flame size={40} style={{ color: "#0D0000" }} />
          </div>
          <h1 className="font-bebas text-5xl md:text-6xl tracking-widest" style={{ color: "#0D0000" }}>
            PROMOS <span style={{ color: "#DC2626" }}>EXCLUSIVAS</span> WEB
          </h1>
          <p className="mt-2 font-semibold text-sm tracking-widest uppercase" style={{ color: "#7F1D1D" }}>
            Solo disponibles mostrando esta pantalla
          </p>
          <p className="mt-2 text-xs max-w-sm mx-auto" style={{ color: "#A16207" }}>
            Enseña tu celular al pedir y listo. Sin codigos, sin complicaciones.
          </p>
        </div>
      </section>

      {/* Promos grid */}
      <section className="px-4 md:px-8 pb-28 md:pb-16 max-w-2xl mx-auto pt-6">
        <div className="flex flex-col gap-4">
          {promos.map((promo) => {
            const isActive = promo.status === "ACTIVO";
            const PromoIcon = promo.icon;
            return (
              <div
                key={promo.id}
                className="rounded-2xl p-5 relative overflow-hidden"
                style={{
                  background: "#0D0000",
                  border: `1px solid ${isActive ? "rgba(255,214,0,0.4)" : "rgba(255,255,255,0.1)"}`,
                }}
              >
                {/* Accent line */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                  style={{ background: isActive ? "#FFD600" : "#555" }}
                />

                <div className="ml-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
                        style={{ background: isActive ? "rgba(255,214,0,0.12)" : "rgba(255,255,255,0.05)" }}
                      >
                        <PromoIcon size={22} style={{ color: isActive ? "#FFD600" : "#666" }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-white text-base">{promo.title}</h3>
                          {isActive ? (
                            <span
                              className="pulse-red text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: "#16a34a", color: "#fff" }}
                            >
                              ACTIVO
                            </span>
                          ) : (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: "#374151", color: "#9CA3AF" }}
                            >
                              PRONTO
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm mt-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {promo.description}
                  </p>

                  <div className="flex flex-wrap gap-3 mt-3">
                    <div className="flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                      <Calendar size={11} />
                      <span>{promo.vigencia}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                      <Clock size={11} />
                      <span>{promo.time}</span>
                    </div>
                  </div>

                  <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.25)" }}>
                    * {promo.conditions}
                  </p>

                  {isActive && (
                    <button
                      onClick={() => handleShare(promo.id)}
                      className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                      style={{
                        background: copied === promo.id ? "rgba(22,163,74,0.2)" : "#0D0000",
                        color: copied === promo.id ? "#4ade80" : "#FFD600",
                        border: `1px solid ${copied === promo.id ? "rgba(74,222,128,0.3)" : "rgba(255,214,0,0.35)"}`,
                      }}
                    >
                      {copied === promo.id ? (
                        <>
                          <Check size={13} /> Copiado al portapapeles
                        </>
                      ) : (
                        <>
                          <Share2 size={13} /> Compartir promo
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div
          className="mt-8 rounded-xl p-4 text-center"
          style={{ background: "#1A0000", border: "1px solid rgba(255,214,0,0.1)" }}
        >
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            Las promos son validas solo presentando esta pantalla en caja. <br />
            Solo una promo por pedido. Consulta vigencia con nuestro equipo.
          </p>
        </div>
      </section>
    </div>
  );
}
