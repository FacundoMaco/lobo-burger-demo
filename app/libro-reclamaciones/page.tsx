"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { BookText, Check, Printer } from "lucide-react";

const PRIMARY = "#F5A623";
const ACCENT = "#E63950";
const INK = "#241F1C";

// TODO: reemplazar con los datos registrados en SUNAT cuando Jaime los envíe.
const NEGOCIO = {
  razonSocial: "[PENDIENTE: razón social]",
  ruc: "[PENDIENTE: RUC]",
};

const SEDES = {
  Surquillo: "Av. Aviación 3877, La Calera - Surquillo",
  SJM: "Av. Vargas Machuca 526, CT - San Juan de Miraflores",
} as const;

type Sede = keyof typeof SEDES;
type Tipo = "reclamo" | "queja";

const inputCls = "w-full px-4 py-3 rounded-lg text-sm outline-none focus-visible:ring-2";
const inputStyle = { background: "#FFFFFF", border: "1.5px solid rgba(36,31,28,0.2)", color: INK };
const labelCls = "text-xs font-semibold uppercase tracking-wider block mb-1.5";
const labelStyle = { color: "rgba(36,31,28,0.55)" };
const cardCls = "rounded-2xl p-5 mb-5";
const cardStyle = { background: "#FFFFFF", border: "1px solid rgba(36,31,28,0.1)" };

const empty = {
  sede: "" as Sede | "",
  tipo: "" as Tipo | "",
  consumidor_nombre: "",
  consumidor_domicilio: "",
  consumidor_documento: "",
  consumidor_telefono: "",
  consumidor_email: "",
  es_menor_edad: false,
  representante_nombre: "",
  bien_descripcion: "",
  monto_reclamado: "",
  detalle: "",
  pedido_concreto: "",
};

type Form = typeof empty;
type Constancia = { folio: string; createdAt: string; form: Form };

function Field({
  id, label, value, onChange, error, type = "text", placeholder, textarea, autoComplete, inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  textarea?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel" | "email" | "decimal";
}) {
  const style = { ...inputStyle, borderColor: error ? ACCENT : "rgba(36,31,28,0.2)" };
  return (
    <div>
      <label htmlFor={id} className={labelCls} style={labelStyle}>{label}</label>
      {textarea ? (
        <textarea
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className={`${inputCls} resize-y`}
          style={style}
        />
      ) : (
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputCls}
          style={style}
        />
      )}
      {error && <p className="text-xs mt-1" style={{ color: ACCENT }}>{error}</p>}
    </div>
  );
}

function DatoConstancia({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2" style={{ borderBottom: "1px solid rgba(36,31,28,0.08)" }}>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(36,31,28,0.5)" }}>{label}</p>
      <p className="text-sm mt-0.5 whitespace-pre-wrap" style={{ color: INK }}>{value}</p>
    </div>
  );
}

