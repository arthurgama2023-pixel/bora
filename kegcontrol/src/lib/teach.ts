// Helpers puros do "ensino do agente" — compartilhados entre servidor (prompt +
// persistência) e telas (chat de treino, aba Conversas). Sem dependência de
// servidor, pra poder importar no cliente.

export const CATEGORIAS = [
  "Saudação",
  "Dúvida de preço",
  "Escolha do produto",
  "Coleta de dados",
  "Objeção",
  "Fechamento",
  "Pós-venda",
  "Outro",
] as const;

export type StyleExample = {
  id: string;
  tipo: "exemplo" | "instrucao";
  // Quando aplicar (a SITUAÇÃO, em linguagem natural) — o gatilho principal.
  gatilho: string;
  // Categoria da situação (um dos CATEGORIAS).
  categoria: string;
  // Frases do cliente que caem nessa situação (ancoram o reconhecimento).
  variacoes: string[];
  // Frase original do cliente (referência/legado; caiu pro `gatilho`).
  cliente: string;
  // Correção: como responder. Instrução: a diretiva em si.
  ideal: string;
  // Como o agente respondeu de fato (referência; NÃO vai pro prompt).
  original?: string;
  nota?: string;
  createdAt: string;
};

export function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Chave da SITUAÇÃO — dois ensinos com a mesma chave são "o mesmo": editar
// atualiza em vez de acumular. Instrução: pela diretiva. Correção: por
// categoria + gatilho (ou cliente, legado). Sem nada pra chavear → usa o id.
export function situationKey(e: StyleExample): string {
  if (e.tipo === "instrucao") return "instrucao:" + norm(e.ideal);
  const base = norm(e.gatilho || e.cliente);
  if (!base) return "exemplo:id:" + e.id;
  return "exemplo:" + norm(e.categoria) + ":" + base;
}

// Insere ou ATUALIZA um item existente pelo id (edição explícita). Novos itens
// são apenas ADICIONADOS — nunca fundimos correções diferentes por engano.
export function upsertExample(list: StyleExample[], item: StyleExample): StyleExample[] {
  const idx = list.findIndex((e) => e.id === item.id);
  if (idx < 0) return [...list, item];
  const next = [...list];
  next[idx] = { ...item };
  return next;
}

// Rede de segurança: colapsa apenas DUPLICATAS IDÊNTICAS (mesma resposta), o
// último vence. NÃO funde correções diferentes — chaveia pela RESPOSTA, não pela
// situação, pra nunca apagar um ensino distinto que caia na mesma categoria.
export function dedupeBySituation(list: StyleExample[]): StyleExample[] {
  const byKey = new Map<string, StyleExample>();
  for (const e of list) byKey.set(e.tipo + "|" + norm(e.ideal), e);
  return [...byKey.values()];
}
