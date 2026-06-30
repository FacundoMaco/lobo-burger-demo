"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import {
  Gift, Phone, Crown, Star, Shield, Zap, Check, X, Sparkles,
  UtensilsCrossed, Percent, Trophy, ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Stage = "email" | "phone" | "join" | "dashboard";

type HistoryEntry = { date: string; desc: string; pts: number };
type Member = {
  name: string;
  email: string;
  phone: string;
  points: number;
  joinedAt: string;
  history: HistoryEntry[];
};

const LEVELS: { name: string; min: number; max: number; color: string; icon: LucideIcon }[] = [
  { name: "Cachorro",       min: 0,   max: 99,      color: "#888",    icon: Star   },
  { name: "Lobo",           min: 100, max: 299,      color: "#4a9eed", icon: Shield },
  { name: "Alpha",          min: 300, max: 599,      color: "#DC2626", icon: Zap    },
  { name: "Jefe de Manada", min: 600, max: Infinity, color: "#FFD600", icon: Crown  },
];

const REWARDS = [
  { id: 1, pts: 50,  title: "Salchipapa Clásica", description: "Gratis con tu próximo pedido",       icon: UtensilsCrossed },
  { id: 2, pts: 100, title: "–15% en tu pedido",  description: "Descuento directo al total",          icon: Percent         },
  { id: 3, pts: 200, title: "Combo Lobo Gratis",  description: "Hamburguesa + salchipapa + gaseosa", icon: Gift            },
  { id: 4, pts: 500, title: "La Bestia Gratis",   description: "La más salvaje, sin costo",           icon: Trophy          },
];

function getLevel(pts: number) {
  return LEVELS.find((l) => pts >= l.min && pts <= l.max) ?? LEVELS[0];
}

function getNextLevel(pts: number) {
  const idx = LEVELS.findIndex((l) => pts >= l.min && pts <= l.max);
  return LEVELS[idx + 1] ?? null;
}

