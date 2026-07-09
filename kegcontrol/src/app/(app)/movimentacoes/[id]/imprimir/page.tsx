import Link from "next/link";
import { redirect } from "next/navigation";
import { CrownMark } from "@/components/logo";
import { getSession } from "@/lib/auth";
import {
  CONDITION_LABELS,
  MOVEMENT_TYPE_LABELS,
  type Condition,
  type MovementType,
} from "@/lib/enums";
import { formatCpfCnpj, formatDateTime, movementCode } from "@/lib/utils";
import { getCustomerBalance } from "@/server/services/customers";
import { getMovement } from "@/server/services/movements";
import { getCustomerStatement } from "@/server/services/reports";
import { PrintActions } from "./print-actions";

export const dynamic = "force-dynamic";

const SHEET_TITLES: Partial<Record<MovementType, string>> = {
  DELIVERY: "Folha de Entrega",
  PICKUP: "Comprovante de Retirada",
  SWAP: "Comprovante de Troca",
  PURCHASE: "Registro de Entrada no Estoque",
  SALE: "Comprovante de Venda",
};

export default async function PrintMovementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const m = await getMovement(session.companyId, id);
  const [balance, statement] = await Promise.all([
    m.customerId ? getCustomerBalance(session.companyId, m.customerId) : null,
    m.customerId ? getCustomerStatement(session.companyId, m.customerId) : null,
  ]);

  const title =
    SHEET_TITLES[m.type as MovementType] ?? "Comprovante de Movimentação";
  const totalKegs = m.items.reduce((a, i) => a + i.quantity, 0);
  // Assinatura do cliente aparece sempre que a movimentação tem um cliente
  // vinculado (não só nas entregas/retiradas/trocas — um Ajuste ou Perda
  // ligados a um cliente também merecem a assinatura dele).
  const hasSignature = Boolean(m.customer);

  // Histórico de movimentações ANTERIORES a esta, mais recentes primeiro —
  // as últimas 8, para não estourar a folha impressa.
  const history = (statement?.rows ?? [])
    .filter((r) => r.movement.id !== m.id)
    .slice()
    .reverse()
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link
          href={`/movimentacoes/${m.id}`}
          className="text-sm text-brand-strong hover:underline"
        >
          ← Voltar para a movimentação
        </Link>
        <PrintActions />
      </div>

      {/* ── Folha (A4) ── */}
      <div className="rounded-xl border border-border bg-white p-8 text-black shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {/* cabeçalho */}
        <div className="flex items-start justify-between border-b-2 border-black pb-4">
          <div className="flex items-center gap-3">
            <CrownMark className="h-10 w-12 text-[#c79c00]" />
            <div className="leading-tight">
              <div className="text-xl font-black tracking-wider">
                SS-<span className="text-[#c79c00]">CHOPP</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">
                desde 2016
              </div>
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="text-lg font-bold uppercase">{title}</div>
            <div className="font-mono font-semibold">{movementCode(m.number)}</div>
            <div className="text-neutral-600">{formatDateTime(m.occurredAt)}</div>
          </div>
        </div>

        {/* cliente */}
        {m.customer && (
          <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <div className="col-span-2 mb-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
              Cliente
            </div>
            <div>
              <span className="font-semibold">{m.customer.name}</span>
              {m.customer.companyName && ` — ${m.customer.companyName}`}
            </div>
            <div>CPF/CNPJ: {formatCpfCnpj(m.customer.document)}</div>
            <div>
              {[m.customer.address, m.customer.city, m.customer.state]
                .filter(Boolean)
                .join(", ") || "Endereço não cadastrado"}
            </div>
            <div>
              Tel: {m.customer.phone ?? m.customer.whatsapp ?? "—"}
              {m.customer.contactName && ` · Resp.: ${m.customer.contactName}`}
            </div>
          </div>
        )}

        {(m.origin || m.destination) && (
          <div className="mt-3 text-sm text-neutral-700">
            {m.origin && <span>Origem: {m.origin}</span>}
            {m.origin && m.destination && " · "}
            {m.destination && <span>Destino: {m.destination}</span>}
          </div>
        )}

        {/* itens */}
        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y-2 border-black text-left">
              <th className="py-2 pr-2">Item</th>
              <th className="py-2 pr-2">Código</th>
              <th className="py-2 pr-2">Condição</th>
              <th className="py-2 text-right">Quantidade</th>
            </tr>
          </thead>
          <tbody>
            {m.items.map((i) => (
              <tr key={i.id} className="border-b border-neutral-300">
                <td className="py-2 pr-2 font-medium">{i.kegType.name}</td>
                <td className="py-2 pr-2 font-mono text-xs">{i.kegType.code}</td>
                <td className="py-2 pr-2">
                  {CONDITION_LABELS[i.condition as Condition]}
                  {i.toCondition && i.toCondition !== i.condition
                    ? ` → ${CONDITION_LABELS[i.toCondition as Condition]}`
                    : ""}
                </td>
                <td className="py-2 text-right font-bold">{i.quantity}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} className="py-2 pr-2 text-right font-semibold">
                Total de barris
              </td>
              <td className="py-2 text-right text-lg font-black">{totalKegs}</td>
            </tr>
          </tbody>
        </table>

        {/* saldo do cliente após a movimentação */}
        {balance && (
          <div className="mt-4 rounded border border-neutral-300 bg-neutral-50 p-3 text-sm print:bg-white">
            <span className="font-semibold">
              Saldo do cliente após esta movimentação:
            </span>{" "}
            {balance.barrilTotals.total > 0 &&
              `${balance.barrilTotals.total} barril(is) em comodato (${balance.barrilTotals.full} cheio(s) · ${balance.barrilTotals.empty} vazio(s))`}
            {balance.barrilTotals.total > 0 && balance.chopeiraTotals.total > 0 && " · "}
            {balance.chopeiraTotals.total > 0 &&
              `${balance.chopeiraTotals.total} chopeira(s) em comodato (${balance.chopeiraTotals.full} cheio(s) · ${balance.chopeiraTotals.empty} vazio(s))`}
            {balance.barrilTotals.total === 0 && balance.chopeiraTotals.total === 0 && "nenhum item em comodato"}
            {balance.rows.length > 0 && (
              <span className="text-neutral-600">
                {" — "}
                {balance.rows
                  .map(
                    (r) =>
                      `${r.kegType.name}: ${r.full}C/${r.empty}V`,
                  )
                  .join(" · ")}
              </span>
            )}
          </div>
        )}

        {/* histórico de movimentações anteriores deste cliente */}
        {history.length > 0 && (
          <div className="mt-5">
            <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-neutral-500">
              Histórico de movimentações anteriores
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-y border-neutral-400 text-left">
                  <th className="py-1 pr-2">Data</th>
                  <th className="py-1 pr-2">Código</th>
                  <th className="py-1 pr-2">Tipo</th>
                  <th className="py-1 pr-2">Itens</th>
                  <th className="py-1 text-right">Saldo após</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.movement.id} className="border-b border-neutral-200">
                    <td className="py-1 pr-2 text-neutral-600">
                      {formatDateTime(r.movement.occurredAt)}
                    </td>
                    <td className="py-1 pr-2 font-mono">{movementCode(r.movement.number)}</td>
                    <td className="py-1 pr-2">
                      {MOVEMENT_TYPE_LABELS[r.movement.type as MovementType] ?? r.movement.type}
                    </td>
                    <td className="py-1 pr-2 text-neutral-600">
                      {r.movement.items
                        .map((i) => `${i.quantity}x ${i.kegType.code}`)
                        .join(", ")}
                    </td>
                    <td className="py-1 text-right font-semibold">{r.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {m.notes && (
          <div className="mt-4 text-sm">
            <span className="font-semibold">Observações:</span> {m.notes}
          </div>
        )}

        {/* assinaturas */}
        {hasSignature ? (
          <div className="mt-14 grid grid-cols-2 gap-10 text-center text-sm">
            <div>
              <div className="border-t border-black pt-2">
                Entregador — SS-Chopp
              </div>
            </div>
            <div>
              <div className="border-t border-black pt-2">
                Cliente — {m.customer?.name ?? "assinatura"}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-14 grid grid-cols-1 gap-10 text-center text-sm">
            <div className="mx-auto w-1/2">
              <div className="border-t border-black pt-2">
                Responsável — SS-Chopp
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 border-t border-neutral-300 pt-3 text-center text-xs text-neutral-500">
          Documento emitido por {m.user.name} em {formatDateTime(m.createdAt)} ·
          SS-Chopp · Controle de Barris
        </div>
      </div>
    </div>
  );
}
