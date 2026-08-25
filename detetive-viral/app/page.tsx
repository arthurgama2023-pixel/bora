'use client';

import { useState, useEffect } from 'react';
import LandingPage from '@/components/LandingPage';
import OfferScreen from '@/components/OfferScreen';
import WizardForm from '@/components/WizardForm';
import Dashboard from '@/components/Dashboard';
import AuthScreen from '@/components/AuthScreen';
import { useVideos } from '@/context/VideosContext';
import { useAuth } from '@/context/AuthContext';
import { linkProfile, getUserProfile, type LinkedProfile } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import AdminDashboard from '@/components/AdminDashboard';

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
  const [showAdmin, setShowAdmin] = useState(false); // admin dashboard
  const STORAGE_KEY = 'detetiveviral_profile';
  const { setVideos, setVideosViral, setAiAnalysis, setFrequency } = useVideos();
  const { user, session } = useAuth();

  // Zera os dados virais do perfil anterior (contexto vive no layout e sobrevive à troca de @)
  const clearViralData = () => {
    setVideos([]);
    setVideosViral([]);
    setAiAnalysis(null);
    setFrequency(null); // limpa o diagnóstico p/ não vazar pro próximo @
  };

  // LinkedProfile (banco) → UserProfile (formato da tela). painPoints/desires não
  // são persistidos no banco; o Dashboard usa sobretudo instagram + niche.
  const fromLinked = (l: LinkedProfile): UserProfile => ({
    name: l.name || l.instagram,
    instagram: l.instagram,
    niche: l.nicho || 'Detectando via IA...',
    painPoints: '',
    desires: '',
    followers: l.followers ?? undefined,
    profilePic: l.profilePic ?? undefined,
  });

  // Grava o perfil no estado + localStorage e, se logado, VINCULA no banco
  // (fonte da verdade cross-device). `link:false` quando o perfil VEIO do banco
  // (não reprocessa o que já está salvo). `token` explícito cobre a corrida logo
  // após o login, quando o `session` do closure ainda pode estar desatualizado.
  const commitProfile = (
    profile: UserProfile,
    opts: { link?: boolean; token?: string } = {}
  ) => {
    const { link = true, token = session?.access_token } = opts;
    setUserProfile(profile);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch {}
    if (link && token && profile.instagram) {
      linkProfile(profile.instagram, token).catch((e) =>
        console.warn('[link-profile] falhou (segue com localStorage):', e?.message)
      );
    }
  };

  // Ao abrir: 1) ?u=usuario (atalho dev) 2) sessão salva (sobrevive a reload/F5)
  // + hotkey Ctrl+Shift+A pra admin dashboard (localhost only)
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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') {
        e.preventDefault();
        setShowAdmin(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Persiste SEMPRE que o perfil muda (qualquer origem: ?u=, wizard ou restauração)
  useEffect(() => {
    if (userProfile) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(userProfile)); } catch {}
    }
  }, [userProfile]);

  // Ao logar: recupera o @ vinculado no banco (cross-device — funciona em outro
  // celular/navegador). Só aplica se ainda não houver perfil local; o localStorage
  // tem precedência como cache pra não sobrescrever uma ação recente.
  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    let cancel = false;
    (async () => {
      try {
        const linked = await getUserProfile(token);
        if (cancel || !linked) return;
        setUserProfile((prev) => {
          if (prev) return prev; // já tem perfil (localStorage/ação) → não sobrescreve
          const p = fromLinked(linked);
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
          return p;
        });
      } catch (e) {
        console.warn('[getUserProfile] falhou:', (e as Error)?.message);
      }
    })();
    return () => { cancel = true; };
  }, [session?.access_token]);

  // CTA "Analisar meu perfil grátis" na landing: exige login antes do wizard
  const handleGoToWizard = () => {
    if (user) {
      setStarted(true);
    } else {
      setAuthTab('entrar');
      setShowAuth(true);
    }
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

  const handleAuthenticated = async () => {
    setShowAuth(false);
    setShowOffer(false);
    // Token fresco do Supabase: o `session` do closure pode não ter atualizado
    // ainda logo após o signIn.
    const token = (await supabase.auth.getSession()).data.session?.access_token;

    if (pendingProfile) {
      commitProfile(pendingProfile, { token }); // vincula o @ preenchido no wizard
      setPendingProfile(null);
      return;
    }

    // Usuário existente logando: recupera o @ já vinculado antes de cair no wizard.
    if (token) {
      try {
        const linked = await getUserProfile(token);
        if (linked) { commitProfile(fromLinked(linked), { link: false }); return; }
      } catch {}
    }
    setStarted(true);
  };

  const handleWizardComplete = (profile: UserProfile) => {
    // NÃO limpamos os dados virais aqui: o wizard já pré-carregou os vídeos no
    // contexto (em background, desde o 1º passo). Limpar agora apagaria tudo e
    // forçaria nova busca no dashboard. O dashboard reaproveita o que já está pronto.
    if (user) {
      commitProfile(profile); // vincula o @ à conta no banco
    } else {
      // guarda o perfil preenchido e vai para tela de autenticação
      setPendingProfile(profile);
      setAuthTab('registrar');
      setShowAuth(true);
    }
  };

  const handleExitProfile = () => {
    // Limpa tudo e volta para o COMEÇO REAL (landing page).
    // Usamos navegação dura para '/' (sem ?u=) porque é à prova de falhas:
    // zera todo o estado, lê o localStorage já vazio e renderiza a LandingPage.
    clearViralData();
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    window.location.href = '/';
  };

  return (
    <main className="min-h-screen">
      {showAdmin && (
        <AdminDashboard onClose={() => setShowAdmin(false)} />
      )}

      {userProfile ? (
        <Dashboard
          profile={userProfile}
          onExitProfile={handleExitProfile}
          onSwitchProfile={(newProfile) => {
            commitProfile(newProfile); // troca o @ e revincula no banco
          }}
        />
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
