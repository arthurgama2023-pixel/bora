import path from "node:path";
import fs from "node:fs";
import { storageRoot } from "./db";

export function projectDir(projectId: string) {
  const dir = path.join(storageRoot(), "projects", projectId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function rendersDir(projectId: string) {
  const dir = path.join(projectDir(projectId), "renders");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function framesDir(projectId: string) {
  const dir = path.join(projectDir(projectId), "frames");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// URL pública servida por /api/media/[projectId]/[...file]
export function mediaUrl(projectId: string, absPath: string) {
  const rel = path.relative(projectDir(projectId), absPath).split(path.sep).join("/");
  return `/api/media/${projectId}/${rel}`;
}

const SAFE = /^[a-zA-Z0-9._-]+$/;

// Resolve caminho seguro dentro do diretório do projeto (anti path-traversal)
export function resolveMediaPath(projectId: string, parts: string[]): string | null {
  if (!SAFE.test(projectId)) return null;
  for (const p of parts) if (!SAFE.test(p) || p === "." || p === "..") return null;
  const base = projectDir(projectId);
  const abs = path.join(base, ...parts);
  // Compara com separador no fim: senão ".../projects/abc" casaria com um irmão
  // ".../projects/abcd" (prefixo). Exigir o separador impede o vazamento lateral.
  if (abs !== base && !abs.startsWith(base + path.sep)) return null;
  return abs;
}
