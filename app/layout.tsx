import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Bebas_Neue, Karla } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";
import { CartDrawer } from "@/components/cart-drawer";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin"],
});

const karla = Karla({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LOBO BURGER — Salvaje de Sabor",
  description: "Las mejores hamburguesas y salchipapas de la ciudad. Ver carta, promos exclusivas y programa de fidelidad.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${bebasNeue.variable} ${karla.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={{ background: "#0D0000", color: "#FFFFFF" }}>
        <CartProvider>
          <CartDrawer />
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
