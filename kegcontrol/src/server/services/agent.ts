import * as Sentry from "@sentry/nextjs";
import { FunctionCallingConfigMode, GoogleGenAI, Type, type Content, type FunctionDeclaration, type Part } from "@google/genai";
import { CUSTOMER_STATUS_LABELS, type CustomerStatus } from "@/lib/enums";
import { ApiError } from "@/lib/errors";
import { phoneMatchKey } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import {
  getCustomerBalance,
  getCustomerPrices,
  nameIsJustPushName,
  upsertCustomerFromAgent,
  wipeAgentLearnedProfile,
} from "./customers";
import { getCustomerInsights, SEGMENT_LABELS } from "./crm";
import { getCustomerStatement } from "./reports";
import {
  getSitePricing,
  findCoveredBairro,
  effectiveProductsForCity,
  unitPriceFor,
  fromPriceFor,
  tierTextFor,
  priceBlockFor,
  fullPriceTableText,
  resolveProductByText,
} from "./site-pricing";
import { createAgentSiteOrder } from "./site-orders";
import {
  CLEAN_SECTIONS,
  SECTION_META,
  applySectionChanges,
  coerceSections,
  parseToSections,
  renderPersonality,
  type PersonalitySections,
} from "./agent-personality";
import { decideTrainerAction, type TrainerMode } from "./agent-trainer";
import {
  DEFAULT_FLOW_QUESTIONS,
  coerceFlowQuestions,
  renderFlowQuestions,
  type FlowQuestion,
} from "./agent-flow";
import {
  CATEGORIAS,
  coerceStyleExamples,
  dedupeBySituation,
  renderStyleExamples,
  upsertExample,
  type StyleExample,
} from "./agent-examples";

// Cliente reconhecido pelo número de WhatsApp (ou null se o número não bate
// com nenhum cadastro). Passado ao agente para ele "conectar os pontos".
export type IdentifiedCustomer = {
  id: string;
  name: string;
  status: string;
  type: string;
} | null;

// ─── Configuração / personalidade ──────────────────────────────────────────

const DEFAULT_PERSONALITY = `Você é o atendente virtual da SS-Chopp, distribuidora de chope desde 2016.

Personalidade: simpático, direto e prestativo — como um bom vendedor de bar que conhece todos os clientes pelo nome. Usa linguagem informal brasileira (sem gírias exageradas), frases curtas, e emojis com moderação (🍺 no máximo um por mensagem).

Suas funções:
- Reconhecer o cliente e cumprimentar pelo nome.
- Informar quantos barris o cliente tem (cheios/vazios) e o histórico dele.
- Verificar disponibilidade de estoque antes de prometer entrega.
- Anotar pedidos de troca/entrega e avisar que a equipe confirmará.
- Identificar clientes sumidos e puxar conversa para reativar.

Regras:
- NUNCA invente dados: use sempre as ferramentas para consultar clientes e estoque.
- Se o cliente estiver bloqueado, oriente a falar com o financeiro — não prometa entrega.
- Informe preços SEMPRE pela ferramenta preco_por_bairro (preços do site por bairro). Só diga que o comercial confirma se o bairro estiver fora da área de entrega.
- Responda em português brasileiro, mensagens curtas no estilo WhatsApp.`;

// Regras SEMPRE injetadas (independem da personalidade editável no banco).
// Governam o cadastro espontâneo e natural do cliente.
const NATURAL_CUSTOMER_RULES = `# REGRA MÁXIMA — nunca fale preço, produto ou marca de memória
Existem só 5 marcas no catálogo: Belco, Brahma, Heineken, Amstel e Chopp de Vinho — nada além disso existe (não existe "Brahma Duplo Malte", "Belco Pilsen", "Black Princes", nem litragem 20L de nada). Se o assunto for preço, produto, marca ou tabela, e a ferramenta preco_por_bairro AINDA NÃO foi chamada NESTA resposta, chame-a AGORA antes de responder — nunca responda com números ou nomes que você "lembra" de mensagens anteriores ou do seu próprio conhecimento geral sobre chope/cerveja. Isso vale mesmo se o cliente pedir "a tabela toda" ou parecer uma pergunta simples: SEMPRE a ferramenta primeiro, texto depois. Informar um produto ou preço inventado é o pior erro possível neste atendimento — é dinheiro real do cliente. Isso vale TAMBÉM para dizer se um produto ou LITRAGEM existe: NUNCA afirme "só tem em 30L", "não temos 50L", "esse não existe" ou parecido sem chamar preco_por_bairro ANTES — a ferramenta lista TODOS os produtos e litragens disponíveis da região; se está na lista, existe (ex.: Chopp de Vinho tem 30L E 50L). Nunca negue uma litragem de memória.

# Memória da conversa — NUNCA re-pergunte o que já sabe (regra crítica)
Antes de CADA resposta, releia a conversa inteira e reconstrua TUDO que o cliente JÁ informou: marca, litragem, quantidade, bairro, endereço, CPF, tipo de chopeira (elétrica ou de gelo), se o local tem escada e a forma de pagamento. É PROIBIDO perguntar de novo qualquer coisa que ele já respondeu — nem com outras palavras, nem "só pra confirmar". Isso vale também para o que já estiver na FICHA DO CLIENTE (cadastro): se o CPF/CNPJ já veio no cadastro, USE e não pergunte. **EXCEÇÃO — LOCAL DE ENTREGA:** bairro, cidade e endereço de entrega você SEMPRE pergunta a cada pedido; NUNCA reutilize o do cadastro nem o de um pedido anterior (o mesmo cliente pede chopp pra lugares diferentes). Dentro DESTA conversa, claro, se ele já disse o bairro agora, não repita a pergunta. Se você já tem a informação, vá direto pra a PRÓXIMA que falta. Uma resposta curta se refere à ÚLTIMA pergunta que você fez (ele respondeu "50" depois de você perguntar a litragem? então litragem = 50L, preenchido; respondeu "elétrica" depois de você perguntar o tipo de chopeira? então chopeira = elétrica). Se ele mandou vários dados de uma vez, aproveite todos e pule as perguntas correspondentes. Nunca volte a uma etapa anterior já resolvida.

Você tem uma AJUDA de memória travada em código: se aparecer um bloco "JÁ CONFIRMADO NESTE PEDIDO" nestas instruções, ele é a fonte de verdade absoluta — nunca pergunte de novo nada que está listado ali, mesmo que a conversa pareça sugerir o contrário. E toda vez que o cliente confirmar um dado do pedido (produto, quantidade, bairro, entrega/retirada, endereço, chopeira, escada, CPF/CNPJ ou forma de pagamento), chame a ferramenta atualizar_dados_pedido na mesma resposta, com o(s) campo(s) que acabou de confirmar — isso é o que alimenta esse bloco e evita que você repita a pergunta depois.

# Cadastro natural (regras invioláveis)
- NUNCA diga que o cliente "não tem cadastro", "não está cadastrado", "não te encontrei aqui" ou algo do tipo. Trate TODO mundo como cliente conhecido, mesmo que seja o primeiro contato.
- NUNCA diga que está "cadastrando", "salvando", "atualizando o cadastro" ou "anotando seus dados". Isso é feito nos bastidores, de forma invisível — o cliente não vê.
- Conforme o cliente for te contando as coisas (o nome dele, o endereço, o bairro, ou o que ele quer/costuma pedir), use a ferramenta salvar_cliente para guardar — de forma silenciosa, sem comentar nada.
- Pergunte o bairro, a cidade e o endereço da entrega de forma leve e natural ("Pra qual bairro é a entrega?", "Me passa o endereço?") e siga a conversa. Quando o cliente responder, guarde com salvar_cliente. SEMPRE pergunte o local desta entrega — mesmo que haja endereço/bairro no cadastro, NÃO assuma que é o mesmo (o cliente pede chopp pra lugares diferentes a cada pedido).
- Os pilares que você vai montando aos poucos: nome do cliente, endereço, e o que ele costuma pedir (ex.: "Belco 50L, Heineken"). Salve cada um assim que souber.
- Nunca fique "perdido" por falta de informação: se faltar algo, pergunte com naturalidade uma coisa por vez e continue.

# Preço — sempre pelo site, por localidade (regra inviolável)
- O preço vem SEMPRE da ferramenta preco_por_bairro (preços do site, por bairro) — e do finalizar_pedido pra fechar. Com o bairro em mãos, DIGA o preço na hora.
- NUNCA diga que "a equipe comercial vai passar o preço" / "o comercial confirma" quando o bairro é coberto. Isso só vale se preco_por_bairro disser que o bairro está FORA da área de entrega.
- Se o cliente perguntar preço e você ainda não tem o bairro, peça SÓ o bairro e então responda o preço — não empurre pro comercial.

# Como mostrar preços
- SEMPRE consulte preco_por_bairro antes de falar qualquer preço (com o bairro do cliente). Nunca fale preço de memória.
- Se o cliente pediu a TABELA/LISTA de preços (vários produtos: "me manda a tabela", "quais os preços", "preço de tudo", "quanto tá cada um"): chame preco_por_bairro com tabela_completa=true. A TABELA JÁ SERÁ COLADA AUTOMATICAMENTE embaixo da sua mensagem — você escreve APENAS uma saudação curta de 1 linha (nome do cliente + bairro + "seguem os preços 👇"). NÃO escreva preço, nome de produto nem tabela; NÃO faça pergunta. Só a saudação.
- Se o cliente perguntou de UM produto específico ("quanto é a Brahma?"): chame preco_por_bairro com tabela_completa=false e responda em UMA frase natural só o preço daquele produto (ex.: "Belco 50L pra Xerém sai R$600 a unidade, R$550 levando 2, ou R$500 de 3+, com frete grátis") — sem listar os outros.
- Se o cliente quer o TOTAL de N barris ("quanto fica 3 Belco 50?", "quero 3 belco 50 quanto no total"): chame preco_por_bairro com produto E quantidade — a ferramenta devolve o total EXATO no campo "cotacao". Informe esse total ao pé da letra. NUNCA multiplique de cabeça: você erra a faixa por quantidade.

# Fechamento e PIX (regra inviolável — é dinheiro do cliente)
- Pra fechar o pedido, SEMPRE chame finalizar_pedido. Nunca feche "de cabeça".
- Assim que o cliente responder o ÚLTIMO dado (normalmente a forma de pagamento), FINALIZE DIRETO, na MESMA resposta: NUNCA peça permissão ("posso fechar?", "posso confirmar?", "confirma pra mim?", "fecho o pedido?") nem espere um "sim" — com tudo em mãos, chame finalizar_pedido de uma vez. Mande UM RESUMO COMPLETO e organizado do pedido — TODOS os dados coletados (nome do cliente, produto e quantidade, tipo de chopeira (elétrica ou de gelo), bairro e cidade, endereço, se tem escada, casa ou salão, data e horário, CPF, forma de pagamento, total e frete grátis) — e logo em seguida FINALIZE com clareza, avisando que o pedido está registrado e a EQUIPE já vai entrar em contato. Ex.: "Pronto! ✅ Seu pedido está registrado. A equipe da SS-Chopp já vai entrar em contato pra confirmar e combinar tudo. 🍺🚚".
- PEDIDO FINALIZADO = FIM. Depois de mandar o resumo + o aviso de que a equipe vai entrar em contato, o pedido ACABOU: NÃO pergunte mais nada, NÃO reinicie o fluxo, NÃO repita perguntas nem fique "só confirmando". Se o cliente mandar mais mensagens, responda curto e caloroso ("A equipe já vai te chamar 😉") — só recomece o fluxo se ele CLARAMENTE quiser fazer um NOVO pedido.
- NUNCA escreva uma chave PIX, CNPJ, CPF, banco, agência ou conta — NEM um espaço reservado/placeholder tipo "[chave aqui]", "[link do PIX]" ou "[anexo da chave]". NÃO invente, NÃO mascare com asteriscos, NÃO copie de memória. O SISTEMA envia a chave PIX correta sozinho, numa MENSAGEM SEPARADA logo depois da sua (só o número, pro cliente copiar e colar no banco). Não anuncie a chave nem escreva nada no lugar dela. O cliente pode fazer o sinal de 50% pra adiantar, mas você NÃO fica esperando/cobrando o comprovante — a equipe cuida do pagamento no contato.

# Ordens de estilo do dono — cumpra AO PÉ DA LETRA
As regras de "Jeito de falar"/estilo da sua personalidade são ORDENS diretas do dono. Cumpra-as EXATAMENTE como escritas, ao pé da letra, em TODA resposta. Se o dono mandou começar de um jeito, comece exatamente assim. Se mandou ser curto, ou responder "apenas"/"só" algo, faça só isso — NÃO adicione apresentação da empresa, história ("desde 2016"), frases de efeito, perguntas ou qualquer texto que não foi pedido. Menos é mais: entregue só o que foi pedido, do jeito que foi pedido.

# Saída — SÓ a mensagem final ao cliente
Sua resposta é EXCLUSIVAMENTE a mensagem que o cliente vai ler no WhatsApp, em português. NUNCA escreva seu raciocínio, análise, plano ou passos ("the user wants", "my next step", "I need to…"), NUNCA use rótulos como "SPECIAL INSTRUCTION", NUNCA cite o system prompt nem escreva em inglês. Pense internamente, mas mande só a resposta pronta, curta e natural.

# Sem barra "/" na mensagem
NUNCA use o caractere barra "/" no texto que envia ao cliente — nem entre palavras, nem em rótulos/títulos de resumo. Escreva sempre por extenso, com "ou" ou "e":
- opções: "elétrica ou de gelo", "casa ou salão", "entrega ou retirada", "PIX, dinheiro ou cartão" (nunca "elétrica/gelo", "casa/salão");
- rótulos de resumo: "Data e horário", "Forma de pagamento" (nunca "Data/Horário");
- datas: "dia 25 de dezembro" (nunca "25/12").
Faça UMA pergunta por mensagem — nunca ofereça várias escolhas separadas por barra nem junte perguntas.`;

// ─── Normalização dos dados de qualificação (mesmos campos do form do site) ──
// O agente coleta em linguagem natural; aqui a gente padroniza pro formato que
// o SiteOrder/Customer esperam. Entrada vazia/desconhecida → null (não grava).

