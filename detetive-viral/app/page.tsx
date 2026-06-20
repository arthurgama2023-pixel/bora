'use client';

import { useState, useEffect } from 'react';
import LandingPage from '@/components/LandingPage';
import WizardForm from '@/components/WizardForm';
import Dashboard from '@/components/Dashboard';
import { useVideos } from '@/context/VideosContext';

interface UserProfile {
  name: string;
  instagram: string;
  niche: string;
  painPoints: string;
  desires: string;
}

export default function Home() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [started, setStarted] = useState(false); // false = mostra a landing/oferta
  const STORAGE_KEY = 'detetiveviral_profile';
  const { setVideos, setVideosViral, setAiAnalysis } = useVideos();

  // Zera os dados virais do perfil anterior (contexto vive no layout e sobrevive à troca de @)
  const clearViralData = () => {
    setVideos([]);
    setVideosViral([]);
    setAiAnalysis(null);
  };

  // Ao abrir: 1) ?u=usuario (atalho dev) 2) sessão salva (sobrevive a reload/F5)
  useEffect(() => {
    const u = new URLSearchParams(window.location.search).get('u');
    if (u) {
      setUserProfile({ name: u, instagram: u, niche: 'Detectando via IA...', painPoints: '', desires: '' });
      return;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setUserProfile(JSON.parse(saved));
    } catch {}
  }, []);

  // Persiste SEMPRE que o perfil muda (qualquer origem: ?u=, wizard ou restauração)
  useEffect(() => {
    if (userProfile) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(userProfile)); } catch {}
    }
  }, [userProfile]);

  const handleWizardComplete = (profile: UserProfile) => {
    clearViralData(); // garante que o novo @ comece zerado
    setUserProfile(profile);
  };

  // "Editar Perfil" volta ao wizard (não à landing) e limpa a sessão salva
  const handleRestart = () => {
    clearViralData(); // wipe imediato dos dados do perfil atual
    setUserProfile(null);
    setStarted(true);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return (
    <main className="min-h-screen">
      {userProfile ? (
        <Dashboard profile={userProfile} onRestart={handleRestart} />
      ) : started ? (
        <WizardForm onComplete={handleWizardComplete} />
      ) : (
        <LandingPage onStart={() => setStarted(true)} />
      )}
    </main>
  );
}
