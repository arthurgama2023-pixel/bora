// Assinatura/verificação do JWT de sessão — sem dependências de request
// (usável tanto no proxy quanto em route handlers e server components).
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./enums";

export const SESSION_COOKIE = "kc_session";
export const SESSION_HOURS = 8;

function secret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET ?? "kegcontrol-dev-secret",
  );
}

export type Session = {
  userId: string;
  companyId: string;
  role: Role;
  name: string;
  email: string;
};

export async function signSession(session: Session): Promise<string> {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
}

export async function verifySessionToken(
  token: string,
): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}
