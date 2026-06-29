"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Share2, Check, Clock, Calendar } from "lucide-react";

const promos = [
  {
    id: 1,
    emoji: "🍟",
    title: "Martes 2x1 Salchipapas",
    description: "Pide una salchipapa y llevas dos. Todos los martes, sin excepción.",
    conditions: "Válido martes de 12pm a 8pm. Aplica en Salchipapa Clásica y Lobo. No acumulable.",
    vigencia: "Todos los martes",
    time: "12pm – 8pm",
    status: "ACTIVO",
    color: "#C0392B",
  },
  {
    id: 2,
    emoji: "🎉",
    title: "Primera Visita –20%",
    description: "Tu primera vez en Lobo Burger tiene que ser memorable. Descuento en todo tu pedido.",
    conditions: "Solo primera visita. Mostrar esta pantalla al pedir. No acumulable con otras promos.",
    vigencia: "Permanente",
    time: "Todo el horario",
    status: "ACTIVO",
    color: "#C0392B",
  },
  {
    id: 3,
    emoji: "🔥",
    title: "Combo Lobo a S/20",
    description: "El Combo Lobo completo (hamburguesa + salchipapa + gaseosa) por solo S/20. Solo por web.",
    conditions: "Precio exclusivo para clientes que muestren esta pantalla. Precio regular S/25.",
    vigencia: "Mes de junio",
    time: "Todo el horario",
    status: "ACTIVO",
    color: "#C0392B",
  },
  {
    id: 4,
    emoji: "🎂",
    title: "Cumpleañero Come Gratis",
    description: "El día de tu cumpleaños, tu Lobo Clásica va por cuenta de la casa.",
    conditions: "Presenta tu DNI vigente el día exacto de tu cumpleaños. Una por persona.",
    vigencia: "Todo el año",
    time: "Todo el horario",
    status: "PRONTO",
    color: "#F39C12",
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
    <div className="min-h-screen" style={{ background: "#0A0A0A" }}>
      <Navbar />

      {/* Header */}
      <section
        className="relative px-6 py-14 text-center overflow-hidden"
        style={{ background: "linear-gradient(180deg, #1c0505 0%, #0A0A0A 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, #C0392B 0, #C0392B 1px, transparent 0, transparent 30px)",
          }}
        />
        <div className="relative z-10">
          <div className="text-4xl mb-3">🔥</div>
          <h1 className="font-bebas text-5xl md:text-6xl tracking-widest">
            PROMOS <span style={{ color: "#C0392B" }}>EXCLUSIVAS</span>
          </h1>
          <p className="mt-2 font-semibold text-sm tracking-widest uppercase" style={{ color: "#F39C12" }}>
            Solo disponibles mostrando esta pantalla
          </p>
          <p className="mt-2 text-xs max-w-sm mx-auto" style={{ color: "#555" }}>
            Enseña tu celular al pedir y listo. Sin códigos, sin complicaciones.
          </p>
        </div>
      </section>

      {/* Promos grid */}
      <section className="px-4 md:px-8 pb-28 md:pb-16 max-w-2xl mx-auto">
        <div className="flex flex-col gap-4">
          {promos.map((promo) => {
            const isActive = promo.status === "ACTIVO";
            return (
              <div
                key={promo.id}
                className="rounded-2xl p-5 relative overflow-hidden"
                style={{
                  background: "#141414",
                  border: `1px solid ${isActive ? "rgba(192,57,43,0.35)" : "rgba(243,156,18,0.25)"}`,
                }}
              >
                {/* Accent line */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                  style={{ background: promo.color }}
                />

                <div className="ml-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{promo.emoji}</span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-white text-base">{promo.title}</h3>
                          {isActive ? (
                            <span
                              className="pulse-red text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: "#C0392B", color: "#fff" }}
                            >
                              ACTIVO
                            </span>
                          ) : (
                            <span
                              className="pulse-yellow text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: "#F39C12", color: "#0A0A0A" }}
                            >
                              PRONTO
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm mt-3 leading-relaxed" style={{ color: "#BBB" }}>
                    {promo.description}
                  </p>

                  <div className="flex flex-wrap gap-3 mt-3">
                    <div className="flex items-center gap-1 text-xs" style={{ color: "#666" }}>
                      <Calendar size={11} />
                      <span>{promo.vigencia}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs" style={{ color: "#666" }}>
                      <Clock size={11} />
                      <span>{promo.time}</span>
                    </div>
                  </div>

                  <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "#444" }}>
                    * {promo.conditions}
                  </p>

                  {isActive && (
                    <button
                      onClick={() => handleShare(promo.id)}
                      className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                      style={{
                        background: copied === promo.id ? "rgba(30,132,73,0.2)" : "rgba(192,57,43,0.15)",
                        color: copied === promo.id ? "#2ecc71" : "#C0392B",
                        border: `1px solid ${copied === promo.id ? "rgba(46,204,113,0.3)" : "rgba(192,57,43,0.3)"}`,
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
          style={{ background: "#111", border: "1px solid #1f1f1f" }}
        >
          <p className="text-xs" style={{ color: "#555" }}>
            Las promos son válidas solo presentando esta pantalla en caja. <br />
            Solo una promo por pedido. Consulta vigencia con nuestro equipo.
          </p>
        </div>
      </section>
    </div>
  );
}
