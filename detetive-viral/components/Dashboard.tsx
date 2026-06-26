'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Settings, Loader, Menu, X } from 'lucide-react';
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

export default function Dashboard({ profile }: DashboardProps) {
  const [selectedReel, setSelectedReel] = useState<Reel | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          console.log('✅ Tendências atualizadas com sucesso!');
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar tendências:', error);
    } finally {
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

  return (
    <div className="flex min-h-screen bg-[#f7f9fb]">
      {/* Overlay (só mobile, quando o menu está aberto) */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar — off-canvas no mobile, fixa no desktop */}
      <aside
        className={`w-64 fixed left-0 top-0 h-screen border-r border-[#c4c5d7] bg-[#f7f9fb] flex flex-col gap-2 p-4 z-50 transition-transform duration-200 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        <div className="px-4 py-6 mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#191c1e]">Radar de Tendências</h1>
            <p className="text-xs text-[#434655] opacity-70">Inteligência de Reels</p>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-[#434655] p-1">
            <X size={22} />
          </button>
        </div>
        <nav className="flex-1 space-y-1">
          <button
            onClick={() => { setCurrentTab('instagram'); setMobileMenuOpen(false); }}
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
              setMobileMenuOpen(false);
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
            onClick={() => { setCurrentTab('arquetipo'); setMobileMenuOpen(false); }}
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
      <main className="w-full md:ml-64 md:w-[calc(100%-256px)] min-h-screen">
        {/* TopNavBar */}
        <header className="fixed top-0 left-0 right-0 md:left-64 w-full md:w-[calc(100%-256px)] z-40 bg-white/90 border-b border-[#c4c5d7] backdrop-blur-sm flex items-center px-4 md:px-6 py-3 gap-3">
          {/* Mobile: hambúrguer + marca (dá identidade ao header) */}
          <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-[#434655] -ml-1 p-1 flex-shrink-0">
            <Menu size={24} />
          </button>
          <div className="md:hidden flex items-center gap-1.5 flex-shrink-0">
            <span className="material-symbols-outlined text-[#0037b0]">movie_filter</span>
            <span className="text-base font-bold text-[#191c1e]">Radar</span>
          </div>

          <div className="flex items-center gap-2 md:gap-6 ml-auto">
            <div className="hidden lg:flex items-center gap-4">
              <span className="material-symbols-outlined text-[#434655] cursor-pointer hover:text-[#0037b0] transition-colors">
                notifications
              </span>
              <span className="material-symbols-outlined text-[#434655] cursor-pointer hover:text-[#0037b0] transition-colors">
                help
              </span>
            </div>
            <div className="hidden lg:block h-8 w-px bg-[#c4c5d7]"></div>
            <div className="flex items-center gap-2 md:gap-3">
              <button className="hidden sm:inline-flex px-4 py-2 border border-[#c4c5d7] text-[#434655] text-xs font-semibold rounded-lg hover:bg-[#e0e3e5] transition-colors">
                Suporte
              </button>
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-[#dce1ff] flex-shrink-0">
                <div className="w-full h-full bg-gradient-to-br from-[#0037b0] to-[#890051]"></div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Canvas */}
        <section className="pt-24 p-4 md:p-6 space-y-6">
          {currentTab !== 'arquetipo' && (
            <>
              {/* Header Section */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mb-8">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#0037b0]">movie_filter</span>
                  <h2 className="text-2xl md:text-3xl font-bold text-[#191c1e]">Radar de Tendências</h2>
                </div>
              </div>
            </>
          )}

          {/* Reels/TikTok Section */}
          {currentTab !== 'arquetipo' && (
          <div className="space-y-4 pt-4">
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
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 md:p-12 text-white">
                  <h2 className="text-3xl md:text-4xl font-bold mb-2">Seu Arquétipo</h2>
                  <p className="text-purple-100 text-base md:text-lg">Análise completa do seu padrão e posicionamento</p>
                </div>

                {/* Conteúdo Arquétipo */}
                <div className="p-6 md:p-12 space-y-8">
                  {userArchetype ? (
                    <>
                      {/* Arquétipo Principal */}
                      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 pb-8 border-b-2 border-slate-200 text-center sm:text-left">
                        <div className="text-7xl sm:text-9xl">
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

      {/* FAB — escondido no mobile (sobrepõe os reels) */}
      <button className="hidden md:flex fixed bottom-6 right-6 w-14 h-14 bg-[#6b38d4] text-white rounded-full shadow-2xl items-center justify-center hover:scale-110 active:scale-90 transition-all z-50 group">
        <span className="material-symbols-outlined group-hover:rotate-12 transition-transform">add_chart</span>
        <div className="absolute right-16 bg-[#2d3133] text-[#eff1f3] px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Nova Análise
        </div>
      </button>
    </div>
  );
}
