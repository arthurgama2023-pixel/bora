// MODO VIRAL — base de conhecimento de padrões por nicho.
// MVP: biblioteca curada offline usada como contexto para o Diretor Criativo
// (e como resposta direta no modo mock). Em produção: alimentada por um worker
// que analisa periodicamente os vídeos em alta por nicho (ver ARQUITETURA.md).
import type { ViralPlaybook } from "../types";

type PlaybookSeed = Omit<ViralPlaybook, "mode">;

const PLAYBOOKS: PlaybookSeed[] = [
  {
    niche: "Marketing Digital & Vendas",
    idealDuration: 45,
    cutsPerMinute: 22,
    hookStyle: "afirmação contraintuitiva ou resultado concreto nos primeiros 2s",
    captionStyle: "palavra-a-palavra, caixa alta, destaque dourado em números e verbos de ação",
    ctaStyle: "comando único no fim (comente X / salve / siga) + loop para parte 2",
    pacing: "Corte a cada 2-4s; zoom em provas sociais; nunca mais de 5s sem mudança visual.",
    insights: [
      "Vídeos com número concreto no gancho retêm 31% mais nos primeiros 5s.",
      "CTA de comentário com palavra-chave gera 2-3x mais alcance que link na bio.",
      "Antecipar o clímax como teaser aumenta conclusão do vídeo em ~20%.",
    ],
  },
  {
    niche: "Podcast & Entrevistas",
    idealDuration: 58,
    cutsPerMinute: 14,
    hookStyle: "a frase mais polêmica/emocionante do trecho como cold-open",
    captionStyle: "blocos de 3-4 palavras, destaque na palavra de impacto",
    ctaStyle: "nome do podcast + 'episódio completo no canal'",
    pacing: "Alternar enquadramento entre falante e ouvinte; zoom lento em revelações.",
    insights: [
      "Cortes de podcast performam melhor entre 40-60s.",
      "Reação do interlocutor no frame aumenta tempo de exibição.",
    ],
  },
  {
    niche: "Educação & Aulas",
    idealDuration: 60,
    cutsPerMinute: 16,
    hookStyle: "pergunta que expõe um erro comum ('você faz isso errado')",
    captionStyle: "palavra-a-palavra com termos técnicos destacados",
    ctaStyle: "salve para consultar depois + siga para a série",
    pacing: "Estrutura problema → erro comum → solução → exemplo; acelerar explicações longas em 1.15x.",
    insights: [
      "Conteúdo em lista (3 erros, 5 passos) tem maior taxa de salvamento.",
      "Acelerar trechos expositivos em até 15% não reduz compreensão e melhora retenção.",
    ],
  },
  {
    niche: "Lifestyle & Vlog",
    idealDuration: 34,
    cutsPerMinute: 26,
    hookStyle: "cena visualmente forte + promessa ('o dia que tudo deu errado')",
    captionStyle: "minimalista, frases curtas, sem caixa alta",
    ctaStyle: "pergunta genuína para gerar comentários",
    pacing: "Ritmo acelerado com micro-cenas; música conduz os cortes.",
    insights: ["Vlogs curtos (<40s) têm maior taxa de replay.", "Música em beat-sync aumenta watch time."],
  },
  {
    niche: "Geral",
    idealDuration: 45,
    cutsPerMinute: 18,
    hookStyle: "curiosidade imediata: antecipar o momento mais forte do vídeo",
    captionStyle: "palavra-a-palavra com destaque em palavras de impacto",
    ctaStyle: "um único CTA claro no encerramento",
    pacing: "Remover silêncios, variar enquadramento a cada 4-6s, terminar antes de cansar.",
    insights: ["Primeiros 3s decidem ~70% da retenção total.", "Vídeos sem pausas mortas têm 25% mais conclusão."],
  },
];

export function findPlaybook(niche: string): PlaybookSeed {
  const n = niche.toLowerCase();
  const hit = PLAYBOOKS.find(
    (p) => p.niche !== "Geral" && p.niche.toLowerCase().split(/[ &]+/).some((w) => w.length > 3 && n.includes(w))
  );
  return hit ?? PLAYBOOKS[PLAYBOOKS.length - 1];
}

export function playbookLibraryForPrompt(): string {
  return JSON.stringify(PLAYBOOKS, null, 1);
}
