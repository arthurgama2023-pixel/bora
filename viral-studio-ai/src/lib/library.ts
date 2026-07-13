// Biblioteca local de mídia — B-roll, música, SFX e imagens em assets/.
// Tags derivadas do nome do arquivo (ex.: "academia-treino-pesado.mp4" →
// tags academia, treino, pesado). O Editor IA busca por essas tags.
// Produção: substituir/complementar por Pexels (B-roll) e biblioteca
// licenciada tagueada (música/SFX) — mesma interface.
import fs from "node:fs";
import path from "node:path";

export type LibraryKind = "broll" | "music" | "sfx" | "image";

export type LibraryItem = {
  kind: LibraryKind;
  tag: string; // nome amigável (sem extensão)
  tokens: string[];
  path: string;
  filename: string;
};

const DIRS: Record<LibraryKind, { dir: string; exts: string[] }> = {
  broll: { dir: "assets/broll", exts: [".mp4", ".mov", ".webm", ".mkv"] },
  music: { dir: "assets/music", exts: [".mp3", ".m4a", ".wav", ".ogg"] },
  sfx: { dir: "assets/sfx", exts: [".mp3", ".m4a", ".wav", ".ogg"] },
  image: { dir: "assets/images", exts: [".png", ".jpg", ".jpeg", ".webp"] },
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function scanLibrary(kind?: LibraryKind): LibraryItem[] {
  const kinds = kind ? [kind] : (Object.keys(DIRS) as LibraryKind[]);
  const items: LibraryItem[] = [];
  for (const k of kinds) {
    const dir = path.join(process.cwd(), DIRS[k].dir);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const ext = path.extname(f).toLowerCase();
      if (!DIRS[k].exts.includes(ext)) continue;
      const tag = f.slice(0, -ext.length);
      items.push({
        kind: k,
        tag,
        tokens: norm(tag).split(/[-_ ]+/).filter(Boolean),
        path: path.join(dir, f),
        filename: f,
      });
    }
  }
  return items;
}

// Busca por sobreposição de tokens ("b-roll de academia" acha "academia-treino")
export function findLibrary(kind: LibraryKind, query: string): LibraryItem | null {
  const items = scanLibrary(kind);
  if (items.length === 0) return null;
  const qTokens = norm(query).split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  let best: LibraryItem | null = null;
  let bestScore = 0;
  for (const item of items) {
    const score = item.tokens.filter((t) => qTokens.some((q) => q.includes(t) || t.includes(q))).length;
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best ?? items[0]; // sem match: devolve o primeiro (melhor que falhar)
}

export function libraryCatalog(): string {
  const items = scanLibrary();
  if (items.length === 0) return "(biblioteca local vazia)";
  const byKind = new Map<string, string[]>();
  for (const i of items) {
    const arr = byKind.get(i.kind) ?? [];
    arr.push(i.tag);
    byKind.set(i.kind, arr);
  }
  return [...byKind.entries()].map(([k, tags]) => `${k}: ${tags.join(", ")}`).join("\n");
}
