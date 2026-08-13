import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Libro de Reclamaciones",
  description:
    "Libro de Reclamaciones virtual de Lobo Burger. Registra tu reclamo o queja y recibe tu constancia al instante.",
};

export default function LibroReclamacionesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
