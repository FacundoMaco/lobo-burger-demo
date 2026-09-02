# Phase 2: Menú vivo en Supabase y control de stock - Pattern Map

**Mapped:** 2026-09-01
**Files analyzed:** 10 (new/modified)
**Analogs found:** 9 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/<timestamp>_menu_items.sql` | migration | batch (create table + seed) | `supabase/migrations/20260825000000_rate_limit.sql` | exact |
| `lib/menu-data.ts` (nuevo) | service | CRUD + read-through cache | `lib/supabase.ts` (lazy singleton) + `app/api/admin/pedidos/route.ts` (query shape) | role-match |
| `lib/menu.ts` (reescrito a solo tipos) | model | transform | `lib/menu.ts` (versión actual, mismo archivo) | exact |
| `app/api/menu/route.ts` (nuevo) | route | request-response (read cacheado) | `app/api/admin/pedidos/route.ts` `GET` | role-match |
| `app/api/admin/menu/route.ts` (nuevo) | route | CRUD (GET listado + PATCH parcial) | `app/api/admin/pedidos/route.ts` (GET + PATCH en el mismo archivo) | exact |
| `app/api/charge/route.ts` (modificado) | route | request-response (recalculo de precio) | mismo archivo, versión actual (patrón a preservar, solo cambia la fuente del precio) | exact |
| `app/api/culqi/order/route.ts` (modificado) | route | request-response (recalculo de precio) | `app/api/charge/route.ts` (mismo patrón de recalculo, duplicado a propósito) | exact |
| `app/page.tsx` (modificado) | component | request-response (fetch client-side) | `app/admin/page.tsx` (`refresh()` + `useEffect` + `useState`) | role-match |
| `app/admin/page.tsx` (modificado — nuevo tab "Menú") | component | CRUD (edición inline) | `app/admin/page.tsx` `ValidarTab` (inputs controlados, toast, patrón de guardado) + tab `pedidos` (PATCH + refresh) | exact (mismo archivo) |
| `__tests__/menu.test.ts` (reescrito) + `__tests__/helpers/supabase-mock.ts` (extendido) | test | transform (mock de queries) | `__tests__/api-charge.caracterizacion.test.ts` + `__tests__/helpers/supabase-mock.ts` actual | role-match |

## Pattern Assignments

### `supabase/migrations/<timestamp>_menu_items.sql`

**Analog:** `supabase/migrations/20260825000000_rate_limit.sql` y `supabase/migrations/20260820000000_pedidos.sql`

**Convención de comentarios "por qué", RLS sin políticas** (`20260825000000_rate_limit.sql:1-19`):
```sql
-- Rate limit por IP para POST /api/charge (PAY-06).
--
-- Por que una funcion de Postgres y no select-then-update desde TypeScript:
-- ...
create table rate_limit_charge (
  ip text not null,
  window_start timestamptz not null,
  intentos int not null default 1,
  primary key (ip, window_start)
);

