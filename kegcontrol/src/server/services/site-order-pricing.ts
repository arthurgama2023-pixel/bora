import {
  effectiveProductsForCity,
  unitPriceFor,
  type SitePricing,
} from "@/server/services/site-pricing";

// Recalculo, no SERVIDOR, dos precos de um pedido vindo do site. O site e
// publico e manda unitPrice/total no corpo — nao da pra confiar. Aqui cada item
// e reprecificado pela mesma tabela que o site usa (override da cidade primeiro,
// senao o catalogo padrao). Nunca bloqueia o pedido: id desconhecido mantem o
// preco do cliente e conta como "nao verificado".

// Ids do site que diferem do painel.
const ID_ALIASES: Record<string, string> = {
  "bramma-50l": "brahma-50l",
  "kit-chopeira-completa": "kit-chopeira",
};

// Diferenca (em R$) a partir da qual avisamos o Sentry e anotamos no pedido.
export const PRECO_DIVERGENTE_LIMITE = 0.5;

export type PedidoItemPreco = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type RecalculoPedido = {
  items: PedidoItemPreco[];
  total: number;
  /** Total que o cliente mandou (ja com taxa de entrega embutida, se houver). */
  clientTotal: number;
  /** Alguma diferenca > R$0,50 em item ou total? */
  divergiu: boolean;
  /** Ids sem preco no painel (mantidos com o valor do cliente). */
  naoVerificados: string[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function recalcularPrecosPedido(
  pricing: SitePricing,
  city: string | null | undefined,
  items: PedidoItemPreco[],
  clientTotal: number,
): RecalculoPedido {
  // Mesma regra do site (location-context): produto com preço próprio da
  // cidade vale primeiro; senão o preço padrão DAQUELE produto.
  const daCidade = effectiveProductsForCity(pricing, city ?? "");
  const naoVerificados: string[] = [];
  let divergiu = false;
  let subtotalCliente = 0;

  const novos = items.map((it) => {
    subtotalCliente += it.unitPrice * it.quantity;
    const ids = [it.id, ID_ALIASES[it.id] ?? it.id];
    const bate = (p: { id: string }) => ids.includes(p.id);
    const prod = daCidade.find(bate) ?? pricing.products.find(bate);
    if (!prod) {
      naoVerificados.push(it.id);
      return it;
    }
    const oficial = unitPriceFor(prod, it.quantity);
    if (Math.abs(oficial - it.unitPrice) > PRECO_DIVERGENTE_LIMITE) divergiu = true;
    return oficial === it.unitPrice ? it : { ...it, unitPrice: oficial };
  });

  const subtotal = round2(novos.reduce((s, it) => s + it.unitPrice * it.quantity, 0));
  // Taxa de entrega que o cliente embutiu no total (hoje 0): preserva a
  // diferenca total - subtotal do cliente, nunca negativa.
  const taxa = Math.max(0, round2(clientTotal - subtotalCliente));
  const total = round2(subtotal + taxa);
  if (Math.abs(total - clientTotal) > PRECO_DIVERGENTE_LIMITE) divergiu = true;

  return { items: novos, total, clientTotal, divergiu, naoVerificados };
}

const brl = (n: number) => n.toFixed(2).replace(".", ",");

// Nota curta anexada as observacoes do pedido quando o servidor corrigiu o preco.
export function notaPrecoCorrigido(r: RecalculoPedido): string {
  return `[Preço corrigido pelo servidor: cliente R$${brl(r.clientTotal)} → painel R$${brl(r.total)}]`;
}
