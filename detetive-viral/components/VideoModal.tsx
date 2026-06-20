'use client';

import { X } from 'lucide-react';

interface VideoModalProps {
  videoUrl: string;
  title: string;
  creator: string;
  onClose: () => void;
}

export default function VideoModal({
  videoUrl,
  title,
  creator,
  onClose,
}: VideoModalProps) {
  return (
    <>
      {/* Overlay escuro semitransparente */}
      <div
        className="absolute inset-0 bg-black/50 z-10"
        onClick={onClose}
      />

      {/* Video player - fica no card */}
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl overflow-hidden bg-black">
        {/* Video */}
        <video
          src={videoUrl}
          controls
          autoPlay
          muted
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 bg-white/20 hover:bg-white/40 rounded-full p-1.5 transition-colors z-30"
        >
          <X size={20} className="text-white" />
        </button>
      </div>
    </>
  );
}
