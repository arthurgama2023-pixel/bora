import type { Metadata } from "next";
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
