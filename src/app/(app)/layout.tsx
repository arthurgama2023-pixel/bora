import { redirect } from "next/navigation";
import { GlobalSearch } from "@/components/global-search";
import { Logo } from "@/components/logo";
import { SidebarNav } from "@/components/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { getSession } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="px-6 py-6 text-white">
          <Logo size="sm" />
        </div>
        <SidebarNav role={session.role} />
        <div className="mt-auto px-6 py-4 text-[11px] text-sidebar-foreground/60">
          Controle de Barris · v1.0
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:pl-60">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
          <div className="lg:hidden">
            <Logo size="sm" />
          </div>
          <div className="flex flex-1 justify-center lg:justify-start">
            <GlobalSearch />
          </div>
          <ThemeToggle />
          <UserMenu name={session.name} role={session.role} />
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
