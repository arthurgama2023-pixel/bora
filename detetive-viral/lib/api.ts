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
      return 'http://localhost:9000'; // backend admin está rodando na 9000
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000';
}

export const API_URL = resolveApiUrl();

// Converte uma URL de imagem do CDN do Instagram para passar pelo nosso proxy.
// O CDN bloqueia hotlink via Cross-Origin-Resource-Policy; o proxy resolve isso.
export function proxiedImage(url?: string | null): string | null {
  if (!url) return null;
  if (!/cdninstagram\.com|fbcdn\.net/.test(url)) return url; // não é do IG → usa direto
  return `${API_URL}/api/instagram/image?url=${encodeURIComponent(url)}`;
}

// ── CONTA ↔ @ VINCULADO ─────────────────────────────────────────────────────
// O backend persiste o @ ligado ao user_id (fonte da verdade cross-device).
// Todas as chamadas mandam o access_token do Supabase no header Authorization.

export interface LinkedProfile {
  instagram: string;
  nicho: string | null;
  niche_key?: string | null;
  hashtags?: string[] | null;
  name?: string | null;
  profilePic?: string | null;
  followers?: number | null;
}

// Vincula/atualiza o @ da conta logada. Retorna o perfil salvo ou lança erro.
export async function linkProfile(instagram: string, token: string): Promise<LinkedProfile> {
  const res = await fetch(`${API_URL}/api/user/link-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ instagram_username: instagram }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Falha ao vincular perfil');
  return res.json();
}

// Lê o @ vinculado à conta. Retorna null se ainda não vinculou (404).
export async function getUserProfile(token: string): Promise<LinkedProfile | null> {
  const res = await fetch(`${API_URL}/api/user/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Falha ao buscar perfil vinculado');
  return res.json();
}
