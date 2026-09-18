// ─── Roteiro de perguntas do fluxo de venda ──────────────────────────────────
// As PERGUNTAS que o agente é programado a fazer para fechar o pedido, de forma
// ESTRUTURADA e editável pelo dono na Central de IA (aba Agente). Cada etapa tem
// a pergunta e os "pontos que não podem faltar" (os dados que o agente precisa
// captar antes de avançar). Isto NÃO substitui as regras comportamentais do
// fluxo (memória, uma pergunta por vez, bairro é exceção, fechamento/PIX) — que
// continuam na seção `fluxo` da personalidade. Aqui fica só o roteiro de coleta,
// que é renderizado como checklist e injetado no prompt do agente.

export type FlowQuestion = {
  id: string;
  titulo: string;
  pergunta: string;
  pontos: string[];
  // Etapas obrigatórias travam o avanço até serem captadas. As opcionais o
  // agente só faz se fizer sentido.
  obrigatoria: boolean;
};

// Esqueleto pronto — extraído das CONVERSAS REAIS do agente (não da prosa).
// Ordem e frases conferidas em sessões reais: Produto (marca+litragem) → Bairro
// (dispara o preço) → Quantidade → Chopeira (elétrica/gelo — SEMPRE vem no kit,
// nunca "quer chopeira junto?") → Endereço + térreo/escada → Evento (data,
// horário, casa/salão, um de cada vez) → CPF → Pagamento do restante (sinal 50%
// por PIX) → Fechamento. As regras de comportamento (memória, uma pergunta por
// vez, bairro é exceção) continuam na prosa do `fluxo`. Ao editar/salvar aqui,
// este roteiro passa a valer para o agente.
export const DEFAULT_FLOW_QUESTIONS: FlowQuestion[] = [
  {
    id: "produto",
    titulo: "Produto",
    pergunta: "Qual chopp você quer e qual litragem — 30L ou 50L?",
    obrigatoria: true,
    pontos: ["Marca do chopp", "Litragem do barril (30L ou 50L)"],
  },
  {
    id: "bairro",
    titulo: "Bairro",
    pergunta: "Pra qual bairro (e cidade) é a entrega?",
    obrigatoria: true,
    pontos: [
      "Bairro DESTA entrega — SEMPRE perguntar, nunca reutilizar cadastro/pedido anterior",
      "Cidade",
      "Com o bairro, chamar preco_por_bairro e informar o preço com frete grátis",
    ],
  },
  {
    id: "quantidade",
    titulo: "Quantidade",
    pergunta: "Quantos barris?",
    obrigatoria: true,
    pontos: ["Quantidade de barris"],
  },
  {
    id: "chopeira",
    titulo: "Chopeira",
    pergunta: "Você prefere a chopeira elétrica ou a de gelo?",
    obrigatoria: true,
    pontos: [
      "Elétrica ou de gelo",
      "A chopeira SEMPRE vem no kit — não é opcional; só perguntar qual das duas",
    ],
  },
  {
    id: "endereco",
    titulo: "Endereço e acesso",
    pergunta: "Me passa o endereço completo da entrega — e me diz se o local é térreo ou tem escada?",
    obrigatoria: true,
    pontos: [
      "Endereço DESTA entrega — não reutilizar o de pedido anterior",
      "Térreo ou tem escada (a equipe precisa saber pra subir o barril)",
    ],
  },
  {
    id: "evento",
    titulo: "Detalhes do evento",
    pergunta: "Pra qual data é a entrega/festa?",
    obrigatoria: false,
    pontos: [
      "Data — pergunte primeiro",
      "Horário — só depois de responder a data",
      "Casa ou salão — só depois do horário (uma de cada vez, mensagens separadas)",
      "Não insista se o cliente não quiser informar",
    ],
  },
  {
    id: "nome",
    titulo: "Nome do cliente",
    pergunta: "Pra registrar o pedido, me diz seu nome completo?",
    obrigatoria: true,
    pontos: [
      "Nome COMPLETO do cliente (nome + sobrenome)",
      "SEMPRE pergunte o nome — o nome de exibição do WhatsApp NÃO conta como cadastro; mesmo que apareça um nome/apelido, confirme o nome completo com o cliente",
      "Só não peça de novo se já houver nome REAL no cadastro (não 'Cliente <número>') vindo de um pedido anterior",
    ],
  },
  {
    id: "cpf",
    titulo: "CPF",
    pergunta: "E o seu CPF, pra emitir a nota?",
    obrigatoria: true,
    pontos: ["CPF do cliente", "Se já houver CPF no cadastro, não pedir de novo"],
  },
  {
    id: "pagamento",
    titulo: "Pagamento",
    pergunta: "Como você prefere pagar o restante na entrega? PIX, dinheiro ou cartão?",
    obrigatoria: true,
    pontos: [
      "Forma de pagamento do RESTANTE na entrega",
      "O sinal de 50% é sempre por PIX, pra confirmar o pedido",
    ],
  },
  {
    id: "fechamento",
    titulo: "Fechamento (automático)",
    pergunta:
      "Assim que o cliente responder a forma de pagamento, FINALIZE direto — nunca peça permissão ('posso fechar?') nem espere um 'sim'.",
    obrigatoria: true,
    pontos: [
      "Chamar finalizar_pedido de uma vez",
      "Resumo completo: nome do cliente, produto e quantidade, tipo de chopeira (elétrica/gelo), bairro e cidade, endereço, escada, casa/salão, data e horário, CPF, forma de pagamento, total e frete grátis",
      'Finalizar com a linha: "Pronto! ✅ Seu pedido já está registrado. A equipe da SS-Chopp já vai entrar em contato pra confirmar e combinar tudo. 🍺🚚"',
      "A chave PIX é anexada pelo sistema em mensagem separada — nunca digitar de memória; não ficar cobrando comprovante",
    ],
  },
];

