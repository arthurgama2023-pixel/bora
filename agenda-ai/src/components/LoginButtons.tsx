"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginButtons({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function demoLogin() {
    setLoading(true);
    await fetch("/api/auth/demo", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {googleEnabled ? (
        <a
          href="/api/auth/google"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-700"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z" />
          </svg>
          Entrar com Google
        </a>
      ) : (
        <div
          className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-400"
          title="Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env"
        >
          Entrar com Google (não configurado)
        </div>
      )}

      <button
        onClick={demoLogin}
        disabled={loading}
        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
      >
        {loading ? "Entrando…" : "Entrar em modo demonstração"}
      </button>
    </div>
  );
}
