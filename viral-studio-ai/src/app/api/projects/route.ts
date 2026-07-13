import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { createProject, createVideo, listProjects, saveArtifact, storageRoot } from "@/lib/db";
import { projectDir } from "@/lib/storage";
import { isOverloaded, queueLoad, startPipeline } from "@/lib/pipeline";
import { enforce } from "@/lib/ratelimit";
import { authed } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

// Recusa graciosamente quando a fila de render está cheia — melhor um 503 claro
// do que aceitar o vídeo, gravá-lo em disco e deixá-lo preso numa fila infinita.
function overloadedResponse(): NextResponse {
  const { queued, cap } = queueLoad();
  return NextResponse.json(
    {
      error: `Estamos processando muitos vídeos agora (${queued}/${cap} na fila). Aguarde alguns minutos e tente novamente.`,
      retryAfter: 60,
    },
    { status: 503, headers: { "Retry-After": "60" } }
  );
}

export async function GET() {
  const a = await authed();
  if ("res" in a) return a.res;
  return NextResponse.json({ projects: listProjects(a.user.id) });
}

const ALLOWED = [".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"];
const MAX_VIDEOS = 10;
const TOKEN_RE = /^[a-f0-9]{16}$/;

// Criação a partir de uploads em streaming (PUT /api/upload → tokens).
// Caminho preferido — suporta vídeos longos sem buffering em memória.
async function createFromTokens(req: Request, userId: string): Promise<NextResponse> {
  if (isOverloaded()) return overloadedResponse();
  const body = (await req.json().catch(() => ({}))) as {
    uploads?: { token: string; filename: string }[];
    name?: string;
    goal?: string;
    platform?: string;
    captions?: boolean;
  };
  const uploads = (body.uploads ?? []).slice(0, MAX_VIDEOS);
  if (uploads.length === 0) {
    return NextResponse.json({ error: "Envie pelo menos um vídeo." }, { status: 400 });
  }
  const tmp = path.join(storageRoot(), "tmp");
  const resolved: { src: string; ext: string; filename: string; size: number }[] = [];
  for (const u of uploads) {
    const ext = (path.extname(u.filename || "") || ".mp4").toLowerCase();
    if (!TOKEN_RE.test(u.token) || !ALLOWED.includes(ext)) {
      return NextResponse.json({ error: `Upload inválido: ${u.filename}` }, { status: 400 });
    }
    const src = path.join(tmp, `${u.token}${ext}`);
    if (!fs.existsSync(src)) {
      return NextResponse.json({ error: `Upload expirado ou não encontrado: ${u.filename}` }, { status: 400 });
    }
    resolved.push({ src, ext, filename: u.filename, size: fs.statSync(src).size });
  }

  const name = String(body.name || resolved[0].filename.replace(/\.[^.]+$/, ""));
  const project = createProject({
    name,
    goal: String(body.goal || ""),
    platform: String(body.platform || "tiktok"),
    userId,
  });
  saveArtifact(project.id, "prefs", { captions: body.captions !== false });

  for (let i = 0; i < resolved.length; i++) {
    const r = resolved[i];
    const dest = path.join(projectDir(project.id), `source_${i}${r.ext}`);
    fs.renameSync(r.src, dest); // mesmo volume: move instantâneo, sem cópia
    createVideo({
      project_id: project.id,
      filename: r.filename,
      path: dest,
      duration: 0,
      width: 0,
      height: 0,
      fps: 0,
      has_audio: 0,
      size: r.size,
    });
  }

  startPipeline(project.id);
  return NextResponse.json({ project, videos: resolved.length }, { status: 201 });
}

export async function POST(req: Request) {
  const a = await authed();
  if ("res" in a) return a.res;
  // No máx. 12 criações de projeto/min por IP (cada uma custa IA + FFmpeg).
  const limited = enforce(req, "project-create", { limit: 12, windowMs: 60_000 });
  if (limited) return limited;
  // JSON = fluxo em streaming (tokens); multipart = compat (arquivos pequenos/curl)
  if ((req.headers.get("content-type") || "").includes("application/json")) {
    return createFromTokens(req, a.user.id);
  }
  if (isOverloaded()) return overloadedResponse();
  const form = await req.formData();
  // Aceita 1..N vídeos no mesmo campo "file" — todos viram matéria-prima de UM corte
  const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return NextResponse.json({ error: "Envie pelo menos um arquivo de vídeo." }, { status: 400 });
  }
  if (files.length > MAX_VIDEOS) {
    return NextResponse.json({ error: `Máximo de ${MAX_VIDEOS} vídeos por projeto.` }, { status: 400 });
  }
  for (const f of files) {
    const ext = (path.extname(f.name) || ".mp4").toLowerCase();
    if (!ALLOWED.includes(ext)) {
      return NextResponse.json({ error: `Formato não suportado: ${f.name}` }, { status: 400 });
    }
  }

  const name = String(form.get("name") || files[0].name.replace(/\.[^.]+$/, ""));
  const goal = String(form.get("goal") || "");
  const platform = String(form.get("platform") || "tiktok");
  // Preferência de legenda (default: com legenda). "0"/"false" desliga.
  const captionsRaw = String(form.get("captions") ?? "1").toLowerCase();
  const captions = !(captionsRaw === "0" || captionsRaw === "false");

  const project = createProject({ name, goal, platform, userId: a.user.id });
  saveArtifact(project.id, "prefs", { captions });

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const ext = (path.extname(f.name) || ".mp4").toLowerCase();
    const dest = path.join(projectDir(project.id), `source_${i}${ext}`);
    const buf = Buffer.from(await f.arrayBuffer());
    fs.writeFileSync(dest, buf);
    createVideo({
      project_id: project.id,
      filename: f.name,
      path: dest,
      duration: 0,
      width: 0,
      height: 0,
      fps: 0,
      has_audio: 0,
      size: buf.length,
    });
  }

  // Processamento automático: entra na fila e responde imediatamente
  startPipeline(project.id);

  return NextResponse.json({ project, videos: files.length }, { status: 201 });
}
