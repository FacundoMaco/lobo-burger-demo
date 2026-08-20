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

// Paleta de la marca aplicada al formulario de Culqi.
const appearance = {
  theme: "default",
  hiddenCulqiLogo: false,
  hiddenBannerContent: false,
  hiddenBanner: false,
  hiddenToolBarAmount: false,
  menuType: "sliderTop",
  buttonCardPayText: "Pagar",
  logo: "",
  defaultStyle: {
    bannerColor: "#F5A623",
    buttonBackground: "#F5A623",
    menuColor: "#241F1C",
    linksColor: "#E63950",
    buttonTextColor: "#241F1C",
    priceColor: "#241F1C",
  },
};

export type CulqiCheckoutParams = {
  amount: number; // en soles
  description: string;
  email: string;
  containerId?: string; // si se pasa, el formulario se embebe ahi en vez de abrir un modal
};

export type CulqiCheckoutResult =
  | { success: true; chargeId: string }
  | { success: false; cancelled?: boolean; error?: string };

export async function initCulqiCheckout({
  amount,
  description,
  email,
  containerId,
}: CulqiCheckoutParams): Promise<CulqiCheckoutResult> {
  await loadCulqiScript();

  const amountCents = Math.round(amount * 100);
  const embedded = Boolean(containerId);

  const config = {
    // Ojo: settings solo acepta title/currency/amount/order. Agregar cualquier
    // otra clave (p. ej. description) hace que el checkout no renderice, sin
    // lanzar ningun error. La descripcion viaja al cargo server-side.
    settings: {
      title: "Lobo Burger",
      currency: "PEN",
      amount: amountCents,
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
          const res = await fetch("/api/charge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tokenId, email, amount: amountCents, description }),
          });
          const data = await res.json();
          if (res.ok) settle({ success: true, chargeId: data.chargeId });
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
