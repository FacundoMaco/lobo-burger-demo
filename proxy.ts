import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// El panel de pedidos estaba abierto: cualquiera que adivinara la URL entraba.
// Se protege con Basic Auth, que el navegador resuelve con su propio dialogo.
// En Next 16 esta convencion es proxy.ts; middleware.ts quedo deprecado.

export function proxy(request: NextRequest) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;

  // Sin credenciales configuradas se bloquea el panel entero, en vez de
  // dejarlo abierto por omision.
  if (!user || !pass) {
    return new NextResponse("Panel no configurado", { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const [u, p] = atob(auth.slice(6)).split(":");
      if (u === user && p === pass) return NextResponse.next();
    } catch {
      // Cabecera malformada: cae al pedido de credenciales.
    }
  }

  // Ojo: las cabeceras HTTP son ByteString (latin1). Un guion largo o una
  // tilde en el realm hace que Next tire un 500 en vez de pedir la clave.
  return new NextResponse("Se requiere autenticacion", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Lobo Burger Panel"' },
  });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