-- Sin politicas: la tabla solo la toca el service_role desde el servidor,
-- igual que pedidos (20260820000000_pedidos.sql). Nadie la consulta desde
-- el cliente.
alter table rate_limit_charge enable row level security;
```

**Aplicar a `menu_items`:** misma estructura — comentario explicando el "por qué" de `precio_centimos integer` (ver Pitfall 1 de RESEARCH.md, no usar `numeric`), `create table` con `id bigint generated always as identity primary key`, `enable row level security` sin políticas (solo `service_role` la toca), e `insert into menu_items (...) values (...)` con la carta real completa (~34 filas, no truncar) más el comentario explicando por qué "Lobo Sunset" se siembra `agotado = true`.

**Fuente exacta del schema a copiar (ya resuelta en RESEARCH.md, Code Examples → "Migración SQL"):** columnas `id, created_at, category, name, description, precio_centimos, original_price_centimos, badge, image, agotado`, índice `menu_items_category_idx on menu_items (category, id)`.

---

### `lib/menu-data.ts` (nuevo, server-only)

**Analog primario:** `lib/supabase.ts` (patrón de import del cliente) + `app/api/admin/pedidos/route.ts` (forma de las queries `select`/`update`)

**Import del cliente Supabase** (`lib/supabase.ts:1, 12-22`):
```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}
```
Reusar `getSupabaseAdmin()` sin cambios — no crear un segundo cliente.

**Query de listado + orden** (`app/api/admin/pedidos/route.ts:9-23`, patrón `select().order().limit()`):
```typescript
export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("pedidos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    return Response.json({ pedidos: data ?? [] });
  } catch (e) {
    console.error("No se pudieron leer los pedidos:", e);
    return Response.json({ error: "No se pudieron leer los pedidos" }, { status: 500 });
  }
}
```
Adaptar a `.from("menu_items").select(<columnas explícitas, no "*">).order("category").order("id")` — RESEARCH.md ya define la firma exacta de `getMenuItemsCached()` y `getMenuItemLive(id)`; usar esa firma tal cual (dos funciones en el mismo archivo, nombres distintos, la viva SIN `unstable_cache`).

**Query de update parcial** (`app/api/admin/pedidos/route.ts:38-44`):
```typescript
const { error } = await getSupabaseAdmin()
  .from("pedidos")
  .update({ estado })
  .eq("codigo", codigo);

if (error) throw error;
```
Adaptar a `.from("menu_items").update(patch).eq("id", id)` dentro de `updateMenuItem()`, seguido de `revalidateTag("menu", { expire: 0 })` (ver RESEARCH.md Pattern 2 — firma de dos argumentos obligatoria).

**Import obligatorio primera línea** (nuevo, no tiene analog en el repo — requisito de RESEARCH.md):
```typescript
import "server-only";
```

---

### `lib/menu.ts` (reescrito a solo tipos)

**Analog:** el propio archivo actual, conservando el contrato de tipos.

**Tipo y comentario de contrato** (`lib/menu.ts:1-16`):
```typescript
// Fuente de verdad de la carta. Se importa desde el cliente (para pintar la
// carta) y desde el servidor (para recalcular el total de un pedido), asi que
// este archivo NO puede tener "use client" ni tocar el DOM.
//
// El precio que cobra /api/charge sale de aca, nunca del navegador.

export type MenuItem = {
  id: number;
  category: string;
  name: string;
  description: string;
  price: number;
  badge: string | null;
  originalPrice: number | null;
  image: string | null;
};

