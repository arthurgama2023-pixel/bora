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
    <div className="mx-auto flex h-screen max-w-6xl flex-col px-4 py-4">
      <header className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-lg text-white">
            ✦
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">Agenda AI</h1>
            <p className="text-xs text-zinc-400">{company ? company.name : "Modo Empresa"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/"
            className="rounded-full border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-50"
          >
            ← Modo Pessoal
          </a>
          <a
            href="/api/auth/logout"
            className="rounded-full border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-500 transition hover:bg-zinc-50"
          >
            Sair
          </a>
        </div>
      </header>

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
