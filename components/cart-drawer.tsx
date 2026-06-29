"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { X, Minus, Plus, Trash2, MessageCircle, ShoppingBag, ChevronLeft } from "lucide-react";

const YELLOW = "#FFD600";
const DARK_RED = "#7B0000";

export function CartDrawer() {
  const { items, update, remove, total, count, open, setOpen, submitOrder } = useCart();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [delivery, setDelivery] = useState(false);
  const [address, setAddress] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const resetForm = () => {
    setStep(1);
    setName("");
    setPhone("");
    setDelivery(false);
    setAddress("");
    setErrors({});
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
  };

  const handleContinue = () => {
    if (items.length === 0) return;
    setStep(2);
  };

  const handleSubmit = () => {
    const errs: { name?: string; phone?: string } = {};
    if (!name.trim()) errs.name = "Ingresa tu nombre";
    if (!phone.trim()) errs.phone = "Ingresa tu telefono";
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    submitOrder({ name: name.trim(), phone: phone.trim(), delivery, address: address.trim() });
    resetForm();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70" onClick={handleClose} />

      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm flex flex-col"
        style={{ background: DARK_RED, borderLeft: "2px solid rgba(255,214,0,0.25)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,214,0,0.15)" }}
        >
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="text-white/50 hover:text-white mr-1">
                <ChevronLeft size={18} />
              </button>
            )}
            <ShoppingBag size={20} style={{ color: YELLOW }} />
            <span className="font-bebas text-xl tracking-widest text-white">
              {step === 1 ? "TU PEDIDO" : "TUS DATOS"}
              {step === 1 && count > 0 && (
                <span className="ml-2 text-sm font-sans" style={{ color: YELLOW }}>
                  ({count} {count === 1 ? "item" : "items"})
                </span>
              )}
            </span>
          </div>
          <button onClick={handleClose} className="text-white/50 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Step 1 — Items */}
        {step === 1 && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <ShoppingBag size={40} className="opacity-20" />
                  <p className="text-white/40 text-sm">Agrega items desde la carta</p>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 py-3"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white leading-tight">{item.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,214,0,0.7)" }}>
                        S/{item.price} c/u
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => update(item.id, item.qty - 1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(255,255,255,0.1)" }}
                      >
                        <Minus size={11} className="text-white" />
                      </button>
                      <span className="text-sm font-bold text-white w-5 text-center">{item.qty}</span>
                      <button
                        onClick={() => update(item.id, item.qty + 1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(255,214,0,0.2)" }}
                      >
                        <Plus size={11} className="text-white" />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-white w-12 text-right">
                      S/{item.price * item.qty}
                    </span>
                    <button
                      onClick={() => remove(item.id)}
                      className="text-white/30 hover:text-red-400 transition-colors ml-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="px-5 py-5" style={{ borderTop: "1px solid rgba(255,214,0,0.2)" }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white/60 text-sm uppercase tracking-wider">Total</span>
                  <span className="font-bebas text-3xl leading-none" style={{ color: YELLOW }}>
                    S/{total}
                  </span>
                </div>
                <button
                  onClick={handleContinue}
                  className="w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all hover:brightness-110 active:scale-95"
                  style={{ background: YELLOW, color: DARK_RED }}
                >
                  Continuar con el pedido
                </button>
              </div>
            )}
          </>
        )}

        {/* Step 2 — Datos del cliente */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
            <div>
              <label className="text-xs text-white/60 uppercase tracking-wider block mb-1.5">Nombre completo</label>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }}
                placeholder="Ej: Carlos Mendoza"
                className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-white/30 outline-none"
                style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${errors.name ? "#ef4444" : "rgba(255,214,0,0.2)"}` }}
              />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="text-xs text-white/60 uppercase tracking-wider block mb-1.5">Telefono</label>
              <input
                type="tel"
                value={phone}
                onChange={e => { setPhone(e.target.value); setErrors(p => ({ ...p, phone: undefined })); }}
                placeholder="Ej: 999 888 777"
                className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-white/30 outline-none"
                style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${errors.phone ? "#ef4444" : "rgba(255,214,0,0.2)"}` }}
              />
              {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
            </div>

            <div>
              <label className="text-xs text-white/60 uppercase tracking-wider block mb-2">Tipo de entrega</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDelivery(false)}
                  className="flex-1 py-3 rounded-lg text-sm font-bold transition-all"
                  style={{
                    background: !delivery ? YELLOW : "rgba(0,0,0,0.3)",
                    color: !delivery ? DARK_RED : "rgba(255,255,255,0.5)",
                    border: `1px solid ${!delivery ? YELLOW : "rgba(255,255,255,0.1)"}`,
                  }}
                >
                  Para recoger
                </button>
                <button
                  onClick={() => setDelivery(true)}
                  className="flex-1 py-3 rounded-lg text-sm font-bold transition-all"
                  style={{
                    background: delivery ? YELLOW : "rgba(0,0,0,0.3)",
                    color: delivery ? DARK_RED : "rgba(255,255,255,0.5)",
                    border: `1px solid ${delivery ? YELLOW : "rgba(255,255,255,0.1)"}`,
                  }}
                >
                  Delivery
                </button>
              </div>
            </div>

            {delivery && (
              <div>
                <label className="text-xs text-white/60 uppercase tracking-wider block mb-1.5">Direccion</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Calle, numero, referencia..."
                  className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-white/30 outline-none"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,214,0,0.2)" }}
                />
              </div>
            )}

            <div
              className="rounded-lg p-3 mt-1"
              style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,214,0,0.1)" }}
            >
              <p className="text-xs text-white/40 mb-1">Resumen</p>
              <p className="text-xs text-white/70">{count} items</p>
              <p className="font-bebas text-xl leading-none mt-1" style={{ color: YELLOW }}>Total S/{total}</p>
            </div>

            <div className="flex flex-col gap-2 mt-auto pt-2">
              <button
                onClick={handleSubmit}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all hover:brightness-110 active:scale-95"
                style={{ background: "#25D366", color: "#fff" }}
              >
                <MessageCircle size={17} />
                Enviar pedido por WhatsApp
              </button>
              <button
                onClick={() => setStep(1)}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white/50 hover:text-white transition-colors"
              >
                Volver
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
