// Análise de criativos (imagem/vídeo) com nota 0-100 por categoria.
//
// Com OPENAI_API_KEY: envia a imagem para o modelo de visão da OpenAI.
// Sem a chave (modo demo): gera uma análise determinística plausível a partir
// do arquivo, mantendo o mesmo contrato de resposta.
import OpenAI from "openai";

export type CreativeCategory = {
  name: string;
  score: number;
  comment: string;
};

export type CreativeAnalysis = {
  overall: number;
  verdict: string;
  categories: CreativeCategory[];
  suggestions: string[];
};

const CATEGORIES = [
  "Hook",
  "Headline",
  "CTA",
  "Legibilidade",
  "Oferta",
  "Qualidade",
  "Contraste",
  "Branding",
  "Políticas Meta",
] as const;

export async function analyzeCreative(input: {
  filename: string;
  mimeType: string;
  size: number;
  base64?: string; // imagens apenas; vídeos são analisados por metadados no demo
}): Promise<CreativeAnalysis> {
  const isImage = input.mimeType.startsWith("image/");
  if (process.env.OPENAI_API_KEY && isImage && input.base64) {
    return analyzeWithOpenAi(input as { mimeType: string; base64: string });
  }
  return mockAnalysis(input);
}

async function analyzeWithOpenAi(input: {
  mimeType: string;
  base64: string;
}): Promise<CreativeAnalysis> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Você é um diretor de criação especialista em anúncios Meta Ads. Analise o criativo e responda APENAS com JSON neste formato:
{"overall": 0-100, "verdict": "frase curta", "categories": [{"name": "...", "score": 0-100, "comment": "..."}], "suggestions": ["..."]}
As categorias devem ser exatamente: ${CATEGORIES.join(", ")}. Comentários e sugestões em pt-BR, específicos e acionáveis. Em "Políticas Meta" avalie risco de reprovação (texto excessivo, claims proibidos, antes/depois etc).`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Analise este criativo de anúncio:" },
          {
            type: "image_url",
            image_url: { url: `data:${input.mimeType};base64,${input.base64}` },
          },
        ],
      },
    ],
  });
  const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
  return {
    overall: Number(parsed.overall) || 0,
    verdict: String(parsed.verdict ?? ""),
    categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
  };
}

// ─── Demo determinístico ──────────────────────────────────────────────────────

function mockAnalysis(input: {
  filename: string;
  mimeType: string;
  size: number;
}): CreativeAnalysis {
  const isVideo = input.mimeType.startsWith("video/");
  let seed = input.size;
  for (const ch of input.filename) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return (seed / 4294967296);
  };

  const comments: Record<string, [string, string]> = {
    Hook: [
      "Os 2 primeiros segundos prendem a atenção com movimento e benefício claro.",
      "A abertura é genérica — os primeiros segundos não dão motivo para parar o scroll.",
    ],
    Headline: [
      "Headline com benefício quantificado, direto ao ponto.",
      "Headline descritiva demais; falta o benefício principal em destaque.",
    ],
    CTA: [
      "CTA visível e coerente com a etapa do funil.",
      "CTA pouco destacado — considere botão com maior contraste e verbo de ação.",
    ],
    Legibilidade: [
      "Texto legível em telas pequenas, boa hierarquia visual.",
      "Fonte pequena para consumo mobile; aumente o corpo do texto principal.",
    ],
    Oferta: [
      "Oferta clara com senso de urgência bem dosado.",
      "A oferta não fica explícita — o usuário precisa deduzir o que ganha.",
    ],
    Qualidade: [
      "Resolução e enquadramento profissionais.",
      "Compressão visível; exporte em maior qualidade (mín. 1080px).",
    ],
    Contraste: [
      "Bom contraste entre texto e fundo, funciona no feed claro e escuro.",
      "Contraste baixo entre o texto e o fundo dificulta a leitura rápida.",
    ],
    Branding: [
      "Marca presente sem roubar o foco do benefício.",
      "Logo aparece tarde/pequeno — dificulta lembrança de marca.",
    ],
    "Políticas Meta": [
      "Baixo risco de reprovação: sem claims absolutos nem texto excessivo.",
      "Atenção: promessas de resultado podem ser enquadradas como claim exagerado.",
    ],
  };

  const categories: CreativeCategory[] = CATEGORIES.map((name) => {
    const score = Math.round(48 + rand() * 50);
    const good = score >= 70;
    return { name, score, comment: comments[name][good ? 0 : 1] };
  });

  const overall = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length,
  );

  const weakest = [...categories].sort((a, b) => a.score - b.score).slice(0, 3);
  const suggestions = [
    ...weakest.map((c) => `Melhorar **${c.name}** (${c.score}/100): ${c.comment}`),
    isVideo
      ? "Adicione legendas — 85% dos vídeos no feed são assistidos sem som."
      : "Teste uma variação com prova social (depoimento ou número de clientes).",
    "Crie 2–3 variações deste criativo para o algoritmo otimizar a entrega.",
  ];

  return {
    overall,
    verdict:
      overall >= 80
        ? "Criativo forte — pronto para escalar."
        : overall >= 60
          ? "Criativo bom, com pontos claros de melhoria."
          : "Criativo abaixo da média — recomendo revisar antes de investir.",
    categories,
    suggestions,
  };
}