function slug(): string {
  return "q" + Math.random().toString(36).slice(2, 8);
}

// Garante um array de perguntas válido a partir de entrada desconhecida (JSON do
// Setting, body da API…). Descarta lixo e normaliza campos.
export function coerceFlowQuestions(input: unknown): FlowQuestion[] {
  if (!Array.isArray(input)) return [];
  const out: FlowQuestion[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const pergunta = typeof r.pergunta === "string" ? r.pergunta.trim() : "";
    const titulo = typeof r.titulo === "string" && r.titulo.trim() ? r.titulo.trim() : "Pergunta";
    if (!pergunta) continue;
    const pontos = Array.isArray(r.pontos)
      ? r.pontos.filter((p): p is string => typeof p === "string").map((p) => p.trim()).filter(Boolean)
      : [];
    out.push({
      id: typeof r.id === "string" && r.id ? r.id : slug(),
      titulo,
      pergunta,
      pontos,
      obrigatoria: r.obrigatoria !== false,
    });
  }
  return out;
}

// Renderiza o roteiro como um CHECKLIST leve para o prompt do agente.
// IMPORTANTE: é só um lembrete de O QUE coletar e em QUE ORDEM — NÃO um script.
// As perguntas ficam como exemplo/referência; o agente mantém o próprio tom e
// jeito de falar (definidos na personalidade). Isso preserva o estilo natural
// da conversa e evita que o agente vire um robô lendo frases prontas.
export function renderFlowQuestions(questions: FlowQuestion[]): string {
  const list = questions.length ? questions : DEFAULT_FLOW_QUESTIONS;
  const body = list
    .map((q, i) => {
      const flag = q.obrigatoria ? "" : " (opcional)";
      const pontos = q.pontos.length
        ? q.pontos.map((p) => `   - ${p}`).join("\n")
        : "   - (livre)";
      const ex = q.pergunta
        ? `\n   Ex. (adapte ao SEU jeito, não copie ao pé da letra): "${q.pergunta}"`
        : "";
      return `${i + 1}. ${q.titulo}${flag} — precisa descobrir:\n${pontos}${ex}`;
    })
    .join("\n\n");
  return [
    "CHECKLIST DO PEDIDO (o que coletar e em que ordem):",
    "MANTENHA seu tom e jeito de falar da personalidade acima — caloroso, natural, uma pergunta por vez, reagindo ao que o cliente diz. Este checklist NÃO muda seu estilo: ele só te lembra QUAIS dados coletar e em QUE ordem, até fechar o pedido. As frases abaixo são apenas EXEMPLOS — use sempre as SUAS palavras. Só avance de etapa depois de ter os dados da atual; não junte perguntas na mesma mensagem.",
    "",
    body,
  ].join("\n");
}