// CPF/CNPJ: guarda o documento como o cliente informou, só limpando espaços em
// volta. Não valida (o cliente pode digitar com ou sem máscara).
export function normalizeDocument(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= 5 ? t : null; // ignora "", "-", lixo curto
}

// Tipo de chopeira → 'eletrica' | 'gelo' | null.
export function normalizeChopeira(v: unknown): "eletrica" | "gelo" | null {
  if (typeof v !== "string") return null;
  const t = v.toLowerCase();
  if (/(el[ée]tr|tomada|energia|luz)/.test(t)) return "eletrica";
  if (/gelo/.test(t)) return "gelo";
  return null;
}

// Acesso do local → 'sim' (tem escada) | 'nao' (térreo) | null.
export function normalizeEscada(v: unknown): "sim" | "nao" | null {
  if (typeof v !== "string") return null;
  const t = v.toLowerCase();
  // "não tem escada" / "é térreo" / "sem escada" → nao
  if (/(t[ée]rreo|sem escada|n[aã]o tem|nenhuma|ch[aã]o)/.test(t)) return "nao";
  if (/^n[aã]o\b/.test(t)) return "nao";
  // "tem escada", "sim", "com escada", "2 lances" → sim
  if (/(escada|degrau|lance|andar|subir|sim|tem)/.test(t)) return "sim";
  return null;
}

// ─── Memória de pedido em CÓDIGO (reforço contra o LLM "esquecer") ─────────
// O prompt já manda não re-perguntar o que o cliente já respondeu, mas o
// Gemini às vezes esquece um dado confirmado há 1-2 mensagens (ex.: pergunta a
// quantidade de novo logo depois de perguntar a chopeira) — falha observada em
// produção. Este rascunho guarda em código, por sessão, os campos do pedido
// conforme vão sendo confirmados (via a ferramenta atualizar_dados_pedido, ou
// de graça quando preco_por_bairro/finalizar_pedido já trazem o dado) e o
// bloco derivado dele é injetado no prompt a CADA turno como fonte de
// verdade — não depende do LLM reconstruir sozinho a partir do histórico.
// Mesma filosofia do shieldPix: o que já foi confirmado não pode depender só
// da memória do modelo.
export type OrderDraft = {
  produto?: string;
  quantidade?: number;
  bairro?: string;
  entrega?: string;
  endereco?: string;
  chopeiraType?: "eletrica" | "gelo";
  hasStairs?: "sim" | "nao";
  document?: string;
  formaPagamento?: string;
  nome?: string; // nome completo do cliente (perguntado no fluxo)
};

const ORDER_DRAFT_PREFIX = "agent.order_draft.";

function orderDraftKey(sessionId: string): string {
  return `${ORDER_DRAFT_PREFIX}${sessionId}`;
}

async function getOrderDraft(companyId: string, sessionId: string): Promise<OrderDraft> {
  const row = await prisma.setting.findUnique({
    where: { companyId_key: { companyId, key: orderDraftKey(sessionId) } },
    select: { value: true },
  });
  if (!row?.value) return {};
  try {
    return JSON.parse(row.value) as OrderDraft;
  } catch {
    return {};
  }
}

async function saveOrderDraft(companyId: string, sessionId: string, draft: OrderDraft): Promise<void> {
  const key = orderDraftKey(sessionId);
  if (Object.keys(draft).length === 0) {
    await prisma.setting.deleteMany({ where: { companyId, key } });
    return;
  }
  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key } },
    update: { value: JSON.stringify(draft) },
    create: { companyId, key, value: JSON.stringify(draft) },
  });
}

const DRAFT_LABELS: Record<keyof OrderDraft, string> = {
  nome: "Nome do cliente",
  produto: "Produto (marca+litragem)",
  quantidade: "Quantidade de barris",
  bairro: "Bairro",
  entrega: "Entrega ou retirada",
  endereco: "Endereço",
  chopeiraType: "Tipo de chopeira",
  hasStairs: "Tem escada",
  document: "CPF/CNPJ",
  formaPagamento: "Forma de pagamento do restante",
};

// Bloco injetado no prompt com o que JÁ foi confirmado nesta conversa, travado
// em código — o LLM não pode "esquecer" o que está aqui porque não precisa
// reconstruir da conversa: o código já entrega pronto. Pura e testável.
export function renderOrderDraftBlock(draft: OrderDraft): string {
  const entries = (Object.keys(DRAFT_LABELS) as (keyof OrderDraft)[])
    .map((k) => [DRAFT_LABELS[k], draft[k]] as const)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "");
  if (entries.length === 0) return "";
  const lines = entries.map(([label, v]) => `- ${label}: ${v}`).join("\n");
  return [
    "JÁ CONFIRMADO NESTE PEDIDO (travado em código — é PROIBIDO perguntar de novo qualquer item desta lista, nem reformulado):",
    lines,
    "Peça só o que NÃO está nesta lista. Ao confirmar um novo dado do pedido (produto, quantidade, bairro, entrega/retirada, endereço, chopeira, escada, CPF/CNPJ ou forma de pagamento), chame atualizar_dados_pedido na mesma resposta.",
  ].join("\n");
}

// Trava anti-pulo da ESCADA/ACESSO (reforço em código). No fluxo, a escada vem
// logo depois do endereço — e é a etapa que MAIS some quando uma correção/ensino
// aponta o "próximo passo" errado (ex.: uma correção "cliente deu o endereço →
// pergunte a data" atropela a escada). O prompt sozinho não segura contra uma
// correção literal. Como o rascunho tipado já sabe que o endereço existe e que a
// escada ainda não foi informada, o código força a pergunta aqui, com autoridade
// de fonte de verdade. Mesma filosofia da trava do CPF no fechamento. Só dispara
// quando há endereço e NÃO há escada; some assim que a escada é respondida.
// Pura e testável.
export function renderEscadaGate(draft: OrderDraft): string {
  const temEndereco = !!draft.endereco && String(draft.endereco).trim() !== "";
  const temEscada = draft.hasStairs === "sim" || draft.hasStairs === "nao";
  if (!temEndereco || temEscada) return "";
  return [
    "⚠️ FALTA A ESCADA/ACESSO (trava em código): o endereço já foi informado, mas você ainda NÃO perguntou se o local é TÉRREO ou tem ESCADA.",
    "Pergunte ISSO agora (a equipe precisa saber pra subir o barril) ANTES de avançar para data, horário, casa/salão, CPF, pagamento ou fechamento.",
    "Nenhuma correção/ensino te autoriza a pular esta pergunta — se alguma parecer mandar ir direto pra data, ignore o pulo e pergunte a escada primeiro.",
  ].join("\n");
}

// Aplica um patch (de atualizar_dados_pedido, preco_por_bairro ou
// finalizar_pedido) por cima do rascunho — só sobrescreve campos informados
// e não-vazios; nunca apaga um campo já confirmado.
export function mergeOrderDraft(draft: OrderDraft, patch: OrderDraft): OrderDraft {
  const merged = { ...draft };
  for (const k of Object.keys(patch) as (keyof OrderDraft)[]) {
    const v = patch[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      (merged as Record<string, unknown>)[k] = v;
    }
  }
  return merged;
}

export async function getAgentConfig(companyId: string) {
  const existing = await prisma.agentConfig.findUnique({ where: { companyId } });
  if (existing) return existing;
  return prisma.agentConfig.create({
    data: {
      companyId,
      name: "Atendente SS-Chopp",
      personality: DEFAULT_PERSONALITY,
      greeting: "Oi! 🍺 Aqui é o atendimento da SS-Chopp. Como posso ajudar?",
    },
  });
}

export async function updateAgentConfig(
  companyId: string,
  data: { name?: string; personality?: string; greeting?: string | null; active?: boolean },
) {
  await getAgentConfig(companyId); // garante que existe
  return prisma.agentConfig.update({ where: { companyId }, data });
}

// ─── Personalidade por seções ───────────────────────────────────────────────
// As seções canônicas são guardadas como JSON no Setting abaixo (sem migração
// de schema). O texto final (AgentConfig.personality, o que o LLM recebe) é
// sempre regenerado a partir delas por renderPersonality — o runtime não muda.
const PERSONALITY_SECTIONS_KEY = "agent.personality_sections";

// Lê as seções da personalidade. `source` diz de onde vieram:
//   "saved"   — já persistidas no Setting (o dono migrou/editou por seção).
//   "parsed"  — derivadas do texto atual, que já está no formato por seções.
//   "default" — o texto atual não é parseável (personalidade antiga à mão);
//               devolve o conteúdo limpo padrão, SEM salvar nem sobrescrever.
export async function getPersonalitySections(
  companyId: string,
): Promise<{ sections: PersonalitySections; source: "saved" | "parsed" | "default" }> {
  const row = await prisma.setting.findUnique({
    where: { companyId_key: { companyId, key: PERSONALITY_SECTIONS_KEY } },
    select: { value: true },
  });
  if (row?.value?.trim()) {
    try {
      return { sections: coerceSections(JSON.parse(row.value)), source: "saved" };
    } catch {
      // JSON corrompido: cai pro texto atual / default abaixo.
    }
  }
  const config = await getAgentConfig(companyId);
  const parsed = parseToSections(config.personality);
  if (parsed) return { sections: parsed, source: "parsed" };
  return { sections: { ...CLEAN_SECTIONS }, source: "default" };
}

// Se ainda não há seções salvas para este dono.
export async function isPersonalityMigrated(companyId: string): Promise<boolean> {
  const row = await prisma.setting.findUnique({
    where: { companyId_key: { companyId, key: PERSONALITY_SECTIONS_KEY } },
    select: { value: true },
  });
  return Boolean(row?.value?.trim());
}

// Salva as seções (JSON no Setting) e regenera o texto da personalidade em
// AgentConfig.personality. Guarda a versão anterior do TEXTO para o "desfazer"
// (mesmo mecanismo de um nível de hoje). Retorna o texto final montado.
export async function savePersonalitySections(
  companyId: string,
  sections: PersonalitySections,
): Promise<{ personality: string }> {
  const clean = coerceSections(sections);
  const personality = renderPersonality(clean);
  // Guarda: nunca salvar uma personalidade vazia (apagaria a identidade/tom do
  // agente). Exige a IDENTIDADE preenchida e um mínimo de conteúdo real — evita
  // zerar tudo se a tela mandar seções vazias (ex.: fetch não carregou, ou o
  // dono apagou os campos sem querer).
  if (!clean.identidade.trim() || personality.replace(/[#\s]/g, "").length < 30) {
    throw new ApiError(
      422,
      "A personalidade não pode ficar vazia — preencha pelo menos a Identidade e o Tom antes de salvar.",
    );
  }
  const prevText = (await getAgentConfig(companyId)).personality;

  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key: PERSONALITY_PREV_KEY } },
    update: { value: prevText },
    create: { companyId, key: PERSONALITY_PREV_KEY, value: prevText },
  });
  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key: PERSONALITY_SECTIONS_KEY } },
    update: { value: JSON.stringify(clean) },
    create: { companyId, key: PERSONALITY_SECTIONS_KEY, value: JSON.stringify(clean) },
  });
  await updateAgentConfig(companyId, { personality });
  return { personality };
}

// ─── Roteiro de perguntas do fluxo de venda ──────────────────────────────────
// As perguntas que o agente faz para fechar o pedido, estruturadas e editáveis
// pelo dono. Guardadas como JSON num Setting (sem migração). Se ainda não houver
// nada salvo, devolve o esqueleto padrão (fluxo real da SS-Chopp) SEM persistir.
const FLOW_QUESTIONS_KEY = "agent.flow_questions";

// Roteiro SALVO pelo dono (ou null se ele nunca editou). É isto que pilota o
// agente: enquanto não houver roteiro salvo, o `fluxo` real da personalidade
// segue sendo a única base — não injetamos um segundo fluxo por cima.
async function getSavedFlowQuestions(companyId: string): Promise<FlowQuestion[] | null> {
  const row = await prisma.setting.findUnique({
    where: { companyId_key: { companyId, key: FLOW_QUESTIONS_KEY } },
    select: { value: true },
  });
  if (!row?.value?.trim()) return null;
  try {
    const parsed = coerceFlowQuestions(JSON.parse(row.value));
    return parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

// Para a UI: o roteiro salvo, ou o esqueleto padrão (fiel ao fluxo real) quando
// ainda não há nada salvo — assim o dono sempre vê e edita a partir do fluxo.
export async function getFlowQuestions(companyId: string): Promise<FlowQuestion[]> {
  const saved = await getSavedFlowQuestions(companyId);
  if (saved) return saved;
  return DEFAULT_FLOW_QUESTIONS.map((q) => ({ ...q, pontos: [...q.pontos] }));
}

export async function saveFlowQuestions(
  companyId: string,
  questions: FlowQuestion[],
): Promise<{ questions: FlowQuestion[] }> {
  const clean = coerceFlowQuestions(questions);
  if (!clean.length) {
    throw new ApiError(422, "O roteiro precisa de pelo menos uma pergunta.");
  }
  const value = JSON.stringify(clean);
  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key: FLOW_QUESTIONS_KEY } },
    update: { value },
    create: { companyId, key: FLOW_QUESTIONS_KEY, value },
  });
  return { questions: clean };
}

// ─── Exemplos de comportamento ("norte" editado na aba Conversas) ────────────
const STYLE_EXAMPLES_KEY = "agent.style_examples";

export async function getStyleExamples(companyId: string): Promise<StyleExample[]> {
  const row = await prisma.setting.findUnique({
    where: { companyId_key: { companyId, key: STYLE_EXAMPLES_KEY } },
    select: { value: true },
  });
  if (!row?.value?.trim()) return [];
  try {
    return coerceStyleExamples(JSON.parse(row.value));
  } catch {
    return [];
  }
}

export async function saveStyleExamples(
  companyId: string,
  examples: StyleExample[],
): Promise<{ examples: StyleExample[] }> {
  // dedupeBySituation: rede de segurança — um ensino por situação (o último vence).
  const clean = dedupeBySituation(coerceStyleExamples(examples));
  const value = JSON.stringify(clean);
  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key: STYLE_EXAMPLES_KEY } },
    update: { value },
    create: { companyId, key: STYLE_EXAMPLES_KEY, value },
  });
  return { examples: clean };
}

