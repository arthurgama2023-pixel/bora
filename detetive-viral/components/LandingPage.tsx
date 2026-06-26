'use client';

import { Sparkles, Search, Target, FileText } from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
}

export default function LandingPage({ onStart }: LandingPageProps) {
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
