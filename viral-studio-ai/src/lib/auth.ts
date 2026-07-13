// Autenticação self-contained — zero dependências externas (segue a filosofia
// do projeto: node:sqlite, node:crypto, ffmpeg do sistema). Senha com scrypt
// salgado; sessão como cookie httpOnly assinado por HMAC (stateless, revogável
// por rotação de segredo). Em produção defina VIRAL_STUDIO_AUTH_SECRET.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { db, newId, storageRoot } from "./db";
import type { UserRow } from "./types";

export const SESSION_COOKIE = "vs_session";
const SESSION_TTL_DAYS = Number(process.env.VIRAL_STUDIO_SESSION_DAYS) || 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

// ---------- Segredo de assinatura ----------
let _secret: string | null = null;
function authSecret(): string {
  if (_secret) return _secret;
  if (process.env.VIRAL_STUDIO_AUTH_SECRET) {
    _secret = process.env.VIRAL_STUDIO_AUTH_SECRET;
    return _secret;
  }
  // Sem env: persiste um segredo aleatório para as sessões sobreviverem a
  // reinícios em dev. Em produção, SEMPRE defina a env (um segredo por instância
  // em disco não funciona com várias réplicas).
  const f = path.join(storageRoot(), ".auth-secret");
  try {
    _secret = fs.readFileSync(f, "utf8").trim();
    if (_secret) return _secret;
  } catch {
    /* ainda não existe */
  }
  _secret = crypto.randomBytes(32).toString("hex");
  try {
    fs.writeFileSync(f, _secret, { mode: 0o600 });
  } catch {
    /* fs read-only — segue em memória (rotaciona a cada boot) */
  }
  return _secret;
}

// ---------- Hash de senha (scrypt) ----------
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const hash = Buffer.from(hashHex, "hex");
  const test = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), hash.length);
  return hash.length === test.length && crypto.timingSafeEqual(hash, test);
}

// ---------- Sessão (cookie assinado) ----------
const b64url = (b: Buffer) => b.toString("base64url");

export function signSession(userId: string): string {
  const payload = b64url(Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL_MS })));
  const sig = b64url(crypto.createHmac("sha256", authSecret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = b64url(crypto.createHmac("sha256", authSecret()).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      uid: string;
      exp: number;
    };
    if (!uid || typeof exp !== "number" || exp < Date.now()) return null;
    return uid;
  } catch {
    return null;
  }
}

// Detecta se a conexão do cliente é realmente HTTPS (atrás de proxy, via
// x-forwarded-proto). Importa para o flag Secure: um cookie Secure é DESCARTADO
// pelo navegador sobre HTTP simples — ex.: acesso pelo IP da rede local
// (http://10.0.0.100:3040) ao rodar `npm run mobile` (produção). Sem esta
// detecção, o login "funciona" mas a sessão não persiste no celular.
function isHttps(req?: Request): boolean {
  if (!req) return process.env.NODE_ENV === "production";
  const xf = req.headers.get("x-forwarded-proto");
  if (xf) return xf.split(",")[0]!.trim() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function sessionCookieOptions(req?: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Secure só quando a conexão é HTTPS de fato (senão o Safari descarta o
    // cookie sobre HTTP e a sessão não gruda no celular).
    secure: isHttps(req),
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

// ---------- Usuário atual (server components + route handlers) ----------
export async function currentUser(): Promise<UserRow | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const uid = verifySessionToken(token);
  if (!uid) return null;
  return getUserById(uid) ?? null;
}

// ---------- CRUD de usuário ----------
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getUserByEmail(email: string): UserRow | undefined {
  return db().prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as UserRow | undefined;
}

export function getUserById(id: string): UserRow | undefined {
  return db().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function countUsers(): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
}

export function createUser(email: string, password: string): UserRow {
  const id = newId();
  db()
    .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
    .run(id, email.toLowerCase(), hashPassword(password), new Date().toISOString());
  return getUserById(id)!;
}

export function updateUserPassword(userId: string, password: string) {
  db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), userId);
}

// Atribui os projetos "órfãos" (user_id='default', anteriores ao login) ao dono.
// Chamado no primeiro cadastro para o criador não perder o trabalho existente.
export function claimDefaultProjects(userId: string): number {
  const r = db().prepare("UPDATE projects SET user_id = ? WHERE user_id = 'default'").run(userId);
  return Number(r.changes) || 0;
}

// ---------- Reset de senha ----------
export function createResetToken(userId: string): string {
  const token = crypto.randomBytes(24).toString("hex");
  const expires = Date.now() + 60 * 60 * 1000; // 1h
  db()
    .prepare("INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)")
    .run(token, userId, expires);
  return token;
}

export function consumeResetToken(token: string): string | null {
  const row = db()
    .prepare("SELECT user_id, expires_at FROM password_resets WHERE token = ?")
    .get(token) as { user_id: string; expires_at: number } | undefined;
  if (!row) return null;
  db().prepare("DELETE FROM password_resets WHERE token = ?").run(token);
  if (row.expires_at < Date.now()) return null;
  return row.user_id;
}