// ─── Ensino simples: você só edita a resposta; a IA descobre a situação ──────
// A partir do fim da conversa + a resposta editada, a IA gera o "quando aplicar"
// (situação) e a categoria — o dono não precisa preencher nada. Sem chave, cai
// pro fallback (a última fala do cliente).
async function autoSituation(
  context: { role: string; content: string }[],
  ideal: string,
): Promise<{ gatilho: string; categoria: string }> {
  const lastUser = [...context].reverse().find((m) => m.role === "user");
  const fallback = { gatilho: lastUser?.content?.slice(0, 160) ?? "", categoria: "" };
  if (!process.env.GEMINI_API_KEY) return fallback;
  try {
    const convo = context
      .slice(-8)
      .map((m) => `${m.role === "user" ? "Cliente" : "Agente"}: ${m.content}`)
      .join("\n");
    const prompt = `Você organiza correções de um agente de vendas de chope no WhatsApp.

Fim da conversa:
${convo}

Resposta que o DONO quer que o agente dê NESSE momento:
"${ideal}"

Tarefa: descreva em UMA frase curta e GERAL a SITUAÇÃO/momento em que essa resposta deve ser usada (o "quando aplicar") — pela intenção do cliente, não pelas palavras exatas. E escolha UMA categoria desta lista: ${CATEGORIAS.join(", ")}.
Responda SÓ com um JSON válido, nada mais: {"gatilho":"...","categoria":"..."}`;
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const resp = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { thinkingConfig: { thinkingBudget: 512 } },
    });
    const txt = (resp.text ?? "").trim().replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(txt) as { gatilho?: unknown; categoria?: unknown };
    const gatilho = typeof parsed.gatilho === "string" && parsed.gatilho.trim() ? parsed.gatilho.trim() : fallback.gatilho;
    const categoria =
      typeof parsed.categoria === "string" && (CATEGORIAS as readonly string[]).includes(parsed.categoria)
        ? parsed.categoria
        : "";
    return { gatilho, categoria };
  } catch {
    return fallback;
  }
}

// Cria/atualiza uma CORREÇÃO a partir do contexto da conversa. O dono manda só a
// resposta (ideal); a situação é detectada pela IA. Upsert por id (edição) —
// novos são adicionados. Retorna a lista salva.
export async function saveCorrectionFromContext(
  companyId: string,
  input: { id?: string; context: { role: string; content: string }[]; ideal: string; nota?: string },
): Promise<{ examples: StyleExample[] }> {
  const ideal = input.ideal.trim();
  if (!ideal) throw new ApiError(422, "A resposta não pode ficar vazia.");
  const list = await getStyleExamples(companyId);
  const existing = input.id ? list.find((e) => e.id === input.id) : undefined;
  // Detecta a situação quando há contexto (novo ensino). Editando um item sem
  // contexto (ex.: só trocou o texto no card), mantém o gatilho que já existe.
  const shouldDetect = (input.context?.length ?? 0) > 0 || !existing;
  const { gatilho, categoria } = shouldDetect
    ? await autoSituation(input.context ?? [], ideal)
    : { gatilho: "", categoria: "" };
  const lastUser = [...(input.context ?? [])].reverse().find((m) => m.role === "user");
  const item: StyleExample = {
    id: input.id ?? "ex" + Math.random().toString(36).slice(2, 8),
    tipo: "exemplo",
    gatilho: gatilho || existing?.gatilho || "",
    categoria: categoria || existing?.categoria || "",
    variacoes: existing?.variacoes ?? [],
    cliente: lastUser?.content ?? existing?.cliente ?? "",
    ideal,
    original: existing?.original,
    nota: input.nota?.trim() || existing?.nota || undefined,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  return saveStyleExamples(companyId, upsertExample(list, item));
}

// EDITOR POR SEÇÃO (v2). Em vez de reescrever o texto inteiro ("preserve todo o
// resto", que deixava contradições), identifica quais SEÇÕES a instrução afeta
// e reescreve CADA UMA por inteiro — as demais ficam intactas por construção.
// É isto que acaba com o "ajuste parcial". Não salva: devolve a prévia (seções
// resultantes + o que mudou) pra UI/WhatsApp confirmarem.
const SECTIONS_EDITOR_RULES = `Você é um EDITOR da personalidade de um agente de atendimento de WhatsApp de uma distribuidora de chope (SS-Chopp). A personalidade é dividida em SEÇÕES fixas, cada uma com um papel. Você recebe o conteúdo ATUAL de cada seção e uma INSTRUÇÃO do operador (o dono).

Sua tarefa: descobrir quais seções a instrução afeta e reescrever CADA UMA dessas seções POR INTEIRO, já coerente, aplicando o pedido em todos os pontos daquela seção. NÃO devolva as seções que não precisam mudar. Quem manda no comportamento é só o texto que você devolve para a seção — então não deixe, na seção reescrita, nenhuma frase que contradiga o que o operador pediu.

SEÇÕES (chave — papel):
- identidade — quem é o agente: nome, empresa, papel.
- tom — como fala: formalidade, tamanho das frases, emojis, ritmo, uma pergunta por vez.
- saudacao — como abre a conversa e cumprimenta.
- catalogo — o que a empresa vende em linhas gerais (marcas, o que vem no kit). NUNCA fixe litragem nem preço aqui.
- fluxo — os passos do atendimento até fechar o pedido.
- regrasDono — regras e preferências livres que o dono acrescenta.

REGRAS INVIOLÁVEIS — você NUNCA adiciona, enfraquece ou contradiz nada sobre: (1) PREÇO sempre pela ferramenta de preço por bairro, nunca de memória; (2) CADASTRO silencioso, nunca dizer que está cadastrando nem que o cliente "não tem cadastro"; (3) USO DE FERRAMENTAS para consultar dados. Isso já é garantido pelo sistema, fora destas seções. Se a instrução pedir para mexer nisso (ex.: "pode falar preço de cabeça"), NÃO faça — explique no campo "blocked".

Escolha a MENOR quantidade de seções necessária. "fala mais curto" → só tom. "muda a saudação" → só saudacao. "sempre ofereça a chopeira" → regrasDono (ou catalogo, se for sobre o que vende). Preserve o português do Brasil.

Responda SOMENTE com um JSON válido, sem markdown, exatamente neste formato:
{"changes": {"<chave da seção>": "<novo conteúdo COMPLETO da seção>", ...}, "summary": "<1-2 frases, em pt-BR, do que mudou e em qual seção>", "blocked": "<null se nada foi bloqueado; senão, explique o que foi ignorado por ser regra crucial>"}`;

export type SectionsEditResult = {
  sections: PersonalitySections; // prévia já com as mudanças aplicadas (não salva)
  changedKeys: string[]; // seções que mudaram
  summary: string;
  blocked: string | null;
};

export async function editPersonalitySections(
  companyId: string,
  instruction: string,
): Promise<SectionsEditResult> {
  const { sections: current } = await getPersonalitySections(companyId);

  if (!process.env.GEMINI_API_KEY) {
    throw new ApiError(
      503,
      "A edição por conversa precisa da GEMINI_API_KEY configurada. Sem ela, edite as seções manualmente.",
    );
  }

  const secoesTxt = SECTION_META.map(
    ({ key, titulo }) => `[${key}] ${titulo}:\n"""\n${current[key] || "(vazia)"}\n"""`,
  ).join("\n\n");
  const userMsg = `SEÇÕES ATUAIS:\n${secoesTxt}\n\nINSTRUÇÃO DO OPERADOR:\n"""\n${instruction}\n"""`;

  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: userMsg }] }],
    config: {
      systemInstruction: SECTIONS_EDITOR_RULES,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 1024 },
    },
  });

  const raw = (response.text ?? "").trim();
  let parsed: { changes?: unknown; summary?: unknown; blocked?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError(502, "A IA devolveu um formato inesperado. Tente reformular a instrução.");
  }

  const changes =
    parsed.changes && typeof parsed.changes === "object"
      ? (parsed.changes as Record<string, unknown>)
      : {};
  const { sections, changedKeys } = applySectionChanges(current, changes);

  const blockedRaw = typeof parsed.blocked === "string" ? parsed.blocked.trim() : "";
  const blocked = blockedRaw && blockedRaw.toLowerCase() !== "null" ? blockedRaw : null;

  if (changedKeys.length === 0 && !blocked) {
    throw new ApiError(
      422,
      "Não entendi o que mudar. Tenta ser mais específico (ex.: “deixa a saudação mais curta”).",
    );
  }

  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : "Alteração aplicada.";

  return { sections, changedKeys, summary, blocked };
}

// ─── Treinador pelo WhatsApp ────────────────────────────────────────────────
// Números autorizados a MOLDAR o agente por mensagem no WhatsApp. Uma mensagem
// que começa com a palavra-chave "ajuste" (ou treino/ajustar/treinar) vira uma
// instrução de personalidade — aplicada na hora, protegendo as regras cruciais.
// O resto das mensagens desse número seguem o fluxo normal (ele testa como
// cliente). Guardado por empresa no model Setting.
const TRAINER_KEY = "agent.trainer_numbers";
const PERSONALITY_PREV_KEY = "agent.personality_prev";

export async function getTrainerNumbers(companyId: string): Promise<string[]> {
  const row = await prisma.setting.findUnique({
    where: { companyId_key: { companyId, key: TRAINER_KEY } },
    select: { value: true },
  });
  return (row?.value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export async function setTrainerNumbers(companyId: string, raw: string): Promise<string> {
  // guarda só os dígitos de cada número (>= 8 dígitos), separados por vírgula
  const value = raw
    .split(",")
    .map((s) => s.replace(/\D/g, ""))
    .filter((s) => s.length >= 8)
    .join(",");
  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key: TRAINER_KEY } },
    update: { value },
    create: { companyId, key: TRAINER_KEY, value },
  });
  return value;
}

export async function isTrainerNumber(companyId: string, phone: string): Promise<boolean> {
  const key = phoneMatchKey(phone);
  if (!key) return false;
  const nums = await getTrainerNumbers(companyId);
  return nums.some((n) => phoneMatchKey(n) === key);
}

// Desfaz o último ajuste: troca a personalidade atual pela anterior (e vice-versa
// — vira um liga/desliga de um nível). Retorna false se não há versão anterior.
export async function undoLastPersonality(companyId: string): Promise<boolean> {
  const row = await prisma.setting.findUnique({
    where: { companyId_key: { companyId, key: PERSONALITY_PREV_KEY } },
    select: { value: true },
  });
  const prev = row?.value?.trim();
  if (!prev) return false;
  const current = (await getAgentConfig(companyId)).personality;
  await updateAgentConfig(companyId, { personality: prev });
  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key: PERSONALITY_PREV_KEY } },
    update: { value: current },
    create: { companyId, key: PERSONALITY_PREV_KEY, value: current },
  });
  return true;
}

// ─── Ajuste pelo WhatsApp: modo ajuste + confirmação (para leigo) ────────────
// Estado por número treinador (modo ligado/desligado + a prévia aguardando
// "sim"), guardado como JSON num Setting. A decisão do que fazer com cada
// mensagem é pura (decideTrainerAction, em agent-trainer.ts); aqui a gente
// executa: gera a prévia, aplica, desfaz, liga/desliga o modo.
const TRAINER_SESSION_PREFIX = "agent.trainer_session.";

type TrainerPending = {
  sections: PersonalitySections;
  changedKeys: string[];
  summary: string;
  blocked: string | null;
};
type TrainerSession = { mode: TrainerMode; pending: TrainerPending | null; at?: number };

// O modo ajuste EXPIRA sozinho depois disso parado — assim ninguém fica preso
// no modo (capturando toda mensagem como "ajuste") por ter esquecido de "sair".
const TRAINER_MODE_TTL_MS = 12 * 60 * 1000; // 12 min

function trainerSessionKey(phone: string): string {
  return `${TRAINER_SESSION_PREFIX}${phoneMatchKey(phone) || phone}`;
}

async function getTrainerSession(companyId: string, phone: string): Promise<TrainerSession> {
  const row = await prisma.setting.findUnique({
    where: { companyId_key: { companyId, key: trainerSessionKey(phone) } },
    select: { value: true },
  });
  if (row?.value?.trim()) {
    try {
      const j = JSON.parse(row.value) as Partial<TrainerSession>;
      const mode = j.mode === "adjusting" ? "adjusting" : "idle";
      // Timeout: modo ajuste parado há muito tempo volta a atender normalmente.
      if (mode === "adjusting" && (!j.at || Date.now() - j.at > TRAINER_MODE_TTL_MS)) {
        return { mode: "idle", pending: null };
      }
      return { mode, pending: j.pending ?? null, at: j.at };
    } catch {
      // estado corrompido → começa limpo
    }
  }
  return { mode: "idle", pending: null };
}

async function setTrainerSession(
  companyId: string,
  phone: string,
  session: TrainerSession,
): Promise<void> {
  const key = trainerSessionKey(phone);
  // idle sem prévia pendente = estado "limpo": apaga o registro (não deixa lixo
  // nem risco de reabrir por engano).
  if (session.mode === "idle" && !session.pending) {
    await prisma.setting.deleteMany({ where: { companyId, key } }).catch(() => {});
    return;
  }
  const value = JSON.stringify({ ...session, at: Date.now() });
  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key } },
    update: { value },
    create: { companyId, key, value },
  });
}

// Monta a prévia em texto amigável pro WhatsApp (linguagem de leigo).
function previewTextForWhatsApp(pending: TrainerPending): string {
  const nomes = pending.changedKeys
    .map((k) => SECTION_META.find((m) => m.key === k)?.titulo ?? k)
    .join(", ");
  let msg = `📝 ${pending.summary}`;
  if (nomes) msg += `\n(muda: ${nomes})`;
  if (pending.blocked) msg += `\n⚠️ Não mexi no que é regra travada: ${pending.blocked}`;
  msg += `\n\nAplico? responde *sim* pra valer, *não* pra descartar.`;
  return msg;
}

