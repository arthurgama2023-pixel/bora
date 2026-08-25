// Wizard de criação de campanha: transforma as respostas do usuário em uma
// estrutura completa (campanha → conjunto → anúncios + UTMs + naming).
//
// Com OPENAI_API_KEY as copies dos anúncios são geradas pelo modelo; sem a
// chave, usa templates de copy comprovados. A estrutura/naming/UTMs são
// sempre determinísticos — previsibilidade importa mais que criatividade aqui.
import OpenAI from "openai";
import type { CampaignObjective, CampaignPlan } from "@/services/meta/types";
import { OBJECTIVE_LABELS } from "@/services/meta/types";

export type WizardAnswers = {
  objective: CampaignObjective;
  product: string;
  dailyBudget: number;
  audience: string;
  country: string;
  url: string;
  pixelId: string | null;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function generateCampaignPlan(
  answers: WizardAnswers,
): Promise<CampaignPlan> {
  const objectiveLabel = OBJECTIVE_LABELS[answers.objective].toUpperCase();
  const month = new Date().toLocaleDateString("pt-BR", {
    month: "2-digit",
    year: "numeric",
  });
  const naming = `[${objectiveLabel}] ${answers.product} — ${answers.country} — ${month}`;
  const slug = slugify(`${objectiveLabel}-${answers.product}-${month}`);
  const utms = `utm_source=facebook&utm_medium=paid&utm_campaign=${slug}&utm_content={{ad.name}}&utm_term={{adset.name}}`;
  const separator = answers.url.includes("?") ? "&" : "?";

  const ads = await generateAdCopies(answers);

  return {
    naming,
    campaign: {
      name: naming,
      objective: answers.objective,
      dailyBudget: answers.dailyBudget,
    },
    adset: {
      name: `${naming} — ${answers.audience}`,
      targeting: `${answers.country} · ${answers.audience}`,
      optimizationGoal:
        answers.objective === "OUTCOME_LEADS" ? "LEAD_GENERATION" : "OFFSITE_CONVERSIONS",
      country: answers.country,
    },
    ads,
    utms,
    finalUrl: `${answers.url}${separator}${utms}`,
    pixelId: answers.pixelId,
  };
}

async function generateAdCopies(answers: WizardAnswers): Promise<CampaignPlan["ads"]> {
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Você é um copywriter sênior de Meta Ads. Responda APENAS com JSON: {"ads":[{"name":"AD01 — ângulo","headline":"máx 40 chars","primaryText":"2-3 frases persuasivas","cta":"SAIBA_MAIS|COMPRAR_AGORA|CADASTRE_SE"}]} com exatamente 3 anúncios em pt-BR, cada um com um ângulo diferente (benefício, prova social, urgência).',
          },
          {
            role: "user",
            content: `Produto: ${answers.product}\nObjetivo: ${OBJECTIVE_LABELS[answers.objective]}\nPúblico: ${answers.audience}\nPaís: ${answers.country}`,
          },
        ],
      });
      const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
      if (Array.isArray(parsed.ads) && parsed.ads.length) return parsed.ads;
    } catch {
      // cai nos templates abaixo
    }
  }

  const product = answers.product;
  return [
    {
      name: "AD01 — Benefício direto",
      headline: `${product}: resultado que você vê no bolso`,
      primaryText: `Conheça ${product} e descubra por que milhares de brasileiros já fizeram a troca. Condições especiais por tempo limitado — simule agora sem compromisso.`,
      cta: "SAIBA_MAIS",
    },
    {
      name: "AD02 — Prova social",
      headline: `+2.000 clientes aprovam ${product}`,
      primaryText: `"Melhor decisão que tomei este ano." Veja os depoimentos de quem já usa ${product} e entenda o motivo das avaliações 5 estrelas.`,
      cta: "COMPRAR_AGORA",
    },
    {
      name: "AD03 — Urgência",
      headline: `Última semana: condição especial em ${product}`,
      primaryText: `A condição promocional de ${product} termina em poucos dias. Garanta a sua antes que acabe — atendimento imediato pelo site.`,
      cta: "CADASTRE_SE",
    },
  ];
}
