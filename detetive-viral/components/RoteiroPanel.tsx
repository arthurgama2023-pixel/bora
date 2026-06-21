'use client';

import { Loader } from 'lucide-react';
import { useState, useEffect } from 'react';
import { API_URL } from '@/lib/api';
import { useVideos } from '@/context/VideosContext';

interface RoteiroPanelProps {
  reel: {
    id: string;
    creator: string;
    creatorHandle: string;
    description: string;
    caption?: string;
    hashtags?: string[];
    theme: string;
    engagementRate: number;
    views?: number;
    postUrl?: string;
    videoUrl?: string;
  };
  profile: {
    name: string;
    instagram: string;
    niche: string;
    painPoints: string;
    desires: string;
  };
  onClose: () => void;
}

interface Roteiro {
  por_que_viral: string;
  abertura_fala: string;
  abertura_visual: string;
  meio: string[];
  final: string;
  dicas_edicao: string[];
  sua_versao: string;
  hashtags_sugeridas: string[];
  tempo_estimado?: string;
  dificuldade?: number | string;
}

interface GeminiAnalysis {
  gancho_visual?: string;
  transcricao?: string;
  legendas_tela?: string;
  ritmo_edicao?: string;
  estrategia_narrativa?: string;
  por_que_para_o_scroll?: string;
  tom_energia?: string;
  duracao_estimada?: string;
}

const LOADING_STEPS_VIDEO = [
  { icon: 'movie',        label: 'Baixando vídeo...' },
  { icon: 'smart_toy',   label: 'Gemini lendo frames e áudio...' },
  { icon: 'auto_awesome', label: 'Montando seu roteiro...' },
];
const LOADING_STEPS_CAPTION = [
  { icon: 'auto_awesome', label: 'Montando seu roteiro...' },
];