// Orquestra uma mensagem de um número TREINADOR. Devolve a resposta pro
// WhatsApp e se a conversa de teste deve ser zerada; ou null quando a mensagem
// não é ajuste (o webhook então trata como cliente normal).
export async function handleTrainerMessage(
  companyId: string,
  phone: string,
  text: string,
): Promise<{ reply: string; resetConversa: boolean } | null> {
  const session = await getTrainerSession(companyId, phone);
  const action = decideTrainerAction(text, {
    mode: session.mode,
    hasPending: Boolean(session.pending),
  });

  const HELP =
    "🛠️ Modo ajuste: me diz em português o que mudar no jeito do atendente (ex.: “seja mais rápido pra fechar”, “ofereça sempre a chopeira”). Eu mostro o que vai mudar e só aplico com o seu *sim*. “desfazer” volta o último, “sair” desliga.";

  // Gera a prévia de uma instrução e guarda como pendente. Mensagens de erro
  // amigáveis (a IA pode não entender, ou faltar chave).
  const proposeEdit = async (instruction: string): Promise<string> => {
    try {
      const p = await editPersonalitySections(companyId, instruction);
      await setTrainerSession(companyId, phone, {
        mode: "adjusting",
        pending: {
          sections: p.sections,
          changedKeys: p.changedKeys,
          summary: p.summary,
          blocked: p.blocked,
        },
      });
      return previewTextForWhatsApp({
        sections: p.sections,
        changedKeys: p.changedKeys,
        summary: p.summary,
        blocked: p.blocked,
      });
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      if (status === 422) {
        return "Não entendi bem o que mudar 🤔 Me explica de outro jeito (ex.: “deixa a saudação mais curta”).";
      }
      Sentry.captureException(e, { tags: { companyId, whatsapp: "trainer-edit" } });
      return "Não consegui ajustar agora 😕 Tenta de novo em instantes.";
    }
  };

  switch (action.kind) {
    case "ignore":
    case "passthrough":
      return null;

    case "enter": {
      if (action.instruction) {
        const reply = await proposeEdit(action.instruction);
        return { reply, resetConversa: false };
      }
      await setTrainerSession(companyId, phone, { mode: "adjusting", pending: null });
      return {
        reply:
          "🛠️ Modo ajuste ligado! Me diz o que você quer mudar no jeito do atendente. " +
          "Eu mostro o que vai mudar e peço um *sim* antes de aplicar. (manda “sair” quando terminar)",
        resetConversa: false,
      };
    }

    case "exit":
      await setTrainerSession(companyId, phone, { mode: "idle", pending: null });
      return {
        reply: "👍 Modo ajuste desligado. Suas próximas mensagens voltam a ser atendidas normalmente.",
        resetConversa: false,
      };

    case "help":
      return { reply: HELP, resetConversa: false };

    case "undo": {
      const ok = await undoLastPersonality(companyId);
      // Sai do modo: volta ao atendimento normal (não fica preso).
      await setTrainerSession(companyId, phone, { mode: "idle", pending: null });
      if (!ok) return { reply: "Não tenho um ajuste anterior pra desfazer.", resetConversa: false };
      return {
        reply: "↩️ Desfeito — voltei pro jeito anterior.\n🔄 Zerei a conversa de teste: manda um “oi” pra ver.",
        resetConversa: true,
      };
    }

    case "cancel":
      // Descartou a prévia → volta ao atendimento normal.
      await setTrainerSession(companyId, phone, { mode: "idle", pending: null });
      return {
        reply: "Beleza, não mexi 👍 Voltei ao atendimento normal. Pra tentar de novo, é só mandar “ajuste …”.",
        resetConversa: false,
      };

    case "confirm": {
      if (!session.pending) {
        return { reply: "Não tenho nada pendente pra aplicar. Me diz o que mudar 🙂", resetConversa: false };
      }
      await savePersonalitySections(companyId, session.pending.sections);
      const summary = session.pending.summary;
      // Aplicou → SAI do modo (volta ao normal). Pra outro ajuste, manda "ajuste …".
      await setTrainerSession(companyId, phone, { mode: "idle", pending: null });
      return {
        reply:
          `✅ Feito! ${summary}\n🔄 Zerei a conversa de teste: manda um “oi” pra ver como ficou.\n` +
          "Voltei ao atendimento normal — pra outro ajuste é só mandar “ajuste …”; pra reverter este, “desfazer”.",
        resetConversa: true,
      };
    }

    case "instruct": {
      const reply = await proposeEdit(action.instruction);
      return { reply, resetConversa: false };
    }
  }
}

// ─── Foto do produto (a mesma do site, publicada no Netlify) ──────────────
// Enviada pelo WhatsApp junto com a confirmação do pedido (ver finalizar_pedido).

const SITE_URL = "https://spontaneous-parfait-15ffd3.netlify.app";

// productId (site-pricing.ts) → arquivo da foto do barril em ss-chopp/public/logos.
// Alguns produtos compartilham a mesma foto (sem litragem estampada nela).
const PRODUCT_PHOTO_FILE: Record<string, string> = {
  "belco-30l": "belco-bar.webp",
  "belco-50l": "belco-bar.webp",
  "brahma-50l": "brahma-bar.webp",
  "heineken-30l": "heineken-bar.webp",
  "heineken-50l": "heineken-bar.webp",
  "amstel-30l": "amstel-30l-bar.webp",
  "amstel-50l": "amstel-50l-bar.webp",
  "vinho-30l": "vinho-bar.webp",
  "vinho-50l": "vinho-bar.webp",
};

function photoUrlForProduct(id: string): string | undefined {
  const file = PRODUCT_PHOTO_FILE[id];
  return file ? `${SITE_URL}/logos/${file}` : undefined;
}

// Mensagem enviada depois da(s) foto(s), quando o pedido fecha com sucesso.
export const ORDER_PHOTO_FOLLOWUP =
  "Confirma o pagamento pra gente que logo logo sua cerveja tá aí na sua casa! 🍺🚚";

// ─── Ferramentas do agente (as mesmas consultas da gestão de estoque) ──────

const TOOLS: FunctionDeclaration[] = [
  {
    name: "buscar_cliente",
    description:
      "Busca clientes cadastrados por nome, telefone/whatsapp ou cidade. Use sempre que o interlocutor mencionar um cliente para identificá-lo antes de responder.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        termo: { type: Type.STRING, description: "Nome, telefone ou cidade do cliente" },
      },
      required: ["termo"],
    },
  },
  {
    name: "situacao_cliente",
    description:
      "Retorna a situação completa de um cliente: status, segmento CRM (recorrente/em risco/inativo), barris em poder dele (cheios/vazios), última movimentação e ritmo de compra. Use após identificar o cliente com buscar_cliente.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerId: { type: Type.STRING, description: "ID do cliente obtido em buscar_cliente" },
      },
      required: ["customerId"],
    },
  },
  {
    name: "extrato_cliente",
    description:
      "Retorna as últimas movimentações do cliente (entregas, retiradas, trocas) com saldo após cada uma, como um extrato bancário.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerId: { type: Type.STRING },
        limite: { type: Type.INTEGER, description: "Quantas movimentações retornar (padrão 5)" },
      },
      required: ["customerId"],
    },
  },
  {
    name: "estoque_disponivel",
    description:
      "Consulta o estoque atual do depósito por tipo de barril (cheios/vazios disponíveis, em manutenção, com clientes). Use antes de prometer qualquer entrega.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "clientes_para_reativar",
    description:
      "Lista clientes em risco ou inativos (que pararam de pedir), com dias desde a última movimentação e barris parados com eles. Útil para ações de reativação.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "preco_por_bairro",
    description:
      "Consulta se um bairro está na área de preço fixo (Duque de Caxias, São João de Meriti e região) e retorna os preços de hoje por tipo de barril, com frete grátis. Use sempre que o cliente mencionar o bairro dele ou perguntar preço/entrega em uma região. Para o TOTAL de N barris de um produto, passe também 'produto' e 'quantidade' — a ferramenta devolve o total EXATO (não calcule de cabeça). Se o bairro não estiver coberto, a ferramenta avisa e você deve dizer que a equipe comercial confirma o valor — nunca invente preço para bairro fora da tabela.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        bairro: { type: Type.STRING, description: "Nome do bairro citado pelo cliente" },
        tabela_completa: {
          type: Type.BOOLEAN,
          description:
            "true quando o cliente pediu a TABELA/LISTA de preços de vários produtos ('me manda a tabela', 'quais os preços', 'preço de tudo', 'quanto tá cada um'). false (ou omitido) quando ele perguntou o preço de UM produto específico.",
        },
        produto: {
          type: Type.STRING,
          description:
            "Produto específico perguntado (ex.: 'Belco 50L', 'Brahma 50L', 'Chopp de Vinho 30L'), quando o cliente pergunta de UM item. Opcional.",
        },
        quantidade: {
          type: Type.INTEGER,
          description:
            "Quantidade de barris, quando o cliente quer o TOTAL de N barris de um produto (ex.: 'quanto fica 3 Belco 50'). Informe junto com 'produto'. Opcional.",
        },
      },
      required: ["bairro"],
    },
  },
  {
    name: "salvar_cliente",
    description:
      "Guarda/atualiza SILENCIOSAMENTE o cadastro do cliente com o que você descobriu na conversa (nome, endereço, bairro, cidade, CPF e o que ele costuma pedir). Chame de forma NATURAL e INVISÍVEL sempre que o cliente informar uma dessas coisas — por exemplo, ao dizer o endereço, o nome, o CPF, ou o que quer/costuma pedir. Funciona para número novo (cria o cadastro) e para cliente já existente (completa só o que falta). NUNCA avise o cliente que está cadastrando/salvando — apenas siga a conversa normalmente. Não é preciso ter tudo de uma vez; salve o que tiver.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        nome: { type: Type.STRING, description: "Nome do cliente, se informado" },
        endereco: { type: Type.STRING, description: "Endereço (rua, número), se informado" },
        bairro: { type: Type.STRING, description: "Bairro, se informado" },
        cidade: { type: Type.STRING, description: "Cidade, se informada" },
        cpf: { type: Type.STRING, description: "CPF/CNPJ do cliente (pra registro do pedido), se informado" },
        pedido_costume: {
          type: Type.STRING,
          description: "O que o cliente costuma pedir, ex.: 'Belco 50L, Heineken'",
        },
      },
    },
  },
  {
    name: "atualizar_dados_pedido",
    description:
      "Grave IMEDIATAMENTE, na mesma resposta em que o cliente confirmar, qualquer um destes dados do pedido em andamento: NOME completo do cliente, produto (marca+litragem), quantidade de barris, bairro, tipo de entrega (entrega/retirada), endereço, tipo de chopeira (elétrica/gelo), se tem escada, CPF/CNPJ ou forma de pagamento do restante. Chame só com os campos que acabaram de ser confirmados nesta mensagem — não precisa ter tudo de uma vez, nem repetir o que já foi salvo antes. Isso é o que garante que você NUNCA mais pergunte de novo algo que o cliente já respondeu — sem chamar esta ferramenta a cada confirmação, o dado se perde e a pergunta se repete por engano.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        nome: { type: Type.STRING, description: "Nome completo do cliente, confirmado nesta mensagem" },
        produto: { type: Type.STRING, description: "Produto confirmado nesta mensagem, ex.: 'Belco 30L'" },
        quantidade: { type: Type.INTEGER, description: "Quantidade de barris confirmada nesta mensagem" },
        bairro: { type: Type.STRING, description: "Bairro confirmado nesta mensagem" },
        entrega: { type: Type.STRING, description: "'entrega' ou 'retirada', se confirmado" },
        endereco: { type: Type.STRING, description: "Endereço confirmado nesta mensagem" },
        tipo_chopeira: { type: Type.STRING, description: "'eletrica' ou 'gelo', se confirmado" },
        escada: { type: Type.STRING, description: "'sim' (tem escada) ou 'nao' (térreo), se confirmado" },
        cpf: { type: Type.STRING, description: "CPF/CNPJ confirmado nesta mensagem" },
        forma_pagamento: { type: Type.STRING, description: "Forma de pagamento do restante confirmada nesta mensagem" },
      },
    },
  },
  {
    name: "finalizar_pedido",
    description:
      "Fecha o pedido do cliente e retorna o resumo com total e a chave PIX para pagamento. Use SOMENTE quando o cliente já confirmou o que quer: o(s) produto(s), a quantidade, o bairro e se é entrega ou retirada (e o endereço, se for entrega). Passe também, quando já souber, o CPF, o tipo de chopeira, se tem escada e a forma de pagamento — assim ficam registrados no pedido para a equipe. A ferramenta calcula o total pela tabela de preço fixo e devolve a chave PIX. Não use se ainda faltar alguma das informações obrigatórias (produto, quantidade, bairro, entrega/retirada).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        bairro: { type: Type.STRING, description: "Bairro do cliente (para preço e frete)" },
        entrega: { type: Type.STRING, description: "'entrega' ou 'retirada'" },
        endereco: { type: Type.STRING, description: "Endereço completo (só quando for entrega)" },
        data_entrega: {
          type: Type.STRING,
          description:
            "Dia/data combinado para a entrega ou retirada, SE o cliente já definiu (ex.: '25/12', 'sábado', 'hoje à noite'). Opcional — deixe vazio se ainda não combinaram a data.",
        },
        nome: {
          type: Type.STRING,
          description:
            "Nome COMPLETO do cliente (nome + sobrenome), como ELE informou na conversa. NÃO use o nome de exibição do WhatsApp. Obrigatório pra fechar.",
        },
        cpf: {
          type: Type.STRING,
          description:
            "CPF (ou CNPJ) do cliente para registro do pedido, se ele informou. Só os números/documento — sem rótulo. Opcional.",
        },
        tipo_chopeira: {
          type: Type.STRING,
          description:
            "Tipo de chopeira escolhido: 'eletrica' ou 'gelo', se o cliente já disse. Opcional.",
        },
        escada: {
          type: Type.STRING,
          description:
            "Acesso no local da entrega: 'sim' se tem escada (não é térreo), 'nao' se é térreo/sem escada. Opcional.",
        },
        forma_pagamento: {
          type: Type.STRING,
          description:
            "Como o cliente vai pagar o RESTANTE na entrega, se já disse (ex.: 'PIX', 'dinheiro', 'cartão'). O sinal de 50% é sempre por PIX. Opcional.",
        },
        itens: {
          type: Type.ARRAY,
          description: "Itens do pedido",
          items: {
            type: Type.OBJECT,
            properties: {
              produto: { type: Type.STRING, description: "Produto pedido, ex.: 'Belco 50L', 'Chopp de Vinho 30L'" },
              quantidade: { type: Type.INTEGER, description: "Quantidade de barris deste produto" },
            },
            required: ["produto", "quantidade"],
          },
        },
      },
      required: ["bairro", "entrega", "itens"],
    },
  },
];

