'use client';

import { useState } from 'react';
import { User, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { proxiedImage } from '@/lib/api';

interface UserMenuProps {
  profileName: string;
  profile?: {
    name: string;
    instagram: string;
    niche: string;
    bio?: string;
    followers?: number;
    profilePic?: string | null;
    verified?: boolean;
  };
  onProfileClick?: () => void;
}

export default function UserMenu({ profileName, profile, onProfileClick }: UserMenuProps) {
  const avatarUrl = proxiedImage(profile?.profilePic);
  const [isOpen, setIsOpen] = useState(false);
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-[#434655] hover:bg-[#e0e3e5] transition-all"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0037b0] to-[#890051] overflow-hidden flex-shrink-0">
          {avatarUrl && (
            <img src={avatarUrl} alt={profileName} className="w-full h-full object-cover" />
          )}
        </div>
        <span className="hidden sm:inline text-xs font-semibold">Perfil</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-[#c4c5d7] overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-[#c4c5d7] bg-[#f5f7fb]">
            <p className="text-xs text-[#434655]">Conectado como</p>
            <p className="text-sm font-bold text-[#191c1e] truncate">{profileName}</p>
          </div>

          <button
            onClick={() => {
              onProfileClick?.();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-[#434655] hover:bg-[#f5f7fb] transition-colors text-sm"
          >
            <User size={16} />
            Ver Perfil
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors text-sm border-t border-[#c4c5d7]"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
