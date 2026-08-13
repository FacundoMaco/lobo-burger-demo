"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart, buildWhatsAppUrl } from "@/lib/cart-context";
import { initCulqiCheckout } from "@/lib/culqi";
import { Navbar } from "@/components/navbar";
import type { Order } from "@/lib/orders-store";
import { CreditCard, Check, Store, Bike, MessageCircle, ShoppingBag } from "lucide-react";

const PRIMARY = "#F5A623";
const ACCENT = "#E63950";
const INK = "#241F1C";

const inputCls = "w-full px-4 py-3 rounded-lg text-sm outline-none focus-visible:ring-2";
const inputStyle = { background: "#FFFFFF", border: "1.5px solid rgba(36,31,28,0.2)", color: INK };

export default function CheckoutPage() {
  const {
    items, total, fulfillmentMode, setFulfillmentMode, address, setAddress, submitOrder,
  } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string; address?: string; mode?: string; terms?: string }>({});
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  const handlePay = async () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = "Ingresa tu nombre";
    if (!phone.trim()) errs.phone = "Ingresa tu teléfono";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = "Ingresa un email válido";
    if (fulfillmentMode === null) errs.mode = "Elige recojo o delivery";
    if (fulfillmentMode === "delivery" && !address.trim()) errs.address = "Ingresa tu dirección";
    if (!termsAccepted) errs.terms = "Debes aceptar los términos y condiciones";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setPayError(null);
    setPaying(true);
    const result = await initCulqiCheckout({
      amount: total,
      description: "Pedido Lobo Burger",
      email: email.trim(),
    });
    if (result.success) {
      const order = submitOrder({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        culqiChargeId: result.chargeId,
        delivery: fulfillmentMode === "delivery",
        address: address.trim(),
      });
      setConfirmedOrder(order);
    } else if (!result.cancelled) {
      setPayError(result.error || "No pudimos procesar el pago. Intenta de nuevo.");
    }
    setPaying(false);
  };

  // ── Confirmación ──
  if (confirmedOrder) {
    return (
      <div className="min-h-screen" style={{ background: "#FFFDF8" }}>
        <Navbar />
        <div className="max-w-md mx-auto px-4 pt-16 pb-28 text-center">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{ background: "#1E9E4A" }}
          >
            <Check size={30} color="#FFFFFF" />
          </div>
          <h1 className="font-bebas text-2xl mb-2" style={{ color: INK }}>PEDIDO CONFIRMADO</h1>
          <p className="font-mono text-lg font-bold mb-4" style={{ color: ACCENT }}>#{confirmedOrder.id}</p>
          <p className="text-sm leading-relaxed mb-2" style={{ color: "rgba(36,31,28,0.65)" }}>
            {confirmedOrder.delivery
              ? `Tu pedido va en camino a: ${confirmedOrder.address}`
              : "Tu pedido estará listo para recoger en tienda."}
          </p>
          <p className="text-xs leading-relaxed mb-8" style={{ color: "rgba(36,31,28,0.5)" }}>
            Pago procesado con Culqi{confirmedOrder.culqiChargeId ? ` (ref. ${confirmedOrder.culqiChargeId})` : ""}. Te enviamos la constancia a tu correo.
          </p>
          <a
            href={buildWhatsAppUrl(confirmedOrder)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{ background: "#25D366", color: "#FFFFFF" }}
          >
            <MessageCircle size={16} />
            Confirmar por WhatsApp
          </a>
          <div className="mt-6">
            <Link href="/" className="text-sm font-semibold underline" style={{ color: "rgba(36,31,28,0.6)" }}>
              Volver a la carta
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Carrito vacío ──
  if (items.length === 0) {
    return (
      <div className="min-h-screen" style={{ background: "#FFFDF8" }}>
        <Navbar />
        <div className="max-w-md mx-auto px-4 pt-20 pb-28 text-center">
          <ShoppingBag size={40} className="mx-auto mb-4" style={{ color: "rgba(36,31,28,0.2)" }} />
          <h1 className="font-bebas text-xl mb-2" style={{ color: INK }}>TU CARRITO ESTÁ VACÍO</h1>
          <p className="text-sm mb-6" style={{ color: "rgba(36,31,28,0.55)" }}>Agrega algo rico de la carta primero.</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider"
            style={{ background: PRIMARY, color: INK }}
          >
            Ver carta
          </Link>
        </div>
      </div>
    );
  }

  // ── Checkout ──
  return (
    <div className="min-h-screen" style={{ background: "#FFFDF8" }}>
      <Navbar />
      <div className="max-w-md mx-auto px-4 pt-8 pb-28">
        <h1 className="font-bebas text-2xl mb-6" style={{ color: INK }}>FINALIZA TU PEDIDO</h1>

        {/* Resumen */}
        <div className="rounded-2xl p-5 mb-5" style={{ background: "#FFFFFF", border: "1px solid rgba(36,31,28,0.1)" }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(36,31,28,0.5)" }}>Resumen</p>
          {items.map(item => (
            <div key={item.id} className="flex justify-between text-sm py-1.5" style={{ borderBottom: "1px solid rgba(36,31,28,0.06)" }}>
              <span style={{ color: INK }}>{item.qty}x {item.name}</span>
              <span className="font-mono font-semibold" style={{ color: INK }}>S/{item.price * item.qty}</span>
            </div>
          ))}
          <div className="flex justify-between items-center pt-3 mt-1">
            <span className="text-sm font-bold uppercase tracking-wider" style={{ color: INK }}>Total</span>
            <span className="font-mono text-2xl font-bold" style={{ color: ACCENT }}>S/{total}</span>
          </div>
        </div>

        {/* Entrega */}
        <div className="rounded-2xl p-5 mb-5" style={{ background: "#FFFFFF", border: `1px solid ${errors.mode ? ACCENT : "rgba(36,31,28,0.1)"}` }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(36,31,28,0.5)" }}>Entrega</p>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => { setFulfillmentMode("pickup"); setErrors(p => ({ ...p, mode: undefined })); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg text-xs font-bold cursor-pointer transition-all"
              style={{
                background: fulfillmentMode === "pickup" ? PRIMARY : "#FFFDF8",
                color: INK,
                border: `1.5px solid ${fulfillmentMode === "pickup" ? PRIMARY : "rgba(36,31,28,0.2)"}`,
              }}
            >
              <Store size={14} /> Recojo en tienda
            </button>
            <button
              onClick={() => { setFulfillmentMode("delivery"); setErrors(p => ({ ...p, mode: undefined })); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg text-xs font-bold cursor-pointer transition-all"
              style={{
                background: fulfillmentMode === "delivery" ? PRIMARY : "#FFFDF8",
                color: INK,
                border: `1.5px solid ${fulfillmentMode === "delivery" ? PRIMARY : "rgba(36,31,28,0.2)"}`,
              }}
            >
              <Bike size={14} /> Delivery
            </button>
          </div>
          {errors.mode && <p className="text-xs mb-2" style={{ color: ACCENT }}>{errors.mode}</p>}

          {fulfillmentMode === "delivery" && (
            <div>
              <label htmlFor="checkout-address" className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "rgba(36,31,28,0.55)" }}>
                Dirección
              </label>
              <input
                id="checkout-address"
                type="text"
                value={address}
                onChange={e => { setAddress(e.target.value); setErrors(p => ({ ...p, address: undefined })); }}
                placeholder="Calle, número, referencia..."
                className={inputCls}
                style={{ ...inputStyle, borderColor: errors.address ? ACCENT : "rgba(36,31,28,0.2)" }}
              />
              {errors.address && <p className="text-xs mt-1" style={{ color: ACCENT }}>{errors.address}</p>}
              <p className="text-[11px] mt-2" style={{ color: "rgba(36,31,28,0.5)" }}>
                Delivery disponible hasta ~7.5 km de nuestras sedes (Surquillo y San Juan de Miraflores).
              </p>
            </div>
          )}
        </div>

        {/* Datos */}
        <div className="rounded-2xl p-5 mb-6" style={{ background: "#FFFFFF", border: "1px solid rgba(36,31,28,0.1)" }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(36,31,28,0.5)" }}>Tus datos</p>
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="checkout-name" className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "rgba(36,31,28,0.55)" }}>
                Nombre completo
              </label>
              <input
                id="checkout-name"
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }}
                placeholder="Ej: Carlos Mendoza"
                autoComplete="name"
                className={inputCls}
                style={{ ...inputStyle, borderColor: errors.name ? ACCENT : "rgba(36,31,28,0.2)" }}
              />
              {errors.name && <p className="text-xs mt-1" style={{ color: ACCENT }}>{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="checkout-phone" className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "rgba(36,31,28,0.55)" }}>
                Teléfono
              </label>
              <input
                id="checkout-phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={e => { setPhone(e.target.value); setErrors(p => ({ ...p, phone: undefined })); }}
                placeholder="Ej: 999 888 777"
                autoComplete="tel"
                className={inputCls}
                style={{ ...inputStyle, borderColor: errors.phone ? ACCENT : "rgba(36,31,28,0.2)" }}
              />
              {errors.phone && <p className="text-xs mt-1" style={{ color: ACCENT }}>{errors.phone}</p>}
            </div>
            <div>
              <label htmlFor="checkout-email" className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "rgba(36,31,28,0.55)" }}>
                Email
              </label>
              <input
                id="checkout-email"
                type="email"
                inputMode="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }}
                placeholder="Ej: carlos@gmail.com"
                autoComplete="email"
                className={inputCls}
                style={{ ...inputStyle, borderColor: errors.email ? ACCENT : "rgba(36,31,28,0.2)" }}
              />
              {errors.email && <p className="text-xs mt-1" style={{ color: ACCENT }}>{errors.email}</p>}
            </div>
          </div>
        </div>

        <label className="flex items-start gap-2.5 mb-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={e => { setTermsAccepted(e.target.checked); setErrors(p => ({ ...p, terms: undefined })); }}
            className="mt-0.5 w-4 h-4 shrink-0 cursor-pointer"
            style={{ accentColor: ACCENT }}
          />
          <span className="text-xs leading-relaxed" style={{ color: "rgba(36,31,28,0.65)" }}>
            Acepto los{" "}
            <Link href="/terminos" target="_blank" className="underline font-semibold" style={{ color: INK }}>
              términos y condiciones
            </Link>
          </span>
        </label>
        {errors.terms && <p className="text-xs mb-3" style={{ color: ACCENT }}>{errors.terms}</p>}

        {payError && (
          <p
            className="text-xs text-center mb-3 px-4 py-3 rounded-lg"
            style={{ background: "#FADADD", color: "#9B1C30" }}
            role="alert"
          >
            {payError}
          </p>
        )}

        <button
          onClick={handlePay}
          disabled={paying}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all hover:brightness-105 active:scale-95 cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
          style={{ background: PRIMARY, color: INK }}
        >
          <CreditCard size={17} />
          {paying ? "Procesando pago..." : `Pagar S/${total}`}
        </button>
        <p className="text-[11px] text-center mt-3" style={{ color: "rgba(36,31,28,0.45)" }}>
          Pago seguro con Culqi (tarjeta o Yape). Solo aceptamos pago online — no efectivo en pedidos web.
        </p>
        <p className="text-[11px] text-center mt-4" style={{ color: "rgba(36,31,28,0.55)" }}>
          ¿Algún problema con tu pedido?{" "}
          <Link href="/libro-reclamaciones" className="underline font-semibold" style={{ color: INK }}>
            Libro de Reclamaciones
          </Link>
        </p>
      </div>
    </div>
  );
}
