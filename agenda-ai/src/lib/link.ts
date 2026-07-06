import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/lib/env";

// Tokens assinados de curta duração para fluxos sem cookie de sessão — usados
// quando o WhatsApp precisa levar o usuário a uma etapa que só existe no navegador
// (ex.: consentimento OAuth do Google). A assinatura + expiração cumprem o papel
// que um cookie de CSRF cumpriria, sem depender do navegador manter cookies
// entre o redirect para accounts.google.com e a volta (comum falhar em webviews).
const key = new TextEncoder().encode(env.AUTH_SECRET);

export async function createLinkToken(
  claims: Record<string, unknown>,
  purpose: string,
  ttl = "15m",
): Promise<string> {
  return new SignJWT({ ...claims, purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(key);
}

export async function verifyLinkToken(
  token: string,
  purpose: string,
): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key);
    if (payload.purpose !== purpose) return null;
    return payload;
  } catch {
    return null;
  }
}
