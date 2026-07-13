// Autenticação por email/senha com JWT em cookie httpOnly.
//
// O projeto também traz clientes Supabase prontos (src/lib/supabase/*) —
// para migrar o auth para o Supabase gerenciado, troque as chamadas de
// login/register pelos métodos supabase.auth.signInWithPassword /
// signUp e mantenha getSession lendo a sessão do Supabase.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_HOURS,
  signSession,
  verifySessionToken,
  type Session,
} from "@/lib/session";
import { createUser, findUserByEmail, type DbUser } from "@/lib/db";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<DbUser> {
  const existing = await findUserByEmail(input.email);
  if (existing) throw new Error("Este email já está cadastrado.");
  return createUser({
    name: input.name,
    email: input.email,
    passwordHash: hashPassword(input.password),
  });
}

export async function authenticate(
  email: string,
  password: string,
): Promise<DbUser | null> {
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  return user;
}

export async function createSessionCookie(user: DbUser) {
  const token = await signSession({
    userId: user.id,
    email: user.email,
    name: user.name,
  });
  const store = await cookies(); // Next 16: cookies() é assíncrono
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_HOURS * 3600,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

/** Para route handlers já protegidos pelo proxy — falha alto se algo vazar. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");
  return session;
}