export default function LibroReclamacionesPage() {
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Form | "conformidad", string>>>({});
  const [conformidad, setConformidad] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [constancia, setConstancia] = useState<Constancia | null>(null);

  const set = <K extends keyof Form>(key: K) => (value: Form[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const enviar = async () => {
    const errs: typeof errors = {};
    if (!form.sede) errs.sede = "Elige la sede";
    if (!form.tipo) errs.tipo = "Indica si es un reclamo o una queja";
    if (!form.consumidor_nombre.trim()) errs.consumidor_nombre = "Ingresa tu nombre completo";
    if (!form.consumidor_domicilio.trim()) errs.consumidor_domicilio = "Ingresa tu domicilio";
    if (!form.consumidor_documento.trim()) errs.consumidor_documento = "Ingresa tu documento de identidad";
    if (!form.consumidor_telefono.trim()) errs.consumidor_telefono = "Ingresa tu teléfono";
    if (!/^\S+@\S+\.\S+$/.test(form.consumidor_email.trim())) errs.consumidor_email = "Ingresa un email válido";
    if (form.es_menor_edad && !form.representante_nombre.trim()) errs.representante_nombre = "Ingresa el nombre del padre, madre o apoderado";
    if (!form.bien_descripcion.trim()) errs.bien_descripcion = "Describe el producto o servicio";
    if (!form.detalle.trim()) errs.detalle = "Cuéntanos qué pasó";
    if (!form.pedido_concreto.trim()) errs.pedido_concreto = "Indica qué solución esperas";
    if (form.monto_reclamado.trim() && !Number.isFinite(Number(form.monto_reclamado))) errs.monto_reclamado = "Ingresa solo números";
    if (!conformidad) errs.conformidad = "Debes confirmar que los datos son verdaderos";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setErrorEnvio(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/reclamaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) setConstancia({ folio: data.folio, createdAt: data.createdAt, form });
      else setErrorEnvio(data.error || "No pudimos registrar tu reclamación. Intenta de nuevo.");
    } catch {
      setErrorEnvio("Error de conexión. Intenta de nuevo.");
    }
    setEnviando(false);
  };

  const printStyles = `
    @media print {
      .no-print { display: none !important; }
      body { background: #FFFFFF !important; }
      .constancia { box-shadow: none !important; border: 1px solid #999 !important; }
    }
  `;

  // ── Constancia (acuse de recibo inmediato) ──
  if (constancia) {
    const { folio, createdAt, form: f } = constancia;
    const fecha = new Date(createdAt).toLocaleString("es-PE", { dateStyle: "long", timeStyle: "short" });
    return (
      <div className="min-h-screen" style={{ background: "#FFFDF8" }}>
        <style>{printStyles}</style>
        <div className="no-print"><Navbar /></div>
        <div className="max-w-2xl mx-auto px-4 pt-10 pb-28">
          <div className="text-center mb-6 no-print">
            <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "#1E9E4A" }}>
              <Check size={26} color="#FFFFFF" />
            </div>
            <h1 className="font-bebas text-2xl" style={{ color: INK }}>RECLAMACIÓN REGISTRADA</h1>
            <p className="text-sm mt-2" style={{ color: "rgba(36,31,28,0.65)" }}>
              Guarda o imprime esta constancia. Te responderemos en un plazo máximo de 15 días hábiles.
            </p>
          </div>

          <div className="constancia rounded-2xl p-6" style={{ background: "#FFFFFF", border: "1px solid rgba(36,31,28,0.15)" }}>
            <div className="text-center pb-4 mb-4" style={{ borderBottom: `2px solid ${INK}` }}>
              <p className="font-bebas text-xl" style={{ color: INK }}>HOJA DE RECLAMACIÓN</p>
              <p className="text-xs mt-1" style={{ color: "rgba(36,31,28,0.6)" }}>Libro de Reclamaciones Virtual — Lobo Burger</p>
              <p className="font-mono text-lg font-bold mt-3" style={{ color: ACCENT }}>{folio}</p>
            </div>

            <DatoConstancia label="Fecha y hora de registro" value={fecha} />
            <DatoConstancia label="Razón social" value={NEGOCIO.razonSocial} />
            <DatoConstancia label="RUC" value={NEGOCIO.ruc} />
            <DatoConstancia label="Establecimiento" value={SEDES[f.sede as Sede]} />
            <DatoConstancia label="Tipo" value={f.tipo === "reclamo" ? "Reclamo (disconformidad con el producto o servicio)" : "Queja (malestar con la atención)"} />
            <DatoConstancia label="Consumidor" value={f.consumidor_nombre} />
            <DatoConstancia label="Documento de identidad" value={f.consumidor_documento} />
            <DatoConstancia label="Domicilio" value={f.consumidor_domicilio} />
            <DatoConstancia label="Teléfono" value={f.consumidor_telefono} />
            <DatoConstancia label="Email" value={f.consumidor_email} />
            {f.es_menor_edad && <DatoConstancia label="Padre, madre o apoderado" value={f.representante_nombre} />}
            <DatoConstancia label="Bien o servicio contratado" value={f.bien_descripcion} />
            {f.monto_reclamado.trim() && <DatoConstancia label="Monto reclamado" value={`S/${f.monto_reclamado}`} />}
            <DatoConstancia label="Detalle de los hechos" value={f.detalle} />
            <DatoConstancia label="Pedido del consumidor" value={f.pedido_concreto} />

            <p className="text-[11px] leading-relaxed mt-5" style={{ color: "rgba(36,31,28,0.6)" }}>
              El consumidor declaró la veracidad de los hechos y dio conformidad al registro de esta hoja el {fecha} hrs.
              El proveedor debe dar respuesta en un plazo no mayor a 15 días hábiles improrrogables (Ley 31435).
              La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito
              previo para denunciar ante el INDECOPI.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 mt-6 no-print">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all active:scale-95"
              style={{ background: PRIMARY, color: INK }}
            >
              <Printer size={16} />
              Imprimir constancia
            </button>
            <Link
              href="/"
              className="inline-flex items-center px-5 py-3 rounded-xl text-sm font-semibold"
              style={{ border: "1.5px solid rgba(36,31,28,0.2)", color: INK }}
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario (Anexo I) ──
  return (
    <div className="min-h-screen" style={{ background: "#FFFDF8" }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-28">
        <div className="flex items-center gap-2 mb-2">
          <BookText size={20} style={{ color: ACCENT }} />
          <h1 className="font-bebas text-2xl" style={{ color: INK }}>LIBRO DE RECLAMACIONES</h1>
        </div>
        <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(36,31,28,0.65)" }}>
          Conforme al Código de Protección y Defensa del Consumidor. Al enviar el formulario recibes al instante
          tu constancia con número de folio. Respondemos en un plazo máximo de 15 días hábiles.
        </p>

        {/* Establecimiento */}
        <div className={cardCls} style={cardStyle}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(36,31,28,0.5)" }}>Establecimiento</p>
          <div className="text-sm mb-4" style={{ color: "rgba(36,31,28,0.7)" }}>
            <p>{NEGOCIO.razonSocial}</p>
            <p className="font-mono text-xs mt-0.5">RUC {NEGOCIO.ruc}</p>
          </div>
          <label className={labelCls} style={labelStyle}>Sede donde ocurrió</label>
          <div className="flex flex-col sm:flex-row gap-2">
            {(Object.keys(SEDES) as Sede[]).map(s => (
              <button
                key={s}
                onClick={() => set("sede")(s)}
                className="flex-1 py-3 px-3 rounded-lg text-xs font-bold cursor-pointer transition-all text-left"
                style={{
                  background: form.sede === s ? PRIMARY : "#FFFDF8",
                  color: INK,
                  border: `1.5px solid ${form.sede === s ? PRIMARY : errors.sede ? ACCENT : "rgba(36,31,28,0.2)"}`,
                }}
              >
                {SEDES[s]}
              </button>
            ))}
          </div>
          {errors.sede && <p className="text-xs mt-1.5" style={{ color: ACCENT }}>{errors.sede}</p>}
        </div>

        {/* Tipo */}
        <div className={cardCls} style={cardStyle}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(36,31,28,0.5)" }}>Tipo de solicitud</p>
          <div className="flex flex-col sm:flex-row gap-2">
            {([
              { v: "reclamo" as Tipo, t: "Reclamo", d: "Disconformidad con el producto o servicio" },
              { v: "queja" as Tipo, t: "Queja", d: "Malestar con la atención recibida" },
            ]).map(o => (
              <button
                key={o.v}
                onClick={() => set("tipo")(o.v)}
                className="flex-1 py-3 px-3 rounded-lg cursor-pointer transition-all text-left"
                style={{
                  background: form.tipo === o.v ? PRIMARY : "#FFFDF8",
                  color: INK,
                  border: `1.5px solid ${form.tipo === o.v ? PRIMARY : errors.tipo ? ACCENT : "rgba(36,31,28,0.2)"}`,
                }}
              >
                <span className="block text-xs font-bold uppercase tracking-wider">{o.t}</span>
                <span className="block text-[11px] mt-0.5" style={{ color: "rgba(36,31,28,0.6)" }}>{o.d}</span>
              </button>
            ))}
          </div>
          {errors.tipo && <p className="text-xs mt-1.5" style={{ color: ACCENT }}>{errors.tipo}</p>}
        </div>

        {/* Consumidor */}
        <div className={cardCls} style={cardStyle}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(36,31,28,0.5)" }}>Datos del consumidor</p>
          <div className="flex flex-col gap-4">
            <Field id="lr-nombre" label="Nombre completo" value={form.consumidor_nombre} onChange={set("consumidor_nombre")} error={errors.consumidor_nombre} placeholder="Ej: Carlos Mendoza Ríos" autoComplete="name" />
            <Field id="lr-documento" label="DNI / CE / Pasaporte" value={form.consumidor_documento} onChange={set("consumidor_documento")} error={errors.consumidor_documento} placeholder="Ej: DNI 45678912" />
            <Field id="lr-domicilio" label="Domicilio" value={form.consumidor_domicilio} onChange={set("consumidor_domicilio")} error={errors.consumidor_domicilio} placeholder="Calle, número, distrito" autoComplete="street-address" />
            <Field id="lr-telefono" label="Teléfono" value={form.consumidor_telefono} onChange={set("consumidor_telefono")} error={errors.consumidor_telefono} type="tel" inputMode="tel" placeholder="Ej: 999 888 777" autoComplete="tel" />
            <Field id="lr-email" label="Email" value={form.consumidor_email} onChange={set("consumidor_email")} error={errors.consumidor_email} type="email" inputMode="email" placeholder="Ej: carlos@gmail.com" autoComplete="email" />

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.es_menor_edad}
                onChange={e => set("es_menor_edad")(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 cursor-pointer"
                style={{ accentColor: ACCENT }}
              />
              <span className="text-xs leading-relaxed" style={{ color: "rgba(36,31,28,0.65)" }}>
                El consumidor es menor de edad
              </span>
            </label>
            {form.es_menor_edad && (
              <Field id="lr-representante" label="Padre, madre o apoderado" value={form.representante_nombre} onChange={set("representante_nombre")} error={errors.representante_nombre} placeholder="Nombre completo del representante" />
            )}
          </div>
        </div>

        {/* Bien contratado */}
        <div className={cardCls} style={cardStyle}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(36,31,28,0.5)" }}>Bien o servicio contratado</p>
          <div className="flex flex-col gap-4">
            <Field id="lr-bien" label="Producto o servicio" value={form.bien_descripcion} onChange={set("bien_descripcion")} error={errors.bien_descripcion} placeholder="Ej: Pedido web #LB-1234, Combo Lobo" />
            <Field id="lr-monto" label="Monto reclamado (opcional)" value={form.monto_reclamado} onChange={set("monto_reclamado")} error={errors.monto_reclamado} inputMode="decimal" placeholder="Ej: 25" />
          </div>
        </div>

        {/* Detalle y pedido */}
        <div className={cardCls} style={cardStyle}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "rgba(36,31,28,0.5)" }}>Detalle</p>
          <div className="flex flex-col gap-4">
            <Field id="lr-detalle" label="¿Qué pasó?" value={form.detalle} onChange={set("detalle")} error={errors.detalle} textarea placeholder="Describe los hechos con el mayor detalle posible" />
            <Field id="lr-pedido" label="¿Qué solución esperas?" value={form.pedido_concreto} onChange={set("pedido_concreto")} error={errors.pedido_concreto} textarea placeholder="Ej: reposición del producto, devolución del monto pagado" />
          </div>
        </div>

        <label className="flex items-start gap-2.5 mb-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={conformidad}
            onChange={e => { setConformidad(e.target.checked); setErrors(p => ({ ...p, conformidad: undefined })); }}
            className="mt-0.5 w-4 h-4 shrink-0 cursor-pointer"
            style={{ accentColor: ACCENT }}
          />
          <span className="text-xs leading-relaxed" style={{ color: "rgba(36,31,28,0.65)" }}>
            Declaro que los datos y hechos consignados son verdaderos y doy conformidad al registro de esta hoja de
            reclamación. La fecha y hora de envío reemplazan a la firma.
          </span>
        </label>
        {errors.conformidad && <p className="text-xs mb-3" style={{ color: ACCENT }}>{errors.conformidad}</p>}

        {errorEnvio && (
          <p className="text-xs text-center mb-3 px-4 py-3 rounded-lg" style={{ background: "#FADADD", color: "#9B1C30" }} role="alert">
            {errorEnvio}
          </p>
        )}

        <button
          onClick={enviar}
          disabled={enviando}
          className="w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all hover:brightness-105 active:scale-95 cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
          style={{ background: PRIMARY, color: INK }}
        >
          {enviando ? "Registrando..." : "Enviar reclamación"}
        </button>
        <p className="text-[11px] text-center mt-3 leading-relaxed" style={{ color: "rgba(36,31,28,0.45)" }}>
          La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo
          para denunciar ante el INDECOPI.
        </p>
      </div>
    </div>
  );
}
