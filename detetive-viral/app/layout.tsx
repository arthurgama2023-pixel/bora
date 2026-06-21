import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { VideosProvider } from "@/context/VideosContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Radar de Tendências",
  description: "Descubra reels virais no seu nicho",
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
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#f7f9fb]" suppressHydrationWarning>
        <script>
          {`window.API_URL = '${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}'`}
        </script>
        <VideosProvider>
          {children}
        </VideosProvider>
      </body>
    </html>
  );
}
