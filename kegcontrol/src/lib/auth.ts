import { cookies } from "next/headers";
import type { Role } from "./enums";
import { ApiError } from "./errors";
import {
  SESSION_COOKIE,
  SESSION_HOURS,
  signSession,
  verifySessionToken,
  type Session,
} from "./session-token";

export { SESSION_COOKIE, signSession, verifySessionToken };
export type { Session };

export async function createSessionCookie(session: Session) {
  const token = await signSession(session);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function destroySessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new ApiError(401, "Não autenticado");
  return session;
}

export function assertRole(session: Session, roles: Role[]) {
  if (!roles.includes(session.role)) {
    throw new ApiError(403, "Sem permissão para esta operação");
  }
}
