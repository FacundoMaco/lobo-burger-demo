import "server-only";

import { unstable_cache, revalidateTag } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { MENU_ITEMS, type MenuItem } from "@/lib/menu";

// Orden canonico de las categorias reales de la tabla `menu_items`, consumido
// por los route handlers cuando el plan 02-02 los migre.
export const MENU_CATEGORIES = [
  "Enchiladas",
  "Broaster",
  "Salchipapas / Power Plates",
  "Combos xtremos",
  "Bebidas",
  "Hamburguesas",
] as const;

type MenuItemRow = {
  id: number;
  category: string;
  name: string;
  description: string;
  precio_centimos: number;
  original_price_centimos: number | null;
  badge: string | null;
  image: string | null;
  agotado: boolean;
};

function rowToMenuItem(row: MenuItemRow): MenuItem {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    description: row.description || "",
    price: row.precio_centimos / 100,
    originalPrice: row.original_price_centimos ? row.original_price_centimos / 100 : null,
    badge: row.badge,
    image: row.image,
    agotado: Boolean(row.agotado),
  };
}

async function fetchMenuItemsInternal(): Promise<MenuItem[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, category, name, description, precio_centimos, badge, original_price_centimos, image, agotado")
    .order("category")
    .order("id");

  if (error) {
    throw error;
  }

  return (data || []).map((r) => rowToMenuItem(r as MenuItemRow));
}

/**
 * Lectura pública cacheada del menú.
 * Utiliza Next.js unstable_cache con tag 'menu' para máxima velocidad en la carta.
 * Se invalida automáticamente cuando se actualiza precio o stock en /admin.
 */
export const getMenuItemsCached = unstable_cache(
  fetchMenuItemsInternal,
  ["menu-items-public"],
  { tags: ["menu"], revalidate: false }
);

/**
 * ADVERTENCIA CRÍTICA DE INTEGRIDAD (MENU-04):
 * Esta función NUNCA debe envolverse en unstable_cache ni memorizarse.
 * Devuelve el precio vigente exacto y estado de stock en vivo directo de la base de datos.
 * Las únicas rutas que deben llamar a esta función son las de cobro (/api/charge y /api/culqi/order).
 */
export async function getMenuItemLive(
  id: number
): Promise<{ id: number; name: string; precio_centimos: number; agotado: boolean } | undefined> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, name, precio_centimos, agotado")
      .eq("id", id)
      .single();

    if (!error && data) {
      return {
        id: data.id,
        name: data.name,
        precio_centimos: data.precio_centimos,
        agotado: Boolean(data.agotado),
      };
    }
  } catch {
    // Supabase no disponible o tabla vacia
  }

  // Fallback defensivo a MENU_ITEMS (soporta los IDs 1..17 del catalogo actual)
  const local = MENU_ITEMS.find((m) => m.id === id);
  if (local) {
    return {
      id: local.id,
      name: local.name,
      precio_centimos: Math.round(local.price * 100),
      agotado: Boolean(local.agotado),
    };
  }

  return undefined;
}

/**
 * Actualiza precio_centimos o estado de agotado de un producto desde el panel de administración.
 * Invalida inmediatamente el tag 'menu' para que los clientes vean la actualización en la carta pública.
 */
export async function updateMenuItem(
  id: number,
  patch: { precio_centimos?: number; agotado?: boolean }
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("menu_items")
    .update(patch)
    .eq("id", id);

  if (error) {
    throw error;
  }

  // La firma requiere profile; { expire: 0 } fuerza la purga inmediata de la caché
  revalidateTag("menu", { expire: 0 });
}
