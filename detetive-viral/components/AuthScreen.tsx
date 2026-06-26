'use client';

import { useState } from 'react';
import { Mail, Lock, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface AuthScreenProps {
  onAuthenticated: () => void;
}

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [aba, setAba] = useState<'entrar' | 'registrar'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const { error } = aba === 'entrar' ? await signIn(email, password) : await signUp(email, password);

    setLoading(false);

    if (error) {
      setError(error);
      return;
    }

    if (aba === 'registrar') {
      setInfo('Conta criada! Verifique seu e-mail para confirmar antes de entrar.');
      return;
    }

    onAuthenticated();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Sparkles size={15} /> Radar de Tendências
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {aba === 'entrar' ? 'Entre na sua conta' : 'Crie sua conta grátis'}
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900"
                />
              </div>
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
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            {info && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{info}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-200 disabled:opacity-60"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {aba === 'entrar' ? 'Entrar' : 'Criar conta grátis'}
            </button>

            <p className="text-center text-sm text-slate-400">
              {aba === 'entrar' ? (
                <>
                  Não tem conta?{' '}
                  <button
                    type="button"
                    onClick={() => { setAba('registrar'); setError(null); setInfo(null); }}
                    className="text-slate-500 hover:text-blue-600 underline"
                  >
                    Registrar
                  </button>
                </>
              ) : (
                <>
                  Já tem conta?{' '}
                  <button
                    type="button"
                    onClick={() => { setAba('entrar'); setError(null); setInfo(null); }}
                    className="text-slate-500 hover:text-blue-600 underline"
                  >
                    Entrar
                  </button>
                </>
              )}
            </p>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-4">Sem cartão • Primeira análise por nossa conta</p>
      </div>
    </div>
  );
}
