// Foto real do barril/chopeira pra usar nos cards de "Nova movimentação" —
// mesmas fotos do site da SS-Chopp (public/kegs/, copiadas de ss-chopp/public/logos/og/).
// Casamento por trecho do NOME (não por id), já que os tipos vêm do banco e o
// nome cadastrado varia ("CHOPP BRAHMA 50 LTS", "CHOPE PILSEN BELCO 50 LTS"...).
export function imageForKegType(name: string): string | undefined {
  const n = name.toUpperCase();
  // CHOPEIRA vem ANTES das marcas de propósito: uma "Chopeira Belco" é
  // equipamento, não barril. Se a marca fosse checada primeiro, ela mostraria
  // a foto do barril — e ninguém perceberia, porque a tela continua bonita.
  if (n.includes("CHOPEIRA")) return "/kegs/chopeira.png";
  if (n.includes("BELCO")) return "/kegs/belco.png";
  if (n.includes("BRAHMA") || n.includes("BRAMMA")) return "/kegs/brahma.png";
  if (n.includes("HEINEKEN")) return "/kegs/heineken.png";
  if (n.includes("AMSTEL")) return "/kegs/amstel.png";
  if (n.includes("VINHO")) return "/kegs/vinho.png";
  return undefined;
}
