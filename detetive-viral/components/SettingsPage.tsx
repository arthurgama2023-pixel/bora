'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Smartphone, Shield, Bell } from 'lucide-react';
import { API_URL, proxiedImage } from '@/lib/api';

interface SettingsPageProps {
  profile: {
    name: string;
    instagram: string;
    niche: string;
    bio?: string;
    followers?: number;
    following?: number;
    posts?: number;
    profilePic?: string | null;
    verified?: boolean;
  };
  onBack: () => void;
  onChangeInstagram?: (newInstagram: string) => void;
}

// Formata números no estilo Instagram: 2.587 (pt-BR com ponto de milhar)
function fmt(n?: number): string {
  if (!n && n !== 0) return '—';
  return n.toLocaleString('pt-BR');
}

export default function SettingsPage({ profile, onBack, onChangeInstagram }: SettingsPageProps) {
  const [newInstagram, setNewInstagram] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Perfil exibido — começa com o que veio por prop e é enriquecido em background
  const [liveProfile, setLiveProfile] = useState(profile);

  // Inteligência automática: se faltam dados (posts/seguindo/foto), busca na API
  // em segundo plano e atualiza tela + localStorage — sem botão de sincronizar.
  useEffect(() => {
    const faltaDado = profile.posts === undefined || profile.following === undefined || !profile.profilePic;
    if (!faltaDado || !profile.instagram) return;

    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/instagram/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: profile.instagram }),
        });
        if (!res.ok || cancelado) return;
        const fresh = await res.json();
        const merged = { ...profile, ...fresh };
        setLiveProfile(merged);
        localStorage.setItem('detetiveviral_profile', JSON.stringify(merged));
      } catch {}
    })();

    return () => { cancelado = true; };
  }, [profile.instagram]);

  const p = liveProfile;

  const handleChangeInstagram = async () => {
    const handle = newInstagram.trim().replace(/^@/, '');
    if (!handle || loading) return;

    setLoading(true);
    setMessage(null);

    try {
      // Chamar API pra validar o Instagram
      const res = await fetch(`${API_URL}/api/instagram/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: handle }),
      });

      if (!res.ok) throw new Error('Instagram não encontrado');

      onChangeInstagram?.(handle);
      setMessage({ type: 'success', text: 'Instagram alterado com sucesso!' });
      setNewInstagram('');
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Erro ao alterar Instagram' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#c4c5d7] px-6 py-4 flex items-center gap-3">
          <button onClick={onBack} className="text-[#0037b0] hover:opacity-80">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-[#191c1e]">Configurações</h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Instagram Section - Layout nativo do Instagram */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-[#191c1e]">Perfil Identificado</h3>

            {/* Profile Card estilo Instagram */}
            <div className="border border-[#dbdbdb] rounded-xl p-5">
              {/* Linha: avatar + stats */}
              <div className="flex items-center gap-5">
                {/* Avatar com anel gradiente */}
                <div className="flex-shrink-0 p-[2.5px] rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
                  <div className="w-[72px] h-[72px] rounded-full bg-white p-[2px]">
                    <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                      {p.profilePic ? (
                        <img src={proxiedImage(p.profilePic) || undefined} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">📷</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats: posts / seguidores / seguindo */}
                <div className="flex-1 flex justify-around text-center">
                  <div>
                    <p className="text-base font-bold text-[#191c1e]">{fmt(p.posts)}</p>
                    <p className="text-sm text-[#737373]">posts</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-[#191c1e]">{fmt(p.followers)}</p>
                    <p className="text-sm text-[#737373]">seguidores</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-[#191c1e]">{fmt(p.following)}</p>
                    <p className="text-sm text-[#737373]">seguindo</p>
                  </div>
                </div>
              </div>

              {/* Username + verificado */}
              <div className="flex items-center gap-1.5 mt-4">
                <span className="font-semibold text-[#191c1e]">{p.instagram}</span>
                {p.verified && (
                  <svg className="w-4 h-4 text-[#3897f0]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l2.4 1.8 3 .3 1 2.8 2.2 2-1 2.9 1 2.9-2.2 2-1 2.8-3 .3L12 22l-2.4-1.8-3-.3-1-2.8-2.2-2 1-2.9-1-2.9 2.2-2 1-2.8 3-.3L12 2zm-1.3 13.2l5-5-1.2-1.2-3.8 3.8-1.7-1.7-1.2 1.2 2.9 2.9z"/>
                  </svg>
                )}
              </div>

              {/* Nome + bio */}
              <p className="text-sm font-semibold text-[#191c1e] mt-1">{p.name}</p>
              {p.bio && (
                <p className="text-sm text-[#191c1e] mt-0.5 whitespace-pre-line leading-snug">{p.bio}</p>
              )}

              {/* Badges: conectado + nicho */}
              <div className="flex items-center gap-2 mt-4">
                <span className="inline-flex items-center gap-1 bg-[#0095f6]/10 text-[#0095f6] text-xs font-semibold px-2.5 py-1 rounded-md">
                  ● Conectado
                </span>
                <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-600 text-xs font-semibold px-2.5 py-1 rounded-md">
                  ✨ {p.niche}
                </span>
              </div>
            </div>
          </div>

          {/* Add Instagram Section */}
          <div className="border-t border-[#c4c5d7] pt-6 space-y-3">
            <h3 className="font-bold text-[#191c1e]">Adicionar novo Instagram</h3>
            <div className="space-y-2">
              <input
                type="text"
                value={newInstagram}
                onChange={(e) => setNewInstagram(e.target.value)}
                placeholder="@seu_novo_instagram"
                className="w-full px-4 py-3 border border-[#c4c5d7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0037b0] text-sm"
              />
              <button
                onClick={handleChangeInstagram}
                disabled={loading || !newInstagram.trim()}
                className="w-full px-4 py-3 bg-gradient-to-r from-[#0037b0] to-[#890051] text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {loading ? 'Validando...' : 'Trocar Instagram'}
              </button>
            </div>
            {message && (
              <div className={`text-xs p-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {message.text}
              </div>
            )}
          </div>

          {/* Preferences Section */}
          <div className="border-t border-[#c4c5d7] pt-6 space-y-3">
            <div className="flex items-center gap-2">
              <Bell size={20} className="text-[#0037b0]" />
              <h3 className="font-bold text-[#191c1e]">Notificações</h3>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-[#434655]">Notificar novos reels virais</span>
            </label>
          </div>

          {/* Security Section */}
          <div className="border-t border-[#c4c5d7] pt-6 space-y-3">
            <div className="flex items-center gap-2">
              <Shield size={20} className="text-[#0037b0]" />
              <h3 className="font-bold text-[#191c1e]">Segurança</h3>
            </div>
            <button className="w-full px-4 py-3 border border-[#c4c5d7] text-[#0037b0] font-semibold rounded-xl hover:bg-[#f5f7fb] transition-all">
              Alterar senha
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
