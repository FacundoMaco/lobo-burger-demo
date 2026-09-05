"use client";

import React, { useState } from "react";
import type { Order } from "@/lib/orders-store";
import { formatPrice } from "@/lib/utils";
import { Printer, X, Copy, Check, Info } from "lucide-react";

interface ThermalTicketModalProps {
  order: Order | null;
  onClose: () => void;
}

// Formato de texto plano (para botón "Copiar texto" a WhatsApp)
export function formatTicketText(o: Order): string {
  const dateObj = new Date(o.createdAt);
  const timeStr = dateObj.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true });
  const dateStr = dateObj.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" });
  const canal = o.delivery ? "DELIVERY" : "RECOJO";

  const itemsText = o.items
    .map(it => {
      const name = it.name.length > 17 ? it.name.slice(0, 16) + "." : it.name.padEnd(17);
      const subtotal = formatPrice(it.price * it.qty).padStart(8);
      const linea = `${it.qty}x ${name} ${subtotal}`;
      const panPapas = [it.pan, it.papas].filter(Boolean).join(", ");
      const extra = [panPapas, it.cremas?.length ? `Cremas: ${it.cremas.join(", ")}` : ""].filter(Boolean);
      return extra.length ? `${linea}\n   ${extra.join("\n   ")}` : linea;
    })
    .join("\n");

  const lines = [
    "--------------------------------",
    "          LOBO BURGER           ",
    "--------------------------------",
    `COMANDA: #${o.id}`,
    `FECHA:   ${dateStr}  ${timeStr}`,
    `CANAL:   ${canal}`,
    "--------------------------------",
    "CANT PRODUCTO            SUBTOTAL",
    "--------------------------------",
    itemsText,
    "--------------------------------",
    `TOTAL:                 ${formatPrice(o.total).padStart(9)}`,
    "--------------------------------",
    `CLIENTE: ${o.name}`,
    `TEL:     ${o.phone}`,
  ];

  if (o.delivery && o.address) {
    lines.push(`DIR:     ${o.address}`);
  }

  lines.push("--------------------------------\n");

  return lines.join("\n");
}