export const CATEGORIES = ["Combos", "Burgers", "Pollo", "Complementos", "Bebidas"];
```
**Cambios de contrato:** el comentario de cabecera debe actualizarse — este archivo deja de tener `MENU_ITEMS`/`getMenuItem` (esas dos cosas se mueven a `lib/menu-data.ts`, async). `MenuItem` gana el campo `agotado: boolean` (usado tanto en la carta pública como en `/admin`). `CATEGORIES` se mantiene como constante local (no derivarla de la DB — ver Anti-Patterns en RESEARCH.md), reemplazando los 5 valores actuales por el orden de categorías de la carta real: `["Enchiladas", "Broaster", "Salchipapas / Power Plates", "Combos xtremos", "Bebidas", "Hamburguesas"]` (orden del documento fuente, confirmado como Claude's Discretion en CONTEXT.md).

---

### `app/api/menu/route.ts` (nuevo)

**Analog:** `app/api/admin/pedidos/route.ts` (forma del `GET`, try/catch, `Response.json`)

**Patrón de Route Handler GET mínimo** (`app/api/admin/pedidos/route.ts:9-23`, ya extraído arriba) — aplicar la misma forma try/catch + `console.error` + `Response.json({ error }, { status: 500 })`, pero llamando a `getMenuItemsCached()` en vez de una query directa (RESEARCH.md Pattern 3 documenta exactamente esta ruta, no necesita `export const dynamic`).

---

### `app/api/admin/menu/route.ts` (nuevo)

**Analog:** `app/api/admin/pedidos/route.ts` completo (GET + PATCH en el mismo archivo, mismo estilo de validación manual de body)

**Patrón completo GET+PATCH a copiar** (`app/api/admin/pedidos/route.ts:1-50`, archivo completo — ya leído arriba en la sección de `lib/menu-data.ts`). Puntos a preservar:
- Comentario de cabecera explicando que la ruta está protegida por Basic Auth en `proxy.ts` (el matcher `/api/admin/:path*` ya cubre esta ruta nueva sin tocar `proxy.ts`).
- Validación manual de body con `typeof` antes de tocar la DB (mismo estilo que `estado?: string` + `ESTADOS.includes(estado)` en pedidos → para menú: `precio_centimos?: number` con `Number.isInteger` + rango sano (Pitfall 5 de RESEARCH.md: `MIN_CENTS`=300, techo ~10000) y `agotado?: boolean` con `typeof === "boolean"`).
- `try/catch` con `console.error` + 500 genérico en el catch; 400 explícito para validación.
- La diferencia clave con el analog: después del `update` exitoso, llamar `revalidateTag("menu", { expire: 0 })` — el analog de pedidos NO invalida caché porque pedidos no tiene GET cacheado; este es un patrón nuevo, tomado de RESEARCH.md Pattern 2.

---

### `app/api/charge/route.ts` (modificado)

**Analog:** el propio archivo, patrón de recalculo a preservar salvo el origen del dato.

**Loop de recalculo actual, línea por línea** (`app/api/charge/route.ts:97-117`):
```typescript
let totalCents = 0;
const detalle: { id: number; name: string; price: number; qty: number }[] = [];
for (const linea of items) {
  if (!Number.isInteger(linea?.id) || !Number.isInteger(linea?.qty)) {
    return Response.json({ error: "Datos del pedido inválidos" }, { status: 400 });
  }
  if (linea.qty < 1 || linea.qty > MAX_QTY) {
    return Response.json({ error: "Cantidad no permitida" }, { status: 400 });
  }
  const item = getMenuItem(linea.id);
  if (!item) {
    return Response.json({ error: "Hay un producto que ya no está disponible" }, { status: 400 });
  }
  totalCents += Math.round(item.price * 100) * linea.qty;
  detalle.push({ id: item.id, name: item.name, price: item.price, qty: linea.qty });
}

if (totalCents < MIN_CENTS || totalCents > MAX_CENTS) {
  return Response.json({ error: "El monto del pedido no es válido" }, { status: 400 });
}
```
**Cambios exactos requeridos (ver RESEARCH.md Code Examples → "Rechazo de agotado en el servidor"):**
1. `import { getMenuItem } from "@/lib/menu";` → `import { getMenuItemLive } from "@/lib/menu-data";`
2. `const item = getMenuItem(linea.id);` → `const item = await getMenuItemLive(linea.id);` (el loop `for...of` ya soporta `await` sin cambios estructurales).
3. Insertar el chequeo `if (item.agotado) { return Response.json({ error: "Un producto de tu pedido ya no está disponible" }, { status: 400 }); }` inmediatamente después del chequeo de `!item`.
4. `totalCents += Math.round(item.price * 100) * linea.qty;` → `totalCents += item.precio_centimos * linea.qty;` (entero puro, ya no hace falta `Math.round` — ver Pitfall 1 de RESEARCH.md).
5. El resto del archivo (rate limit, validación de email/teléfono, cargo a Culqi, insert en `pedidos`, manejo de `23505`) **no cambia** — no tocar esas secciones.

---

### `app/api/culqi/order/route.ts` (modificado)

**Analog:** `app/api/charge/route.ts` (mismo patrón de recalculo, ya duplicado hoy a propósito)

**Loop actual** (`app/api/culqi/order/route.ts:52-69`):
```typescript
let totalCents = 0;
for (const linea of items) {
  if (!Number.isInteger(linea?.id) || !Number.isInteger(linea?.qty)) {
    return Response.json({ error: "Datos del pedido inválidos" }, { status: 400 });
  }
  if (linea.qty < 1 || linea.qty > MAX_QTY) {
    return Response.json({ error: "Cantidad no permitida" }, { status: 400 });
  }
  const item = getMenuItem(linea.id);
  if (!item) {
    return Response.json({ error: "Hay un producto que ya no está disponible" }, { status: 400 });
  }
  totalCents += Math.round(item.price * 100) * linea.qty;
}

