# Phase 2: Menú vivo en Supabase y control de stock - Research

**Researched:** 2026-09-01
**Domain:** Next.js 16.2.9 server/client data-fetching caching model + Supabase-backed catalog + admin CRUD-lite
**Confidence:** HIGH (Next.js caching APIs verified against `node_modules/next/dist/docs/` shipped with the exact installed version — not training data. Supabase/schema decisions MEDIUM, based on established in-repo conventions.)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Phase Boundary
El menú deja de vivir como array estático en `lib/menu.ts` y pasa a una tabla de Supabase.
`/admin` permite editar precio y marcar agotado/disponible de un producto **ya existente**
en la carta, y ese cambio se refleja en la carta pública sin deploy. `POST /api/charge`
recalcula el total siempre contra el precio vigente en la base, nunca contra un valor cacheado.
La carta pública se sirve de caché de Next (revalidate/tag), no golpea Supabase en cada visita.

**Fuera de este phase (confirmado contra REQUIREMENTS.md, no expandir sin decisión explícita):**
CRUD completo (alta/baja de productos nuevos, categorías) es MENU-05 y modificadores con precio
es MENU-06 — ambos marcados fuera del alcance v1. Agregar un producto nuevo sigue siendo vía
migración/seed, no una pantalla de alta en `/admin`.

### Decisions (locked)

**Fuente de datos:**
- Reemplazar `MENU_ITEMS` de `lib/menu.ts` por la carta real (ver `<specifics>` abajo) — no
  fusionar con los productos inventados actuales (Miami Night, Doble Carne, etc.). Esos productos
  y sus imágenes huérfanas en `/public/images/menu/` se eliminan, no se reciclan.
- La migración inicial de Supabase debe sembrar (seed) la tabla con exactamente la carta real.

**Stock / disponibilidad:**
- "Lobo Sunset" se siembra **agotado desde el arranque** (confirmado por el dueño) — caso real
  para validar OPS-04/MENU-03, no un dato de prueba sintético.

**Imágenes / placeholders:**
- Mientras no haya fotos reales, cada item sin foto muestra un **ícono por categoría**, no una
  foto genérica ni un cuadro vacío:
  - Bebidas → ícono de botella
  - Enchiladas → ícono estilo taco/wrap
  - Hamburguesas → ícono de hamburguesa
  - Broaster / Salchipapas / Power Plates / Combos xtremos → sin ícono decidido, el planner
    propone uno sensato (ver Code Examples → mapeo de íconos resuelto en esta research).
- El reemplazo de ícono por foto real debe poder hacerse **producto por producto, incremental**,
  sin romper ni requerir tocar el resto de la carta.

**Correcciones sobre la lectura inicial de la carta:**
- "Filete de Pollo Royal" no lleva queso — el nombre no debe decir "Cheeseburger".
- "Mixta" = Enchilada Mixta (pollo deshilachado + chorizo parrillero), S/19.90.
- Broaster Lobito (ala/pierna, solo papas fritas) vs Broaster Lobo (pecho/entrepierna, papas o
  papas con arroz).

### Claude's Discretion
- Ícono exacto por categoría para Broaster / Salchipapas-Power Plates / Combos xtremos.
- Orden final de categorías en la UI (se sugiere preservar el orden del documento fuente).
- Estructura interna de los archivos server-only que reemplazan `lib/menu.ts` (no especificado
  por el usuario, resuelto en esta research por requerimiento técnico de MENU-04).

### Deferred Ideas (OUT OF SCOPE)
- MENU-05 (CRUD completo del menú desde el panel: alta, baja, fotos, categorías).
- MENU-06 (modificadores estructurados con precio).
- Fotos reales de cada producto (el dueño las genera con Google Flow, incremental).
- Confirmar con el dueño si las dos líneas de "Fanta" (Naranja e Inglesa) son productos
  realmente distintos en caja — se tomaron como dos productos separados por default.

### Carta real confirmada (semilla de la migración)

**Enchiladas** (envueltas en tortilla de trigo, ensalada, queso, papas al hilo, cremas)
| Producto | Precio | Detalle |
|---|---|---|
| Enchilada de Pollo | S/17.90 | pollo deshilachado, chorizo parrillero |
| Enchilada de Chorizo | S/17.90 | chorizo parrillero |
| Enchilada Mixta | S/19.90 | pollo deshilachado + chorizo parrillero |
| Enchibestia | S/20.90 | pollo deshilachado, cabanossi, tocino |

**Broaster**
| Producto | Precio | Detalle |
|---|---|---|
| Broaster Lobito | S/14.50 | 1 pieza (ala o pierna), papas fritas, ensalada, cremas |
| Broaster Lobo | S/16.90 | 1 pieza (pecho o entrepierna), papas o papas con arroz, ensalada, cremas |

**Salchipapas / Power Plates**
| Producto | Precio | Detalle |
|---|---|---|
| Salchibasic | S/12.50 | papas fritas, frankfurter, cremas |
| Salchipobre | S/14.90 | papas fritas, frankfurter, huevo, plátano frito, cremas |
| Perro Lobo | S/12.90 | frankfurter, tocino, queso, papas al hilo, huevo, plátano frito, cremas |
| El Breakfast del Lobo | S/19.90 | pechugón a la plancha, papas fritas, huevo, plátano frito, cremas |

**Combos xtremos**
| Producto | Precio | Detalle |
|---|---|---|
| Combo Resuelve | S/16.90 | 1 pieza de pollo, papas fritas, ensalada, cremas, Coca-Cola 296ml |
| Combo Instinto | S/21.90 | chorizo, pollo deshilachado, queso, papas al hilo, ensalada, cremas, Coca-Cola 296ml |
| Combo Royal | S/18.50 | hamburguesa casera, huevo, queso, papas, ensalada, cremas, Lobo Sunset 350ml |

**Bebidas**
| Producto | Precio | Nota |
|---|---|---|
| Guaraná 450ml | S/4.00 | |
| Coca-Cola 296ml | S/4.00 | |
| Inca Kola 296ml | S/4.00 | |
| Fanta Naranja 500ml | S/4.50 | |
| Fanta Kola Inglesa 500ml | S/4.50 | |
| Agua San Luis 500ml | S/3.50 | |
| Lobo Sunset 350ml (refresco de la casa) | S/3.90 | **sembrar como agotado** |

**Hamburguesas**
| Producto | Precio |
|---|---|
| Classic | S/13.50 |
| Cheeseburger | S/14.90 |
| Hamburguesa Royal | S/16.50 |
| Deshilachado Royal | S/16.90 |
| Filete de Pollo Royal | S/16.90 (sin queso, sin "Cheeseburger" en el nombre) |
| Bacon Cheeseburger | S/16.90 |
| ChoriRoyal | S/16.90 |
| Double Double | S/19.90 |
| Burgazo | S/22.50 |
| Tropical Burguer | S/17.90 |

