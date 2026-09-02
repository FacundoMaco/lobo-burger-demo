import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protección del panel de administración y sus APIs.
// Soporta autenticación mediante Cookie de sesión (panel web con UI moderna)
// y cabecera Basic Auth (para herramientas automáticas o curl).

export function proxy(request: NextRequest) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;

  // Ruta pública para autenticarse
  if (request.nextUrl.pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  // Sin credenciales configuradas se bloquea el acceso
  if (!user || !pass) {
    if (request.nextUrl.pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Panel no configurado" }, { status: 503 });
    }
    return new NextResponse("Panel no configurado en variables de entorno", { status: 503 });
  }

  const expectedToken = btoa(`${user}:${pass}`);

  // 1. Verificación por Cookie de sesión (UI Brandeada)
  const sessionCookie = request.cookies.get("lobo_admin_session")?.value;
  if (sessionCookie === expectedToken) {
    return NextResponse.next();
  }

  // 2. Verificación por cabecera Basic Auth (compatibilidad hacia atrás)
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const token = auth.slice(6).trim();
      if (token === expectedToken) {
        return NextResponse.next();
      }
    } catch {
      // Formato incorrecto
    }
  }

  // Si no está autenticado:
  // Para llamadas a la API: responder 401 JSON sin cabecera WWW-Authenticate
  // (para evitar que el navegador abra la ventana gris nativa).
  if (request.nextUrl.pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Se requiere autenticacion" }, { status: 401 });
  }

  // Para la página /admin: permitir que cargue la interfaz,
  // la cual mostrará la pantalla de Login brandeada cuando la API devuelva 401.
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
