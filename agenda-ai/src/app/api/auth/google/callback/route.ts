import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { verifyLinkToken } from "@/lib/link";
import { createSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const statePayload = state ? await verifyLinkToken(state, "google_oauth_state") : null;
  if (!code || !statePayload) {
    return NextResponse.redirect(new URL("/login?error=oauth_invalido", env.APP_URL));
  }
  const linkUserId = typeof statePayload.linkUserId === "string" ? statePayload.linkUserId : undefined;
  const companyCid = typeof statePayload.companyCid === "string" ? statePayload.companyCid : undefined;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${env.APP_URL}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/login?error=token_google", env.APP_URL));
  }
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };

  const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  const info = (await infoRes.json()) as { email: string; name?: string; picture?: string };

  // ── Modo Empresa: a integração pertence à EMPRESA (não mexe na conta do usuário) ──
  if (companyCid) {
    await db.integration.upsert({
      where: { companyId_provider: { companyId: companyCid, provider: "google" } },
      update: {
        accessToken: encrypt(tokens.access_token),
        ...(tokens.refresh_token ? { refreshToken: encrypt(tokens.refresh_token) } : {}),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
        status: "active",
      },
      create: {
        companyId: companyCid,
        provider: "google",
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
      },
    });
    return NextResponse.redirect(new URL("/empresa?google=conectado", env.APP_URL));
  }

  let user: { id: string };
  if (linkUserId) {
    // Veio do WhatsApp: a identidade já existe (por telefone) — só anexa a integração.
    // Só assume o e-mail real do Google se ele ainda não pertencer a outra conta.
    const existing = await db.user.findUnique({ where: { id: linkUserId } });
    if (!existing) {
      return NextResponse.redirect(new URL("/login?error=usuario_nao_encontrado", env.APP_URL));
    }
    const emailTaken = await db.user.findFirst({
      where: { email: info.email, id: { not: linkUserId } },
    });
    user = await db.user.update({
      where: { id: linkUserId },
      data: {
        name: existing.name === "Usuário WhatsApp" ? info.name : existing.name,
        image: existing.image ?? info.picture,
        ...(emailTaken ? {} : { email: info.email }),
      },
    });
  } else {
    user = await db.user.upsert({
      where: { email: info.email },
      update: { name: info.name, image: info.picture },
      create: { email: info.email, name: info.name, image: info.picture },
    });
  }

  await db.integration.upsert({
    where: { userId_provider: { userId: user.id, provider: "google" } },
    update: {
      accessToken: encrypt(tokens.access_token),
      ...(tokens.refresh_token ? { refreshToken: encrypt(tokens.refresh_token) } : {}),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope,
      status: "active",
    },
    create: {
      userId: user.id,
      provider: "google",
      accessToken: encrypt(tokens.access_token),
      refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope,
    },
  });

  await createSession(user.id);
  return NextResponse.redirect(
    new URL(linkUserId ? "/?google=conectado" : "/", env.APP_URL),
  );
}
