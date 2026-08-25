import Link from "next/link";

/** Layout compartilhado das páginas legais (privacidade, termos). */
export function LegalLayout({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-8">
        <Link href="/login" className="text-sm text-indigo-600 hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-zinc-400">Última atualização: {updatedAt}</p>
      </div>

      <article className="legal space-y-4 text-sm leading-relaxed text-zinc-700">
        {children}
      </article>

      <style>{`
        .legal h2 { font-size: 1rem; font-weight: 600; color: #18181b; margin-top: 1.75rem; margin-bottom: 0.25rem; }
        .legal ul { list-style: disc; padding-left: 1.25rem; }
        .legal ul li { margin: 0.35rem 0; }
        .legal a { color: #4f46e5; }
        .legal a:hover { text-decoration: underline; }
        .legal strong { color: #27272a; }
      `}</style>
    </main>
  );
}
