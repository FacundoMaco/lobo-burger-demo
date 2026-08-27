// Canal humano de alertas. EXCEPCION deliberada al patron de fallar cerrado
// que sigue el resto del repo (proxy.ts, app/api/charge/route.ts): una
// alerta rota jamas puede tumbar un cobro, asi que esta funcion nunca lanza,
// solo degrada a console.error. Sentry no cumple este rol: su plan gratuito
// solo alerta por email y nadie mira el correo durante el turno (D-03,
// 01-RESEARCH.md). La Fase 3 reusa esta misma funcion para el aviso a
// cocina (OPS-05), con un chat_id distinto sobre el mismo bot.
//
// Server-only: TELEGRAM_ALERT_BOT_TOKEN es un secreto. Nunca importar este
// archivo desde un componente cliente (mismo registro que lib/supabase.ts).

export async function alertaTelegram(mensaje: string): Promise<void> {
  const token = process.env.TELEGRAM_ALERT_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (!token || !chatId) {
    console.error("Alerta sin canal de Telegram configurado:", mensaje);
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: mensaje }),
    });
    if (!res.ok) {
      console.error("Telegram rechazo la alerta:", `status ${res.status}`, mensaje);
    }
  } catch (e) {
    console.error("No se pudo enviar alerta a Telegram:", e);
  }
}
