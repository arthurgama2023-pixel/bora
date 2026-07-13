// Geradores determinísticos (modo mock) — permitem rodar o pipeline completo
// sem nenhuma API key, com conteúdo plausível em PT-BR. Seed = id do projeto,
// então o mesmo projeto sempre gera o mesmo resultado (bom p/ testes e demo).
import type {
  Analysis,
  CreativePack,
  Moment,
  Plan,
  Scores,
  Transcript,
  TranscriptSegment,
  ViralPlaybook,
  Word,
} from "../types";
import { findPlaybook } from "../viral/patterns";

// PRNG determinístico (mulberry32)
function rng(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SCRIPT = [
  "Deixa eu te contar uma coisa que mudou completamente o meu negócio.",
  "A maioria das pessoas trava exatamente no mesmo ponto.",
  "Elas acham que precisam de mais seguidores para vender mais.",
  "Só que o problema nunca foi audiência, o problema é oferta.",
  "Quando eu entendi isso, meu faturamento triplicou em noventa dias.",
  "E o mais louco é que eu postava três vezes menos do que antes.",
  "O segredo está em falar com a dor certa, na hora certa.",
  "Se o seu conteúdo não gera curiosidade nos três primeiros segundos, acabou.",
  "As pessoas não compram produto, elas compram transformação.",
  "Então para de vender característica e começa a vender resultado.",
  "Eu vou te mostrar exatamente como aplicar isso hoje.",
  "Salva esse vídeo e me segue para a parte dois.",
];

export function mockTranscript(projectId: string, duration: number, videoIdx = 0): Transcript {
  const rand = rng(projectId + ":t" + videoIdx);
  const segments: TranscriptSegment[] = [];
  const words: Word[] = [];
  let t = 0.4; // pequeno silêncio inicial
  let i = videoIdx * 4; // vídeos diferentes começam em pontos diferentes do roteiro
  while (t < duration - 1.5) {
    const sentence = SCRIPT[i % SCRIPT.length];
    const ws = sentence.split(" ");
    const segStart = t;
    for (const w of ws) {
      const wd = 0.24 + rand() * 0.18;
      if (t + wd > duration - 0.3) break;
      words.push({ start: +t.toFixed(2), end: +(t + wd).toFixed(2), word: w });
      t += wd + 0.03;
    }
    segments.push({ start: +segStart.toFixed(2), end: +t.toFixed(2), text: sentence });
    // pausa entre frases — algumas longas de propósito (para a IA remover)
    const pause = rand() < 0.28 ? 0.9 + rand() * 1.1 : 0.25 + rand() * 0.35;
    t += pause;
    i++;
  }
  return {
    language: "pt",
    text: segments.map((s) => s.text).join(" "),
    segments,
    words,
    mode: "mock",
  };
}

export function mockAnalysis(projectId: string, transcripts: Transcript[], durations: number[]): Analysis {
  const rand = rng(projectId + ":a");
  const moments: Moment[] = [];

  type ScoredSeg = { s: TranscriptSegment; idx: number; video: number; intensity: number };
  const scored: ScoredSeg[] = [];

  transcripts.forEach((transcript, video) => {
    // Silêncios detectados pelos gaps entre palavras (por vídeo)
    for (let i = 1; i < transcript.words.length; i++) {
      const gap = transcript.words[i].start - transcript.words[i - 1].end;
      if (gap > 0.8) {
        moments.push({
          video,
          start: transcript.words[i - 1].end,
          end: transcript.words[i].start,
          type: "silencio",
          intensity: 0.1,
          reason: `Pausa de ${gap.toFixed(1)}s sem fala no vídeo ${video + 1} — quebra o ritmo e derruba retenção.`,
        });
      }
    }

    // Intensidade heurística por segmento
    transcript.segments.forEach((s, idx) => {
      const txt = s.text.toLowerCase();
      let base = 0.35 + rand() * 0.3;
      if (/triplicou|segredo|louco|mudou|noventa dias/.test(txt)) base = 0.85 + rand() * 0.1;
      if (/transforma|resultado|dor certa/.test(txt)) base = 0.7 + rand() * 0.15;
      if (/salva esse vídeo|me segue/.test(txt)) base = 0.6;
      if (idx === 0 && video === 0) base = Math.min(base, 0.45); // abertura genérica = gancho fraco
      scored.push({ s, idx, video, intensity: +base.toFixed(2) });
    });
  });

  const sorted = [...scored].sort((a, b) => b.intensity - a.intensity);
  const top = sorted[0];
  if (top) {
    moments.push({
      video: top.video,
      start: top.s.start,
      end: top.s.end,
      type: "pico_emocional",
      intensity: top.intensity,
      reason: `"${top.s.text.slice(0, 60)}..." (vídeo ${top.video + 1}) é o momento mais forte de todo o material — prova concreta + emoção.`,
    });
  }
  for (const m of sorted.slice(1, 3)) {
    moments.push({
      video: m.video,
      start: m.s.start,
      end: m.s.end,
      type: "insight",
      intensity: m.intensity,
      reason: `Frase de alto valor percebido — bom candidato a zoom para reforçar atenção.`,
    });
  }
  for (const m of sorted.slice(-2)) {
    if (m.intensity < 0.45 && !(m.idx === 0 && m.video === 0)) {
      moments.push({
        video: m.video,
        start: m.s.start,
        end: m.s.end,
        type: "parte_fraca",
        intensity: m.intensity,
        reason: `Trecho com baixa densidade de informação — risco de queda de retenção aqui.`,
      });
    }
  }
  const lastT = transcripts[transcripts.length - 1];
  const last = lastT?.segments[lastT.segments.length - 1];
  if (last && /salva|segue/.test(last.text.toLowerCase())) {
    moments.push({
      video: transcripts.length - 1,
      start: last.start,
      end: last.end,
      type: "cta",
      intensity: 0.6,
      reason: "Chamada para ação clara no encerramento — manter e legendar com destaque.",
    });
  }

  const multi = transcripts.length > 1 ? ` Material composto por ${transcripts.length} vídeos que se complementam.` : "";
  return {
    niche: "Marketing Digital & Vendas",
    audience: "Criadores e pequenos empreendedores (25-40 anos) que querem vender mais nas redes",
    goal: "venda",
    tone: "direto, provocativo, com autoridade",
    summary:
      "Monólogo de autoridade sobre por que oferta importa mais que audiência, com prova social (faturamento 3x) e CTA de follow." +
      multi,
    hookQuality: 4,
    hookComment:
      "A abertura original demora a gerar curiosidade — o momento mais forte do material deve ser antecipado como teaser.",
    moments,
    mode: "mock",
  };
}

export function mockViral(analysis: Analysis): ViralPlaybook {
  const p = findPlaybook(analysis.niche);
  return { ...p, mode: "mock" };
}

export function mockPlan(
  projectId: string,
  analysis: Analysis,
  playbook: ViralPlaybook,
  durations: number[],
  rejectedTypes: Record<string, number>
): Plan {
  const decisions: Plan["decisions"] = [];
  let n = 0;
  const id = () => `d${++n}`;
  const skip = (t: string) => (rejectedTypes[t] ?? 0) >= 3; // memória: usuário rejeita muito esse tipo

  // 1. Remover silêncios
  if (!skip("remove_silence")) {
    for (const m of analysis.moments.filter((m) => m.type === "silencio")) {
      decisions.push({
        id: id(),
        type: "remove_silence",
        video: m.video ?? 0,
        start: +m.start.toFixed(2),
        end: +m.end.toFixed(2),
        reason: `Silêncio de ${(m.end - m.start).toFixed(1)}s removido — cada pausa acima de 0,8s aumenta a chance de swipe.`,
        applied: true,
      });
    }
  }

  // 2. Remover partes fracas (máx. 2)
  if (!skip("remove_segment")) {
    for (const m of analysis.moments.filter((m) => m.type === "parte_fraca").slice(0, 2)) {
      decisions.push({
        id: id(),
        type: "remove_segment",
        video: m.video ?? 0,
        start: +m.start.toFixed(2),
        end: +m.end.toFixed(2),
        reason: `Trecho fraco cortado: ${m.reason} Encurtar aqui melhora o tempo médio de visualização.`,
        applied: true,
      });
    }
  }

  // 3. Reconstruir o gancho: teaser do momento mais forte no início.
  // Em projetos multi-vídeo, o pico pode estar em QUALQUER vídeo — se estiver
  // num vídeo posterior, antecipá-lo como cold-open é ainda mais valioso.
  const peak = analysis.moments.find((m) => m.type === "pico_emocional");
  const peakVideo = peak?.video ?? 0;
  if (peak && (peakVideo > 0 || peak.start > 8) && analysis.hookQuality < 7 && !skip("hook_teaser")) {
    const where =
      peakVideo > 0
        ? `no vídeo ${peakVideo + 1}, aos ${peak.start.toFixed(0)}s`
        : `só aos ${peak.start.toFixed(0)}s`;
    decisions.push({
      id: id(),
      type: "hook_teaser",
      video: peakVideo,
      start: +peak.start.toFixed(2),
      end: +Math.min(peak.start + 3.5, peak.end).toFixed(2),
      reason:
        `Gancho reconstruído: o momento mais forte do material acontecia ${where}. ` +
        `Anteciparei ${Math.min(3.5, peak.end - peak.start).toFixed(1)}s dele como cold-open para criar curiosidade imediata (${playbook.hookStyle}).`,
      applied: true,
    });
  }

  // 4. Zooms nos picos
  if (!skip("zoom")) {
    const zoomTargets = analysis.moments
      .filter((m) => m.type === "pico_emocional" || m.type === "insight")
      .slice(0, 3);
    for (const m of zoomTargets) {
      decisions.push({
        id: id(),
        type: "zoom",
        video: m.video ?? 0,
        start: +m.start.toFixed(2),
        end: +m.end.toFixed(2),
        factor: 1.12,
        reason: `Punch-in de 12% durante frase-chave — mudança de enquadramento renova a atenção sem cortar a fala.`,
        applied: true,
      });
    }
  }

  // 5. Estilo de legenda
  decisions.push({
    id: id(),
    type: "caption_style",
    video: 0,
    start: 0,
    end: durations[0] ?? 0,
    reason: `Legendas dinâmicas palavra-a-palavra com destaque dourado (${playbook.captionStyle}) — padrão dos vídeos mais virais do nicho.`,
    applied: true,
  });

  // 6. Filtro de cor conforme o tom do conteúdo
  const niche = analysis.niche.toLowerCase();
  const style = /fitness|nutri|treino|saude/.test(niche)
    ? "vivid"
    : /lifestyle|vlog|viagem/.test(niche)
      ? "warm"
      : "cinematic";
  decisions.push({
    id: id(),
    type: "filter",
    video: 0,
    start: 0,
    end: durations[0] ?? 0,
    style,
    reason: `Color grading "${style}" aplicado — realça o tom ${analysis.tone} do conteúdo e dá acabamento profissional que aumenta a percepção de qualidade.`,
    applied: true,
  });

  return {
    decisions,
    targetDuration: playbook.idealDuration,
    notes:
      `Plano otimizado para ${playbook.idealDuration}s (padrão viral do nicho ${playbook.niche}). ` +
      `Ritmo alvo: ${playbook.cutsPerMinute} cortes/min. ${playbook.pacing}`,
    mode: "mock",
  };
}

export function mockCreative(analysis: Analysis): CreativePack {
  return {
    titles: [
      "O erro que te impede de vender (não é falta de seguidores)",
      "Triplicamos o faturamento postando MENOS — entenda",
      "Ninguém te contou isso sobre vender nas redes",
    ],
    headline: "Você não precisa de mais audiência. Precisa da oferta certa.",
    descriptionYouTube:
      "Neste vídeo eu explico por que oferta importa mais que audiência — e como falar com a dor certa, na hora certa, " +
      "pode multiplicar suas vendas mesmo com poucos seguidores.\n\n⏱ Capítulos gerados automaticamente pelo Viral Studio AI.",
    captionInstagram:
      "Parei de correr atrás de seguidor e o faturamento 3x 📈\n\nO problema nunca foi audiência — é oferta. " +
      "Comenta \"OFERTA\" que eu te mando o passo a passo 👇",
    captionTikTok: "o motivo real de você não vender (ninguém fala disso) 🤫 #marketingdigital",
    hashtags: [
      "#marketingdigital",
      "#vendas",
      "#empreendedorismo",
      "#negociosonline",
      "#criadordeconteudo",
      "#viralstudioai",
    ],
    cta: "Salva esse vídeo e me segue para a parte 2 🚀",
    bestTimes: [
      { platform: "TikTok", time: "19h–21h", why: "Pico de uso pós-trabalho do público 25-40 no Brasil." },
      { platform: "Instagram Reels", time: "12h e 20h", why: "Almoço e noite concentram o scroll do público-alvo." },
      { platform: "YouTube Shorts", time: "17h–19h", why: "Transição trabalho→casa favorece consumo rápido." },
    ],
    mode: "mock",
  };
}

export function mockScores(
  projectId: string,
  analysis: Analysis,
  plan: Plan,
  finalDuration: number
): Scores {
  const rand = rng(projectId + ":s");
  const silences = plan.decisions.filter((d) => d.type === "remove_silence" && d.applied).length;
  const hasTeaser = plan.decisions.some((d) => d.type === "hook_teaser" && d.applied);
  const zooms = plan.decisions.filter((d) => d.type === "zoom" && d.applied).length;

  const items = [
    {
      name: "Retenção prevista",
      score: Math.min(92, 58 + silences * 3 + (hasTeaser ? 12 : 0)),
      explanation: `${silences} silêncios removidos + ${hasTeaser ? "gancho reconstruído" : "gancho original"} elevam o tempo médio estimado de visualização.`,
    },
    {
      name: "Chance de viralização",
      score: Math.min(88, 50 + (hasTeaser ? 15 : 0) + zooms * 4 + Math.round(rand() * 6)),
      explanation: "Cold-open com curiosidade + ritmo de cortes dentro do padrão viral do nicho.",
    },
    {
      name: "Clareza",
      score: 84,
      explanation: "Mensagem única (oferta > audiência) sustentada do início ao fim, sem desvios de assunto.",
    },
    {
      name: "Storytelling",
      score: hasTeaser ? 82 : 68,
      explanation: hasTeaser
        ? "Estrutura teaser → contexto → prova → CTA cria loop aberto e fechamento satisfatório."
        : "Estrutura linear funciona, mas sem loop aberto no início.",
    },
    {
      name: "Engajamento",
      score: 78,
      explanation: "CTA de comentário + salvamento no fechamento; legendas destacadas incentivam assistir sem som.",
    },
    {
      name: "Compartilhamento",
      score: 72,
      explanation: "Insight contraintuitivo ('poste menos, venda mais') tem alto potencial de envio para amigos.",
    },
    {
      name: "Impacto emocional",
      score: 76,
      explanation: "Prova social concreta (3x em 90 dias) gera aspiração; zooms reforçam os picos.",
    },
    {
      name: "Potencial comercial",
      score: 81,
      explanation: `Público comprador claro (${analysis.audience.split("(")[0].trim()}) e ponte natural para oferta.`,
    },
  ];
  const overall = Math.round(items.reduce((a, b) => a + b.score, 0) / items.length);
  return {
    items,
    overall,
    verdict:
      overall >= 75
        ? `Vídeo pronto para publicar (${finalDuration.toFixed(0)}s). Potencial acima da média do nicho — priorize TikTok e Reels.`
        : `Vídeo publicável, mas considere regravar a abertura para subir o score.`,
    mode: "mock",
  };
}
