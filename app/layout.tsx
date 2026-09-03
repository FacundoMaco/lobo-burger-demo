import type { Metadata } from "next";
import { Bungee, Work_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";
import { CartDrawer } from "@/components/cart-drawer";
import { CartBar } from "@/components/cart-bar";

const bungee = Bungee({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin"],
});

const workSans = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const SITE_URL = "https://loboburger.com";
const SITE_TITLE = "Lobo Burger — Salvaje de Sabor";
const SITE_DESCRIPTION =
  "Hamburguesas y salchipapas artesanales en Lima. Pide online, revisa promos exclusivas y suma Wolfpoints en cada pedido. Sedes en Surquillo y San Juan de Miraflores.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s — Lobo Burger",
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  keywords: [
    "hamburguesas Lima",
    "salchipapas Lima",
    "delivery hamburguesas Surquillo",
    "delivery hamburguesas San Juan de Miraflores",
    "Lobo Burger",
    "comida rapida Lima",
  ],
  authors: [{ name: "Lobo Burger" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_PE",
    url: SITE_URL,
    siteName: "Lobo Burger",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/images/og-lobo-burger.png", width: 862, height: 485, alt: "Lobo Burger — Salvaje de Sabor" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/images/og-lobo-burger.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const restaurantJsonLd = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  name: "Lobo Burger",
  description: SITE_DESCRIPTION,
  servesCuisine: ["Hamburguesas", "Comida rapida", "Salchipapas"],
  priceRange: "S/10 - S/40",
  url: SITE_URL,
  telephone: "+51974983862",
  image: `${SITE_URL}/images/og-lobo-burger.png`,
  location: [
    {
      "@type": "Place",
      name: "Lobo Burger — Aviación, Surquillo",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Av. Aviación 3877, La Calera",
        addressLocality: "Surquillo",
        addressRegion: "Lima",
        addressCountry: "PE",
      },
    },
    {
      "@type": "Place",
      name: "Lobo Burger — Vargas Machuca, SJM",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Av. Vargas Machuca 526, CT",
        addressLocality: "San Juan de Miraflores",
        addressRegion: "Lima",
        addressCountry: "PE",
      },
    },
  ],
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    opens: "12:00",
    closes: "23:00",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-PE"
      className={`${bungee.variable} ${workSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col" style={{ background: "#FFFDF8", color: "#241F1C" }}>
        <CartProvider>
          <CartDrawer />
          {children}
          <CartBar />
        </CartProvider>
      </body>
    </html>
  );
}