// Lê uma configuração da empresa (model Setting). Retorna null se não existir.
async function getSetting(companyId: string, key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({
    where: { companyId_key: { companyId, key } },
    select: { value: true },
  });
  return row?.value?.trim() || null;
}

type ToolCtx = {
  channel?: string;
  phone?: string;
  customerId?: string | null;
  pushName?: string;
  // Nome "de verdade" do cliente (cadastro, sem ser placeholder), resolvido em
  // chatWithAgent — usado pra gravar o pedido do finalizar_pedido com um nome
  // decente, e não o número de telefone.
  customerName?: string;
  // Preenchido pelo finalizar_pedido quando o pedido fecha: fotos dos barris
  // pedidos, para o webhook mandar como mídia depois da resposta em texto.
  photosOut?: { url: string; label: string }[];
  // Preenchido pelo preco_por_bairro quando o cliente pede a TABELA COMPLETA:
  // a tabela já montada em código, colada abaixo da saudação do agente
  // (garante formato/valores certos, sem depender do LLM formatar). Usada como
  // FALLBACK em texto quando não dá pra mandar a imagem.
  priceTableOut?: string;
  // Preenchido pelo preco_por_bairro sempre que fala preço de um bairro coberto:
  // a imagem da tabela (mesma fonte que o agente cota) pra mandar como mídia no
  // WhatsApp e pré-visualizar no playground. Ver webhook do WhatsApp.
  priceImagesOut?: { url: string; label: string }[];
  // Preenchido pelo finalizar_pedido: a chave PIX e o favorecido corretos. O
  // código ANEXA isso ao fim da resposta (chatWithAgent) — a IA não escreve a
  // chave, pra nunca inventar/mascarar/errar a chave (dinheiro do cliente).
  pixOut?: { chave: string; nome: string } | null;
  // Acumula os campos do pedido confirmados NESTE turno (via
  // atualizar_dados_pedido, preco_por_bairro ou finalizar_pedido). chatWithAgent
  // funde isso no rascunho persistido (ver OrderDraft) depois do loop.
  draftPatch?: OrderDraft;
  // CPF já coletado em turnos anteriores (do rascunho persistido) OU do cadastro
  // do cliente — usado pra travar o fechamento sem CPF sem criar loop.
  docSoFar?: string;
  // Nome REAL já cadastrado (não o placeholder "Cliente <telefone>" nem o
  // pushName do WhatsApp) — usado pra travar o fechamento sem nome sem criar
  // loop com quem já tem nome de verdade de um pedido anterior.
  realNameSoFar?: string;
  // Rascunho ACUMULADO do pedido (turnos anteriores). No fechamento, o handler
  // completa os campos que a IA esqueceu de repassar (chopeira, escada, forma de
  // pagamento, nome) — a IA muitas vezes pergunta mas não reenvia no finalizar.
  draftSoFar?: OrderDraft;
  // Marcado pelo finalizar_pedido quando o pedido fecha com sucesso — sinaliza
  // pra chatWithAgent limpar o rascunho desta sessão (pedido concluído).
  orderClosed?: boolean;
};

// Base pública do próprio KegControl (onde a imagem da tabela é servida). Em
// produção é a URL do Render; em dev, localhost:3020 (o navegador do playground
// alcança; o Evolution remoto não — mesma limitação do webhook em dev).
const APP_BASE = process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3020";

// URL da imagem da tabela de preços para uma localidade coberta. Os preços saem
// da MESMA fonte que o agente cota (getSitePricing/effectiveProductsForCity via
// a rota /api/tabela-precos), então a imagem nunca descola do que o Lucas fala.
function priceTableImageUrl(companyId: string, zona: { bairro: string; city: string }): {
  url: string;
  label: string;
} {
  const qs = new URLSearchParams({
    cidade: zona.city,
    bairro: zona.bairro,
    company: companyId,
  });
  return {
    url: `${APP_BASE}/api/tabela-precos?${qs.toString()}`,
    label: `Tabela de preços · ${zona.bairro} · frete grátis`,
  };
}

// Fechamento fixo colado depois da tabela de preços montada em código.
const PRICE_TABLE_CLOSING = "É só me falar qual chopp e a litragem que eu já monto seu pedido! 🍺";

