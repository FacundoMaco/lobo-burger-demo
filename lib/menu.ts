// Fuente de verdad de la carta. Se importa desde el cliente (para pintar la
// carta) y desde el servidor (para recalcular el total de un pedido), asi que
// este archivo NO puede tener "use client" ni tocar el DOM.
//
// El precio que cobra /api/charge sale de aca, nunca del navegador.
// `agotado` forma parte del contrato compartido con lib/menu-data.ts; en esta
// fuente estatica siempre vale false.

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

export const CATEGORIES = ["Combos", "Burgers", "Pollo", "Complementos", "Bebidas"];

// Categorias que llevan comanda con eleccion de cremas (max CREMAS_MAX).
// Derivada de CATEGORIES por exclusion explicita: toda categoria nueva que se
// agregue a CATEGORIES lleva cremas por defecto salvo que se sume aca. Es un
// fail-open deliberado del lado cliente (solo afecta si se muestra el
// selector de cremas); la validacion real de negocio vive en el server via
// categoriaAdmiteCremas().
const CATEGORIAS_ESTATICAS_SIN_CREMAS = ["Bebidas"];
export const CATEGORIAS_CON_CREMAS = CATEGORIES.filter(
  (c) => !CATEGORIAS_ESTATICAS_SIN_CREMAS.includes(c)
);
export const CREMAS_OPCIONES = ["Mayonesa", "Mostaza", "Ketchup", "Ají", "Golf", "Aceituna", "Tártara"];
export const CREMAS_MAX = 3;

// Deny-list, no allow-list: las categorias de esta carta estatica
// (CATEGORIAS_CON_CREMAS) y las de la tabla menu_items en Postgres no
// coinciden, asi que validar contra CATEGORIAS_CON_CREMAS rechazaria todo
// pedido real. "Bebidas" es el unico nombre identico en ambas taxonomias.
export const CATEGORIAS_SIN_CREMAS = ["Bebidas"];

export function categoriaAdmiteCremas(category: string | null | undefined): boolean {
  if (!category) return false;
  return !CATEGORIAS_SIN_CREMAS.includes(category.trim());
}

// Precios por confirmar con la carta oficial de Jaime.
export const MENU_ITEMS: MenuItem[] = [
  { id: 13, category: "Combos",       name: "Combo Lobo",            description: "Burger de la casa + Salchipapa Clasica + Gaseosa.",                        price: 25, badge: "AHORRA S/8",  originalPrice: 33,   image: "/images/menu/a.webp",                     agotado: false },
  { id: 14, category: "Combos",       name: "Combo Bestia",          description: "Burgazo + Salchipapa XL + Jugo Natural. Para los que no se guardan nada.", price: 38, badge: "AHORRA S/13", originalPrice: 51,   image: "/images/menu/b.webp",                     agotado: false },
  { id: 1,  category: "Burgers",      name: "Miami Night",           description: "Carne smash, queso derretido, papas al hilo y salsas de la casa.",         price: 18, badge: null,          originalPrice: null, image: "/images/menu/miami-night.webp",           agotado: false },
  { id: 2,  category: "Burgers",      name: "Doble Carne",           description: "Doble carne smash, doble queso cheddar y salsa lobo.",                     price: 24, badge: "POPULAR",     originalPrice: null, image: "/images/menu/doublecarne.webp",           agotado: false },
  { id: 3,  category: "Burgers",      name: "Bacon Cheese",          description: "Carne smash, bacon crocante, queso cheddar fundido y salsa lobo.",         price: 22, badge: null,          originalPrice: null, image: "/images/menu/baconcheese.webp",           agotado: false },
  { id: 5,  category: "Burgers",      name: "Burgazo",               description: "La mas pedida: doble carne, queso, papas al hilo y salsas de la casa.",    price: 28, badge: "BESTSELLER",  originalPrice: null, image: "/images/menu/burgazo.webp",               agotado: false },
  { id: 16, category: "Burgers",      name: "Tropical Burger",       description: "Carne smash con pina dorada, queso y salsa especial.",                     price: 23, badge: null,          originalPrice: null, image: "/images/menu/tropical-burger.webp",       agotado: false },
  { id: 17, category: "Burgers",      name: "Chori Royal",           description: "Chorizo artesanal, queso derretido y salsas de la casa.",                  price: 20, badge: null,          originalPrice: null, image: "/images/menu/choriroyal.webp",            agotado: false },
  { id: 4,  category: "Pollo",        name: "Burger de Pollo",       description: "Filete de pollo crocante, lechuga fresca y mayonesa de la casa.",          price: 20, badge: null,          originalPrice: null, image: "/images/menu/burgerpollodesi.webp",       agotado: false },
  { id: 15, category: "Pollo",        name: "Filete de Pollo Royal", description: "Filete de pollo a la plancha, queso derretido y salsa de la casa.",        price: 21, badge: "NUEVO",       originalPrice: null, image: "/images/menu/filete-de-pollo-royal.webp", agotado: false },
  { id: 6,  category: "Complementos", name: "Salchipapa Clasica",    description: "Papas fritas golden, salchicha premium, ketchup y mayonesa.",              price: 10, badge: null,          originalPrice: null, image: null,                                      agotado: false },
  { id: 7,  category: "Complementos", name: "Salchipapa Lobo",       description: "Papas fritas, chorizo artesanal, queso derretido y salsa lobo.",           price: 14, badge: "ESPECIAL",    originalPrice: null, image: null,                                      agotado: false },
  { id: 8,  category: "Complementos", name: "Salchipapa XL",         description: "Porcion XL de papas, salchicha doble, tres salsas a eleccion y toppings.", price: 16, badge: null,          originalPrice: null, image: null,                                      agotado: false },
  { id: 9,  category: "Complementos", name: "Salchipobre",           description: "Papas fritas, salchicha, huevo frito y salsas — el clasico a lo pobre.",   price: 18, badge: null,          originalPrice: null, image: "/images/menu/salchipobre.webp",           agotado: false },
  { id: 10, category: "Bebidas",      name: "Gaseosa",               description: "Coca-Cola, Sprite, Fanta — fria y bien servida.",                          price: 5,  badge: null,          originalPrice: null, image: null,                                      agotado: false },
  { id: 11, category: "Bebidas",      name: "Limonada",              description: "Limonada natural frozen con menta y azucar de cana.",                      price: 7,  badge: null,          originalPrice: null, image: null,                                      agotado: false },
  { id: 12, category: "Bebidas",      name: "Jugo Natural",          description: "Maracuya, mango o naranja. Siempre del dia.",                              price: 8,  badge: null,          originalPrice: null, image: null,                                      agotado: false },
];

const BY_ID = new Map(MENU_ITEMS.map(i => [i.id, i]));

export function getMenuItem(id: number): MenuItem | undefined {
  return BY_ID.get(id);
}