if (totalCents < MIN_CENTS || totalCents > MAX_CENTS) {
  return Response.json({ error: "El monto del pedido no es válido" }, { status: 400 });
}
```
**Aplicar exactamente los mismos 4 cambios que en `app/api/charge/route.ts`** (import, `await getMenuItemLive`, chequeo de `agotado`, aritmética entera con `precio_centimos`). Es el pitfall #3 de RESEARCH.md mantener ambas rutas en sync manualmente — no hay abstracción compartida hoy, replicar el cambio literalmente en los dos archivos.

---

### `app/page.tsx` (modificado)

**Analog:** `app/admin/page.tsx` (patrón `refresh()` con `useCallback` + `useEffect` + `useState`, ya usado para pedidos)

**Patrón fetch + estado a replicar** (`app/admin/page.tsx:271-299`):
```typescript
const refresh = useCallback(async () => {
  try {
    const res = await fetch("/api/admin/pedidos");
    if (!res.ok) return;
    const { pedidos } = await res.json();
    setOrders(/* mapeo */);
  } catch {
    // Sin conexion se deja la ultima lista cargada.
  }
}, []);

useEffect(() => {
  refresh();
  const interval = setInterval(refresh, 10000);
  return () => clearInterval(interval);
}, [refresh]);
```
**Adaptar para `app/page.tsx` (sin polling, solo carga inicial — RESEARCH.md Code Examples → "Home page consumiendo el menú vía fetch"):**
```typescript
const [menuItems, setMenuItems] = useState<PublicMenuItem[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch("/api/menu")
    .then((r) => r.json())
    .then(({ items }) => setMenuItems(items ?? []))
    .finally(() => setLoading(false));
}, []);
```
Reemplaza el import estático `import { MENU_ITEMS as menuItems, CATEGORIES as categories, type MenuItem } from "@/lib/menu";` (línea 12) — `CATEGORIES` sigue importándose estático desde `lib/menu.ts` (no cambia, sigue siendo una constante sin red), solo `menuItems` pasa a `useState` + `fetch`.

**Componente `MenuCard` actual, rama sin imagen** (`app/page.tsx:85-107`) — punto exacto donde insertar el ícono de categoría y el estado agotado (ver `02-UI-SPEC.md` "Icon Mapping" y "Estado agotado en la carta pública" para el comportamiento visual completo, incluye mapeo `CupSoda`/`Sandwich`/`Hamburger`/`Drumstick`/`ShoppingBasket`/`Package` por categoría):
```typescript
<div className="relative w-full" style={{ paddingTop: "62%", background: placeholderColor(item.category) }}>
  {item.image ? (
    <Image src={item.image} alt={item.name} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover" />
  ) : (
    <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] px-3 text-center" style={{ color: "rgba(36,31,28,0.45)" }}>
      [Foto: {item.name}]
    </span>
  )}
  {item.badge && (
    <span className="absolute top-3 right-3"><ItemBadge text={item.badge} /></span>
  )}
</div>
```
Este bloque `else` (placeholder de texto) se reemplaza por el ícono lucide centrado (`size={32}`, color `rgba(36,31,28,0.35)`) según el mapeo por categoría — la rama `item.image ? <Image/> : <icono>` se mantiene igual estructuralmente, solo cambia qué renderiza el `else`. El pill "AGOTADO" va en `top-3 left-3` (esquina opuesta al badge de promo existente).

---

### `app/admin/page.tsx` (modificado — nuevo tab "Menú")

**Analog dentro del mismo archivo:** `ValidarTab` (inputs controlados + toast + guardado) y el bloque `tab === "pedidos"` (fetch inicial + PATCH + `refresh()`)

**Patrón de input controlado + estilo reusable** (`app/admin/page.tsx:134-136, 163-168`):
```typescript
const sectionTitle = "text-sm font-bold text-white mb-3";
const inputCls = "w-full rounded-lg py-2.5 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-offset-0";
const inputStyle = { background: "#0a0a0a", border: "1px solid #252525" };
// ...
<input
  type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
  placeholder="9XXXXXXXX" className={inputCls} style={inputStyle}