// Componente de impresión física para ticketera térmica de 80mm
// Ocupa el ancho completo (76mm útiles), tipografía sans-serif gruesa de alto contraste
// que quema nítido en el cabezal térmico sin verse borroso ni encogerse.
export function ThermalPrintArea({ order }: { order: Order | null }) {
  if (!order) return null;

  const dateObj = new Date(order.createdAt);
  const timeStr = dateObj.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true });
  const dateStr = dateObj.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const canal = order.delivery ? "DELIVERY A DOMICILIO" : "RECOJO EN TIENDA";

  return (
    <div id="thermal-print-area">
      {/* Encabezado */}
      <div style={{ textAlign: "center", borderBottom: "3px solid #000", paddingBottom: "6px", marginBottom: "8px" }}>
        <div style={{ fontSize: "24px", fontWeight: "900", letterSpacing: "1px", margin: "0 0 2px 0", textTransform: "uppercase" }}>
          LOBO BURGER
        </div>
        <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Surquillo & San Juan de Miraflores
        </div>
      </div>

      {/* Recuadro Destacado de Comanda para Cocina */}
      <div style={{ border: "3px solid #000", padding: "6px 4px", textAlign: "center", margin: "6px 0" }}>
        <div style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>
          NÚMERO DE COMANDA
        </div>
        <div style={{ fontSize: "32px", fontWeight: "900", lineHeight: "1.1", margin: "2px 0" }}>
          #{order.id}
        </div>
        <div style={{ fontSize: "13px", fontWeight: "900", marginTop: "2px", textTransform: "uppercase" }}>
          *** {canal} ***
        </div>
      </div>

      {/* Fecha y hora */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "800", borderBottom: "2px dashed #000", paddingBottom: "4px", marginBottom: "6px" }}>
        <span>FECHA: {dateStr}</span>
        <span>HORA: {timeStr}</span>
      </div>

      {/* Detalle de Productos */}
      <div style={{ marginBottom: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: "900", borderBottom: "1px solid #000", paddingBottom: "3px", marginBottom: "5px" }}>
          <span>CANT / DESCRIPCIÓN</span>
          <span>SUBTOTAL</span>
        </div>
        {order.items.map((it, idx) => (
          <div key={idx} style={{ marginBottom: "5px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: "15px", fontWeight: "800", lineHeight: "1.2" }}>
              <span style={{ paddingRight: "6px" }}>
                <strong>{it.qty}x</strong> {it.name}
              </span>
              <span style={{ whiteSpace: "nowrap" }}>
                {formatPrice(it.price * it.qty)}
              </span>
            </div>
            {(it.pan || it.papas) && (
              <div style={{ fontSize: "12px", fontWeight: "900", paddingLeft: "10px", textTransform: "uppercase" }}>
                {it.pan && <>+ PAN: {it.pan}<br /></>}
                {it.papas && <>+ PAPAS: {it.papas}</>}
              </div>
            )}
            {it.cremas && it.cremas.length > 0 && (
              <div style={{ fontSize: "12px", fontWeight: "900", paddingLeft: "10px", textTransform: "uppercase" }}>
                + CREMAS: {it.cremas.join(" / ")}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Total destacado */}
      <div style={{ borderTop: "3px solid #000", borderBottom: "3px solid #000", padding: "6px 0", margin: "6px 0", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "18px", fontWeight: "900" }}>TOTAL:</span>
        <span style={{ fontSize: "24px", fontWeight: "900" }}>{formatPrice(order.total)}</span>
      </div>

      {/* Estado del pago */}
      <div style={{ fontSize: "12px", fontWeight: "800", marginBottom: "6px" }}>
        ESTADO: <u>PAGADO ({order.culqiChargeId ? "YAPE / TARJETA" : "CONFIRMADO"})</u>
      </div>

      {/* Datos del Cliente y Despacho */}
      <div style={{ borderTop: "2px dashed #000", paddingTop: "6px", fontSize: "13px", fontWeight: "800", lineHeight: "1.3" }}>
        <div style={{ marginBottom: "3px" }}>
          <strong>CLIENTE:</strong> {order.name}
        </div>
        <div style={{ marginBottom: "3px" }}>
          <strong>TELÉFONO:</strong> {order.phone}
        </div>
        {order.delivery && (
          <div style={{ marginTop: "4px" }}>
            <strong>DIRECCIÓN:</strong>
            <div style={{ fontSize: "14px", fontWeight: "900", marginTop: "1px" }}>
              {order.address}
            </div>
          </div>
        )}
      </div>

      {/* Espaciador de corte de papel */}
      <div style={{ borderTop: "2px dashed #000", marginTop: "8px", paddingTop: "4px", textAlign: "center", fontSize: "10px", fontWeight: "700" }}>
        *** FIN DE COMANDA ***
      </div>
    </div>
  );
}

// Modal de vista previa en pantalla
export function ThermalTicketModal({ order, onClose }: ThermalTicketModalProps) {
  const [copied, setCopied] = useState(false);

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatTicketText(order));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const dateFormatted = new Date(order.createdAt).toLocaleString("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-neutral-800"
        style={{ background: "#141414" }}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-neutral-800 bg-neutral-900/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-yellow-400/15 flex items-center justify-center text-yellow-400">
              <Printer size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-white uppercase tracking-wider">Comanda Térmica 80mm</p>
              <p className="text-[10px] text-neutral-400 font-mono">Pedido #{order.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto bg-neutral-950 flex justify-center">
          <div
            className="w-full max-w-[340px] p-5 rounded shadow-lg text-black font-sans text-xs leading-relaxed select-text"
            style={{
              background: "#FFFDF7",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              borderTop: "3px dashed #CCC",
              borderBottom: "3px dashed #CCC",
            }}
          >
            <div className="text-center pb-3 border-b-2 border-black">
              <p className="font-black text-lg tracking-wider">LOBO BURGER</p>
              <p className="text-[10px] font-bold text-neutral-700">Surquillo & San Juan de Miraflores</p>
            </div>

            <div className="my-3 p-2 border-2 border-black text-center">
              <div className="text-[10px] font-bold tracking-wider text-neutral-600">NÚMERO DE COMANDA</div>
              <div className="text-2xl font-black">#{order.id}</div>
              <div className="text-xs font-black text-red-700 mt-0.5">
                {order.delivery ? "*** DELIVERY ***" : "*** RECOJO ***"}
              </div>
            </div>

            <div className="py-2 border-b border-dashed border-neutral-400 text-[11px] font-semibold flex justify-between">
              <span>{dateFormatted}</span>
            </div>

            <div className="py-3 border-b-2 border-black">
              <div className="flex justify-between text-[10px] font-bold text-neutral-500 mb-1.5 pb-1 border-b border-neutral-300">
                <span>CANT / DESCRIPCIÓN</span>
                <span>SUBTOTAL</span>
              </div>
              <div className="space-y-1.5 text-sm">
                {order.items.map((it, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between items-start font-bold">
                      <span className="pr-2 leading-tight">
                        {it.qty}x {it.name}
                      </span>
                      <span className="shrink-0">{formatPrice(it.price * it.qty)}</span>
                    </div>
                    {(it.pan || it.papas) && (
                      <div className="text-[10px] font-semibold text-neutral-600 pl-3">
                        {[it.pan, it.papas].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {it.cremas && it.cremas.length > 0 && (
                      <div className="text-[10px] font-semibold text-neutral-600 pl-3">
                        Cremas: {it.cremas.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="py-3 border-b-2 border-black flex justify-between items-baseline font-black">
              <span className="text-base">TOTAL:</span>
              <span className="text-xl">{formatPrice(order.total)}</span>
            </div>

            <div className="pt-3 text-[11px] font-semibold space-y-1">
              <div>
                <span className="text-neutral-500 text-[10px] block">CLIENTE:</span>
                <span className="font-bold text-xs">{order.name}</span>
              </div>
              <div>
                <span className="text-neutral-500 text-[10px] block">TELÉFONO:</span>
                <span className="font-bold">{order.phone}</span>
              </div>
              {order.delivery && (
                <div>
                  <span className="text-neutral-500 text-[10px] block">DIRECCIÓN:</span>
                  <span className="font-bold text-xs leading-tight block">{order.address}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-800 bg-neutral-900/60 flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors shrink-0"
            title="Copiar texto plano para WhatsApp"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? "Copiado" : "Copiar"}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-yellow-400 text-black hover:bg-yellow-300 active:scale-95 transition-all shadow-lg"
          >
            <Printer size={16} />
            <span>Imprimir en Ticketera (80mm)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function PrinterHelpModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-neutral-800 space-y-4"
        style={{ background: "#141414", color: "#fff" }}
      >
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-yellow-400" />
            <h2 className="font-bebas text-xl tracking-wider text-white">CONFIGURAR IMPRESORA TÉRMICA (80MM)</h2>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 text-xs leading-relaxed text-neutral-300">
          <div className="p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20 text-yellow-300 flex items-start gap-2">
            <Info size={16} className="shrink-0 mt-0.5" />
            <span>
              La comanda está formateada para ocupar el ancho completo de bobinas estándar de <strong>80mm</strong> (Epson, Xprinter, Rongta, Sunmi, etc.).
            </span>
          </div>

          <div>
            <p className="font-bold text-white mb-1">1. Ajuste único de impresión en el navegador:</p>
            <ul className="list-disc list-inside space-y-1 text-neutral-400 pl-1">
              <li>Destino: Tu impresora térmica de 80mm.</li>
              <li>Márgenes: <strong>Ninguno (None)</strong>.</li>
              <li>Gráficos de fondo: <strong>Activado</strong>.</li>
              <li>Encabezados y pies de página: <strong>Desactivado</strong>.</li>
              <li>
                Si Chrome muestra un tamaño de papel <strong>&quot;Personalizado&quot;</strong> con un
                ancho distinto a 80mm (por ejemplo 91mm), cambialo a <strong>80mm</strong> — con otro
                ancho la comanda sale achicada para encajar en esa medida.
              </li>
            </ul>
          </div>

          <div>
            <p className="font-bold text-white mb-1">2. Modo Silencioso Automático (Kiosk Printing):</p>
            <p className="text-neutral-400">
              Para imprimir sin que aparezca la ventana emergente de confirmación:
            </p>
            <code className="block mt-1.5 p-2 rounded bg-neutral-900 border border-neutral-800 font-mono text-[11px] text-emerald-400 select-all">
              chrome.exe --kiosk-printing --app=https://loboburger.com/admin
            </code>
          </div>
        </div>

        <div className="pt-3 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
