// Style packs — presets de parâmetros que traduzem "estilos famosos" em
// instruções concretas para o Editor IA. Não é mágica: é engenharia de
// contexto. Novos estilos = novas entradas neste arquivo, sem mudar código.
export type StylePack = {
  id: string;
  aliases: string[]; // termos que ativam o pack no comando do usuário
  name: string;
  directives: string; // instruções injetadas no prompt do agente
};

export const STYLE_PACKS: StylePack[] = [
  {
    id: "mrbeast",
    aliases: ["mrbeast", "mr beast", "beast"],
    name: "MrBeast",
    directives:
      "Ritmo FRENÉTICO: nenhum clip de vídeo com mais de 4s (divida os longos), zooms 1.15-1.25 " +
      "alternados em quase todos os clips, velocidade 1.1-1.3x em trechos expositivos, filtro vivid, " +
      "legendas sempre ativas. Corte QUALQUER respiro; a energia nunca cai.",
  },
  {
    id: "hormozi",
    aliases: ["hormozi", "alex hormozi"],
    name: "Alex Hormozi",
    directives:
      "Autoridade direta: cortes secos a cada frase (divida clips nas fronteiras de frases), zoom 1.1 " +
      "nos números e afirmações fortes, velocidade natural (1x), filtro cinematic, legendas grandes " +
      "sempre ativas. Remova TODA hesitação e enrolação.",
  },
  {
    id: "documentario",
    aliases: ["documentário", "documentario", "documentary"],
    name: "Documentário",
    directives:
      "Ritmo contemplativo: clips mais longos (una/estenda em vez de picotar), poucos zooms e lentos " +
      "(1.05-1.08), sem acelerações, filtro cinematic ou cold, legendas discretas ou desativadas.",
  },
  {
    id: "comercial",
    aliases: ["comercial", "anúncio", "anuncio", "ad", "publicidade"],
    name: "Comercial",
    directives:
      "Polido e persuasivo: duração total curta (corte para o essencial da oferta/benefício), zooms " +
      "1.1 nos benefícios, filtro warm ou vivid, ritmo constante, CTA preservado no final.",
  },
  {
    id: "viral",
    aliases: ["viral", "mais viral", "tiktok", "shorts", "reels"],
    name: "Viral (short-form)",
    directives:
      "Retenção máxima: os 3 primeiros segundos precisam do momento mais forte (mova/divida se " +
      "necessário), remova qualquer trecho fraco, clips de 2-5s, zooms nos picos dos markers, " +
      "velocidade 1.1-1.2x em explicações, legendas sempre ativas, duração total menor.",
  },
];

export function detectPacks(command: string): StylePack[] {
  const c = command.toLowerCase();
  return STYLE_PACKS.filter((p) => p.aliases.some((a) => c.includes(a)));
}

export function packsCatalog(): string {
  return STYLE_PACKS.map((p) => `- ${p.name}: ${p.directives}`).join("\n");
}
