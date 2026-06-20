import { useState, useCallback } from 'react';

interface Video {
  id: string;
  creator: string;
  creatorHandle: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  description: string;
  theme: string;
  engagementRate: number;
  thumbnail: string;
  videoUrl?: string;
}

interface UseTrendingVideosReturn {
  videos: Video[];
  loading: boolean;
  error: string | null;
  fetchVideos: (niche: string) => Promise<void>;
}

export function useTrendingVideos(): UseTrendingVideosReturn {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = useCallback(async (niche: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3002/api/videos/trending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ niche, limit: 12 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar vídeos');
      }

      const data = await response.json();
      setVideos(data.videos || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      console.error('[useTrendingVideos] Erro:', message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { videos, loading, error, fetchVideos };
}
