import "server-only";

import { unstable_cache, revalidateTag } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { MenuItem } from "@/lib/menu";

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
): Promise<{ id: number; precio_centimos: number; agotado: boolean } | undefined> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, precio_centimos, agotado")
    .eq("id", id)
    .single();

  if (error || !data) {
    return undefined;
  }

  return {
    id: data.id,
    precio_centimos: data.precio_centimos,
    agotado: Boolean(data.agotado),
  };
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
