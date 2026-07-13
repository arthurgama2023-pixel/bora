import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import PWARegister from "@/components/PWARegister";
import LogoutButton from "@/components/LogoutButton";
import { currentUser } from "@/lib/auth";

export const metadata: Metadata = {
  applicationName: "Viral Studio",
  title: "Viral Studio AI — Diretor Criativo de IA",
  description:
    "Envie o vídeo bruto. A IA entende, roteiriza, edita, legenda e entrega versões prontas para viralizar.",
  // iOS: abre em tela cheia como app quando adicionado à tela inicial
  appleWebApp: {
    capable: true,
    title: "Viral Studio",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // o editor controla o próprio zoom (pinça na timeline)
  userScalable: false,
  themeColor: "#0a0a12",
  viewportFit: "cover", // respeita o notch em telas com recorte
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="pt-BR">
      <body>
        <PWARegister />
        <div className="container">
          <header className="topbar">
            <Link href="/" className="brand" aria-label="Viral Studio — início">
              <span className="brand-mark">🎬</span>
              <h1>
                Viral <em>Studio</em>
              </h1>
            </Link>
            {user && (
              <div className="user-nav">
                <span className="user-email" title={user.email}>
                  {user.email}
                </span>
                <LogoutButton />
              </div>
            )}
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
