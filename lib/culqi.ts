// Culqi Checkout Custom — reemplaza al Checkout v4, que Culqi va a discontinuar.
// El formulario de tarjeta lo sigue renderizando Culqi (los datos nunca tocan
// nuestro servidor); lo que cambia es que se embebe dentro de la pagina y se
// estila con los tokens de la marca. El cargo se crea server-side en
// app/api/charge/route.ts.

type CulqiInstance = {
  token?: { id: string };
  order?: unknown;
  error?: { user_message?: string; merchant_message?: string };
  culqi: () => void;
  open: () => void;
  close: () => void;
};

declare global {
  interface Window {
    CulqiCheckout: new (publicKey: string, config: unknown) => CulqiInstance;
  }
}

const SCRIPT_SRC = "https://js.culqi.com/checkout-js";

let scriptPromise: Promise<void> | null = null;

function loadCulqiScript(): Promise<void> {
  if (typeof window !== "undefined" && window.CulqiCheckout) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error("No se pudo cargar Culqi"));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

const INK = "#241F1C";
const PRIMARY = "#F5A623";
const MUTED = "#6B6560";
const BORDER = "rgba(36,31,28,0.18)";

// El formulario de Culqi se estila para que se lea como parte de la pagina:
// sin su banner (la pagina ya dice Lobo Burger y muestra el total) y sin el
// campo de email (lo pedimos antes y lo pasamos por client.email).
const appearance = {
  theme: "default",
  hiddenCulqiLogo: true,
  hiddenBannerContent: true,
  hiddenBanner: true,
  hiddenToolBarAmount: false,
  hiddenEmail: true,
  menuType: "sliderTop",
  buttonCardPayText: "Pagar",
  logo: "",
  defaultStyle: {
    buttonBackground: PRIMARY,
    buttonTextColor: INK,
    menuColor: INK,
    linksColor: "#E63950",
    priceColor: INK,
  },
  variables: {
    fontFamily: "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontWeightNormal: "500",
    borderRadius: "12px",
    colorBackground: "#FFFFFF",
    colorPrimary: PRIMARY,
    colorPrimaryText: INK,
    colorText: INK,
    colorTextSecondary: MUTED,
    colorTextPlaceholder: "#A9A29C",
    colorIconTab: INK,
    colorLogo: "dark",
  },
  rules: {
    ".Culqi-Main-Container": {
      background: "#FFFFFF",
      fontFamily: "var(--fontFamily)",
    },
    ".Culqi-Toolbar-Price": {
      color: INK,
      fontFamily: "var(--fontFamily)",
      fontWeight: "700",
    },
    ".Culqi-Label": {
      color: MUTED,
      fontFamily: "var(--fontFamily)",
      fontSize: "12px",
      fontWeight: "600",
    },
    ".Culqi-Input": {
      border: `1.5px solid ${BORDER}`,
      borderRadius: "10px",
      color: INK,
      fontFamily: "var(--fontFamily)",
    },
    ".Culqi-Input:focus": { border: `2px solid ${PRIMARY}` },
    ".Culqi-Input.input-valid": { border: `1.5px solid ${BORDER}`, color: INK },
    ".Culqi-Button": {
      background: PRIMARY,
      color: INK,
      borderRadius: "12px",
      fontFamily: "var(--fontFamily)",
      fontWeight: "700",
    },
    ".Culqi-Main-Method": { borderRadius: "12px", color: INK },
    ".Culqi-Menu": { fontFamily: "var(--fontFamily)", color: MUTED },
    ".Culqi-Menu-Selected": { color: INK },
  },
};

export type DatosPedido = {
  items: { id: number; qty: number }[];
  name: string;
  phone: string;
  delivery: boolean;
  address: string;
  lat?: number;
  lng?: number;
};

export type CulqiCheckoutParams = {
  amount: number; // solo para mostrar el monto en el formulario
  email: string;
  pedido: DatosPedido;
  containerId?: string; // si se pasa, el formulario se embebe ahi en vez de abrir un modal
};

export type CulqiCheckoutResult =
  | { success: true; chargeId: string; codigo: string }
  | { success: false; cancelled?: boolean; error?: string };

export async function initCulqiCheckout({
  amount,
  email,
  pedido,
  containerId,
}: CulqiCheckoutParams): Promise<CulqiCheckoutResult> {
  await loadCulqiScript();

  const embedded = Boolean(containerId);

  // Sin una Orden creada de antemano, el Checkout Custom solo muestra
  // tarjeta y esconde Yape sin avisar por que (ver docs.culqi.com/checkout-custom).
  // Culqi exige un monto minimo mas alto para Ordenes que para Cargos sueltos
  // (S/6 vs S/3): si el carrito no llega, o si Culqi esta caido, se degrada
  // a pago solo con tarjeta en vez de bloquear el pago entero.
  let orderId: string | undefined;
  let amountCents = Math.round(amount * 100);
  try {
    const orderRes = await fetch("/api/culqi/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: pedido.items,
        name: pedido.name,
        phone: pedido.phone,
        email,
      }),
    });
    const orderData = await orderRes.json();
    if (orderRes.ok) {
      orderId = orderData.orderId;
      amountCents = orderData.amount;
    }
  } catch {
    // Sigue sin orden: el pago con tarjeta se mantiene disponible.
  }

  const config = {
    // Ojo: settings solo acepta title/currency/amount/order. Agregar cualquier
    // otra clave (p. ej. description) hace que el checkout no renderice, sin
    // lanzar ningun error. La descripcion viaja al cargo server-side.
    settings: {
      title: "Lobo Burger",
      currency: "PEN",
      amount: amountCents,
      ...(orderId ? { order: orderId } : {}),
    },
    client: { email },
    options: {
      lang: "auto",
      installments: false,
      modal: !embedded,
      ...(embedded ? { container: `#${containerId}` } : {}),
      paymentMethods: {
        tarjeta: true,
        yape: true,
        billetera: false,
        bancaMovil: false,
        agente: false,
        cuotealo: false,
      },
    },
    appearance,
  };

  const culqi = new window.CulqiCheckout(
    process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY as string,
    config
  );

  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: CulqiCheckoutResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    culqi.culqi = async () => {
      if (culqi.token) {
        const tokenId = culqi.token.id;
        culqi.close();
        try {
          // Se manda QUE se pidio, no CUANTO cuesta: el total lo recalcula
          // el servidor contra la carta.
          const res = await fetch("/api/charge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tokenId, email, ...pedido }),
          });
          const data = await res.json();
          if (res.ok) settle({ success: true, chargeId: data.chargeId, codigo: data.codigo });
          else settle({ success: false, error: data.error });
        } catch {
          settle({ success: false, error: "Error de conexión. Intenta de nuevo." });
        }
      } else if (culqi.error) {
        settle({
          success: false,
          error: culqi.error.user_message || "No se pudo procesar el pago",
        });
      }
    };

    culqi.open();
  });
}