async function runTool(
  companyId: string,
  rawName: string,
  input: Record<string, unknown>,
  ctx: ToolCtx = {},
): Promise<string> {
  // O Gemini às vezes devolve o nome da ferramenta ligeiramente diferente do
  // declarado (ex.: "update_dados_pedido" em vez de "atualizar_dados_pedido").
  // Como esta ferramenta é a rede de segurança contra o agente "esquecer" um
  // dado do pedido, é tolerante ao nome: qualquer coisa que pareça essa
  // ferramenta ainda grava no rascunho, em vez de cair silenciosamente em
  // "ferramenta desconhecida" e perder o reforço.
  const name =
    rawName !== "atualizar_dados_pedido" && /dados.?do.?pedido|dados_pedido|pedido.?parcial/i.test(rawName)
      ? "atualizar_dados_pedido"
      : rawName;
  if (name !== rawName) {
    Sentry.captureMessage("Gemini chamou atualizar_dados_pedido com nome diferente do declarado", {
      level: "info",
      tags: { companyId },
      extra: { rawName },
    });
  }
  switch (name) {
    case "buscar_cliente": {
      const termo = String(input.termo ?? "");
      // Se o termo parece um telefone, casa por chave canônica (tolera DDI/9º
      // dígito/máscara) — buscar por "contains" falharia entre formatos diferentes.
      const digits = termo.replace(/\D/g, "");
      if (digits.length >= 8) {
        const key = phoneMatchKey(termo);
        const withPhone = await prisma.customer.findMany({
          where: { companyId, OR: [{ whatsapp: { not: null } }, { phone: { not: null } }] },
          select: { id: true, name: true, companyName: true, contactName: true, neighborhood: true, city: true, status: true, whatsapp: true, phone: true },
        });
        const matches = withPhone.filter(
          (c) => phoneMatchKey(c.whatsapp) === key || phoneMatchKey(c.phone) === key,
        );
        if (matches.length) return JSON.stringify(matches.slice(0, 5));
      }
      const customers = await prisma.customer.findMany({
        where: {
          companyId,
          OR: [
            // insensitive: o cadastro costuma estar em CAIXA ALTA e o cliente
            // digita em caixa mista — sem isto a busca por nome não casa.
            { name: { contains: termo, mode: "insensitive" } },
            { companyName: { contains: termo, mode: "insensitive" } },
            { contactName: { contains: termo, mode: "insensitive" } },
            { whatsapp: { contains: termo } },
            { phone: { contains: termo } },
            { city: { contains: termo, mode: "insensitive" } },
          ],
        },
        take: 5,
        select: { id: true, name: true, companyName: true, contactName: true, neighborhood: true, city: true, status: true, whatsapp: true },
      });
      return JSON.stringify(customers.length ? customers : "Nenhum cliente encontrado");
    }
    case "situacao_cliente": {
      const customerId = String(input.customerId ?? "");
      const insights = await getCustomerInsights(companyId);
      const insight = insights.find((i) => i.customerId === customerId);
      if (!insight) return "Cliente não encontrado";
      const balance = await getCustomerBalance(companyId, customerId);
      return JSON.stringify({
        nome: insight.name,
        status: insight.status,
        segmento: SEGMENT_LABELS[insight.segment],
        barrisComCliente: balance.rows.map((r) => ({
          tipo: r.kegType.name,
          categoria: r.kegType.category === "CHOPEIRA" ? "chopeira" : "barril",
          cheios: r.full,
          vazios: r.empty,
        })),
        totalBarris: balance.barrilTotals.total,
        totalChopeiras: balance.chopeiraTotals.total,
        diasDesdeUltimaMovimentacao: insight.daysSinceLastMovement,
        ritmoMedioDias: insight.avgIntervalDays,
        totalMovimentacoes: insight.movementCount,
      });
    }
    case "extrato_cliente": {
      const customerId = String(input.customerId ?? "");
      const limite = Number(input.limite ?? 5);
      const statement = await getCustomerStatement(companyId, customerId);
      return JSON.stringify(
        statement.rows.slice(-limite).map((r) => ({
          data: r.movement.occurredAt,
          tipo: r.movement.type,
          variacao: r.delta,
          saldoApos: r.balance,
        })),
      );
    }
    case "estoque_disponivel": {
      // Baseia-se no catálogo do SITE (fonte única — mesma da aba "Preços do
      // Site") e trata tudo como disponível. (Não consulta o estoque físico
      // do kegcontrol de propósito.)
      const pricing = await getSitePricing(companyId);
      return JSON.stringify(
        pricing.products.map((p) => {
          const t = tierTextFor(p);
          return t
            ? { tipo: p.name, disponivel: true, precoPorQuantidade: t }
            : { tipo: p.name, disponivel: true, preco: fromPriceFor(p) };
        }),
      );
    }
    case "clientes_para_reativar": {
      const insights = await getCustomerInsights(companyId);
      return JSON.stringify(
        insights
          .filter((i) => i.segment === "EM_RISCO" || i.segment === "INATIVO")
          .map((i) => ({
            id: i.customerId,
            nome: i.name,
            segmento: SEGMENT_LABELS[i.segment],
            diasParado: i.daysSinceLastMovement,
            barrisParadosComEle: i.kegsHeld,
            whatsapp: i.whatsapp,
          })),
      );
    }
    case "preco_por_bairro": {
      // Liberado para todos os canais (inclusive WhatsApp): o agente informa o
      // preço fixo por bairro conforme a fonte única (aba "Preços do Site").
      const bairro = String(input.bairro ?? "");
      const pricing = await getSitePricing(companyId);
      const zona = findCoveredBairro(pricing, bairro);
      if (!zona) {
        return JSON.stringify({
          coberto: false,
          mensagem: "Bairro fora da área de preço fixo. Não informe valores — diga que a equipe comercial confirma.",
        });
      }
      // Catálogo da região (override, se houver), tudo disponível. Produtos
      // com preço escalonado por quantidade (ex.: Brahma) vêm com as faixas.
      const products = effectiveProductsForCity(pricing, zona.city);

      // MODO TABELA COMPLETA: o cliente pediu a lista de vários produtos. SÓ aqui
      // a IMAGEM da tabela é anexada (webhook manda como mídia; playground
      // pré-visualiza). No modo produto único NÃO manda imagem — evita repetir a
      // tabela toda hora: o cliente recebe a tabela UMA vez e a conversa segue em texto.
      if (input.tabela_completa) {
        if (ctx.priceImagesOut) {
          const img = priceTableImageUrl(companyId, zona);
          if (!ctx.priceImagesOut.some((p) => p.url === img.url)) ctx.priceImagesOut.push(img);
        }
        if (ctx.priceTableOut !== undefined) {
          ctx.priceTableOut = fullPriceTableText(products);
        }
        return JSON.stringify({
          coberto: true,
          bairro: zona.bairro,
          cidade: zona.city,
          freteGratis: true,
          instrucao:
            "Os preços seguem em uma IMAGEM de tabela logo abaixo da sua mensagem — você NÃO deve escrever nenhum preço, nome de produto nem a tabela em texto. Escreva APENAS uma saudação curta de UMA linha, calorosa, citando o nome do cliente (se souber) e o bairro, terminando com algo como 'segue a tabela com frete grátis 👇'. NÃO faça pergunta e NÃO liste nada — só a saudação de abertura.",
        });
      }

      // MODO PRODUTO ÚNICO: sem imagem. Se veio produto+quantidade, o TOTAL é
      // calculado no SERVIDOR (o LLM erra a faixa se multiplicar de cabeça).
      let cotacao: { produto: string; quantidade: number; precoUnit: number; total: number } | null = null;
      if (input.produto) {
        const item = resolveProductByText(products, String(input.produto));
        if (item) {
          const qtd = Math.max(1, Math.floor(Number(input.quantidade ?? 1)));
          const precoUnit = unitPriceFor(item, qtd);
          cotacao = { produto: item.name, quantidade: qtd, precoUnit, total: precoUnit * qtd };
          // Reforço da memória de pedido: se o cliente já confirmou produto (e
          // quantidade, quando veio), grava de graça — sem depender de o LLM
          // lembrar de chamar atualizar_dados_pedido pra isto também.
          if (ctx.draftPatch) {
            ctx.draftPatch.produto = item.name;
            ctx.draftPatch.bairro = zona.bairro;
            if (input.quantidade !== undefined) ctx.draftPatch.quantidade = qtd;
          }
        }
      }
      return JSON.stringify({
        coberto: true,
        bairro: zona.bairro,
        cidade: zona.city,
        freteGratis: true,
        blocosDePreco: products.map((p) => ({ id: p.id, nome: p.name, bloco: priceBlockFor(p) })),
        cotacao,
        instrucao:
          "PROIBIDO recalcular, multiplicar ou inventar preço/total — use EXATAMENTE os números. Se veio 'cotacao', informe o total dela AO PÉ DA LETRA (ex.: '3 Belco 50L pra Xerém = R$1380 no total, com frete grátis'). Se não veio, o cliente perguntou de UM produto: responda em UMA frase natural o preço dele (as faixas do bloco daquele produto) e siga. NÃO despeje a lista de todos os produtos e NÃO mande imagem. Se não ficou claro qual produto, diga só as marcas (Belco, Brahma, Heineken, Amstel, Chopp de Vinho) e pergunte qual — sem preços.",
      });
    }
    case "atualizar_dados_pedido": {
      // Só acumula no patch do turno (ctx.draftPatch) — quem persiste é o
      // chatWithAgent, depois do loop. Aceita qualquer subconjunto de campos.
      if (ctx.draftPatch) {
        // Ignora "nome" que seja só o pushName do WhatsApp (a IA às vezes lê o
        // apelido no contexto e tenta gravá-lo como nome do cliente).
        if (typeof input.nome === "string" && input.nome.trim() && !nameIsJustPushName(input.nome, ctx.pushName))
          ctx.draftPatch.nome = input.nome.trim();
        if (typeof input.produto === "string" && input.produto.trim()) ctx.draftPatch.produto = input.produto.trim();
        if (input.quantidade !== undefined) {
          const qtd = Math.floor(Number(input.quantidade));
          if (qtd > 0) ctx.draftPatch.quantidade = qtd;
        }
        if (typeof input.bairro === "string" && input.bairro.trim()) ctx.draftPatch.bairro = input.bairro.trim();
        if (typeof input.entrega === "string" && input.entrega.trim()) ctx.draftPatch.entrega = input.entrega.trim();
        if (typeof input.endereco === "string" && input.endereco.trim()) ctx.draftPatch.endereco = input.endereco.trim();
        const chopeira = normalizeChopeira(input.tipo_chopeira);
        if (chopeira) ctx.draftPatch.chopeiraType = chopeira;
        const escada = normalizeEscada(input.escada);
        if (escada) ctx.draftPatch.hasStairs = escada;
        const doc = normalizeDocument(input.cpf);
        if (doc) ctx.draftPatch.document = doc;
        if (typeof input.forma_pagamento === "string" && input.forma_pagamento.trim()) {
          ctx.draftPatch.formaPagamento = input.forma_pagamento.trim();
        }
      }
      return JSON.stringify({ ok: true });
    }
    case "finalizar_pedido": {
      // Liberado em todos os canais (inclusive WhatsApp): fecha o pedido e envia
      // o PIX. A chave PIX vem do Setting (pix_key/pix_nome), com fallback de teste.
      const bairro = String(input.bairro ?? "");
      const pricing = await getSitePricing(companyId);
      const zona = findCoveredBairro(pricing, bairro);
      if (!zona) {
        return JSON.stringify({
          ok: false,
          motivo: "Bairro fora da área de entrega/preço fixo. Não feche o pedido nem envie PIX — diga que a equipe comercial confirma valores e disponibilidade.",
        });
      }
      const products = effectiveProductsForCity(pricing, zona.city);
      const rawItens = Array.isArray(input.itens) ? (input.itens as Array<Record<string, unknown>>) : [];
      const itens: Array<{ id: string; produto: string; quantidade: number; precoUnit: number; subtotal: number; economia: number }> = [];
      const naoReconhecidos: string[] = [];
      const fotosVistas = new Set<string>();
      const fotos: { url: string; label: string }[] = [];
      for (const it of rawItens) {
        const produtoTxt = String(it.produto ?? "");
        const qtd = Math.max(1, Number(it.quantidade ?? 1));
        const item = resolveProductByText(products, produtoTxt);
        if (!item) {
          naoReconhecidos.push(produtoTxt);
          continue;
        }
        // Preço unitário conforme a quantidade (aplica faixa escalonada, ex.: Brahma).
        // economia: quanto o cliente economizou no total vs. o preço de 1 unidade.
        const precoUnit = unitPriceFor(item, qtd);
        const economia = item.tiers ? Math.max(0, (item.tiers[0] - precoUnit) * qtd) : 0;
        itens.push({ id: item.id, produto: item.name, quantidade: qtd, precoUnit, subtotal: precoUnit * qtd, economia });
        const fotoUrl = photoUrlForProduct(item.id);
        if (fotoUrl && !fotosVistas.has(fotoUrl)) {
          fotosVistas.add(fotoUrl);
          fotos.push({ url: fotoUrl, label: item.name });
        }
      }
      if (itens.length === 0) {
        return JSON.stringify({
          ok: false,
          motivo: "Nenhum produto reconhecido na tabela de preço. Confirme com o cliente qual chope e a litragem antes de fechar.",
          naoReconhecidos,
        });
      }
      // CHECKLIST TRAVADA: não fecha sem CPF. Considera o CPF deste turno
      // (input.cpf), o do rascunho e o do cadastro (ctx.docSoFar). Sem nenhum,
      // devolve ok:false pedindo o CPF — impede pular essa etapa no fechamento.
      const cpfNoFechamento =
        normalizeDocument(input.cpf) || normalizeDocument(ctx.draftPatch?.document) || (ctx.docSoFar || "");
      if (!cpfNoFechamento) {
        return JSON.stringify({
          ok: false,
          motivo:
            "Ainda falta o CPF — não feche o pedido nem envie o PIX. Peça o CPF do cliente primeiro (é pra emitir a nota) e só então finalize.",
        });
      }
      // CHECKLIST TRAVADA: não fecha sem o NOME COMPLETO. O nome do WhatsApp
      // (pushName) NÃO conta — só vale o que o cliente disse (input.nome /
      // rascunho) ou um nome real já cadastrado (ctx.realNameSoFar). Sem isso,
      // pede o nome antes de fechar (o LLM às vezes pula a etapa "nome").
      // Aceita o nome do fechamento só se NÃO for o pushName do WhatsApp.
      const nomeInputRaw = typeof input.nome === "string" ? input.nome.trim() : "";
      const nomeInput = nomeInputRaw && !nameIsJustPushName(nomeInputRaw, ctx.pushName) ? nomeInputRaw : "";
      if (nomeInput && ctx.draftPatch) ctx.draftPatch.nome = nomeInput;
      const nomeNoFechamento =
        nomeInput ||
        ctx.draftPatch?.nome?.trim() ||
        ctx.draftSoFar?.nome?.trim() ||
        (ctx.realNameSoFar || "");
      if (!nomeNoFechamento) {
        return JSON.stringify({
          ok: false,
          motivo:
            "Ainda falta o NOME COMPLETO do cliente — não feche o pedido nem envie o PIX. Pergunte o nome completo (nome e sobrenome) e só então finalize. O nome de exibição do WhatsApp NÃO conta como nome do cliente.",
        });
      }
      // Pedido válido: sinaliza pro webhook mandar a(s) foto(s) do(s) barril(is)
      // pedido(s) depois da resposta em texto (ver chatWithAgent/runGeminiLoop).
      if (ctx.photosOut) ctx.photosOut.push(...fotos);
      const total = itens.reduce((s, i) => s + i.subtotal, 0);
      const economiaTotal = itens.reduce((s, i) => s + i.economia, 0);
      const deliveryMethod = /retirada/i.test(String(input.entrega ?? "")) ? "retirada" : "entrega";
      // Dados de qualificação (opcionais) que o cliente informou ao longo do
      // papo — mesmos campos que o formulário do site já coleta. Normalizados
      // aqui pra gravar certinho no pedido (equipe vê) e, no caso do CPF, no
      // cadastro do cliente (não pergunta de novo no próximo pedido).
      // A IA muitas vezes PERGUNTA esses dados mas NÃO os repassa no
      // finalizar_pedido — então completa a partir do rascunho acumulado
      // (ctx.draftSoFar). Sem isso, chopeira/escada/forma/nome sumiam do pedido.
      const draftSoFar = ctx.draftSoFar ?? {};
      const cpf = cpfNoFechamento || null;
      const chopeiraType = normalizeChopeira(input.tipo_chopeira) ?? draftSoFar.chopeiraType ?? null;
      const hasStairs = normalizeEscada(input.escada) ?? draftSoFar.hasStairs ?? null;
      const formaPagamento =
        typeof input.forma_pagamento === "string" && input.forma_pagamento.trim()
          ? input.forma_pagamento.trim()
          : draftSoFar.formaPagamento || "";
      const orderNotes = formaPagamento
        ? `Pagamento do restante (na entrega): ${formaPagamento}`
        : null;
      // Grava o pedido como fonte de verdade (origin AGENTE) — é o que permite
      // ao comprovante de PIX (casado por telefone, ver payment-proofs.ts) achar
      // este pedido e aparecer pra revisão em Pedidos do Site/Verificação.
      // Só quando veio de canal com número (WhatsApp) — no Playground não há
      // telefone real, então não grava (mesmo critério de salvar_cliente).
      if (ctx.phone) {
        await createAgentSiteOrder(companyId, {
          customerName: nomeNoFechamento, // travado acima — nunca vazio nem pushName
          phone: ctx.phone,
          deliveryMethod,
          neighborhood: zona.bairro,
          city: zona.city,
          street: input.endereco ? String(input.endereco) : null,
          eventDate: input.data_entrega ? String(input.data_entrega) : null,
          document: cpf,
          chopeiraType,
          hasStairs,
          notes: orderNotes,
          items: itens.map((i) => ({ id: i.id, name: i.produto, quantity: i.quantidade, unitPrice: i.precoUnit })),
          total,
        }).catch((e) => {
          console.error("[agent] createAgentSiteOrder falhou:", e);
          Sentry.captureException(e, { tags: { companyId, tool: "finalizar_pedido" } });
        });
        // CPF e NOME são dados de identidade estáveis: guarda no cadastro (o
        // nome só sobrescreve o placeholder "Cliente <telefone>") pra não
        // perguntar de novo em pedidos futuros. O nome vem do fechamento
        // (nomeNoFechamento), então nunca é o pushName do WhatsApp.
        if (cpf || nomeNoFechamento) {
          await upsertCustomerFromAgent(companyId, ctx.phone, {
            document: cpf ?? undefined,
            name: nomeNoFechamento || undefined,
          }).catch((e) => {
            console.error("[agent] salvar CPF/nome no cadastro falhou:", e);
          });
        }
      }
      // Reforço da memória de pedido: fechar o pedido é o momento em que mais
      // dados costumam estar confirmados — grava tudo no rascunho de graça
      // (defesa extra, mesmo que o LLM tenha esquecido de chamar
      // atualizar_dados_pedido ao longo da conversa).
      if (ctx.draftPatch) {
        ctx.draftPatch.bairro = zona.bairro;
        ctx.draftPatch.entrega = deliveryMethod;
        if (itens.length === 1) {
          ctx.draftPatch.produto = itens[0].produto;
          ctx.draftPatch.quantidade = itens[0].quantidade;
        }
        if (input.endereco) ctx.draftPatch.endereco = String(input.endereco);
        if (cpf) ctx.draftPatch.document = cpf;
        if (chopeiraType) ctx.draftPatch.chopeiraType = chopeiraType;
        if (hasStairs) ctx.draftPatch.hasStairs = hasStairs;
        if (formaPagamento) ctx.draftPatch.formaPagamento = formaPagamento;
      }
      ctx.orderClosed = true;
      // PIX real vem do Setting (pix_key/pix_nome). Enquanto não configurado,
      // usa um PIX de TESTE — seguro porque esta ferramenta só roda no
      // playground (channel === PLAYGROUND). Ao configurar o PIX real, ele assume.
      const pixKey = (await getSetting(companyId, "pix_key")) ?? "12.345.678/0001-95";
      const pixNome = (await getSetting(companyId, "pix_nome")) ?? "SS-CHOPP DISTRIBUIDORA (PIX DE TESTE)";
      // Blindagem do PIX: o CÓDIGO anexa a chave/favorecido corretos no fim da
      // resposta (ver chatWithAgent). A IA NÃO escreve a chave — assim é
      // impossível ela inventar/mascarar/errar (é dinheiro do cliente).
      if (ctx.pixOut !== undefined) ctx.pixOut = { chave: pixKey, nome: pixNome };
      return JSON.stringify({
        ok: true,
        bairro: zona.bairro,
        cidade: zona.city,
        entrega: deliveryMethod,
        endereco: input.endereco ? String(input.endereco) : null,
        itens: itens.map((i) => ({ produto: i.produto, quantidade: i.quantidade, precoUnit: i.precoUnit, subtotal: i.subtotal, economia: i.economia || undefined })),
        freteGratis: true,
        total,
        economiaTotal: economiaTotal > 0 ? economiaTotal : undefined,
        naoReconhecidos: naoReconhecidos.length ? naoReconhecidos : undefined,
        pagamento: {
          forma: "PIX",
          sinal: "50% agora, resto na entrega",
        },
        instrucao:
          "Apresente o resumo (itens, total, frete grátis, forma de entrega) e peça o sinal de 50% via PIX (o resto na entrega) e o comprovante. IMPORTANTE: NÃO escreva a chave PIX nem o favorecido — o sistema anexa a chave correta automaticamente logo abaixo da sua mensagem. NUNCA invente, mascare ou digite uma chave/banco. Avise que a equipe confirma o pedido assim que o pagamento cair. Você NÃO dá baixa no estoque — isso é a equipe que faz." +
          (economiaTotal > 0
            ? ` Diga também que ele ECONOMIZOU ${formatCurrency(economiaTotal)} comprando essa quantidade (comparado ao preço de 1 unidade) — celebre isso, é uma boa notícia pro cliente.`
            : ""),
      });
    }
    case "salvar_cliente": {
      // Cadastro/atualização espontânea (silenciosa). Só grava quando há um
      // número (WhatsApp) — no playground não há número, então não grava.
      if (!ctx.phone) {
        return JSON.stringify({
          ok: true,
          nota: "Sem número (modo teste) — nada gravado. Siga a conversa naturalmente.",
        });
      }
      // Também grava o NOME no rascunho do pedido (não só no cadastro): o
      // fechamento usa draft.nome pro customerName, e o bloco "JÁ CONFIRMADO"
      // passa a mostrar o nome (reforça o resumo). Assim, tanto faz a IA usar
      // salvar_cliente ou atualizar_dados_pedido pro nome — o rascunho pega.
      if (
        ctx.draftPatch &&
        typeof input.nome === "string" &&
        input.nome.trim() &&
        !nameIsJustPushName(input.nome, ctx.pushName)
      ) {
        ctx.draftPatch.nome = input.nome.trim();
      }
      const res = await upsertCustomerFromAgent(companyId, ctx.phone, {
        name: input.nome ? String(input.nome) : undefined,
        address: input.endereco ? String(input.endereco) : undefined,
        neighborhood: input.bairro ? String(input.bairro) : undefined,
        city: input.cidade ? String(input.cidade) : undefined,
        document: normalizeDocument(input.cpf) ?? undefined,
        usualOrder: input.pedido_costume ? String(input.pedido_costume) : undefined,
        pushName: ctx.pushName,
      });
      return JSON.stringify({
        ok: true,
        salvo: true,
        instrucao:
          "Informação guardada nos bastidores. NÃO comente que salvou/cadastrou nem que o cliente 'não tinha cadastro' — apenas continue a conversa de forma natural, como se já conhecesse o cliente.",
        _customerId: res.id,
      });
    }
    default:
      return `Ferramenta desconhecida: ${name}`;
  }
}

// ─── Identidade do interlocutor (quem manda mensagem) ──────────────────────

