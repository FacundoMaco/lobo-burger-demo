-- Migración 20260901000000_menu_items.sql
-- Crea la tabla menu_items y siembra la carta real confirmada por Jaime.
--
-- NOTA TÉCNICA: Se utiliza precio_centimos integer (en lugar de numeric) porque
-- PostgREST serializa numeric como string ("17.90"), lo que rompería
-- silenciosamente la aritmética de /api/charge. Un entero en céntimos replica
-- el patrón de pedidos.total_centimos y elimina el problema de raíz.

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
  agotado boolean not null default false
);

create index menu_items_category_idx on menu_items (category, id);

-- RLS habilitada sin políticas públicas: la tabla solo es accesible vía service_role
-- desde el servidor. El cliente web nunca habla con Supabase directamente.
alter table menu_items enable row level security;

-- Seed con la carta real completa (30 productos).
-- "Lobo Sunset 350ml" se siembra como agotado = true (validación OPS-04).
-- Las 7 imágenes corresponden a fotos reales verificadas en el repositorio;
-- los demás 23 productos usan placeholder de ícono por categoría hasta reemplazo incremental.
insert into menu_items (category, name, description, precio_centimos, image, agotado) values
  ('Enchiladas', 'Enchilada de Pollo', 'pollo deshilachado, chorizo parrillero', 1790, null, false),
  ('Enchiladas', 'Enchilada de Chorizo', 'chorizo parrillero', 1790, null, false),
  ('Enchiladas', 'Enchilada Mixta', 'pollo deshilachado + chorizo parrillero', 1990, null, false),
  ('Enchiladas', 'Enchibestia', 'pollo deshilachado, cabanossi, tocino', 2090, null, false),
  ('Broaster', 'Broaster Lobito', '1 pieza de pollo (ala o pierna), papas fritas, ensalada, cremas', 1450, null, false),
  ('Broaster', 'Broaster Lobo', '1 pieza de pollo (pecho o entrepierna), papas o papas con arroz, ensalada, cremas', 1690, null, false),
  ('Salchipapas / Power Plates', 'Salchibasic', 'papas fritas, frankfurter, cremas', 1250, null, false),
  ('Salchipapas / Power Plates', 'Salchipobre', 'papas fritas, frankfurter, huevo, plátano frito, cremas', 1490, '/images/menu/salchipobre.webp', false),
  ('Salchipapas / Power Plates', 'Perro Lobo', 'frankfurter, tocino, queso, papas al hilo, huevo, plátano frito, cremas', 1290, null, false),
  ('Salchipapas / Power Plates', 'El Breakfast del Lobo', 'pechugón a la plancha, papas fritas, huevo, plátano frito, cremas', 1990, '/images/menu/el-breakfast-del-lobo.webp', false),
  ('Combos xtremos', 'Combo Resuelve', '1 pieza de pollo (ala o pierna), papas fritas, ensalada, cremas, Coca-Cola 296ml', 1690, null, false),
  ('Combos xtremos', 'Combo Instinto', 'chorizo parrillero, pollo deshilachado, queso, papas al hilo, ensalada, cremas, Coca-Cola 296ml', 2190, null, false),
  ('Combos xtremos', 'Combo Royal', 'hamburguesa casera, huevo, queso, papas fritas o al hilo, ensalada, cremas, Lobo Sunset 350ml', 1850, null, false),
  ('Bebidas', 'Guaraná 450ml', '', 400, null, false),
  ('Bebidas', 'Coca-Cola 296ml', '', 400, null, false),
  ('Bebidas', 'Inca Kola 296ml', '', 400, null, false),
  ('Bebidas', 'Fanta Naranja 500ml', '', 450, null, false),
  ('Bebidas', 'Fanta Kola Inglesa 500ml', '', 450, null, false),
  ('Bebidas', 'Agua San Luis 500ml', '', 350, null, false),
  ('Bebidas', 'Lobo Sunset 350ml', 'refresco de la casa', 390, null, true),
  ('Hamburguesas', 'Classic', '', 1350, null, false),
  ('Hamburguesas', 'Cheeseburger', '', 1490, null, false),
  ('Hamburguesas', 'Hamburguesa Royal', '', 1650, null, false),
  ('Hamburguesas', 'Deshilachado Royal', '', 1690, null, false),
  ('Hamburguesas', 'Filete de Pollo Royal', 'sin queso', 1690, '/images/menu/filete-de-pollo-royal.webp', false),
  ('Hamburguesas', 'Bacon Cheeseburger', '', 1690, '/images/menu/baconcheese.webp', false),
  ('Hamburguesas', 'ChoriRoyal', '', 1690, '/images/menu/choriroyal.webp', false),
  ('Hamburguesas', 'Double Double', '', 1990, null, false),
  ('Hamburguesas', 'Burgazo', '', 2250, '/images/menu/burgazo.webp', false),
  ('Hamburguesas', 'Tropical Burguer', '', 1790, '/images/menu/tropical-burger.webp', false);
