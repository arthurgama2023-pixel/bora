import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hasAI, hasGoogle, hasSTT } from "@/lib/env";
import { getSessionUserId } from "@/lib/session";
import { AgendaPanel } from "@/components/AgendaPanel";
import { Chat } from "@/components/Chat";
import { Header } from "@/components/Header";

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { integrations: { where: { provider: "google", status: "active" } } },
  });
  if (!user) redirect("/api/auth/logout");

  const googleConnected = hasGoogle && user.integrations.length > 0;

  return (
    <div className="mx-auto flex h-screen max-w-6xl flex-col px-4 py-4">
      <Header
        name={user.name ?? user.email}
        googleConnected={googleConnected}
        googleAvailable={hasGoogle}
        demoBadges={{ ai: hasAI, stt: hasSTT }}
      />
      <main className="mt-4 grid min-h-0 flex-1 gap-4 md:grid-cols-[380px_1fr]">
        <AgendaPanel />
        <Chat sttAvailable={hasSTT} />
      </main>
    </div>
  );
}
