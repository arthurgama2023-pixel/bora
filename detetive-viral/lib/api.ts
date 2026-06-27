// URL base da API. Em produção, defina NEXT_PUBLIC_API_URL no ambiente.
// Em dev, cai no localhost:3003.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

// Converte uma URL de imagem do CDN do Instagram para passar pelo nosso proxy.
// O CDN bloqueia hotlink via Cross-Origin-Resource-Policy; o proxy resolve isso.
export function proxiedImage(url?: string | null): string | null {
  if (!url) return null;
  if (!/cdninstagram\.com|fbcdn\.net/.test(url)) return url; // não é do IG → usa direto
  return `${API_URL}/api/instagram/image?url=${encodeURIComponent(url)}`;
}
