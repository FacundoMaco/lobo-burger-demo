import { vi } from "vitest";

export type ItemCatalogo = {
  id: number;
  name: string;
  precio_centimos: number;
  agotado: boolean;
  category: string;
};

// Fixtures arbitrarios >= 1001 (la secuencia real de menu_items arranca en 1001).
// NO deben asumirse iguales a los ids de producción.
export const CATALOGO_TEST: ItemCatalogo[] = [
  { id: 1001, name: "Enchilada de Pollo",  precio_centimos: 1790, agotado: false, category: "Enchiladas"   },
  { id: 1015, name: "Coca-Cola 296ml",     precio_centimos: 400,  agotado: false, category: "Bebidas"      },
  { id: 1020, name: "Lobo Sunset 350ml",   precio_centimos: 390,  agotado: true,  category: "Bebidas"      },
  { id: 1021, name: "Agua San Luis 500ml", precio_centimos: 350,  agotado: false, category: "Bebidas"      },
  { id: 1029, name: "Double Double",       precio_centimos: 1990, agotado: false, category: "Hamburguesas" },
  { id: 1030, name: "Burgazo",             precio_centimos: 2250, agotado: false, category: "Hamburguesas" },
];

export function menuDataMock(overrides?: ItemCatalogo[]) {
  return {
    getMenuItemLive: vi.fn(async (id: number) => {
      const catalogo = overrides ?? CATALOGO_TEST;
      return catalogo.find((i) => i.id === id);
    }),
  };
}
