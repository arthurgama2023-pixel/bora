import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";
import { LocationProvider } from "@/lib/location-context";
import Header from "@/components/Header";
import LocationModal from "@/components/LocationModal";

// Google Tag Manager — container configurado pelo gestor de tráfego (Google Ads,
// conversões etc.). Snippet oficial do GTM: init via next/script + <noscript>.
const GTM_ID = "GTM-N5NKHSH9";

const GTM_INIT = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`;

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
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <Script id="gtm-init" strategy="afterInteractive">
          {GTM_INIT}
        </Script>
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
