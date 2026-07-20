import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hasGoogle } from "@/lib/env";
import { getSessionUserId } from "@/lib/session";
import { EmpresaPanel } from "@/components/EmpresaPanel";

export default async function EmpresaPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const company = await db.company.findUnique({
    where: { ownerUserId: userId },
    include: { services: { orderBy: { createdAt: "asc" } } },
  });

  const google = company
    ? await db.integration.findUnique({
        where: { companyId_provider: { companyId: company.id, provider: "google" } },
        select: { status: true },
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Modo Empresa</h1>
          <p className="text-sm text-zinc-500">
            Atendente virtual que agenda os clientes da sua empresa pelo WhatsApp.
          </p>
        </div>
        <a
          href="/"
          className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
        >
          ← Modo Pessoal
        </a>
      </div>

      <EmpresaPanel
        initialCompany={
          company
            ? {
                id: company.id,
                name: company.name,
                agentName: company.agentName,
                welcomeMessage: company.welcomeMessage,
                timezone: company.timezone,
                workdayStart: company.workdayStart,
                workdayEnd: company.workdayEnd,
                defaultDurMin: company.defaultDurMin,
                services: company.services.map((s) => ({
                  id: s.id,
                  name: s.name,
                  durationMin: s.durationMin,
                  description: s.description,
                  price: s.price,
                  active: s.active,
                })),
              }
            : null
        }
        googleConnected={google?.status === "active"}
        googleAvailable={hasGoogle}
      />
    </div>
  );
}
