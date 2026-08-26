// Misma configuracion que sentry.server.config.ts, pero para el runtime
// edge: proxy.ts corre en edge y sus excepciones no las cubre la config de
// servidor. Ver sentry.server.config.ts para el detalle de cada opcion.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    environment: process.env.VERCEL_ENV || "development",
    sendDefaultPii: false,
  });
}
