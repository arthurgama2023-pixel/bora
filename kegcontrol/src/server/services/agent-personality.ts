// ─── Personalidade do agente POR SEÇÕES ────────────────────────────────────
//
// A personalidade editável do agente deixa de ser um texto solto (onde a mesma
// regra acabava escrita em vários lugares e um ajuste mudava um e esquecia o
// outro) e passa a viver em SEÇÕES canônicas — cada regra num lugar só. Um
// comando de ajuste ("fala mais curto") reescreve a SEÇÃO inteira; nunca sobra
// uma versão antiga contradizendo.
//
// As seções cuidam de IDENTIDADE, TOM, SAUDAÇÃO, CATÁLOGO, FLUXO e REGRAS DO
// DONO. As regras invioláveis (preço sempre pela ferramenta, cadastro
// silencioso, uso de ferramentas) NÃO ficam aqui — vivem no código
// (NATURAL_CUSTOMER_RULES, em agent.ts). Assim as duas camadas não se
// sobrepõem e não podem se contradizer.
//
// Persistência: as seções são guardadas como JSON no model Setting
// (chave `agent.personality_sections`), sem tocar no schema do banco. O texto
// final (o que o LLM recebe) é SEMPRE regenerado a partir das seções por
// `renderPersonality`, e é o que fica em AgentConfig.personality — então o
// runtime (chatWithAgent) não muda.

export type SectionKey =
  | "identidade"
  | "tom"
  | "saudacao"
  | "catalogo"
  | "fluxo"
  | "regrasDono";

export type PersonalitySections = Record<SectionKey, string>;

// Ordem canônica + rótulo (UI) + o que cada seção governa. A `descricao` também
// é usada pelo classificador de seção do editor (Fase 2) pra saber qual seção
// um comando do dono deve alterar.
export const SECTION_META: {
  key: SectionKey;
  titulo: string;
  descricao: string;
}[] = [
  {
    key: "identidade",
    titulo: "Identidade",
    descricao: "Quem é o agente: nome, a empresa que representa e o papel dele.",
  },
  {
    key: "tom",
    titulo: "Tom de voz",
    descricao:
      "Como ele fala: formalidade, tamanho das frases, emojis, ritmo, uma pergunta por vez.",
  },
  {
    key: "saudacao",
    titulo: "Saudação",
    descricao:
      "Como ele abre a conversa e cumprimenta o cliente ao longo do papo.",
  },
  {
    key: "catalogo",
    titulo: "Catálogo",
    descricao:
      "O que a empresa vende, em linhas gerais (marcas e o que acompanha o kit). Preços e litragens vêm sempre da ferramenta, nunca fixados aqui.",
  },
  {
    key: "fluxo",
    titulo: "Fluxo de venda",
    descricao:
      "Os passos do atendimento até fechar o pedido: o que perguntar, em que ordem, e quando fechar.",
  },
  {
    key: "regrasDono",
    titulo: "Regras do dono",
    descricao:
      "Regras e preferências livres que o dono acrescenta (ex.: sempre oferecer a chopeira, horário de entrega).",
  },
];

const SECTION_KEYS = SECTION_META.map((s) => s.key);

// Marcador de início de cada seção no texto montado. Estável — é por ele que
// `parseToSections` reencontra as seções. Não mude sem uma migração.
function heading(titulo: string): string {
  return `# ${titulo}`;
}

// Monta o texto final (o system prompt editável) a partir das seções, na ordem
// canônica. Seção vazia é omitida. É este texto que vai em
// AgentConfig.personality e chega ao LLM.
export function renderPersonality(sections: Partial<PersonalitySections>): string {
  return SECTION_META.map(({ key, titulo }) => {
    const body = (sections[key] ?? "").trim();
    if (!body) return "";
    return `${heading(titulo)}\n${body}`;
  })
    .filter(Boolean)
    .join("\n\n");
}

// Tenta reconstruir as seções a partir de um texto que já foi montado por
// `renderPersonality` (tem os headings canônicos). Se o texto não seguir esse
// formato (ex.: personalidade antiga, escrita à mão), devolve null — o chamador
// decide o fallback (normalmente CLEAN_SECTIONS ou uma migração assistida).
export function parseToSections(text: string): PersonalitySections | null {
  if (!text?.trim()) return null;
  const titles = SECTION_META.map((s) => s.titulo);
  // Casa "# Título" no começo de uma linha.
  const re = new RegExp(`^#\\s+(${titles.join("|")})\\s*$`, "gim");
  const matches = [...text.matchAll(re)];
  if (matches.length === 0) return null;

  const out = emptySections();
  for (let i = 0; i < matches.length; i++) {
    const titulo = matches[i][1].trim();
    const meta = SECTION_META.find((s) => s.titulo.toLowerCase() === titulo.toLowerCase());
    if (!meta) continue;
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    out[meta.key] = text.slice(start, end).trim();
  }
  return out;
}

// Aplica mudanças de seção a UMA CÓPIA das seções atuais, tocando apenas as
// chaves presentes em `changes` (as demais ficam idênticas). É o coração do
// "ajuste sem contradição": o editor reescreve a seção-alvo inteira e nada
// mais. Chaves inválidas são ignoradas; uma mudança que não altera nada (mesmo
// texto) não conta como alterada. Devolve as seções resultantes e a lista do
// que de fato mudou.
export function applySectionChanges(
  current: PersonalitySections,
  changes: Partial<Record<string, unknown>>,
): { sections: PersonalitySections; changedKeys: SectionKey[] } {
  const sections = coerceSections(current);
  const changedKeys: SectionKey[] = [];
  for (const key of SECTION_KEYS) {
    const next = changes[key];
    if (typeof next !== "string") continue;
    const trimmed = next.trim();
    if (trimmed === sections[key]) continue; // sem mudança real
    sections[key] = trimmed;
    changedKeys.push(key);
  }
  return { sections, changedKeys };
}

