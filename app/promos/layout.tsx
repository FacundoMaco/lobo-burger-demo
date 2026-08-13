import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Promos exclusivas",
  description: "Descuentos y promociones exclusivas para pedidos web en Lobo Burger: 2x1 martes, primera visita -20% y más.",
  alternates: { canonical: "/promos" },
};

export default function PromosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
