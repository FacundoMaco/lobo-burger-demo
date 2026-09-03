import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Panel administrativo",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Panel administrativo — Lobo Burger",
    description: "Tablero KDS de cocina y gestión de pedidos Lobo Burger.",
    url: "https://loboburger.com/admin",
    siteName: "Lobo Burger",
    images: [
      {
        url: "https://loboburger.com/images/og-lobo-burger.png",
        width: 862,
        height: 485,
        alt: "Lobo Burger — Salvaje de Sabor",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Panel administrativo — Lobo Burger",
    description: "Tablero KDS de cocina y gestión de pedidos Lobo Burger.",
    images: ["https://loboburger.com/images/og-lobo-burger.png"],
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
