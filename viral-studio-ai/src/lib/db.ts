// Camada de persistência — SQLite nativo do Node (zero dependências nativas).
// Em produção: trocar por Postgres atrás desta mesma interface (ver ARQUITETURA.md).
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { ProjectRow, VideoRow } from "./types";

const g = globalThis as unknown as { __vsdb?: DatabaseSync };

export function storageRoot() {
  return path.join(process.cwd(), "storage");
}

export function db(): DatabaseSync {
  if (!g.__vsdb) {
    fs.mkdirSync(storageRoot(), { recursive: true });
    const d = new DatabaseSync(path.join(storageRoot(), "db.sqlite"));
    d.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'default',
        name TEXT NOT NULL,
        goal TEXT NOT NULL DEFAULT '',
        platform TEXT NOT NULL DEFAULT 'tiktok',
        niche TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'processing',
        stage TEXT NOT NULL DEFAULT 'ingest',
        error TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        duration REAL DEFAULT 0,
        width INTEGER DEFAULT 0,
        height INTEGER DEFAULT 0,
        fps REAL DEFAULT 0,
        has_audio INTEGER DEFAULT 0,
        size INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        data TEXT,
        file_path TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_artifacts_project ON artifacts(project_id, kind);
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS profiles (
        user_id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS password_resets (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, created_at);
    `);
    g.__vsdb = d;
  }
  return g.__vsdb;
}

export const newId = () => crypto.randomBytes(8).toString("hex");
const now = () => new Date().toISOString();

// ---------- Projects ----------
export function createProject(p: { name: string; goal: string; platform: string; userId?: string }): ProjectRow {
  const id = newId();
  db()
    .prepare(
      "INSERT INTO projects (id, user_id, name, goal, platform, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(id, p.userId ?? "default", p.name, p.goal, p.platform, now());
  return getProject(id)!;
}

export function getProject(id: string): ProjectRow | undefined {
  return db().prepare("SELECT * FROM projects WHERE id = ?").get(id) as
    | ProjectRow
    | undefined;
}

// Lista os projetos de UM usuário (escopo de dono). Sem userId, retorna vazio —
// nunca vazar projetos de outra conta por engano.
export function listProjects(userId?: string): ProjectRow[] {
  if (!userId) return [];
  return db()
    .prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC LIMIT 50")
    .all(userId) as unknown as ProjectRow[];
}

export function updateProject(
  id: string,
  fields: Partial<Pick<ProjectRow, "status" | "stage" | "error" | "niche" | "name">>
) {
  for (const [k, v] of Object.entries(fields)) {
    db()
      .prepare(`UPDATE projects SET ${k} = ? WHERE id = ?`)
      .run(v as string, id);
  }
}

// ---------- Videos ----------
export function createVideo(v: Omit<VideoRow, "id">): VideoRow {
  const id = newId();
  db()
    .prepare(
      `INSERT INTO videos (id, project_id, filename, path, duration, width, height, fps, has_audio, size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, v.project_id, v.filename, v.path, v.duration, v.width, v.height, v.fps, v.has_audio, v.size);
  return { id, ...v };
}

export function getVideo(projectId: string): VideoRow | undefined {
  return db().prepare("SELECT * FROM videos WHERE project_id = ? ORDER BY rowid LIMIT 1").get(projectId) as
    | VideoRow
    | undefined;
}

// Todos os vídeos do projeto, na ordem de upload (rowid = ordem de inserção)
export function getVideos(projectId: string): VideoRow[] {
  return db()
    .prepare("SELECT * FROM videos WHERE project_id = ? ORDER BY rowid")
    .all(projectId) as unknown as VideoRow[];
}

export function updateVideo(id: string, fields: Partial<VideoRow>) {
  for (const [k, v] of Object.entries(fields)) {
    db().prepare(`UPDATE videos SET ${k} = ? WHERE id = ?`).run(v as never, id);
  }
}

// ---------- Artifacts ----------
export function saveArtifact(projectId: string, kind: string, data: unknown, filePath?: string) {
  db().prepare("DELETE FROM artifacts WHERE project_id = ? AND kind = ?").run(projectId, kind);
  db()
    .prepare(
      "INSERT INTO artifacts (id, project_id, kind, data, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(newId(), projectId, kind, data === undefined ? null : JSON.stringify(data), filePath ?? null, now());
}

export function getArtifact<T = unknown>(
  projectId: string,
  kind: string
): { data: T | null; file_path: string | null } | undefined {
  const row = db()
    .prepare("SELECT data, file_path FROM artifacts WHERE project_id = ? AND kind = ?")
    .get(projectId, kind) as { data: string | null; file_path: string | null } | undefined;
  if (!row) return undefined;
  return { data: row.data ? (JSON.parse(row.data) as T) : null, file_path: row.file_path };
}

export function listArtifacts(projectId: string) {
  return db()
    .prepare("SELECT kind, data, file_path FROM artifacts WHERE project_id = ? ORDER BY created_at")
    .all(projectId) as unknown as { kind: string; data: string | null; file_path: string | null }[];
}

// ---------- Events ----------
export function addEvent(projectId: string, stage: string, message: string) {
  db()
    .prepare("INSERT INTO events (project_id, stage, message, created_at) VALUES (?, ?, ?, ?)")
    .run(projectId, stage, message, now());
}

export function listEvents(projectId: string) {
  return db()
    .prepare("SELECT stage, message, created_at FROM events WHERE project_id = ? ORDER BY id")
    .all(projectId) as unknown as { stage: string; message: string; created_at: string }[];
}

// ---------- Perfil criativo (memória inteligente) ----------
export type CreatorProfile = {
  projects: number;
  approved: number;
  niches: Record<string, number>;
  rejectedDecisionTypes: Record<string, number>;
  avgOverallScore: number;
};

export function getProfile(userId = "default"): CreatorProfile {
  const row = db().prepare("SELECT data FROM profiles WHERE user_id = ?").get(userId) as
    | { data: string }
    | undefined;
  if (!row)
    return { projects: 0, approved: 0, niches: {}, rejectedDecisionTypes: {}, avgOverallScore: 0 };
  return JSON.parse(row.data) as CreatorProfile;
}

export function saveProfile(profile: CreatorProfile, userId = "default") {
  db()
    .prepare(
      "INSERT INTO profiles (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data"
    )
    .run(userId, JSON.stringify(profile));
}