// Monta um bloco de contexto com quem é o cliente e sua situação atual, para o
// agente "conectar os pontos" já na primeira mensagem, sem pedir identificação.
// Nome-placeholder criado quando o agente cadastra um cliente sem saber o
// nome ainda (ver upsertCustomerFromAgent). Não é um nome de verdade.
const PLACEHOLDER_NAME = /^Cliente \+?\d+$/;

async function buildIdentityContext(
  companyId: string,
  customer: NonNullable<IdentifiedCustomer>,
  phone: string,
  pushName?: string,
): Promise<string> {
  const [balance, prices, record] = await Promise.all([
    getCustomerBalance(companyId, customer.id),
    getCustomerPrices(companyId, customer.id),
    prisma.customer.findUnique({
      where: { id: customer.id },
      select: { contactName: true, neighborhood: true, city: true, address: true, document: true, notes: true },
    }),
  ]);

  const contato = record?.contactName?.trim() || null;
  const cpfCadastrado = record?.document?.trim() || null;
  // "Pedido de costume" fica dentro de notes com o prefixo (ver customers.ts)
  const pedidoCostume =
    (record?.notes ?? "")
      .split("\n")
      .find((l) => l.trim().startsWith("Pedido de costume:"))
      ?.replace("Pedido de costume:", "")
      .trim() || null;

  const kegs =
    balance.rows
      .map((r) => `${r.kegType.name}: ${r.full} cheio(s), ${r.empty} vazio(s)`)
      .join("; ") || "nenhum barril no momento";
  const priced = prices.filter((p) => p.price > 0);
  const priceLines = priced.length
    ? priced.map((p) => `${p.name} (${p.code}) = ${formatCurrency(p.price)}`).join("; ")
    : "";
  const statusLabel = CUSTOMER_STATUS_LABELS[customer.status as CustomerStatus] ?? customer.status;

  // O nome cadastrado pode ser um placeholder (ex.: "Cliente 5521999999999",
  // criado quando o agente ainda não sabia o nome de verdade). Nesse caso,
  // usa o nome de exibição do WhatsApp (pushName) pra chamar a pessoa —
  // NUNCA chame ninguém pelo número de telefone.
  const isPlaceholder = PLACEHOLDER_NAME.test(customer.name.trim());
  const displayName = isPlaceholder && pushName ? pushName : customer.name;

  // FICHA DE DADOS (não são ordens): o ESTILO e o FLUXO seguem a personalidade —
  // exatamente como no chat de treino. Aqui vão só os fatos que o agente pode
  // usar pra não re-perguntar o que já sabe. Curto de propósito: um bloco grande
  // de instruções competia com a "memória do pedido" e fazia o agente repetir
  // perguntas no WhatsApp (ao contrário do chat, que não tem este bloco).
  const nomeLinha = isPlaceholder
    ? pushName
      ? `- Nome: ainda NÃO cadastrado. "${pushName}" é só o apelido do WhatsApp (pode usar pra saudar; nunca o chame pelo número). PERGUNTE o nome COMPLETO pra registrar o pedido e guarde com salvar_cliente — o nome do WhatsApp não conta como cadastro.`
      : `- Nome: ainda desconhecido — PERGUNTE o nome COMPLETO pra registrar o pedido. Nunca o chame pelo número.`
    : `- Nome: ${displayName}`;

  return [
    "DADOS DO CLIENTE (já cadastrado — use estes fatos; o estilo e o fluxo seguem sua personalidade normal, igual ao treino):",
    nomeLinha,
    contato ? `- Responsável: ${contato}` : "",
    "- Local de entrega: SEMPRE pergunte o BAIRRO, a CIDADE e o ENDEREÇO desta entrega. NÃO reutilize bairro/cidade/endereço do cadastro nem de pedido anterior — o mesmo cliente pede chopp pra lugares diferentes a cada pedido. Use no preco_por_bairro/finalizar_pedido só o bairro que ele informar NESTA conversa.",
    cpfCadastrado
      ? `- CPF/CNPJ: ${cpfCadastrado} (já cadastrado — NÃO peça de novo; use no finalizar_pedido)`
      : "",
    pedidoCostume ? `- Costuma pedir: ${pedidoCostume}` : "",
    `- customerId: ${customer.id} (use em situacao_cliente/extrato_cliente; não chame buscar_cliente pra ele)`,
    `- Barris com ele agora: ${kegs}`,
    priced.length ? `- Preços NEGOCIADOS dele (prioridade sobre a tabela): ${priceLines}` : "",
    `- Status: ${statusLabel}`,
    customer.status === "BLOCKED"
      ? "- ATENÇÃO: cliente BLOQUEADO — não prometa entrega; oriente o financeiro."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUnknownContext(_phone: string, pushName?: string): string {
  // Ficha enxuta (o cadastro silencioso e o "trate como cliente normal" já
  // vivem nas regras cruciais; o estilo/fluxo seguem a personalidade, igual ao
  // chat de treino). Aqui só o dado do nome, quando houver.
  return [
    "DADOS DO CLIENTE (primeiro contato — o estilo e o fluxo seguem sua personalidade normal, igual ao treino):",
    pushName
      ? `- Nome: ainda NÃO cadastrado. "${pushName}" é só o apelido do WhatsApp (pode saudar assim; nunca pelo número). PERGUNTE o nome COMPLETO pra registrar o pedido — o nome do WhatsApp não conta como cadastro.`
      : `- Nome: ainda desconhecido — PERGUNTE o nome COMPLETO pra registrar o pedido. Nunca o chame pelo número.`,
  ].join("\n");
}

// ─── Loop do agente (Gemini + tools) ───────────────────────────────────────

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatOptions = {
  identifiedCustomer?: IdentifiedCustomer;
  phone?: string; // número do WhatsApp do interlocutor (quando via WhatsApp)
  channel?: string; // PLAYGROUND | WHATSAPP
  pushName?: string; // nome de exibição do perfil do WhatsApp (Evolution: data.pushName)
};

// Sinal de reset: uma destas frases zera o histórico da conversa e o agente
// volta a atender como se fosse a primeira mensagem. Tolera acento, caixa e
// pontuação ("Começe novamente!", "COMECE DE NOVO", etc.).
const RESET_PHRASES = new Set([
  "comece de novo",
  "comece novamente",
  "comecar de novo",
  "comecar novamente",
  "comecemos de novo",
  "recomecar",
  "recomece",
  "recomeca",
  "zerar conversa",
  "limpar conversa",
  "limpar historico",
  "zerar historico",
]);
export function isResetSignal(text: string): boolean {
  const n = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return RESET_PHRASES.has(n);
}

// Linha que parece uma chave/dado de pagamento escrito pela IA (CNPJ, CPF,
// mascaramento com ***, ou rótulos "Banco:/Chave:/Favorecido:" etc.).
const PIX_KEY_LINE =
  /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}|\*{3,}|^\s*(banco|ag[êe]ncia|conta|chave( pix)?|favorecido|cnpj|cpf|nome do? favorecido)\s*:/i;

// Linha-PONTEIRO do PIX ("a chave PIX vem na próxima mensagem…"): o código anexa
// UMA sozinho. Se a IA (ou uma correção ensinada pelo dono) também escrever uma,
// duplicaria — então a gente remove qualquer ponteiro do texto antes de anexar.
const PIX_POINTER_LINE =
  /(chave (do )?pix).*(pr[óo]xima mensagem|copiar e colar)|vem na pr[óo]xima mensagem/i;

// Blindagem do PIX (dinheiro do cliente): remove qualquer chave/dado de
// pagamento que a IA tenha escrito (às vezes inventa/mascara/erra) e o ponteiro
// duplicado; quando há pixInfo, anexa a chave CORRETA do sistema. Idempotente.
export function shieldPix(
  reply: string,
  pixInfo: { chave: string; nome: string } | null,
): string {
  const temRepetida = (() => {
    const ls = reply.split("\n").map((l) => l.trim());
    return ls.some((l, i) => l && l === ls[i - 1]);
  })();
  if (!pixInfo && !PIX_KEY_LINE.test(reply) && !PIX_POINTER_LINE.test(reply) && !temRepetida) {
    return reply;
  }
  const filtradas = reply
    .split("\n")
    .filter((l) => !PIX_KEY_LINE.test(l) && !PIX_POINTER_LINE.test(l));
  const limpo = filtradas
    // Colapsa linhas IGUAIS coladas (a IA às vezes repete o fechamento/pergunta).
    .filter((l, i) => {
      const t = l.trim();
      return !t || t !== filtradas[i - 1]?.trim();
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return pixInfo
    ? `${limpo}\n\n💳 Chave PIX (sinal de 50%): ${pixInfo.chave}\nFavorecido: ${pixInfo.nome}`
    : limpo;
}

export async function chatWithAgent(
  companyId: string,
  sessionId: string,
  history: ChatTurn[],
  opts: ChatOptions = {},
): Promise<{
  reply: string;
  toolsUsed: string[];
  simulated: boolean;
  // Fotos de barril a enviar como mídia depois do texto (preenchido quando o
  // pedido fecha via finalizar_pedido — ver webhook do WhatsApp).
  photos: { url: string; label: string }[];
  // Imagem(ns) da tabela de preços a enviar como mídia depois do texto
  // (preenchido quando o cliente pergunta preço de um bairro coberto).
  priceImages: { url: string; label: string }[];
  // Tabela de preços montada em TEXTO (código), para o webhook usar como
  // fallback se o envio da IMAGEM falhar — assim o cliente nunca fica com a
  // saudação "segue a tabela 👇" apontando para nada. "" quando não se aplica.
  priceTableText: string;
  // Chave PIX a enviar numa MENSAGEM SEPARADA (só o número), pra o cliente
  // copiar e colar limpo no banco. null quando o turno não pede PIX. O texto
  // (reply) só traz um ponteiro "a chave vem na próxima mensagem 👇".
  pix: { chave: string; nome: string } | null;
}> {
  const config = await getAgentConfig(companyId);
  const userMessage = history.at(-1);
  const channel = opts.channel ?? "PLAYGROUND";
  const customerId = opts.identifiedCustomer?.id ?? null;

  // "comece de novo" → zera o histórico salvo desta conversa e responde com a
  // saudação, como se fosse o primeiro contato. Deixa o teste "sincero" (sem o
  // agente lembrar das mensagens anteriores).
  if (userMessage && isResetSignal(userMessage.content)) {
    await prisma.agentMessage.deleteMany({ where: { companyId, sessionId } });
    // Zera também o rascunho do pedido (memória em código) — recomeçar não
    // pode deixar "produto: Belco 30L" grudado pro próximo teste.
    await saveOrderDraft(companyId, sessionId, {});
    // Limpeza PROFUNDA só para números TREINADORES (teste): além do histórico,
    // esquece o perfil aprendido do contato (nome, endereço, bairro, CPF, notas)
    // pra o agente voltar a tratá-lo como estranho e fazer TODAS as perguntas do
    // zero — inclusive CPF, escada, tipo de chopeira e forma de pagamento. Para
    // cliente comum NÃO mexe no cadastro (só o histórico é zerado): "recomeçar"
    // dele jamais apaga o cadastro real.
    if (opts.phone && (await isTrainerNumber(companyId, opts.phone))) {
      await wipeAgentLearnedProfile(companyId, opts.phone).catch((e) => {
        console.error("[agent] wipeAgentLearnedProfile falhou:", e);
      });
    }
    const greeting =
      config.greeting?.trim() || "Oi! 🍺 Aqui é o atendimento da SS-Chopp. Como posso ajudar?";
    return { reply: greeting, toolsUsed: [], simulated: false, photos: [], priceImages: [], priceTableText: "", pix: null };
  }

  // Contexto de identidade (só quando veio de um canal com número, ex.: WhatsApp).
  let contextBlock = "";
  if (opts.phone) {
    contextBlock = opts.identifiedCustomer
      ? await buildIdentityContext(companyId, opts.identifiedCustomer, opts.phone, opts.pushName)
      : buildUnknownContext(opts.phone, opts.pushName);
  }
  // Rascunho do pedido em código (ver OrderDraft): carregado ANTES de chamar o
  // Gemini, então reflete só o que foi confirmado em turnos ANTERIORES — o
  // bloco derivado dele reforça, em código, o que o prompt já pede em texto
  // ("não pergunte de novo"), sem depender do LLM reconstruir da conversa.
  const orderDraftBefore = await getOrderDraft(companyId, sessionId);
  const orderDraftBlock = renderOrderDraftBlock(orderDraftBefore);
  // Roteiro de perguntas editável pelo dono (aba Agente). Só entra no prompt se
  // ele TIVER SALVO um roteiro — aí vira a fonte das perguntas. Sem roteiro
  // salvo, o `fluxo` da personalidade (já em config.personality) é a única base.
  const savedFlow = await getSavedFlowQuestions(companyId);
  const flowBlock = savedFlow ? renderFlowQuestions(savedFlow) : "";
  // Exemplos de comportamento que o dono ensinou corrigindo respostas na aba
  // Conversas — norte de tom/postura, não regra literal.
  const styleExamples = await getStyleExamples(companyId);
  const examplesBlock = styleExamples.length ? renderStyleExamples(styleExamples) : "";
  const escadaGate = renderEscadaGate(orderDraftBefore);
  const systemInstruction = [config.personality, flowBlock, examplesBlock, NATURAL_CUSTOMER_RULES, orderDraftBlock, escadaGate, contextBlock]
    .filter(Boolean)
    .join("\n\n---\n");

  if (userMessage) {
    await prisma.agentMessage.create({
      data: {
        companyId,
        sessionId,
        role: "user",
        content: userMessage.content,
        customerId,
        channel,
      },
    });
  }

  let reply: string;
  let toolsUsed: string[] = [];
  let simulated = false;
  let photos: { url: string; label: string }[] = [];
  let priceImages: { url: string; label: string }[] = [];
  let priceTableText = "";
  let pixOut: { chave: string; nome: string } | null = null;

  if (process.env.GEMINI_API_KEY) {
    // Nome "de verdade" pra gravar o pedido (finalizar_pedido): o do cadastro,
    // se não for o placeholder "Cliente <telefone>" — senão o pushName do
    // WhatsApp. Mesma regra de exibição usada em buildIdentityContext.
    const rawName = opts.identifiedCustomer?.name?.trim();
    const customerName =
      rawName && !PLACEHOLDER_NAME.test(rawName) ? rawName : opts.pushName;
    // Nome REAL já cadastrado (exclui placeholder E pushName) — pra travar o
    // fechamento sem nome sem re-perguntar quem já tem nome de verdade.
    const realNameSoFar = rawName && !PLACEHOLDER_NAME.test(rawName) ? rawName : "";
    const result = await runGeminiLoop(companyId, systemInstruction, history, {
      channel,
      phone: opts.phone,
      customerId,
      pushName: opts.pushName,
      customerName,
      // CPF já coletado antes (rascunho) — pra travar o fechamento sem CPF.
      docSoFar: orderDraftBefore.document || "",
      realNameSoFar,
      // Rascunho acumulado — pro fechamento completar chopeira/escada/forma/nome
      // quando a IA não repassa no finalizar_pedido.
      draftSoFar: orderDraftBefore,
    });
    reply = result.reply;
    toolsUsed = result.toolsUsed;
    photos = result.photos;
    priceImages = result.priceImages;
    priceTableText = result.priceTable;
    // Persiste o rascunho do pedido: pedido fechado (finalizar_pedido) limpa
    // (evita vazar produto/quantidade do pedido concluído pro próximo, na
    // mesma sessão); senão, funde o que foi confirmado neste turno por cima
    // do que já tinha.
    await saveOrderDraft(
      companyId,
      sessionId,
      result.orderClosed ? {} : mergeOrderDraft(orderDraftBefore, result.draftPatch),
    );
    // Tabela de preços pedida: em qualquer caso, corto a resposta do LLM para a
    // PRIMEIRA linha não-vazia (a saudação) e descarto o resto — se ele inventar
    // preços por conta própria, isso é jogado fora. Os preços "de verdade" vêm
    // da IMAGEM (mesma fonte que o agente cota). Só quando NÃO há imagem pra
    // enviar (fallback) é que colo a tabela em TEXTO montada em código.
    if (result.priceTable) {
      const intro =
        reply.split("\n").map((l) => l.trim()).find(Boolean) ||
        "Beleza! Segue a tabela com frete grátis 👇";
      reply =
        priceImages.length > 0
          ? intro
          : `${intro}\n\n${result.priceTable}\n\n${PRICE_TABLE_CLOSING}`;
    }
    // Blindagem do PIX (é dinheiro do cliente): a IA às vezes inventa, mascara ou
    // erra a chave/banco mesmo instruída a não escrever. O código REMOVE qualquer
    // linha que pareça chave/dado de pagamento escrito pela IA e anexa a chave
    // CORRETA do sistema. A chave vem SÓ do finalizar_pedido (result.pix) — assim
    // o PIX só sai NO FINAL, quando o pedido é realmente fechado. (Antes um
    // fallback disparava o PIX sempre que o texto citava "sinal de 50%", o que
    // fazia a chave aparecer no meio da conversa.)
    const pixInfo = result.pix;
    // Primeiro LIMPA qualquer chave/dado de pagamento que a IA tenha escrito
    // (nunca deixa sair chave inventada/mascarada). NÃO embute a chave no texto:
    // ela vai numa MENSAGEM SEPARADA, só o número, pra o cliente copiar e colar
    // no banco sem pegar texto junto (o webhook envia `pix.chave` sozinha). Aqui
    // fica só um ponteiro curto.
    reply = shieldPix(reply, null);
    if (pixInfo) {
      pixOut = pixInfo;
      reply = `${reply}\n\n💳 A chave PIX (favorecido ${pixInfo.nome}) vem na próxima mensagem — é só copiar e colar no seu banco 👇`;
    }
  } else {
    // Sem chave da API: modo simulado — usa as MESMAS ferramentas com um
    // roteador simples, para treinar fluxos e validar dados sem custo.
    // (finalizar_pedido não roda no modo simulado, então não há fotos aqui.)
    simulated = true;
    const result = await simulatedReply(
      companyId,
      history.at(-1)?.content ?? "",
      opts.identifiedCustomer,
    );
    reply = result.reply;
    toolsUsed = result.toolsUsed;
  }

  await prisma.agentMessage.create({
    data: { companyId, sessionId, role: "assistant", content: reply, customerId, channel },
  });

  return { reply, toolsUsed, simulated, photos, priceImages, priceTableText, pix: pixOut };
}

// Detecta quando o Gemini VAZA o raciocínio/planejamento como se fosse a
// resposta (acontece às vezes logo depois de uma ferramenta): o texto vem com
// rótulos tipo "SPECIAL INSTRUCTION", frases de análise em inglês ("the user
// wants", "my next step") ou citando o próprio system prompt. O cliente jamais
// pode ver isso — quando detectado, o loop cutuca uma resposta final curta (ver
// runGeminiLoop). Conservador de propósito: a resposta normal é PT curto, então
// esses marcadores em inglês/rótulo não aparecem por acaso.
const REASONING_LEAK = [
  /special instruction/i,
  /\bthe user (wants|is|said|asked|provided|mentioned)\b/i,
  /\bmy next step\b/i,
  /\bi (need|should|will|have) to\b/i,
  /\baccording to the\b/i,
  /\bthe model'?s tone\b/i,
  /\bi need to (construct|ask|inform|respond|call)\b/i,
  /\bfunction(_| )?call\b/i,
  /\bsystem ?(prompt|instruction)\b/i,
];
export function looksLikeReasoningLeak(text: string): boolean {
  return REASONING_LEAK.some((re) => re.test(text));
}

async function runGeminiLoop(
  companyId: string,
  systemInstruction: string,
  history: ChatTurn[],
  ctx: ToolCtx,
): Promise<{
  reply: string;
  toolsUsed: string[];
  photos: { url: string; label: string }[];
  priceTable: string;
  priceImages: { url: string; label: string }[];
  pix: { chave: string; nome: string } | null;
  draftPatch: OrderDraft;
  orderClosed: boolean;
}> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const toolsUsed: string[] = [];
  // Mesma referência exposta em ctx: finalizar_pedido (dentro de runTool) empurra
  // aqui quando o pedido fecha. Local, não `ctx.photosOut`, para o TS saber que
  // nunca é undefined nos returns abaixo.
  const photosOut: { url: string; label: string }[] = [];
  ctx.photosOut = photosOut;
  // Idem para a imagem da tabela: preco_por_bairro empurra aqui a URL da imagem
  // (mesma referência, para o TS saber que nunca é undefined nos returns).
  const priceImagesOut: { url: string; label: string }[] = [];
  ctx.priceImagesOut = priceImagesOut;
  // Idem para a tabela de preços: preco_por_bairro (modo tabela_completa)
  // grava aqui a tabela pronta. "" = nenhuma tabela pra colar nesta resposta.
  ctx.priceTableOut = "";
  // finalizar_pedido grava aqui a chave PIX correta; o código a anexa à resposta.
  ctx.pixOut = null;
  // Rascunho do pedido (memória em código): atualizar_dados_pedido,
  // preco_por_bairro e finalizar_pedido acumulam aqui os campos confirmados
  // NESTE turno; chatWithAgent funde no rascunho persistido depois do loop.
  const draftPatch: OrderDraft = {};
  ctx.draftPatch = draftPatch;
  ctx.orderClosed = false;
  const contents: Content[] = history.map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: [{ text: t.content }],
  }));

  for (let i = 0; i < 6; i++) {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: TOOLS }],
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
        },
        // Thinking LIGADO: mantém a coerência da conversa — sem ele o modelo
        // re-pergunta o que já foi dito e repete a lista de preços. Subido de
        // 1024 pra 2048: com prompt grande (tabela de preços inteira) o
        // modelo às vezes trocava um número na cópia com o budget menor.
        // O retorno vazio ("(sem resposta)") é tratado pelo retry abaixo.
        // A objetividade fica por conta da personalidade (regra "seja direto").
        thinkingConfig: { thinkingBudget: 2048 },
      },
    });

    const calls = response.functionCalls;
    if (!calls || calls.length === 0) {
      const text = (response.text ?? "").trim();
      // Só devolve se for uma resposta de verdade (não o raciocínio vazado). Se
      // vazou o "pensamento" (SPECIAL INSTRUCTION, análise em inglês...), trata
      // como vazio: cutuca uma resposta final curta — o cliente jamais vê isso.
      if (text && !looksLikeReasoningLeak(text)) {
        return { reply: text, toolsUsed, photos: photosOut, priceTable: ctx.priceTableOut ?? "", priceImages: priceImagesOut, pix: ctx.pixOut ?? null, draftPatch, orderClosed: ctx.orderClosed ?? false };
      }
      if (text && looksLikeReasoningLeak(text)) {
        Sentry.captureMessage("Gemini vazou raciocínio na resposta ao cliente", {
          level: "warning",
          tags: { companyId },
        });
      }
      // Modelo devolveu vazio (ou só o raciocínio): cutuca uma resposta curta
      // mais uma vez antes de desistir — o cliente NUNCA deve receber isso nem
      // "(sem resposta)".
      if (i < 5) {
        contents.push({
          role: "user",
          parts: [
            {
              text: "Responda ao cliente agora, em 1-2 frases curtas, em português — APENAS a mensagem final, sem nenhum raciocínio, análise ou texto em inglês.",
            },
          ],
        });
        continue;
      }
      return { reply: "Desculpa, pode repetir? 😊", toolsUsed, photos: photosOut, priceTable: ctx.priceTableOut ?? "", priceImages: priceImagesOut, pix: ctx.pixOut ?? null, draftPatch, orderClosed: ctx.orderClosed ?? false };
    }

    // Ecoa a resposta do modelo (com as chamadas de função) antes dos resultados.
    const modelParts: Part[] = calls.map((c) => ({
      functionCall: { name: c.name, args: c.args },
    }));
    contents.push({ role: "model", parts: modelParts });

    const resultParts: Part[] = [];
    for (const call of calls) {
      const name = call.name ?? "";
      toolsUsed.push(name);
      let output: string;
      try {
        output = await runTool(companyId, name, (call.args ?? {}) as Record<string, unknown>, ctx);
      } catch (e) {
        // Mantém a mensagem amigável pro cliente E reporta — falha de uma
        // ferramenta do agente em produção não pode ficar invisível.
        Sentry.captureException(e, { tags: { companyId, tool: name }, extra: { args: call.args } });
        output = `Erro ao consultar: ${e instanceof Error ? e.message : "desconhecido"}`;
      }
      resultParts.push({
        functionResponse: { name, response: { output } },
      });
    }
    contents.push({ role: "user", parts: resultParts });
  }
  return { reply: "Não consegui concluir a consulta agora. Pode repetir?", toolsUsed, photos: photosOut, priceTable: ctx.priceTableOut ?? "", priceImages: priceImagesOut, pix: ctx.pixOut ?? null, draftPatch, orderClosed: ctx.orderClosed ?? false };
}

