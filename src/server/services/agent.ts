import { FunctionCallingConfigMode, GoogleGenAI, Type, type Content, type FunctionDeclaration, type Part } from "@google/genai";
import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TYPE_LABELS,
  MOVEMENT_TYPE_LABELS,
  type CustomerStatus,
  type CustomerType,
  type MovementType,
} from "@/lib/enums";
import { phoneMatchKey } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCustomerBalance, getCustomerPrices, upsertCustomerFromAgent } from "./customers";
import { getCustomerInsights, SEGMENT_LABELS } from "./crm";
import { getCustomerStatement } from "./reports";
import {
  getSitePricing,
  findCoveredBairro,
  effectiveProductsForCity,
  unitPriceFor,
  fromPriceFor,
  tierTextFor,
  resolveProductByText,
} from "./site-pricing";

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
const NATURAL_CUSTOMER_RULES = `# Cadastro natural (regras invioláveis)
- NUNCA diga que o cliente "não tem cadastro", "não está cadastrado", "não te encontrei aqui" ou algo do tipo. Trate TODO mundo como cliente conhecido, mesmo que seja o primeiro contato.
- NUNCA diga que está "cadastrando", "salvando", "atualizando o cadastro" ou "anotando seus dados". Isso é feito nos bastidores, de forma invisível — o cliente não vê.
- Conforme o cliente for te contando as coisas (o nome dele, o endereço, o bairro, ou o que ele quer/costuma pedir), use a ferramenta salvar_cliente para guardar — de forma silenciosa, sem comentar nada.
- Se você precisar de uma informação que ainda não tem (ex.: o endereço pra entrega), pergunte de forma leve e natural ("Me passa o endereço pra entrega?") e siga a conversa. Quando o cliente responder, guarde com salvar_cliente. Se ele já tiver endereço no cadastro, use-o e NÃO pergunte de novo.
- Os pilares que você vai montando aos poucos: nome do cliente, endereço, e o que ele costuma pedir (ex.: "Belco 50L, Heineken"). Salve cada um assim que souber.
- Nunca fique "perdido" por falta de informação: se faltar algo, pergunte com naturalidade uma coisa por vez e continue.

# Preço — sempre pelo site, por localidade (regra inviolável)
- O preço vem SEMPRE da ferramenta preco_por_bairro (preços do site, por bairro) — e do finalizar_pedido pra fechar. Com o bairro em mãos, DIGA o preço na hora.
- NUNCA diga que "a equipe comercial vai passar o preço" / "o comercial confirma" quando o bairro é coberto. Isso só vale se preco_por_bairro disser que o bairro está FORA da área de entrega.
- Se o cliente perguntar preço e você ainda não tem o bairro, peça SÓ o bairro e então responda o preço — não empurre pro comercial.`;

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
      "Consulta se um bairro está na área de preço fixo (Duque de Caxias, São João de Meriti e região) e retorna os preços de hoje por tipo de barril, com frete grátis. Use sempre que o cliente mencionar o bairro dele ou perguntar preço/entrega em uma região. Se o bairro não estiver coberto, a ferramenta avisa e você deve dizer que a equipe comercial confirma o valor — nunca invente preço para bairro fora da tabela.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        bairro: { type: Type.STRING, description: "Nome do bairro citado pelo cliente" },
      },
      required: ["bairro"],
    },
  },
  {
    name: "salvar_cliente",
    description:
      "Guarda/atualiza SILENCIOSAMENTE o cadastro do cliente com o que você descobriu na conversa (nome, endereço, bairro, cidade e o que ele costuma pedir). Chame de forma NATURAL e INVISÍVEL sempre que o cliente informar uma dessas coisas — por exemplo, ao dizer o endereço, o nome, ou o que quer/costuma pedir. Funciona para número novo (cria o cadastro) e para cliente já existente (completa só o que falta). NUNCA avise o cliente que está cadastrando/salvando — apenas siga a conversa normalmente. Não é preciso ter tudo de uma vez; salve o que tiver.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        nome: { type: Type.STRING, description: "Nome do cliente, se informado" },
        endereco: { type: Type.STRING, description: "Endereço (rua, número), se informado" },
        bairro: { type: Type.STRING, description: "Bairro, se informado" },
        cidade: { type: Type.STRING, description: "Cidade, se informada" },
        pedido_costume: {
          type: Type.STRING,
          description: "O que o cliente costuma pedir, ex.: 'Belco 50L, Heineken'",
        },
      },
    },
  },
  {
    name: "finalizar_pedido",
    description:
      "Fecha o pedido do cliente e retorna o resumo com total e a chave PIX para pagamento. Use SOMENTE quando o cliente já confirmou o que quer: o(s) produto(s), a quantidade, o bairro e se é entrega ou retirada (e o endereço, se for entrega). A ferramenta calcula o total pela tabela de preço fixo e devolve a chave PIX. Não use se ainda faltar alguma dessas informações.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        bairro: { type: Type.STRING, description: "Bairro do cliente (para preço e frete)" },
        entrega: { type: Type.STRING, description: "'entrega' ou 'retirada'" },
        endereco: { type: Type.STRING, description: "Endereço completo (só quando for entrega)" },
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

type ToolCtx = { channel?: string; phone?: string; customerId?: string | null };

async function runTool(
  companyId: string,
  name: string,
  input: Record<string, unknown>,
  ctx: ToolCtx = {},
): Promise<string> {
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
      const precos = products.map((p) => {
        const t = tierTextFor(p);
        return t
          ? {
              tipo: p.name,
              disponivel: true,
              precoPorQuantidade: t,
              obs: "PREÇO POR QUANTIDADE — quanto mais barris, mais barato cada. Explique as faixas ao cliente; o total sai no finalizar_pedido.",
            }
          : { tipo: p.name, preco: fromPriceFor(p), disponivel: true };
      });
      return JSON.stringify({
        coberto: true,
        bairro: zona.bairro,
        cidade: zona.city,
        freteGratis: true,
        precos,
      });
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
      const itens: Array<{ produto: string; quantidade: number; precoUnit: number; subtotal: number; economia: number }> = [];
      const naoReconhecidos: string[] = [];
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
        itens.push({ produto: item.name, quantidade: qtd, precoUnit, subtotal: precoUnit * qtd, economia });
      }
      if (itens.length === 0) {
        return JSON.stringify({
          ok: false,
          motivo: "Nenhum produto reconhecido na tabela de preço. Confirme com o cliente qual chope e a litragem antes de fechar.",
          naoReconhecidos,
        });
      }
      const total = itens.reduce((s, i) => s + i.subtotal, 0);
      const economiaTotal = itens.reduce((s, i) => s + i.economia, 0);
      // PIX real vem do Setting (pix_key/pix_nome). Enquanto não configurado,
      // usa um PIX de TESTE — seguro porque esta ferramenta só roda no
      // playground (channel === PLAYGROUND). Ao configurar o PIX real, ele assume.
      const pixKey = (await getSetting(companyId, "pix_key")) ?? "12.345.678/0001-95";
      const pixNome = (await getSetting(companyId, "pix_nome")) ?? "SS-CHOPP DISTRIBUIDORA (PIX DE TESTE)";
      return JSON.stringify({
        ok: true,
        bairro: zona.bairro,
        cidade: zona.city,
        entrega: String(input.entrega ?? ""),
        endereco: input.endereco ? String(input.endereco) : null,
        itens: itens.map((i) => ({ produto: i.produto, quantidade: i.quantidade, precoUnit: i.precoUnit, subtotal: i.subtotal, economia: i.economia || undefined })),
        freteGratis: true,
        total,
        economiaTotal: economiaTotal > 0 ? economiaTotal : undefined,
        naoReconhecidos: naoReconhecidos.length ? naoReconhecidos : undefined,
        pagamento: {
          forma: "PIX",
          chave: pixKey,
          favorecido: pixNome ?? undefined,
        },
        instrucao:
          "Apresente o resumo (itens, total, frete grátis, forma de entrega), envie a chave PIX e o favorecido, e peça para o cliente mandar o comprovante. Avise que a equipe confirma o pedido assim que o pagamento cair. Você NÃO dá baixa no estoque — isso é a equipe que faz." +
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
      const res = await upsertCustomerFromAgent(companyId, ctx.phone, {
        name: input.nome ? String(input.nome) : undefined,
        address: input.endereco ? String(input.endereco) : undefined,
        neighborhood: input.bairro ? String(input.bairro) : undefined,
        city: input.cidade ? String(input.cidade) : undefined,
        usualOrder: input.pedido_costume ? String(input.pedido_costume) : undefined,
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
async function buildIdentityContext(
  companyId: string,
  customer: NonNullable<IdentifiedCustomer>,
  phone: string,
): Promise<string> {
  const [balance, prices, lastMov, record] = await Promise.all([
    getCustomerBalance(companyId, customer.id),
    getCustomerPrices(companyId, customer.id),
    prisma.movement.findFirst({
      where: { companyId, customerId: customer.id },
      orderBy: { occurredAt: "desc" },
      select: { occurredAt: true, type: true },
    }),
    prisma.customer.findUnique({
      where: { id: customer.id },
      select: { contactName: true, neighborhood: true, city: true, address: true, notes: true },
    }),
  ]);

  const contato = record?.contactName?.trim() || null;
  const enderecoCadastrado = record?.address?.trim() || null;
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
    : "sem preço negociado próprio — use os PREÇOS DO SITE por localidade (preco_por_bairro com o bairro dele)";
  const lastMovTxt = lastMov
    ? `${MOVEMENT_TYPE_LABELS[lastMov.type as MovementType] ?? lastMov.type} em ${formatDate(lastMov.occurredAt)}`
    : "nenhuma movimentação registrada ainda";
  const statusLabel = CUSTOMER_STATUS_LABELS[customer.status as CustomerStatus] ?? customer.status;
  const typeLabel = CUSTOMER_TYPE_LABELS[customer.type as CustomerType] ?? customer.type;

  return [
    "CONTEXTO — CLIENTE IDENTIFICADO PELO NÚMERO DE WHATSAPP:",
    `Você está conversando com um cliente JÁ CADASTRADO. Cumprimente-o pelo nome logo na primeira resposta (siga a regra "# Cumprimento pelo nome") e não peça para ele se identificar de novo.`,
    `- Estabelecimento: ${customer.name}`,
    contato ? `- Responsável (contato): ${contato}` : "",
    record?.neighborhood ? `- Bairro do cliente: ${record.neighborhood}${record.city ? ` · ${record.city}` : ""} (se ele perguntar preço/entrega, já use preco_por_bairro com este bairro sem precisar perguntar de novo)` : "",
    enderecoCadastrado
      ? `- Endereço de entrega JÁ CADASTRADO: ${enderecoCadastrado}. Ele já é cliente e esse é o endereço dele — ao fechar o pedido (finalizar_pedido), use este endereço automaticamente e NÃO peça o endereço de novo. Só pergunte se ele mencionar que quer entregar em outro lugar.`
      : `- SEM endereço no cadastro ainda. Se ele pedir entrega, pergunte o endereço de forma natural ("Me passa o endereço pra entrega?") — NÃO fique procurando/travado, e NÃO diga que não achou o cadastro. Quando ele responder, guarde com salvar_cliente (silenciosamente) e siga.`,
    pedidoCostume
      ? `- Pedido de costume dele: ${pedidoCostume} (pode sugerir "o de sempre?" quando fizer sentido).`
      : `- Ainda não sabemos o que ele costuma pedir. Quando ele disser o que quer, guarde com salvar_cliente (pedido_costume).`,
    `- customerId: ${customer.id} (USE este id nas ferramentas situacao_cliente, extrato_cliente — não chame buscar_cliente para ele)`,
    `- WhatsApp: ${phone}`,
    `- Status: ${statusLabel} · Tipo: ${typeLabel}`,
    `- Itens em poder dele agora: ${kegs}`,
    `- Total de barris com ele: ${balance.barrilTotals.total} (${balance.barrilTotals.full} cheios, ${balance.barrilTotals.empty} vazios)`,
    `- Total de chopeiras com ele: ${balance.chopeiraTotals.total} (${balance.chopeiraTotals.full} cheia(s), ${balance.chopeiraTotals.empty} vazia(s))`,
    `- Última movimentação: ${lastMovTxt}`,
    `- Preços que ESTE cliente paga: ${priceLines}`,
    priced.length
      ? `Você PODE informar a este cliente os preços NEGOCIADOS listados acima (têm prioridade). Para os itens que ele NÃO tem preço negociado, use os PREÇOS DO SITE por localidade (preco_por_bairro com o bairro dele) — NÃO diga que o comercial confirma. Nunca invente valores.`
      : `Este cliente não tem preço negociado próprio. SEMPRE use os PREÇOS DO SITE por localidade (preco_por_bairro com o bairro dele) para responder preço. NUNCA diga que "a equipe comercial confirma o preço" quando o bairro está coberto — só defira ao comercial se o bairro estiver realmente FORA da área de entrega.`,
    customer.status === "BLOCKED"
      ? `- ATENÇÃO: cliente BLOQUEADO — não prometa entrega; oriente a procurar o financeiro.`
      : "",
    `Trate a conversa como continuação com ESTE cliente e conecte o histórico dele ao que ele pedir.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUnknownContext(phone: string): string {
  return [
    "CONTEXTO — PRIMEIRO CONTATO DESTE NÚMERO:",
    `WhatsApp: ${phone}. É provavelmente um contato novo — mas trate-o como cliente normal desde já. NUNCA diga que ele "não tem cadastro".`,
    "Se ele mencionar um nome ou empresa, você pode usar buscar_cliente para ver se já existe. Se não existir, tudo bem — apenas siga a conversa.",
    "Vá coletando os pilares de forma natural, uma coisa por vez, no ritmo da conversa: o NOME dele, o ENDEREÇO (quando for falar de entrega) e o que ele QUER/COSTUMA pedir (ex.: 'Belco 50L, Heineken').",
    "Assim que souber cada informação, guarde SILENCIOSAMENTE com salvar_cliente (o número já entra automático). NÃO anuncie que está cadastrando — aja como se já conhecesse a pessoa.",
  ].join("\n");
}

// ─── Loop do agente (Gemini + tools) ───────────────────────────────────────

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatOptions = {
  identifiedCustomer?: IdentifiedCustomer;
  phone?: string; // número do WhatsApp do interlocutor (quando via WhatsApp)
  channel?: string; // PLAYGROUND | WHATSAPP
};

// Sinal de reset: o cliente manda "comece de novo" e o agente zera o histórico
// da conversa, voltando a atender como se fosse a primeira mensagem. Tolera
// acento, caixa e pontuação ("Comece de novo!", "COMECE DE NOVO", etc.).
export function isResetSignal(text: string): boolean {
  const n = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return n === "comece de novo";
}

export async function chatWithAgent(
  companyId: string,
  sessionId: string,
  history: ChatTurn[],
  opts: ChatOptions = {},
): Promise<{ reply: string; toolsUsed: string[]; simulated: boolean }> {
  const config = await getAgentConfig(companyId);
  const userMessage = history.at(-1);
  const channel = opts.channel ?? "PLAYGROUND";
  const customerId = opts.identifiedCustomer?.id ?? null;

  // "comece de novo" → zera o histórico salvo desta conversa e responde com a
  // saudação, como se fosse o primeiro contato. Deixa o teste "sincero" (sem o
  // agente lembrar das mensagens anteriores).
  if (userMessage && isResetSignal(userMessage.content)) {
    await prisma.agentMessage.deleteMany({ where: { companyId, sessionId } });
    const greeting =
      config.greeting?.trim() || "Oi! 🍺 Aqui é o atendimento da SS-Chopp. Como posso ajudar?";
    return { reply: greeting, toolsUsed: [], simulated: false };
  }

  // Contexto de identidade (só quando veio de um canal com número, ex.: WhatsApp).
  let contextBlock = "";
  if (opts.phone) {
    contextBlock = opts.identifiedCustomer
      ? await buildIdentityContext(companyId, opts.identifiedCustomer, opts.phone)
      : buildUnknownContext(opts.phone);
  }
  const systemInstruction = [config.personality, NATURAL_CUSTOMER_RULES, contextBlock]
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

  if (process.env.GEMINI_API_KEY) {
    const result = await runGeminiLoop(companyId, systemInstruction, history, {
      channel,
      phone: opts.phone,
      customerId,
    });
    reply = result.reply;
    toolsUsed = result.toolsUsed;
  } else {
    // Sem chave da API: modo simulado — usa as MESMAS ferramentas com um
    // roteador simples, para treinar fluxos e validar dados sem custo.
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

  return { reply, toolsUsed, simulated };
}

async function runGeminiLoop(
  companyId: string,
  systemInstruction: string,
  history: ChatTurn[],
  ctx: ToolCtx,
): Promise<{ reply: string; toolsUsed: string[] }> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const toolsUsed: string[] = [];
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
        // Thinking LIGADO (budget modesto): mantém a coerência da conversa — sem
        // ele o modelo re-pergunta o que já foi dito e repete a lista de preços.
        // O retorno vazio ("(sem resposta)") é tratado pelo retry abaixo.
        // A objetividade fica por conta da personalidade (regra "seja direto").
        thinkingConfig: { thinkingBudget: 1024 },
      },
    });

    const calls = response.functionCalls;
    if (!calls || calls.length === 0) {
      const text = (response.text ?? "").trim();
      if (text) return { reply: text, toolsUsed };
      // Modelo devolveu vazio (acontece às vezes depois de uma ferramenta):
      // cutuca uma resposta curta mais uma vez antes de desistir — o cliente
      // NUNCA deve receber "(sem resposta)".
      if (i < 5) {
        contents.push({ role: "user", parts: [{ text: "Responda ao cliente agora, em 1-2 frases curtas." }] });
        continue;
      }
      return { reply: "Desculpa, pode repetir? 😊", toolsUsed };
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
        output = `Erro ao consultar: ${e instanceof Error ? e.message : "desconhecido"}`;
      }
      resultParts.push({
        functionResponse: { name, response: { output } },
      });
    }
    contents.push({ role: "user", parts: resultParts });
  }
  return { reply: "Não consegui concluir a consulta agora. Pode repetir?", toolsUsed };
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
