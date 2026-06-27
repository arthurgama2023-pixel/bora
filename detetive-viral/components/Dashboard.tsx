'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Settings, Loader, Menu, X } from 'lucide-react';
import ReelCard from './ReelCard';
import RoteiroPanel from './RoteiroPanel';
import UserMenu from './UserMenu';
import SettingsPage from './SettingsPage';
import NewAnalysisModal from './NewAnalysisModal';
import { useVideos } from '@/context/VideosContext';
import { API_URL, proxiedImage } from '@/lib/api';

interface PostingFrequency {
  postsPerWeek: number;
  avgDaysBetween: number;
  sampleSize: number;
  oldestSample: string;
  newestSample: string;
  level: 'muito_baixa' | 'baixa' | 'moderada' | 'alta' | 'muito_alta';
  diagnosis: string;
  avgEngagementPerPost: number;
  bestWindow: { label: string; avgEngagement: number } | null;
  postsByMonth: { month: string; label: string; count: number }[];
}

const LEVEL_STYLE: Record<PostingFrequency['level'], { label: string; color: string; bg: string }> = {
  muito_baixa: { label: 'Muito baixa', color: '#dc2626', bg: '#fef2f2' },
  baixa: { label: 'Baixa', color: '#ea580c', bg: '#fff7ed' },
  moderada: { label: 'Moderada', color: '#16a34a', bg: '#f0fdf4' },
  alta: { label: 'Alta', color: '#0284c7', bg: '#f0f9ff' },
  muito_alta: { label: 'Muito alta', color: '#7c3aed', bg: '#faf5ff' },
};

const LEVEL_ORDER: PostingFrequency['level'][] = ['muito_baixa', 'baixa', 'moderada', 'alta', 'muito_alta'];