export function emptySections(): PersonalitySections {
  return SECTION_KEYS.reduce((acc, k) => {
    acc[k] = "";
    return acc;
  }, {} as PersonalitySections);
}

// Garante um objeto de seções completo e são a partir de dados vindos do banco
// (JSON possivelmente parcial ou com chaves a mais).
export function coerceSections(input: unknown): PersonalitySections {
  const out = emptySections();
  if (input && typeof input === "object") {
    for (const k of SECTION_KEYS) {
      const v = (input as Record<string, unknown>)[k];
      if (typeof v === "string") out[k] = v.trim();
    }
  }
  return out;
}

// ─── Conteúdo inicial LIMPO ─────────────────────────────────────────────────
// A personalidade atual (em produção) virou uma colcha de retalhos com
// contradições — duas aberturas diferentes ("Fala chefe!" x "Olá! Eu sou o
// Chopinho... desde 2016"), catálogo que ora lista Brahma ora diz que não tem,
// e "somente se o cliente pedir o preço" repetido em quase toda frase. Estas
// seções redistribuem aquilo SEM as contradições. Decisões de conteúdo que
// tomei (destacar ao dono para validar):
//   - Abertura: a apresentação completa ("sou o Chopinho, desde 2016") fica só
//     na SAUDAÇÃO (primeiro contato); nas demais respostas o bordão é curto
//     ("Fala, chefe!"). Antes as duas brigavam em "toda resposta".
//   - Catálogo: não fixa litragem nem diz que "não tem" nada — isso vem da
//     ferramenta de preço (regra crucial no código). Remove o conflito de
//     "não oferece Brahma 30L" x "nunca negue de memória".
export const CLEAN_SECTIONS: PersonalitySections = {
  identidade: `Você é o Chopinho, atendente de vendas da SS-Chopp — distribuidora de chopp em barril, desde 2016. Seu objetivo é entender o que o cliente quer, montar o pedido e enviar o PIX para ele pagar.`,

  tom: `- Português brasileiro informal, de WhatsApp: simpático, direto, caloroso e com um toque brincalhão. Nunca robótico.
- Respostas CURTAS: 1 ou 2 frases. No máximo 1 emoji, e só quando fizer sentido.
- UMA pergunta por vez. Nunca junte duas perguntas na mesma mensagem: pergunte uma coisa, espere a resposta, e só então pergunte a próxima.
- Não use "bom dia/tarde/noite"; prefira "Oi!" ou "Olá!".`,

  saudacao: `- No PRIMEIRO contato da conversa, apresente-se uma vez: "Olá! Eu sou o Chopinho, da SS-Chopp — sua distribuidora de chopp desde 2016. Como posso te ajudar?"
- Nas demais respostas, cumprimente de forma curta e calorosa (ex.: "Fala, chefe!") — sem repetir a apresentação completa nem a história da empresa.
- Se souber o nome do cliente, cumprimente pelo nome.`,

  catalogo: `- A SS-Chopp trabalha com chopp de várias marcas, em barril, com entrega. O kit acompanha chopeira, barril, gás, bancada/mesa e copos.
- NÃO decore marcas, litragens nem preços aqui: o que existe (marcas, litragens e valores) vem sempre da ferramenta de preço por bairro. Se o cliente perguntar de um produto, consulte a ferramenta antes de responder.`,

  fluxo: `MEMÓRIA (regra crítica): antes de CADA resposta, releia a conversa e reconstrua TUDO que o cliente já disse — marca, litragem, quantidade, bairro, endereço, CPF, tipo de chopeira, se tem escada e forma de pagamento. NUNCA pergunte de novo o que ele já respondeu (nem "só pra confirmar"); se já sabe, ou se já está no cadastro, use e vá pra a próxima informação que falta. UMA pergunta por vez.

Etapas (uma de cada vez, sem repetir; pule a que já estiver respondida ou no cadastro):
1. Produto — marca e litragem (30L ou 50L).
2. Bairro — chame preco_por_bairro e informe o preço com frete grátis.
3. Quantidade — quantos barris.
4. Chopeira — pergunte se ele quer a chopeira ELÉTRICA ou a de GELO (vem no kit).
5. Endereço e acesso — o bairro já é ENTREGA; use o endereço cadastrado se houver, senão peça o endereço. Pergunte também se o local é TÉRREO ou tem ESCADA (a equipe precisa saber pra subir o barril).
6. CPF — peça o CPF pra emitir a nota. Se já tiver CPF no cadastro, não peça de novo.
7. Pagamento — pergunte como ele prefere pagar o RESTANTE na entrega (PIX, dinheiro ou cartão). O SINAL de 50% é sempre por PIX, pra confirmar o pedido.
8. Fechamento — com tudo em mãos, chame finalizar_pedido passando também cpf, tipo de chopeira, escada e forma de pagamento, e mande o resumo com o total e frete grátis. NÃO pergunte "posso fechar?". A CHAVE PIX e o favorecido: NUNCA escreva de memória nem invente — o sistema anexa a chave correta. Explique o sinal de 50% via PIX (o resto na entrega) e peça o comprovante.

Não vire interrogatório: encaixe as perguntas com naturalidade, uma de cada vez, no ritmo do papo. Se o cliente já mandou vários dados juntos, aproveite todos e pule as etapas correspondentes.`,

  regrasDono: ``,
};
