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
  bio?: string;
  followers?: number;
  following?: number;
  posts?: number;
  profilePic?: string | null;
  verified?: boolean;
}

export default function Home() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [pendingProfile, setPendingProfile] = useState<UserProfile | null>(null); // perfil do wizard aguardando login
  const [started, setStarted] = useState(false); // false = mostra a landing/oferta
  const [showOffer, setShowOffer] = useState(false); // true = mostra a tela de planos/oferta
  const [showAuth, setShowAuth] = useState(false); // true = mostra login/registro
  const [authTab, setAuthTab] = useState<'entrar' | 'registrar'>('entrar');
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

  // CTA "Analisar meu perfil grátis" na landing: vai direto para o wizard
  const handleGoToWizard = () => {
    setStarted(true);
  };

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
    // NÃO limpamos os dados virais aqui: o wizard já pré-carregou os vídeos no
    // contexto (em background, desde o 1º passo). Limpar agora apagaria tudo e
    // forçaria nova busca no dashboard. O dashboard reaproveita o que já está pronto.
    if (user) {
      setUserProfile(profile);
    } else {
      // guarda o perfil preenchido e vai para tela de autenticação
      setPendingProfile(profile);
      setAuthTab('registrar');
      setShowAuth(true);
    }
  };

  return (
    <main className="min-h-screen">
      {userProfile ? (
        <Dashboard profile={userProfile} />
      ) : showAuth ? (
        <AuthScreen onAuthenticated={handleAuthenticated} defaultTab={authTab} />
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
