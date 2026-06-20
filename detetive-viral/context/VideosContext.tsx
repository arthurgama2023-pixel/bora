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

interface Roteiro {
  transcricao: string;
  gancho: string;
  desenvolvimento: string;
  cta: string;
  hashtags_sugeridas: string[];
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
  roteiros: Map<string, Roteiro>;
  setRoteiro: (reelId: string, roteiro: Roteiro) => void;
  getRoteiro: (reelId: string) => Roteiro | undefined;
}

const VideosContext = createContext<VideosContextType | undefined>(undefined);

export function VideosProvider({ children }: { children: ReactNode }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [videosViral, setVideosViral] = useState<Video[]>([]);
  const [roteiros, setRoteiros] = useState<Map<string, Roteiro>>(new Map());

  const addVideos = (newVideos: Video[]) => {
    setVideos((prev) => [...prev, ...newVideos]);
  };

  const setRoteiro = (reelId: string, roteiro: Roteiro) => {
    setRoteiros((prev) => new Map(prev).set(reelId, roteiro));
  };

  const getRoteiro = (reelId: string): Roteiro | undefined => {
    return roteiros.get(reelId);
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