Cremas (mayonesa, mostaza, ketchup, golf, aceituna, tártara, ají) van incluidas en los platos,
no son fila propia.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MENU-01 | El menú vive en una tabla de Supabase, no en un array de `lib/menu.ts` | Ver Architecture Patterns → esquema `menu_items` + Don't Hand-Roll |
| MENU-02 | La carta pública se sirve desde caché de Next y no golpea Supabase en cada visita | Ver "El problema central" y Code Examples → `getMenuItemsCached` con `unstable_cache` |
| MENU-03 | Jaime cambia el precio o marca agotado desde `/admin`, y el cambio se ve en la carta pública sin deploy | Ver Code Examples → `PATCH /api/admin/menu` + `revalidateTag('menu', { expire: 0 })` |
| MENU-04 | `POST /api/charge` cobra siempre el precio vigente en la base, nunca uno cacheado | Ver "El problema central" → `getMenuItemLive()` sin `unstable_cache`, separado físicamente de la función cacheada |
| OPS-04 | Un producto marcado agotado no se puede agregar al carrito ni cobrar; se valida también en el servidor | Ver Code Examples → columna `agotado`, chequeo en `app/api/charge/route.ts` y `app/api/culqi/order/route.ts` |
</phase_requirements>

## Summary

Este phase reemplaza `lib/menu.ts` (array estático, bundleado en el cliente) por una tabla
`menu_items` en Supabase. El hallazgo central de esta research, verificado contra la
documentación real embebida en `node_modules/next/dist/docs/` de la versión instalada
(16.2.9), es que **este proyecto NO debe habilitar `cacheComponents: true`** para resolver
MENU-02/MENU-03. Ese flag es el que habilita `"use cache"`, `cacheTag()`, `cacheLife()` y
`updateTag()` — pero también activa Partial Prerendering por defecto y el nuevo modelo de
navegación con `<Activity>`, un cambio de comportamiento de renderizado transversal a **toda**
la app, no acotado al menú. Para un sitio en producción que cobra plata real hoy, ese es un
blast radius inaceptable para lo que pide este phase.

La ruta correcta y ya soportada sin flags experimentales es el **"Previous Model"** de caching
de Next 16 (`node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`):
`unstable_cache()` + `revalidateTag()`. Esto no requiere tocar `next.config.ts`, no cambia el
modelo de renderizado del resto de la app, y es exactamente la misma superficie que ya usa el
proyecto (Route Handlers + fetch desde componentes cliente).

El segundo hallazgo central resuelve el punto más delicado del phase: `lib/menu.ts` hoy se
importa tanto desde `"use client"` (`app/page.tsx`) como desde dos route handlers server-only
(`app/api/charge/route.ts`, `app/api/culqi/order/route.ts`). Una vez que el menú vive en
Supabase, ese import directo desde cliente es imposible (filtraría el patrón de acceso a
Supabase al bundle del navegador; no hay `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurada en este
proyecto — solo `SUPABASE_SERVICE_ROLE_KEY`, server-only). La solución es separar
físicamente, en dos archivos distintos, la función cacheada de listado público
(`getMenuItemsCached()`, envuelta en `unstable_cache`, consumida por un nuevo
`GET /api/menu` que el cliente llama por `fetch`) de la función de lectura viva
(`getMenuItemLive(id)`, sin ningún wrapper de caché, llamada directamente por
`app/api/charge/route.ts` y `app/api/culqi/order/route.ts`). Mantenerlas en el mismo archivo
es el pitfall más probable de este phase: alguien "simplifica" reusando la función cacheada en
la ruta de cobro y reintroduce exactamente el bug que MENU-04 existe para prevenir.

**Primary recommendation:** No tocar `next.config.ts` / no habilitar `cacheComponents`. Usar
`unstable_cache(fn, keyParts, { tags: ['menu'], revalidate: false })` para el listado público
vía un nuevo `GET /api/menu`, y una función Supabase directa sin caché para las dos rutas de
cobro. Invalidar con `revalidateTag('menu', { expire: 0 })` (no la forma de un solo argumento,
deprecada y con firma TypeScript problemática en `strict: true`) desde el nuevo
`PATCH /api/admin/menu`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Listado público del menú (lectura) | API / Backend (Route Handler `GET /api/menu`) | Browser/Client (fetch + render) | El cliente no tiene credenciales de Supabase; el Route Handler cachea con `unstable_cache` y devuelve JSON público (sin exponer columnas internas) |
| Precio vigente al momento de cobrar | API / Backend (`POST /api/charge`, `POST /api/culqi/order`) | Database/Storage | Nunca debe pasar por el Route Handler cacheado — lectura directa a Supabase en cada request, es el corazón de MENU-04 |
| Edición de precio / marca de agotado | API / Backend (`PATCH /api/admin/menu`) | Database/Storage | Escritura server-only con `service_role`; dispara la invalidación de caché en el mismo request |
| Invalidación de caché tras edición | API / Backend (dentro del mismo `PATCH /api/admin/menu`) | — | `revalidateTag` solo corre en Server Actions/Route Handlers, nunca en cliente ni en Proxy |
| Bloqueo de "agotado" en el carrito | Browser/Client (UX, deshabilita el botón) | API / Backend (rechazo autoritativo en `/api/charge`) | El cliente es solo UX; el servidor es quien realmente hace cumplir OPS-04 (mismo patrón que la regla de precio) |
| Persistencia del catálogo | Database/Storage (`menu_items` en Supabase) | — | Reemplaza el array estático; única fuente de verdad para ambos lados |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next/cache` (`unstable_cache`, `revalidateTag`) | Incluido en `next@16.2.9` | Cachear el listado público del menú sin golpear Supabase en cada visita, e invalidar on-demand tras una edición en `/admin` | Es la API estable y no-experimental de caching de datos no-`fetch` en el modelo "Previous Model" de Next 16; no requiere flags. `[CITED: node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md, node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md, .../revalidateTag.md]` |
| `@supabase/supabase-js` | `2.109.0` (ya instalada) | Query/update de la tabla `menu_items` desde `lib/supabase.ts` (mismo cliente lazy-singleton que ya usa el proyecto) | Ya es el ORM/cliente de datos del proyecto; no se introduce nada nuevo `[VERIFIED: package.json del repo]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `server-only` | `0.0.1` (última, sin cambios desde su publicación) | Marker package: hace que el build falle en seco si algo dentro de `lib/menu-data.ts` (el módulo con las queries a Supabase) se llega a importar por accidente desde un componente `"use client"` | Envolver el nuevo archivo server-only del menú; defensa en profundidad barata contra la filtración del patrón de acceso a Supabase (o, en el peor caso, de una futura env var) al bundle del navegador. Es exactamente el paquete que la propia documentación de Next recomienda para este patrón (`node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`, sección "Preloading data"). `[VERIFIED: npm registry — 0 dependencias, publicado y mantenido por sebmarkbage (React core team), sin repo de origen linkeado pero paquete trivial de 611 bytes, sin postinstall script, referenciado en la documentación oficial de Next.js instalada en este repo]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `unstable_cache` + `revalidateTag` (Previous Model) | `"use cache"` + `cacheTag` + `cacheLife` (Cache Components, flag `cacheComponents: true`) | Cache Components es la dirección "moderna" de Next 16 y da control más fino (stale/revalidate/expire por perfil), pero exige habilitar Partial Prerendering + navegación con `<Activity>` en **toda** la app — un cambio de comportamiento de renderizado no acotado al menú, inapropiado para introducir en un sitio de producción que cobra plata real como efecto colateral de cachear una carta. Se documenta como camino futuro si el proyecto decide adoptar Cache Components de forma deliberada, no en este phase. |
| `GET /api/menu` + fetch desde cliente (patrón ya usado por `/admin`) | Convertir `app/page.tsx` en Server Component que hace el fetch server-side y pasa `items` como prop a un client component hijo | La opción de Server Component evita el parpadeo de carga inicial (mejor UX/CLS/SEO) pero rompe la convención 100%-`"use client"` ya establecida en todo el repo (ver Anti-Patterns en CLAUDE.md, donde esa convención ya está señalada como deuda técnica reconocida, no como algo a corregir en este phase). Se recomienda NO tocar ese límite cliente/servidor en este phase — mantener el patrón de fetch-desde-cliente que ya usa `/admin` — y dejarlo como candidato de refactor futuro. |

**Installation:**
```bash
npm install server-only
```
No hay paquetes nuevos para `unstable_cache`/`revalidateTag` — vienen incluidos en `next`.

**Version verification:**
```bash
npm view server-only version   # 0.0.1, confirmado
npm view @supabase/supabase-js version  # ya instalado, 2.109.0 en package.json
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `server-only` | npm | >1 año, sin cambios (versión única 0.0.1) | Alto (dependencia transitiva de facto de casi todo el ecosistema Next/React Server Components) | Ninguno linkeado en el registry (paquete de 611 bytes, sin lógica más allá de un throw) | [OK] — sin flags de riesgo, sin script `postinstall` | Aprobado |

**Packages removed due to slopcheck [SLOP] verdict:** ninguno
**Packages flagged as suspicious [SUS]:** ninguno

`slopcheck` corrió en este entorno de research (`slopcheck install server-only`) — nota
operativa: ese comando ejecuta un `npm install` real, no un dry-run; se revirtió inmediatamente
(`git checkout -- package.json package-lock.json && npm ci`) para no dejar cambios de
dependencias fuera de un plan de ejecución. El planner/implementador debe correr
`npm install server-only` como parte de una task explícita del plan, no asumir que ya está
instalado.

## Architecture Patterns

### El problema central (léase antes de todo lo demás)

`lib/menu.ts` hoy tiene un contrato doble: es importado por `"use client"` (`app/page.tsx`,
para pintar la carta) y por dos Route Handlers server-only (`app/api/charge/route.ts`,
`app/api/culqi/order/route.ts`, para recalcular el total). Ese doble contrato deja de ser
posible en cuanto el menú vive en Supabase, porque:

1. No hay `NEXT_PUBLIC_SUPABASE_ANON_KEY` en este proyecto (`.env.example` solo define
   `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, ambas server-only). El cliente no tiene
   credenciales para hablar con Supabase directamente, ni debería — el patrón establecido en
   todo el repo es que el cliente habla con Supabase solo a través de `/api/*`.
