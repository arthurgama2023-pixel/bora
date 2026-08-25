// Assinatura/verificação do JWT de sessão — sem dependências de request,
// usável no proxy, em route handlers e em server components.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "metaai_session";
export const SESSION_HOURS = 24 * 7;

function secret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET ?? "metaai-dev-secret",
  );
}

export type Session = {
  userId: string;
  email: string;
  name: string;
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
