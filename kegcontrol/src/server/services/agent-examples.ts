// ─── Ensinos do agente: correções (por situação) + instruções (regras) ───────
// O dono ensina de dois jeitos:
//  • CORREÇÃO ("exemplo"): "nesta SITUAÇÃO, responda assim". Gatilho = situação
//    (não a frase exata), então dispara em qualquer variação daquele momento.
//  • INSTRUÇÃO ("instrucao"): regra geral a seguir à risca ("nunca diga X").
// Chaveado por situação → editar a mesma situação ATUALIZA (não acumula).
// Helpers puros vivem em @/lib/teach (compartilhados com as telas).

import {
  CATEGORIAS,
  dedupeBySituation,
  situationKey,
  upsertExample,
  type StyleExample,
} from "@/lib/teach";

export { CATEGORIAS, dedupeBySituation, situationKey, upsertExample };
export type { StyleExample };

function slug(): string {
  return "ex" + Math.random().toString(36).slice(2, 8);
}

// Normaliza entrada desconhecida (JSON do Setting, body da API) num array válido.
export function coerceStyleExamples(input: unknown): StyleExample[] {
  if (!Array.isArray(input)) return [];
  const out: StyleExample[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const ideal = typeof r.ideal === "string" ? r.ideal.trim() : "";
    if (!ideal) continue;
    const tipo = r.tipo === "instrucao" ? "instrucao" : "exemplo";
    const cliente = typeof r.cliente === "string" ? r.cliente.trim() : "";
    // Legado: itens antigos não têm gatilho → herda o `cliente`.
    const gatilho = typeof r.gatilho === "string" && r.gatilho.trim() ? r.gatilho.trim() : cliente;
    const categoria =
      typeof r.categoria === "string" && (CATEGORIAS as readonly string[]).includes(r.categoria)
        ? r.categoria
        : "";
    const variacoes = Array.isArray(r.variacoes)
      ? r.variacoes.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
      : [];
    out.push({
      id: typeof r.id === "string" && r.id ? r.id : slug(),
      tipo,
      gatilho,
      categoria,
      variacoes,
      cliente,
      ideal,
      original: typeof r.original === "string" ? r.original.trim() : undefined,
      nota: typeof r.nota === "string" && r.nota.trim() ? r.nota.trim() : undefined,
      createdAt:
        typeof r.createdAt === "string" && r.createdAt ? r.createdAt : new Date().toISOString(),
    });
  }
  return out;
}

// Renderiza o que o dono ensinou em DOIS blocos: instruções (regra) e correções
// (por situação, ao pé da letra). Regra crucial do sistema sempre vence.
export function renderStyleExamples(items: StyleExample[]): string {
  if (!items.length) return "";
  const instrucoes = items.filter((i) => i.tipo === "instrucao");
  const exemplos = items.filter((i) => i.tipo !== "instrucao");
  const parts: string[] = [];

  if (instrucoes.length) {
    const body = instrucoes
      .map((d, i) => `${i + 1}. ${d.ideal}${d.nota ? ` (${d.nota})` : ""}`)
      .join("\n");
    parts.push(
      [
        "INSTRUÇÕES DO DONO (siga à risca, em toda conversa):",
        "Estas são regras de comportamento definidas pelo dono. Cumpra TODAS, sempre. Se alguma conflitar com uma regra crucial do sistema (preço pela tabela, PIX, uso das ferramentas), a regra crucial vence.",
        "",
        body,
      ].join("\n"),
    );
  }

  if (exemplos.length) {
    const body = exemplos
      .map((e, i) => {
        const quando = e.gatilho?.trim()
          ? e.gatilho.trim()
          : e.cliente
            ? `o cliente disser algo como "${e.cliente}"`
            : "a situação for parecida";
        const cat = e.categoria ? `[${e.categoria}] ` : "";
        const vars = e.variacoes.length
          ? `\n   (dispara também com falas como: ${e.variacoes.join(", ")})`
          : "";
        const nota = e.nota ? `\n   (Por quê: ${e.nota})` : "";
        return `${i + 1}. ${cat}Quando ${quando}:\n   Responda AO PÉ DA LETRA (trocando só os dados do momento): "${e.ideal}"${vars}${nota}`;
      })
      .join("\n\n");
    parts.push(
      [
        "CORREÇÕES DO DONO (mandam no JEITO de responder — NÃO no fluxo de coleta):",
        "Para cada SITUAÇÃO abaixo, o dono definiu como você deve FRASEAR a resposta. Dispare pelo TIPO de situação (não pela frase exata): a mesma correção vale para todas as variações daquele momento (ex.: uma saudação vale pra oi/olá/bom dia/e aí). Quando a situação bater, siga ao pé da letra o TOM, a ESTRUTURA, o COMPRIMENTO e as PALAVRAS da correção — isso vence o jeito padrão da personalidade (inclusive saudação e frases fixas) —, trocando só os dados do momento. PORÉM a SEQUÊNCIA do atendimento continua sendo o fluxo de venda: NUNCA pule uma etapa de coleta nem feche o pedido antes de ter TODOS os dados obrigatórios (produto, bairro, quantidade, chopeira, endereço, escada, data, horário, casa/salão, CPF, forma de pagamento). Se o TEXTO de uma correção parecer adiantar o fechamento ou pular perguntas, use só o ESTILO dela e continue perguntando o que ainda falta — uma pergunta por vez. ATENÇÃO À SITUAÇÃO ('Quando ...'): ela diz só COMO frasear QUANDO aquele momento chegar — NUNCA adianta o atendimento nem pula o que vem antes. Antes de aplicar qualquer correção, confira o CHECKLIST e o bloco JÁ CONFIRMADO: se ainda falta um item OBRIGATÓRIO anterior do checklist, pergunte ESSE item primeiro e só use o jeito da correção quando o atendimento REALMENTE chegar na etapa dela. Ex.: uma correção 'quando o cliente deu o endereço → pergunte a data' NÃO autoriza pular a ESCADA/acesso do local (que vem logo depois do endereço) — colete a escada primeiro e deixe a data para quando for a vez dela. O que você NUNCA muda: o PREÇO/VALORES (sempre da tabela pela ferramenta — se a correção tiver um número, use o real), a CHAVE PIX (o sistema anexa) e o uso das ferramentas.",
        "",
        body,
      ].join("\n"),
    );
  }

  return parts.join("\n\n---\n");
}
