import type { PricingStatus } from "@/lib/location-context";

// O que aparece no lugar do preço quando ainda não há preço do painel pra
// mostrar. Nunca mostra um valor do código (estava desatualizado).
export default function PrecoPendente({
  zone,
  status,
  className = "text-sm font-semibold text-gray-500",
}: {
  zone: boolean;
  status: PricingStatus;
  className?: string;
}) {
  // Painel fora também some com os bairros adicionados por lá — por isso o
  // status vem antes do "escolha seu bairro".
  const texto =
    status === "loading"
      ? "Carregando preço…"
      : status === "unavailable"
        ? "Preço sob consulta no WhatsApp"
        : !zone
          ? "Escolha seu bairro para ver o preço"
          : "Preço sob consulta no WhatsApp";
  return <p className={className}>{texto}</p>;
}
