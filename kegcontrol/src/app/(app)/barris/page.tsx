import { Pencil, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import {
  Badge,
  ButtonLink,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getSession } from "@/lib/auth";
import { KEG_CATEGORY_LABELS, type KegCategory } from "@/lib/enums";
import { formatCurrency } from "@/lib/utils";
import { listKegTypes } from "@/server/services/keg-types";

export const metadata = { title: "Barris e Chopeiras" };
export const dynamic = "force-dynamic";

const CATEGORY_TONES: Record<KegCategory, "brand" | "info"> = {
  BARRIL: "brand",
  CHOPEIRA: "info",
};

export default async function KegTypesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const types = await listKegTypes(session.companyId);
  const canEdit = session.role === "ADMIN" || session.role === "MANAGER";

  return (
    <>
      <PageHeader
        title="Barris e Chopeiras"
        subtitle="A quantidade é derivada do estoque — alimentada pelas movimentações"
        actions={
          canEdit ? (
            <ButtonLink href="/barris/novo">
              <Plus className="h-4 w-4" /> Novo tipo
            </ButtonLink>
          ) : undefined
        }
      />
      {types.length === 0 ? (
        <EmptyState message="Nenhum barril ou chopeira cadastrado ainda." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Código</Th>
              <Th>Nome</Th>
              <Th>Categoria</Th>
              <Th className="text-right">Capacidade</Th>
              <Th className="text-right">Valor unitário</Th>
              <Th className="text-right">Qtd. total</Th>
              <Th className="text-right">Perdidos</Th>
              <Th className="text-right">Patrimônio</Th>
              <Th>Status</Th>
              {canEdit && <Th />}
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id} className="hover:bg-muted/40">
                <Td className="font-mono text-xs font-semibold">{t.code}</Td>
                <Td className="font-medium">{t.name}</Td>
                <Td>
                  <Badge tone={CATEGORY_TONES[t.category as KegCategory] ?? "brand"}>
                    {KEG_CATEGORY_LABELS[t.category as KegCategory] ?? t.category}
                  </Badge>
                </Td>
                <Td className="text-right">
                  {t.category === "CHOPEIRA" ? `${t.capacityLiters} torneira(s)` : `${t.capacityLiters} L`}
                </Td>
                <Td className="text-right">{formatCurrency(t.assetValue)}</Td>
                <Td className="text-right font-bold">{t.total}</Td>
                <Td className="text-right text-danger">{t.lost || "—"}</Td>
                <Td className="text-right font-semibold">
                  {formatCurrency(t.assetTotal)}
                </Td>
                <Td>
                  <Badge tone={t.active ? "success" : "neutral"}>
                    {t.active ? "Ativo" : "Inativo"}
                  </Badge>
                </Td>
                {canEdit && (
                  <Td>
                    <ButtonLink
                      variant="ghost"
                      size="sm"
                      href={`/barris/${t.id}/editar`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </ButtonLink>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
