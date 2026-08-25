'use client';

import { useState } from 'react';
import { ArrowLeft, Check, ShieldCheck, Zap, TrendingUp } from 'lucide-react';

interface OfferScreenProps {
  onStart: () => void;
  onBack: () => void;
}

interface Plano {
  nome: string;
  anual: number;
  mensal: number;
  destaque: boolean;
  oferta?: string;
  desc: string;
  beneficios: string[];
}

const PLANOS: Plano[] = [
  {
    nome: 'Básico',
    anual: 47,
    mensal: 67,
    destaque: false,
    desc: 'Pra criar conteúdo do seu nicho com consistência',
    beneficios: ['5 buscas virais por mês', '50 roteiros com IA / mês', '3 perfis monitorados', 'Filtro 100% Brasil'],
  },
  {
    nome: 'Pro',
    anual: 97,
    mensal: 137,
    destaque: true,
    desc: 'Pra quem vive de conteúdo e quer escalar',
    beneficios: ['12 buscas virais por mês', '150 roteiros com IA / mês', '10 perfis monitorados', 'Ranking por velocidade (trends nascendo)', 'Suporte prioritário'],
  },
  {
    nome: 'Agência',
    anual: 197,
    mensal: 277,
    destaque: false,
    desc: 'Pra gerenciar vários perfis e clientes',
    beneficios: ['25 buscas virais por mês', '400 roteiros com IA / mês', 'Perfis ilimitados', 'Tudo do Pro', 'Multi-clientes'],
  },
];

export default function OfferScreen({ onStart, onBack }: OfferScreenProps) {
  const [anual, setAnual] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-8"
        >
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            <Zap size={15} /> Oferta de lançamento: 30% OFF no plano anual
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Escolha seu plano</h2>

          {/* Toggle anual / mensal */}
          <div className="inline-flex items-center gap-1 bg-slate-100 rounded-full p-1 mt-6">
            <button onClick={() => setAnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${anual ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
              Anual <span className="text-green-600">−30%</span>
            </button>
            <button onClick={() => setAnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${!anual ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
              Mensal
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-start">
          {PLANOS.map((p) => (
            <div key={p.nome}
              className={`rounded-2xl p-6 border-2 transition-all ${p.destaque ? 'border-purple-500 shadow-xl shadow-purple-100 md:-translate-y-2 bg-white' : 'border-slate-200 bg-white'}`}>
              {p.destaque && (
                <div className="inline-flex items-center gap-1 bg-gradient-to-r from-pink-500 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold mb-3">
                  <TrendingUp size={12} /> MAIS POPULAR
                </div>
              )}
              {p.oferta && (
                <div className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold mb-3">
                  <Zap size={12} /> {p.oferta}
                </div>
              )}
              <h3 className="text-xl font-bold text-slate-900">{p.nome}</h3>
              <p className="text-sm text-slate-500 mt-1 min-h-[40px]">{p.desc}</p>

              <div className="mt-4">
                {anual ? (
                  <>
                    <p className="text-sm text-slate-500">12x de</p>
                    <p className="text-4xl font-extrabold text-slate-900">R${p.anual}<span className="text-base font-medium text-slate-400">/mês</span></p>
                    <p className="text-xs text-slate-400 mt-1">no plano anual • ou R${p.mensal}/mês no mensal</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-500">Plano mensal</p>
                    <p className="text-4xl font-extrabold text-slate-900">R${p.mensal}<span className="text-base font-medium text-slate-400">/mês</span></p>
                    <p className="text-xs text-green-600 mt-1">Economize R${(p.mensal - p.anual) * 12}/ano no anual</p>
                  </>
                )}
              </div>

              <ul className="mt-5 space-y-2">
                {p.beneficios.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check size={16} className="text-green-500 flex-shrink-0 mt-0.5" /> {b}
                  </li>
                ))}
              </ul>

              <button onClick={onStart}
                className={`w-full mt-6 py-3 rounded-xl font-bold transition-all ${p.destaque ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700' : 'border-2 border-slate-300 text-slate-900 hover:bg-slate-50'}`}>
                Começar agora
              </button>
            </div>
          ))}
        </div>

        {/* Garantia */}
        <div className="flex items-center justify-center gap-2 mt-8 text-slate-600">
          <ShieldCheck size={18} className="text-green-600" />
          <span className="text-sm font-medium">7 dias de garantia — não gostou, devolvemos 100% do valor.</span>
        </div>
      </div>
    </div>
  );
}
