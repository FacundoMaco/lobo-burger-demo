# Summary Plan 02-02: Cobro contra precio vivo y rechazo de agotados (MENU-04, OPS-04)

## Estado
- **Completado**: Sí
- **Tests**: 142/142 pasando en verde (16 test suites)
- **TypeScript**: `tsc --noEmit` exit code 0
- **Build**: `next build` exit code 0
- **Lint**: Paridad exacta con la baseline (3 problemas preexistentes de react-hooks/set-state-in-effect)

## Entregables y Cambios
1. **`lib/menu-data.ts`**:
   - `getMenuItemLive` ahora selecciona y devuelve `{ id, name, precio_centimos, agotado }` en vivo desde Postgres, sin ningún wrapper de caché.
2. **`__tests__/helpers/menu-data-mock.ts`**:
   - Fixture canónico `CATALOGO_TEST` (ids 1001, 1015, 1020 [agotado], 1021, 1029, 1030) y factory `menuDataMock()`.
3. **`app/api/charge/route.ts`**:
   - Lee el precio vivo de la base con `await getMenuItemLive(linea.id)`.
   - Rechaza con 400 (`"Un producto de tu pedido ya no está disponible"`) si `item.agotado === true`.
   - Aritmética entera pura sobre `precio_centimos`.
   - Guarda `detalle` con el nombre real en `pedidos.items`.
4. **`app/api/culqi/order/route.ts`**:
   - Idéntica validación viva con `await getMenuItemLive` y rechazo de agotados con 400.
5. **Suites de Tests**:
   - Nueva: `__tests__/api-charge.precio-vivo.test.ts` (5 tests).
   - Nueva: `__tests__/api-culqi-order.test.ts` (5 tests).
   - Retrofit limpio de las 5 suites de `api-charge.*.test.ts` para usar `CATALOGO_TEST` y mocks de `menu-data`.
