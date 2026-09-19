import { NextResponse } from "next/server";
import { chatWithAgent } from "@/server/services/agent";
import {
  effectiveProductsForCity,
  findCoveredBairro,
  getPrimaryCompanyId,
  getSitePricing,
  unitPriceFor,
} from "@/server/services/site-pricing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Canário de preço — o cenário mais perigoso deste projeto não é o app cair,
// é o agente DIZER um preço errado sem nenhuma exceção acontecer. Isso nunca
// chegaria ao Sentry. Esta rota faz uma pergunta de preço REAL pro agente
// (mesmo caminho de um cliente, incluindo o Gemini) e confere se o número que
// ele falou bate com o banco. Roda de tempos em tempos (cron externo) —
// dispara chamada real ao Gemini, por isso é mais espaçado que o vigia.
//
// Canal "PLAYGROUND" de propósito: não deve contar como mensagem de cliente
// pra estatística do /api/health/agent (senão mascararia um WhatsApp real
// desconectado, parecendo que "teve gente conversando" quando foi só o teste).
// ---------------------------------------------------------------------------

const TEST_BAIRRO = "Xerém"; // bairro coberto conhecido (Baixada Fluminense)

// "R$600" -> 600 · "R$1.000" -> 1000 · "R$550,00" -> 550 (formato BR: ponto de
// milhar, vírgula decimal). Pega o PRIMEIRO valor mencionado — pela instrução
// do prompt do agente, é o preço de 1 unidade (ex.: "sai R$600 a unidade,
// R$550 levando 2...").
function firstPriceIn(text: string): number | null {
  const m = text.match(/R\$\s?([\d.,]+)/);
  if (!m) return null;
  const normalized = m[1].replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  const required = process.env.PRICE_CHECK_TOKEN;
  if (required) {
    const token = new URL(req.url).searchParams.get("token");
    if (token !== required) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const companyId = await getPrimaryCompanyId();
  if (!companyId) {
    return NextResponse.json({ ok: false, error: "empresa não configurada" }, { status: 200 });
  }

  const pricing = await getSitePricing(companyId);
  const zona = findCoveredBairro(pricing, TEST_BAIRRO);
  if (!zona) {
    return NextResponse.json(
      { ok: false, error: `bairro de teste "${TEST_BAIRRO}" não está mais coberto — ajuste TEST_BAIRRO` },
      { status: 200 },
    );
  }

  const products = effectiveProductsForCity(pricing, zona.city).filter((p) => !p.id.startsWith("kit"));
  const product = products[0];
  if (!product) {
    return NextResponse.json({ ok: false, error: `nenhum produto de chopp para ${zona.city}` }, { status: 200 });
  }

  const expectedPrice = unitPriceFor(product, 1);
  const question = `Quanto custa ${product.name} pra ${zona.bairro}?`;

  // Passa um cliente JÁ identificado (com nome) de propósito: desde que o fluxo
  // pede o NOME como primeira etapa, uma conversa nova responde "me diz seu nome"
  // em vez do preço. E MESMO com nome, o agente às vezes (~4% medido) cumprimenta
  // primeiro em vez de cotar. Isso NÃO é preço errado — mas faria o canário
  // acusar falso positivo. Por isso tentamos ATÉ 3 vezes (sessões novas) e só
  // consideramos ERRO se NENHUMA tentativa cotar o preço certo. Um preço
  // realmente errado (regressão) falha as 3 de forma consistente e alerta.
  const MAX_TRIES = 3;
  let lastReply = "";
  let lastExtracted: number | null = null;
  let lastUsedTool = false;
  let simulated = false;
  let quotedButWrong = false; // cotou um preço, mas diferente do esperado (erro real)
  let match = false;
  let tries = 0;

  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    tries = attempt;
    const result = await chatWithAgent(
      companyId,
      `price-check-${Date.now()}-${attempt}`, // sessão descartável, não colide com conversa real
      [{ role: "user", content: question }],
      {
        channel: "PLAYGROUND",
        identifiedCustomer: { id: "price-check-canary", name: "Canário de Preço", status: "ACTIVE", type: "COMERCIO" },
      },
    );
    lastReply = result.reply;
    simulated = result.simulated;
    lastUsedTool = result.toolsUsed.includes("preco_por_bairro");
    lastExtracted = firstPriceIn(result.reply);

    if (lastUsedTool && lastExtracted !== null && lastExtracted === expectedPrice) {
      match = true; // cotou certo — passou
      break;
    }
    if (lastUsedTool && lastExtracted !== null && lastExtracted !== expectedPrice) {
      // Cotou um preço DIFERENTE do esperado: isso é erro real de preço — não
      // adianta re-tentar, alerta na hora.
      quotedButWrong = true;
      break;
    }
    // Senão (não cotou — cumprimentou/pediu nome): tenta de novo numa nova sessão.
  }

  return NextResponse.json({
    ok: true,
    match,
    quotedButWrong, // true = cotou um valor ERRADO (alerta de verdade); false num "não cotou"
    tries,
    question,
    bairro: zona.bairro,
    produto: product.name,
    expectedPrice,
    extractedPrice: lastExtracted,
    usedPriceTool: lastUsedTool,
    agentReply: lastReply,
    simulated, // true = rodou sem GEMINI_API_KEY (modo simulado) — resultado não é confiável
  });
}
