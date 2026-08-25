export function Header({
  name,
  googleConnected,
  googleAvailable,
  demoBadges,
}: {
  name: string;
  googleConnected: boolean;
  googleAvailable: boolean;
  demoBadges: { ai: boolean; stt: boolean };
}) {
  return (
    <header className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-5 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-lg text-white">
          ✦
        </div>
        <div>
          <h1 className="text-sm font-semibold leading-tight">Agenda AI</h1>
          <p className="text-xs text-zinc-400">Olá, {name.split(" ")[0]}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!demoBadges.ai && (
          <span className="hidden rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-600 sm:inline">
            IA local (sem chave Anthropic)
          </span>
        )}
        {googleConnected ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600">
            ● Google Calendar conectado
          </span>
        ) : googleAvailable ? (
          <a
            href="/api/auth/google"
            className="rounded-full bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-zinc-700"
          >
            Conectar Google Calendar
          </a>
        ) : (
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500">
            Agenda local (demo)
          </span>
        )}
        <a
          href="/empresa"
          className="rounded-full border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-50"
        >
          Modo Empresa
        </a>
        <a
          href="/conectar"
          className="rounded-full border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-50"
        >
          Conectar WhatsApp
        </a>
        <a
          href="/api/auth/logout"
          className="rounded-full border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-500 transition hover:bg-zinc-50"
        >
          Sair
        </a>
      </div>
    </header>
  );
}
