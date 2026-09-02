import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;

  if (!user || !pass) {
    return NextResponse.json({ error: "Panel no configurado en el servidor" }, { status: 503 });
  }

  let body: { user?: string; pass?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  if (body.user === user && body.pass === pass) {
    const token = Buffer.from(`${user}:${pass}`).toString("base64");
    const response = NextResponse.json({ ok: true });

    // Establecer cookie de sesión segura para el panel
    response.cookies.set("lobo_admin_session", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 días de sesión para la tablet de cocina
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  }

  return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("lobo_admin_session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
