'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Settings, Loader } from 'lucide-react';
import ReelCard from './ReelCard';
import RoteiroPanel from './RoteiroPanel';
import { useVideos } from '@/context/VideosContext';
import { API_URL } from '@/lib/api';

interface DashboardProps {
  profile: {
    name: string;
    instagram: string;
    niche: string;
    painPoints: string;
    desires: string;
  };
  onRestart: () => void;
}

interface Reel {
  id: string;
  creator: string;
  creatorHandle: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  description: string;
  caption?: string;
  hashtags?: string[];
  theme: string;
  engagementRate: number;
  viralityScore?: number;
  thumbnail?: string;
  videoUrl?: string;
  postUrl?: string;
  timestamp?: string;
  publishedAt?: string;
}

export default function Dashboard({ profile, onRestart }: DashboardProps) {
  const [selectedReel, setSelectedReel] = useState<Reel | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { videos, loading, setVideos, setLoading, aiAnalysis, setAiAnalysis, videosViral, setVideosViral } = useVideos();
  const [mode, setMode] = useState<'autoridade' | 'viralizacao'>('viralizacao');
  const [currentTab, setCurrentTab] = useState<'instagram' | 'tiktok' | 'arquetipo'>('instagram');
  const [tiktokVideos, setTiktokVideos] = useState<Reel[]>([]);
  const [tiktokLoading, setTiktokLoading] = useState(false);
  const [userArchetype, setUserArchetype] = useState<string | null>(null);
  const [archetypeAnalysis, setArchetypeAnalysis] = useState<any>(null);
  const [linkInput, setLinkInput] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Cola um link de reel → yt-dlp extrai o vídeo → abre o RoteiroPanel (Gemini + Claude)
  const handleGerarDeLink = async () => {
    if (!linkInput.trim() || linkLoading) return;
    setLinkLoading(true);
    setLinkError(null);
    try {
      const res = await fetch(`${API_URL}/api/resolve-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não consegui ler esse link.');
      setSelectedReel(data.reel);
      setLinkInput('');
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : 'Erro ao ler o link');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleRefreshTrends = async () => {
    setIsRefreshing(true);
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/videos/from-user-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instagram_username: profile.instagram,
          limit: 40,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.nicho) {
          setAiAnalysis({ nicho: data.nicho, hashtags: data.hashtags || [], confianca: data.confianca || '—' });
        }
        setVideosViral(data.viralizacao || []);
        const lista = data.autoridade || data.videos || [];
        if (lista.length > 0) {
          setVideos(lista);
          setLastUpdated(new Date());
          console.log('✅ Tendências atualizadas com sucesso!');
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar tendências:', error);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const handleLoadTikTok = async () => {
    setTiktokLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/tiktok/trending-by-niche`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: aiAnalysis?.nicho || profile.niche,
          limit: 40,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTiktokVideos(data.videos || []);
        console.log('✅ Vídeos TikTok carregados!');
      }
    } catch (error) {
      console.error('Erro ao carregar TikTok:', error);
    } finally {
      setTiktokLoading(false);
    }
  };

  useEffect(() => {
    if (!profile.instagram) return;
    console.log(`📱 Novo perfil @${profile.instagram} — zerando dados anteriores`);
    setVideos([]);
    setVideosViral([]);
    setAiAnalysis(null);
    setLastUpdated(null);
    setSelectedReel(null);
    setMode('viralizacao');

    // Carregar arquétipo do localStorage se existir
    try {
      const savedArchetype = localStorage.getItem('userArchetype');
      const savedAnalysis = localStorage.getItem('archetypeAnalysis');
      if (savedArchetype) setUserArchetype(savedArchetype);
      if (savedAnalysis) setArchetypeAnalysis(JSON.parse(savedAnalysis));
    } catch (e) {
      console.log('Erro ao carregar arquétipo:', e);
    }

    handleRefreshTrends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.instagram]);

  const displayVideos = mode === 'autoridade' ? videos : videosViral;
  const formattedTime = lastUpdated ? lastUpdated.toLocaleTimeString('pt-BR') : '';

  return (
    <div className="flex min-h-screen bg-[#f7f9fb]">
      {/* Sidebar */}
      <aside className="w-64 fixed left-0 top-0 h-screen border-r border-[#c4c5d7] bg-[#f7f9fb] flex flex-col gap-2 p-4 z-50">
        <div className="px-4 py-6 mb-4">
          <h1 className="text-xl font-bold text-[#191c1e]">Radar de Tendências</h1>
          <p className="text-xs text-[#434655] opacity-70">Inteligência de Reels</p>
        </div>
        <nav className="flex-1 space-y-1">
          <button
            onClick={() => setCurrentTab('instagram')}
            className={`w-full flex items-center gap-4 px-4 py-2 rounded-lg font-semibold transition-all ${
              currentTab === 'instagram'
                ? 'bg-[#8455ef] text-white'
                : 'text-[#434655] hover:bg-[#e0e3e5]'
            }`}
          >
            <span className="material-symbols-outlined">movie</span>
            <span className="text-sm">Instagram</span>
          </button>
          <button
            onClick={() => {
              setCurrentTab('tiktok');
              if (tiktokVideos.length === 0) {
                handleLoadTikTok();
              }
            }}
            className={`w-full flex items-center gap-4 px-4 py-2 rounded-lg font-semibold transition-all ${
              currentTab === 'tiktok'
                ? 'bg-[#8455ef] text-white'
                : 'text-[#434655] hover:bg-[#e0e3e5]'
            }`}
          >
            <span className="material-symbols-outlined">music_note</span>
            <span className="text-sm">TikTok</span>
          </button>
          <button
            onClick={() => setCurrentTab('arquetipo')}
            className={`w-full flex items-center gap-4 px-4 py-2 rounded-lg font-semibold transition-all ${
              currentTab === 'arquetipo'
                ? 'bg-[#8455ef] text-white'
                : 'text-[#434655] hover:bg-[#e0e3e5]'
            }`}
          >
            <span className="material-symbols-outlined">person</span>
            <span className="text-sm">Arquétipo</span>
          </button>
          <a
            href="#"
            className="flex items-center gap-4 px-4 py-2 rounded-lg text-[#434655] hover:bg-[#e0e3e5] transition-all"
          >
            <span className="material-symbols-outlined">settings</span>
            <span className="text-sm">Configurações</span>
          </a>
        </nav>
        <div className="p-4 bg-[#dce1ff]/10 rounded-xl">
          <p className="text-sm font-bold text-[#0037b0] mb-1">Plano Premium</p>
          <p className="text-xs text-[#434655] mb-3">Acesso total às métricas virais.</p>
          <button className="w-full bg-[#0037b0] text-white py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity">
            Upgrade Pro
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 w-[calc(100%-256px)] min-h-screen">
        {/* TopNavBar */}
        <header className="fixed top-0 right-0 w-[calc(100%-256px)] z-40 bg-[#f7f9fb]/85 border-b border-[#c4c5d7] backdrop-blur-sm flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-3 bg-[#e0e3e5] px-4 py-2 rounded-full">
            <span className="material-symbols-outlined text-[#0037b0]">search</span>
            <span className="text-sm text-[#434655]">Buscar reels...</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-[#434655] cursor-pointer hover:text-[#0037b0] transition-colors">
                notifications
              </span>
              <span className="material-symbols-outlined text-[#434655] cursor-pointer hover:text-[#0037b0] transition-colors">
                help
              </span>
            </div>
            <div className="h-8 w-px bg-[#c4c5d7]"></div>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 border border-[#c4c5d7] text-[#434655] text-xs font-semibold rounded-lg hover:bg-[#e0e3e5] transition-colors">
                Suporte
              </button>
              <button
                onClick={onRestart}
                className="px-4 py-2 bg-[#0037b0] text-white text-xs font-semibold rounded-lg hover:shadow-lg transition-all"
              >
                Editar Perfil
              </button>
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#dce1ff]">
                <div className="w-full h-full bg-gradient-to-br from-[#0037b0] to-[#890051]"></div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Canvas */}
        <section className="pt-24 p-6 space-y-6">
          {currentTab !== 'arquetipo' && (
            <>
              {/* Header Section */}
              <div className="flex justify-between items-end mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[#0037b0]">movie_filter</span>
                    <h2 className="text-3xl font-bold text-[#191c1e]">Radar de Tendências</h2>
                  </div>
                  <p className="text-sm text-[#434655]">
                    Análise de reels virais para <span className="font-bold text-[#191c1e]">{profile.name}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 bg-white border border-[#c4c5d7] rounded-xl text-xs font-semibold text-[#434655] hover:border-[#0037b0] transition-all">
                    <span className="material-symbols-outlined text-lg">share</span>
                    Exportar
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Gerar roteiro a partir de um link */}
          {currentTab !== 'arquetipo' && (
            <div className="bg-white border border-[#c4c5d7] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-[#0037b0]" style={{ fontVariationSettings: "'FILL' 1" }}>link</span>
                <h3 className="text-lg font-bold text-[#191c1e]">Gerar roteiro de um link</h3>
              </div>
              <p className="text-sm text-[#434655] mb-3">
                Cole o link de um reel (Instagram ou TikTok). A IA traz o vídeo e monta o roteiro completo.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGerarDeLink()}
                  placeholder="https://www.instagram.com/reel/..."
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-[#c4c5d7] focus:border-[#0037b0] focus:outline-none text-sm text-[#191c1e] transition-colors"
                />
                <button
                  onClick={handleGerarDeLink}
                  disabled={linkLoading || !linkInput.trim()}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#0037b0] hover:bg-[#002a8a] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {linkLoading ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      Lendo o vídeo...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                      Gerar roteiro
                    </>
                  )}
                </button>
              </div>
              {linkError && (
                <p className="text-sm text-[#ba1a1a] mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">error</span>
                  {linkError}
                </p>
              )}
            </div>
          )}

          {/* Reels/TikTok Section */}
          {currentTab !== 'arquetipo' && (
          <div className="space-y-4 pt-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-[#191c1e] text-3xl">
                  {currentTab === 'instagram' ? 'movie' : 'music_note'}
                </span>
                <div>
                  <h3 className="text-2xl font-bold">
                    {currentTab === 'instagram' ? 'Reels Virais Similares' : 'TikToks em Alta'}
                  </h3>
                  {currentTab === 'tiktok' && (
                    <p className="text-sm text-[#747686] mt-1">
                      Nicho: <span className="font-semibold text-[#191c1e]">{aiAnalysis?.nicho || profile.niche}</span>
                    </p>
                  )}
                </div>
                {(currentTab === 'instagram' ? displayVideos : tiktokVideos).length > 0 && (
                  <div className="flex items-center gap-2 bg-[#e0e3e5] px-4 py-2 rounded-full">
                    <span className="material-symbols-outlined text-sm text-[#ba1a1a]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      push_pin
                    </span>
                    <span className="text-xs font-semibold text-[#434655] uppercase tracking-wider">
                      {(currentTab === 'instagram' ? displayVideos : tiktokVideos).length} Vídeos · {currentTab === 'instagram' && mode === 'autoridade' ? 'Maiores e mais engajados' : currentTab === 'instagram' ? 'Explodindo agora' : 'Mais virais'}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {lastUpdated && (
                  <p className="text-xs text-[#434655] flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">schedule</span> Atualizado: {formattedTime}
                  </p>
                )}
                <button
                  onClick={handleRefreshTrends}
                  disabled={isRefreshing}
                  className="flex items-center gap-2 px-4 py-2 border-2 border-[#0037b0]/40 text-[#0037b0] rounded-xl text-xs font-semibold hover:bg-[#0037b0] hover:text-white transition-all group"
                >
                  <span
                    className="material-symbols-outlined text-lg group-hover:rotate-180 transition-transform"
                    style={{ fontVariationSettings: "'FILL' 0" }}
                  >
                    sync
                  </span>
                  {isRefreshing ? 'Buscando...' : 'Buscar Novo Nicho'}
                </button>
              </div>
            </div>

            {/* Tabs/Filters - só mostrar no Instagram */}
            {currentTab === 'instagram' && (videos.length > 0 || videosViral.length > 0) && (
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('viralizacao')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    mode === 'viralizacao'
                      ? 'bg-white border border-[#c4c5d7] shadow-sm'
                      : 'bg-[#e0e3e5] text-[#434655] hover:bg-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">rocket_launch</span>
                  Viralização
                </button>
                <button
                  onClick={() => setMode('autoridade')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    mode === 'autoridade'
                      ? 'bg-white border border-[#c4c5d7] shadow-sm'
                      : 'bg-[#e0e3e5] text-[#434655] hover:bg-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                    emoji_events
                  </span>
                  Autoridade
                </button>
              </div>
            )}

            {/* Video Grid / TikTok / Arquétipo */}
            {currentTab === 'instagram' ? (
              <>
                {loading && videos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="animate-spin mb-4">
                      <Loader size={40} className="text-[#0037b0]" />
                    </div>
                    <p className="text-[#191c1e] font-semibold">Buscando reels virais do nicho...</p>
                    <p className="text-sm text-[#434655] mt-2">Isso pode levar alguns minutos</p>
                  </div>
                ) : displayVideos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {displayVideos.map((reel) => (
                      <ReelCard
                        key={reel.id}
                        reel={reel}
                        selected={selectedReel?.id === reel.id}
                        onClick={() => setSelectedReel(reel)}
                        isPlaying={playingVideoId === reel.id}
                        onPlayStart={() => setPlayingVideoId(reel.id)}
                        onPlayStop={() => setPlayingVideoId(null)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white rounded-lg border border-[#c4c5d7]">
                    <p className="text-[#191c1e] font-semibold">Nenhum reel encontrado para este nicho</p>
                    <p className="text-sm text-[#434655] mt-1">Tente conectar seu Instagram ou ajustar o nicho</p>
                  </div>
                )}
              </>
            ) : currentTab === 'tiktok' ? (
              <div className="relative">
                {/* Videos desfocados no fundo */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 blur-md opacity-30">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="aspect-[9/16] bg-gradient-to-br from-slate-300 to-slate-400 rounded-2xl"></div>
                    ))}
                  </div>
                </div>

                {/* Overlay e mensagem em destaque */}
                <div className="relative z-10 flex flex-col items-center justify-center py-40">
                  <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 text-center shadow-xl">
                    <div className="text-6xl mb-4">🎵</div>
                    <p className="text-3xl font-bold text-[#191c1e] mb-3">Em Breve</p>
                    <p className="text-[#434655] text-sm max-w-sm">
                      Estamos preparando a análise de TikToks em alta para seu nicho. Volte em breve!
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          )}

          {/* Arquétipo Section */}
          {currentTab === 'arquetipo' && (
            <div className="max-w-5xl mx-auto">
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                {/* Header Arquétipo */}
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-12 text-white">
                  <h2 className="text-4xl font-bold mb-2">Seu Arquétipo</h2>
                  <p className="text-purple-100 text-lg">Análise completa do seu padrão e posicionamento</p>
                </div>

                {/* Conteúdo Arquétipo */}
                <div className="p-12 space-y-8">
                  {userArchetype ? (
                    <>
                      {/* Arquétipo Principal */}
                      <div className="flex items-center gap-8 pb-8 border-b-2 border-slate-200">
                        <div className="text-9xl">
                          {userArchetype === 'Educador' ? '👨‍🏫' :
                           userArchetype === 'Influenciador' ? '⭐' :
                           userArchetype === 'Empreendedor' ? '🚀' :
                           userArchetype === 'Especialista' ? '🎯' :
                           userArchetype === 'Creator' ? '🎬' :
                           userArchetype === 'Mentor' ? '🧭' :
                           userArchetype === 'Inovador' ? '💡' :
                           userArchetype === 'Estrategista' ? '♟️' : '✨'}
                        </div>
                        <div>
                          <p className="text-sm text-slate-600 font-semibold uppercase tracking-wider mb-2">Seu Padrão</p>
                          <h3 className="text-5xl font-bold text-slate-900">{userArchetype}</h3>
                        </div>
                      </div>

                      {/* Análise Detalhada */}
                      {archetypeAnalysis && (
                        <div className="space-y-8">
                          {archetypeAnalysis.por_que && (
                            <div>
                              <p className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3">Por Quê</p>
                              <p className="text-xl text-slate-700 leading-relaxed">{archetypeAnalysis.por_que}</p>
                            </div>
                          )}

                          {archetypeAnalysis.caracteristicas && (
                            <div>
                              <p className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-4">Suas Características Principais</p>
                              <div className="flex flex-wrap gap-3">
                                {archetypeAnalysis.caracteristicas.split('|').map((caract: string, i: number) => (
                                  <span key={i} className="bg-blue-100 text-blue-700 px-5 py-2 rounded-full font-semibold text-sm">
                                    {caract.trim()}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {archetypeAnalysis.forca && (
                            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-8 rounded-xl border-2 border-yellow-300">
                              <p className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3">Sua Força Principal</p>
                              <p className="text-2xl font-bold text-slate-900">⚡ {archetypeAnalysis.forca}</p>
                            </div>
                          )}

                          {archetypeAnalysis.estrategia && (
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-8 rounded-xl border-2 border-green-300">
                              <p className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3">Estratégia Recomendada</p>
                              <p className="text-xl text-slate-700 leading-relaxed">📍 {archetypeAnalysis.estrategia}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-16">
                      <p className="text-xl text-slate-600 font-semibold mb-2">Arquétipo não carregado ainda</p>
                      <p className="text-slate-500">Clique em "Buscar Novo Nicho" para atualizar</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Footer spacer */}
        <div className="h-24"></div>
      </main>

      {/* Modal de Roteiro (centralizado) */}
      {selectedReel && (
        <RoteiroPanel reel={selectedReel} profile={profile} onClose={() => setSelectedReel(null)} />
      )}

      {/* FAB */}
      <button className="fixed bottom-6 right-6 w-14 h-14 bg-[#6b38d4] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all z-50 group">
        <span className="material-symbols-outlined group-hover:rotate-12 transition-transform">add_chart</span>
        <div className="absolute right-16 bg-[#2d3133] text-[#eff1f3] px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Nova Análise
        </div>
      </button>
    </div>
  );
}
