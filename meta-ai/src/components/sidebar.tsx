"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  LogOut,
  MessageSquare,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { useConversations, useDeleteConversation } from "@/hooks/use-conversations";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/wizard", label: "Criar campanha", icon: Wand2 },
  { href: "/creatives", label: "Criativos", icon: ImageIcon },
  { href: "/connect", label: "Conexão Meta", icon: Link2 },
];

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: conversations, isLoading } = useConversations();
  const deleteConversation = useDeleteConversation();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card/50">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </div>
        <span className="font-semibold tracking-tight">Meta AI</span>
      </div>

      {/* Navegação */}
      <nav className="flex flex-col gap-0.5 p-2">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/chat" ? pathname.startsWith("/chat") : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Histórico de conversas */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="flex items-center justify-between px-2.5 py-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Conversas
          </span>
          <Button
            variant="ghost"
            size="iconSm"
            aria-label="Nova conversa"
            onClick={() => router.push("/chat")}
          >
            <Plus />
          </Button>
        </div>
        {isLoading ? (
          <div className="space-y-1.5 px-1">
            <Skeleton className="h-7" />
            <Skeleton className="h-7" />
            <Skeleton className="h-7" />
          </div>
        ) : conversations?.length ? (
          <div className="flex flex-col gap-0.5">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  "group flex items-center rounded-lg transition-colors",
                  pathname === `/chat/${conversation.id}`
                    ? "bg-accent"
                    : "hover:bg-accent/60",
                )}
              >
                <Link
                  href={`/chat/${conversation.id}`}
                  className="flex-1 truncate px-2.5 py-1.5 text-[13px] text-muted-foreground group-hover:text-foreground"
                >
                  {conversation.title}
                </Link>
                <Button
                  variant="ghost"
                  size="iconSm"
                  aria-label="Excluir conversa"
                  className="mr-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    deleteConversation.mutate(conversation.id, {
                      onSuccess: () => {
                        toast.success("Conversa excluída");
                        if (pathname === `/chat/${conversation.id}`) router.push("/chat");
                      },
                    });
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-2.5 py-1 text-xs text-muted-foreground/70">
            Nenhuma conversa ainda.
          </p>
        )}
      </div>

      {/* Rodapé: usuário + tema + logout */}
      <div className="flex items-center gap-2 border-t border-border p-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
          {userName.slice(0, 1)}
        </div>
        <span className="flex-1 truncate text-[13px]">{userName}</span>
        <ThemeToggle />
        <Button variant="ghost" size="iconSm" aria-label="Sair" onClick={logout}>
          <LogOut />
        </Button>
      </div>
    </aside>
  );
}
