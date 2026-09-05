"use client";

import Image from "next/image";
import Link from "next/link";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Order, OrderStatus } from "@/lib/orders-store";
import { buildWhatsAppUrl } from "@/lib/cart-context";
import { scheduleAutoPrint, type AutoPrintHandle } from "@/lib/auto-print";
import { createChimeGate } from "@/lib/chime-gate";
import { persistOrderTransition } from "@/lib/order-transition";
import { ThermalTicketModal, ThermalPrintArea, PrinterHelpModal } from "@/components/thermal-ticket";
import { Sparkles,
  LayoutDashboard,
  ExternalLink,
  ShoppingBag,
  Users,
  RefreshCw,
  ClipboardCheck,
  Check,
  X,
  Flame,
  Clock,
  Volume2,
  VolumeX,
  RotateCcw,
  GripVertical,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  LogOut,
  ArrowLeft,
  Printer,
  HelpCircle,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

const YELLOW = "#FFD600";

type Tab = "dashboard" | "pedidos" | "clientes" | "validar";

const statusConfig: Record<OrderStatus, { label: string; border: string; bg: string; next: OrderStatus | null }> = {
  pendiente:      { label: "Pendiente",      border: "#FFD600", bg: "rgba(255,214,0,0.1)",  next: "en_preparacion" },
  en_preparacion: { label: "En preparacion", border: "#F39C12", bg: "rgba(243,156,18,0.1)", next: "listo"          },
  listo:          { label: "Listo",          border: "#2ecc71", bg: "rgba(46,204,113,0.1)", next: "entregado"      },
  entregado:      { label: "Entregado",      border: "#555",    bg: "rgba(80,80,80,0.1)",   next: null             },
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return "hace un momento";
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

function isToday(iso: string): boolean {
  const d = new Date(iso), now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}


// Singleton AudioContext para evitar fugas de recursos en el monitor de cocina
let globalAudioCtx: AudioContext | null = null;
// Gate compartido entre los tres emisores (polling, interval del timbre
// persistente, simulacion) para que el chime inmediato de un pedido entrante
// nunca solape con un tick del timbre persistente en un doble beep.
const chimeGate = createChimeGate();
function playOrderChime() {
  if (!chimeGate.shouldPlay(Date.now())) return;
  try {
    if (!globalAudioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      globalAudioCtx = new AudioContextClass();
    }
    if (globalAudioCtx.state === "suspended") {
      globalAudioCtx.resume();
    }
    const t = globalAudioCtx.currentTime;

    const osc1 = globalAudioCtx.createOscillator();
    const gain1 = globalAudioCtx.createGain();
    osc1.frequency.setValueAtTime(880, t);
    gain1.gain.setValueAtTime(0.25, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc1.connect(gain1);
    gain1.connect(globalAudioCtx.destination);
    osc1.start(t);
    osc1.stop(t + 0.3);

    const osc2 = globalAudioCtx.createOscillator();
    const gain2 = globalAudioCtx.createGain();
    osc2.frequency.setValueAtTime(1318.5, t + 0.1);
    gain2.gain.setValueAtTime(0.3, t + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc2.connect(gain2);
    gain2.connect(globalAudioCtx.destination);
    osc2.start(t + 0.1);
    osc2.stop(t + 0.5);
  } catch {
    // Ignorar si el navegador bloquea audio antes de la primera interacción
  }
}

function minutesAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

// Reenvio manual del pedido al numero de Jaime (923368745), que el luego
// pasa a su motorizado. wa.me solo abre el chat con el texto listo -- un
// envio automatico real requeriria API de WhatsApp Business (Twilio/Meta),
// fuera de alcance para hoy.
const DELIVERY_FORWARD_NUMBER = "51923368745";

// ─── ValidarTab ───────────────────────────────────────────────────────────────

type Toast = { ok: boolean; text: string };
type RedeemLookup = {
  valid: boolean;
  code: string;
  rewardName: string;
  rewardPts: number;
  clientName: string;
  clientPhone: string;
} | null;

function ValidarTab() {
  const [phone,   setPhone]   = useState("");
  const [amount,  setAmount]  = useState("");
  const [orderId, setOrderId] = useState("");
  const [toast,   setToast]   = useState<Toast | null>(null);

  const [redeemCode,   setRedeemCode]   = useState("");
  const [redeemLookup, setRedeemLookup] = useState<RedeemLookup>(null);

  const showToast = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddPoints = () => {
    const pts = Math.floor(parseFloat(amount));
    if (!pts || pts <= 0 || !phone.trim()) return;
    try {
      const raw = localStorage.getItem("lobo_member");
      if (raw) {
        const m = JSON.parse(raw);
        if (m.phone === phone.trim()) {
          m.points = (m.points ?? 0) + pts;
          m.history = m.history ?? [];
          m.history.unshift({
            date: new Date().toLocaleDateString("es-PE"),
            desc: orderId.trim() ? `Pedido ${orderId.trim()}` : "Pedido validado",
            pts,
          });
          localStorage.setItem("lobo_member", JSON.stringify(m));

          showToast({ ok: true, text: `+${pts} Wolfpoints → ${m.name}` });
          setPhone(""); setAmount(""); setOrderId("");
          return;
        }
      }
      showToast({ ok: false, text: "Cliente no encontrado en La Manada — puedes registrar el pedido igualmente" });
    } catch {
      showToast({ ok: false, text: "Error al procesar" });
    }
  };

  const handleVerify = () => {
    const code = redeemCode.trim().toUpperCase();
    if (!code) return;
    try {
      const list = JSON.parse(localStorage.getItem("lobo_redemptions") || "[]");
      const found = list.find((r: { code: string; usedAt: string | null }) => r.code === code);
      if (found && !found.usedAt) {
        setRedeemLookup({ valid: true, code: found.code, rewardName: found.rewardName, rewardPts: found.rewardPts, clientName: found.clientName, clientPhone: found.clientPhone });
      } else {
        setRedeemLookup({ valid: false, code: "", rewardName: "", rewardPts: 0, clientName: "", clientPhone: "" });
      }
    } catch {
      setRedeemLookup({ valid: false, code: "", rewardName: "", rewardPts: 0, clientName: "", clientPhone: "" });
    }
  };

  const handleMarkUsed = () => {
    if (!redeemLookup?.valid) return;
    try {
      const list = JSON.parse(localStorage.getItem("lobo_redemptions") || "[]");
      const updated = list.map((r: { code: string; usedAt: string | null }) =>
        r.code === redeemLookup.code ? { ...r, usedAt: new Date().toISOString() } : r
      );
      localStorage.setItem("lobo_redemptions", JSON.stringify(updated));

      // Descontar puntos del miembro
      const raw = localStorage.getItem("lobo_member");
      if (raw) {
        const m = JSON.parse(raw);
        if (m.phone === redeemLookup.clientPhone) {
          m.points = Math.max(0, (m.points ?? 0) - redeemLookup.rewardPts);
          m.history = m.history ?? [];
          m.history.unshift({
            date: new Date().toLocaleDateString("es-PE"),
            desc: `Canje: ${redeemLookup.rewardName}`,
            pts: -redeemLookup.rewardPts,
          });
          localStorage.setItem("lobo_member", JSON.stringify(m));
        }
      }

      showToast({ ok: true, text: `Canje marcado como usado — ${redeemLookup.rewardName}` });
      setRedeemLookup(null);
      setRedeemCode("");
    } catch {
      showToast({ ok: false, text: "Error al marcar canje" });
    }
  };

  const sectionTitle = "text-sm font-bold text-white mb-3";
  const inputCls = "w-full rounded-lg py-2.5 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-offset-0";
  const inputStyle = { background: "#0a0a0a", border: "1px solid #252525" };

  return (
    <div className="max-w-lg">
      <h1 className="font-bebas text-3xl md:text-4xl tracking-widest mb-6">
        VALIDAR <span style={{ color: "#DC2626" }}>CONSUMO</span>
      </h1>

      {toast && (
        <div
          className="flex items-center gap-2 rounded-lg px-4 py-3 mb-5 text-sm font-semibold"
          style={{
            background: toast.ok ? "rgba(46,204,113,0.1)" : "rgba(220,38,38,0.1)",
            border: `1px solid ${toast.ok ? "rgba(46,204,113,0.3)" : "rgba(220,38,38,0.3)"}`,
            color: toast.ok ? "#2ecc71" : "#DC2626",
          }}
        >
          {toast.ok ? <Check size={16} /> : <X size={16} />}
          {toast.text}
        </div>
      )}

      {/* A) Agregar puntos */}
      <div className="rounded-xl p-5 mb-5" style={{ background: "#141414", border: "1px solid #1f1f1f" }}>
        <p className={sectionTitle}>Validar pedido de WhatsApp</p>
        <div className="h-px mb-4" style={{ background: "#1f1f1f" }} />
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "#555" }}>Teléfono del cliente</label>
            <input
              type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="9XXXXXXXX" className={inputCls} style={inputStyle}
            />
          </div>
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "#555" }}>Monto del pedido (S/)</label>
            <input
              type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00" min={1} className={inputCls} style={inputStyle}
            />
          </div>
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "#555" }}>ID pedido WhatsApp (opcional)</label>
            <input
              type="text" value={orderId} onChange={(e) => setOrderId(e.target.value)}
              placeholder="LB-1234567890" className={inputCls} style={inputStyle}
            />
          </div>
          <button
            onClick={handleAddPoints}
            disabled={!phone.trim() || !amount || parseFloat(amount) <= 0}
            className="w-full py-3 rounded-lg font-bold text-sm transition-all hover:opacity-80 disabled:opacity-30 mt-1"
            style={{ background: "#2ecc71", color: "#0a0a0a" }}
          >
            Validar y agregar puntos
          </button>
        </div>
      </div>

      {/* B) Validar canje */}
      <div className="rounded-xl p-5" style={{ background: "#141414", border: "1px solid #1f1f1f" }}>
        <p className={sectionTitle}>Validar código de canje</p>
        <div className="h-px mb-4" style={{ background: "#1f1f1f" }} />
        <div>
          <label className="text-xs mb-1.5 block" style={{ color: "#555" }}>Código del cliente</label>
          <input
            type="text" value={redeemCode}
            onChange={(e) => { setRedeemCode(e.target.value); setRedeemLookup(null); }}
            placeholder="WP-ABCD-1234"
            className={`${inputCls} uppercase tracking-widest font-bold`}
            style={inputStyle}
          />
        </div>
        <button
          onClick={handleVerify}
          disabled={!redeemCode.trim()}
          className="w-full py-3 rounded-lg font-bold text-sm transition-all hover:opacity-80 disabled:opacity-30 mt-3"
          style={{ background: "#FFD600", color: "#0a0a0a" }}
        >
          Verificar código
        </button>

        {redeemLookup && (
          <div
            className="rounded-lg p-4 mt-4"
            style={{
              background: redeemLookup.valid ? "rgba(46,204,113,0.07)" : "rgba(220,38,38,0.07)",
              border: `1px solid ${redeemLookup.valid ? "rgba(46,204,113,0.3)" : "rgba(220,38,38,0.3)"}`,
            }}
          >
            {redeemLookup.valid ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Check size={16} style={{ color: "#2ecc71" }} />
                  <span className="font-bold text-sm" style={{ color: "#2ecc71" }}>CÓDIGO VÁLIDO</span>
                </div>
                <p className="text-sm text-white font-semibold">{redeemLookup.rewardName}</p>
                <p className="text-xs mt-1" style={{ color: "#888" }}>
                  Cliente: {redeemLookup.clientName} — {redeemLookup.clientPhone}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#555" }}>
                  Descuento: {redeemLookup.rewardPts} Wolfpoints
                </p>
                <button
                  onClick={handleMarkUsed}
                  className="w-full py-2.5 rounded-lg font-bold text-sm mt-4 transition-all hover:opacity-80"
                  style={{ background: "#2ecc71", color: "#0a0a0a" }}
                >
                  Marcar como canjeado
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <X size={16} style={{ color: "#DC2626" }} />
                <span className="text-sm font-bold" style={{ color: "#DC2626" }}>
                  Código no válido o ya fue canjeado
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AdminPage ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab,    setTab]    = useState<Tab>("pedidos");
  const [orders, setOrders] = useState<Order[]>([]);
  // Ids de pedidos cuya transicion a en_preparacion no se pudo persistir en Supabase.
  const [failedTransitions, setFailedTransitions] = useState<string[]>([]);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [showPrinterHelp, setShowPrinterHelp] = useState(false);
  const [autoPrint, setAutoPrint] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const saved = localStorage.getItem("lobo_auto_print");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });
  const autoPrintRef = useRef(true);
  useEffect(() => {
    autoPrintRef.current = autoPrint;
  }, [autoPrint]);

  // Limpieza automática tras la impresión para no bloquear la pantalla del cocinero
  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintingOrder(null);
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  // Función para simular un pedido entrante en vivo (prueba de timbre y ticketera)
  const handleSimularPedido = async () => {
    // Prefijo LB-SIM- (en vez de LB-<4 digitos>) para que nunca choque con un
    // codigo real (que usa el mismo esquema de timestamp en base36, sin este
    // prefijo) y para que el filtro `id.startsWith("LB-SIM")` de refresh()
    // — mas abajo — deje de ser un chequeo muerto.
    const simCode = `LB-SIM-${Date.now().toString(36).toUpperCase()}`;
    const simOrder: Order = {
      id: simCode,
      createdAt: new Date().toISOString(),
      name: "Jaime Lobo (Simulación)",
      phone: "987654321",
      email: "jaime@loboburger.com",
      delivery: true,
      address: "Av. Angamos Este 1551, Surquillo",
      items: [
        { id: 5, name: "Burgazo", price: 28, qty: 1 },
        { id: 13, name: "Combo Lobo", price: 25, qty: 1 },
      ],
      total: 53,
      status: "pendiente",
    };

    // 1. Evitar que el polling lo trate como nuevo duplicado
    knownOrderIdsRef.current.add(simOrder.id);

    // 2. Insertar inmediatamente en la columna de pendientes del KDS
    setOrders(prev => [simOrder, ...prev]);

    // 3. Sonar campana de cocina
    if (audioEnabledRef.current) {
      playOrderChime();
    }

    // 4. Disparar impresión térmica automática
    setPrintingOrder(simOrder);
    setTimeout(() => {
      window.print();
    }, 400);

    // 5. Guardar en base de datos si está disponible. Los nombres de campo
    // deben calzar con lo que espera POST /api/admin/pedidos (codigo,
    // cliente_*, direccion, total_centimos) — si no, el servidor genera su
    // propio codigo al azar, distinto al que ya se muestra en el KDS, y esa
    // fila "fantasma" vuelve a entrar por el polling como pedido nuevo.
    try {
      await fetch("/api/admin/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: simOrder.id,
          name: simOrder.name,
          phone: simOrder.phone,
          email: simOrder.email,
          delivery: simOrder.delivery,
          address: simOrder.address,
          items: simOrder.items,
          total_centimos: Math.round(simOrder.total * 100),
        }),
      });
    } catch {
      // Ignorar si está offline
    }
  };

  const handleToggleAutoPrint = () => {
    setAutoPrint(prev => {
      const next = !prev;
      autoPrintRef.current = next;
      try {
        localStorage.setItem("lobo_auto_print", String(next));
      } catch {}
      return next;
    });
  };
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pedidosView, setPedidosView] = useState<"kds" | "historial">("kds");
  const [channelFilter, setChannelFilter] = useState<"todos" | "delivery" | "pickup">("todos");

  // KDS Interactivo & Recuperación de Errores
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<OrderStatus | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const audioEnabledRef = useRef(true);
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);
  const [undoAction, setUndoAction] = useState<{ id: string; prev: OrderStatus; next: OrderStatus } | null>(null);

  const prevPendingRef = useRef<number | null>(null);
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Guarda el handle devuelto por scheduleAutoPrint del batch en curso. Nunca
  // acumula mas de un grupo: al llegar un batch nuevo se cancela el anterior
  // (una sola secuencia de impresion activa a la vez, guardrail #5) y en el
  // cleanup del efecto de polling se cancela el que quede si /admin se
  // desmonta a mitad del escalonado.
  const printHandlesRef = useRef<AutoPrintHandle<Order>[]>([]);

  // Los pedidos vienen de Supabase, no del localStorage de este navegador:
  // antes el panel solo veia los pedidos hechos en el mismo dispositivo.
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pedidos");
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      if (!res.ok) return;
      setIsAuthenticated(true);
      const { pedidos } = await res.json();
      const mapped: Order[] = (pedidos ?? []).map((p: Record<string, unknown>) => ({
        id: p.codigo as string,
        createdAt: p.created_at as string,
        name: p.cliente_nombre as string,
        phone: p.cliente_telefono as string,
        email: p.cliente_email as string,
        delivery: p.delivery as boolean,
        address: (p.direccion as string) ?? "",
        lat: typeof p.lat === "number" ? p.lat : undefined,
        lng: typeof p.lng === "number" ? p.lng : undefined,
        items: p.items as Order["items"],
        total: (p.total_centimos as number) / 100,
        status: p.estado as OrderStatus,
      }));

      // Purgar de failedTransitions los ids cuyo pedido ya no esta en pendiente:
      // la DB confirmo la transicion por otra via (p.ej. el boton manual).
      const stillPendingIds = new Set(mapped.filter(o => o.status === "pendiente").map(o => o.id));
      setFailedTransitions(prev => {
        const next = prev.filter(id => stillPendingIds.has(id));
        return next.length === prev.length ? prev : next;
      });

      // Preservar pedidos simulados en local para que no desaparezcan al refrescar
      setOrders(prev => {
        const localSim = prev.filter(o => o.name.includes("Simulación") || o.id.startsWith("LB-SIM"));
        const apiIds = new Set(mapped.map(m => m.id));
        const remainingLocal = localSim.filter(l => !apiIds.has(l.id));
        return [...remainingLocal, ...mapped];
      });

      const pendingOrders = mapped.filter(o => o.status === "pendiente");
      const newPending = pendingOrders.length;

      if (initialLoadRef.current) {
        // En la primera carga, registrar IDs existentes sin disparar impresión
        mapped.forEach(o => knownOrderIdsRef.current.add(o.id));
        initialLoadRef.current = false;
      } else {
        // Detectar nuevos pedidos que ingresan en vivo desde la web
        const incomingOrders = pendingOrders.filter(o => !knownOrderIdsRef.current.has(o.id));
        incomingOrders.forEach(o => knownOrderIdsRef.current.add(o.id));

        if (incomingOrders.length > 0) {
          if (audioEnabledRef.current) playOrderChime();

          // Auto-impresión directa y secuencial en ticketera térmica (80mm)
          // Intervalo de 1.5s entre comandas para evitar bloqueo del spooler de Windows.
          // El pedido pasa a 'en_preparacion' (KDS + PATCH) recién DESPUÉS de que se
          // disparó window.print() de ESA comanda: si la impresión falla, el pedido
          // queda 'pendiente' y el timbre sigue sonando. El id solo se considera
          // resuelto tras persistencia exitosa del PATCH: si el PATCH falla (o
          // devuelve 500), el id se libera de knownOrderIdsRef para que el siguiente
          // refresh() lo vuelva a detectar como entrante y reintente.
          if (autoPrintRef.current) {
            // Cancelar el batch anterior antes de programar uno nuevo: evita que
            // dos secuencias escalonadas compitan por el mismo `printingOrder`.
            // Los pedidos que no llegaron a imprimirse se liberan de
            // knownOrderIdsRef (filtrados contra el batch entrante, que ya se
            // agrego arriba) para que el siguiente refresh() los reimprima.
            const incomingIds = new Set(incomingOrders.map(o => o.id));
            printHandlesRef.current.forEach(handle => {
              handle.cancel().forEach(o => {
                if (!incomingIds.has(o.id)) knownOrderIdsRef.current.delete(o.id);
              });
            });
            printHandlesRef.current = [];

            const handle = scheduleAutoPrint({
              orders: incomingOrders,
              onStage: (toPrint) => setPrintingOrder(toPrint),
              onPrint: () => window.print(),
              onPrinted: (toPrint) => {
                setOrders(list => list.map(o => o.id === toPrint.id ? { ...o, status: "en_preparacion" } : o));
                persistOrderTransition({ codigo: toPrint.id, estado: "en_preparacion" }).then(result => {
                  if (result.ok) {
                    setFailedTransitions(prev => prev.includes(toPrint.id) ? prev.filter(id => id !== toPrint.id) : prev);
                    return;
                  }
                  console.error(`No se pudo persistir en_preparacion para ${toPrint.id}:`, result.reason);
                  setOrders(list => list.map(o => o.id === toPrint.id ? { ...o, status: "pendiente" } : o));
                  knownOrderIdsRef.current.delete(toPrint.id);
                  setFailedTransitions(prev => prev.includes(toPrint.id) ? prev : [...prev, toPrint.id]);
                });
              },
            });
            printHandlesRef.current.push(handle);
          }
        }
      }
      prevPendingRef.current = newPending;

      setOrders(mapped);
    } catch {
      // Sin conexion se deja la ultima lista cargada.
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => {
      clearInterval(interval);
      // Cancelar auto-prints pendientes para que ningun pedido se marque
      // 'en_preparacion' despues de que /admin ya se desmonto. No se liberan
      // ids de knownOrderIdsRef aqui: el componente ya no existe, y un
      // remontaje hace un initialLoadRef fresco.
      printHandlesRef.current.forEach(handle => handle.cancel());
      printHandlesRef.current = [];
    };
  }, [refresh]);

  const handleStatus = async (id: string, next: OrderStatus) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    const prev = order.status;

    // Actualización optimista inmediata
    setOrders(list => list.map(o => o.id === id ? { ...o, status: next } : o));

    setUndoAction({ id, prev, next });
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoAction(null), 6000);

    try {
      await fetch("/api/admin/pedidos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: id, estado: next }),
      });
    } catch {
      // Revertir en fallo de red
      setOrders(list => list.map(o => o.id === id ? { ...o, status: prev } : o));
    }
  };

  const handleUndo = async () => {
    if (!undoAction) return;
    const { id, prev } = undoAction;
    setOrders(list => list.map(o => o.id === id ? { ...o, status: prev } : o));
    setUndoAction(null);

    await fetch("/api/admin/pedidos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: id, estado: prev }),
    });
  };

  const todayOrders = orders.filter(o => isToday(o.createdAt));
  const todayTotal  = todayOrders.reduce((s, o) => s + o.total, 0);
  const pending     = orders.filter(o => o.status === "pendiente").length;

  // Timbre persistente (pedido de Jaime): mientras haya al menos un pedido
  // "pendiente" el sonido se repite, no un solo beep que se pierde con el
  // ruido de cocina. Deja de sonar recien cuando el pedido pasa de estado
  // (confirmado / en preparacion), nunca por timeout. Los chimes pasan por
  // chimeGate, asi que un tick que cae a menos de CHIME_MIN_GAP_MS del chime
  // inmediato de un pedido entrante se omite; la repeticion efectiva queda
  // en <=2.5s.
  useEffect(() => {
    if (pending === 0 || !audioEnabled) return;
    const loop = setInterval(() => {
      if (audioEnabledRef.current) playOrderChime();
    }, 2500);
    return () => clearInterval(loop);
  }, [pending, audioEnabled]);

  const navItems: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Dashboard",  icon: LayoutDashboard },
    { id: "pedidos",   label: "Pedidos",    icon: ShoppingBag     },
    { id: "clientes",  label: "Clientes",   icon: Users           },
    { id: "validar",   label: "Validar",    icon: ClipboardCheck  },
  ];


  const clientMap: Record<string, { name: string; phone: string; count: number; total: number }> = {};
  for (const o of orders) {
    if (!clientMap[o.phone]) clientMap[o.phone] = { name: o.name, phone: o.phone, count: 0, total: 0 };
    clientMap[o.phone].count++;
    clientMap[o.phone].total += o.total;
  }
  const clients = Object.values(clientMap).sort((a, b) => b.total - a.total);


  // Renderizador de Tarjeta de Comanda para el KDS
  function renderKdsCard(o: Order, currentStatus: OrderStatus) {
    const cfg = statusConfig[o.status];
    const mins = minutesAgo(o.createdAt);
    const isUrgent = mins > 20;
    const isWarning = mins >= 10 && mins <= 20;

    // Barra Goal-Gradient de 3 pasos
    const progressPct = currentStatus === "pendiente" ? "33%" : currentStatus === "en_preparacion" ? "66%" : "100%";
    const progressColor = currentStatus === "pendiente" ? YELLOW : currentStatus === "en_preparacion" ? "#F39C12" : "#2ecc71";

    return (
      <div
        key={o.id}
        draggable
        onDragStart={e => {
          setDraggedId(o.id);
          e.dataTransfer.setData("text/plain", o.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        className="rounded-xl p-3.5 flex flex-col justify-between transition-all cursor-grab active:cursor-grabbing hover:border-neutral-700"
        style={{
          background: "#141414",
          border: `1px solid ${cfg.border}40`,
          borderLeft: `4px solid ${cfg.border}`,
        }}
      >
        <div>
          {/* Barra de progreso Goal-Gradient */}
          <div className="w-full h-1 rounded-full mb-2.5 overflow-hidden" style={{ background: "#222" }}>
            <div className="h-full transition-all" style={{ width: progressPct, background: progressColor }} />
          </div>

          {/* Header del Ticket */}
          <div className="flex items-start justify-between gap-2 pb-2 mb-2" style={{ borderBottom: "1px solid #222" }}>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-white">#{o.id}</span>
                {/* Timer SLA */}
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: isUrgent ? "rgba(231,76,60,0.2)" : isWarning ? "rgba(255,214,0,0.15)" : "rgba(46,204,113,0.15)",
                    color: isUrgent ? "#e74c3c" : isWarning ? YELLOW : "#2ecc71",
                    border: `1px solid ${isUrgent ? "#e74c3c" : isWarning ? YELLOW : "#2ecc71"}40`,
                  }}
                >
                  <Clock size={10} />
                  {mins}m
                </span>
              </div>
              <p className="font-bold text-sm text-white mt-1 leading-tight">{o.name}</p>
              <p className="text-xs mt-0.5" style={{ color: "#777" }}>
                {o.phone} &nbsp;|&nbsp; {o.delivery ? `Delivery: ${o.address}` : "Para recoger"}
              </p>
            </div>

            <div className="text-right shrink-0 flex flex-col items-end gap-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.border }}>
                {cfg.label}
              </span>
              <span className="text-[9px] flex items-center gap-0.5" style={{ color: "#444" }}>
                <GripVertical size={10} /> arrastrar
              </span>
            </div>
          </div>

          {/* Lista de Items */}
          <div className="mb-3 space-y-1">
            {o.items.map((item, i) => (
              <div key={i}>
                <p className="text-xs flex items-baseline">
                  <span className="font-bold font-mono mr-1.5" style={{ color: YELLOW }}>{item.qty}x</span>
                  <span className="text-neutral-200">{item.name}</span>
                  <span className="ml-auto font-mono text-[11px]" style={{ color: "#555" }}>
                    {formatPrice(item.price * item.qty)}
                  </span>
                </p>
                {item.cremas && item.cremas.length > 0 && (
                  <p className="text-[10px] pl-5" style={{ color: "#888" }}>Cremas: {item.cremas.join(", ")}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer, Botón de Impresión Térmica & Botón Táctil de 50px */}
        <div>
          <div className="flex items-center justify-between pb-2 mb-2" style={{ borderTop: "1px solid #1c1c1c" }}>
            <span className="font-bebas text-lg" style={{ color: YELLOW }}>
              Total {formatPrice(o.total)}
            </span>
            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
              <Check size={11} /> Pagado
            </span>
          </div>

          {/* Botón Imprimir Comanda Térmica 80mm */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPrintingOrder(o);
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 mb-2 rounded-lg text-[11px] font-bold text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 transition-colors"
            title="Imprimir o previsualizar ticket térmico de comanda (80mm)"
          >
            <Printer size={13} className="text-yellow-400" />
            <span>Imprimir Comanda (80mm)</span>
          </button>

          {/* Botón Reenviar a Delivery (WhatsApp al numero de Jaime) */}
          {o.delivery && (
            <a
              href={buildWhatsAppUrl(o, { to: DELIVERY_FORWARD_NUMBER, includeGps: true })}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-full flex items-center justify-center gap-1.5 py-2 mb-2 rounded-lg text-[11px] font-bold text-emerald-400 hover:text-white bg-neutral-900 hover:bg-emerald-900/40 border border-emerald-900/60 hover:border-emerald-700 transition-colors"
              title="Reenviar contacto, direccion y GPS al delivery por WhatsApp"
            >
              <ExternalLink size={13} />
              <span>Reenviar a Delivery</span>
            </a>
          )}

          {cfg.next ? (
            <button
              onClick={() => handleStatus(o.id, cfg.next!)}
              className="w-full h-12 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow"
              style={{
                background: statusConfig[cfg.next].border,
                color: cfg.next === "listo" ? "#fff" : "#000",
              }}
            >
              {cfg.next === "en_preparacion" ? (
                <>
                  <Flame size={15} /> A LA PLANCHA
                </>
              ) : cfg.next === "listo" ? (
                <>
                  <Check size={15} /> MARCAR COMO LISTO
                </>
              ) : (
                <>
                  <Check size={15} /> {o.delivery ? "DESPACHAR MOTORIZADO" : "ENTREGAR EN MOSTRADOR"}
                </>
              )}
            </button>
          ) : (
            <div className="text-center py-2 text-xs" style={{ color: "#555" }}>
              Pedido entregado
            </div>
          )}
        </div>
      </div>
    );
  }


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUser.trim() || !loginPass.trim()) {
      setLoginError("Ingresa tu usuario y contraseña");
      return;
    }
    setLoginLoading(true);
    setLoginError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: loginUser.trim(), pass: loginPass.trim() }),
      });

      if (res.ok) {
        setIsAuthenticated(true);
        setLoginUser("");
        setLoginPass("");
        refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setLoginError(data.error || "Credenciales incorrectas");
      }
    } catch {
      setLoginError("Error de conexión con el servidor");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    setIsAuthenticated(false);
  };

  // Pantalla de Login Brandeada si no está autenticado
  if (isAuthenticated === false) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{ background: "#080808", color: "#fff" }}
      >
        {/* Fondo sutil con resplandor */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            background: "radial-gradient(circle at 50% 30%, rgba(192,57,43,0.3) 0%, transparent 70%)",
          }}
        />

        <div
          className="w-full max-w-md rounded-2xl p-7 relative z-10 shadow-2xl border"
          style={{ background: "#121212", borderColor: "#222" }}
        >
          {/* Branding Oficial */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="mb-2 transition-transform hover:scale-105">
              <Image
                src="/images/lobo-logo-official-dark.png"
                alt="Lobo Burger"
                width={240}
                height={45}
                priority
                className="h-10 w-auto object-contain"
              />
            </div>
            <p className="font-bebas text-base tracking-widest mt-1 text-white">PANEL OPERATIVO DE COCINA</p>
            <p className="text-xs mt-0.5 text-neutral-500">Ingresa tus credenciales para acceder al KDS</p>
          </div>

          {/* Formulario de Login */}
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div
                className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-center border"
                style={{
                  background: "rgba(231,76,60,0.12)",
                  color: "#e74c3c",
                  borderColor: "rgba(231,76,60,0.3)",
                }}
              >
                {loginError}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Usuario
              </label>
              <div className="relative flex items-center">
                <UserIcon size={16} className="absolute left-3.5 text-neutral-500 pointer-events-none" />
                <input
                  type="text"
                  value={loginUser}
                  onChange={e => setLoginUser(e.target.value)}
                  placeholder="Usuario del sistema"
                  autoFocus
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Contraseña
              </label>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-3.5 text-neutral-500 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginPass}
                  onChange={e => setLoginPass(e.target.value)}
                  placeholder="Contraseña"
                  required
                  className="w-full pl-10 pr-11 py-3 rounded-xl text-sm bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-neutral-500 hover:text-neutral-300 transition-colors p-1"
                  aria-label={showPassword ? "Ocultar clave" : "Mostrar clave"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full h-12 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 mt-2 shadow-lg"
              style={{ background: YELLOW, color: "#000" }}
            >
              {loginLoading ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                "INGRESAR AL PANEL"
              )}
            </button>
          </form>

          {/* Pie del modal */}
          <div className="mt-6 pt-4 border-t border-neutral-900 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <ArrowLeft size={12} />
              Volver a la tienda pública
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#080808", color: "#fff" }}>
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen sticky top-0" style={{ background: "#0F0F0F", borderRight: "1px solid rgba(192,57,43,0.2)" }}>
        <div className="px-5 py-6" style={{ borderBottom: "1px solid rgba(192,57,43,0.2)" }}>
          <Image
            src="/images/lobo-logo-official-dark.png"
            alt="Lobo Burger"
            width={160}
            height={30}
            className="h-6 w-auto object-contain"
          />
          <p className="text-[10px] font-bold tracking-widest mt-1.5" style={{ color: "#C0392B" }}>PANEL ADMIN</p>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-all text-left"
              style={{
                background:  tab === id ? "rgba(192,57,43,0.15)" : "transparent",
                color:       tab === id ? "#C0392B" : "#666",
                borderLeft:  tab === id ? "2px solid #C0392B" : "2px solid transparent",
              }}
            >
              <Icon size={16} />
              {label}
              {id === "pedidos" && pending > 0 && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#C0392B", color: "#fff" }}>
                  {pending}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Enlace Volver a la Tienda y Cerrar Sesión */}
        <div className="p-3 border-t flex flex-col gap-1.5" style={{ borderColor: "#1a1a1a" }}>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white hover:border-neutral-700 transition-all"
            style={{ background: "#141414", border: "1px solid #222" }}
          >
            <span className="flex items-center gap-2">
              <ExternalLink size={13} />
              Volver a la Tienda
            </span>
            <span className="text-[10px] text-neutral-500">↗</span>
          </a>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all text-left"
          >
            <LogOut size={13} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="flex md:hidden items-center justify-between px-4 py-3 sticky top-0 z-40" style={{ background: "#0F0F0F", borderBottom: "1px solid rgba(192,57,43,0.2)" }}>
          <div className="flex items-center gap-2">
            <Image src="/images/lobo-logo-official-dark.png" alt="Lobo Burger" width={110} height={20} className="h-4.5 w-auto object-contain" />
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase" style={{ background: "rgba(192,57,43,0.25)", color: "#E74C3C" }}>ADMIN</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white">
              <ExternalLink size={12} /> Tienda
            </a>
            <button onClick={refresh} aria-label="Actualizar" className="text-white/30 hover:text-white"><RefreshCw size={14} /></button>
          </div>
        </header>

        {/* Mobile tabs */}
        <div className="flex md:hidden overflow-x-auto no-scrollbar px-3 py-2 gap-2 sticky top-12 z-30" style={{ background: "#0F0F0F", borderBottom: "1px solid #1a1a1a" }}>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold"
              style={{ background: tab === id ? "#C0392B" : "#1a1a1a", color: tab === id ? "#fff" : "#666" }}
            >
              <Icon size={12} />
              {label}
              {id === "pedidos" && pending > 0 && (
                <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#fff", color: "#C0392B" }}>{pending}</span>
              )}
            </button>
          ))}
        </div>

        <main className="flex-1 p-4 md:p-6">

          {/* DASHBOARD */}
          {tab === "dashboard" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-bebas text-3xl md:text-4xl tracking-widest">DASHBOARD <span style={{ color: "#C0392B" }}>HOY</span></h1>
                <button onClick={refresh} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white">
                  <RefreshCw size={13} /> Actualizar
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                {[
                  { label: "Pedidos pendientes", value: String(pending),           color: pending > 0 ? "#C0392B" : "#555" },
                  { label: "Pedidos hoy",         value: String(todayOrders.length), color: YELLOW    },
                  { label: "Total vendido hoy",   value: `S/${todayTotal}`,          color: "#2ecc71" },
                  { label: "Pedidos totales",     value: String(orders.length),      color: "#4a9eed" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-4" style={{ background: "#141414", border: "1px solid #1f1f1f" }}>
                    <p className="text-xs mb-2" style={{ color: "#555" }}>{s.label}</p>
                    <p className="font-bebas text-3xl leading-none" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl overflow-hidden" style={{ background: "#141414", border: "1px solid #1f1f1f" }}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid #1f1f1f" }}>
                  <p className="font-semibold text-sm">Pedidos recientes</p>
                </div>
                {orders.length === 0 ? (
                  <p className="text-center py-8 text-sm" style={{ color: "#444" }}>Sin pedidos aun</p>
                ) : (
                  orders.slice(0, 5).map(o => (
                    <div key={o.id} className="px-4 py-3 flex items-center justify-between border-b last:border-0" style={{ borderColor: "#1a1a1a" }}>
                      <div>
                        <p className="text-sm font-semibold">{o.name} <span className="text-xs font-normal" style={{ color: "#555" }}>#{o.id}</span></p>
                        <p className="text-xs mt-0.5" style={{ color: "#555" }}>{o.items.map(i => i.name).join(", ")}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: statusConfig[o.status].bg, color: statusConfig[o.status].border, border: `1px solid ${statusConfig[o.status].border}40` }}>
                          {statusConfig[o.status].label}
                        </span>
                        <p className="text-xs mt-1" style={{ color: "#555" }}>{timeAgo(o.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* PEDIDOS - KDS KANBAN TACTIL CON ESTILOS BASE */}
          {tab === "pedidos" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h1 className="font-bebas text-3xl md:text-4xl tracking-widest leading-none">KDS COCINA</h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(192,57,43,0.2)", color: "#E74C3C", border: "1px solid rgba(192,57,43,0.4)" }}>
                    TACTIL
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const next = !audioEnabled;
                      setAudioEnabled(next);
                      if (next) {
                        chimeGate.reset();
                        playOrderChime();
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors"
                    style={{ background: "#141414", border: "1px solid #222", color: audioEnabled ? "#2ecc71" : "#666" }}
                  >
                    {audioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                    <span className="hidden sm:inline">{audioEnabled ? "Timbre ON" : "Muted"}</span>
                  </button>

                                    {/* Botón para simular pedido web en vivo */}
                  <button
                    onClick={handleSimularPedido}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg transition-all active:scale-95 shadow-md"
                    style={{
                      background: "#FFD600",
                      color: "#7B0000",
                      border: "1px solid #FFD600",
                    }}
                    title="Simular la entrada de un pedido web para probar el timbre y la ticketera"
                  >
                    <Sparkles size={13} />
                    <span>Simular Pedido Web</span>
                  </button>

                  {/* Auto-impresión de comandas & Guía 80mm */}
                  <button
                    onClick={handleToggleAutoPrint}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors"
                    style={{
                      background: autoPrint ? "rgba(255,214,0,0.15)" : "#141414",
                      border: `1px solid ${autoPrint ? YELLOW : "#222"}`,
                      color: autoPrint ? YELLOW : "#666",
                    }}
                    title="Imprimir automáticamente al sonar nuevo pedido"
                  >
                    <Printer size={13} />
                    <span className="hidden sm:inline">Auto-print: {autoPrint ? "ON" : "OFF"}</span>
                  </button>

                  <button
                    onClick={() => setShowPrinterHelp(true)}
                    className="p-1 rounded text-neutral-400 hover:text-white transition-colors"
                    style={{ background: "#141414", border: "1px solid #222" }}
                    title="Guía de configuración para ticketera térmica de 80mm"
                  >
                    <HelpCircle size={13} />
                  </button>
                  <button onClick={refresh} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors">
                    <RefreshCw size={13} /> Actualizar
                  </button>
                </div>
              </div>

              {/* Banner de transiciones fallidas: PATCH a en_preparacion que no persistio */}
              {failedTransitions.length > 0 && (
                <div
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold mb-4"
                  style={{
                    background: "rgba(231,76,60,0.12)",
                    color: "#e74c3c",
                    border: "1px solid rgba(231,76,60,0.3)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <X size={14} />
                    <span>
                      {failedTransitions.length} pedido{failedTransitions.length > 1 ? "s" : ""} ({failedTransitions.join(", ")}) no se pudo confirmar en la base de datos — se reintentara automaticamente
                    </span>
                  </div>
                  <button
                    onClick={refresh}
                    className="shrink-0 px-2 py-1 rounded transition-colors"
                    style={{ background: "rgba(231,76,60,0.2)", border: "1px solid rgba(231,76,60,0.4)" }}
                  >
                    Reintentar ahora
                  </button>
                </div>
              )}

              {/* Barra de Filtros Simplificada */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                {/* 1. Modos Principales: KDS Activo vs Historial */}
                <div className="flex items-center gap-2 p-1 rounded-xl" style={{ background: "#111", border: "1px solid #1f1f1f" }}>
                  <button
                    onClick={() => setPedidosView("kds")}
                    className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                    style={{
                      background: pedidosView === "kds" ? YELLOW : "transparent",
                      color: pedidosView === "kds" ? "#7B0000" : "#888",
                    }}
                  >
                    Tablero KDS (Cocina)
                  </button>
                  <button
                    onClick={() => setPedidosView("historial")}
                    className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
                    style={{
                      background: pedidosView === "historial" ? YELLOW : "transparent",
                      color: pedidosView === "historial" ? "#7B0000" : "#888",
                    }}
                  >
                    Historial Despachados
                    <span className="text-[10px] font-mono opacity-70">
                      ({orders.filter(o => o.status === "entregado").length})
                    </span>
                  </button>
                </div>

                {/* 2. Sub-filtro por Canal (Todos, Delivery, Recojo) */}
                <div className="flex items-center gap-1.5">
                  {(["todos", "delivery", "pickup"] as const).map(ch => (
                    <button
                      key={ch}
                      onClick={() => setChannelFilter(ch)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: channelFilter === ch ? "#222" : "transparent",
                        color: channelFilter === ch ? "#fff" : "#666",
                        border: "1px solid",
                        borderColor: channelFilter === ch ? "#333" : "transparent",
                      }}
                    >
                      {ch === "todos" && "Todos los canales"}
                      {ch === "delivery" && "Solo Delivery"}
                      {ch === "pickup" && "Solo Recojo"}
                    </button>
                  ))}
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingBag size={40} className="mx-auto mb-4 opacity-10" />
                  <p className="text-sm mb-1" style={{ color: "#555" }}>Aun no hay pedidos en la base de datos.</p>
                </div>
              ) : pedidosView === "kds" ? (
                /* TABLERO KDS DE 3 COLUMNAS */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(["pendiente", "en_preparacion", "listo"] as const).map(colStatus => {
                    const colCfg = statusConfig[colStatus];
                    const colOrders = orders
                      .filter(o => o.status === colStatus)
                      .filter(o => {
                        if (channelFilter === "delivery") return o.delivery;
                        if (channelFilter === "pickup") return !o.delivery;
                        return true;
                      });
                    const isDragOver = dragOverCol === colStatus;

                    return (
                      <div
                        key={colStatus}
                        onDragOver={e => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverCol !== colStatus) setDragOverCol(colStatus);
                        }}
                        onDragLeave={() => {
                          if (dragOverCol === colStatus) setDragOverCol(null);
                        }}
                        onDrop={e => {
                          e.preventDefault();
                          setDragOverCol(null);
                          const id = e.dataTransfer.getData("text/plain") || draggedId;
                          if (id) handleStatus(id, colStatus);
                          setDraggedId(null);
                        }}
                        className="rounded-xl flex flex-col transition-all min-h-[420px]"
                        style={{
                          background: "#0d0d0d",
                          border: isDragOver ? `2px dashed ${colCfg.border}` : "1px solid #1a1a1a",
                        }}
                      >
                        {/* Cabecera de Columna */}
                        <div
                          className="px-4 py-3 rounded-t-xl flex items-center justify-between"
                          style={{ background: colCfg.bg, borderBottom: `1px solid ${colCfg.border}30` }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: colCfg.border }} />
                            <span className="font-bebas text-lg tracking-wider" style={{ color: colCfg.border }}>
                              {colCfg.label.toUpperCase()}
                            </span>
                          </div>
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: colCfg.border, color: colStatus === "listo" ? "#fff" : "#000" }}>
                            {colOrders.length}
                          </span>
                        </div>

                        {/* Contenedor de Tarjetas */}
                        <div className="p-3 flex-1 flex flex-col gap-3 overflow-y-auto">
                          {colOrders.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center" style={{ color: "#333" }}>
                              {colStatus === "pendiente" ? <ShoppingBag size={28} className="opacity-20 mb-2" /> : colStatus === "en_preparacion" ? <Flame size={28} className="opacity-20 mb-2" /> : <Check size={28} className="opacity-20 mb-2" />}
                              <p className="text-xs">Sin pedidos en esta etapa</p>
                            </div>
                          ) : (
                            colOrders.map(o => renderKdsCard(o, colStatus))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* VISTA HISTORIAL (PEDIDOS ENTREGADOS) */
                <div className="flex flex-col gap-3">
                  {orders.filter(o => o.status === "entregado").length === 0 ? (
                    <p className="text-center py-8 text-sm" style={{ color: "#444" }}>Aún no hay pedidos entregados en el historial</p>
                  ) : (
                    orders
                      .filter(o => o.status === "entregado")
                      .filter(o => {
                        if (channelFilter === "delivery") return o.delivery;
                        if (channelFilter === "pickup") return !o.delivery;
                        return true;
                      })
                      .map(o => renderKdsCard(o, o.status))
                  )}
                </div>
              )}
            </div>
          )}

          {/* CLIENTES */}
          {tab === "clientes" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-bebas text-3xl md:text-4xl tracking-widest">CLIENTES</h1>
                <button onClick={refresh} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white">
                  <RefreshCw size={13} /> Actualizar
                </button>
              </div>

              {clients.length === 0 ? (
                <p className="text-center py-8 text-sm" style={{ color: "#444" }}>Sin clientes aun</p>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ background: "#141414", border: "1px solid #1f1f1f" }}>
                  <div className="grid grid-cols-4 px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: "#444", borderBottom: "1px solid #1f1f1f" }}>
                    <span>Cliente</span>
                    <span>Telefono</span>
                    <span className="text-center">Pedidos</span>
                    <span className="text-right">Total gastado</span>
                  </div>
                  {clients.map((c, i) => (
                    <div key={i} className="grid grid-cols-4 px-4 py-3 border-b last:border-0 items-center" style={{ borderColor: "#1a1a1a" }}>
                      <span className="text-sm font-semibold">{c.name}</span>
                      <span className="text-xs" style={{ color: "#666" }}>{c.phone}</span>
                      <span className="text-center font-bebas text-lg" style={{ color: YELLOW }}>{c.count}</span>
                      <span className="text-right font-bebas text-lg" style={{ color: "#2ecc71" }}>S/{c.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VALIDAR */}
          {tab === "validar" && <ValidarTab />}


          {/* Toast de Deshacer para recuperación de errores */}
          {undoAction && (
            <div
              className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-bounce"
              style={{ background: "#1c1c1c", border: "1px solid #333" }}
            >
              <p className="text-xs font-medium text-white">
                Pedido #{undoAction.id} movido a {statusConfig[undoAction.next].label}
              </p>
              <button
                onClick={handleUndo}
                className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-all"
                style={{ background: YELLOW, color: "#000" }}
              >
                <RotateCcw size={11} /> Deshacer
              </button>
            </div>
          )}

        </main>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Área física de impresión térmica 80mm */}
      <ThermalPrintArea order={printingOrder} />

      {/* Modal de Comanda Térmica 80mm */}
      <ThermalTicketModal
        order={printingOrder}
        onClose={() => setPrintingOrder(null)}
      />

      {/* Guía de Configuración de Impresora */}
      <PrinterHelpModal
        isOpen={showPrinterHelp}
        onClose={() => setShowPrinterHelp(false)}
      />
    </div>
  );
}