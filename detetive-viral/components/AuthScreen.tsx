'use client';

import { useState } from 'react';
import { Mail, Lock, Loader2, Sparkles, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface AuthScreenProps {
  onAuthenticated: () => void;
  defaultTab?: 'entrar' | 'registrar';
}

const isValidEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export default function AuthScreen({ onAuthenticated, defaultTab = 'entrar' }: AuthScreenProps) {
  const [aba, setAba] = useState<'entrar' | 'registrar'>(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const emailValid = email.length > 0 && isValidEmail(email);
  const passwordValid = password.length >= 6;
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const formValid = aba === 'entrar'
    ? (emailValid && passwordValid)
    : (emailValid && passwordValid && passwordsMatch);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid) return;

    setError(null);
    setInfo(null);
    setLoading(true);

    const { error } = aba === 'entrar' ? await signIn(email, password) : await signUp(email, password);

    setLoading(false);

    if (error) {
      setError(error);
      return;
    }

    // Tanto login quanto registro agora funcionam — o auto-login foi adicionado ao signUp
    onAuthenticated();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Sparkles size={15} /> Radar de Tendências
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            {aba === 'entrar' ? 'Bem-vindo de volta' : 'Comece grátis agora'}
          </h1>
          <p className="text-slate-500 text-sm">
            {aba === 'entrar'
              ? 'Acesse sua conta para continuar'
              : 'Crie sua conta em segundos'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden">
          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  className={`w-full pl-10 pr-10 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent text-slate-900 transition-all ${
                    email.length === 0
                      ? 'border-slate-300 focus:ring-blue-500'
                      : emailValid
                      ? 'border-green-300 focus:ring-green-500'
                      : 'border-red-300 focus:ring-red-500'
                  }`}
                />
                {email.length > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {emailValid ? (
                      <Check size={18} className="text-green-500" />
                    ) : (
                      <AlertCircle size={18} className="text-red-500" />
                    )}
                  </div>
                )}
              </div>
              {email.length > 0 && !emailValid && (
                <p className="text-xs text-red-600 mt-1">Digite um e-mail válido</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-10 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent text-slate-900 transition-all ${
                    password.length === 0
                      ? 'border-slate-300 focus:ring-blue-500'
                      : passwordValid
                      ? 'border-green-300 focus:ring-green-500'
                      : 'border-red-300 focus:ring-red-500'
                  }`}
                />
                {password.length > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {passwordValid ? (
                      <Check size={18} className="text-green-500" />
                    ) : (
                      <AlertCircle size={18} className="text-red-500" />
                    )}
                  </div>
                )}
              </div>
              {password.length > 0 && !passwordValid && (
                <p className="text-xs text-red-600 mt-1">Mínimo 6 caracteres</p>
              )}
            </div>

            {aba === 'registrar' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Senha</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required={aba === 'registrar'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full pl-10 pr-10 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent text-slate-900 transition-all ${
                      confirmPassword.length === 0
                        ? 'border-slate-300 focus:ring-blue-500'
                        : passwordsMatch
                        ? 'border-green-300 focus:ring-green-500'
                        : 'border-red-300 focus:ring-red-500'
                    }`}
                  />
                  {confirmPassword.length > 0 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {passwordsMatch ? (
                        <Check size={18} className="text-green-500" />
                      ) : (
                        <AlertCircle size={18} className="text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-red-600 mt-1">As senhas não coincidem</p>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            {info && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{info}</p>}

            <button
              type="submit"
              disabled={loading || !formValid}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold text-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {aba === 'entrar' ? 'Entrar na conta' : 'Começar análise grátis'}
            </button>

            <div className="relative h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-6" />

            <p className="text-center text-sm text-slate-600">
              {aba === 'entrar' ? (
                <>
                  Novo por aqui?{' '}
                  <button
                    type="button"
                    onClick={() => { setAba('registrar'); setError(null); setInfo(null); setConfirmPassword(''); }}
                    className="text-blue-600 hover:text-blue-700 font-semibold underline"
                  >
                    Criar conta
                  </button>
                </>
              ) : (
                <>
                  Já tem conta?{' '}
                  <button
                    type="button"
                    onClick={() => { setAba('entrar'); setError(null); setInfo(null); setConfirmPassword(''); }}
                    className="text-blue-600 hover:text-blue-700 font-semibold underline"
                  >
                    Fazer login
                  </button>
                </>
              )}
            </p>
          </form>
        </div>

        <div className="text-center mt-8 space-y-2">
          <p className="text-sm text-slate-500">
            ✓ Sem cartão • ✓ Teste completo • ✓ Cancelar a qualquer momento
          </p>
          <p className="text-xs text-slate-400">
            Dados protegidos pelo Supabase
          </p>
        </div>
      </div>
    </div>
  );
}