2. `getMenuItem()` deja de ser síncrona. Una consulta a Supabase es async; el contrato
   síncrono actual (`getMenuItem(id): MenuItem | undefined`) no puede sobrevivir.

La solución no es "hacer un archivo async que ambos importan" — sería fácil terminar
reusando la misma función cacheada tanto para el listado público como para el cobro, lo cual
rompe MENU-04 (precio potencialmente stale en el charge). La solución es **dos funciones en
dos módulos físicamente separados**, para que sea estructuralmente difícil confundirlas:

- `lib/menu-data.ts` (nuevo, server-only, con `import "server-only"` en la primera línea):
  - `getMenuItemsCached()`: envuelta en `unstable_cache(..., { tags: ['menu'] })`. Solo la
    llama `GET /api/menu`.
  - `getMenuItemLive(id: number)`: consulta directa a Supabase, **sin** `unstable_cache` ni
    ningún otro wrapper de caché. Solo la llaman `app/api/charge/route.ts` y
    `app/api/culqi/order/route.ts`.
  - `updateMenuItem(id, patch)`: usada por `PATCH /api/admin/menu`; después de escribir,
    llama `revalidateTag('menu', { expire: 0 })` en el mismo request.
- `lib/menu.ts` (se conserva, se reduce a tipos puros): `export type MenuItem`,
  `export const CATEGORIES` (constante, no viene de la DB — ver Anti-Patterns). Este archivo
  sigue siendo importable desde `"use client"` porque ya no tiene ningún import de Supabase.

### System Architecture Diagram

```
Visitante público                          Jaime (dueño) en /admin
      │                                              │
      │ GET /                                        │ Basic Auth (proxy.ts)
      ▼                                               ▼
app/page.tsx ("use client")              app/admin/page.tsx ("use client",
      │ useEffect → fetch("/api/menu")     tab "Menú" nuevo)
      ▼                                               │ fetch("/api/admin/menu")
GET /api/menu (Route Handler)                         ▼
      │                                    GET/PATCH /api/admin/menu (Route Handler)
      │ llama                                         │ llama
      ▼                                                ▼
lib/menu-data.ts                          lib/menu-data.ts
  getMenuItemsCached()                      updateMenuItem(id, {precio_centimos?, agotado?})
      │ unstable_cache(                              │ 1. UPDATE menu_items ... WHERE id=?
      │   tags:['menu'],                              │ 2. revalidateTag('menu', {expire:0})
      │   revalidate:false)                            ▼
      │ (solo golpea Supabase si                  Supabase: tabla menu_items
      │  no hay entrada en cache o                (única fuente de verdad de precio/agotado)
      │  tras un revalidateTag)                        ▲
      ▼                                                │ lectura SIEMPRE viva, sin caché
Supabase: tabla menu_items ◄───────────────────────────┘
      ▲
      │ lectura SIEMPRE viva, sin caché (getMenuItemLive)
      │
POST /api/charge  ◄── checkout (Culqi token)
POST /api/culqi/order ◄── checkout (habilita Yape)
      (recalculan totalCents contra precio_centimos vigente en Supabase,
       rechazan si el item no existe o está agotado)
```

