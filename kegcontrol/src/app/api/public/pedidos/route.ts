import { NextRequest, NextResponse } from "next/server";
import { MOVEMENT_TYPE_LABELS, type MovementType } from "@/lib/enums";
import { findCustomerByPhone } from "@/server/services/customers";
import { listMovements } from "@/server/services/movements";
import { getPrimaryCompanyId } from "@/server/services/site-pricing";
import {
  createSiteOrder,
  listSiteOrdersByPhone,
  parseItems,
  siteOrderSchema,
} from "@/server/services/site-orders";

// Endpoint PUBLICO (sem sessao) que o site ss-chopp usa:
//  - GET ?telefone=  -> "Meus pedidos": mescla pedidos do site (pendentes/
//    confirmados) + movimentacoes ja lancadas no KegControl.
//  - POST            -> captura o pedido feito no site como PENDING (a
//    SS-Chopp confirma no painel; nao toca no estoque).
// Liberado no proxy.ts via prefixo /api/public/. CORS aberto (site estatico).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, must-revalidate",
};

export const dynamic = "force-dynamic";

// So esses tipos de movimentacao sao "pedido" pro cliente (Entrega/Retirada/
// Troca). Compra/Venda sao externas; Ajuste/Perda/Manutencao sao internos.
const TIPOS_PEDIDO: MovementType[] = ["DELIVERY", "PICKUP", "SWAP"];

type PedidoView = {
  ref: string;
  tipo: string;
  situacao: string;
  data: string;
  itens: { produto: string; quantidade: number }[];
};

export async function GET(req: NextRequest) {
  const telefone = req.nextUrl.searchParams.get("telefone");
  if (!telefone) {
    return NextResponse.json(
      { ok: false, error: "Informe o telefone" },
      { status: 400, headers: CORS },
    );
  }

  const companyId = await getPrimaryCompanyId();
  if (!companyId) {
    return NextResponse.json(
      { ok: false, error: "Nenhuma empresa configurada" },
      { status: 404, headers: CORS },
    );
  }

  const [customer, siteOrders] = await Promise.all([
    findCustomerByPhone(companyId, telefone),
    listSiteOrdersByPhone(companyId, telefone),
  ]);

  const pedidosSite: PedidoView[] = siteOrders.map((o) => ({
    ref: `site-${o.id}`,
    tipo: "Pedido pelo site",
    situacao: o.status === "CONFIRMED" ? "Confirmado" : "Aguardando confirmação",
    data: o.createdAt.toISOString(),
    itens: parseItems(o.items).map((it) => ({
      produto: it.name,
      quantidade: it.quantity,
    })),
  }));

  let pedidosMov: PedidoView[] = [];
  if (customer) {
    const movements = await listMovements(companyId, {
      customerId: customer.id,
      type: TIPOS_PEDIDO,
      take: 20,
    });
    pedidosMov = movements.map((m) => ({
      ref: `mov-${m.id}`,
      tipo: MOVEMENT_TYPE_LABELS[m.type as MovementType] ?? m.type,
      situacao: "Confirmado",
      data: m.occurredAt.toISOString(),
      itens: m.items.map((it) => ({
        produto: it.kegType.name,
        quantidade: it.quantity,
      })),
    }));
  }

  const pedidos = [...pedidosSite, ...pedidosMov].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
  );

  const encontrado = !!customer || siteOrders.length > 0;
  const nome = customer?.name ?? siteOrders[0]?.customerName ?? null;

  return NextResponse.json(
    { ok: true, data: { encontrado, nome, pedidos } },
    { headers: CORS },
  );
}

export async function POST(req: NextRequest) {
  const companyId = await getPrimaryCompanyId();
  if (!companyId) {
    return NextResponse.json(
      { ok: false, error: "Nenhuma empresa configurada" },
      { status: 404, headers: CORS },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido" },
      { status: 400, headers: CORS },
    );
  }

  const parsed = siteOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400, headers: CORS },
    );
  }

  const order = await createSiteOrder(companyId, parsed.data);
  return NextResponse.json(
    { ok: true, data: { id: order.id } },
    { status: 201, headers: CORS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}
