# Phase 2: Menú vivo en Supabase y control de stock - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning
**Source:** Conversación con el dueño (Facundo, con acceso a la cuenta de Jaime) — carta real fotografiada del local + decisiones confirmadas en el chat, sin discuss-phase interactivo formal.

<domain>
## Phase Boundary

El menú deja de vivir como array estático en `lib/menu.ts` y pasa a una tabla de Supabase.
`/admin` permite editar precio y marcar agotado/disponible de un producto **ya existente**
en la carta, y ese cambio se refleja en la carta pública sin deploy. `POST /api/charge`
recalcula el total siempre contra el precio vigente en la base, nunca contra un valor cacheado.
La carta pública se sirve de caché de Next (revalidate/tag), no golpea Supabase en cada visita.

**Fuera de este phase (confirmado contra REQUIREMENTS.md, no expandir sin decisión explícita):**
CRUD completo (alta/baja de productos nuevos, categorías) es MENU-05 y modificadores con precio
es MENU-06 — ambos están marcados fuera del alcance v1 en REQUIREMENTS.md (líneas 90-91,
147-151). El dueño quiere seguir ampliando la carta ("vamos agregando más cosas"), pero
agregar un producto nuevo por ahora sigue siendo vía migración/seed, igual que hoy — no una
pantalla de alta en `/admin`. Dejar esto explícito para no inflar el scope de este phase.

</domain>

<decisions>
## Implementation Decisions

### Fuente de datos
- Reemplazar `MENU_ITEMS` de `lib/menu.ts` por la carta real de abajo — no fusionar con los
  productos inventados actuales (Miami Night, Doble Carne, etc.). Esos productos y sus imágenes
  huérfanas en `/public/images/menu/` se eliminan, no se reciclan.
- Migración inicial de Supabase debe sembrar (seed) la tabla con exactamente la carta real
  confirmada abajo.

### Stock / disponibilidad
- "Lobo Sunset" se siembra **agotado desde el arranque** (confirmado por el dueño) — es el caso
  real para validar el success criteria de OPS-04/MENU-03 sobre productos agotados, no un dato
  de prueba sintético.

### Imágenes / placeholders
- Mientras no haya fotos reales (el dueño las va a generar con Google Flow y las irá mandando
  producto por producto), cada item sin foto muestra un **ícono por categoría**, no una foto
  genérica ni un cuadro vacío:
  - Bebidas → ícono de botella
  - Enchiladas → ícono estilo taco/wrap
  - Hamburguesas → ícono de hamburguesa
  - Broaster / Salchipapas / Power Plates / Combos xtremos → sin ícono decidido, el planner
    propone uno sensato por categoría (ej. pierna de pollo para Broaster, canasta de papas para
    Salchipapas/Power Plates, algo que comunique "combo" para Combos xtremos) y lo deja documentado.
- El reemplazo de ícono por foto real debe poder hacerse **producto por producto, incremental**,
  sin romper ni requerir tocar el resto de la carta — el dueño va a ir mandando fotos de a poco.

### Correcciones sobre la lectura inicial de la carta
- "Filete de Pollo Royal" **no lleva queso** — el nombre no debe decir "Cheeseburger" (se había
  leído mal de la foto).
- "Mixta" = Enchilada Mixta (pollo deshilachado + chorizo parrillero combinados), S/19.90.
- Diferencia Broaster Lobito vs Broaster Lobo es la presa: Lobito = ala o pierna (solo papas
  fritas); Lobo = pecho o entrepierna (papas o papas con arroz).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap y requisitos
- `.planning/ROADMAP.md` — sección "Phase 2: Menú vivo en Supabase y control de stock" (goal,
  success criteria, requirements MENU-01..04 + OPS-04)
- `.planning/REQUIREMENTS.md` — líneas 27, 49-52, 90-91, 147-151 (MENU-01..06, OPS-04,
  traceability; MENU-05/06 explícitamente fuera de v1)

### Código existente relevante
- `lib/menu.ts` — fuente de verdad actual (array estático, será reemplazado por lectura de
  Supabase); mantiene el mismo contrato de tipos (`MenuItem`, `getMenuItem`) que consumen
  `app/api/charge/route.ts` y `app/api/culqi/order/route.ts`
