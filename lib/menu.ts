// Tipos y constantes públicas del menú.
//
// Este archivo es seguro para importar desde el navegador ("use client") porque
// NO contiene datos sensibles, ni lógica de acceso a base de datos, ni imports de Supabase.
// La fuente de verdad del precio y del stock es la tabla `menu_items` en Supabase;
// aquí solo residen los contratos de tipo y el orden canónico de categorías para la UI.

export type MenuItem = {
  id: number;
  category: string;
  name: string;
  description: string;
  price: number;
  badge: string | null;
  originalPrice: number | null;
  image: string | null;
  agotado: boolean;
};

export const CATEGORIES = [
  "Enchiladas",
  "Broaster",
  "Salchipapas / Power Plates",
  "Combos xtremos",
  "Bebidas",
  "Hamburguesas",
] as const;