### Recommended Project Structure
```
lib/
├── menu.ts          # Tipos puros (MenuItem, CATEGORIES). Importable desde "use client".
├── menu-data.ts      # NUEVO. Server-only ("import 'server-only'" primera línea).
│                      # getMenuItemsCached() [cacheado] + getMenuItemLive(id) [siempre vivo]
│                      # + updateMenuItem() [escritura + invalidación]
└── supabase.ts        # Sin cambios — mismo lazy singleton que ya existe

app/
├── page.tsx            # Sin cambios de patrón: sigue "use client", pero MENU_ITEMS/CATEGORIES
│                        # importados estáticamente se reemplazan por fetch("/api/menu") en useEffect
├── api/
│   ├── menu/
│   │   └── route.ts     # NUEVO. GET público, llama getMenuItemsCached()
│   ├── admin/
│   │   └── menu/
│   │       └── route.ts # NUEVO. GET (listado completo para el panel) + PATCH (precio/agotado)
│   ├── charge/route.ts  # MODIFICADO: getMenuItem() -> await getMenuItemLive(id)
│   └── culqi/order/route.ts # MODIFICADO: idéntico cambio

supabase/migrations/
└── <timestamp>_menu_items.sql  # create table + seed con la carta real

__tests__/
├── menu.test.ts          # REESCRITO: ya no puede probar MENU_ITEMS síncrono; mockea Supabase
│                          # igual que api-charge.caracterizacion.test.ts
└── helpers/
    └── supabase-mock.ts   # EXTENDER: agregar soporte a .order()/.order() encadenado (listado)
                            # y a .update(...).eq() (edición admin), que hoy no existen en el mock
```

### Pattern 1: Función cacheada vs. función viva, separadas por archivo/nombre
**What:** Dos funciones exportadas de `lib/menu-data.ts` con nombres que dejan explícito cuál
es cuál: `getMenuItemsCached()` (para listado público) y `getMenuItemLive(id)` (para cobro).
**When to use:** Siempre que el mismo dato tenga un consumidor tolerante a unos segundos de
stale (la carta pública) y un consumidor que NUNCA puede ver un valor viejo (el cobro).
**Example:**
```typescript
// lib/menu-data.ts
// Source: node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md
import "server-only";
import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { MenuItem } from "@/lib/menu";

type MenuRow = {
  id: number;
  category: string;
  name: string;
  description: string;
  precio_centimos: number;
  badge: string | null;
  original_price_centimos: number | null;
  image: string | null;
  agotado: boolean;
};

function rowToMenuItem(row: MenuRow): MenuItem & { agotado: boolean } {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    description: row.description,
    price: row.precio_centimos / 100,
    badge: row.badge,
    originalPrice: row.original_price_centimos ? row.original_price_centimos / 100 : null,
    image: row.image,
    agotado: row.agotado,
  };
}

// Listado público — SOLO lo llama GET /api/menu. Cacheado hasta que alguien
// llame revalidateTag('menu', ...) desde PATCH /api/admin/menu.
export const getMenuItemsCached = unstable_cache(
  async () => {
    const { data, error } = await getSupabaseAdmin()
      .from("menu_items")
      .select("id, category, name, description, precio_centimos, badge, original_price_centimos, image, agotado")
      .order("category")
      .order("id");
    if (error) throw error;
    return (data ?? []).map(rowToMenuItem);
  },
  ["menu-items-public"],
  { tags: ["menu"], revalidate: false } // sin límite de tiempo; solo se invalida on-demand
);

// Lectura viva — SOLO la llaman /api/charge y /api/culqi/order. Nunca envolver
// esto en unstable_cache: es la garantía de MENU-04.
export async function getMenuItemLive(id: number) {
  const { data, error } = await getSupabaseAdmin()
    .from("menu_items")
    .select("id, precio_centimos, agotado")
    .eq("id", id)
    .single();
  if (error || !data) return undefined;
  return data as { id: number; precio_centimos: number; agotado: boolean };
}
```

### Pattern 2: Invalidación inmediata desde el Route Handler de admin
**What:** `revalidateTag(tag, { expire: 0 })`, no la forma de un argumento (deprecada) ni
`'max'` (stale-while-revalidate — deja servir una respuesta vieja al primer request
posterior a la edición).
**When to use:** Cualquier mutación hecha por un humano en `/admin` donde "sin deploy" implica
"casi inmediato", no "eventualmente en background".
**Example:**
```typescript
// Source: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md
// "For webhooks or third-party services that need immediate expiration,
//  you can pass { expire: 0 } as the second argument"
import { revalidateTag } from "next/cache";

export async function updateMenuItem(id: number, patch: { precio_centimos?: number; agotado?: boolean }) {
  const { error } = await getSupabaseAdmin().from("menu_items").update(patch).eq("id", id);
  if (error) throw error;
  revalidateTag("menu", { expire: 0 });
}
```
**Nota de firma:** el segundo argumento de `revalidateTag` **no es opcional** en la firma
publicada (`revalidateTag(tag: string, profile: string | { expire?: number }): void`). Con
`tsconfig.json` en `strict: true`, llamar `revalidateTag('menu')` a secas puede generar error
de tipos o forzar `@ts-expect-error` — usar siempre la forma de dos argumentos.

### Pattern 3: `GET /api/menu` no necesita `export const dynamic`
**What:** El Route Handler en sí no se marca como cacheado a nivel de ruta; la caché vive
dentro de `getMenuItemsCached()`.
**When to use:** Siempre, en el modelo "Previous Model". Route Handlers no se cachean por
defecto salvo `export const dynamic = 'force-static'` — pero eso cachearía la *respuesta
completa* congelada al build/primer request, no lo que se quiere aquí (se quiere volver a
ejecutar el Route Handler en cada request, y que sea la función interna la que decida si
golpea Supabase o devuelve la entrada cacheada).
**Example:**
```typescript
// app/api/menu/route.ts
// Source: node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md
//   ("Route Handlers are not cached by default")
import { getMenuItemsCached } from "@/lib/menu-data";

export async function GET() {
  const items = await getMenuItemsCached();
  return Response.json({ items });
}
```

### Anti-Patterns to Avoid
- **Envolver `getMenuItemLive` en `unstable_cache` "para ser consistentes":** rompe MENU-04.
  Es el pitfall #1 de este phase — ver "El problema central" arriba.
