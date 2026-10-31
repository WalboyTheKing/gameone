import React, { useState } from 'react';
import { X, Check, User, Sparkles, Trophy, Target } from 'lucide-react';
import { UserProfile, DEFAULT_AVATARS, saveUserProfile } from '../../utils/userProfile';
import { sounds } from '../../utils/audio';

interface ProfileModalProps {
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: UserProfile) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  profile,
  isOpen,
  onClose,
  onSave,
}) => {
  const [username, setUsername] = useState(profile.username);
  const [avatar, setAvatar] = useState(profile.avatar);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = username.trim() || profile.username;
    const updated: UserProfile = {
      ...profile,
      username: cleanName,
      avatar,
      hasChosenNickname: true,
    };
    saveUserProfile(updated);
    sounds.playCoin();
    onSave(updated);
    onClose();
  };

  const winRate = profile.stats.matchesPlayed > 0
    ? Math.round((profile.stats.wins / profile.stats.matchesPlayed) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold font-arcade text-white">PROFIL JOUEUR</h3>
              <p className="text-xs text-slate-400">Identité en ligne pour les matchs multijoueurs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Preview */}
        <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-center">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Matchs</span>
            <span className="text-base font-bold font-arcade text-cyan-400">{profile.stats.matchesPlayed}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Victoires</span>
            <span className="text-base font-bold font-arcade text-emerald-400">{profile.stats.wins}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Taux Vict.</span>
            <span className="text-base font-bold font-arcade text-amber-400">{winRate}%</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
              Pseudo (Nom d'affichage)
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={18}
                placeholder="Entrez votre pseudo..."
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white font-arcade text-base placeholder-slate-500 outline-none transition"
              />
              <span className="absolute right-3 top-3.5 text-xs text-slate-500 font-mono">
                {username.length}/18
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
              Choisissez votre Avatar Cyber
            </label>
            <div className="grid grid-cols-5 gap-2.5">
              {DEFAULT_AVATARS.map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => setAvatar(av)}
                  className={`h-12 flex items-center justify-center text-2xl rounded-xl border transition transform active:scale-95 ${
                    avatar === av
                      ? 'bg-indigo-600/30 border-indigo-400 shadow-md shadow-indigo-500/30 scale-105'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold font-arcade text-sm transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-bold font-arcade text-sm shadow-lg shadow-indigo-500/25 transition transform active:scale-95"
            >
              <Check className="w-4 h-4" /> Sauvegarder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
