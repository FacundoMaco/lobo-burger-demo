"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Trophy, Gift, ChevronRight, X, ShoppingBag } from "lucide-react";

const LEVELS = [
  { name: "Cachorro", min: 0, max: 99, color: "#888", emoji: "🐶" },
  { name: "Lobo", min: 100, max: 299, color: "#4a9eed", emoji: "🐺" },
  { name: "Alpha", min: 300, max: 599, color: "#C0392B", emoji: "🔴" },
  { name: "Jefe de Manada", min: 600, max: Infinity, color: "#F39C12", emoji: "👑" },
];

const rewards = [
  {
    id: 1,
    pts: 50,
    title: "Salchipapa Clásica",
    description: "Gratis con tu próximo pedido",
    emoji: "🍟",
  },
  {
    id: 2,
    pts: 100,
    title: "–15% en tu pedido",
    description: "Descuento directo al total",
    emoji: "💸",
  },
  {
    id: 3,
    pts: 200,
    title: "Combo Lobo Gratis",
    description: "Hamburguesa + salchipapa + gaseosa",
    emoji: "🎁",
  },
  {
    id: 4,
    pts: 500,
    title: "La Bestia Gratis",
    description: "La más salvaje, sin costo",
    emoji: "🏆",
  },
];

function getLevel(pts: number) {
  return LEVELS.find((l) => pts >= l.min && pts <= l.max) ?? LEVELS[0];
}

function getNextLevel(pts: number) {
  const idx = LEVELS.findIndex((l) => pts >= l.min && pts <= l.max);
  return LEVELS[idx + 1] ?? null;
}

