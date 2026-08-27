// Captura de errores server-side (runtime nodejs) para INFRA-03. Solo se
// inicializa si hay DSN: sin cuenta de Sentry creada, este archivo no hace
// nada y no rompe el build (mismo criterio que el resto del repo con
// configuracion ausente -- ver .env.example).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Esta fase quiere errores, no performance, y el plan gratuito tiene
    // cupo limitado.
    tracesSampleRate: 0,
    environment: process.env.VERCEL_ENV || "development",
    // sendDefaultPii=false (default): no se adjuntan headers/cookies del
    // request completo a Sentry. Solo se manda lo que captureRequestError
    // reenvia (path/method/headers basicos), nunca el body (T-01-12).
    sendDefaultPii: false,
  });
}
