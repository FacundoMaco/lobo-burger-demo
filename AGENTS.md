<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Guardrails

Estas reglas nacen de un incidente real (quick task `260902-3pr`, 2026-09-02): la rama
`pricing-desarrollo-3-cuotas` llegó a review con el build roto y las 5 rutas devolviendo
500, en un repo que cobra soles reales en producción.

## 1. Compilación atómica — cero builds rotos entre tareas

Ningún commit puede dejar el árbol sin compilar, ni siquiera "hasta la fase siguiente".
Si un plan dice explícitamente *"quedan rotos a nivel de import hasta el plan siguiente,
es esperado"*, **esa premisa está anulada**: se ignora. Cuando se deprecia una función,
se mantiene la versión previa hasta que todos sus consumidores migren en el mismo commit.

Antes de borrar cualquier export, buscá quién lo usa:
`grep -rn --include='*.ts' --include='*.tsx' 'nombreDelExport' app components lib __tests__`

## 2. Gate estricto pre-vuelo

Ninguna tarea se da por terminada sin correr los tres, y sin pegar la salida real:

    npx tsc --noEmit && npx vitest run && npm run lint

`npm run lint` sale con exit 1 por una **baseline preexistente** de 3 errores
`react-hooks/set-state-in-effect` (`app/puntos/page.tsx`, `lib/cart-context.tsx`).
El criterio no es "exit 0", es **paridad con esa baseline**: si aparece cualquier regla
distinta de `react-hooks/set-state-in-effect`, la tarea no está cerrada. Medí la baseline
del merge-base antes de discutir, no la asumas.

## 3. Integridad de directivas de Next.js

`"use client"` y `"use server"` tienen que ser la **primera** sentencia del archivo.
Ningún import por encima. Un import en la línea 1 degrada la directiva a expresión suelta
y Next falla con `The "use client" directive must be placed before other expressions`;
si el archivo cuelga de `app/layout.tsx`, se caen todas las rutas del sitio.

Síntoma temprano en lint: `@typescript-eslint/no-unused-expressions` apuntando a la
línea de la directiva. Cuidado con las herramientas que insertan imports automáticamente.

## 4. Cuarentena de alcance — la UI va al final

No se construye UI contra endpoints que todavía no existen. Primero se cierran las rutas
de API y los tipos; la pantalla va después. Si la UI ya está escrita y su backend no,
va a cuarentena en `.context/` (gitignored) y se reaplica cuando las rutas existan — no
se mergea llamando a un 404.

Antes de escribir un `fetch("/api/...")`, verificá que la ruta exista: `ls app/api/`.

## 5. Singleton para APIs del navegador con límite de hardware

`AudioContext`, WebSockets, Service Workers y similares no se instancian dentro de
funciones efímeras: el navegador tiene un tope y al pasarlo fallan en silencio (peor si
hay un `catch {}` vacío). Van en un singleton de módulo o un `useRef`. Pesa el doble en
pantallas de larga vida como `/admin`, que queda abierta todo el turno de cocina.