- **Habilitar `cacheComponents: true` solo para tener `cacheTag`/`use cache`:** cambia el
  modelo de renderizado de toda la app (PPR + navegación `<Activity>`) como efecto colateral
  de cachear una tabla. Fuera de alcance de este phase; ver Alternatives Considered.
- **Derivar `CATEGORIES` de un `SELECT DISTINCT category FROM menu_items`:** parece "más
  correcto" pero acopla el orden de los chips de categoría en la home al orden de inserción/
  alfabético de Postgres, que no coincide con el orden físico de la carta del local. Mantener
  `CATEGORIES` como constante en `lib/menu.ts` (ya es la Claude's Discretion documentada en
  CONTEXT.md) es más simple y ya está fuera del alcance de MENU-05.
- **Guardar `price` como `numeric`/`decimal` en Postgres y esperar un `number` de JS del lado
  del cliente supabase-js:** ver Common Pitfalls → "Postgres `numeric` llega como string".

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache de datos no-`fetch` con invalidación por tag | Un `Map` en memoria module-level con TTL casero (el proyecto ya tiene el precedente de `scriptPromise` en `lib/culqi.ts` para dedupe, pero eso es dedupe de un side-effect de browser, no cache de datos servidor-a-servidor) | `unstable_cache(fn, keyParts, { tags, revalidate })` | Es exactamente el problema que la API resuelve: persiste entre invocaciones serverless en Vercel (a diferencia de un `Map` module-level, que en un entorno serverless puede vivir en una instancia distinta en cada invocación) y se invalida con una sola llamada a `revalidateTag` |
| Rate/concurrencia de la invalidación de caché tras un edit concurrente en `/admin` | Lock manual o "última escritura gana" con timestamp casero | No aplica en este phase — un solo admin (Jaime) edita secuencialmente vía Basic Auth; no hay necesidad de resolver conflictos concurrentes de escritura para MVP | Sobre-ingeniería para el caso real: un dueño de restaurante editando un precio desde su celular, no un equipo editando en paralelo |
| Conversión de centavos ↔ soles | Funciones ad hoc con `Math.round(x*100)/100` repetidas en cada archivo | Centralizar en `lib/menu-data.ts` (`rowToMenuItem`) el único punto de conversión `precio_centimos → price` | El proyecto ya tiene el precedente de "todo en centimos" en `pedidos.total_centimos`; replicar el patrón evita que la lógica de redondeo/precisión de precios viva duplicada en dos o más route handlers |

**Key insight:** El riesgo real de este phase no es escribir demasiado código custom — es
escribir **la función correcta en el lugar equivocado** (cacheada donde no debe estarlo). El
"no hand-roll" más importante aquí es no reinventar una capa de caché casera cuando
`unstable_cache` + `revalidateTag` ya resuelven exactamente este problema sin dependencias
nuevas.

## Common Pitfalls

### Pitfall 1: Postgres `numeric`/`decimal` llega como `string` desde supabase-js
**What goes wrong:** Si la columna de precio se declara `numeric(10,2)` en la migración SQL,
`@supabase/supabase-js` la devuelve como **string** (`"17.90"`), no como `number` de JS —
comportamiento del driver `postgres-js`/PostgREST subyacente, no un bug. El tipo
`MenuItem.price: number` en TypeScript no lo va a detectar en tiempo de compilación porque el
tipo de la fila de Supabase no está generado (no hay `supabase gen types` en este repo hoy).
**Why it happens:** PostgREST serializa `numeric` como texto para no perder precisión decimal
en JSON (JS `number` es float de 64 bits, no decimal exacto).
**How to avoid:** No usar `numeric`/`decimal` para el precio. Usar `precio_centimos integer`
(igual que `pedidos.total_centimos` ya en el repo) — un entero nunca tiene este problema, y
además elimina el `Math.round(item.price * 100)` que hoy hace `/api/charge` (fuente de error de
redondeo de punto flotante, aunque hoy no se haya manifestado porque los precios actuales son
enteros). Con `precio_centimos`, `totalCents += item.precio_centimos * qty` es aritmética
entera pura, sin conversión.
**Warning signs:** Un test que compara `item.price === 17.9` que pasa en desarrollo local pero
falla intermitentemente, o un total de cobro que no cuadra en centavos exactos.

### Pitfall 2: `revalidateTag('menu')` de un solo argumento
**What goes wrong:** Compila (con warning o `@ts-expect-error` necesario en `strict: true`)
pero el comportamiento documentado como "deprecated" puede cambiar en un futuro minor de
Next sin aviso, y hoy mismo es ambiguo si aplica "expira inmediato" (comportamiento clásico) o
si algo del nuevo unified API lo trata distinto.
**Why it happens:** Next 16 unificó la firma de `revalidateTag` para Cache Components y
Previous Model a la vez, y dejó la forma vieja como puente de compatibilidad.
**How to avoid:** Siempre `revalidateTag('menu', { expire: 0 })` para invalidación inmediata
tras un edit de admin, o `revalidateTag('menu', 'max')` si alguna vez se decide tolerar
segundos de stale-while-revalidate (no es lo que pide MENU-03).
**Warning signs:** Editar el precio en `/admin`, refrescar `/` inmediatamente y ver el precio
viejo.

### Pitfall 3: Reusar la función cacheada en la ruta de cobro "por DRY"
**What goes wrong:** Alguien nota que `getMenuItemsCached()` y una hipotética
`getMenuItem(id)` hacen casi lo mismo y "simplifica" haciendo que `/api/charge` llame al
listado cacheado y filtre por id en memoria. Esto reintroduce el bug histórico documentado en
el propio código (`app/api/charge/route.ts:1-5`: "Antes el monto venia del cliente...").
**Why it happens:** Presión de DRY sin que el código deje explícito por qué las dos funciones
tienen que estar separadas.
**How to avoid:** Los dos nombres de función (`getMenuItemsCached` vs `getMenuItemLive`) y el
comentario en `lib/menu-data.ts` (ver Code Examples) existen específicamente para hacer este
error visualmente obvio en un code review.
**Warning signs:** Un import de `getMenuItemsCached` dentro de `app/api/charge/route.ts` o
`app/api/culqi/order/route.ts` — no debería pasar el `code_review` (`code_review_depth:
standard` está activo en `.planning/config.json`).

