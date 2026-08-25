import Link from "next/link";
import { redirect } from "next/navigation";
import Uploader from "@/components/Uploader";
import { listProjects } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  queued: "Na fila",
  processing: "Processando",
  rendering: "Renderizando",
  review: "Pronto p/ revisão",
  approved: "Aprovado",
  error: "Erro",
};

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const projects = listProjects(user.id);
  return (
    <main>
      <section className="hero">
        <span className="eyebrow">✨ Editor de vídeo com IA</span>
        <h2>
          Você grava. <em>A IA edita.</em> Você publica.
        </h2>
        <p>
          Envie seus vídeos e receba um corte pronto para viralizar — com cortes, legendas, música
          e versões para cada rede. Depois é só ajustar do seu jeito.
        </p>
      </section>

      <section className="steps">
        <div className="step">
          <div className="n">1</div>
          <div>
            <strong>Envie seus vídeos</strong>
            <span>Um ou vários, direto da galeria</span>
          </div>
        </div>
        <div className="step">
          <div className="n">2</div>
          <div>
            <strong>A IA edita tudo</strong>
            <span>Cortes, legendas, música e efeitos</span>
          </div>
        </div>
        <div className="step">
          <div className="n">3</div>
          <div>
            <strong>Você ajusta e baixa</strong>
            <span>No editor ou conversando com a IA</span>
          </div>
        </div>
      </section>

      <Uploader />

      {projects.length > 0 && (
        <div className="plist">
          <div className="plist-title">Seus projetos</div>
          {projects.map((p) => (
            <Link key={p.id} href={`/p/${p.id}`} className="pitem">
              <div className="pinfo">
                <strong>{p.name}</strong>
                <div className="meta">
                  {p.niche || "analisando nicho…"} ·{" "}
                  {new Date(p.created_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <span className={`chip ${p.status}`}>
                {(p.status === "processing" || p.status === "rendering" || p.status === "queued") && (
                  <span className="pulse" />
                )}
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
