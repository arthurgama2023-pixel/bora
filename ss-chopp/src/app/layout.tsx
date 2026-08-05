import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";
import { LocationProvider } from "@/lib/location-context";
import Header from "@/components/Header";
import LocationModal from "@/components/LocationModal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SS-Chopp Distribuidora",
  description: "Loja online da SS-Chopp: barris de chopp, equipamentos e combos para festa, churrasco e jogo.",
};

// Viewport mobile: largura do device, sem zoom automático. Deixamos o
// usuário ampliar até 5x (acessibilidade) — o que evita o "zoom ao tocar"
// é a fonte 16px nos inputs (ver globals.css), não travar o pinch-zoom.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#161616",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <LocationProvider>
          <CartProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <LocationModal />
          </CartProvider>
        </LocationProvider>
      </body>
    </html>
  );
}