### Pitfall 4: Carritos existentes en `localStorage` de visitantes referencian ids que van a
dejar de existir
**What goes wrong:** El milestone reemplaza completamente los ids de `MENU_ITEMS` (1-17) por
ids nuevos generados por la tabla `menu_items` (bigint identity, empezando de nuevo). Un
visitante que tenga la web abierta en una pestaña o con un carrito guardado en
`localStorage` de antes del deploy, al intentar pagar, va a chocar con
`"Hay un producto que ya no está disponible"` en `/api/charge` (comportamiento ya existente
y correcto — el servidor rechaza ids desconocidos — pero el usuario no entiende por qué un
producto que "seguía en su carrito" de repente no existe).
**Why it happens:** `lib/cart-context.tsx` persiste el carrito en `localStorage` con
`STORAGE_KEY`, sin versión ni invalidación ligada a un cambio de catálogo.
**How to avoid:** No es bloqueante para este phase (bajo tráfico, negocio de barrio, ventana
de impacto acotada al momento del deploy) pero vale la pena decidir explícitamente con el
usuario: aceptar el corte duro, o agregar una validación client-side al cargar la página que
descarte del carrito los ids que ya no vienen en la respuesta de `GET /api/menu`. Documentado
en Open Questions — no se resuelve solo con esta research porque es una decisión de producto,
no técnica.

### Pitfall 5: Falta de límites de sanidad en el precio que edita el admin
**What goes wrong:** MENU-03 permite a Jaime cambiar el precio desde `/admin` sin deploy. Sin
validación de rango, un typo (escribir "1790" pensando en centavos cuando el campo espera
soles, o al revés) puede crear un producto a S/1790 o a S/0 — el segundo caso es
particularmente grave: un producto a S/0 pasaría la validación `MIN_CENTS`/`MAX_CENTS` de
`/api/charge` si el resto del carrito compensa el mínimo, y efectivamente regala comida.
**Why it happens:** No hay guard rail entre el input del `<input type="number">` del panel y
el `UPDATE` a Supabase.
**How to avoid:** Validar en `PATCH /api/admin/menu` un rango sano en centavos (ej. entre
`MIN_CENTS` = 300 ya existente en `app/api/charge/route.ts` — reusar esa constante o una
equivalente — y un techo razonable, ej. S/100). Rechazar con 400 fuera de ese rango.
**Warning signs:** No hay actualmente; es un guard rail preventivo, no un bug observado.

### Pitfall 6: `MenuCard` en `app/page.tsx` deja de tener datos síncronos en el primer render
**What goes wrong:** Hoy `MENU_ITEMS` es un import estático — la carta está disponible en el
primer render, sin loading state. Al pasar a `fetch("/api/menu")` en un `useEffect`, hay una
ventana (aunque corta) donde `filtered` está vacío. Sin un estado de carga explícito, el
usuario ve una grilla vacía o un salto de layout.
**Why it happens:** Consecuencia directa de mover el data source de bundle-time a
request-time en un componente que sigue siendo `"use client"`.
**How to avoid:** Agregar un estado `loading` simple (igual al patrón ya usado en
`app/admin/page.tsx`'s `refresh()`) y un skeleton o el mismo placeholder de ícono por
categoría mientras carga. No es parte de los success criteria explícitos del phase, pero es
necesario para no degradar la experiencia de la página que genera el revenue del negocio.

## Code Examples

### Migración SQL (convención del repo: comentarios explicando el "por qué", RLS habilitada sin políticas — mismo patrón que `pedidos` y `rate_limit_charge`)
```sql
-- Source: convención existente en supabase/migrations/20260820000000_pedidos.sql
--         y supabase/migrations/20260825000000_rate_limit.sql

-- El menu vivia como array estatico en lib/menu.ts (MENU-01). Pasa a Supabase
-- para que Jaime pueda cambiar precio/stock desde /admin sin deploy (MENU-03).
--
-- precio_centimos es integer, no numeric: supabase-js devuelve columnas
-- `numeric` como string (PostgREST serializa asi para no perder precision
-- decimal), lo que rompe silenciosamente la aritmetica de /api/charge si no
-- se castea a mano en cada lectura. Un entero en centimos replica el mismo
-- patron que pedidos.total_centimos y elimina el problema de raiz.
create table menu_items (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  category text not null,
  name text not null,
  description text not null default '',
  precio_centimos integer not null check (precio_centimos > 0),
  original_price_centimos integer,
  badge text,
  image text,
  -- Bloquea agregar al carrito y cobrar (OPS-04). El servidor es quien hace
  -- cumplir esto de verdad; el cliente solo deshabilita el boton.
  agotado boolean not null default false
);

create index menu_items_category_idx on menu_items (category, id);

-- Sin politicas: igual que pedidos y rate_limit_charge, la tabla solo la
-- toca el service_role desde el servidor (GET /api/menu, PATCH /api/admin/menu,
-- y los dos route handlers de cobro). El cliente nunca habla con Supabase
-- directamente -- no hay NEXT_PUBLIC_SUPABASE_ANON_KEY en este proyecto.
alter table menu_items enable row level security;

-- Seed de la carta real confirmada en 02-CONTEXT.md. "Lobo Sunset" se siembra
-- agotado a proposito: es el caso real para validar OPS-04/MENU-03, no un
-- dato de prueba sintetico.
insert into menu_items (category, name, description, precio_centimos, agotado) values
  ('Enchiladas', 'Enchilada de Pollo', 'pollo deshilachado, chorizo parrillero', 1790, false),
  ('Enchiladas', 'Enchilada de Chorizo', 'chorizo parrillero', 1790, false),
  ('Enchiladas', 'Enchilada Mixta', 'pollo deshilachado + chorizo parrillero', 1990, false),
  ('Enchiladas', 'Enchibestia', 'pollo deshilachado, cabanossi, tocino', 2090, false),
  ('Broaster', 'Broaster Lobito', '1 pieza (ala o pierna), papas fritas, ensalada, cremas', 1450, false),
  ('Broaster', 'Broaster Lobo', '1 pieza (pecho o entrepierna), papas o papas con arroz, ensalada, cremas', 1690, false)
  -- ... resto de la carta (ver <specifics> en 02-CONTEXT.md) — el planner
  -- debe generar el INSERT completo de las ~34 filas, no truncarlo.
;
```

### Home page consumiendo el menú vía fetch (mantiene el patrón `"use client"` + `useEffect` ya
usado por `app/admin/page.tsx`, no introduce Server Components nuevos)
```typescript
// app/page.tsx (fragmento relevante)
// Source: patrón ya existente en app/admin/page.tsx (refresh() + useEffect)
"use client";
import { useState, useEffect } from "react";
import type { MenuItem, } from "@/lib/menu";
import { CATEGORIES as categories } from "@/lib/menu";

type PublicMenuItem = MenuItem & { agotado: boolean };

export default function HomePage() {
  const [menuItems, setMenuItems] = useState<PublicMenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/menu")
      .then((r) => r.json())
      .then(({ items }) => setMenuItems(items ?? []))
      .finally(() => setLoading(false));
  }, []);

  // ... resto del componente sin cambios de estructura, filtered = menuItems.filter(...)
  // MenuCard debe deshabilitar "Agregar" si item.agotado === true (OPS-04, lado cliente)
}
```

