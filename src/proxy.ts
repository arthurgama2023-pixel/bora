import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

const PUBLIC_PATHS = ["/login", "/api/v1/auth/login"];
// Rotas de integração externa: sem cookie de sessão, autenticadas pelo próprio
// token (webhook do Evolution via ?token=; keep-alive via KEEPALIVE_TOKEN opcional).
const PUBLIC_PREFIXES = ["/api/webhooks/", "/api/whatsapp/keepalive", "/api/public/"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (PUBLIC_PATHS.includes(pathname)) {
    if (pathname === "/login" && session) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 },
      );
    }
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
