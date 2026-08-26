# Deferred Items — Fase 1

Items descubiertos durante la ejecucion que estan fuera del scope de la tarea que los
encontro. No se arreglan de paso.

| Categoria | Item | Estado | Descubierto en |
|-----------|------|--------|-----------------|
| Lint preexistente | `npm run lint` falla con 3 errores `react-hooks/set-state-in-effect` en `app/admin/page.tsx:320`, `app/puntos/page.tsx:121` y `lib/cart-context.tsx:60`. Preexistentes desde el commit `eb9f243`, ninguno de los tres archivos fue tocado por el plan 01-01. | No corregido — fuera de scope de INFRA-04 | Plan 01-01, Task 2 (verificacion `npm run lint`) |
