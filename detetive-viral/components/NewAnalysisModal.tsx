'use client';

import { useState, useEffect } from 'react';
import { X, RotateCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { loadProfileCache } from '@/lib/profileCache';

interface NewAnalysisModalProps {
  onClose: () => void;
  onAnalyze: (instagram: string, cachedData?: any) => void;
}

export default function NewAnalysisModal({ onClose, onAnalyze }: NewAnalysisModalProps) {
  const [instagram, setInstagram] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzedProfiles, setAnalyzedProfiles] = useState<string[]>([]);
  const { signOut } = useAuth();

  const loadAnalyzedProfiles = () => {
    try {
      const stored = localStorage.getItem('detetiveviral_analyzed_profiles');
      console.log('📦 Perfis no localStorage:', stored);
      if (stored) {
        const profiles = JSON.parse(stored);
        console.log('✅ Perfis carregados:', profiles);
        setAnalyzedProfiles(Array.isArray(profiles) ? profiles.slice(0, 5) : []);
      }
    } catch (e) {
      console.error('Erro ao carregar perfis analisados:', e);
    }
  };

  useEffect(() => {
    loadAnalyzedProfiles();

    // Listener para recarregar perfis se localStorage muda (ex: outra aba)
    const handleStorageChange = () => {
      loadAnalyzedProfiles();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleAnalyze = async (handle?: string) => {
    const profileHandle = (handle || instagram.trim().replace(/^@/, '')).trim().replace(/^@/, '');
    if (!profileHandle) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('http://localhost:3003/api/instagram/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: profileHandle }),
      });

      if (!res.ok) throw new Error('Perfil não encontrado');

      // Salva no histórico
      try {
        const stored = localStorage.getItem('detetiveviral_analyzed_profiles') || '[]';
        const profiles = JSON.parse(stored);
        const updated = [profileHandle, ...profiles.filter((p: string) => p !== profileHandle)].slice(0, 10);
        localStorage.setItem('detetiveviral_analyzed_profiles', JSON.stringify(updated));
      } catch (e) {
        console.error('Erro ao salvar histórico:', e);
      }

      onAnalyze(profileHandle);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao validar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshProfiles = () => {
    try {
      const stored = localStorage.getItem('detetiveviral_analyzed_profiles');
      if (stored) {
        const profiles = JSON.parse(stored);
        setAnalyzedProfiles(Array.isArray(profiles) ? profiles.slice(0, 5) : []);
      }
    } catch (e) {
      console.error('Erro ao recarregar perfis:', e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
      <div className="bg-white w-full md:max-w-sm md:rounded-2xl rounded-t-3xl md:shadow-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[600px]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-black">Analisar perfil</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshProfiles}
              className="p-1 hover:opacity-60 transition-opacity"
              title="Recarregar perfis analisados"
            >
              <RotateCw size={20} className="text-gray-600" />
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:opacity-60 transition-opacity"
            >
              <X size={24} className="text-black" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 md:px-6 py-6 space-y-5 flex-1 overflow-y-auto">
          <p className="text-sm text-gray-500">
            Digite o @ de um perfil Instagram para analisar as tendências do nicho
          </p>


          {/* Input */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-600 uppercase">Digite um @</p>
            <input
              type="text"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              placeholder="username"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-0 focus:bg-white focus:border-black text-sm text-black placeholder-gray-400 transition-colors"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Perfis analisados */}
          {analyzedProfiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase">Perfis analisados</p>
              <div className="grid grid-cols-2 gap-2">
                {analyzedProfiles.map((profile) => (
                  <button
                    key={profile}
                    onClick={() => {
                      setInstagram(profile);
                      const cached = loadProfileCache(profile);
                      if (cached) {
                        console.log(`📂 Carregando dados salvos de @${profile}...`);
                        onAnalyze(profile, cached);
                        onClose();
                      } else {
                        handleAnalyze(profile);
                      }
                    }}
                    disabled={loading}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg text-sm text-gray-800 font-medium transition-colors truncate"
                  >
                    @{profile}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 font-semibold text-black rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAnalyze}
              disabled={loading || !instagram.trim()}
              className="flex-1 py-3 px-4 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Buscando...' : 'Analisar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
