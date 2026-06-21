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
  por_que_funciona: string;
  padrao_que_funciona: string;
  gancho: string;
  desenvolvimento: string;
  cta: string;
  exemplo_adaptado: string;
  hashtags_sugeridas: string[];
  tempo_estimado?: string;
  dificuldade?: number;
}

export default function RoteiroPanel({ reel, profile, onClose }: RoteiroPanelProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roteiro, setRoteiro] = useState<Roteiro | null>(null);
  const { getRoteiro, setRoteiro: saveRoteiro, aiAnalysis } = useVideos();

  useEffect(() => {
    let cancelled = false;
    const gerar = async () => {
      setLoading(true);
      setError(null);

      const cached = getRoteiro(reel.id);
      if (cached) {
        console.log('📦 Roteiro encontrado em cache — economizando tokens!');
        if (!cancelled) {
          setRoteiro(cached);
          setLoading(false);
        }
        return;
      }

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
          }),
        });
        if (!res.ok) throw new Error('Falha ao gerar roteiro');
        const data = await res.json();
        if (!cancelled) {
          setRoteiro(data.roteiro);
          saveRoteiro(reel.id, data.roteiro);
          console.log('✅ Roteiro gerado e cacheado!');
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    gerar();
    return () => { cancelled = true; };
  }, [reel.id]);

  const handleCopy = () => {
    if (!roteiro) return;
    const text = `🎬 ROTEIRO — ${reel.theme}
Inspirado em ${reel.creatorHandle}

💡 POR QUE FUNCIONA:
${roteiro.por_que_funciona}

🎬 PADRÃO VIRAL:
${roteiro.padrao_que_funciona}

📌 GANCHO (0-3s):
${roteiro.gancho}

⚡ DESENVOLVIMENTO:
${roteiro.desenvolvimento}

🎯 CTA:
${roteiro.cta}

✨ EXEMPLO ADAPTADO:
${roteiro.exemplo_adaptado}

🏷️ HASHTAGS:
${(roteiro.hashtags_sugeridas || []).map((h) => '#' + h).join(' ')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <article className="relative rounded-xl shadow-lg w-full max-w-[800px] max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up" style={{ backgroundColor: '#ffffff' }}>
        {/* Header */}
        <div className="px-8 py-6 flex items-start justify-between z-10" style={{ borderBottom: '1px solid #eceef0' }}>
          <div className="flex-1">
            <h1 className="text-2xl mb-1" style={{ fontWeight: '600', lineHeight: '1.3', color: '#191c1e' }}>
              Roteiro do Reel
            </h1>
            <p className="text-sm" style={{ fontWeight: '400', lineHeight: '1.5', color: '#717683' }}>
              Inspirado em <span style={{ fontWeight: '600', color: '#003391' }}>{reel.creatorHandle}</span>
              {reel.postUrl && (
                <a href={reel.postUrl} target="_blank" rel="noopener noreferrer" className="ml-2 underline transition-colors text-sm" style={{ color: '#003391' }}>
                  Ver original
                </a>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="transition-colors flex-shrink-0 ml-4 p-1"
            style={{ color: '#717683' }}
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 max-h-[70vh]" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader className="animate-spin" size={40} style={{ color: '#003391' }} />
              <p className="text-base font-semibold" style={{ color: '#191c1e' }}>Gerando roteiro com IA...</p>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: '#ffdad6', border: '1px solid #ba1a1a', color: '#93000a' }}>
              <p className="font-semibold">Erro ao gerar roteiro</p>
              <p>{error}</p>
            </div>
          )}

          {roteiro && !loading && (
            <>
              {/* Por que funciona */}
              <section className="rounded-r-lg p-6" style={{ borderLeft: '4px solid #0047c3', backgroundColor: 'rgba(219, 225, 255, 0.05)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined" style={{ color: '#0047c3', fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
                  <h2 className="text-xs font-bold uppercase" style={{ color: '#0047c3', letterSpacing: '0.05em' }}>Por que funciona</h2>
                </div>
                <p className="text-base leading-relaxed" style={{ fontWeight: '400', lineHeight: '1.6', color: '#191c1e' }}>
                  {roteiro.por_que_funciona}
                </p>
              </section>

              {/* Padrão viral */}
              <section className="rounded-r-lg p-6" style={{ borderLeft: '4px solid #712ae2', backgroundColor: 'rgba(112, 42, 226, 0.05)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined" style={{ color: '#712ae2', fontVariationSettings: "'FILL' 1" }}>videocam</span>
                  <h2 className="text-xs font-bold uppercase" style={{ color: '#712ae2', letterSpacing: '0.05em' }}>Padrão viral</h2>
                </div>
                <ul className="space-y-2">
                  {roteiro.padrao_que_funciona.split('\n').map((item, idx) => {
                    const cleanItem = item.trim();
                    if (!cleanItem) return null;
                    return (
                      <li key={idx} className="flex items-center gap-3">
                        <span className="text-sm font-bold" style={{ color: '#712ae2', minWidth: '24px' }}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="text-base" style={{ color: '#191c1e' }}>
                          {cleanItem.replace(/^[\d.)\-\s]+/, '').trim()}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* Gancho */}
              <section className="rounded-r-lg p-6" style={{ borderLeft: '4px solid #005a6a', backgroundColor: 'rgba(0, 90, 106, 0.05)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined" style={{ color: '#005a6a', fontVariationSettings: "'FILL' 1" }}>keep</span>
                  <h2 className="text-xs font-bold uppercase" style={{ color: '#005a6a', letterSpacing: '0.05em' }}>Gancho (0-3s) — Legendas dinâmicas</h2>
                </div>
                <div className="p-4 rounded italic text-base" style={{ backgroundColor: '#f2f4f6', border: '1px solid #c3c6d6', color: '#717683' }}>
                  "{roteiro.gancho}"
                </div>
              </section>

              {/* Métricas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2 p-4 rounded-lg" style={{ backgroundColor: '#f2f4f6', border: '1px solid #c3c6d6' }}>
                  <span className="text-xs font-bold uppercase" style={{ color: '#717683', letterSpacing: '0.05em' }}>Tempo estimado</span>
                  <span className="text-lg font-bold" style={{ color: '#003391' }}>
                    {roteiro.tempo_estimado || '45 segundos'}
                  </span>
                </div>
                <div className="flex flex-col gap-2 p-4 rounded-lg" style={{ backgroundColor: '#f2f4f6', border: '1px solid #c3c6d6' }}>
                  <span className="text-xs font-bold uppercase" style={{ color: '#717683', letterSpacing: '0.05em' }}>Dificuldade</span>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            backgroundColor: i <= (roteiro.dificuldade || 3) ? '#003391' : '#c3c6d6',
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-sm" style={{ color: '#191c1e' }}>
                      {roteiro.dificuldade === 1 ? 'Fácil' : roteiro.dificuldade === 2 ? 'Fácil-Médio' : roteiro.dificuldade === 3 ? 'Médio' : roteiro.dificuldade === 4 ? 'Médio-Difícil' : 'Difícil'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Desenvolvimento */}
              <section className="rounded-r-lg p-6" style={{ borderLeft: '4px solid #0047c3', backgroundColor: 'rgba(219, 225, 255, 0.05)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined" style={{ color: '#0047c3', fontVariationSettings: "'FILL' 1" }}>notes</span>
                  <h2 className="text-xs font-bold uppercase" style={{ color: '#0047c3', letterSpacing: '0.05em' }}>Desenvolvimento</h2>
                </div>
                <p className="text-base leading-relaxed whitespace-pre-wrap" style={{ fontWeight: '400', lineHeight: '1.6', color: '#191c1e' }}>
                  {roteiro.desenvolvimento}
                </p>
              </section>

              {/* CTA */}
              <section className="rounded-r-lg p-6" style={{ borderLeft: '4px solid #712ae2', backgroundColor: 'rgba(112, 42, 226, 0.05)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined" style={{ color: '#712ae2', fontVariationSettings: "'FILL' 1" }}>send</span>
                  <h2 className="text-xs font-bold uppercase" style={{ color: '#712ae2', letterSpacing: '0.05em' }}>CTA (Chamada para ação)</h2>
                </div>
                <p className="text-base font-semibold" style={{ lineHeight: '1.6', color: '#191c1e' }}>
                  {roteiro.cta}
                </p>
              </section>

              {/* Exemplo adaptado */}
              <section className="rounded-r-lg p-6" style={{ borderLeft: '4px solid #005a6a', backgroundColor: 'rgba(0, 90, 106, 0.05)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined" style={{ color: '#005a6a', fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
                  <h2 className="text-xs font-bold uppercase" style={{ color: '#005a6a', letterSpacing: '0.05em' }}>Como você faria</h2>
                </div>
                <div className="p-4 rounded italic text-base" style={{ backgroundColor: '#f2f4f6', border: '1px solid #c3c6d6', color: '#717683' }}>
                  "{roteiro.exemplo_adaptado}"
                </div>
              </section>

              {/* Hashtags */}
              {roteiro.hashtags_sugeridas?.length > 0 && (
                <section className="rounded-r-lg p-6" style={{ borderLeft: '4px solid #0047c3', backgroundColor: 'rgba(219, 225, 255, 0.05)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined" style={{ color: '#0047c3', fontVariationSettings: "'FILL' 1" }}>label</span>
                    <h2 className="text-xs font-bold uppercase" style={{ color: '#0047c3', letterSpacing: '0.05em' }}>Hashtags sugeridas</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {roteiro.hashtags_sugeridas.map((tag, i) => (
                      <span key={i} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ color: '#0047c3', backgroundColor: '#dbe1ff' }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {roteiro && !loading && (
          <footer className="px-8 py-6 sticky bottom-0" style={{ backgroundColor: '#f2f4f6', borderTop: '1px solid #e6e8ea' }}>
            <button
              onClick={handleCopy}
              className="w-full py-3 px-6 rounded-lg font-bold flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] shadow-md"
              style={{
                backgroundColor: copied ? '#005a6a' : '#003391',
                color: '#ffffff',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                {copied ? 'check' : 'content_copy'}
              </span>
              <span style={{ fontWeight: '600' }}>
                {copied ? 'Roteiro Copiado!' : 'Copiar Roteiro Completo'}
              </span>
            </button>
          </footer>
        )}
      </article>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