### Rechazo de "agotado" en el servidor (OPS-04, lado autoritativo)
```typescript
// app/api/charge/route.ts (fragmento del loop de items, modificado)
// Source: patrón existente de rechazo por id inexistente, mismo archivo
for (const linea of items) {
  // ... validaciones de tipo existentes sin cambios ...
  const item = await getMenuItemLive(linea.id);
  if (!item) {
    return Response.json({ error: "Hay un producto que ya no está disponible" }, { status: 400 });
  }
  if (item.agotado) {
    return Response.json({ error: "Un producto de tu pedido ya no está disponible" }, { status: 400 });
  }
  totalCents += item.precio_centimos * linea.qty; // entero puro, sin Math.round
  // ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `unstable_cache` como única API de cache no-`fetch` | `"use cache"` + `cacheTag`/`cacheLife` bajo `cacheComponents: true`, con `unstable_cache` marcada "replaced by use cache" | Next 16.0.0 (`cacheComponents` introducido); `unstable_cache` sigue funcionando sin flag | `unstable_cache` no está eliminada ni rota — solo está en modo "legacy soportado". Es la elección correcta para este phase precisamente porque no arrastra el resto de los cambios de Cache Components |
| `revalidateTag(tag)` de un argumento, expira inmediato | `revalidateTag(tag, profile)` de dos argumentos, con `'max'` (stale-while-revalidate) recomendado por default y `{expire:0}` para el caso "inmediato" explícito | Next 16, unificación de firma | Afecta directamente a MENU-03: hay que elegir `{expire:0}` a propósito, el default recomendado en la doc (`'max'`) no da la semántica "se ve sin deploy" que pide el success criteria |
| Turbopack opcional (`--turbopack`) | Turbopack es el bundler **por defecto** en Next 16, sin flag | Next 16.0.0 | No se encontró ninguna interacción documentada entre Turbopack y `unstable_cache`/`revalidateTag` — al no habilitar Cache Components, este phase no toca ninguna superficie experimental de Turbopack. Riesgo: bajo/nulo para este phase específicamente |

**Deprecado/desactualizado:**
- `revalidateTag('tag')` (un argumento): funciona pero está marcado deprecated; no usar en
  código nuevo bajo `strict: true`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | El cliente HTTP interno de `@supabase/supabase-js` respeta el `fetch` global (no cacheado por defecto en Next 16 fuera de renderizado estático de Page/Layout) al ejecutarse dentro de un Route Handler, por lo que `getMenuItemLive()` no necesita ningún flag adicional para garantizar lectura fresca | "El problema central", Pitfall 3 | Si supabase-js usara un fetch interno no interceptado por Next (poco probable, pero no verificado con una prueba empírica en este entorno), el mecanismo real de frescura sigue siendo válido igual: la separación física en dos funciones (`getMenuItemsCached` vs `getMenuItemLive`, la segunda **sin** ningún wrapper de `unstable_cache`) es la garantía real, independiente de esta asunción. Bajo riesgo. |
| A2 | El orden de categorías sugerido para la UI (Enchiladas, Broaster, Salchipapas/Power Plates, Combos xtremos, Bebidas, Hamburguesas — el orden del documento fuente de CONTEXT.md) es el orden deseado en la carta pública | Standard Stack / Anti-Patterns | Bajo — es "Claude's Discretion" explícito en CONTEXT.md, el planner puede ajustarlo sin impacto técnico |
| A3 | Los íconos de lucide-react recomendados (`Hamburger`, `Drumstick`, `Sandwich`, `CupSoda`, `ShoppingBasket`, `Package`) son la mejor aproximación disponible en la versión instalada (`lucide-react@1.22.0`) a los pedidos textuales del dueño ("ícono de botella", "ícono estilo taco/wrap") — confirmado por listado real de `node_modules/lucide-react/dist/esm/icons/`, no existe un ícono literal de "botella genérica" ni de "taco" en esta librería | Code Examples (mapeo de íconos), ver nota abajo | Bajo/estético — si Jaime rechaza la aproximación, es un cambio de una línea por categoría, no estructural |

**Íconos resueltos (no quedó como pregunta abierta, se investigó directamente contra el
paquete instalado):**
| Categoría | Ícono lucide-react | Nota |
|---|---|---|
| Bebidas | `CupSoda` | No existe ícono de botella genérica; `BottleWine` existe pero es específico de vino, inapropiado para gaseosas |
| Enchiladas | `Sandwich` | No existe ícono de taco/wrap; `Sandwich` es la aproximación visual más cercana disponible |
| Hamburguesas | `Hamburger` | Match literal |
| Broaster | `Drumstick` | Match literal — coincide con la propia sugerencia del dueño ("pierna de pollo") en CONTEXT.md |
| Salchipapas / Power Plates | `ShoppingBasket` | Aproximación a "canasta de papas" sugerida en CONTEXT.md; no existe ícono de papas fritas en esta librería |
| Combos xtremos | `Package` | Comunica "combo/paquete", según lo pedido en CONTEXT.md |

## Open Questions

1. **¿Qué pasa con los carritos ya guardados en `localStorage` de visitantes al momento del deploy?**
   - What we know: los ids van a cambiar por completo (array estático → identity de Supabase);
     `/api/charge` ya rechaza correctamente ids desconocidos.
   - What's unclear: si vale la pena una validación client-side que limpie ids obsoletos del
     carrito al cargar la página, o si el corte duro es aceptable dado el volumen de tráfico.
   - Recommendation: decisión de producto, no técnica — plantear a Jaime/discuss-phase antes de
     planear la task; no bloquea el resto del phase (ver Pitfall 4).

2. **¿El campo `badge`/`original_price_centimos` se usa en el MVP de la carta real, o queda
   NULL para todos los items?**
   - What we know: CONTEXT.md no menciona promos/badges para la carta real confirmada (a
     diferencia de los datos inventados actuales, que sí tenían "AHORRA S/8" etc.).
   - What's unclear: si Jaime quiere algún badge tipo "BESTSELLER"/"NUEVO" desde el día uno.
   - Recommendation: sembrar como NULL para todos los items en la migración inicial; las
     columnas quedan disponibles para uso futuro sin requerir otra migración. No forma parte
     de los success criteria de MENU-01..04/OPS-04.

3. **`public/images/menu/el-breakfast-del-lobo.webp` ya existe y coincide exactamente con "El
   Breakfast del Lobo" de la carta real (S/19.90, en Salchipapas/Power Plates).**
   - What we know: el archivo existe hoy en el repo, sin estar referenciado por ningún
     `MenuItem` actual (los ids actuales no incluyen ese producto).
   - What's unclear: si es una foto real ya lista para usar, o un placeholder viejo con ese
     nombre por coincidencia.
   - Recommendation: el planner debería verificar el contenido de ese archivo antes de decidir
     si ese producto se siembra con `image: "/images/menu/el-breakfast-del-lobo.webp"` en vez
     de ícono — puede ahorrarle a Jaime una foto que ya estaría lista.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (proyecto conectado vía `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`) | MENU-01..04, OPS-04 | ✓ (ya en uso por `pedidos`/`reclamaciones`/`rate_limit_charge`) | Postgres 17 (`supabase/config.toml`) | — |
| Supabase CLI local | Desarrollo de la migración (`supabase/migrations/`) | ✓ (`supabase/config.toml` presente, `project_id: los-angeles`) | — | — |
| `next/cache` (`unstable_cache`, `revalidateTag`) | MENU-02, MENU-03 | ✓ (incluido en `next@16.2.9`, sin flag) | — | — |
| `server-only` (paquete nuevo) | Defensa en profundidad de `lib/menu-data.ts` | ✗ (no instalado — se revirtió tras el check de legitimidad de esta research) | `0.0.1` disponible en npm | Si se descarta, el riesgo real (import accidental desde cliente) igual se mitiga estructuralmente separando los módulos como se documenta arriba; `server-only` es defensa adicional, no bloqueante |

**Missing dependencies with no fallback:** ninguna.
**Missing dependencies with fallback:** `server-only` — instalar vía `npm install server-only`
como task explícita del plan; si por algún motivo se decide no instalarlo, la separación física
de módulos ya cubre el riesgo principal.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | Sí | `PATCH /api/admin/menu` y `GET /api/admin/menu` heredan la protección de Basic Auth ya existente en `proxy.ts` (matcher `/api/admin/:path*`) — no requiere código nuevo, solo ubicar la ruta bajo `app/api/admin/menu/route.ts` |
| V5 Input Validation | Sí | Validar `precio_centimos` (entero positivo, rango sano — ver Pitfall 5) y `agotado` (boolean estricto) en `PATCH /api/admin/menu` antes del `UPDATE`, mismo estilo de validación manual ya usado en `app/api/charge/route.ts` |
| V6 Cryptografía | No aplica | Este phase no introduce secretos ni tokens nuevos |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cliente envía `{id, qty}` con un precio implícito distinto al vigente | Tampering | Ya mitigado por el diseño existente de `/api/charge` (recalcula server-side) — este phase solo cambia la fuente del precio de un array a `getMenuItemLive()`, la garantía se mantiene igual |
| Un producto marcado agotado se agrega igual vía request armado a mano (bypass del botón deshabilitado en UI) | Tampering | `getMenuItemLive()` expone `agotado`; `/api/charge` y `/api/culqi/order` deben rechazar explícitamente si `item.agotado === true`, no solo confiar en que el frontend deshabilitó el botón (ver Code Examples) |
| Typo de precio en `/admin` crea un producto gratis o absurdamente caro | Tampering (auto-infligido, no atacante externo) | Rango de sanidad en `PATCH /api/admin/menu` (Pitfall 5) |
| `GET /api/menu` expone columnas internas no destinadas al público (ej. si en el futuro se agrega `costo_interno` a la tabla) | Information Disclosure | `getMenuItemsCached()` hace un `select()` explícito de columnas (no `select("*")`), replicando la misma disciplina que ya usa `app/api/admin/pedidos/route.ts` con `select("*")` — de hecho ahí sí usan `*` porque es admin-only; para el endpoint **público** nuevo, preferir lista explícita de columnas |

## Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md` — confirma que `cacheComponents: true` es requisito para `"use cache"`, y que introduce PPR + navegación `<Activity>` por defecto
- `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` — API "Previous Model": `unstable_cache`, `revalidateTag`, `revalidatePath`, route segment config
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md` — firma exacta, nota "replaced by use cache in Next.js 16" (sigue funcional)
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md` — firma de dos argumentos, `{expire:0}` para invalidación inmediata, forma de un argumento deprecada
- `node_modules/next/dist/docs/01-app/01-getting-started/09-revalidating.md` — tabla comparativa `revalidateTag` vs `updateTag`, confirma `updateTag` es Server-Actions-only (no aplica a Route Handlers)
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — "Route Handlers are not cached by default"; comportamiento con y sin Cache Components
- `node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md` — confirma Turbopack como bundler por defecto en Next 16, sin flag
- Código del repo: `lib/menu.ts`, `lib/supabase.ts`, `app/api/charge/route.ts`, `app/api/culqi/order/route.ts`, `app/admin/page.tsx`, `app/api/admin/pedidos/route.ts`, `proxy.ts`, `supabase/migrations/20260820000000_pedidos.sql`, `supabase/migrations/20260825000000_rate_limit.sql`, `__tests__/helpers/supabase-mock.ts`, `vitest.config.mts`, `.env.example`
- `node_modules/lucide-react/dist/esm/icons/` (listado real de archivos) — confirma qué íconos existen/no existen en la versión instalada

