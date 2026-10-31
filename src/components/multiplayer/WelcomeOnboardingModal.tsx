import React, { useState } from 'react';
import { Gamepad2, Sparkles, Dices, ArrowRight, ShieldCheck, Zap, Trophy } from 'lucide-react';
import { UserProfile, DEFAULT_AVATARS, saveUserProfile, getRandomStarterName } from '../../utils/userProfile';
import { sounds } from '../../utils/audio';

interface WelcomeOnboardingModalProps {
  isOpen: boolean;
  currentProfile: UserProfile;
  invitationRoomCode?: string | null;
  onComplete: (profile: UserProfile) => void;
}

export const WelcomeOnboardingModal: React.FC<WelcomeOnboardingModalProps> = ({
  isOpen,
  currentProfile,
  invitationRoomCode,
  onComplete,
}) => {
  const [username, setUsername] = useState(currentProfile.username || getRandomStarterName());
  const [avatar, setAvatar] = useState(currentProfile.avatar || '⚡');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRollRandom = () => {
    sounds.playJump();
    setUsername(getRandomStarterName());
    setError(null);
  };

  const handleSelectAvatar = (av: string) => {
    sounds.playJump();
    setAvatar(av);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = username.trim();
    if (!cleanName) {
      setError('Veuillez entrer un pseudo');
      return;
    }
    if (cleanName.length < 2) {
      setError('Le pseudo doit contenir au moins 2 caractères');
      return;
    }

    const updatedProfile: UserProfile = {
      ...currentProfile,
      username: cleanName,
      avatar,
      hasChosenNickname: true,
    };

    saveUserProfile(updatedProfile);
    sounds.playCoin();
    onComplete(updatedProfile);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-fuchsia-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900/95 border-2 border-cyan-500/40 p-6 sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.25)] space-y-6 overflow-hidden">
        {/* Neon top banner accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 animate-pulse" />

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
            Protocole d'Entrée Arcade
          </div>

          <h2 className="text-2xl sm:text-3xl font-black font-arcade tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-pink-400 to-amber-300">
            BIENVENUE DANS NEON ARCADE
          </h2>

          {invitationRoomCode ? (
            <div className="p-2.5 rounded-xl bg-fuchsia-950/50 border border-fuchsia-500/40 text-fuchsia-200 text-xs sm:text-sm font-medium">
              🎮 <span className="font-bold text-fuchsia-300">Invitation Reçue :</span> Tu rejoins le salon{' '}
              <span className="font-mono font-bold text-white bg-fuchsia-500/30 px-2 py-0.5 rounded border border-fuchsia-400">
                {invitationRoomCode}
              </span>
              . Choisis ton pseudo de duel !
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Choisis ton <span className="text-cyan-300 font-bold">Pseudo</span> et ton{' '}
              <span className="text-pink-300 font-bold">Avatar</span> pour affronter tes rivaux en multijoueur temps réel et grimper au classement.
            </p>
          )}
        </div>

        {/* Player Tag Preview Card */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-4 px-6 py-3.5 rounded-2xl bg-slate-950/80 border border-cyan-500/30 shadow-inner">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 border border-cyan-400/50 flex items-center justify-center text-3xl shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              {avatar}
            </div>
            <div className="text-left">
              <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-400 block">
                Carte de Joueur
              </span>
              <span className="text-lg sm:text-xl font-bold font-arcade text-white tracking-wide">
                {username || 'Sans Nom'}
              </span>
              <span className="text-xs text-slate-400 block font-mono">
                Statut : Prêt au combat ⚡
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Pseudo Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Gamepad2 className="w-4 h-4 text-cyan-400" />
                Ton Pseudo de Joueur
              </label>
              <button
                type="button"
                onClick={handleRollRandom}
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 transition"
                title="Générer un pseudo stylé"
              >
                <Dices className="w-3.5 h-3.5" />
                Aléatoire
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                autoFocus
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(null);
                }}
                maxLength={18}
                placeholder="Ex: Viper, Neo, Sarah, Dragon..."
                className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border-2 border-slate-700 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 text-white font-arcade text-base sm:text-lg tracking-wide placeholder-slate-600 outline-none transition"
              />
              <span className="absolute right-3.5 top-4 text-xs text-slate-500 font-mono">
                {username.length}/18
              </span>
            </div>
            {error && <p className="text-xs font-bold text-rose-400">{error}</p>}
          </div>

          {/* Avatar Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
              Choisis ton Emblème Cyber
            </label>
            <div className="grid grid-cols-5 gap-2">
              {DEFAULT_AVATARS.map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => handleSelectAvatar(av)}
                  className={`h-12 flex items-center justify-center text-2xl rounded-xl border-2 transition transform active:scale-95 ${
                    avatar === av
                      ? 'bg-cyan-500/25 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-105'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* Quick guarantees */}
          <div className="grid grid-cols-3 gap-2 py-2 text-[10px] text-slate-400 border-t border-slate-800/80">
            <div className="flex items-center gap-1 justify-center text-center">
              <Zap className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Zéro mot de passe</span>
            </div>
            <div className="flex items-center gap-1 justify-center text-center">
              <ShieldCheck className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>Multiplayer 60 FPS</span>
            </div>
            <div className="flex items-center gap-1 justify-center text-center">
              <Trophy className="w-3 h-3 text-pink-400 shrink-0" />
              <span>Score & Victoires</span>
            </div>
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 hover:from-cyan-400 hover:via-indigo-400 hover:to-fuchsia-400 text-white font-black font-arcade text-base sm:text-lg tracking-wider shadow-[0_0_30px_rgba(6,182,212,0.4)] transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer"
          >
            {invitationRoomCode ? (
              <>
                <span>REJOINDRE LE MATCH</span>
                <ArrowRight className="w-5 h-5 animate-pulse" />
              </>
            ) : (
              <>
                <span>⚡ ENTRER DANS L'ARÈNE</span>
                <ArrowRight className="w-5 h-5 animate-pulse" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
