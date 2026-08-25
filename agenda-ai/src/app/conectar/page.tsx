import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { getWhatsAppConfig } from "@/modules/channels/config";
import { ConnectWhatsApp } from "@/components/ConnectWhatsApp";

export default async function ConectarPage() {
  if (!(await getSessionUserId())) redirect("/login");
  const cfg = await getWhatsAppConfig();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Conectar WhatsApp</h1>
          <p className="text-sm text-zinc-500">Ligue o agente ao seu número via Evolution API.</p>
        </div>
        <a
          href="/"
          className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
        >
          ← Voltar ao painel
        </a>
      </div>

      <ConnectWhatsApp
        serverConfigured={Boolean(cfg)}
        instanceName={cfg?.instance ?? "agenda-ai"}
      />
    </div>
  );
}
