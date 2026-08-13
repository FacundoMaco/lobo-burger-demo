// Culqi Checkout v4 — el cliente solo tokeniza; el cargo se crea server-side
// en app/api/charge/route.ts con la llave secreta.

type CulqiGlobal = {
  publicKey: string;
  token?: { id: string };
  order?: unknown;
  error?: { user_message?: string };
  settings: (s: { title: string; currency: string; amount: number }) => void;
  options: (o: Record<string, unknown>) => void;
  open: () => void;
  close: () => void;
};

declare global {
  interface Window {
    Culqi: CulqiGlobal;
    culqi: () => void;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadCulqiScript(): Promise<void> {
  if (typeof window !== "undefined" && window.Culqi) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://checkout.culqi.com/js/v4";
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

export type CulqiCheckoutParams = {
  amount: number; // en soles
  description: string;
  email: string;
};

export type CulqiCheckoutResult =
  | { success: true; chargeId: string }
  | { success: false; cancelled?: boolean; error?: string };

export async function initCulqiCheckout({
  amount,
  description,
  email,
}: CulqiCheckoutParams): Promise<CulqiCheckoutResult> {
  await loadCulqiScript();

  const Culqi = window.Culqi;
  const amountCents = Math.round(amount * 100);

  Culqi.publicKey = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY as string;
  Culqi.settings({ title: "Lobo Burger", currency: "PEN", amount: amountCents });
  Culqi.options({
    lang: "auto",
    installments: false,
    paymentMethods: {
      tarjeta: true,
      yape: true,
      billetera: false,
      bancaMovil: false,
      agente: false,
      cuotealo: false,
    },
  });

  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: CulqiCheckoutResult) => {
      if (settled) return;
      settled = true;
      clearInterval(closeWatcher);
      resolve(result);
    };

    // Culqi no avisa cuando el usuario cierra el modal sin pagar:
    // detectamos la desaparición del iframe para no dejar la promesa colgada.
    let modalSeen = false;
    const closeWatcher = setInterval(() => {
      const iframe = document.querySelector('iframe[src*="culqi"]');
      if (iframe) modalSeen = true;
      else if (modalSeen && !settled && !window.Culqi.token) {
        settle({ success: false, cancelled: true });
      }
    }, 500);

    window.culqi = async () => {
      if (Culqi.token) {
        const tokenId = Culqi.token.id;
        Culqi.close();
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
      } else if (Culqi.error) {
        settle({ success: false, error: Culqi.error.user_message || "Pago rechazado" });
      }
    };

    Culqi.open();
  });
}