/>
```
Reusar `inputCls`/`inputStyle` para el `<input type="number" step="0.10" min="3" max="100">` de precio inline-editable (ver `02-UI-SPEC.md` sección "Precio inline-editable").

**Patrón de toast** (`app/admin/page.tsx:33-55, 144-156`):
```typescript
type Toast = { ok: boolean; text: string };
const [toast, setToast] = useState<Toast | null>(null);
const showToast = (t: Toast) => {
  setToast(t);
  setTimeout(() => setToast(null), 3000);
};
// ...
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
```
Copiar tal cual para los toasts de "Precio actualizado" / "No se pudo guardar. Intenta de nuevo." del tab Menú.

**Patrón de fetch inicial + PATCH + refresh** (`app/admin/page.tsx:271-308`, ya extraído arriba en `app/page.tsx`) — el tab Menú necesita su propio `refresh()` que llama `GET /api/admin/menu` y su propio handler que llama `PATCH /api/admin/menu` seguido de `refresh()`, exactamente en la forma de `handleStatus` (`app/admin/page.tsx:301-308`):
```typescript
const handleStatus = async (id: string, next: OrderStatus) => {
  await fetch("/api/admin/pedidos", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codigo: id, estado: next }),
  });
  refresh();
};
```

**Registro en `navItems` y `Tab`** (`app/admin/page.tsx:9, 314-319`):
```typescript
type Tab = "dashboard" | "pedidos" | "clientes" | "validar";
// ...
const navItems: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { id: "pedidos",   label: "Pedidos",    icon: ShoppingBag     },
  { id: "clientes",  label: "Clientes",   icon: Users           },
  { id: "validar",   label: "Validar",    icon: ClipboardCheck  },
];
```
Agregar `"menu"` a `Tab` y una entrada `{ id: "menu", label: "Menú", icon: <ícono a elegir, ej. UtensilsCrossed o ClipboardList> }` — no rompe el patrón existente de sidebar/mobile-tabs que itera `navItems` genéricamente.

---

### `__tests__/menu.test.ts` (reescrito) + `__tests__/helpers/supabase-mock.ts` (extendido)

**Analog:** `__tests__/api-charge.caracterizacion.test.ts` (mockea `getSupabaseAdmin` vía el mismo helper) + el propio `supabase-mock.ts` actual

**Test actual a reemplazar por completo** (`__tests__/menu.test.ts:1-24`, ya no aplica — `getMenuItem`/`MENU_ITEMS` síncronos dejan de existir):
```typescript
import { describe, expect, it } from "vitest";
import { getMenuItem, MENU_ITEMS } from "@/lib/menu";

