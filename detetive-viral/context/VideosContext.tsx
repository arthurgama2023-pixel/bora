'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface Video {
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
  viralityScore: number;
  velocity?: number;
  ageDays?: number;
  thumbnail: string;
  postUrl: string;
}

interface AiAnalysis {
  nicho: string;
  hashtags: string[];
  confianca: string;
}

// Duas formas possíveis: (1) o roteiro padrão minimalista — só "o que deu
// certo" + "modelo usado" no vídeo real; (2) o roteiro da estratégia Marca em
// Alta, que de fato gera um roteiro novo pra gravar (campos legados).
interface ComoUsarOpcao {
  forma: string;
  como: string;
}

interface Roteiro {
  formato?: string | null;
  modelo_usado?: string | null;
  modelo_explicado?: string;
  o_que_deu_certo?: string[];
  como_usar?: ComoUsarOpcao[];
  // Campos legados — só presentes quando estrategia === 'marca_em_alta'
  por_que_viral?: string;
  abertura_fala?: string;
  abertura_visual?: string;
  meio?: string[];
  final?: string;
  dicas_edicao?: string[];
  sua_versao?: string | { inicio: string; meio: string; encerramento: string };
  hashtags_sugeridas?: string[];
  tempo_estimado?: string;
  dificuldade?: number | string;
}

// Cache do roteiro guarda o payload COMPLETO (não só o roteiro), p/ reabrir o
// mesmo vídeo restaurar transcrição/estratégia/badge idênticos à 1ª geração.
interface RoteiroCacheEntry {
  roteiro: Roteiro;
  fonte: 'gemini' | 'sem_dados' | 'caption';
  geminiAnalysis: Record<string, unknown> | null;
  estrategia: string | null;
}

interface VideosContextType {
  videos: Video[];
  setVideos: (videos: Video[]) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  addVideos: (newVideos: Video[]) => void;
  aiAnalysis: AiAnalysis | null;
  setAiAnalysis: (analysis: AiAnalysis | null) => void;
  videosViral: Video[];
  setVideosViral: (videos: Video[]) => void;
  roteiros: Map<string, RoteiroCacheEntry>;
  setRoteiro: (cacheKey: string, entry: RoteiroCacheEntry) => void;
  getRoteiro: (cacheKey: string) => RoteiroCacheEntry | undefined;
}

const VideosContext = createContext<VideosContextType | undefined>(undefined);

export function VideosProvider({ children }: { children: ReactNode }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [videosViral, setVideosViral] = useState<Video[]>([]);
  const [roteiros, setRoteiros] = useState<Map<string, RoteiroCacheEntry>>(new Map());

  const addVideos = (newVideos: Video[]) => {
    setVideos((prev) => [...prev, ...newVideos]);
  };

  const setRoteiro = (cacheKey: string, entry: RoteiroCacheEntry) => {
    setRoteiros((prev) => new Map(prev).set(cacheKey, entry));
  };

  const getRoteiro = (cacheKey: string): RoteiroCacheEntry | undefined => {
    return roteiros.get(cacheKey);
  };

  return (
    <VideosContext.Provider
      value={{
        videos,
        setVideos,
        loading,
        setLoading,
        error,
        setError,
        addVideos,
        aiAnalysis,
        setAiAnalysis,
        videosViral,
        setVideosViral,
        roteiros,
        setRoteiro,
        getRoteiro,
      }}
    >
      {children}
    </VideosContext.Provider>
  );
}

export function useVideos() {
  const context = useContext(VideosContext);
  if (!context) {
    throw new Error('useVideos must be used within VideosProvider');
  }
  return context;
}
