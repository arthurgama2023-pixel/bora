// Sistema de cache para dados de perfis analisados
// Permite carregar análises anteriores sem gastar créditos

export interface ProfileCache {
  timestamp: number;
  profile: any;
  frequencyData: any;
  videos: any[];
  aiAnalysis: any;
}

const CACHE_KEY_PREFIX = 'detetiveviral_cache_';

export function saveProfileCache(instagram: string, data: ProfileCache) {
  try {
    const key = `${CACHE_KEY_PREFIX}${instagram.toLowerCase()}`;
    localStorage.setItem(key, JSON.stringify(data));
    console.log(`✅ Cache salvo para @${instagram}`);
  } catch (e) {
    console.error('Erro ao salvar cache do perfil:', e);
  }
}

export function loadProfileCache(instagram: string): ProfileCache | null {
  try {
    const key = `${CACHE_KEY_PREFIX}${instagram.toLowerCase()}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      const data = JSON.parse(cached);
      console.log(`📦 Cache carregado para @${instagram}`, data);
      return data;
    }
  } catch (e) {
    console.error('Erro ao carregar cache do perfil:', e);
  }
  return null;
}

export function clearProfileCache(instagram: string) {
  try {
    const key = `${CACHE_KEY_PREFIX}${instagram.toLowerCase()}`;
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Erro ao limpar cache:', e);
  }
}
