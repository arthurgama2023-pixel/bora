'use client';

import { useState } from 'react';

interface ReelCardProps {
  reel: {
    id: string;
    creator: string;
    creatorHandle: string;
    likes: number;
    comments: number;
    shares: number;
    views: number;
    description: string;
    theme: string;
    engagementRate: number;
    viralityScore?: number;
    velocity?: number;
    ageDays?: number;
    thumbnail?: string;
    videoUrl?: string;
    postUrl?: string;
    timestamp?: string;
    publishedAt?: string;
  };
  selected: boolean;
  onClick: () => void;
  onPlayClick?: () => void;
}

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const getDaysAgo = (timestamp?: string | null) => {
  if (!timestamp) return 'Recente';
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Hoje';
    if (days === 1) return '1d';
    return `${days}d`;
  } catch {
    return 'Recente';
  }
};

export default function ReelCard({ reel, selected, onClick, onPlayClick }: ReelCardProps) {
  const [imgError, setImgError] = useState(false);

  const handleCardClick = () => {
    if (reel.postUrl) {
      window.open(reel.postUrl, '_blank');
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative aspect-[9/16] rounded-2xl overflow-hidden bg-black cursor-pointer shadow-md hover:shadow-lg transition-all hover:-translate-y-1"
    >
      {/* Imagem */}
      <img
        src={reel.thumbnail || 'https://via.placeholder.com/400x600'}
        alt={reel.description}
        onError={() => setImgError(true)}
        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
      />

      {/* Overlay gradiente */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 p-4 flex flex-col justify-between">
        {/* Top Section */}
        <div className="flex justify-between items-start">
          {/* Score de tendência */}
          <div className="bg-[#ba1a1a]/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
            <span className="material-symbols-outlined text-white text-sm">trending_up</span>
            <span className="text-white text-xs font-bold">
              {Math.round(reel.viralityScore || reel.engagementRate * 10)}/100
            </span>
          </div>

          {/* Views (discreto) */}
          <div className="flex items-center gap-1 text-white/70 text-[10px] font-medium">
            <span className="material-symbols-outlined text-[12px]">play_circle</span>
            <span>{formatNumber(reel.views)}</span>
          </div>

          {/* Métricas à direita */}
          <div className="flex flex-col gap-3 items-center">
            <div className="flex flex-col items-center gap-0">
              <div className="bg-white/10 hover:bg-white/20 backdrop-blur-md p-2 rounded-full flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                  favorite
                </span>
              </div>
              <span className="text-white text-xs font-bold mt-1 shadow-sm">{formatNumber(reel.likes)}</span>
            </div>

            <div className="flex flex-col items-center gap-0">
              <div className="bg-white/10 hover:bg-white/20 backdrop-blur-md p-2 rounded-full flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                  chat_bubble
                </span>
              </div>
              <span className="text-white text-xs font-bold mt-1 shadow-sm">{formatNumber(reel.comments)}</span>
            </div>

            <div className="flex flex-col items-center gap-0">
              <div className="bg-white/10 hover:bg-white/20 backdrop-blur-md p-2 rounded-full flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                  send
                </span>
              </div>
              <span className="text-white text-xs font-bold mt-1 shadow-sm">{formatNumber(reel.shares)}</span>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="space-y-2">
          {/* Dias desde publicação */}
          <div className="bg-orange-500 px-2 py-1 rounded-lg inline-flex items-center gap-1 shadow-lg">
            <span className="material-symbols-outlined text-white text-sm">schedule</span>
            <span className="text-white text-xs font-bold">{getDaysAgo(reel.timestamp || reel.publishedAt)}</span>
          </div>

          {/* Botão Roteiro */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="w-full bg-white/20 hover:bg-white text-white hover:text-black backdrop-blur-md py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <span className="material-symbols-outlined text-base">description</span> Roteiro
          </button>
        </div>
      </div>
    </div>
  );
}
