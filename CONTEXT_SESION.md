# CONTEXTO DE SESIÓN Y OPERACIÓN MAVRE (Para Claude Code / Conductor)

> **Documento de Contexto Operativo y Arquitectura.** Este archivo sintetiza las decisiones de las sesiones de arquitectura ("Optimización de Flujos" y "Multi-Agente / Cocina") para que Claude Code en Conductor opere con contexto completo.

---

## 1. Contexto de Negocio y Validación en Cocina (Lobo Burger)

- **Cliente**: Jaime (dueño de Lobo Burger en Surquillo, Lima). Web en producción en `https://loboburger.com`.
- **Validación de Campo (2026-09-04)**: Realizada en vivo en la cocina del restaurante sobre hardware POS táctil heredado (Windows POSReady, resolución 1024x768).
- **Modo Kiosco**: Se determinó que la ticketera térmica opera en Chrome con `--kiosk-printing --app=https://loboburger.com/admin` para imprimir automáticamente sin diálogo emergente nativo.
- **Features de Cocina Validadas y en `main`**:
  1. **Cola Secuencial de Auto-Impresión**: 1.5s de delay entre tickets para no saturar el buffer de la impresora (`lib/auto-print.ts`).
  2. **Transición Atómica**: Al imprimirse, el pedido cambia automáticamente a `en_preparacion` con rollback y reintento (`lib/order-transition.ts`).
  3. **Chime Gate**: Silenciamiento del bucle de timbre con espaciado mínimo para evitar el molesto doble beep en cocina (`lib/chime-gate.ts`).
  4. **Formato Térmico de Cremas**: Salsas destacadas con peso ultra-bold (`+ CREMAS: ...`) en `components/thermal-ticket.tsx`.
  5. **Despacho a Delivery**: Reenvío estructurado por WhatsApp con cremas y enlace GPS de Google Maps al motorizado (`51923368745`).
- **Estado de Pruebas**: **205/205 tests unitarios pasando en Vitest** (`npx vitest run`).

---

## 2. Decisiones de la Sesión "Optimización de Flujos"

- **Política de Ahorro Extremo de Tokens**:
  - `~/.gsd/defaults.json` configurado en `model_profile: budget` (Sonnet para código, Haiku para verificación/completado).
  - Eliminados los checkers redundantes de planes y research expansivo. `skip_discuss: true` para evitar preguntas interactivas innecesarias.
- **La Ley de Distancia en el Grafo ($d \le 1$)**:
  - No escanear todo el repositorio ($d \to \infty$ causa alucinaciones y quema masiva de tokens).
  - Leer únicamente el archivo target a editar ($d=0$) y sus contratos inmediatos de tipos/interfaces ($d=1$).
  - Prohibido abrir layouts globales o páginas no relacionadas.
- **Segundo Cerebro (Obsidian / `MavreBrain_V1`)**:
  - Ubicado en `~/MavreBrain_V1` en la Mac y `D:\OBSIDIAN` en la PC. Sincronizado en tiempo real vía Syncthing P2P.
  - Regla de cierre: las decisiones de negocio van a `mavre/clients/LoboBurger/decisions/` y el resumen del día a `journal/YYYY-MM-DD.md`.
  - Corte biológico forzoso a las 11:30 PM (`/closesesh`).

---

## 3. Infraestructura Multi-Dispositivo (Malla Tailscale)

- **MacBook Air (`macbook-air-de-facundo`)**: `100.82.51.43` (Taller de ejecución, Claude Code en Conductor, Git Worktrees).
- **PC Windows (`MacoDesk`)**: `100.85.83.122` (Torre de control, orquestación, revisión de diffs).
- **iPhone 13 Pro**: `100.100.212.18` (Termius móvil para disparar tareas desde la terminal con SSH).

---

## 4. Herramientas y Atajos del Operador

- **Switcher Analógico (`m`)**: Navegador táctil en terminal con 7 botones (Clientes, Taller, Vault y `[U] UPC Clases`).
- **`mc <target>`**: Salta a la carpeta y arranca Claude Code directamente con `--dangerously-skip-permissions`.
- **`c`**: Alias rápido para `claude --dangerously-skip-permissions`.
- **Despachador Visual (`run-visible` / `run-on-mac.ps1`)**: Abre una ventana física visible de Terminal en la pantalla de la Mac para monitorear ejecuciones remotas sin que se traben en modo headless.

---

## 5. Protocolo de Trabajo en Conductor (`/ciclo-ejecucion`)

Cuando el operador te solicite una tarea en Conductor:
1. Pide o asume una **Spec Card** atómica: Target ($d=0$) + Contratos ($d=1$).
2. Ejecuta los cambios de forma quirúrgica sin explicaciones innecesarias ni divagaciones.
3. Corre siempre la suite de pruebas antes de confirmar:
   ```bash
   npx vitest run
   ```
4. Solo da por terminada la tarea si los 205 tests pasan al 100% y el build compila sin errores de TypeScript.
