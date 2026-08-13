import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description: "Términos y condiciones de los pedidos web de Lobo Burger: pagos, zona de delivery, cambios y devoluciones.",
};

const INK = "#241F1C";

const sections = [
  {
    title: "1. Pedidos y pagos",
    body: [
      "Los pedidos realizados a través de esta web se pagan únicamente en línea, con tarjeta de crédito/débito o Yape, procesados de forma segura por Culqi. No aceptamos pago en efectivo ni contra entrega para pedidos web.",
      "El pedido queda confirmado solo cuando el pago es aprobado. Recibirás la constancia de pago en el correo que registres al momento de comprar.",
    ],
  },
  {
    title: "2. Zona y tiempos de delivery",
    body: [
      "El servicio de delivery cubre un radio aproximado de 7.5 km alrededor de cada una de nuestras sedes: Av. Aviación 3877, La Calera - Surquillo y Av. Vargas Machuca 526, CT - San Juan de Miraflores.",
      "Si tu dirección está fuera de la zona de cobertura, nos comunicaremos contigo para coordinar el recojo en tienda o el reembolso íntegro del pago.",
      "Los tiempos de entrega son estimados y pueden variar según tráfico, clima y demanda.",
    ],
  },
  {
    title: "3. Cambios, cancelaciones y reembolsos",
    body: [
      "Puedes cancelar tu pedido sin costo mientras no haya entrado en preparación, escribiéndonos por WhatsApp al +51 974 983 862.",
      "Si el pedido llega incompleto o en mal estado, contáctanos dentro de los 30 minutos posteriores a la entrega para gestionar la reposición o el reembolso.",
      "Los reembolsos se procesan por el mismo medio de pago y pueden demorar según los plazos del banco emisor.",
    ],
  },
  {
    title: "4. Datos personales",
    body: [
      "Los datos que ingresas (nombre, teléfono, correo y dirección) se usan exclusivamente para gestionar y entregar tu pedido. No los compartimos con terceros salvo lo necesario para procesar el pago (Culqi) y realizar la entrega.",
    ],
  },
  {
    title: "5. Precios y disponibilidad",
    body: [
      "Los precios publicados incluyen impuestos y pueden cambiar sin previo aviso. Las promociones están sujetas a disponibilidad y a los días u horarios indicados en cada una.",
    ],
  },
];

export default function TerminosPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FFFDF8" }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-10 pb-28">
        <h1 className="font-bebas text-3xl mb-2" style={{ color: INK }}>TÉRMINOS Y CONDICIONES</h1>
        <p className="text-xs mb-8" style={{ color: "rgba(36,31,28,0.5)" }}>
          Pedidos web de Lobo Burger — última actualización: agosto 2026
        </p>

        {sections.map(s => (
          <section key={s.title} className="mb-7">
            <h2 className="font-bebas text-lg mb-2" style={{ color: INK }}>{s.title}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed mb-2" style={{ color: "rgba(36,31,28,0.7)" }}>{p}</p>
            ))}
          </section>
        ))}

        <Link href="/" className="text-sm font-semibold underline" style={{ color: "rgba(36,31,28,0.6)" }}>
          Volver a la carta
        </Link>
      </div>
    </div>
  );
}
