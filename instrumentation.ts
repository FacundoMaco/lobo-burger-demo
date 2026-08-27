// Instrumentacion de Next 16 (INFRA-03). Conecta las tres rutas de servidor
// (/api/charge, /api/culqi/webhook, /api/reclamaciones) a Sentry sin tocar
// ninguna de ellas: por ser route handlers, Next las cubre automaticamente
// via el hook onRequestError.
//
// Decisiones deliberadas (ver 01-RESEARCH.md):
// - NO se crea instrumentation-client.ts: ningun requirement de esta fase
//   pide capturar errores de navegador, asi que el SDK de Sentry para
//   cliente (~26 KB gzip) no entra al bundle (D-01 corregida).
// - NO se envuelve next.config.ts con withSentryConfig (Pitfall B):
//   exigiria SENTRY_AUTH_TOKEN + slugs de org/project como secreto de
//   build. Sin eso, el build de Vercel fallaria pidiendolo. Los stack
//   traces llegan minificados -- costo de debugging aceptable, no un
//   bloqueo funcional. No "completar" la instalacion con el wizard de
//   Sentry sin releer esta nota.
import { type Instrumentation } from "next";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    return import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    return import("./sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, context);
};
