"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCart, buildWhatsAppUrl } from "@/lib/cart-context";
import { initCulqiCheckout } from "@/lib/culqi";
import { createYapeToken } from "@/lib/culqi-yape";
import { Navbar } from "@/components/navbar";
import type { Ubicacion } from "@/components/delivery-map";
import type { Order } from "@/lib/orders-store";
import { CreditCard, Check, Store, Bike, MessageCircle, ShoppingBag, Smartphone, Info } from "lucide-react";

// Leaflet toca window al importarse, asi que el mapa solo se carga en el cliente.
const DeliveryMap = dynamic(
  () => import("@/components/delivery-map").then(m => m.DeliveryMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full rounded-xl"
        style={{ height: 240, background: "rgba(36,31,28,0.06)" }}
      />
    ),
  }
);

const CULQI_CONTAINER_ID = "culqi-container";

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
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string; address?: string; mode?: string; terms?: string; ubicacion?: string }>({});
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"yape" | "tarjeta">("yape");
  const [yapePhone, setYapePhone] = useState("");
  const [yapePhoneTouched, setYapePhoneTouched] = useState(false);
  const [yapeOtp, setYapeOtp] = useState("");

  // Validador compartido de datos de despacho
  const validateForm = (): boolean => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = "Ingresa tu nombre";
    if (!phone.trim()) errs.phone = "Ingresa tu teléfono";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = "Ingresa un email válido";
    if (fulfillmentMode === null) errs.mode = "Elige recojo o delivery";
    if (fulfillmentMode === "delivery" && !address.trim()) errs.address = "Ingresa tu dirección";
    if (fulfillmentMode === "delivery" && ubicacion && !ubicacion.dentroDeZona) {
      errs.ubicacion = "Esa dirección está fuera de nuestra zona de reparto";
    }
    if (!termsAccepted) errs.terms = "Debes aceptar los términos y condiciones";
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return false;
    }
    return true;
  };

  // Pago nativo directo con Yape (sin correos de PagoEfectivo)
  const handlePayYape = async () => {
    if (!validateForm()) return;

    const cleanPhone = (yapePhone.trim() || phone.trim()).replace(/\D/g, "");
    const cleanOtp = yapeOtp.trim().replace(/\D/g, "");

    if (cleanPhone.length !== 9) {
      setPayError("El número de celular de Yape debe tener 9 dígitos");
      return;
    }
    if (cleanOtp.length !== 6) {
      setPayError("Ingresa el código de aprobación de 6 dígitos generado en tu app Yape");
      return;
    }

    setPayError(null);
    setPaying(true);

    // 1. Cotizar en vivo contra Postgres (MENU-04): garantiza que el monto del token
    // Yape coincida exactamente con el monto del cargo exigido por Culqi, y valida
    // disponibilidad sin quemar el OTP del cliente si un precio cambió o se agotó.
    let serverAmountCents = Math.round(total * 100);
    try {
      const quoteRes = await fetch("/api/cotizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map(i => ({ id: i.id, qty: i.qty })) }),
      });
      const quoteData = await quoteRes.json();
      if (!quoteRes.ok) {
        setPayError(quoteData.error || "No pudimos validar la disponibilidad de tu pedido");
        setPaying(false);
        return;
      }
      serverAmountCents = quoteData.totalCents;
    } catch {
      setPayError("Error de conexión al verificar el pedido. Intenta de nuevo.");
      setPaying(false);
      return;
    }

    // 2. Generar token Yape directo en Culqi con el monto validado del servidor
    const tokenRes = await createYapeToken({
      phone: cleanPhone,
      otp: cleanOtp,
      amountCents: serverAmountCents,
    });

    if (!tokenRes.success) {
      setPayError(tokenRes.error);
      setPaying(false);
      return;
    }

    // 3. Cobrar contra el servidor (/api/charge)
    try {
      const res = await fetch("/api/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId: tokenRes.tokenId,
          email: email.trim(),
          items: items.map(i => ({ id: i.id, qty: i.qty, cremas: i.cremas, pan: i.pan, papas: i.papas, comentario: i.comentario })),
          name: name.trim(),
          phone: phone.trim(),
          delivery: fulfillmentMode === "delivery",
          address: direccionCompleta(),
          lat: ubicacion?.lat,
          lng: ubicacion?.lng,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const order = submitOrder({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          culqiChargeId: data.chargeId,
          delivery: fulfillmentMode === "delivery",
          address: direccionCompleta(),
        });
        setConfirmedOrder({ ...order, id: data.codigo });
      } else {
        setPayError(data.error || "No pudimos procesar el cobro. Intenta de nuevo.");
      }
    } catch {
      setPayError("Error de conexión al procesar el pago. Intenta de nuevo.");
    } finally {
      setPaying(false);
    }
  };

  // Pago con tarjeta vía Culqi Checkout (sin orden previa / solo tarjeta)
  const handlePayCard = async () => {
    if (!validateForm()) return;

    setPayError(null);
    setPaying(true);
    setShowPayment(true);

    const result = await initCulqiCheckout({
      amount: total,
      email: email.trim(),
      containerId: CULQI_CONTAINER_ID,
      allowYape: false, // Solo tarjeta: no genera orden ni correos de PagoEfectivo
      pedido: {
        items: items.map(i => ({ id: i.id, qty: i.qty, cremas: i.cremas, pan: i.pan, papas: i.papas, comentario: i.comentario })),
        name: name.trim(),
        phone: phone.trim(),
        delivery: fulfillmentMode === "delivery",
        address: direccionCompleta(),
        lat: ubicacion?.lat,
        lng: ubicacion?.lng,
      },
    });

    if (result.success) {
      const order = submitOrder({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        culqiChargeId: result.chargeId,
        delivery: fulfillmentMode === "delivery",
        address: direccionCompleta(),
      });
      setConfirmedOrder({ ...order, id: result.codigo });
    } else if (!result.cancelled) {
      setPayError(result.error || "No pudimos procesar el pago. Intenta de nuevo.");
      setShowPayment(false);
    }
    setPaying(false);
  };

  // La direccion que viaja al pedido incluye el punto exacto del mapa.
  function direccionCompleta(): string {
    if (fulfillmentMode !== "delivery") return "";
    const base = address.trim();
    if (!ubicacion) return base;
    return `${base} (mapa: https://maps.google.com/?q=${ubicacion.lat.toFixed(6)},${ubicacion.lng.toFixed(6)})`;
  }

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
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-28">
        <h1 className="font-bebas text-2xl md:text-3xl mb-6" style={{ color: INK }}>FINALIZA TU PEDIDO</h1>

        {/* En desktop: datos a la izquierda, pago a la derecha. En movil, una sola columna. */}
        <div className="grid md:grid-cols-2 md:gap-7 items-start">
        <div>

        {/* Resumen */}
        <div className="rounded-2xl p-5 mb-5" style={{ background: "#FFFFFF", border: "1px solid rgba(36,31,28,0.1)" }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(36,31,28,0.5)" }}>Resumen</p>
          {items.map(item => (
            <div key={item.lineId} className="py-1.5" style={{ borderBottom: "1px solid rgba(36,31,28,0.06)" }}>
              <div className="flex justify-between text-sm">
                <span style={{ color: INK }}>{item.qty}x {item.name}</span>
                <span className="font-mono font-semibold" style={{ color: INK }}>S/{item.price * item.qty}</span>
              </div>
              {(item.pan || item.papas) && (
                <p className="text-[11px] pl-3" style={{ color: "rgba(36,31,28,0.5)" }}>
                  {[item.pan, item.papas].filter(Boolean).join(" · ")}
                </p>
              )}
              {item.cremas && item.cremas.length > 0 && (
                <p className="text-[11px] pl-3" style={{ color: "rgba(36,31,28,0.5)" }}>Cremas: {item.cremas.join(", ")}</p>
              )}
              {item.comentario && (
                <p className="text-[11px] pl-3 italic" style={{ color: "rgba(36,31,28,0.5)" }}>&quot;{item.comentario}&quot;</p>
              )}
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

              <div className="mt-4">
                <DeliveryMap
                  value={ubicacion}
                  onChange={u => {
                    setUbicacion(u);
                    setErrors(p => ({ ...p, ubicacion: undefined }));
                  }}
                />
                {errors.ubicacion && <p className="text-xs mt-1" style={{ color: ACCENT }}>{errors.ubicacion}</p>}
              </div>
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
                onChange={e => {
                  const val = e.target.value;
                  setPhone(val);
                  setErrors(p => ({ ...p, phone: undefined }));
                  if (!yapePhoneTouched) {
                    setYapePhone(val.replace(/\D/g, ""));
                  }
                }}
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

        </div>

        <div className="md:sticky md:top-24">

        {/* Selector de Método de Pago */}
        <div className="rounded-2xl p-5 mb-5" style={{ background: "#FFFFFF", border: "1px solid rgba(36,31,28,0.1)" }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(36,31,28,0.5)" }}>
            Método de pago
          </p>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {/* Opción Yape */}
            <button
              type="button"
              onClick={() => {
                setPaymentMethod("yape");
                setShowPayment(false);
                setPayError(null);
                if (!yapePhone && !yapePhoneTouched && phone) {
                  setYapePhone(phone.replace(/\D/g, ""));
                }
              }}
              className="flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all cursor-pointer relative"
              style={{
                background: paymentMethod === "yape" ? "rgba(116, 34, 132, 0.07)" : "#FFFDF8",
                borderColor: paymentMethod === "yape" ? "#742284" : "rgba(36,31,28,0.15)",
              }}
            >
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 absolute top-2 right-2">
                RÁPIDO
              </span>
              <Smartphone size={22} className={paymentMethod === "yape" ? "text-purple-700 mb-1" : "text-neutral-500 mb-1"} />
              <span className="text-xs font-black tracking-wider" style={{ color: paymentMethod === "yape" ? "#742284" : INK }}>
                YAPE
              </span>
              <span className="text-[10px] text-neutral-500 font-medium">Con código de aprobación</span>
            </button>

            {/* Opción Tarjeta */}
            <button
              type="button"
              onClick={() => {
                setPaymentMethod("tarjeta");
                setPayError(null);
              }}
              className="flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all cursor-pointer relative"
              style={{
                background: paymentMethod === "tarjeta" ? "rgba(245, 166, 35, 0.08)" : "#FFFDF8",
                borderColor: paymentMethod === "tarjeta" ? PRIMARY : "rgba(36,31,28,0.15)",
              }}
            >
              <CreditCard size={22} className={paymentMethod === "tarjeta" ? "text-yellow-600 mb-1" : "text-neutral-500 mb-1"} />
              <span className="text-xs font-bold tracking-wider" style={{ color: paymentMethod === "tarjeta" ? INK : INK }}>
                TARJETA
              </span>
              <span className="text-[10px] text-neutral-500 font-medium">Débito o Crédito</span>
            </button>
          </div>

          {/* Formulario Nativo de Yape */}
          {paymentMethod === "yape" && (
            <div className="space-y-3 pt-3 border-t border-dashed border-neutral-200 animate-fadeIn">
              <div>
                <label htmlFor="yape-phone" className="text-xs font-semibold uppercase tracking-wider block mb-1 text-neutral-600">
                  Celular de tu cuenta Yape
                </label>
                <input
                  id="yape-phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={9}
                  value={yapePhone}
                  onChange={e => {
                    setYapePhoneTouched(true);
                    setYapePhone(e.target.value.replace(/\D/g, ""));
                  }}
                  placeholder="Ej: 987654321"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <label htmlFor="yape-otp" className="text-xs font-semibold uppercase tracking-wider block text-neutral-600">
                    Código de aprobación Yape
                  </label>
                  <span className="text-[10px] text-purple-700 font-bold">Vigente por 2 min</span>
                </div>
                <input
                  id="yape-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={yapeOtp}
                  onChange={e => setYapeOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full text-center text-2xl tracking-[8px] font-black font-mono py-2.5 rounded-lg outline-none border focus-visible:ring-2"
                  style={{
                    ...inputStyle,
                    borderColor: yapeOtp.length === 6 ? "#742284" : "rgba(36,31,28,0.25)",
                    color: "#742284",
                  }}
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-50 border border-purple-100 text-[11px] text-purple-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-purple-950">
                  <Info size={13} /> ¿Dónde encuentro mi código de aprobación?
                </p>
                <p className="text-purple-800 leading-tight">
                  Abre tu app <strong>Yape</strong> &rarr; toca el menú (tres líneas) &rarr; presiona <strong>Código de aprobación</strong>. Ingresa los 6 dígitos aquí.
                </p>
              </div>
            </div>
          )}
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

        {!showPayment && (
          <button
            onClick={paymentMethod === "yape" ? handlePayYape : handlePayCard}
            disabled={paying}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all hover:brightness-105 active:scale-95 cursor-pointer disabled:opacity-60 disabled:pointer-events-none shadow-md"
            style={{
              background: paymentMethod === "yape" ? "#742284" : PRIMARY,
              color: paymentMethod === "yape" ? "#FFFFFF" : INK,
            }}
          >
            {paymentMethod === "yape" ? <Smartphone size={18} /> : <CreditCard size={18} />}
            {paying
              ? "Procesando pago..."
              : paymentMethod === "yape"
              ? `Yapear S/${total}`
              : `Pagar S/${total} con Tarjeta`}
          </button>
        )}

        {/* Formulario de tarjeta de Culqi, embebido en la pagina */}
        <div className={showPayment ? "block" : "hidden"}>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "#FFFFFF", border: "1px solid rgba(36,31,28,0.1)" }}
          >
            {/* El iframe de Culqi usa height:100%, asi que el contenedor
                necesita altura explicita o colapsa. El contenido mide 498px
                (tarjeta) y 509px (Yape) mas 40px de padding propio; de sobrar
                espacio el form lo reparte como huecos, asi que se deja el
                minimo que entra sin scroll en ambos metodos. */}
            <div id={CULQI_CONTAINER_ID} style={{ height: 560 }} />
          </div>
          <button
            onClick={() => { setShowPayment(false); setPayError(null); }}
            className="w-full mt-3 py-2.5 text-xs font-semibold underline cursor-pointer"
            style={{ color: "rgba(36,31,28,0.6)" }}
          >
            Volver a editar mis datos
          </button>
        </div>
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
      </div>
    </div>
  );
}