function genCode() {
  const letters = Array.from({ length: 4 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join("");
  return `WP-${letters}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function readMember(): Member | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("lobo_member");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeMember(m: Member) {
  localStorage.setItem("lobo_member", JSON.stringify(m));
}

const STEPS = [
  { key: "email", label: "Email"     },
  { key: "phone", label: "Celular"   },
  { key: "join",  label: "La Manada" },
];
const stageIdx: Record<Stage, number> = { email: 0, phone: 1, join: 2, dashboard: 3 };

function Stepper({ stage }: { stage: Stage }) {
  const cur = stageIdx[stage];
  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((s, i) => {
        const done   = i < cur;
        const active = i === cur;
        return (
          <div key={s.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: done ? "#1a4a1a" : active ? "#FFD600" : "#1a1a1a",
                  color:      done ? "#2ecc71" : active ? "#0D0000" : "#444",
                  border: `1px solid ${done ? "#2ecc71" : active ? "#FFD600" : "#333"}`,
                }}
              >
                {done ? <Check size={12} /> : i + 1}
              </div>
              <span className="text-[10px] font-semibold" style={{ color: done ? "#2ecc71" : active ? "#FFD600" : "#444" }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="w-10 h-px mb-5" style={{ background: i < cur ? "#2ecc71" : "#252525" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const INPUT_STYLE = { background: "#0D0000", border: "1px solid #2a0000" } as const;
const CARD_BASE   = { background: "#150000", border: "1px solid rgba(220,38,38,0.2)" } as const;

export default function PuntosPage() {
  const [stage, setStage]               = useState<Stage>("email");
  const [email, setEmail]               = useState("");
  const [phone, setPhone]               = useState("");
  const [name,  setName]                = useState("");
  const [member, setMember]             = useState<Member | null>(null);
  const [showCode, setShowCode]         = useState<string | null>(null);
  const [confirmReward, setConfirmReward] = useState<(typeof REWARDS)[0] | null>(null);
  const [redeemResult, setRedeemResult] = useState<{ code: string; title: string } | null>(null);

  useEffect(() => {
    const m = readMember();
    if (m) { setMember(m); setStage("dashboard"); return; }
    const e = localStorage.getItem("lobo_email") || "";
    const p = localStorage.getItem("lobo_phone") || "";
    if (e) {
      setEmail(e);
      if (p) { setPhone(p); setStage("join"); }
      else    { setStage("phone"); }
    }
  }, []);

  const submitEmail = () => {
    if (!email.includes("@")) return;
    localStorage.setItem("lobo_email", email);
    setShowCode("LOBO15-EMAIL");
    setTimeout(() => { setShowCode(null); setStage("phone"); }, 1800);
  };

  const submitPhone = () => {
    if (phone.length < 9) return;
    localStorage.setItem("lobo_phone", phone);
    setShowCode("LOBO15-CEL");
    setTimeout(() => { setShowCode(null); setStage("join"); }, 1800);
  };

  const submitJoin = () => {
    if (!name.trim()) return;
    const m: Member = { name: name.trim(), email, phone, points: 0, joinedAt: new Date().toISOString(), history: [] };
    writeMember(m);
    setMember(m);
    setStage("dashboard");
  };

  const handleRedeem = (r: (typeof REWARDS)[0]) => {
    if (!member || member.points < r.pts) return;
    setConfirmReward(r);
  };

  const confirmRedeem = () => {
    if (!confirmReward || !member) return;
    const code = genCode();
    const list = JSON.parse(localStorage.getItem("lobo_redemptions") || "[]");
    list.push({
      code,
      rewardName: confirmReward.title,
      rewardPts:  confirmReward.pts,
      createdAt:  new Date().toISOString(),
      usedAt:     null,
      clientPhone: member.phone,
      clientName:  member.name,
    });
    localStorage.setItem("lobo_redemptions", JSON.stringify(list));
    setConfirmReward(null);
    setRedeemResult({ code, title: confirmReward.title });
  };

  const pts   = member?.points ?? 0;
  const level = getLevel(pts);
  const next  = getNextLevel(pts);
  const pct   = next ? Math.round(((pts - level.min) / (next.min - level.min)) * 100) : 100;

  return (
    <div className="min-h-screen pb-28 md:pb-16" style={{ background: "#0D0000" }}>
      <Navbar />

      <div className="max-w-md mx-auto px-4 pt-8">
        {stage !== "dashboard" && <Stepper stage={stage} />}

        {/* ── ETAPA 1: Email ── */}
        {stage === "email" && (
          <div className="rounded-2xl p-7" style={CARD_BASE}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ background: "rgba(255,214,0,0.1)" }}>
              <Gift size={24} style={{ color: "#FFD600" }} />
            </div>
            <h2 className="font-bebas text-3xl tracking-widest mb-1">OBTÉN 15% DE DESCUENTO</h2>
            <p className="text-sm mb-6" style={{ color: "#888" }}>en tu próximo pedido</p>

            {showCode ? (
              <div className="rounded-xl p-4 text-center" style={{ background: "rgba(46,204,113,0.08)", border: "1px solid rgba(46,204,113,0.3)" }}>
                <p className="text-xs font-semibold mb-1" style={{ color: "#2ecc71" }}>Tu código de descuento</p>
                <p className="font-bebas text-3xl tracking-widest" style={{ color: "#2ecc71" }}>{showCode}</p>
                <p className="text-xs mt-2" style={{ color: "#666" }}>Muéstrale este código al cajero al pagar</p>
              </div>
            ) : (
              <>
                <p className="text-xs mb-2" style={{ color: "#666" }}>Solo necesitamos tu correo</p>
                <input
                  type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitEmail()}
                  placeholder="tu@correo.com"
                  className="w-full rounded-xl py-3 px-4 text-sm text-white outline-none mb-3"
                  style={INPUT_STYLE}
                />
                <button
                  onClick={submitEmail} disabled={!email.includes("@")}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-80 disabled:opacity-30"
                  style={{ background: "#DC2626", color: "#fff" }}
                >
                  Quiero mi descuento
                </button>
                <p className="text-center text-xs mt-4" style={{ color: "#444" }}>Sin spam. Sin cuentas.</p>
              </>
            )}
          </div>
        )}

        {/* ── ETAPA 2: Celular ── */}
        {stage === "phone" && (
          <div className="rounded-2xl p-7" style={CARD_BASE}>
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-5 text-xs font-bold"
              style={{ background: "rgba(46,204,113,0.12)", color: "#2ecc71", border: "1px solid rgba(46,204,113,0.3)" }}
            >
              <Check size={11} /> Código: LOBO15-EMAIL
            </div>

            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ background: "rgba(255,214,0,0.1)" }}>
              <Phone size={24} style={{ color: "#FFD600" }} />
            </div>
            <h2 className="font-bebas text-3xl tracking-widest mb-1">OBTÉN OTRO 15%</h2>
            <p className="text-sm mb-6" style={{ color: "#888" }}>Agrega tu celular</p>

            {showCode ? (
              <div className="rounded-xl p-4 text-center" style={{ background: "rgba(46,204,113,0.08)", border: "1px solid rgba(46,204,113,0.3)" }}>
                <p className="text-xs font-semibold mb-1" style={{ color: "#2ecc71" }}>Tu código de descuento</p>
                <p className="font-bebas text-3xl tracking-widest" style={{ color: "#2ecc71" }}>{showCode}</p>
                <p className="text-xs mt-2" style={{ color: "#666" }}>Muéstrale este código al cajero al pagar</p>
              </div>
            ) : (
              <>
                <input
                  type="tel" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitPhone()}
                  placeholder="9XXXXXXXX"
                  className="w-full rounded-xl py-3 px-4 text-sm text-white outline-none mb-3"
                  style={INPUT_STYLE}
                />
                <button
                  onClick={submitPhone} disabled={phone.length < 9}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-80 disabled:opacity-30"
                  style={{ background: "#DC2626", color: "#fff" }}
                >
                  Agregar celular
                </button>
                <button
                  onClick={() => setStage("join")}
                  className="w-full py-3 text-xs font-semibold mt-1 transition-all hover:opacity-70"
                  style={{ color: "#555" }}
                >
                  Prefiero saltar esto
                </button>
              </>
            )}
          </div>
        )}

        {/* ── ETAPA 3: Únete a La Manada ── */}
        {stage === "join" && (
          <div className="rounded-2xl p-7" style={{ background: "#150000", border: "1px solid rgba(255,214,0,0.15)" }}>
            <div className="flex items-center gap-2 mb-5">
              <Crown size={20} style={{ color: "#FFD600" }} />
              <h2 className="font-bebas text-2xl tracking-widest" style={{ color: "#FFD600" }}>ÚNETE A LA MANADA</h2>
            </div>
            <p className="text-sm mb-5" style={{ color: "#888" }}>
              Acumula Wolfpoints en cada pedido. Canjea hamburguesas, salchipapas y más.
            </p>
            <div className="flex flex-col gap-2 mb-6">
              {["Wolfpoints en cada pedido", "Ofertas exclusivas", "Cumpleaños gratis"].map((b) => (
                <div key={b} className="flex items-center gap-2 text-sm" style={{ color: "#ccc" }}>
                  <Check size={14} style={{ color: "#2ecc71" }} /> {b}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 mb-4">
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full rounded-xl py-3 px-4 text-sm text-white outline-none"
                style={INPUT_STYLE}
              />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full rounded-xl py-3 px-4 text-sm text-white outline-none"
                style={INPUT_STYLE}
              />
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="9XXXXXXXX"
                className="w-full rounded-xl py-3 px-4 text-sm text-white outline-none"
                style={INPUT_STYLE}
              />
            </div>
            <button
              onClick={submitJoin} disabled={!name.trim()}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-80 disabled:opacity-30 mb-2"
              style={{ background: "#FFD600", color: "#0D0000" }}
            >
              Unirme a La Manada
            </button>
            <button
              onClick={() => setStage("dashboard")}
              className="w-full py-3 text-xs font-semibold transition-all hover:opacity-70"
              style={{ color: "#555" }}
            >
              Quizás luego
            </button>
          </div>
        )}

        {/* ── ETAPA 4: Dashboard ── */}
        {stage === "dashboard" && member && (
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase mb-0.5" style={{ color: "#555" }}>Hola,</p>
                <p className="font-bebas text-2xl tracking-widest">{member.name}</p>
              </div>
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: `${level.color}18`, color: level.color, border: `1px solid ${level.color}44` }}
              >
                <level.icon size={12} /> {level.name}
              </div>
            </div>

            {/* Points card */}
            <div
              className="rounded-2xl p-6 mb-5 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #1a0a0a 0%, #2a0a0a 50%, #1a0a0a 100%)", border: "1px solid rgba(192,57,43,0.4)" }}
            >
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "repeating-linear-gradient(45deg, #F39C12 0, #F39C12 1px, transparent 0, transparent 30px)" }} />
              <div className="relative z-10">
                <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "#555" }}>Tu saldo</p>
                <div className="flex items-end gap-2 mb-4">
                  <span className="font-bebas text-6xl leading-none" style={{ color: "#FFD600" }}>{pts}</span>
                  <span className="text-sm font-bold mb-2" style={{ color: "#FFD600" }}>Wolfpoints</span>
                </div>
                {next ? (
                  <div>
                    <div className="flex justify-between text-[11px] mb-1" style={{ color: "#555" }}>
                      <span>{level.name}</span>
                      <span>{next.min - pts} pts para {next.name}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "#1f1f1f" }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #C0392B, #FFD600)" }} />
                    </div>
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs" style={{ color: "#FFD600" }}>
                    <Crown size={13} /> Nivel máximo — Jefe de Manada
                  </p>
                )}
              </div>
            </div>

            {/* Cómo ganar */}
            <div className="rounded-xl p-4 mb-5" style={{ background: "#150000", border: "1px solid #1f0000" }}>
              <p className="text-sm font-bold text-white mb-1">Cómo ganar Wolfpoints</p>
              <p className="text-xs" style={{ color: "#666" }}>
                Cada <span style={{ color: "#FFD600" }}>S/1 = 1 Wolfpoint</span>. El cajero los agrega luego de validar tu pedido.
              </p>
            </div>

            {/* Recompensas */}
            <div className="mb-5">
              <h3 className="font-bebas text-2xl tracking-widest mb-3">
                CANJES <span style={{ color: "#DC2626" }}>DISPONIBLES</span>
              </h3>
              <div className="flex flex-col gap-3">
                {REWARDS.map((r) => {
                  const can = pts >= r.pts;
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl p-4 flex items-center gap-4"
                      style={{ background: "#150000", border: `1px solid ${can ? "rgba(220,38,38,0.35)" : "#1a0000"}`, opacity: can ? 1 : 0.5 }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: can ? "rgba(255,214,0,0.12)" : "rgba(255,255,255,0.04)" }}
                      >
                        <r.icon size={20} style={{ color: can ? "#FFD600" : "#444" }} />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-white">{r.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: "#555" }}>{r.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="font-bebas text-lg leading-none" style={{ color: "#FFD600" }}>{r.pts} pts</span>
                        <button
                          onClick={() => handleRedeem(r)} disabled={!can}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ background: can ? "#DC2626" : "#2a0000", color: "#fff" }}
                        >
                          Canjear <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Historial */}
            <div className="rounded-xl p-4" style={{ background: "#150000", border: "1px solid #1f0000" }}>
              <h3 className="font-bebas text-xl tracking-widest mb-3">HISTORIAL</h3>
              {member.history.length === 0 ? (
                <p className="text-xs" style={{ color: "#444" }}>
                  Tus puntos aparecen después de que el cajero valide tu pedido.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {member.history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-white">{h.desc}</p>
                        <p className="text-[11px]" style={{ color: "#555" }}>{h.date}</p>
                      </div>
                      <span className="font-bebas text-lg" style={{ color: h.pts > 0 ? "#2ecc71" : "#DC2626" }}>
                        {h.pts > 0 ? "+" : ""}{h.pts}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dashboard sin cuenta (saltó el join) */}
        {stage === "dashboard" && !member && (
          <div className="text-center py-12">
            <Crown size={40} className="mx-auto mb-4" style={{ color: "#444" }} />
            <p className="text-sm mb-1" style={{ color: "#888" }}>No estás registrado en La Manada aún</p>
            <button
              onClick={() => setStage("join")}
              className="mt-4 px-6 py-3 rounded-xl font-bold text-sm"
              style={{ background: "#FFD600", color: "#0D0000" }}
            >
              Unirme ahora
            </button>
          </div>
        )}
      </div>

      {/* Modal: Confirmar canje */}
      {confirmReward && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "#150000", border: "1px solid rgba(220,38,38,0.4)" }}>
            <h3 className="font-bebas text-2xl tracking-widest mb-1">¿CONFIRMAR CANJE?</h3>
            <p className="text-sm mb-4" style={{ color: "#888" }}>
              Vas a canjear <span className="text-white font-bold">{confirmReward.title}</span> por{" "}
              <span style={{ color: "#FFD600" }} className="font-bold">{confirmReward.pts} Wolfpoints</span>.
            </p>
            <p className="text-xs mb-5" style={{ color: "#555" }}>
              El cajero descontará los puntos al validar tu código.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmReward(null)} className="flex-1 py-3 rounded-lg text-sm font-bold" style={{ background: "#1a0000", color: "#888" }}>
                Cancelar
              </button>
              <button onClick={confirmRedeem} className="flex-1 py-3 rounded-lg text-sm font-bold" style={{ background: "#DC2626", color: "#fff" }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Código generado */}
      {redeemResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.9)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 text-center relative" style={{ background: "#150000", border: "1px solid rgba(255,214,0,0.4)" }}>
            <button onClick={() => setRedeemResult(null)} className="absolute top-4 right-4 p-1" style={{ color: "#555" }}>
              <X size={20} />
            </button>
            <Sparkles size={36} className="mx-auto mb-3" style={{ color: "#FFD600" }} />
            <h3 className="font-bebas text-2xl tracking-widest mb-1">¡CÓDIGO GENERADO!</h3>
            <p className="text-sm mb-5" style={{ color: "#888" }}>{redeemResult.title}</p>
            <div className="rounded-xl py-4 px-5 mb-4" style={{ background: "#0D0000", border: "1px solid rgba(255,214,0,0.3)" }}>
              <p className="text-xs mb-1" style={{ color: "#555" }}>Código de canje</p>
              <p className="font-bebas text-3xl tracking-widest" style={{ color: "#FFD600" }}>{redeemResult.code}</p>
            </div>
            <p className="text-xs mb-5" style={{ color: "#555" }}>
              Muéstrale este código al cajero — tiene 30 minutos de validez
            </p>
            <button onClick={() => setRedeemResult(null)} className="w-full py-3 rounded-lg text-sm font-bold" style={{ background: "#DC2626", color: "#fff" }}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
