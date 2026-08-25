'use client';

import { useState } from 'react';
import { Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface ProfileAnalyzerProps {
  instagram: string;
  onProfileLoaded: (profile: any) => void;
  onNicheDetected: (niche: string) => void;
}

export default function ProfileAnalyzer({
  instagram,
  onProfileLoaded,
  onNicheDetected,
}: ProfileAnalyzerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);

  const analyzeProfile = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Buscar perfil
      console.log(`[ProfileAnalyzer] Buscando perfil: ${instagram}`);
      const profileRes = await fetch(`${API_URL}/api/instagram/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: instagram }),
      });

      if (!profileRes.ok) {
        const err = await profileRes.json();
        throw new Error(err.error || 'Erro ao buscar perfil');
      }

      const profileData = await profileRes.json();
      setProfile(profileData);
      onProfileLoaded(profileData);

      // 2. Detectar nicho da biografia
      console.log(`[ProfileAnalyzer] Detectando nicho...`);
      const bio = (profileData.biography || '').toLowerCase();
      let detectedNiche = 'geral';
      const nicheKeywords: { [key: string]: string[] } = {
        'ia': ['ia', 'inteligencia', 'automacao', 'chatgpt', 'tecnologia'],
        'marketing': ['marketing', 'social', 'conteudo', 'estrategia', 'vendas'],
        'negocios': ['negocios', 'empreendedorismo', 'entrepreneur']
      };
      for (const [niche, keywords] of Object.entries(nicheKeywords)) {
        if (keywords.some(kw => bio.includes(kw))) {
          detectedNiche = niche;
          break;
        }
      }
      onNicheDetected(detectedNiche);
      console.log(`[ProfileAnalyzer] Nicho detectado: ${detectedNiche}`);
      // A busca de vídeos é disparada pelo Dashboard (evita duplo-fetch / custo duplo no Apify)

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      console.error('[ProfileAnalyzer] Erro:', message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-blue-50 rounded-lg p-4 flex items-center gap-3">
        <Loader className="animate-spin text-blue-600" size={20} />
        <div>
          <p className="font-semibold text-slate-900">Analisando perfil...</p>
          <p className="text-sm text-slate-600">Buscando dados do Instagram via Apify</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-lg p-4 flex gap-3">
        <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
        <div>
          <p className="font-semibold text-red-900">Erro ao analisar</p>
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={analyzeProfile}
            className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (profile) {
    return (
      <div className="bg-green-50 rounded-lg p-4 flex gap-3">
        <CheckCircle className="text-green-600 flex-shrink-0 mt-1" size={20} />
        <div className="flex-1">
          <p className="font-semibold text-green-900">Perfil analisado com sucesso!</p>
          <p className="text-sm text-green-700 mt-1">
            <strong>@{profile.username}</strong> • <strong>{profile.followers.toLocaleString()}</strong> seguidores
          </p>
          <p className="text-sm text-green-600 mt-1">
            Análise completa em background — seus dados estarão prontos em breve!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 rounded-lg p-4 flex items-center gap-3">
      <div className="flex-1">
        <p className="font-semibold text-slate-900">Pronto para analisar?</p>
        <p className="text-sm text-slate-600">
          Vamos conectar com o Instagram de <strong>{instagram}</strong>
        </p>
      </div>
      <button
        onClick={analyzeProfile}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
      >
        Analisar Perfil
      </button>
    </div>
  );
}
