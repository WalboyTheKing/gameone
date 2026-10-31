import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Users, 
  Key, 
  RefreshCw, 
  Trophy, 
  Rocket, 
  ArrowRight,
  Sparkles,
  Gamepad2,
  Share2,
  Check,
  Zap
} from 'lucide-react';
import { socket } from '../../utils/socket';
import { UserProfile } from '../../utils/userProfile';
import { sounds } from '../../utils/audio';

export interface RoomSummary {
  id: string;
  name: string;
  gameType: 'pong' | 'hockey';
  playerCount: number;
  status: 'waiting' | 'countdown' | 'playing' | 'gameover';
  score1: number;
  score2: number;
  player1: string;
  player2: string;
}

interface LobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  initialGameType?: 'pong' | 'hockey';
  onRoomJoined: (roomData: any, role: string) => void;
}

export const LobbyModal: React.FC<LobbyModalProps> = ({
  isOpen,
  onClose,
  profile,
  initialGameType = 'hockey',
  onRoomJoined,
}) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'create'>('browse');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [gameType, setGameType] = useState<'pong' | 'hockey'>(initialGameType);
  const [roomName, setRoomName] = useState(`${profile.username}'s Arena`);
  const [maxScore, setMaxScore] = useState<number>(5);
  const [joinCode, setJoinCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (initialGameType) {
      setGameType(initialGameType);
    }
  }, [initialGameType]);

  useEffect(() => {
    if (!isOpen) return;

    socket.connect();
    socket.send({ type: 'list_rooms' });

    const unsubRooms = socket.on('rooms_list', (data) => {
      setRooms(data.rooms || []);
      setIsRefreshing(false);
    });

    const unsubJoined = socket.on('room_joined', (data) => {
      sounds.playPowerUp();
      onRoomJoined(data.room, data.role);
      onClose();
    });

    const unsubReconnected = socket.on('room_reconnected', (data) => {
      sounds.playPowerUp();
      onRoomJoined(data.room, data.role);
      onClose();
    });

    const unsubError = socket.on('error', (data) => {
      setErrorMsg(data.message || 'Une erreur est survenue.');
    });

    return () => {
      unsubRooms();
      unsubJoined();
      unsubReconnected();
      unsubError();
    };
  }, [isOpen, onRoomJoined, onClose]);

  if (!isOpen) return null;

  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);

  const handleRefresh = () => {
    setIsRefreshing(true);
    socket.send({ type: 'list_rooms' });
  };

  const copyLinkForRoom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}${window.location.pathname}?join=${id}`;
      navigator.clipboard.writeText(url);
      setCopiedRoomId(id);
      setTimeout(() => setCopiedRoomId(null), 2500);
    }
  };

  const handleQuickMatch = () => {
    setErrorMsg('');
    const available = rooms.find(r => r.status === 'waiting' && r.playerCount === 1);
    if (available) {
      handleJoinById(available.id);
    } else {
      sounds.playPowerUp();
      socket.send({
        type: 'create_room',
        gameType: initialGameType || 'hockey',
        name: `Arène Rapide de ${profile.username}`,
        maxScore: 5,
        username: profile.username,
        avatar: profile.avatar,
        playerKey: profile.id,
      });
    }
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playCoin();
    socket.send({
      type: 'create_room',
      gameType,
      name: roomName.trim() || 'Arène Cyber',
      maxScore,
      username: profile.username,
      avatar: profile.avatar,
      playerKey: profile.id,
    });
  };

  const handleJoinById = (roomId: string) => {
    setErrorMsg('');
    sounds.playLaser();
    socket.send({
      type: 'join_room',
      roomId: roomId.toUpperCase().trim(),
      username: profile.username,
      avatar: profile.avatar,
      playerKey: profile.id,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold font-arcade text-white flex items-center gap-2">
                SALONS MULTIJOUEURS <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">EN DIRECT</span>
              </h3>
              <p className="text-xs text-slate-400">
                Joueur connecté: <span className="text-white font-semibold">{profile.avatar} {profile.username}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-2 gap-2">
          <button
            onClick={() => setActiveTab('browse')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold font-arcade text-xs sm:text-sm transition ${
              activeTab === 'browse'
                ? 'bg-slate-800 text-cyan-400 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" /> Salons Disponibles ({rooms.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold font-arcade text-xs sm:text-sm transition ${
              activeTab === 'create'
                ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-4 h-4" /> Créer un Salon
          </button>
        </div>

        {errorMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs text-center font-medium">
            {errorMsg}
          </div>
        )}

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto">
          {activeTab === 'browse' ? (
            <div className="space-y-5">
              {/* Join with direct Room Code */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
                <Key className="w-5 h-5 text-amber-400 shrink-0 ml-1" />
                <input
                  type="text"
                  placeholder="Entrer le Code du Salon (ex: AIR-123)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-transparent text-sm font-arcade uppercase text-white placeholder-slate-500 outline-none"
                />
                <button
                  onClick={() => handleJoinById(joinCode)}
                  disabled={!joinCode.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold font-arcade transition"
                >
                  Rejoindre
                </button>
              </div>

              {/* Quick Match Bar */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-cyan-950/60 via-indigo-950/60 to-slate-950 border border-cyan-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold font-arcade text-white block">Matchmaking Rapide</span>
                    <span className="text-[11px] text-slate-400">Rejoint un rival en attente ou crée un salon public</span>
                  </div>
                </div>

                <button
                  onClick={handleQuickMatch}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 text-white text-xs font-bold font-arcade shadow-lg transition active:scale-95"
                >
                  Trouver un Match
                </button>
              </div>

              {/* Header with Refresh */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                  Salons Publics Ouverts
                </span>
                <button
                  onClick={handleRefresh}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} /> Actualiser
                </button>
              </div>

              {/* Rooms List */}
              {rooms.length === 0 ? (
                <div className="text-center py-12 space-y-3 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
                  <Gamepad2 className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-sm text-slate-400">Aucun salon public ouvert actuellement.</p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold font-arcade transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Créer le premier salon
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {rooms.map((r) => {
                    const isFull = r.playerCount >= 2;
                    return (
                      <div
                        key={r.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/90 hover:border-slate-700 transition gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">
                            {r.gameType === 'hockey' ? '🏒' : '🏓'}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold font-arcade text-white">{r.name}</h4>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                #{r.id}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Hôte: <span className="text-slate-200">{r.player1}</span> &bull; {r.gameType === 'hockey' ? 'Air Hockey' : 'Cyber Pong'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                          <span
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                              isFull
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {r.playerCount}/2 Joueurs {isFull ? '(En jeu)' : '(Prêt)'}
                          </span>

                          <button
                            onClick={(e) => copyLinkForRoom(r.id, e)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                            title="Copier le lien direct du salon"
                          >
                            {copiedRoomId === r.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => handleJoinById(r.id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold font-arcade text-xs shadow transition active:scale-95"
                          >
                            Rejoindre <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* CREATE ROOM FORM */
            <form onSubmit={handleCreateRoom} className="space-y-5">
              {/* Choose Game */}
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                  1. Choisissez le Jeu Multijoueur
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setGameType('hockey')}
                    className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                      gameType === 'hockey'
                        ? 'bg-cyan-950/40 border-cyan-400 shadow-lg shadow-cyan-500/20'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-3xl">🏒</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        RECOMMANDÉ
                      </span>
                    </div>
                    <div className="mt-3">
                      <h4 className="text-sm font-bold font-arcade text-white">Neon Air Hockey</h4>
                      <p className="text-[11px] text-slate-400 mt-1">Palets rapides, rebonds sur rails et compétition intense.</p>
                    </div>
                  </div>

                  <div
                    onClick={() => setGameType('pong')}
                    className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                      gameType === 'pong'
                        ? 'bg-indigo-950/40 border-indigo-400 shadow-lg shadow-indigo-500/20'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-3xl">🏓</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        CLASSIQUE
                      </span>
                    </div>
                    <div className="mt-3">
                      <h4 className="text-sm font-bold font-arcade text-white">Cyber Pong</h4>
                      <p className="text-[11px] text-slate-400 mt-1">Deux raquettes, synchronisation de balle et duels d'angles.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Room Name */}
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                  2. Nom du Salon
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  maxLength={25}
                  placeholder="Ex: Arène des Maîtres"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 text-white font-arcade text-sm outline-none transition"
                />
              </div>

              {/* Score Target */}
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                  3. Score pour Gagner le Match
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[3, 5, 10].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setMaxScore(score)}
                      className={`py-2.5 rounded-xl font-bold font-arcade text-xs border transition ${
                        maxScore === score
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {score} Points {score === 5 && '(Standard)'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 text-white font-bold font-arcade text-sm shadow-xl shadow-cyan-500/20 transition transform active:scale-95"
                >
                  🚀 CRÉER ET OUVRIR LE SALON
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
