'use client';

import { useState, useEffect } from 'react';
import LandingPage from '@/components/LandingPage';
import OfferScreen from '@/components/OfferScreen';
import WizardForm from '@/components/WizardForm';
import Dashboard from '@/components/Dashboard';
import AuthScreen from '@/components/AuthScreen';
import { useVideos } from '@/context/VideosContext';
import { useAuth } from '@/context/AuthContext';

interface UserProfile {
  name: string;
  instagram: string;
  niche: string;
  painPoints: string;
  desires: string;
}

export default function Home() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [pendingProfile, setPendingProfile] = useState<UserProfile | null>(null); // perfil do wizard aguardando login
  const [started, setStarted] = useState(false); // false = mostra a landing/oferta
  const [showOffer, setShowOffer] = useState(false); // true = mostra a tela de planos/oferta
  const [showAuth, setShowAuth] = useState(false); // true = mostra login/registro
  const STORAGE_KEY = 'detetiveviral_profile';
  const { setVideos, setVideosViral, setAiAnalysis } = useVideos();
  const { user } = useAuth();

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

  // CTA "Analisar meu perfil grátis" na landing: cai direto na esteira do wizard,
  // sem exigir login ainda — login só entra como última etapa, depois dos dados.
  const handleGoToWizard = () => setStarted(true);

  // "Começar agora" na tela de oferta (plano pago): exige login antes do wizard
  const handleStartClick = () => {
    if (user) {
      setShowOffer(false);
      setStarted(true);
    } else {
      setShowAuth(true);
    }
  };

  const handleAuthenticated = () => {
    setShowAuth(false);
    setShowOffer(false);
    if (pendingProfile) {
      setUserProfile(pendingProfile);
      setPendingProfile(null);
    } else {
      setStarted(true);
    }
  };

  const handleWizardComplete = (profile: UserProfile) => {
    clearViralData(); // garante que o novo @ comece zerado
    if (user) {
      setUserProfile(profile);
    } else {
      // guarda o perfil preenchido e só pede login agora, como última etapa
      setPendingProfile(profile);
      setShowAuth(true);
    }
  };

  return (
    <main className="min-h-screen">
      {userProfile ? (
        <Dashboard profile={userProfile} />
      ) : showAuth ? (
        <AuthScreen onAuthenticated={handleAuthenticated} />
      ) : started ? (
        <WizardForm onComplete={handleWizardComplete} />
      ) : showOffer ? (
        <OfferScreen onStart={handleStartClick} onBack={() => setShowOffer(false)} />
      ) : (
        <LandingPage onStart={handleGoToWizard} />
      )}
    </main>
  );
}