### Secondary (MEDIUM confidence)
- `npm view server-only` — versión, ausencia de dependencias, ausencia de script `postinstall`
- `slopcheck install server-only` — verdicto [OK], sin repo de origen linkeado (nota informativa, no bloqueante dado el tamaño/naturaleza trivial del paquete)

### Tertiary (LOW confidence)
- Ninguna — todos los hallazgos técnicos centrales de esta research se verificaron contra la documentación real embebida en el repo o contra el código/filesystem existente, no contra conocimiento de entrenamiento sin verificar.

## Metadata

**Confidence breakdown:**
- Standard stack (caching APIs): HIGH — verificado línea por línea contra `node_modules/next/dist/docs/` de la versión exacta instalada, no training data
- Architecture (separación cache/live, doble módulo): HIGH — se deriva directamente de una restricción dura del proyecto (no hay `NEXT_PUBLIC_SUPABASE_ANON_KEY`, MENU-04 es un requisito explícito), no de una preferencia
- Pitfalls (numeric-as-string, revalidateTag signature, carritos obsoletos): MEDIUM-HIGH — el pitfall de `numeric` como string es conocimiento bien establecido del ecosistema PostgREST/Supabase (no verificado empíricamente en este entorno con una query real, por no tener aún la tabla creada), el resto verificado contra código/docs

**Research date:** 2026-09-01
**Valid until:** 30 días (stack estable; revisar si Next libera un minor que cambie el default de `cacheComponents` o si el proyecto decide adoptar Cache Components deliberadamente en un phase futuro)
