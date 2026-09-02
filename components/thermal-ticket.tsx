"use client";

import React, { useState } from "react";
import type { Order } from "@/lib/orders-store";
import { formatPrice } from "@/lib/utils";
import { Printer, X, Copy, Check, Info } from "lucide-react";

interface ThermalTicketModalProps {
  order: Order | null;
  onClose: () => void;
}

export function formatTicketText(o: Order): string {
  const dateStr = new Date(o.createdAt).toLocaleString("es-PE", {
    dateStyle: "short",
    timeStyle: "medium",
  });
  const canal = o.delivery ? "*** DELIVERY A DOMICILIO ***" : "*** RECOJO EN TIENDA ***";
  const itemsText = o.items
    .map(it => `${it.qty}x ${it.name.padEnd(24).slice(0, 24)} ${formatPrice(it.price * it.qty).padStart(9)}`)
    .join("\n");

  return `==========================================
               LOBO BURGER
  Hamburguesas & Salchipapas Artesanales
     Surquillo & San Juan de Miraflores
==========================================
COMANDA:  #${o.id}
FECHA:    ${dateStr}
CANAL:    ${canal}
==========================================
CANT  DESCRIPCION                    TOTAL
------------------------------------------
${itemsText}
------------------------------------------
TOTAL:                         ${formatPrice(o.total).padStart(11)}
==========================================
ESTADO:   ${o.culqiChargeId ? "PAGADO (Culqi / Yape)" : "PAGADO"}
------------------------------------------
DATOS DE ENTREGA:
CLIENTE:   ${o.name}
TELEFONO:  ${o.phone}
${o.delivery ? `DIRECCION: ${o.address}` : "MODALIDAD: RECOJO EN LOCAL"}
==========================================
           www.loboburger.com
    ¡Gracias por elegir Lobo Burger!
------------------------------------------`;
}

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
      {/* Contenedor del Modal */}
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-neutral-800"
        style={{ background: "#141414" }}
      >
        {/* Cabecera del modal */}
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

        {/* Vista previa del papel térmico */}
        <div className="p-5 overflow-y-auto bg-neutral-950 flex justify-center">
          <div
            className="w-full max-w-[340px] p-5 rounded shadow-lg text-black font-mono text-xs leading-relaxed select-text"
            style={{
              background: "#FFFDF7",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              borderTop: "3px dashed #CCC",
              borderBottom: "3px dashed #CCC",
            }}
          >
            {/* Encabezado ticket */}
            <div className="text-center pb-3 border-b border-dashed border-neutral-400">
              <p className="font-black text-base tracking-wider">LOBO BURGER</p>
              <p className="text-[10px] text-neutral-600">Hamburguesas & Broaster Artesanal</p>
              <p className="text-[9px] text-neutral-500 mt-0.5">Surquillo & San Juan de Miraflores</p>
            </div>

            {/* Metadatos comanda */}
            <div className="py-2.5 border-b border-dashed border-neutral-400 text-[11px] space-y-0.5">
              <div className="flex justify-between items-center">
                <span className="font-bold">COMANDA:</span>
                <span className="font-black text-sm">#{order.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">FECHA:</span>
                <span>{dateFormatted}</span>
              </div>
              <div className="flex justify-between font-bold mt-1">
                <span>CANAL:</span>
                <span className={order.delivery ? "text-red-700" : "text-emerald-700"}>
                  {order.delivery ? "DELIVERY A DOMICILIO" : "RECOJO EN TIENDA"}
                </span>
              </div>
            </div>

            {/* Detalle de items */}
            <div className="py-3 border-b border-dashed border-neutral-400">
              <div className="flex justify-between text-[10px] font-bold text-neutral-500 mb-1.5 pb-1 border-b border-neutral-300">
                <span>CANT / DESCRIPCION</span>
                <span>SUBTOTAL</span>
              </div>
              <div className="space-y-1.5 text-xs">
                {order.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-start">
                    <span className="font-bold pr-2 leading-tight">
                      {it.qty}x {it.name}
                    </span>
                    <span className="shrink-0 font-medium">{formatPrice(it.price * it.qty)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totales */}
            <div className="py-2.5 border-b border-dashed border-neutral-400">
              <div className="flex justify-between items-baseline font-black text-sm pt-1">
                <span>TOTAL:</span>
                <span className="text-base">{formatPrice(order.total)}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-neutral-600 mt-1">
                <span>ESTADO PAGO:</span>
                <span className="font-bold text-emerald-800">
                  {order.culqiChargeId ? "PAGADO CON YAPE / TARJETA" : "PAGADO"}
                </span>
              </div>
            </div>

            {/* Datos del cliente para despacho */}
            <div className="pt-2.5 pb-1 text-[11px] space-y-1">
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
                  <span className="font-bold leading-tight block">{order.address}</span>
                </div>
              )}
            </div>

            {/* Pie de ticket */}
            <div className="mt-4 pt-2 text-center text-[9px] text-neutral-500 border-t border-dashed border-neutral-300">
              <p className="font-bold text-black">www.loboburger.com</p>
              <p className="mt-0.5">Comanda lista para cocina y despacho</p>
            </div>
          </div>
        </div>

        {/* Barra de acciones */}
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

      {/* ÁREA DE IMPRESIÓN OCULTA (@media print) */}
      <div id="thermal-print-area" className="hidden print:block">
        <pre className="font-mono text-black text-[12px] leading-tight m-0 whitespace-pre">
          {formatTicketText(order)}
        </pre>
      </div>
    </div>
  );
}

// Modal informativo de configuración de impresora para el local
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
              La comanda está formateada exactamente para rollos estándar de <strong>80mm</strong> (Epson, Xprinter, Rongta, Sunmi o cualquier impresora térmica USB/Red/Bluetooth).
            </span>
          </div>

          <div>
            <p className="font-bold text-white mb-1">1. Ajuste único de impresión en el navegador:</p>
            <ul className="list-disc list-inside space-y-1 text-neutral-400 pl-1">
              <li>Destino: Selecciona tu impresora térmica de 80mm.</li>
              <li>Márgenes: <strong>Ninguno (None)</strong>.</li>
              <li>Gráficos de fondo: <strong>Activado</strong>.</li>
              <li>Encabezados y pies de página: <strong>Desactivado</strong> (para que no salga la URL ni fecha de Chrome).</li>
            </ul>
          </div>

          <div>
            <p className="font-bold text-white mb-1">2. Modo Silencioso Automático (Kiosk Printing):</p>
            <p className="text-neutral-400">
              Si deseas que la comanda se imprima al instante <strong>sin mostrar la ventana de vista previa</strong>, puedes iniciar Google Chrome o Edge con el parámetro:
            </p>
            <code className="block mt-1.5 p-2 rounded bg-neutral-900 border border-neutral-800 font-mono text-[11px] text-emerald-400 select-all">
              chrome.exe --kiosk-printing
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