- `app/api/charge/route.ts` — recalcula el total server-side contra `getMenuItem`; el precio
  vigente en Supabase debe ser la fuente de este cálculo después de la migración
- `app/api/culqi/order/route.ts` — mismo cálculo de total, duplicado; debe seguir en sync
- `supabase/migrations/` — convención de migraciones ya establecida (`20260820000000_pedidos.sql`,
  `20260825000000_rate_limit.sql`)
- `app/admin/page.tsx` — panel admin existente, ahí se agrega la edición de precio/stock
- `/public/images/menu/` — imágenes actuales, varias huérfanas de productos inventados a eliminar

</canonical_refs>

<specifics>
## Carta real confirmada (semilla de la migración)

### Enchiladas
(envueltas en tortilla de trigo, ensalada, queso, papas al hilo, cremas)
| Producto | Precio | Detalle |
|---|---|---|
| Enchilada de Pollo | S/17.90 | pollo deshilachado, chorizo parrillero |
| Enchilada de Chorizo | S/17.90 | chorizo parrillero |
| Enchilada Mixta | S/19.90 | pollo deshilachado + chorizo parrillero |
| Enchibestia | S/20.90 | pollo deshilachado, cabanossi, tocino |

### Broaster
| Producto | Precio | Detalle |
|---|---|---|
| Broaster Lobito | S/14.50 | 1 pieza de pollo (ala o pierna), papas fritas, ensalada, cremas |
| Broaster Lobo | S/16.90 | 1 pieza de pollo (pecho o entrepierna), papas o papas con arroz, ensalada, cremas |

### Salchipapas / Power Plates
| Producto | Precio | Detalle |
|---|---|---|
| Salchibasic | S/12.50 | papas fritas, frankfurter, cremas |
| Salchipobre | S/14.90 | papas fritas, frankfurter, huevo, plátano frito, cremas |
| Perro Lobo | S/12.90 | frankfurter, tocino, queso, papas al hilo, huevo, plátano frito, cremas |
| El Breakfast del Lobo | S/19.90 | pechugón a la plancha, papas fritas, huevo, plátano frito, cremas |

### Combos xtremos
| Producto | Precio | Detalle |
|---|---|---|
| Combo Resuelve | S/16.90 | 1 pieza de pollo (ala o pierna), papas fritas, ensalada, cremas, Coca-Cola 296ml |
| Combo Instinto | S/21.90 | chorizo parrillero, pollo deshilachado, queso, papas al hilo, ensalada, cremas, Coca-Cola 296ml |
| Combo Royal | S/18.50 | hamburguesa casera, huevo, queso, papas fritas o al hilo, ensalada, cremas, Lobo Sunset 350ml |

### Bebidas
| Producto | Precio | Nota |
|---|---|---|
| Guaraná 450ml | S/4.00 | |
| Coca-Cola 296ml | S/4.00 | |
| Inca Kola 296ml | S/4.00 | |
| Fanta Naranja 500ml | S/4.50 | |
| Fanta Kola Inglesa 500ml | S/4.50 | |
| Agua San Luis 500ml | S/3.50 | |
| Lobo Sunset 350ml (refresco de la casa) | S/3.90 | **sembrar como agotado** |

### Hamburguesas
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

**Cremas** (mayonesa, mostaza, ketchup, golf, aceituna, tártara, ají) — incluidas en los platos,
no son un ítem vendible aparte, no requieren fila propia en el menú.

</specifics>

<deferred>
## Deferred Ideas

- MENU-05 (CRUD completo del menú desde el panel: alta, baja, fotos, categorías) — fuera de v1,
  candidato a phase futura próxima dado que el dueño espera seguir ampliando la carta.
- MENU-06 (modificadores estructurados con precio) — fuera de v1.
- Fotos reales de cada producto (el dueño las genera con Google Flow) — se irán reemplazando
  incrementalmente sobre los placeholders de ícono, fuera del alcance de este plan de código.
- Confirmar con el dueño si las dos líneas de "Fanta" del menú físico (Naranja e Inglesa) son
  productos realmente distintos en la caja registradora o una sola — no se preguntó explícitamente,
  se tomaron como dos productos separados por default.

</deferred>

---

*Phase: 02-men-vivo-en-supabase-y-control-de-stock*
*Context gathered: 2026-09-01 via conversación directa (carta real + decisiones confirmadas)*
