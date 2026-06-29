'use client';

import { useState, useContext, useRef } from 'react';
import { ChevronRight, ChevronLeft, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { API_URL, proxiedImage } from '@/lib/api';
import { useVideos } from '@/context/VideosContext';

interface WizardFormProps {
  onComplete: (profile: {
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
  }) => void;
}

interface InstagramProfile {
  username: string;
  name: string;
  bio: string;
  followers: number;
  following: number;
  posts: number;
  profilePic: string | null;
  verified: boolean;
}

const STEPS = [
  {
    title: 'Qual seu @ no Instagram?',
    description: 'Vamos conectar com seu perfil e já começar a análise',
    field: 'instagram',
    placeholder: 'Ex: @joaosilva ou joaosilva',
  },
  {
    title: 'Qual é seu nome?',
    description: 'Enquanto analisamos seu perfil, conte como te chamamos',
    field: 'name',
    placeholder: 'Ex: João Silva',
  },
  {
    title: 'Qual tipo de conteúdo você busca produzir no digital?',
    description: 'Selecione o tipo de conteúdo que interessa',
    field: 'painPoints',
    type: 'checkboxes',
    options: [
      { id: 'authority', label: 'Conteúdo de autoridade' },
      { id: 'viral', label: 'Conteúdo de viralização' },
    ],
  },
  {
    title: 'Vamos confirmar seu perfil?',
    description: 'Revise as informações antes de começar',
    field: 'review',
    type: 'review',
  },
];

export default function WizardForm({ onComplete }: WizardFormProps) {
  const { setVideos, setVideosViral, setAiAnalysis: setContextAnalysis, setFrequency } = useVideos();

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    instagram: '',
    niche: '', // compatibilidade
    niches: [] as string[], // múltiplos nichos detectados
    painPoints: '',
    desires: '',
  });
  const [instagramProfile, setInstagramProfile] = useState<InstagramProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileConfirmed, setProfileConfirmed] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  // Controla a exibição do modal de resultado separadamente da análise em si —
  // a análise roda em background desde o 1º passo, mas o modal só aparece no fim.
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const analysisStartedRef = useRef(false);
  const [lastFetchedUsername, setLastFetchedUsername] = useState<string | null>(null);
  const [userArchetype, setUserArchetype] = useState<string | null>(null);
  const [archetypeAnalysis, setArchetypeAnalysis] = useState<any>(null);

  const step = STEPS[currentStep];

  // 🤖 Detectar múltiplos nichos baseado na bio
  const detectNiches = (bio: string): string[] => {
    const nicheMap: { [key: string]: string[] } = {
      'ia': ['ia', 'inteligenciaartificial', 'automacao', 'chatgpt', 'tecnologia'],
      'marketing': ['marketing', 'social', 'conteudo', 'estrategia', 'vendas', 'growth'],
      'fitness': ['fitness', 'musculacao', 'treino', 'saude', 'academia'],
      'tech': ['tech', 'codigo', 'programacao', 'desenvolvedor', 'startup'],
      'negocios': ['negocios', 'empreendedorismo', 'entrepreneur', 'renda'],
      'educacao': ['educacao', 'aprender', 'curso', 'estudo', 'conhecimento'],
      'lifestyle': ['lifestyle', 'viagem', 'moda', 'beleza', 'estilo'],
      'gastronomia': ['gastronomia', 'comida', 'receita', 'chef', 'culinaria'],
    };

    // Normaliza: minúsculas + remove acentos (ç, ã, é...) para casar palavras
    const bioNormalized = (bio || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    const detected: string[] = [];

    for (const [niche, keywords] of Object.entries(nicheMap)) {
      const matched = keywords.some(kw => {
        const k = kw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        // Match de PALAVRA INTEIRA (\bia\b) — evita "ia" casar dentro de
        // "dia", "economia", "familia", "tecnologia", etc.
        const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return re.test(bioNormalized);
      });
      if (matched) {
        detected.push(niche.charAt(0).toUpperCase() + niche.slice(1));
      }
    }

    return detected.length > 0 ? detected : ['Geral'];
  };

  const fetchInstagramProfile = async (username: string) => {
    if (!username.trim()) return;

    // Normalizar username (remover @)
    const cleanUsername = username.replace('@', '').toLowerCase();

    // 🚀 OTIMIZAÇÃO: Verificar se é o mesmo perfil
    if (lastFetchedUsername === cleanUsername && instagramProfile) {
      console.log(`💾 Perfil @${cleanUsername} já carregado — usando cache (economizando créditos!)`);
      return;
    }

    setLoadingProfile(true);
    setProfileError(null);

    try {
      const response = await fetch(`${API_URL}/api/instagram/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Perfil não encontrado');
      }

      const profile = await response.json();
      setInstagramProfile(profile);
      setLastFetchedUsername(cleanUsername);
      setProfileError(null);

      // 📊 Diagnóstico de postagem já vem nesta MESMA resposta (/api/instagram/profile
      // retorna postingFrequency). Guardamos no contexto AMARRADO ao @ dono, no
      // "Buscar perfil", pro Dashboard já abrir pronto — sem novo fetch nem loading.
      // Como é keyed por username, nunca vaza pra outro @.
      if (profile.postingFrequency) {
        setFrequency({ username: cleanUsername, data: profile.postingFrequency });
      } else {
        setFrequency(null); // sem diagnóstico p/ este @ → não herda o anterior
      }

      // 🤖 Detectar múltiplos nichos automaticamente
      const detectedNiches = detectNiches(profile.bio || '');
      console.log(`📊 Bio recebida:`, profile.bio);
      console.log(`🎯 Nichos detectados:`, detectedNiches);

      setFormData(prev => ({
        ...prev,
        niches: detectedNiches,
        niche: detectedNiches[0] || '' // primeiro nicho para compatibilidade
      }));

      console.log(`✅ Novo perfil @${cleanUsername} carregado`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao buscar perfil';
      setProfileError(message);
      setInstagramProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const field = step.field as keyof typeof formData;
    setFormData({
      ...formData,
      [field]: e.target.value,
    });

    if (field === 'instagram') {
      setProfileConfirmed(false);
      setInstagramProfile(null);
      setProfileError(null);
      analysisStartedRef.current = false; // trocou o @ → permite nova análise
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isInstagramStep && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (formData.instagram.trim()) {
        fetchInstagramProfile(formData.instagram);
      }
    }
  };

  const handleConfirmProfile = () => {
    if (instagramProfile) {
      setProfileConfirmed(true);
      // 🚀 Dispara a análise (vídeos + nicho + arquétipo) em background JÁ no 1º passo.
      // Enquanto o usuário preenche nome e tipo de conteúdo, tudo carrega por trás.
      if (!analysisStartedRef.current) {
        analysisStartedRef.current = true;
        handleAnalyze();
      }
    }
  };

  const detectArchetype = async (bio: string, nicho: string) => {
    try {
      // Primeira chamada: Detectar o arquétipo
      const archetypeResponse = await fetch(`${API_URL}/api/roteiro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Bio do Instagram: "${bio}"\nNicho: ${nicho}\n\nIdentifique em UMA PALAVRA qual é o arquétipo deste perfil. Escolha entre: Educador, Influenciador, Empreendedor, Especialista, Creator, Mentor, Inovador, Estrategista. Responda APENAS a palavra, sem explicação.`,
        }),
      });

      let archetype = 'Creator';
      if (archetypeResponse.ok) {
        const arcData = await archetypeResponse.json();
        archetype = arcData.roteiro?.trim() || 'Creator';
        setUserArchetype(archetype);
      }

      // Segunda chamada: Análise detalhada do arquétipo
      const analysisResponse = await fetch(`${API_URL}/api/roteiro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Bio: "${bio}"\nNicho: ${nicho}\nArquétipo: ${archetype}\n\nFaça uma análise profunda em JSON com EXATAMENTE este formato, sem adicionar campos extras:\n{\n  "por_que": "Uma frase explicando por que esse é o arquétipo (máx 15 palavras)",\n  "caracteristicas": "Três características principais separadas por ' | '",\n  "forca": "Qual é a força/superpower deste perfil (máx 10 palavras)",\n  "estrategia": "Uma estratégia de conteúdo específica para este arquétipo (máx 15 palavras)"\n}\n\nResponda APENAS o JSON, nada mais.`,
        }),
      });

      if (analysisResponse.ok) {
        const analysisData = await analysisResponse.json();
        try {
          const analysisJson = JSON.parse(analysisData.roteiro);
          setArchetypeAnalysis(analysisJson);
          console.log('📊 Análise de Arquétipo:', analysisJson);
        } catch (e) {
          console.log('Erro ao fazer parse da análise:', e);
        }
      }

      return archetype;
    } catch (e) {
      console.log('Erro ao detectar arquétipo:', e);
      setUserArchetype('Creator');
    }
    return 'Creator';
  };

  const handleAnalyze = async () => {
    setLoadingAnalysis(true);
    try {
      const response = await fetch(`${API_URL}/api/videos/from-user-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instagram_username: formData.instagram.replace('@', ''),
          limit: 40,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Extrair frase relevante da bio via IA
        let biofrase = '';
        if (instagramProfile?.bio) {
          try {
            const bioResponse = await fetch(`${API_URL}/api/roteiro`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: `A bio do Instagram é: "${instagramProfile.bio}"\n\nExtraia UMA frase curta (máximo 10 palavras) que seja inspiradora/relevante para o nicho de ${data.nicho}. Se não encontrar nada relevante, responda VAZIO. Responda APENAS a frase, nada mais.`,
              }),
            });
            if (bioResponse.ok) {
              const bioData = await bioResponse.json();
              biofrase = bioData.roteiro?.trim() || '';
            }
          } catch (e) {
            console.log('Erro ao extrair bio:', e);
          }
        }

        // Detectar arquétipo
        await detectArchetype(instagramProfile?.bio || '', data.nicho);

        // Salvar arquétipo no localStorage para o Dashboard
        if (userArchetype) {
          localStorage.setItem('userArchetype', userArchetype);
        }
        if (archetypeAnalysis) {
          localStorage.setItem('archetypeAnalysis', JSON.stringify(archetypeAnalysis));
        }

        setAiAnalysis({ ...data, biofrase });

        // PRÉ-CARREGAR OS VÍDEOS NO CONTEXTO
        setVideos(data.autoridade || data.videos || []);
        setVideosViral(data.viralizacao || []);
        setContextAnalysis({
          nicho: data.nicho,
          hashtags: data.hashtags || [],
          confianca: data.confianca || '—',
        });
      }
    } catch (error) {
      console.error('Erro ao analisar:', error);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 0 && !profileConfirmed && instagramProfile) {
      setProfileError('Por favor, confirme o perfil para continuar');
      return;
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Mostra o modal de resultado. Se a análise em background ainda não terminou,
      // o modal de "carregando" aparece e troca pro resultado assim que ficar pronto.
      setShowAnalysisModal(true);
      if (!analysisStartedRef.current) {
        analysisStartedRef.current = true;
        handleAnalyze();
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const isLastStep = currentStep === STEPS.length - 1;
  const fieldValue = formData[step.field as keyof typeof formData];
  const isFilled = typeof fieldValue === 'string' ? fieldValue.trim() !== '' : false;
  const isInstagramStep = currentStep === 0; // @ agora é o 1º passo
  const isCheckboxStep = currentStep === 2; // tipo de conteúdo (índice 2)
  const isReviewStep = currentStep === 3; // revisão (índice 3)
  const canProceed = isInstagramStep ? profileConfirmed : isReviewStep ? true : isCheckboxStep ? isFilled : isFilled;

  return (
    <div className="flex items-center justify-center min-h-screen px-4 relative overflow-hidden">
      {/* Fundo ambiente sutil */}
      <div className="absolute top-1/4 -right-20 w-[600px] h-[600px] bg-[#003ec7] opacity-[0.03] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-[400px] h-[400px] bg-[#005569] opacity-[0.03] rounded-full blur-[80px] pointer-events-none" />

      {/* 1º passo (@) — card dedicado de conexão de perfil */}
      {isInstagramStep && (
        <div className="w-full max-w-[560px] bg-white/85 backdrop-blur-md border border-[#e2e8f0] rounded-2xl shadow-sm p-6 md:p-10 relative z-10">
          {/* Progresso */}
          <div className="mb-8">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-bold tracking-[0.05em] text-[#003ec7]">PASSO 1 DE {STEPS.length}</span>
              <span className="text-xs font-medium text-[#434656] opacity-60">Perfil &amp; Nicho</span>
            </div>
            <div className="w-full h-1.5 bg-[#e5eeff] rounded-full overflow-hidden">
              <div className="h-full bg-[#003ec7] rounded-full transition-all duration-1000 ease-out" style={{ width: `${(1 / STEPS.length) * 100}%` }} />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-[32px] font-bold text-[#0b1c30] mb-3 leading-tight">{step.title}</h1>
            <p className="text-[#434656] max-w-[420px] mx-auto">
              {step.description}
            </p>
          </div>

          {/* Input + Buscar (antes de encontrar o perfil) */}
          {!instagramProfile && (
            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#434656] group-focus-within:text-[#003ec7] transition-colors text-xl font-bold">
                  @
                </div>
                <input
                  type="text"
                  value={formData.instagram}
                  onChange={(e) => {
                    setFormData({ ...formData, instagram: e.target.value });
                    setProfileConfirmed(false);
                    setInstagramProfile(null);
                    setProfileError(null);
                    analysisStartedRef.current = false;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (formData.instagram.trim()) fetchInstagramProfile(formData.instagram);
                    }
                  }}
                  placeholder="joaosilva"
                  className="w-full pl-14 pr-4 h-16 bg-white border border-[#c3c5d9] rounded-xl text-lg text-[#0b1c30] placeholder:text-[#c3c5d9] focus:ring-2 focus:ring-[#003ec7]/20 focus:border-[#003ec7] transition-all outline-none"
                />
              </div>
              <button
                onClick={() => fetchInstagramProfile(formData.instagram)}
                disabled={!formData.instagram.trim() || loadingProfile}
                className="w-full bg-[#003ec7] hover:bg-[#0052ff] text-white font-semibold py-4 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingProfile && <Loader className="animate-spin" size={20} />}
                <span>{loadingProfile ? 'Buscando...' : 'Buscar perfil'}</span>
                {!loadingProfile && <span className="material-symbols-outlined">arrow_forward</span>}
              </button>
            </div>
          )}

          {/* Erro */}
          {profileError && !loadingProfile && (
            <div className="mt-4 flex items-start gap-3 p-4 bg-[#ffdad6] rounded-xl">
              <AlertCircle className="text-[#ba1a1a] flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-[#93000a]">Perfil não encontrado</p>
                <p className="text-sm text-[#93000a]/80">{profileError}</p>
              </div>
            </div>
          )}

          {/* Perfil encontrado → conectar e continuar */}
          {instagramProfile && !loadingProfile && (
            <div className={`rounded-xl p-4 border-2 transition-all ${profileConfirmed ? 'border-[#003ec7] bg-[#eff4ff]' : 'border-[#c3c5d9] bg-white'}`}>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 flex items-center justify-center text-3xl flex-shrink-0">
                  {proxiedImage(instagramProfile.profilePic) ? (
                    <img src={proxiedImage(instagramProfile.profilePic) || undefined} alt={instagramProfile.name} className="w-full h-full object-cover" />
                  ) : (
                    '📸'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[#0b1c30] truncate">@{instagramProfile.username}</p>
                    {instagramProfile.verified && <span className="text-[#003ec7] text-sm">✓</span>}
                  </div>
                  <p className="text-sm text-[#434656]">{instagramProfile.name}</p>
                  <p className="text-xs text-[#434656] line-clamp-2 mt-1">{instagramProfile.bio || 'Sem bio'}</p>
                  <p className="text-xs font-semibold text-[#434656] mt-2">👥 {(instagramProfile.followers / 1000).toFixed(1)}K seguidores</p>
                </div>
                <div className="flex items-center gap-2">
                  {profileConfirmed && <CheckCircle className="text-[#003ec7] flex-shrink-0" size={24} />}
                  <button
                    onClick={() => {
                      setInstagramProfile(null);
                      setProfileConfirmed(false);
                      setFormData({ ...formData, instagram: '' });
                      setProfileError(null);
                    }}
                    className="text-[#c3c5d9] hover:text-[#999] transition-colors"
                    title="Trocar perfil"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {!profileConfirmed ? (
                <button
                  onClick={handleConfirmProfile}
                  className="w-full mt-4 py-3 bg-[#003ec7] hover:bg-[#0052ff] text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <CheckCircle size={18} />
                  Conectar este perfil
                </button>
              ) : (
                <>
                  <button
                    onClick={handleNext}
                    className="w-full mt-4 py-3 bg-[#003ec7] hover:bg-[#0052ff] text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    Continuar
                    <ChevronRight size={18} />
                  </button>
                  <p className="text-center text-xs text-[#003ec7] mt-2">✓ Perfil conectado — já começamos sua análise em segundo plano</p>
                </>
              )}
            </div>
          )}

          {/* Privacidade e Segurança */}
          <div className="mt-6 p-4 bg-[#eff4ff] border border-[#c3c5d9] rounded-xl flex items-start gap-3">
            <span className="material-symbols-outlined text-[#003ec7] flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
            <div>
              <h3 className="text-xs font-bold text-[#0b1c30] tracking-[0.03em] mb-1">PRIVACIDADE E SEGURANÇA</h3>
              <p className="text-[13px] leading-relaxed text-[#434656]/80">
                Nossa IA analisa apenas informações públicas do perfil. Não solicitamos sua senha em nenhum momento. Seus dados estão protegidos.
              </p>
            </div>
          </div>

          {/* Ajuda */}
          <div className="mt-4 text-center">
            <a href="#" className="text-xs text-[#434656] hover:text-[#003ec7] transition-all">Precisa de ajuda com a conexão?</a>
          </div>
        </div>
      )}

      {!isInstagramStep && (
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 md:mb-12 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            🎬 Radar de Tendências
          </h1>
          <p className="text-base md:text-lg text-slate-600">
            Descubra o que viraliza no seu nicho
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">
              Passo {currentStep + 1} de {STEPS.length}
            </span>
            <span className="text-sm font-medium text-slate-600">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-8">
          {/* Step Title */}
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            {step.title}
          </h2>
          <p className="text-slate-600 mb-8">{step.description}</p>

          {/* Input */}
          {(step as any).type === 'review' ? (
            <div className="space-y-6">
              {/* O que vamos descobrir - Timeline */}
              <div>
                <p className="text-sm font-semibold text-slate-900 mb-4">Vamos analisar:</p>

                {/* Timeline Cards */}
                <div className="space-y-3">
                  {/* Step 1 */}
                  <div className="relative pl-6">
                    <div className="absolute left-0 top-2 w-3 h-3 bg-purple-500 rounded-full"></div>
                    <div className="absolute left-1 top-5 bottom-0 w-0.5 bg-purple-200"></div>
                    <div className="bg-white rounded-lg p-4 border-2 border-purple-200 hover:shadow-md transition-shadow">
                      <p className="font-bold text-slate-900 mb-1">📊 Análise de Engajamento</p>
                      <p className="text-xs text-slate-600">Como seu público interage e qual o seu potencial de alcance</p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="relative pl-6">
                    <div className="absolute left-0 top-2 w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div className="absolute left-1 top-5 bottom-0 w-0.5 bg-blue-200"></div>
                    <div className="bg-white rounded-lg p-4 border-2 border-blue-200 hover:shadow-md transition-shadow">
                      <p className="font-bold text-slate-900 mb-1">🎬 Vídeos em Alta</p>
                      <p className="text-xs text-slate-600">Conteúdos que explodem em seu nicho nos últimos dias</p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="relative pl-6">
                    <div className="absolute left-0 top-2 w-3 h-3 bg-orange-500 rounded-full"></div>
                    <div className="bg-white rounded-lg p-4 border-2 border-orange-200 hover:shadow-md transition-shadow">
                      <p className="font-bold text-slate-900 mb-1">✨ Roteiros IA</p>
                      <p className="text-xs text-slate-600">Scripts gerados por IA para seus próximos vídeos</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (step as any).type === 'checkboxes' ? (
            <div className="space-y-3">
              {(step as any).options?.map((opt: any) => (
                <label key={opt.id} className="flex items-center gap-3 p-3 border-2 border-slate-200 rounded-lg hover:border-blue-500 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.painPoints.includes(opt.id)}
                    onChange={(e) => {
                      const newPain = e.target.checked
                        ? formData.painPoints + (formData.painPoints ? ',' : '') + opt.id
                        : formData.painPoints.split(',').filter(p => p.trim() !== opt.id).join(',');
                      setFormData({ ...formData, painPoints: newPain });
                    }}
                    className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                  />
                  <span className="text-lg font-medium text-slate-900">{opt.label}</span>
                </label>
              ))}
            </div>
          ) : (
            <textarea
              value={formData[step.field as keyof typeof formData]}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={(step as any).placeholder}
              className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:outline-none resize-none text-lg transition-colors"
              rows={isInstagramStep && instagramProfile ? 2 : 4}
            />
          )}
          {/* Botão de busca — funciona em qualquer dispositivo (Enter não é confiável no teclado mobile) */}
          {isInstagramStep && !instagramProfile && (
            <div className="mt-3 space-y-2">
              <button
                onClick={() => fetchInstagramProfile(formData.instagram)}
                disabled={!formData.instagram.trim() || loadingProfile}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loadingProfile ? <Loader className="animate-spin" size={18} /> : null}
                Buscar perfil
              </button>
              <p className="text-xs text-slate-500 hidden sm:flex items-center gap-1">
                💡 Ou pressione <kbd className="px-2 py-1 bg-slate-100 rounded border border-slate-300 font-mono text-xs">Enter</kbd>
              </p>
            </div>
          )}

          {/* Instagram Profile Display */}
          {isInstagramStep && (
            <div className="mt-6">
              {loadingProfile && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                  <Loader className="animate-spin text-blue-600" size={20} />
                  <div>
                    <p className="font-medium text-blue-900">Buscando perfil...</p>
                    <p className="text-sm text-blue-700">Conectando com Instagram</p>
                  </div>
                </div>
              )}

              {profileError && !loadingProfile && (
                <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={20} />
                  <div>
                    <p className="font-medium text-red-900">Perfil não encontrado</p>
                    <p className="text-sm text-red-700">{profileError}</p>
                  </div>
                </div>
              )}

              {instagramProfile && !loadingProfile && (
                <div
                  className={`rounded-lg p-4 transition-all ${
                    profileConfirmed
                      ? 'bg-green-50 border-2 border-green-500'
                      : 'bg-slate-50 border-2 border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 shadow-sm flex-shrink-0 overflow-hidden flex items-center justify-center text-4xl">
                      {proxiedImage(instagramProfile.profilePic) ? (
                        <img
                          src={proxiedImage(instagramProfile.profilePic) || undefined}
                          alt={instagramProfile.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        '📷'
                      )}
                    </div>

                    {/* Profile Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-slate-900">@{instagramProfile.username}</p>
                        {instagramProfile.verified && (
                          <span className="text-blue-600 text-sm">✓</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{instagramProfile.name}</p>
                      <p className="text-xs text-slate-600 mb-3 line-clamp-2">
                        {instagramProfile.bio || 'Sem bio'}
                      </p>
                      <p className="text-xs font-semibold text-slate-700">
                        👥 {(instagramProfile.followers / 1000).toFixed(1)}K seguidores
                      </p>
                    </div>

                    {/* Check Icon */}
                    {profileConfirmed && (
                      <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
                    )}
                  </div>

                  {/* Confirm Button */}
                  {!profileConfirmed && (
                    <button
                      onClick={handleConfirmProfile}
                      className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={18} />
                      Conectar este Perfil
                    </button>
                  )}

                  {profileConfirmed && (
                    <p className="w-full mt-4 text-center text-sm font-medium text-green-700">
                      ✓ Perfil conectado com sucesso!
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg border-2 border-slate-300 text-slate-900 font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={20} />
            Voltar
          </button>

          <button
            onClick={handleNext}
            disabled={!canProceed}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLastStep ? (
              <>
                Começar Análise
                <ChevronRight size={20} />
              </>
            ) : (
              <>
                Próximo
                <ChevronRight size={20} />
              </>
            )}
          </button>
        </div>

        {/* Indicators */}
        <div className="flex gap-2 justify-center mt-8">
          {STEPS.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all ${
                index <= currentStep
                  ? 'bg-blue-500 w-6'
                  : 'bg-slate-200 w-2'
              }`}
            />
          ))}
        </div>
      </div>
      )}

      {/* Modal de Análise — Mensagem Inspiradora Pessoal */}
      {showAnalysisModal && aiAnalysis && !loadingAnalysis && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">

            {/* Conteúdo — Mensagem Inspiradora + Análise */}
            <div className="p-6 md:p-10 space-y-6 md:space-y-8">
              {/* Título Principal */}
              <div className="space-y-4 text-center">
                <h2 className="text-2xl md:text-4xl font-bold text-slate-900 leading-tight whitespace-pre-line">
                  {userArchetype === 'Educador' ? `Você não apenas ensina,\nvocê transforma vidas.` :
                   userArchetype === 'Influenciador' ? `Sua voz é poder.\nSeu alcance é responsabilidade.` :
                   userArchetype === 'Empreendedor' ? `Você constrói impérios,\nnão apenas conteúdo.` :
                   userArchetype === 'Especialista' ? `Seu conhecimento é escasso.\nO mercado paga caro por isso.` :
                   userArchetype === 'Creator' ? `Você não cria para agradar,\nvocê cria porque é quem é.` :
                   userArchetype === 'Mentor' ? `Você não segue um caminho,\nvocê o ilumina para outros.` :
                   userArchetype === 'Inovador' ? `Enquanto outros copiam,\nvocê está inventando.` :
                   userArchetype === 'Estrategista' ? `Cada movimento é calculado.\nCada palavra tem propósito.` :
                   `Você tem algo que o mundo precisa.`}
                </h2>

                <p className="text-base text-slate-600 leading-relaxed">
                  {userArchetype === 'Educador' ? `No ${aiAnalysis.nicho}, seus alunos existem. Encontramos os padrões de conteúdo que geram impacto real. Agora é hora de entregar conhecimento que muda trajetórias.` :
                   userArchetype === 'Influenciador' ? `No ${aiAnalysis.nicho}, seu público é leal. Mapeamos o que ele realmente quer consumir. A hora de crescer exponencialmente é agora.` :
                   userArchetype === 'Empreendedor' ? `No ${aiAnalysis.nicho}, cada vídeo é uma oportunidade. Encontramos o que converte, o que vende, o que escala. Seu negócio não vai parar de crescer.` :
                   userArchetype === 'Especialista' ? `No ${aiAnalysis.nicho}, você é raro. Rastreamos quem busca por alguém como você. É hora de dominar sua posição e gerar renda com seu expertise.` :
                   userArchetype === 'Creator' ? `No ${aiAnalysis.nicho}, seu estilo é único. Descobrimos o que funciona para você. Agora é hora de viralizar sem copiar ninguém.` :
                   userArchetype === 'Mentor' ? `No ${aiAnalysis.nicho}, você orienta pessoas. Encontramos o conteúdo que toca corações e muda perspectivas. Suas mensagens vão ressoar ainda mais.` :
                   userArchetype === 'Inovador' ? `No ${aiAnalysis.nicho}, você está à frente. Mapeamos o que está nascendo e o que você deve elevar. Seu tempo de dominar chegou.` :
                   userArchetype === 'Estrategista' ? `No ${aiAnalysis.nicho}, a precisão é tudo. Encontramos os padrões que amplificam seu poder estratégico. Prepare-se para escalar de forma inteligente.` :
                   `No ${aiAnalysis.nicho}, você tem espaço para crescer. Vamos encontrar seus vídeos que decolam.`}
                </p>
              </div>

              {/* Análise Detalhada */}
              {archetypeAnalysis && (
                <div className="bg-slate-50 rounded-xl p-4 md:p-6 space-y-4 border border-slate-200">
                  {archetypeAnalysis.por_que && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Por quê</p>
                      <p className="text-sm text-slate-700">{archetypeAnalysis.por_que}</p>
                    </div>
                  )}

                  {archetypeAnalysis.caracteristicas && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Características</p>
                      <div className="flex flex-wrap gap-2">
                        {archetypeAnalysis.caracteristicas.split('|').map((caract: string, i: number) => (
                          <span key={i} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                            {caract.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {archetypeAnalysis.forca && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sua Força</p>
                      <p className="text-sm font-semibold text-slate-900">⚡ {archetypeAnalysis.forca}</p>
                    </div>
                  )}

                  {archetypeAnalysis.estrategia && (
                    <div className="bg-white rounded-lg p-3 border border-blue-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Estratégia</p>
                      <p className="text-sm text-slate-700">📍 {archetypeAnalysis.estrategia}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Chamada Final */}
              <div className="text-center pt-2">
                <p className="text-slate-700 font-semibold text-lg">
                  Os vídeos que você precisa estudar já estão aqui.
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 flex gap-3 rounded-b-3xl">
              <button
                onClick={() => setShowAnalysisModal(false)}
                className="flex-1 px-4 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-semibold transition-colors backdrop-blur-sm"
              >
                Revisar
              </button>
              <button
                onClick={() => onComplete({
                  ...formData,
                  bio: instagramProfile?.bio || '',
                  followers: instagramProfile?.followers || 0,
                  following: instagramProfile?.following || 0,
                  posts: instagramProfile?.posts || 0,
                  profilePic: instagramProfile?.profilePic || null,
                  verified: instagramProfile?.verified || false,
                })}
                className="flex-1 px-4 py-3 bg-white text-purple-600 hover:bg-slate-100 rounded-xl font-bold transition-all shadow-lg"
              >
                Vamos Lá! 🎯
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Carregando Análise — só quando o usuário pediu pra ver o resultado */}
      {showAnalysisModal && loadingAnalysis && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <Loader className="animate-spin text-blue-600 mx-auto mb-4" size={40} />
            <p className="text-lg font-semibold text-slate-900">Analisando seu perfil...</p>
            <p className="text-slate-600 text-sm mt-2">Isso pode levar alguns segundos</p>
          </div>
        </div>
      )}
    </div>
  );
}
