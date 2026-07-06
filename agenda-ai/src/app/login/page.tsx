import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { hasGoogle } from "@/lib/env";
import { LoginButtons } from "@/components/LoginButtons";

export default async function LoginPage() {
  if (await getSessionUserId()) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 text-2xl text-white shadow-lg">
            ✦
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda AI</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Fale naturalmente. Sua agenda se organiza sozinha.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <LoginButtons googleEnabled={hasGoogle} />

          <div className="mt-6 border-t border-zinc-100 pt-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
              Permissões que pedimos ao Google
            </p>
            <ul className="space-y-1.5 text-xs text-zinc-500">
              <li>
                <span className="font-medium text-zinc-700">Seu e-mail e nome</span> — para
                identificar sua conta.
              </li>
              <li>
                <span className="font-medium text-zinc-700">Ler sua agenda</span> — para detectar
                conflitos e encontrar horários livres.
              </li>
              <li>
                <span className="font-medium text-zinc-700">Criar e editar eventos</span> — para
                agendar o que você pedir. Nunca alteramos nada sem seu comando.
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-400">
          Sem Google configurado? O modo demonstração usa uma agenda local completa.
        </p>
      </div>
    </main>
  );
}