export default function PuntosPage() {
  const [points, setPoints] = useState(340);
  const [monto, setMonto] = useState("");
  const [redeemed, setRedeemed] = useState<{ title: string; code: string } | null>(null);
  const [confirmReward, setConfirmReward] = useState<(typeof rewards)[0] | null>(null);
  const [addedMsg, setAddedMsg] = useState("");

  const level = getLevel(points);
  const next = getNextLevel(points);
  const progressPct = next
    ? Math.round(((points - level.min) / (next.min - level.min)) * 100)
    : 100;

  const handleAddPoints = () => {
    const val = parseInt(monto);
    if (!val || val <= 0) return;
    setPoints((p) => p + val);
    setAddedMsg(`+${val} Wolfpoints sumados`);
    setMonto("");
    setTimeout(() => setAddedMsg(""), 2500);
  };

  const handleRedeem = (reward: (typeof rewards)[0]) => {
    if (points < reward.pts) return;
    setConfirmReward(reward);
  };

  const confirmRedeem = () => {
    if (!confirmReward) return;
    setPoints((p) => p - confirmReward.pts);
    const code = `LOBO-${Math.floor(1000 + Math.random() * 9000)}`;
    setRedeemed({ title: confirmReward.title, code });
    setConfirmReward(null);
  };

  return (
    <div className="min-h-screen pb-28 md:pb-16" style={{ background: "#0A0A0A" }}>
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 pt-8">
        {/* Wallet Card */}
        <div
          className="rounded-2xl p-6 mb-6 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #1a0a0a 0%, #2a0a0a 50%, #1a0a0a 100%)",
            border: "1px solid rgba(192,57,43,0.4)",
            boxShadow: "0 0 40px rgba(192,57,43,0.08)",
          }}
        >
          {/* Pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "repeating-linear-gradient(45deg, #F39C12 0, #F39C12 1px, transparent 0, transparent 30px)",
            }}
          />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: "#555" }}>
                  Tu saldo
                </p>
                <div className="flex items-end gap-2 mt-1">
                  <span className="font-bebas text-6xl leading-none" style={{ color: "#F39C12" }}>
                    {points}
                  </span>
                  <span className="text-sm font-bold mb-2" style={{ color: "#F39C12" }}>
                    Wolfpoints
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-3xl">{level.emoji}</span>
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: level.color, color: "#fff" }}
                >
                  {level.name}
                </span>
              </div>
            </div>

            {/* Progress */}
            {next && (
              <div>
                <div className="flex justify-between text-[11px] mb-1" style={{ color: "#555" }}>
                  <span>{level.name}</span>
                  <span>
                    {next.min - points} pts para {next.emoji} {next.name}
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "#1f1f1f" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progressPct}%`,
                      background: "linear-gradient(90deg, #C0392B, #F39C12)",
                    }}
                  />
                </div>
              </div>
            )}

            {!next && (
              <p className="text-xs mt-2" style={{ color: "#F39C12" }}>
                👑 Eres Jefe de Manada — el nivel máximo
              </p>
            )}

            <p className="text-[11px] mt-3" style={{ color: "#444" }}>
              Carlos M. • Miembro desde enero 2024
            </p>
          </div>
        </div>

        {/* Cómo ganar */}
        <div
          className="rounded-xl p-4 mb-6 flex items-center gap-3"
          style={{ background: "#141414", border: "1px solid #1f1f1f" }}
        >
          <Trophy size={20} style={{ color: "#F39C12" }} />
          <div>
            <p className="text-sm font-bold text-white">¿Cómo ganar Wolfpoints?</p>
            <p className="text-xs mt-0.5" style={{ color: "#666" }}>
              Cada <span style={{ color: "#F39C12" }}>S/1 gastado = 1 Wolfpoint</span>. Se acumulan en cada visita.
            </p>
          </div>
        </div>

        {/* Registrar compra */}
        <div
          className="rounded-xl p-4 mb-6"
          style={{ background: "#141414", border: "1px solid rgba(192,57,43,0.2)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag size={16} style={{ color: "#C0392B" }} />
            <p className="text-sm font-bold text-white">Registrar compra</p>
          </div>
          <p className="text-xs mb-3" style={{ color: "#555" }}>
            Ingresa el monto de tu pedido para sumar tus puntos
          </p>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold"
                style={{ color: "#666" }}
              >
                S/
              </span>
              <input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg py-3 pl-8 pr-3 text-sm font-bold text-white outline-none"
                style={{ background: "#0F0F0F", border: "1px solid #252525" }}
                min={1}
              />
            </div>
            <button
              onClick={handleAddPoints}
              disabled={!monto || parseInt(monto) <= 0}
              className="px-5 py-3 rounded-lg text-sm font-bold transition-all hover:opacity-80 disabled:opacity-30"
              style={{ background: "#C0392B", color: "#fff" }}
            >
              Sumar
            </button>
          </div>
          {addedMsg && (
            <p className="text-xs mt-2 font-semibold" style={{ color: "#2ecc71" }}>
              ✓ {addedMsg}
            </p>
          )}
        </div>

        {/* Recompensas */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Gift size={16} style={{ color: "#F39C12" }} />
            <h2 className="font-bebas text-2xl tracking-widest">
              RECOMPENSAS <span style={{ color: "#C0392B" }}>CANJEABLES</span>
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            {rewards.map((r) => {
              const canRedeem = points >= r.pts;
              return (
                <div
                  key={r.id}
                  className="rounded-xl p-4 flex items-center gap-4"
                  style={{
                    background: "#141414",
                    border: `1px solid ${canRedeem ? "rgba(192,57,43,0.3)" : "#1a1a1a"}`,
                    opacity: canRedeem ? 1 : 0.5,
                  }}
                >
                  <span className="text-2xl">{r.emoji}</span>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-white">{r.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#555" }}>{r.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="font-bebas text-lg leading-none" style={{ color: "#F39C12" }}>
                      {r.pts} pts
                    </span>
                    <button
                      onClick={() => handleRedeem(r)}
                      disabled={!canRedeem}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: canRedeem ? "#C0392B" : "#333", color: "#fff" }}
                    >
                      Canjear <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Niveles */}
        <div className="rounded-xl p-4" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
          <h3 className="font-bebas text-xl tracking-widest mb-3 text-white">NIVELES DE LA MANADA</h3>
          <div className="flex flex-col gap-2">
            {LEVELS.map((l) => (
              <div key={l.name} className="flex items-center gap-3">
                <span className="text-lg w-7">{l.emoji}</span>
                <div className="flex-1">
                  <span className="text-sm font-bold" style={{ color: l.color }}>{l.name}</span>
                </div>
                <span className="text-xs" style={{ color: "#444" }}>
                  {l.max === Infinity ? `${l.min}+ pts` : `${l.min}–${l.max} pts`}
                </span>
                {points >= l.min && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: l.color, color: "#fff" }}>
                    TÚ
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {confirmReward && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "#141414", border: "1px solid rgba(192,57,43,0.4)" }}
          >
            <h3 className="font-bebas text-2xl tracking-widest mb-1">¿CONFIRMAR CANJE?</h3>
            <p className="text-sm mb-4" style={{ color: "#888" }}>
              Vas a canjear <span className="text-white font-bold">{confirmReward.title}</span> por{" "}
              <span style={{ color: "#F39C12" }} className="font-bold">{confirmReward.pts} Wolfpoints</span>.
            </p>
            <p className="text-xs mb-5" style={{ color: "#555" }}>
              Te quedarán <strong style={{ color: "#fff" }}>{points - confirmReward.pts} pts</strong> después del canje.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmReward(null)}
                className="flex-1 py-3 rounded-lg text-sm font-bold"
                style={{ background: "#1f1f1f", color: "#888" }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmRedeem}
                className="flex-1 py-3 rounded-lg text-sm font-bold"
                style={{ background: "#C0392B", color: "#fff" }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal with fake QR */}
      {redeemed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.9)" }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 text-center"
            style={{ background: "#141414", border: "1px solid rgba(243,156,18,0.4)" }}
          >
            <button
              onClick={() => setRedeemed(null)}
              className="absolute top-4 right-4 p-1"
              style={{ color: "#555" }}
            >
              <X size={20} />
            </button>

            <div className="text-4xl mb-3">🎉</div>
            <h3 className="font-bebas text-2xl tracking-widest mb-1">
              ¡CANJE <span style={{ color: "#F39C12" }}>EXITOSO</span>!
            </h3>
            <p className="text-sm mb-5" style={{ color: "#888" }}>
              {redeemed.title}
            </p>

            {/* Fake QR */}
            <div
              className="mx-auto mb-4 rounded-xl p-4 flex flex-col items-center gap-3"
              style={{ background: "#fff", width: 160, height: 160 }}
            >
              <div className="grid grid-cols-5 gap-1">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded-sm"
                    style={{
                      background: [0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24,6,7,8,11,12,13,16,17,18].includes(i)
                        ? (Math.random() > 0.4 ? "#000" : "#fff")
                        : "#fff",
                    }}
                  />
                ))}
              </div>
            </div>

            <div
              className="rounded-lg py-3 px-4 mb-4"
              style={{ background: "#0A0A0A", border: "1px solid rgba(243,156,18,0.3)" }}
            >
              <p className="text-xs" style={{ color: "#555" }}>Código de canje</p>
              <p className="font-bebas text-2xl tracking-widest mt-1" style={{ color: "#F39C12" }}>
                {redeemed.code}
              </p>
            </div>

            <p className="text-xs mb-5" style={{ color: "#555" }}>
              Muestra este código en caja para reclamar tu recompensa
            </p>

            <button
              onClick={() => setRedeemed(null)}
              className="w-full py-3 rounded-lg text-sm font-bold"
              style={{ background: "#C0392B", color: "#fff" }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
