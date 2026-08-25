import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar userName={session?.name ?? "Usuário"} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
