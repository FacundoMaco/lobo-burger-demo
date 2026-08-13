import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mis Puntos — La Manada",
  description: "Únete a La Manada, suma Wolfpoints en cada pedido y canjea hamburguesas, salchipapas y descuentos exclusivos.",
  alternates: { canonical: "/puntos" },
};

export default function PuntosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