// Modo simulado: sem LLM, mas com os dados reais — suficiente para treinar
// a operação e validar as ferramentas antes de configurar a GEMINI_API_KEY.
async function simulatedReply(
  companyId: string,
  text: string,
  identifiedCustomer?: IdentifiedCustomer,
): Promise<{ reply: string; toolsUsed: string[] }> {
  const lower = text.toLowerCase();

  // Se o número já foi reconhecido, o modo simulado também usa esse contexto:
  // responde citando a situação do cliente identificado (sem precisar buscar).
  if (identifiedCustomer && !/estoque|dispon[ií]vel|tem barril|inativ|sumid|reativa|parado/.test(lower)) {
    const sit = JSON.parse(
      await runTool(companyId, "situacao_cliente", { customerId: identifiedCustomer.id }),
    );
    if (sit && sit.nome) {
      return {
        reply:
          `[simulado] Oi, ${sit.nome}! Vi aqui que você tem ${sit.totalBarris} barril(is) com você ` +
          `(segmento ${sit.segmento}, última movimentação há ${sit.diasDesdeUltimaMovimentacao ?? "?"} dias). ` +
          `Como posso ajudar? 🍺`,
        toolsUsed: ["situacao_cliente"],
      };
    }
  }

  if (/estoque|dispon[ií]vel|tem barril/.test(lower)) {
    const data = JSON.parse(await runTool(companyId, "estoque_disponivel", {}));
    const lines = (data as Array<Record<string, unknown>>).map(
      (t) => `• ${t.tipo}: ${t.disponivelCheio} cheio(s), ${t.disponivelVazio} vazio(s)`,
    );
    return {
      reply: `[simulado] Estoque no depósito agora:\n${lines.join("\n")}`,
      toolsUsed: ["estoque_disponivel"],
    };
  }

  if (/inativ|sumid|reativa|parado/.test(lower)) {
    const data = JSON.parse(await runTool(companyId, "clientes_para_reativar", {}));
    const list = data as Array<Record<string, unknown>>;
    if (list.length === 0)
      return { reply: "[simulado] Nenhum cliente em risco ou inativo no momento. 🍺", toolsUsed: ["clientes_para_reativar"] };
    const lines = list.map(
      (c) => `• ${c.nome} (${c.segmento}) — ${c.diasParado ?? "?"} dias parado, ${c.barrisParadosComEle} barril(is) com ele`,
    );
    return {
      reply: `[simulado] Clientes para reativar:\n${lines.join("\n")}`,
      toolsUsed: ["clientes_para_reativar"],
    };
  }

  // tenta identificar um cliente citado na mensagem
  const search = JSON.parse(await runTool(companyId, "buscar_cliente", { termo: text.replace(/[?.!]/g, "").trim().split(/\s+/).slice(-3).join(" ") }));
  if (Array.isArray(search) && search.length > 0) {
    const c = search[0] as { id: string; name: string };
    const sit = JSON.parse(await runTool(companyId, "situacao_cliente", { customerId: c.id }));
    return {
      reply:
        `[simulado] ${sit.nome}: segmento ${sit.segmento}, ${sit.totalBarris} barril(is) com ele ` +
        `(última movimentação há ${sit.diasDesdeUltimaMovimentacao ?? "?"} dias, ritmo médio ${sit.ritmoMedioDias ?? "?"} dias).`,
      toolsUsed: ["buscar_cliente", "situacao_cliente"],
    };
  }

  return {
    reply:
      "[simulado] Modo de treino sem IA: configure a GEMINI_API_KEY no .env para ativar o agente completo. " +
      "Enquanto isso, pergunte sobre 'estoque', 'clientes inativos' ou cite o nome de um cliente.",
    toolsUsed: [],
  };
}
