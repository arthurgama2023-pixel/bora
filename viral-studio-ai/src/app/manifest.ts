import type { MetadataRoute } from "next";

// Manifest do PWA — Next serve em /manifest.webmanifest e injeta o <link> no head.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Viral Studio AI — Diretor Criativo",
    short_name: "Viral Studio",
    description:
      "Envie o vídeo bruto. A IA entende, edita, legenda e entrega versões prontas para viralizar — e você ajusta tudo num editor com IA.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a12",
    theme_color: "#0a0a12",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["photo", "video", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
