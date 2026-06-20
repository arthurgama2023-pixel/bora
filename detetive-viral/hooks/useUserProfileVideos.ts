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

interface ProfileAnalysis {
  bioKeywords: string[];
  detectedNiche: string;
  postAnalysis: {
    topPerformingTheme: string;
    topPerformingStyle: string;
    avgEngagement: number;
  };
  recommendations: string[];
}

interface UseUserProfileVideosReturn {
  videos: Video[];
  loading: boolean;
  error: string | null;
  userHashtags: string[];
  profileAnalysis: ProfileAnalysis | null;
  fetchVideosFromProfile: (username: string) => Promise<void>;
}

export function useUserProfileVideos(): UseUserProfileVideosReturn {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userHashtags, setUserHashtags] = useState<string[]>([]);
  const [profileAnalysis, setProfileAnalysis] = useState<ProfileAnalysis | null>(null);

  const fetchVideosFromProfile = useCallback(async (username: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3002/api/videos/from-user-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ instagram_username: username, limit: 12 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar vídeos');
      }

      const data = await response.json();
      setVideos(data.videos || []);
      setUserHashtags(data.searchHashtags || []);
      setProfileAnalysis(data.profileAnalysis || null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      console.error('[useUserProfileVideos] Erro:', message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { videos, loading, error, userHashtags, profileAnalysis, fetchVideosFromProfile };
}