export default function RoteiroPanel({ reel, profile, onClose }: RoteiroPanelProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [roteiro, setRoteiro] = useState<Roteiro | null>(null);
  const [fonte, setFonte] = useState<'gemini' | 'caption' | null>(null);
  const [geminiData, setGeminiData] = useState<GeminiAnalysis | null>(null);
  const { getRoteiro, setRoteiro: saveRoteiro, aiAnalysis } = useVideos();

  const hasVideo = !!reel.videoUrl;
  const steps = hasVideo ? LOADING_STEPS_VIDEO : LOADING_STEPS_CAPTION;

  useEffect(() => {
    let cancelled = false;
    let stepTimer: ReturnType<typeof setInterval> | null = null;

    const gerar = async () => {
      setLoading(true);
      setLoadingStep(0);
      setError(null);

      const cached = getRoteiro(reel.id);
      if (cached) {
        if (!cancelled) {
          setRoteiro(cached as unknown as Roteiro);
          setFonte('gemini');
          setLoading(false);
        }
        return;
      }

      stepTimer = setInterval(() => {
        if (!cancelled) setLoadingStep(s => Math.min(s + 1, steps.length - 1));
      }, 8000);

      try {
        const res = await fetch(`${API_URL}/api/roteiro`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caption: reel.caption || reel.description,
            creator: reel.creator,
            theme: reel.theme,
            niche: aiAnalysis?.nicho || profile.niche || reel.theme,
            painPoints: profile.painPoints,
            desires: profile.desires,
            postUrl: reel.postUrl,
            videoUrl: reel.videoUrl,
          }),
        });
        if (!res.ok) throw new Error('Falha ao gerar roteiro');
        const data = await res.json();
        if (!cancelled) {
          setRoteiro(data.roteiro);
          setFonte(data.fonte || 'caption');
          setGeminiData(data.geminiAnalysis || null);
          saveRoteiro(reel.id, data.roteiro);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      } finally {
        if (stepTimer) clearInterval(stepTimer);
        if (!cancelled) setLoading(false);
      }
    };

    gerar();
    return () => {
      cancelled = true;
      if (stepTimer) clearInterval(stepTimer);
    };
  }, [reel.id]);

  const dificuldadeNum = Math.min(5, Math.max(1, Math.round(Number(roteiro?.dificuldade)) || 3));
  const dificuldadeLabel = ['Fácil', 'Fácil', 'Médio', 'Avançado', 'Difícil'][dificuldadeNum - 1];

  const meioItems = Array.isArray(roteiro?.meio)
    ? roteiro.meio.filter(Boolean)
    : typeof roteiro?.meio === 'string'
      ? [roteiro.meio]
      : [];

  const edicaoItems = Array.isArray(roteiro?.dicas_edicao)
    ? roteiro.dicas_edicao.filter(Boolean)
    : typeof roteiro?.dicas_edicao === 'string'
      ? [roteiro.dicas_edicao]
      : [];

  const handleCopy = () => {
    if (!roteiro) return;
    const text = `🎬 ROTEIRO — ${reel.creatorHandle}

💡 POR QUE ESSE VÍDEO VIRALIZOU:
${roteiro.por_que_viral}

📌 ABERTURA (0-3s):
Fale: "${roteiro.abertura_fala}"
Visual: ${roteiro.abertura_visual}

🎤 MEIO DO VÍDEO:
${meioItems.map((p, i) => `${i + 1}. ${p}`).join('\n')}

🔚 COMO TERMINAR:
${roteiro.final}

✂️ DICAS DE EDIÇÃO:
${edicaoItems.map((d, i) => `${i + 1}. ${d}`).join('\n')}

✨ SUA VERSÃO (pronto pra gravar):
${roteiro.sua_versao}

🏷️ HASHTAGS:
${(roteiro.hashtags_sugeridas || []).map(h => '#' + h).join(' ')}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <article className="relative rounded-xl shadow-2xl w-full max-w-[780px] max-h-[88vh] flex flex-col overflow-hidden animate-fade-in-up" style={{ backgroundColor: '#ffffff' }}>

        {/* Header */}
        <div className="px-7 py-5 flex items-start justify-between" style={{ borderBottom: '1px solid #eceef0' }}>
          <div className="flex-1">
            <h1 className="text-xl font-bold mb-1" style={{ color: '#191c1e' }}>Roteiro do Reel</h1>
            <p className="text-sm" style={{ color: '#717683' }}>
              Inspirado em <span style={{ fontWeight: '700', color: '#003391' }}>{reel.creatorHandle}</span>
              {reel.postUrl && (
                <a href={reel.postUrl} target="_blank" rel="noopener noreferrer" className="ml-2 underline text-sm" style={{ color: '#003391' }}>
                  Ver original
                </a>
              )}
            </p>
          </div>
          <button onClick={onClose} style={{ color: '#717683' }} className="ml-4 p-1 transition-colors hover:text-[#191c1e]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-5" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-5">
              <div className="relative w-14 h-14 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full animate-spin" style={{ border: '3px solid #dbe1ff', borderTopColor: '#003391' }} />
                <span className="material-symbols-outlined text-2xl" style={{ color: '#003391', fontVariationSettings: "'FILL' 1" }}>
                  {steps[loadingStep]?.icon}
                </span>
              </div>
              <div className="text-center">
                <p className="text-base font-semibold mb-1" style={{ color: '#191c1e' }}>{steps[loadingStep]?.label}</p>
                <p className="text-xs" style={{ color: '#717683' }}>
                  {hasVideo ? 'Analisando o vídeo real com Gemini + Claude' : 'Usando a legenda do reel'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {steps.map((_, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full transition-all" style={{ backgroundColor: idx <= loadingStep ? '#003391' : '#c3c6d6' }} />
                    {idx < steps.length - 1 && <div className="w-8 h-px" style={{ backgroundColor: idx < loadingStep ? '#003391' : '#c3c6d6' }} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Erro */}
          {error && !loading && (
            <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: '#ffdad6', border: '1px solid #ba1a1a', color: '#93000a' }}>
              <p className="font-semibold">Erro ao gerar roteiro</p>
              <p>{error}</p>
            </div>
          )}

          {roteiro && !loading && (
            <>
              {/* Badge de fonte */}
              <div>
                {fonte === 'gemini' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ backgroundColor: '#005a6a', color: '#fff' }}>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: '14px' }}>smart_toy</span>
                    Análise real do vídeo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ backgroundColor: '#e6e8ea', color: '#434655' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>text_snippet</span>
                    Baseado na legenda
                  </span>
                )}
              </div>

              {/* Transcrição real (só com Gemini) */}
              {geminiData?.transcricao && (
                <section className="rounded-r-lg p-4" style={{ borderLeft: '4px solid #005a6a', backgroundColor: 'rgba(0,90,106,0.04)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-sm" style={{ color: '#005a6a', fontVariationSettings: "'FILL' 1" }}>mic</span>
                    <h2 className="text-xs font-bold uppercase" style={{ color: '#005a6a', letterSpacing: '0.05em' }}>O que foi dito no vídeo (transcrição real)</h2>
                  </div>
                  <p className="text-sm italic leading-relaxed" style={{ color: '#434655' }}>"{geminiData.transcricao}"</p>
                </section>
              )}

              {/* 1. Por que viralizou */}
              <section className="rounded-r-lg p-5" style={{ borderLeft: '4px solid #0047c3', backgroundColor: 'rgba(219,225,255,0.08)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined" style={{ color: '#0047c3', fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
                  <h2 className="text-xs font-bold uppercase" style={{ color: '#0047c3', letterSpacing: '0.05em' }}>Por que esse vídeo viralizou</h2>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#191c1e', lineHeight: '1.6' }}>{roteiro.por_que_viral}</p>
              </section>

              {/* 2. Como gravar — passo a passo */}
              <section className="rounded-r-lg p-5" style={{ borderLeft: '4px solid #712ae2', backgroundColor: 'rgba(113,42,226,0.05)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined" style={{ color: '#712ae2', fontVariationSettings: "'FILL' 1" }}>videocam</span>
                  <h2 className="text-xs font-bold uppercase" style={{ color: '#712ae2', letterSpacing: '0.05em' }}>Como gravar — passo a passo</h2>
                </div>

                {/* Abertura */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: '#712ae2', color: '#fff' }}>0s – 3s</span>
                    <span className="text-xs font-bold uppercase" style={{ color: '#712ae2', letterSpacing: '0.04em' }}>Abertura</span>
                  </div>
                  <div className="rounded-lg p-3 mb-2" style={{ backgroundColor: '#f2f4f6', border: '1px solid #c3c6d6' }}>
                    <p className="text-xs font-bold mb-1" style={{ color: '#434655' }}>FALE ISSO:</p>
                    <p className="text-sm font-semibold italic" style={{ color: '#191c1e' }}>"{roteiro.abertura_fala}"</p>
                  </div>
                  {roteiro.abertura_visual && (
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-sm flex-shrink-0 mt-0.5" style={{ color: '#717683' }}>visibility</span>
                      <p className="text-xs" style={{ color: '#717683' }}>{roteiro.abertura_visual}</p>
                    </div>
                  )}
                </div>

                {/* Meio */}
                {meioItems.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: '#712ae2', color: '#fff' }}>3s – fim</span>
                      <span className="text-xs font-bold uppercase" style={{ color: '#712ae2', letterSpacing: '0.04em' }}>Desenvolvimento</span>
                    </div>
                    <ul className="space-y-2">
                      {meioItems.map((ponto, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="text-xs font-bold flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: '#dbe1ff', color: '#003391' }}>
                            {i + 1}
                          </span>
                          <span className="text-sm" style={{ color: '#191c1e', lineHeight: '1.5' }}>{ponto}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Final */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: '#712ae2', color: '#fff' }}>Encerramento</span>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: '#f2f4f6', border: '1px solid #c3c6d6' }}>
                    <p className="text-sm" style={{ color: '#191c1e' }}>{roteiro.final}</p>
                  </div>
                </div>
              </section>

              {/* 3. Dicas de edição */}
              {edicaoItems.length > 0 && (
                <section className="rounded-r-lg p-5" style={{ borderLeft: '4px solid #005a6a', backgroundColor: 'rgba(0,90,106,0.05)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined" style={{ color: '#005a6a', fontVariationSettings: "'FILL' 1" }}>cut</span>
                    <h2 className="text-xs font-bold uppercase" style={{ color: '#005a6a', letterSpacing: '0.05em' }}>Dicas de edição</h2>
                  </div>
                  <ul className="space-y-2">
                    {edicaoItems.map((dica, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-sm flex-shrink-0 mt-0.5" style={{ color: '#005a6a', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        <span className="text-sm" style={{ color: '#191c1e', lineHeight: '1.5' }}>{dica}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* 4. Sua versão */}
              <section className="rounded-r-lg p-5" style={{ borderLeft: '4px solid #0047c3', backgroundColor: 'rgba(219,225,255,0.08)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined" style={{ color: '#0047c3', fontVariationSettings: "'FILL' 1" }}>edit_note</span>
                  <h2 className="text-xs font-bold uppercase" style={{ color: '#0047c3', letterSpacing: '0.05em' }}>Sua versão — pronto pra gravar</h2>
                </div>
                <div className="rounded-lg p-4" style={{ backgroundColor: '#f2f4f6', border: '1px solid #c3c6d6' }}>
                  <p className="text-sm leading-relaxed" style={{ color: '#191c1e', lineHeight: '1.7' }}>{roteiro.sua_versao}</p>
                </div>
              </section>

              {/* 5. Hashtags */}
              {(roteiro.hashtags_sugeridas?.length ?? 0) > 0 && (
                <section className="rounded-r-lg p-5" style={{ borderLeft: '4px solid #712ae2', backgroundColor: 'rgba(113,42,226,0.04)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined" style={{ color: '#712ae2', fontVariationSettings: "'FILL' 1" }}>label</span>
                    <h2 className="text-xs font-bold uppercase" style={{ color: '#712ae2', letterSpacing: '0.05em' }}>Hashtags</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {roteiro.hashtags_sugeridas.map((tag, i) => (
                      <span key={i} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ color: '#003391', backgroundColor: '#dbe1ff' }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* 6. Métricas */}
              <div className="grid grid-cols-2 gap-3 pb-2">
                <div className="flex flex-col gap-1 p-4 rounded-lg" style={{ backgroundColor: '#f2f4f6', border: '1px solid #c3c6d6' }}>
                  <span className="text-xs font-bold uppercase" style={{ color: '#717683', letterSpacing: '0.05em' }}>Tempo de vídeo</span>
                  <span className="text-lg font-bold" style={{ color: '#003391' }}>{roteiro.tempo_estimado || '30–45 segundos'}</span>
                </div>
                <div className="flex flex-col gap-2 p-4 rounded-lg" style={{ backgroundColor: '#f2f4f6', border: '1px solid #c3c6d6' }}>
                  <span className="text-xs font-bold uppercase" style={{ color: '#717683', letterSpacing: '0.05em' }}>Dificuldade</span>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: i <= dificuldadeNum ? '#003391' : '#c3c6d6' }} />
                      ))}
                    </div>
                    <span className="text-sm font-semibold" style={{ color: '#191c1e' }}>{dificuldadeLabel}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {roteiro && !loading && (
          <footer className="px-7 py-5" style={{ backgroundColor: '#f2f4f6', borderTop: '1px solid #e6e8ea' }}>
            <button
              onClick={handleCopy}
              className="w-full py-3 px-6 rounded-lg font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md"
              style={{ backgroundColor: copied ? '#005a6a' : '#003391', color: '#fff' }}
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'Copiado!' : 'Copiar roteiro completo'}</span>
            </button>
          </footer>
        )}
      </article>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
