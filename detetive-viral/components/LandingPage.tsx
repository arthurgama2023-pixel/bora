'use client';

import { useState } from 'react';
import { Sparkles, Search, Target, FileText, Check, ShieldCheck, Zap, TrendingUp } from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
}

const PLANOS = [
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

export default function LandingPage({ onStart }: LandingPageProps) {
  const [anual, setAnual] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* HERO */}
      <section className="max-w-5xl mx-auto px-4 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
          <Sparkles size={15} /> Análise com Inteligência Artificial
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 leading-tight">
          🎬 Radar de Tendências
        </h1>
        <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mt-4 leading-tight">
          Descubra o que está <span className="bg-gradient-to-r from-pink-500 to-orange-500 bg-clip-text text-transparent">viralizando</span> no seu nicho
        </h2>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto mt-5">
          Conecte seu Instagram, a IA identifica seu nicho e te entrega os reels que estão bombando — com o <strong>roteiro pronto</strong> pra você gravar.
        </p>
        <button
          onClick={onStart}
          className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white text-lg font-bold hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-200"
        >
          <Search size={20} /> Analisar meu perfil grátis
        </button>
        <p className="text-sm text-slate-500 mt-3">Sem cartão • Primeira análise por nossa conta</p>
      </section>

      {/* COMO FUNCIONA */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: <Search className="text-blue-600" />, t: '1. Conecte seu @', d: 'A IA lê sua bio e seus posts e identifica seu nicho real — não genérico.' },
            { icon: <Target className="text-pink-600" />, t: '2. Descubra os virais', d: 'Os reels do seu nicho que estão explodindo agora, filtrados e ranqueados.' },
            { icon: <FileText className="text-purple-600" />, t: '3. Gere o roteiro', d: 'Transcrição + roteiro adaptado ao seu público, pronto pra gravar.' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4">{s.icon}</div>
              <h3 className="font-bold text-slate-900 text-lg">{s.t}</h3>
              <p className="text-slate-600 text-sm mt-2">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* OFERTA / PREÇOS */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            <Zap size={15} /> Oferta de lançamento: 30% OFF no plano anual
          </div>
          <h2 className="text-3xl font-bold text-slate-900">Escolha seu plano</h2>

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
      </section>

      {/* CTA FINAL */}
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold text-slate-900">Pronto pra descobrir o que viraliza no seu nicho?</h2>
        <p className="text-slate-600 mt-3">Comece com uma análise gratuita do seu perfil. Leva menos de 2 minutos.</p>
        <button onClick={onStart}
          className="mt-7 inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-pink-500 to-orange-500 text-white text-lg font-bold hover:from-pink-600 hover:to-orange-600 transition-all shadow-lg">
          <Search size={20} /> Analisar meu perfil grátis
        </button>
      </section>
    </div>
  );
}
