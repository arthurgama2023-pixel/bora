import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agenda AI — sua agenda organizada por conversa",
  description:
    "Fale ou digite naturalmente e o Agenda AI cria, remarca e cancela compromissos no seu Google Calendar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
