'use client';

import { useRef, useState, useEffect } from 'react';
import { Play } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string;
  title: string;
  creator: string;
  onEnded?: () => void;
}

export default function VideoPlayer({
  videoUrl,
  title,
  creator,
  onEnded
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (video.paused) {
        video.play().catch(err => console.log('Play error:', err));
      } else {
        video.pause();
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('click', handleClick);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('click', handleClick);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        src={videoUrl}
        autoPlay
        muted={false}
        loop={false}
        onEnded={onEnded}
        playsInline
        className="w-full h-full object-cover cursor-pointer"
        crossOrigin="anonymous"
        style={{ display: 'block' }}
      />

      {/* Overlay com ícone quando pausado */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
          <div className="bg-white/30 rounded-full p-6">
            <Play size={48} className="text-white fill-white" />
          </div>
        </div>
      )}
    </div>
  );
}
