"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, type Role } from "@/lib/enums";

export function UserMenu({ name, role }: { name: string; role: Role }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <div className="text-sm font-medium leading-tight">{name}</div>
        <div className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</div>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand font-bold text-brand-foreground">
        {name.charAt(0).toUpperCase()}
      </div>
      <button
        onClick={logout}
        title="Sair"
        aria-label="Sair"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-colors"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