describe("lib/menu", () => {
  it("getMenuItem(1) devuelve Miami Night a S/18", () => {
    const item = getMenuItem(1);
    expect(item?.name).toBe("Miami Night");
    expect(item?.price).toBe(18);
  });
  // ...
});
```
El test reescrito debe mockear `getSupabaseAdmin` (mismo patrón de mock de módulo que ya usa `api-charge.caracterizacion.test.ts` contra `@/lib/supabase`) y probar `getMenuItemLive(id)` async, más `getMenuItemsCached()` con el nuevo soporte de `.order().order()` encadenado.

**Extender `__tests__/helpers/supabase-mock.ts`:** el mock actual (líneas 75-123, ya leído completo arriba) soporta `.from().insert().select().single()`, `.from().select().eq().single()`, `.from().select().limit()` y `.rpc()`, pero **no** soporta `.select().order().order()` (listado) ni `.update().eq()` (edición admin) — RESEARCH.md ya señala esta brecha explícitamente en "Recommended Project Structure". Agregar estos dos casos siguiendo el mismo estilo aditivo que ya usan las extensiones anteriores del archivo (comentario explicando qué plan/feature lo necesita, capacidad nueva sin romper las cadenas existentes).

## Shared Patterns

### Cliente Supabase lazy singleton
**Source:** `lib/supabase.ts:10-22`
**Apply to:** `lib/menu-data.ts` — reusar `getSupabaseAdmin()` sin crear un cliente nuevo ni exponer credenciales al cliente.

### Validación manual de body en Route Handlers (sin librería de schema)
**Source:** `app/api/admin/pedidos/route.ts:25-36`, `app/api/charge/route.ts:71-95`
```typescript
let body: { codigo?: string; estado?: string };
try {
  body = await request.json();
} catch {
  return Response.json({ error: "Solicitud inválida" }, { status: 400 });
}
const { codigo, estado } = body;
if (typeof codigo !== "string" || typeof estado !== "string" || !ESTADOS.includes(estado)) {
  return Response.json({ error: "Datos inválidos" }, { status: 400 });
}
```
**Apply to:** `PATCH /api/admin/menu` — mismo estilo `typeof` + rango explícito, sin introducir zod/yup (no están en el proyecto).

### Error handling: try/catch + `console.error` + 500 genérico
**Source:** `app/api/admin/pedidos/route.ts:19-22, 46-49`
```typescript
} catch (e) {
  console.error("No se pudieron leer los pedidos:", e);
  return Response.json({ error: "No se pudieron leer los pedidos" }, { status: 500 });
}
```
**Apply to:** todos los Route Handlers nuevos (`/api/menu`, `/api/admin/menu`) y las funciones de `lib/menu-data.ts` que hacen `throw error` sobre un `error` de Supabase (mismo patrón `if (error) throw error;` ya usado en pedidos).

### Protección de rutas admin — ya cubierta, no requiere código nuevo
**Source:** `proxy.ts:36-38`
```typescript
export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
```
**Apply to:** `app/api/admin/menu/route.ts` — el matcher ya cubre `/api/admin/menu` automáticamente; no tocar `proxy.ts`.

### Fetch client-side + estado local (sin Server Components, sin store global)
**Source:** `app/admin/page.tsx:271-299` (patrón `refresh` + `useEffect`)
**Apply to:** `app/page.tsx` (fetch único, sin polling) y el nuevo tab "Menú" de `app/admin/page.tsx` (fetch + PATCH + refresh, con polling opcional igual a pedidos si se decide).

### Toast de éxito/error controlado por `setTimeout`
**Source:** `app/admin/page.tsx:33-55, 144-156` (`ValidarTab`)
**Apply to:** feedback de guardado de precio/stock en el nuevo tab "Menú" — mismo tipo `Toast`, misma función `showToast`, mismo bloque JSX condicional.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Ícono lucide-react por categoría en `MenuCard` (fragmento nuevo dentro de `app/page.tsx`) | component (visual) | transform | No existe hoy ningún placeholder icónico en el repo (el placeholder actual es texto `[Foto: ...]`); usar directamente el mapeo ya resuelto en `02-UI-SPEC.md` / `02-RESEARCH.md` (`CupSoda`, `Sandwich`, `Hamburger`, `Drumstick`, `ShoppingBasket`, `Package`) en vez de buscar un analog inexistente. |

## Metadata

**Analog search scope:** `lib/`, `app/api/**`, `app/admin/`, `app/page.tsx`, `supabase/migrations/`, `__tests__/`, `proxy.ts`
**Files scanned:** `lib/menu.ts`, `lib/supabase.ts`, `app/api/charge/route.ts`, `app/api/culqi/order/route.ts`, `app/api/admin/pedidos/route.ts`, `app/admin/page.tsx`, `app/page.tsx`, `proxy.ts`, `supabase/migrations/20260820000000_pedidos.sql`, `supabase/migrations/20260825000000_rate_limit.sql`, `__tests__/menu.test.ts`, `__tests__/helpers/supabase-mock.ts`
**Pattern extraction date:** 2026-09-01