interface DashboardProps {
  profile: {
    name: string;
    instagram: string;
    niche: string;
    painPoints: string;
    desires: string;
    bio?: string;
    followers?: number;
    following?: number;
    posts?: number;
    profilePic?: string | null;
    verified?: boolean;
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
  const [showSettings, setShowSettings] = useState(false);
  const [showNewAnalysis, setShowNewAnalysis] = useState(false);

  // Perfil exibido no cabeçalho estilo Instagram — enriquecido em background
  const [igProfile, setIgProfile] = useState(profile);

  // Busca dados que faltam (posts/seguindo/foto) automaticamente e atualiza localStorage
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
        setIgProfile(merged);
        localStorage.setItem('detetiveviral_profile', JSON.stringify(merged));
      } catch {}
    })();

    return () => { cancelado = true; };
  }, [profile.instagram]);

  // Formata números no padrão pt-BR (2.587)
  const fmtNum = (n?: number) => (n || n === 0 ? n.toLocaleString('pt-BR') : '—');

  // Popup de frequência de postagem — mede ao clicar no avatar (não fica pré-carregado)
  const [showFrequencyModal, setShowFrequencyModal] = useState(false);
  const [frequencyLoading, setFrequencyLoading] = useState(false);
  const [frequencyData, setFrequencyData] = useState<PostingFrequency | null>(null);
  const [frequencyError, setFrequencyError] = useState<string | null>(null);
  const [forecastPostsPerDay, setForecastPostsPerDay] = useState(1);

  const handleAvatarClick = async () => {
    setShowFrequencyModal(true);
    setFrequencyError(null);
    if (frequencyData) return; // já medido nesta sessão
    setFrequencyLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/instagram/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: igProfile.instagram }),
      });
      if (!res.ok) throw new Error('Não consegui medir a frequência agora.');
      const fresh = await res.json();
      if (!fresh.postingFrequency) {
        setFrequencyError('Poucos posts recentes para estimar a frequência.');
      } else {
        setFrequencyData(fresh.postingFrequency);
      }
    } catch (e) {
      setFrequencyError(e instanceof Error ? e.message : 'Erro ao medir frequência');
    } finally {
      setFrequencyLoading(false);
    }
  };

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
            <span className="text-sm">Análise de Engajamento</span>
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
        {/* TopNavBar — não-fixa, rola junto com o conteúdo (não tapa o perfil) */}
        <header className="bg-white/90 border-b border-[#c4c5d7] backdrop-blur-sm flex items-center px-4 md:px-6 py-3 gap-3">
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
              <UserMenu profileName={profile.name} profile={profile} onProfileClick={() => setShowSettings(true)} />
            </div>
          </div>
        </header>

        {/* Content Canvas */}
        <section className="p-4 md:p-6 space-y-6">
          {/* Cabeçalho de Perfil estilo Instagram (só na aba Instagram) */}
          {currentTab === 'instagram' && (
            <div className="max-w-3xl mx-auto w-full border-b border-[#dbdbdb] pb-6 mb-2">
              <div className="flex items-center gap-6 md:gap-10">
                {/* Avatar com anel gradiente — clique mede a frequência de postagem */}
                <button
                  onClick={handleAvatarClick}
                  className="flex-shrink-0 p-[3px] rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 hover:opacity-90 active:scale-95 transition-all"
                  title="Ver frequência de postagem"
                >
                  <div className="w-20 h-20 md:w-[150px] md:h-[150px] rounded-full bg-white p-[3px]">
                    <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                      {igProfile.profilePic ? (
                        <img src={proxiedImage(igProfile.profilePic) || undefined} alt={igProfile.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-4xl">📷</span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Coluna direita: username, stats, nome, bio */}
                <div className="flex-1 min-w-0">
                  {/* Username + verificado */}
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-xl md:text-2xl text-[#191c1e]">{igProfile.instagram}</h2>
                    {igProfile.verified && (
                      <svg className="w-5 h-5 text-[#3897f0]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l2.4 1.8 3 .3 1 2.8 2.2 2-1 2.9 1 2.9-2.2 2-1 2.8-3 .3L12 22l-2.4-1.8-3-.3-1-2.8-2.2-2 1-2.9-1-2.9 2.2-2 1-2.8 3-.3L12 2zm-1.3 13.2l5-5-1.2-1.2-3.8 3.8-1.7-1.7-1.2 1.2 2.9 2.9z"/>
                      </svg>
                    )}
                  </div>

                  {/* Stats inline */}
                  <div className="flex gap-6 md:gap-10 mb-4">
                    <div className="flex flex-col md:flex-row md:gap-1.5">
                      <span className="font-bold text-[#191c1e]">{fmtNum(igProfile.posts)}</span>
                      <span className="text-[#191c1e]">posts</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:gap-1.5">
                      <span className="font-bold text-[#191c1e]">{fmtNum(igProfile.followers)}</span>
                      <span className="text-[#191c1e]">seguidores</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:gap-1.5">
                      <span className="font-bold text-[#191c1e]">{fmtNum(igProfile.following)}</span>
                      <span className="text-[#191c1e]">seguindo</span>
                    </div>
                  </div>

                  {/* Nome + bio (escondidos no mobile pra caber; aparecem abaixo) */}
                  <div className="hidden md:block">
                    <p className="font-semibold text-[#191c1e]">{igProfile.name}</p>
                    {igProfile.bio && (
                      <p className="text-sm text-[#191c1e] whitespace-pre-line leading-snug">{igProfile.bio}</p>
                    )}
                    <span className="inline-flex items-center gap-1 mt-2 bg-purple-50 text-purple-600 text-xs font-semibold px-2.5 py-1 rounded-md">
                      ✨ {igProfile.niche}
                    </span>
                  </div>
                </div>
              </div>

              {/* Nome + bio no mobile (abaixo da linha do avatar) */}
              <div className="md:hidden mt-4">
                <p className="font-semibold text-[#191c1e]">{igProfile.name}</p>
                {igProfile.bio && (
                  <p className="text-sm text-[#191c1e] whitespace-pre-line leading-snug">{igProfile.bio}</p>
                )}
                <span className="inline-flex items-center gap-1 mt-2 bg-purple-50 text-purple-600 text-xs font-semibold px-2.5 py-1 rounded-md">
                  ✨ {igProfile.niche}
                </span>
              </div>
            </div>
          )}

          {currentTab === 'tiktok' && (
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
                  <h2 className="text-3xl md:text-4xl font-bold mb-2">Análise de Engajamento</h2>
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
                      <p className="text-xl text-slate-600 font-semibold mb-2">Análise de engajamento não carregada ainda</p>
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

      {/* Popup: Frequência de Postagem (aberto ao clicar no avatar) */}
      {showFrequencyModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowFrequencyModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[85vh] overflow-y-auto relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowFrequencyModal(false)}
              className="absolute top-4 right-4 text-[#9ca3af] hover:text-[#434655] transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-purple-400 to-pink-400 flex-shrink-0">
                {igProfile.profilePic && (
                  <img src={proxiedImage(igProfile.profilePic) || undefined} alt={igProfile.name} className="w-full h-full object-cover" />
                )}
              </div>
              <div>
                <p className="font-semibold text-[#191c1e] text-sm">{igProfile.instagram}</p>
                <p className="text-xs text-[#737373]">Diagnóstico de frequência de postagem</p>
              </div>
            </div>

            {frequencyLoading ? (
              <div className="flex flex-col items-center py-8">
                <Loader size={28} className="animate-spin text-[#0037b0] mb-3" />
                <p className="text-sm text-[#434655]">Medindo frequência de posts...</p>
              </div>
            ) : frequencyError ? (
              <div className="text-center py-6">
                <p className="text-sm text-red-600">{frequencyError}</p>
              </div>
            ) : frequencyData ? (
              <div className="space-y-6">
                {/* Número principal, bem grande, pra leitura instantânea */}
                <div className="text-center">
                  <p className="text-5xl font-extrabold text-[#191c1e] leading-none">{frequencyData.postsPerWeek}</p>
                  <p className="text-sm text-[#434655] mt-1">posts por semana (média de {frequencyData.avgDaysBetween} dias entre posts)</p>
                </div>

                {/* Contagem REAL (não estimada): quantos posts saíram de fato em cada mês */}
                {frequencyData.postsByMonth.length > 0 && (
                  <div className="bg-[#f5f7fb] rounded-xl p-4">
                    <p className="text-xs font-semibold text-[#434655] mb-3">Posts publicados por mês (real)</p>
                    <div className="flex items-end gap-2 h-20">
                      {frequencyData.postsByMonth.map((m) => {
                        const maxCount = Math.max(...frequencyData.postsByMonth.map((x) => x.count));
                        return (
                          <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full">
                            <span className="text-xs font-bold text-[#191c1e] mb-1">{m.count}</span>
                            <div
                              className="w-full rounded-t-md bg-[#0037b0]"
                              style={{ height: `${Math.max((m.count / maxCount) * 100, 8)}%` }}
                            />
                            <span className="text-[9px] text-[#737373] mt-1 whitespace-nowrap">{m.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Gauge visual: 5 faixas coloridas + marcador na faixa atual */}
                <div>
                  <div className="flex h-3 rounded-full overflow-hidden">
                    {LEVEL_ORDER.map((lvl) => (
                      <div key={lvl} className="flex-1" style={{ backgroundColor: LEVEL_STYLE[lvl].color, opacity: lvl === frequencyData.level ? 1 : 0.25 }} />
                    ))}
                  </div>
                  <div className="relative h-4">
                    <div
                      className="absolute -top-1 w-3 h-3 rotate-45 transition-all"
                      style={{
                        left: `calc(${(LEVEL_ORDER.indexOf(frequencyData.level) + 0.5) / LEVEL_ORDER.length * 100}% - 6px)`,
                        backgroundColor: LEVEL_STYLE[frequencyData.level].color,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-[#9ca3af] -mt-1">
                    <span>Muito baixa</span>
                    <span>Muito alta</span>
                  </div>
                </div>

                {/* Diagnóstico de nível */}
                <div className="rounded-xl p-4" style={{ backgroundColor: LEVEL_STYLE[frequencyData.level].bg }}>
                  <span
                    className="inline-block text-xs font-bold px-2.5 py-1 rounded-md mb-2"
                    style={{ color: LEVEL_STYLE[frequencyData.level].color, backgroundColor: '#fff' }}
                  >
                    ● Nível {LEVEL_STYLE[frequencyData.level].label}
                  </span>
                  <p className="text-sm" style={{ color: LEVEL_STYLE[frequencyData.level].color }}>
                    {frequencyData.diagnosis}
                  </p>
                </div>

                {/* Melhor horário pra postar */}
                {frequencyData.bestWindow && (
                  <div className="flex items-center gap-3 bg-[#f5f7fb] rounded-xl p-4">
                    <div className="w-11 h-11 rounded-full bg-[#0037b0]/10 flex items-center justify-center flex-shrink-0 text-xl">
                      ⏰
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#434655]">Melhor horário para postar</p>
                      <p className="text-lg font-bold text-[#191c1e] leading-tight">{frequencyData.bestWindow.label}</p>
                      <p className="text-xs text-[#737373]">
                        ~{fmtNum(frequencyData.bestWindow.avgEngagement)} interações/post nesse horário
                      </p>
                    </div>
                  </div>
                )}

                {/* Previsão por posts/dia — slider + chips rápidos */}
                <div className="border-t border-[#dbdbdb] pt-5">
                  <p className="text-xs font-semibold text-[#434655] mb-3">📈 Simule sua meta de postagem</p>

                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[#434655]">posts por dia</span>
                    <span className="text-2xl font-bold text-[#0037b0]">{forecastPostsPerDay}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={forecastPostsPerDay}
                    onChange={(e) => setForecastPostsPerDay(Number(e.target.value))}
                    className="w-full accent-[#0037b0] mb-2"
                  />
                  <div className="flex gap-1.5 mb-4">
                    {[1, 2, 3, 5, 7].map((n) => (
                      <button
                        key={n}
                        onClick={() => setForecastPostsPerDay(n)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          forecastPostsPerDay === n ? 'bg-[#0037b0] text-white' : 'bg-[#f5f7fb] text-[#434655] hover:bg-[#e0e3e5]'
                        }`}
                      >
                        {n}x/dia
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-[#f5f7fb] rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-[#0037b0]">{forecastPostsPerDay * 7}</p>
                      <p className="text-[10px] text-[#434655] mt-0.5">posts / semana</p>
                    </div>
                    <div className="bg-[#f5f7fb] rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-[#0037b0]">{forecastPostsPerDay * 30}</p>
                      <p className="text-[10px] text-[#434655] mt-0.5">posts / mês</p>
                    </div>
                    <div className="bg-[#f5f7fb] rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-[#0037b0]">
                        {fmtNum(forecastPostsPerDay * 30 * frequencyData.avgEngagementPerPost)}
                      </p>
                      <p className="text-[10px] text-[#434655] mt-0.5">interações / mês</p>
                    </div>
                  </div>

                  {/* Comparação visual: hoje vs meta — mesma unidade (posts/mês) nas duas barras */}
                  {(() => {
                    const hojePostsPerMonth = Math.round((frequencyData.postsPerWeek * 30 / 7) * 10) / 10;
                    const metaPostsPerMonth = forecastPostsPerDay * 30;
                    const max = Math.max(hojePostsPerMonth, metaPostsPerMonth, 1);
                    return (
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs text-[#434655] mb-1">
                            <span>Hoje (seu ritmo atual)</span>
                            <span className="font-semibold">{hojePostsPerMonth} posts/mês</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-[#e0e3e5] overflow-hidden">
                            <div className="h-full rounded-full bg-[#9ca3af]" style={{ width: `${(hojePostsPerMonth / max) * 100}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-[#434655] mb-1">
                            <span>Sua meta</span>
                            <span className="font-semibold text-[#0037b0]">{metaPostsPerMonth} posts/mês</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-[#e0e3e5] overflow-hidden">
                            <div className="h-full rounded-full bg-[#0037b0]" style={{ width: `${(metaPostsPerMonth / max) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <p className="text-[11px] text-[#9ca3af] text-center">
                  Baseado nos últimos {frequencyData.sampleSize} posts (de{' '}
                  {new Date(frequencyData.oldestSample).toLocaleDateString('pt-BR')} a{' '}
                  {new Date(frequencyData.newestSample).toLocaleDateString('pt-BR')}) — engajamento médio atual de ~{fmtNum(frequencyData.avgEngagementPerPost)} por post.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Modal de Roteiro (centralizado) */}
      {selectedReel && (
        <RoteiroPanel reel={selectedReel} profile={profile} onClose={() => setSelectedReel(null)} />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsPage
          profile={profile}
          onBack={() => setShowSettings(false)}
          onChangeInstagram={(newInstagram) => {
            // Aqui você pode implementar a lógica de trocar Instagram
            console.log('Novo Instagram:', newInstagram);
            setShowSettings(false);
          }}
        />
      )}

      {/* FAB — escondido no mobile (sobrepõe os reels) */}
      <button
        onClick={() => setShowNewAnalysis(true)}
        className="hidden md:flex fixed bottom-6 right-6 w-14 h-14 bg-[#6b38d4] text-white rounded-full shadow-2xl items-center justify-center hover:scale-110 active:scale-90 transition-all z-40 group"
      >
        <span className="material-symbols-outlined group-hover:rotate-12 transition-transform">add_chart</span>
        <div className="absolute right-16 bg-[#2d3133] text-[#eff1f3] px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Nova Análise
        </div>
      </button>

      {/* New Analysis Modal */}
      {showNewAnalysis && (
        <NewAnalysisModal
          onClose={() => setShowNewAnalysis(false)}
          onAnalyze={(instagram) => {
            // Reload page com novo @ no localStorage
            const profile = {
              name: 'Novo Perfil',
              instagram: instagram,
              niche: 'Detectando via IA...',
              painPoints: '',
              desires: '',
            };
            localStorage.setItem('detetiveviral_profile', JSON.stringify(profile));
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
