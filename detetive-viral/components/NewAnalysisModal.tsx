'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface NewAnalysisModalProps {
  onClose: () => void;
  onAnalyze: (instagram: string) => void;
}

export default function NewAnalysisModal({ onClose, onAnalyze }: NewAnalysisModalProps) {
  const [instagram, setInstagram] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    const handle = instagram.trim().replace(/^@/, '');
    if (!handle) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('http://localhost:3003/api/instagram/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: handle }),
      });

      if (!res.ok) throw new Error('Perfil não encontrado');

      onAnalyze(handle);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao validar perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
      <div className="bg-white w-full md:max-w-sm md:rounded-2xl rounded-t-3xl md:shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-black">Analisar perfil</h2>
          <button
            onClick={onClose}
            className="p-1 hover:opacity-60 transition-opacity"
          >
            <X size={24} className="text-black" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 md:px-6 py-6 space-y-5">
          <p className="text-sm text-gray-500">
            Digite o @ de um perfil Instagram para analisar as tendências do nicho
          </p>

          {/* Input */}
          <div className="space-y-1">
            <input
              type="text"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              placeholder="username"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-0 focus:bg-white focus:border-black text-sm text-black placeholder-gray-400 transition-colors"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 font-semibold text-black rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAnalyze}
              disabled={loading || !instagram.trim()}
              className="flex-1 py-3 px-4 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Buscando...' : 'Analisar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
