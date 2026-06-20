'use client';

import { X, Copy, Loader, Zap, ExternalLink } from 'lucide-react';
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
  transcricao: string;
  gancho: string;
  desenvolvimento: string;
  cta: string;
  hashtags_sugeridas: string[];
}

export default function RoteiroPanel({ reel, profile, onClose }: RoteiroPanelProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roteiro, setRoteiro] = useState<Roteiro | null>(null);
  const { getRoteiro, setRoteiro: saveRoteiro } = useVideos();

  useEffect(() => {
    let cancelled = false;
    const gerar = async () => {
      setLoading(true);
      setError(null);

      // Tenta recuperar do cache primeiro
      const cached = getRoteiro(reel.id);
      if (cached) {
        console.log('📦 Roteiro encontrado em cache — economizando tokens!');
        if (!cancelled) {
          setRoteiro(cached);
          setLoading(false);
        }
        return;
      }

      // Se não estiver em cache, chama a API
      try {
        const res = await fetch(`${API_URL}/api/roteiro`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caption: reel.caption || reel.description,
            creator: reel.creator,
            theme: reel.theme,
            niche: profile.niche,
            painPoints: profile.painPoints,
            desires: profile.desires,
            postUrl: reel.postUrl,
          }),
        });
        if (!res.ok) throw new Error('Falha ao gerar roteiro');
        const data = await res.json();
        if (!cancelled) {
          setRoteiro(data.roteiro);
          // Salva no cache para próxima vez
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

📖 ANÁLISE (gerada por IA):
${roteiro.transcricao}

📌 GANCHO (0-3s):
${roteiro.gancho}

⚡ DESENVOLVIMENTO:
${roteiro.desenvolvimento}

🎯 CTA:
${roteiro.cta}

🏷️ HASHTAGS:
${(roteiro.hashtags_sugeridas || []).map((h) => '#' + h).join(' ')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal centralizado */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[#e0e3e5] sticky top-0 bg-white flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[#0037b0]">lightbulb</span>
              <span className="text-xs font-bold text-[#0037b0] uppercase tracking-wider">{reel.theme}</span>
            </div>
            <h2 className="text-2xl font-bold text-[#191c1e] mb-1">Roteiro do Reel</h2>
            <p className="text-sm text-[#434655]">
              Inspirado em <span className="font-semibold">{reel.creatorHandle}</span>
              {reel.postUrl && (
                <a href={reel.postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ml-2 text-[#0037b0] hover:underline font-medium">
                  Ver original <ExternalLink size={14} />
                </a>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-[#747686] hover:text-[#191c1e] transition-colors p-1">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative w-12 h-12">
                <Loader className="absolute animate-spin text-[#0037b0]" size={48} />
              </div>
              <p className="text-base text-[#191c1e] font-semibold">Gerando roteiro com IA...</p>
              <p className="text-sm text-[#747686]">Analisando a caption e seu nicho para criar sugestões personalizadas</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2 text-xs text-blue-900">
                ℹ️ Roteiro gerado por IA baseado na caption do vídeo, não é transcrição real
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-900">
              <p className="font-semibold mb-1">Erro ao gerar roteiro</p>
              {error}
            </div>
          )}

          {roteiro && !loading && (
            <>
              {/* Análise gerada por IA */}
              <div className="bg-[#f7f9fb] rounded-xl p-5 border border-[#e0e3e5]">
                <p className="text-xs font-bold text-[#434655] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#0037b0]">auto_awesome</span>
                  Análise gerada por IA
                </p>
                <p className="text-base text-[#191c1e] leading-relaxed">{roteiro.transcricao}</p>
              </div>

              {/* Gancho */}
              <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
                <p className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-3">📌 Gancho (0-3s)</p>
                <textarea
                  defaultValue={roteiro.gancho}
                  rows={2}
                  className="w-full text-sm text-[#191c1e] bg-white rounded-lg p-3 border border-blue-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none font-medium"
                />
              </div>

              {/* Desenvolvimento */}
              <div className="bg-green-50 rounded-xl p-5 border border-green-200">
                <p className="text-xs font-bold text-green-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Zap size={16} /> Desenvolvimento
                </p>
                <textarea
                  defaultValue={roteiro.desenvolvimento}
                  rows={5}
                  className="w-full text-sm text-[#191c1e] bg-white rounded-lg p-3 border border-green-300 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 resize-none leading-relaxed"
                />
              </div>

              {/* CTA */}
              <div className="bg-purple-50 rounded-xl p-5 border border-purple-200">
                <p className="text-xs font-bold text-purple-900 uppercase tracking-wider mb-3">🎯 CTA (Call-to-Action)</p>
                <textarea
                  defaultValue={roteiro.cta}
                  rows={2}
                  className="w-full text-sm text-[#191c1e] bg-white rounded-lg p-3 border border-purple-300 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none font-medium"
                />
              </div>

              {/* Hashtags sugeridas */}
              {roteiro.hashtags_sugeridas?.length > 0 && (
                <div className="bg-orange-50 rounded-xl p-5 border border-orange-200">
                  <p className="text-xs font-bold text-orange-900 uppercase tracking-wider mb-3">🏷️ Hashtags sugeridas</p>
                  <div className="flex flex-wrap gap-2">
                    {roteiro.hashtags_sugeridas.map((tag, i) => (
                      <span key={i} className="text-sm font-semibold text-orange-900 bg-white border border-orange-300 px-3 py-1.5 rounded-full hover:bg-orange-100 transition-colors cursor-pointer">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                <p className="font-semibold mb-1">ℹ️ Sobre este roteiro</p>
                <p className="text-blue-800">Gerado por IA baseado na caption do vídeo original e no seu nicho. Use como inspiração e adapte conforme necessário.</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {roteiro && !loading && (
          <div className="p-6 border-t border-[#e0e3e5] bg-white sticky bottom-0">
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0037b0] text-white font-bold hover:bg-[#0033a0] active:scale-95 transition-all shadow-lg"
            >
              <Copy size={20} />
              {copied ? '✓ Copiado!' : 'Copiar Roteiro Completo'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
