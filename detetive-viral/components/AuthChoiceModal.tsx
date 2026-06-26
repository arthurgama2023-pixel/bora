'use client';

import { Sparkles, Lock } from 'lucide-react';

interface AuthChoiceModalProps {
  onCreateAccount: () => void;
  onLogin: () => void;
}

export default function AuthChoiceModal({ onCreateAccount, onLogin }: AuthChoiceModalProps) {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black/30 to-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md">
        {/* Card Principal */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
          {/* Header Minimalista */}
          <div className="px-8 pt-10 pb-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 mb-4">
              <Sparkles size={24} className="text-purple-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Descobra tendências</h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              Analise reels virais do seu nicho com IA em segundos
            </p>
          </div>

          {/* Divisor */}
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

          {/* Opções */}
          <div className="p-8 space-y-4">
            {/* Criar Conta */}
            <button
              onClick={onCreateAccount}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-purple-200"
            >
              <Sparkles size={20} className="group-hover:scale-110 transition-transform" />
              <span>Começar grátis</span>
            </button>

            {/* Fazer Login */}
            <button
              onClick={onLogin}
              className="w-full rounded-2xl px-6 py-4 flex items-center justify-center gap-3 bg-gradient-to-r from-slate-100 to-slate-50 hover:from-slate-200 hover:to-slate-100 transition-all duration-300 border border-slate-200 hover:border-slate-300"
            >
              <Lock size={20} className="text-slate-600" />
              <span className="font-semibold text-slate-700">Já tenho conta</span>
            </button>
          </div>

          {/* Footer */}
          <div className="px-8 pb-6 text-center">
            <p className="text-xs text-slate-400">✓ Sem cartão • ✓ Teste completo</p>
          </div>
        </div>

        {/* Nota de Segurança */}
        <p className="text-center text-xs text-slate-500 mt-4">
          Seus dados são protegidos pelo Supabase
        </p>
      </div>
    </div>
  );
}
