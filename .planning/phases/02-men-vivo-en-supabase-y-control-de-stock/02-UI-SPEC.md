---
phase: 2
slug: 02-men-vivo-en-supabase-y-control-de-stock
status: draft
shadcn_initialized: true
preset: "n/a — components.json ya existía antes de este phase (style: base-nova, baseColor: neutral, icons: lucide). Ninguno de los dos archivos que toca este phase consume componentes shadcn."
created: 2026-09-01
---

# Phase 2 — UI Design Contract

> Visual and interaction contract para: (1) placeholder de ícono por categoría + estado "agotado"
> en la carta pública (`app/page.tsx`), y (2) edición inline de precio + toggle de agotado en
> `/admin` (`app/admin/page.tsx`, tab nuevo "Menú"). Generado por gsd-ui-researcher, verificado
> por gsd-ui-checker.

**Nota estructural — dos superficies, dos paletas:** este repo NO tiene un sistema de tokens
compartido; cada archivo de UI declara sus propios `const` de color en JS (`PRIMARY`, `ACCENT`,
`INK` en `app/page.tsx`; `YELLOW`, colores inline en `app/admin/page.tsx`). Esa convención ya
está señalada como decisión intencional en `CLAUDE.md` ("Existing brand tokens are inline JS
const objects per component... follow that existing convention, don't introduce a new
design-token system"). Este contrato respeta esa convención: no fusiona la carta pública
(editorial, clara) con `/admin` (oscuro, denso) en una sola paleta. Cada sección de Color abajo
está duplicada por superficie.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (ya inicializado en `components.json`, previo a este phase) — **no se consume en este phase** |
| Preset | `style: base-nova`, `baseColor: neutral` (existente, sin cambios) |
| Component library | Ninguno para este phase. `app/page.tsx` y `app/admin/page.tsx` usan HTML crudo + Tailwind + `style={{ ... }}` inline, no `components/ui/*`. Nuevas piezas (toggle, input inline) siguen ese mismo patrón, no shadcn `Switch`/`Input` |
| Icon library | `lucide-react@1.22.0` (ya instalada) |
| Font | `font-bebas` (Bungee, vía `--font-bebas`) para títulos/display; Work Sans (default de `body`) para texto; `font-mono` (JetBrains Mono) para precios y códigos |

---

## Icon Mapping — Placeholder por Categoría (carta pública)

Validado contra el paquete instalado (`node_modules/lucide-react/dist/esm/icons/`, confirmado
que los 6 íconos existen). Reemplaza el bloque `[Foto: {nombre}]` actual (`app/page.tsx:94-101`)
cuando `item.image === null`.

| Categoría | Ícono lucide-react | Justificación |
|---|---|---|
| Bebidas | `CupSoda` | No existe ícono de botella genérica en la librería; `BottleWine` es específico de vino |
| Enchiladas | `Sandwich` | Aproximación visual más cercana a "taco/wrap" disponible en la librería |
| Hamburguesas | `Hamburger` | Match literal |
| Broaster | `Drumstick` | Match literal — coincide con la sugerencia del dueño ("pierna de pollo") |
| Salchipapas / Power Plates | `ShoppingBasket` | Aproximación a "canasta de papas" — no existe ícono de papas fritas en la librería |
| Combos xtremos | `Package` | Comunica "combo/paquete" |

**Tratamiento visual del ícono placeholder:**
- Vive dentro del mismo contenedor `paddingTop: "62%"` que ya usa la imagen real (`app/page.tsx:85`) — no se cambia el aspect ratio del tile.
- Fondo del tile: mismo `placeholderColor(category)` ya definido (`app/page.tsx:29-38`) — reusar, no crear una paleta nueva de fondos por categoría.
- Ícono centrado, tamaño `32px` (`size={32}`), color `INK` a 35% de opacidad (`rgba(36,31,28,0.35)`) — mismo tono que el texto `[Foto: ...]` que reemplaza, para no subir el contraste del placeholder por encima del de una foto real.
- **Reemplazo incremental producto-por-producto:** el ícono se muestra únicamente cuando `item.image === null`. En cuanto un producto tiene `image` seteado en la tabla (foto real subida vía migración/seed manual, no hay pantalla de upload en este phase), el ícono desaparece solo — no requiere tocar otros productos ni el componente `MenuCard`. Este comportamiento ya existe en el componente actual (rama `item.image ? <Image/> : <placeholder/>`), solo cambia qué se renderiza en la rama `else`.

---

## Spacing Scale

Confirmado: el proyecto ya usa exclusivamente clases Tailwind en múltiplos de 4 (`p-3`, `p-4`,
`p-5`, `gap-1.5`, `gap-3`, etc.). Este phase no introduce una escala nueva.

| Token | Value | Usage en este phase |
|-------|-------|-------|
| xs | 4px | Gap entre ícono y label en el toggle "Disponible/Agotado" |
| sm | 8px | Gap entre nombre de producto y precio inline-editable en la fila de `/admin` |
| md | 16px | Padding de cada fila de producto en el tab "Menú"; padding del pill "AGOTADO" en la carta pública |
| lg | 24px | Separación entre grupos de categoría en el tab "Menú" de `/admin` |
| xl | 32px | Gap entre header del tab "Menú" y la primera categoría |

**Exceptions:**
- Toggle "Disponible/Agotado" (`/admin`, nuevo): track de **44×24px** con hit-area de **44×44px** — excepción explícita de touch target, porque el tab "Menú" se usa desde el celular de Jaime (el admin ya es responsive, ver header móvil en `app/admin/page.tsx:365`). No se aplica un múltiplo de 8 a este control específico, igual que el resto del sistema de spacing sí lo respeta.
- El botón "Agregar"/stepper de cantidad en la carta pública (`w-8 h-8` = 32px, `app/page.tsx:130-143`) es una convención **ya existente**, fuera de alcance de este phase — no se rediseña su hit-area aquí.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px (`text-sm`) | 400 (regular, Work Sans) | 1.5 |
| Label | 12px (`text-xs`) | 700 (bold, Work Sans) | 1.4 |
| Heading | 18px (`text-lg`, `font-bebas`) | 400 (Bungee — fuente de un solo peso) | 1.2 |
| Display | 28px móvil / 36px desktop (`text-3xl md:text-4xl`, `font-bebas`) | 400 (Bungee) | 1.1 |

**Pesos declarados para este phase: 2** (400 regular Work Sans + 700 bold Work Sans). `font-bebas`
(Bungee) es una fuente display de un solo peso, ya usada así en todo el repo — no cuenta contra
el límite de 2 pesos del sistema de texto funcional (label/body/CTA).

**Uso concreto:**
- Nombre de producto en fila de `/admin`: `text-sm font-bold` (14px/700) — igual que `o.name` en el tab Pedidos existente (`app/admin/page.tsx:482`).
- Descripción/detalle de producto: `text-xs` (12px/400), color `#888` — igual que `item.name` dentro de líneas de pedido existentes.
- Precio (display + input inline): `font-mono text-sm font-bold` (14px, mismo tamaño en todos los breakpoints, sin bump a `md:text-base`) — mismo patrón `font-mono` ya usado para precios en `app/page.tsx:119` y `app/admin/page.tsx:500`.
- Header de categoría en tab "Menú": `text-sm font-bold uppercase` — mismo patrón que `sectionTitle` de `ValidarTab` (`app/admin/page.tsx:134`), no el `font-bebas text-3xl` reservado para el título de página ("MENÚ").
- Título de página del tab nuevo: `font-bebas text-3xl md:text-4xl tracking-widest` — mismo patrón que "DASHBOARD HOY", "PEDIDOS", "CLIENTES" existentes.
- Badge "AGOTADO" en carta pública: `text-xs font-bold uppercase tracking-wider` (12px, reutiliza el token Label — no `text-[10px]`) — mismo patrón visual que `ItemBadge` existente (`app/page.tsx:59`), ajustado a la escala de 4 tamaños de este contrato.

---

## Color

### Superficie 1 — Carta pública (`app/page.tsx`, editorial/clara)

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#FFFDF8` (`BG`) | Fondo de página |
| Secondary (30%) | `#FFFFFF` (cards) + `INK` `#241F1C` en bordes/texto de baja opacidad | Tarjetas de producto, texto, bordes |
| Accent (10%) | `#F5A623` (`PRIMARY`) | **Reservado para:** botón "Agregar" en items disponibles, botón "+" del stepper de cantidad, fondo del hero |
| Segundo semántico (ya existente) | `#E63950` (`ACCENT`) | **Reservado para:** chip de categoría activo, badges de promo (BESTSELLER/AHORRA), no se reutiliza para "agotado" (evita mezclar la señal de "promo/urgencia" con "no disponible") |
| **Nuevo — semántico "agotado"** | `#6B6560` (gris ya definido como default de `ItemBadge`, `app/page.tsx:57`) | **Reservado exclusivamente para:** pill "AGOTADO" sobre la imagen/ícono, botón "Agregar" deshabilitado, filtro `grayscale` sobre el tile de imagen/ícono. No introduce un color nuevo — reutiliza el gris neutro que el sistema de badges ya trata como "no-promocional" |

### Superficie 2 — `/admin` (`app/admin/page.tsx`, oscuro/denso)

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#080808` (fondo página), `#0F0F0F` (sidebar/header) | Fondo general y navegación |
| Secondary (30%) | `#141414` (panel/fila), `#1f1f1f` (bordes) | Tarjetas de fila de producto en el tab "Menú" |
| Accent (10%) | `#C0392B` (rojo, ya usado como acento de marca del admin) | **Reservado para:** ítem de nav activo ("Menú" en el sidebar), borde izquierdo de énfasis |
| Segundo semántico (ya existente) | `#FFD600` (`YELLOW`) | **Reservado para:** valores monetarios — precio mostrado (no editando), total. Mismo uso que ya tiene en Dashboard/Pedidos |
| Semántico disponibilidad (reutiliza `statusConfig`) | `#2ecc71` (verde) = Disponible · `#C0392B` (rojo) = Agotado | **Reservado para:** el toggle "Disponible/Agotado" del tab "Menú" — mismo par verde/rojo que ya usa `statusConfig` para "listo" vs. estados pendientes, no se inventa un color nuevo |
| Destructive | No aplica — este phase no tiene acciones destructivas (ver Copywriting) | — |

---

## Copywriting Contract

### Carta pública

| Element | Copy |
|---------|------|
| CTA disponible (sin cambio) | "Agregar" (existente, `app/page.tsx:152`) |
| CTA en item agotado | "Agotado" — reemplaza el botón "Agregar"; `disabled`, sin hover/`active:scale-95`, cursor `not-allowed`, color gris `#6B6560` sobre fondo `rgba(107,101,96,0.12)` |
| Badge sobre imagen/ícono | "AGOTADO" (pill uppercase, esquina **superior izquierda** — el badge de promo existente usa la esquina superior derecha, `app/page.tsx:102-106`, para que ambos puedan coexistir sin superponerse) |
| Error al cargar la carta (`fetch("/api/menu")` falla) | "No pudimos cargar la carta. Actualiza la página o intenta en unos segundos." |
| Categoría sin productos (defensivo, no debería pasar con la semilla real) | "Todavía no hay productos en esta categoría." |
| Acción destructiva | Ninguna en esta superficie |

### `/admin` — tab nuevo "Menú"

| Element | Copy |
|---------|------|
| Primary CTA | "Guardar precio" — botón ícono-check que aparece solo mientras el campo de precio está en edición (`aria-label="Guardar precio"`), se dispara también con Enter o al perder foco (`onBlur`) |
| Toggle de stock — estado disponible | "Disponible" (verde) |
| Toggle de stock — estado agotado | "Agotado" (rojo) |
| Toast éxito — precio | "Precio actualizado" |
| Toast éxito — stock | "{nombre del producto} marcado como agotado" / "{nombre del producto} marcado como disponible" |
| Toast error (cualquier PATCH falla) | "No se pudo guardar. Intenta de nuevo." |
| Validación de rango de precio (input, antes de enviar) | "El precio debe estar entre S/3 y S/100." — límites tomados de `MIN_CENTS` existente en `app/api/charge/route.ts` (300 céntimos) y un techo razonable documentado en `02-RESEARCH.md` Pitfall 5 |
| Error al cargar el listado del panel | "No se pudo cargar el menú." + botón "Reintentar" (mismo patrón `RefreshCw` + "Actualizar" ya usado en los otros tabs) |
| Listado vacío (defensivo) | "Sin productos cargados." |
| Acción destructiva | **Ninguna.** Marcar "agotado" es reversible con un clic (toggle, sin modal de confirmación — mismo criterio que el resto de mutaciones de un-clic ya existentes en el panel, ej. avanzar estado de pedido). Editar un precio es corregible en cualquier momento; no hay alta/baja de productos en este phase (fuera de alcance, ver `02-CONTEXT.md`) |

---

## Nuevos elementos de interacción (detalle de comportamiento)

Esta sección amplía el contrato para que el executor no tenga que inferir el patrón de
interacción — no reemplaza las tablas de arriba, las hace accionables.

### Precio inline-editable (`/admin`, tab Menú)
1. Estado por defecto: precio se muestra como texto `font-mono font-bold` con color `YELLOW`, no parece un input.
2. Click/tap sobre el precio → se convierte en `<input type="number" step="0.10" min="3" max="100">`, mismo `inputStyle` ya definido en `ValidarTab` (`background:"#0a0a0a"`, `border:"1px solid #252525"`).
3. Enter o blur → PATCH a `/api/admin/menu`; mientras está en vuelo, input queda `disabled` con opacidad reducida (mismo patrón `disabled:opacity-30` ya usado en botones del panel).
4. Éxito → toast verde ("Precio actualizado"), input vuelve a texto estático con el nuevo valor.
5. Error o fuera de rango → toast rojo, el input NO se cierra (deja al admin corregir sin perder lo tecleado) — mismo patrón de `Toast` de `ValidarTab`.
6. Escape → cancela, revierte al valor anterior sin llamar al servidor.

### Toggle "Disponible/Agotado" (`/admin`, tab Menú)
1. Control tipo switch/pill (44×24px track, hit-area 44×44px), no un checkbox nativo — visualmente consistente con los `statusConfig` pills ya usados en Pedidos.
2. Click → PATCH inmediato (optimistic UI: el switch cambia de estado al toque, revierte si el PATCH falla).
3. Sin modal de confirmación (ver Copywriting → Acción destructiva: ninguna).
4. Toast confirma el resultado con el nombre del producto.

### Estado "agotado" en la carta pública (`app/page.tsx`)
1. `MenuCard` recibe `item.agotado: boolean` (nuevo campo del tipo, ver `02-RESEARCH.md`).
2. Si `agotado === true`:
   - Tile de imagen/ícono con `filter: grayscale(100%)`, `opacity: 0.5`.
   - Pill "AGOTADO" superior izquierda (ver Copywriting).
   - Botón "Agregar" reemplazado por botón deshabilitado "Agotado" (ver Copywriting) — **no** se oculta el producto de la carta, sigue visible (transparencia sobre el negocio, no genera la sensación de que "falta" un producto de la carta).
   - `add()` del carrito no se invoca — sin este guard client-side, `POST /api/charge` igual lo rechaza server-side (OPS-04, ya cubierto en `02-RESEARCH.md`), pero el guard de UI evita el viaje redondo inútil.
3. Card entera pierde el `hover:-translate-y-1` (sin afordance de interactividad que no existe).

### Loading state de la carta pública (mitiga Pitfall 6 de `02-RESEARCH.md`)
- Mientras `fetch("/api/menu")` está en vuelo: mostrar el mismo grid de `MenuCard` con tiles en el color `placeholderColor(category)` correspondiente y el ícono de categoría a opacidad reducida (mismo tratamiento visual que el placeholder "sin foto", no un skeleton gris genérico distinto) — evita un salto de layout y reutiliza vocabulario visual ya definido en este contrato, sin componente nuevo.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Ninguno — este phase no consume componentes de `components/ui/*` | No aplica |
| Terceros | Ninguno declarado | No aplica |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
