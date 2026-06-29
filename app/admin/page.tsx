"use client";

import { useState, useEffect, useCallback } from "react";
import { getOrders, updateOrderStatus, saveOrder } from "@/lib/orders-store";
import type { Order, OrderStatus } from "@/lib/orders-store";
import { LayoutDashboard, ShoppingBag, Users, RefreshCw } from "lucide-react";

const YELLOW = "#FFD600";

type Tab = "dashboard" | "pedidos" | "clientes";

const statusConfig: Record<OrderStatus, { label: string; border: string; bg: string; next: OrderStatus | null }> = {
  pendiente:       { label: "Pendiente",       border: "#FFD600", bg: "rgba(255,214,0,0.1)",  next: "en_preparacion" },
  en_preparacion:  { label: "En preparacion",  border: "#F39C12", bg: "rgba(243,156,18,0.1)", next: "listo" },
  listo:           { label: "Listo",           border: "#2ecc71", bg: "rgba(46,204,113,0.1)", next: "entregado" },
  entregado:       { label: "Entregado",       border: "#555",    bg: "rgba(80,80,80,0.1)",   next: null },
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

const MOCK_NAMES = ["Carlos M.", "Ana R.", "Diego P.", "Maria L.", "Pedro C."];
const MOCK_ITEMS = [
  [{ id: 1, name: "Lobo Clasica", price: 18, qty: 1 }, { id: 6, name: "Salchipapa Clasica", price: 10, qty: 1 }],
  [{ id: 5, name: "La Bestia", price: 28, qty: 1 }, { id: 8, name: "Salchipapa XL", price: 16, qty: 1 }, { id: 11, name: "Limonada", price: 7, qty: 2 }],
  [{ id: 13, name: "Combo Lobo", price: 25, qty: 2 }],
];

function generateMockOrder(): void {
  const items = MOCK_ITEMS[Math.floor(Math.random() * MOCK_ITEMS.length)];
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  saveOrder({
    name: MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)],
    phone: `9${Math.floor(10000000 + Math.random() * 89999999)}`,
    delivery: Math.random() > 0.5,
    address: "Av. Los Heroes 123",
    items,
    total,
  });
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "todos">("todos");

  const refresh = useCallback(() => setOrders(getOrders()), []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleStatus = (id: string, next: OrderStatus) => {
    updateOrderStatus(id, next);
    refresh();
  };

  const todayOrders = orders.filter(o => isToday(o.createdAt));
  const todayTotal = todayOrders.reduce((s, o) => s + o.total, 0);
  const pending = orders.filter(o => o.status === "pendiente").length;

  const navItems: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "pedidos", label: "Pedidos", icon: ShoppingBag },
    { id: "clientes", label: "Clientes", icon: Users },
  ];

  const filteredOrders = filter === "todos" ? orders : orders.filter(o => o.status === filter);

  // Unique clients
  const clientMap: Record<string, { name: string; phone: string; count: number; total: number }> = {};
  for (const o of orders) {
    if (!clientMap[o.phone]) clientMap[o.phone] = { name: o.name, phone: o.phone, count: 0, total: 0 };
    clientMap[o.phone].count++;
    clientMap[o.phone].total += o.total;
  }
  const clients = Object.values(clientMap).sort((a, b) => b.total - a.total);

  return (
    <div className="min-h-screen flex" style={{ background: "#080808", color: "#fff" }}>
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen sticky top-0" style={{ background: "#0F0F0F", borderRight: "1px solid rgba(192,57,43,0.2)" }}>
        <div className="px-5 py-6" style={{ borderBottom: "1px solid rgba(192,57,43,0.2)" }}>
          <p className="font-bebas text-lg tracking-widest leading-none">LOBO BURGER</p>
          <p className="text-[10px]" style={{ color: "#C0392B" }}>PANEL ADMIN</p>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-all text-left"
              style={{
                background: tab === id ? "rgba(192,57,43,0.15)" : "transparent",
                color: tab === id ? "#C0392B" : "#666",
                borderLeft: tab === id ? "2px solid #C0392B" : "2px solid transparent",
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
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="flex md:hidden items-center justify-between px-4 py-3 sticky top-0 z-40" style={{ background: "#0F0F0F", borderBottom: "1px solid rgba(192,57,43,0.2)" }}>
          <span className="font-bebas tracking-widest" style={{ color: "#C0392B" }}>LOBO ADMIN</span>
          <button onClick={refresh} className="text-white/30 hover:text-white"><RefreshCw size={14} /></button>
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
                  { label: "Pedidos pendientes", value: String(pending), color: pending > 0 ? "#C0392B" : "#555" },
                  { label: "Pedidos hoy", value: String(todayOrders.length), color: YELLOW },
                  { label: "Total vendido hoy", value: `S/${todayTotal}`, color: "#2ecc71" },
                  { label: "Pedidos totales", value: String(orders.length), color: "#4a9eed" },
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

          {/* PEDIDOS */}
          {tab === "pedidos" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h1 className="font-bebas text-3xl md:text-4xl tracking-widest">PEDIDOS</h1>
                <button onClick={refresh} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white">
                  <RefreshCw size={13} /> Actualizar
                </button>
              </div>

              {/* Filtros */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-5">
                {(["todos", "pendiente", "en_preparacion", "listo", "entregado"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
                    style={{
                      background: filter === f ? YELLOW : "#1a1a1a",
                      color: filter === f ? "#7B0000" : "#666",
                    }}
                  >
                    {f === "todos" ? "Todos" : statusConfig[f].label}
                  </button>
                ))}
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingBag size={40} className="mx-auto mb-4 opacity-10" />
                  <p className="text-sm mb-1" style={{ color: "#555" }}>Aun no hay pedidos. Los pedidos enviados por WhatsApp aparecen aqui.</p>
                  <button
                    onClick={() => { generateMockOrder(); refresh(); }}
                    className="mt-4 px-4 py-2 rounded-lg text-xs font-bold"
                    style={{ background: "#1a1a1a", color: "#888" }}
                  >
                    Agregar pedido de prueba
                  </button>
                </div>
              ) : filteredOrders.length === 0 ? (
                <p className="text-center py-8 text-sm" style={{ color: "#444" }}>Sin pedidos con este estado</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredOrders.map(o => {
                    const cfg = statusConfig[o.status];
                    return (
                      <div
                        key={o.id}
                        className="rounded-xl p-4"
                        style={{ background: "#141414", border: `1px solid ${cfg.border}40`, borderLeft: `3px solid ${cfg.border}` }}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="font-bold text-sm">{o.name} <span className="font-mono text-xs" style={{ color: "#555" }}>{o.id}</span></p>
                            <p className="text-xs mt-0.5" style={{ color: "#666" }}>{o.phone} &nbsp;|&nbsp; {o.delivery ? `Delivery: ${o.address}` : "Para recoger"}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.border }}>
                              {cfg.label}
                            </span>
                            <p className="text-xs mt-1" style={{ color: "#555" }}>{timeAgo(o.createdAt)}</p>
                          </div>
                        </div>

                        <div className="mb-3">
                          {o.items.map((item, i) => (
                            <p key={i} className="text-xs" style={{ color: "#888" }}>
                              {item.qty}x {item.name} — S/{item.price * item.qty}
                            </p>
                          ))}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="font-bebas text-xl" style={{ color: YELLOW }}>Total S/{o.total}</span>
                          {cfg.next && (
                            <button
                              onClick={() => handleStatus(o.id, cfg.next!)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
                              style={{ background: statusConfig[cfg.next].border, color: cfg.next === "listo" ? "#fff" : "#0a0a0a" }}
                            >
                              {statusConfig[cfg.next].label}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {orders.length > 0 && (
                <button
                  onClick={() => { generateMockOrder(); refresh(); }}
                  className="mt-6 w-full py-2 rounded-lg text-xs font-bold"
                  style={{ background: "#1a1a1a", color: "#555" }}
                >
                  + Agregar pedido de prueba
                </button>
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

        </main>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
