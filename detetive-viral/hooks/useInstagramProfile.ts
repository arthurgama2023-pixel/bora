import { useState, useCallback } from 'react';

interface InstagramProfile {
  username: string;
  name: string;
  bio: string;
  followers: number;
  following: number;
  posts: number;
  profilePic: string | null;
  verified: boolean;
  isPrivate: boolean;
  externalUrl: string | null;
  url: string;
}

interface UseInstagramProfileReturn {
  profile: InstagramProfile | null;
  loading: boolean;
  error: string | null;
  fetchProfile: (username: string) => Promise<void>;
}

export function useInstagramProfile(): UseInstagramProfileReturn {
  const [profile, setProfile] = useState<InstagramProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (username: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3002/api/instagram/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar perfil');
      }

      const data = await response.json();
      setProfile(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      console.error('[useInstagramProfile] Erro:', message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { profile, loading, error, fetchProfile };
}
