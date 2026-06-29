// URL base da API.
// - Produção / rede local (LAN): usa NEXT_PUBLIC_API_URL (ex.: http://10.0.0.70:3003),
//   que permite testar pelo celular na mesma rede. Esse direcionamento NÃO muda.
// - Localhost (dev na própria máquina): fala direto com o backend local em
//   http://localhost:3003 — o MESMO servidor, só que pelo loopback. Apenas
//   ACRESCENTAMOS esse caso; quando o navegador não está em localhost, segue
//   usando o NEXT_PUBLIC_API_URL de sempre.
function resolveApiUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3003';
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';
}

export const API_URL = resolveApiUrl();

// Converte uma URL de imagem do CDN do Instagram para passar pelo nosso proxy.
// O CDN bloqueia hotlink via Cross-Origin-Resource-Policy; o proxy resolve isso.
export function proxiedImage(url?: string | null): string | null {
  if (!url) return null;
  if (!/cdninstagram\.com|fbcdn\.net/.test(url)) return url; // não é do IG → usa direto
  return `${API_URL}/api/instagram/image?url=${encodeURIComponent(url)}`;
}
