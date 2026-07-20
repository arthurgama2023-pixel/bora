import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env, hasGoogle } from "@/lib/env";
import { createLinkToken, verifyLinkToken } from "@/lib/link";
import { getSessionUserId } from "@/lib/session";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

export async function GET(req: NextRequest) {
  if (!hasGoogle) {
    return NextResponse.redirect(new URL("/login?error=google_nao_configurado", env.APP_URL));
  }

  // Fluxo iniciado a partir do WhatsApp: `link` já identifica o usuário (sem cookie de sessão).
  const link = req.nextUrl.searchParams.get("link");
  let linkUserId: string | undefined;
  if (link) {
    const payload = await verifyLinkToken(link, "google_connect");
    if (!payload || typeof payload.uid !== "string") {
      return NextResponse.redirect(new URL("/login?error=link_expirado", env.APP_URL));
    }
    linkUserId = payload.uid;
  }

  // Fluxo do MODO EMPRESA: conecta o Google Agenda DA EMPRESA do usuário logado.
  let companyCid: string | undefined;
  if (req.nextUrl.searchParams.get("company") === "1") {
    const uid = await getSessionUserId();
    const company = uid
      ? await db.company.findUnique({ where: { ownerUserId: uid }, select: { id: true } })
      : null;
    if (!company) {
      return NextResponse.redirect(new URL("/empresa?error=sem_empresa", env.APP_URL));
    }
    companyCid = company.id;
  }

  // `state` é assinado (não um cookie): sobrevive a webviews/navegadores que
  // descartam cookies no redirect de ida e volta para accounts.google.com.
  const state = await createLinkToken(
    { ...(linkUserId ? { linkUserId } : {}), ...(companyCid ? { companyCid } : {}) },
    "google_oauth_state",
    "10m",
  );

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${env.APP_URL}/api/auth/google/callback`,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
