/**
 * Tokenización nativa de Yape con Código de Aprobación (OTP).
 * Llama directamente a POST https://api.culqi.com/v2/tokens/yape sin crear órdenes
 * previas en Culqi, eliminando por completo los correos no deseados de PagoEfectivo.
 */

export type YapeTokenResult =
  | { success: true; tokenId: string }
  | { success: false; error: string };

export async function createYapeToken({
  phone,
  otp,
  amountCents,
}: {
  phone: string;
  otp: string;
  amountCents: number;
}): Promise<YapeTokenResult> {
  const publicKey = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY;
  if (!publicKey) {
    return { success: false, error: "La pasarela de pagos no está configurada" };
  }

  const cleanPhone = phone.replace(/\D/g, "").trim();
  const cleanOtp = otp.replace(/\D/g, "").trim();

  if (cleanPhone.length !== 9) {
    return { success: false, error: "El número de celular de Yape debe tener 9 dígitos" };
  }

  if (cleanOtp.length !== 6) {
    return { success: false, error: "El código de aprobación de Yape debe tener 6 dígitos" };
  }

  try {
    const res = await fetch("https://api.culqi.com/v2/tokens/yape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${publicKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number_phone: cleanPhone,
        otp: cleanOtp,
        amount: amountCents,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        data.user_message ||
        data.merchant_message ||
        "Código de aprobación inválido o expirado. Genera uno nuevo en tu app Yape.";
      return { success: false, error: msg };
    }

    if (!data.id) {
      return { success: false, error: "No se pudo generar el token de Yape" };
    }

    return { success: true, tokenId: data.id };
  } catch {
    return {
      success: false,
      error: "Error de conexión al procesar Yape. Por favor verifica tu conexión.",
    };
  }
}
