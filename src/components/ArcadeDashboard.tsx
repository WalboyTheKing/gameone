import React, { useState } from 'react';
import { 
  Zap, 
  Rocket, 
  Sparkles, 
  Layers, 
  Trophy, 
  Flame, 
  Coins, 
  Award,
  ChevronRight,
  History,
  Users,
  Play,
  Volume2,
  VolumeX,
  Swords,
  ShieldCheck,
  Target,
  ArrowUpRight
} from 'lucide-react';
import { GameRecord, Achievement } from '../utils/storage';
import { UserProfile } from '../utils/userProfile';
import { GlobalLeaderboardPlayer, MatchHistoryLog } from '../utils/multiplayerStats';

const AIR_HOCKEY_ART = '/src/assets/images/neon_air_hockey_art_1793470408465.jpg';
const CYBER_PONG_ART = '/src/assets/images/cyber_pong_art_1793470408184.jpg';
const CYBER_RUNNER_ART = '/src/assets/images/cyber_runner_art_1793470409104.jpg';
const SPACE_DEFENDER_ART = '/src/assets/images/space_defender_art_1793470408835.jpg';

interface ArcadeDashboardProps {
  onSelectGame: (gameId: 'runner' | 'shooter' | 'snake' | 'tile' | 'hockey' | 'pong') => void;
  onOpenMultiplayerLobby: (preferredGame?: 'hockey' | 'pong') => void;
  onQuickMatch: () => void;
  onOpenProfile: () => void;
  profile: UserProfile;
  highScores: Record<string, number>;
  history: GameRecord[];
  achievements: Achievement[];
  globalLeaderboard: GlobalLeaderboardPlayer[];
  recentMatches: MatchHistoryLog[];
  coins: number;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const ArcadeDashboard: React.FC<ArcadeDashboardProps> = ({
  onSelectGame,
  onOpenMultiplayerLobby,
  onQuickMatch,
  onOpenProfile,
  profile,
  highScores,
  history,
  achievements,
  globalLeaderboard,
  recentMatches,
  coins,
  isMuted,
  onToggleMute,
}) => {
  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState<'leaderboard' | 'matches'>('leaderboard');

  const soloGames = [
    {
      id: 'runner' as const,
      title: 'Cyber Dash',
      category: 'Endless Synthwave Runner',
      desc: 'Dash through laser pylons, dodge rogue patrol drones, and break the speed barrier.',
      icon: Zap,
      image: CYBER_RUNNER_ART,
      accent: 'text-cyan-400',
      highScore: highScores['runner'] || 0,
    },
    {
      id: 'shooter' as const,
      title: 'Galaxy Defender',
      category: 'Arcade Space Shooter',
      desc: 'Pilot your starfighter, disintegrate alien armadas, and weave through asteroid storms.',
      icon: Rocket,
      image: SPACE_DEFENDER_ART,
      accent: 'text-blue-400',
      highScore: highScores['shooter'] || 0,
    },
    {
      id: 'snake' as const,
      title: 'Neon Snake',
      category: 'Matrix Vector Grid',
      desc: 'Slither through the glowing cyber matrix, absorb gold energy orbs, and engage ghost phasing.',
      icon: Sparkles,
      image: null,
      accent: 'text-emerald-400',
      highScore: highScores['snake'] || 0,
    },
    {
      id: 'tile' as const,
      title: 'Quantum Fusion',
      category: '2048 Energy Synthesis',
      desc: 'Slide and fuse matching isotope blocks to stabilize the supreme 2048 quantum singularity.',
      icon: Layers,
      image: null,
      accent: 'text-purple-400',
      highScore: highScores['tile'] || 0,
    },
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-12 arcade-grid-bg">
      {/* Hero Showcase Section */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-10 shadow-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            {/* Clean unboxed metadata kicker */}
            <div className="flex items-center gap-2 text-xs font-medium text-cyan-400 tracking-wider uppercase">
              <span>Multiplayer Arena</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>Authoritative 60 FPS Physics</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>Instant 1-Click Duels</span>
            </div>

            <div>
              <h1 className="text-3xl sm:text-5xl font-black font-arcade text-white tracking-tight" style={{ textWrap: 'balance' }}>
                NEON ARCADE
              </h1>
              <p className="text-sm sm:text-base font-medium text-slate-300 mt-2 leading-relaxed">
                Compete head-to-head in real-time retro-futuristic duels. Create private rooms in one click, share direct invitation links, and dominate the global leaderboard.
              </p>
            </div>

            {/* Primary Action Zone */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={onQuickMatch}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-arcade text-sm transition-all duration-150 transform active:scale-95 shadow-lg shadow-cyan-500/20 whitespace-nowrap shrink-0"
              >
                <Zap className="w-4 h-4 fill-current" />
                Quick Match
              </button>
              <button
                onClick={() => onOpenMultiplayerLobby()}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold font-arcade text-sm border border-slate-700/80 transition-colors whitespace-nowrap shrink-0"
              >
                <Users className="w-4 h-4 text-cyan-400" />
                Browse Lobbies
              </button>
            </div>
          </div>

          {/* Quick Pilot Card & Controls */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
            {/* Interactive Player Profile Tile */}
            <button
              onClick={onOpenProfile}
              className="group text-left flex items-center gap-3.5 bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-4 transition-all duration-200 shadow-md"
              title="Customize nickname and avatar"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                {profile.avatar}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold font-arcade text-white group-hover:text-cyan-400 text-base transition-colors">
                    {profile.username}
                  </span>
                  <span className="text-[11px] text-cyan-400 font-mono">
                    {profile.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                  <span>Wins: <strong className="text-emerald-400 font-mono tabular-nums">{profile.stats.wins}</strong></span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span>Losses: <strong className="text-rose-400 font-mono tabular-nums">{profile.stats.losses}</strong></span>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 ml-2 transition-colors" />
            </button>

            {/* Coins & Audio Mute controls */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-2.5 shadow-md">
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-slate-400">Coins:</span>
                <span className="text-sm font-bold font-mono tabular-nums text-amber-300">{coins}</span>
              </div>

              <button
                onClick={onToggleMute}
                className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shadow-md"
                title={isMuted ? 'Unmute audio' : 'Mute audio'}
                aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>
            </div>
          </div>
        </div>

        {/* Ambient subtle lighting */}
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      </section>

      {/* MULTIPLAYER 1v1 DUEL SECTION */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 tracking-wider uppercase">
              <Swords className="w-4 h-4" />
              <span>Dedicated Server Competition</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-arcade text-white tracking-tight mt-1">
              1v1 MULTIPLAYER ARENA
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Join a private room with a friend or jump into solo practice against AI bots
            </p>
          </div>

          <button
            onClick={() => onOpenMultiplayerLobby()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold font-arcade text-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            Browse all open lobbies <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* The 2 Major Multiplayer Games with Cinematic Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Neon Air Hockey */}
          <div className="group relative overflow-hidden rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 transition-all duration-300 flex flex-col justify-between shadow-xl">
            {/* Visual Media Showcase with Scrim */}
            <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-slate-950">
              <img
                src={AIR_HOCKEY_ART}
                alt="Futuristic neon air hockey table"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-cyan-300 block">Rebound Physics &amp; Impulse Strike</span>
                  <h3 className="text-2xl font-black font-arcade text-white drop-shadow">Neon Air Hockey</h3>
                </div>
                <span className="text-xs font-mono font-bold text-slate-200 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                  First to 5
                </span>
              </div>
            </div>

            {/* Description & Features */}
            <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Slide your mallet with touch or mouse, blast the puck with kinetic impulse, bank off neon rails, and defend your goal in real time.
              </p>

              <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  Authoritative engine
                </span>
                <span aria-hidden="true" className="text-slate-700">·</span>
                <span className="flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  Kinetic rebounds
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={() => onOpenMultiplayerLobby('hockey')}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-arcade text-xs transition-colors whitespace-nowrap shadow-md"
                >
                  <Users className="w-3.5 h-3.5" />
                  Create / Join Room
                </button>
                <button
                  onClick={() => onSelectGame('hockey')}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold font-arcade text-xs border border-slate-700 transition-colors whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5 text-cyan-400" />
                  Solo Practice vs AI
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Cyber Pong */}
          <div className="group relative overflow-hidden rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 transition-all duration-300 flex flex-col justify-between shadow-xl">
            {/* Visual Media Showcase with Scrim */}
            <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-slate-950">
              <img
                src={CYBER_PONG_ART}
                alt="Neon cyber pong arena"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-indigo-300 block">Increasing Velocity &amp; Reflex Duel</span>
                  <h3 className="text-2xl font-black font-arcade text-white drop-shadow">Cyber Pong</h3>
                </div>
                <span className="text-xs font-mono font-bold text-slate-200 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                  First to 5
                </span>
              </div>
            </div>

            {/* Description & Features */}
            <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                The classic precision duel evolved. Control paddle angles to add deflection spin and outmaneuver your rival at lightning speeds.
              </p>

              <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  Sub-millisecond sync
                </span>
                <span aria-hidden="true" className="text-slate-700">·</span>
                <span className="flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-indigo-400" />
                  Dynamic acceleration
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={() => onOpenMultiplayerLobby('pong')}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-arcade text-xs transition-colors whitespace-nowrap shadow-md"
                >
                  <Users className="w-3.5 h-3.5" />
                  Create / Join Room
                </button>
                <button
                  onClick={() => onSelectGame('pong')}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold font-arcade text-xs border border-slate-700 transition-colors whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5 text-indigo-400" />
                  Solo Practice vs AI
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOLO ARCADE CHALLENGES SECTION */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 tracking-wider uppercase">
              <Flame className="w-4 h-4" />
              <span>Records &amp; High Precision</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-arcade text-white tracking-tight mt-1">
              SOLO ARCADE GAMES
            </h2>
          </div>
          <span className="text-xs font-medium text-slate-500">4 High-Speed Challenges</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {soloGames.map((game) => {
            const Icon = game.icon;
            return (
              <div
                key={game.id}
                onClick={() => onSelectGame(game.id)}
                className="group relative overflow-hidden rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between hover:bg-slate-900"
              >
                <div className="flex items-start gap-4">
                  {/* Media Thumbnail or Styled Vector Container */}
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 relative flex items-center justify-center">
                    {game.image ? (
                      <img
                        src={game.image}
                        alt={game.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="p-4 rounded-lg bg-slate-800/80 text-cyan-400">
                        <Icon className="w-8 h-8" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-400">{game.category}</span>
                      <span className="text-xs font-mono font-bold tabular-nums text-cyan-400">
                        Best: {game.highScore}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold font-arcade text-white group-hover:text-cyan-300 transition-colors truncate">
                      {game.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {game.desc}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-arcade font-bold text-slate-400 group-hover:text-cyan-400 transition-colors">
                  <span>PLAY NOW</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* GLOBAL LEADERBOARD & RECENT MATCHES SECTION */}
      <section className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 tracking-wider uppercase">
              <Trophy className="w-4 h-4" />
              <span>Official Standings &amp; Match Log</span>
            </div>
            <h3 className="text-xl font-black font-arcade text-white tracking-tight mt-1">
              PILOT LEADERBOARD
            </h3>
          </div>

          {/* Clean Segmented Tab Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => setActiveLeaderboardTab('leaderboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-arcade transition-colors whitespace-nowrap shrink-0 ${
                activeLeaderboardTab === 'leaderboard'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Global Standings
            </button>
            <button
              onClick={() => setActiveLeaderboardTab('matches')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-arcade transition-colors whitespace-nowrap shrink-0 ${
                activeLeaderboardTab === 'matches'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Recent Duels ({recentMatches.length})
            </button>
          </div>
        </div>

        {activeLeaderboardTab === 'leaderboard' ? (
          globalLeaderboard.length === 0 ? (
            <div className="text-center py-12 space-y-2 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
              <Trophy className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-xs text-slate-400">No competitive matches recorded yet.</p>
              <p className="text-[11px] text-slate-500">Finish a multiplayer duel to engrave your callsign on the leaderboard!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {globalLeaderboard.map((player, idx) => (
                <div
                  key={player.username}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-md font-mono font-bold flex items-center justify-center text-xs tabular-nums ${
                      idx === 0 ? 'bg-amber-500 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-950' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="text-lg">{player.avatar}</span>
                    <div>
                      <span className="font-bold font-arcade text-white block">{player.username}</span>
                      <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {player.matches} matches · {player.goals} goals scored
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Wins</span>
                      <span className="font-bold font-mono text-emerald-400 tabular-nums text-sm">{player.wins}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Winrate</span>
                      <span className="font-bold font-mono text-amber-400 tabular-nums text-sm">{player.winrate}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          recentMatches.length === 0 ? (
            <div className="text-center py-12 space-y-2 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
              <Swords className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-xs text-slate-400">No recent PvP duels completed.</p>
              <p className="text-[11px] text-slate-500">Play Air Hockey or Cyber Pong to generate the match report!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {recentMatches.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{m.gameType === 'hockey' ? '🏒' : '🏓'}</span>
                    <div>
                      <span className="font-bold font-arcade text-white block">
                        {m.p1} <span className="text-cyan-400 font-mono tabular-nums">{m.score1}</span> - <span className="text-indigo-400 font-mono tabular-nums">{m.score2}</span> {m.p2}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Winner: <strong className="text-emerald-400 font-medium">{m.winner}</strong> · <span className="font-mono tabular-nums">{m.time}</span>
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
                    Completed
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      {/* ACHIEVEMENTS & SOLO HISTORY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Achievements Showcase */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold font-arcade text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-400" /> TROPHIES &amp; ACHIEVEMENTS
            </h3>
            <span className="text-xs font-mono tabular-nums text-slate-400">{unlockedCount} / {achievements.length} unlocked</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {achievements.map((ach) => (
              <div
                key={ach.id}
                className={`p-3.5 rounded-xl border transition-colors flex items-start gap-3 ${
                  ach.unlocked
                    ? 'bg-slate-950/80 border-indigo-500/40 text-slate-200'
                    : 'bg-slate-950/40 border-slate-800/60 text-slate-500 opacity-60'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${ach.unlocked ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-600'}`}>
                  <Trophy className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold font-arcade text-white truncate">{ach.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{ach.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Solo Recent Runs */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold font-arcade text-white flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" /> SOLO RUN HISTORY
            </h3>
            <span className="text-xs text-slate-400">Recent Scores</span>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              No solo arcade runs recorded yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {history.slice(0, 6).map((rec) => {
                const gameName =
                  rec.gameId === 'runner'
                    ? 'Cyber Dash'
                    : rec.gameId === 'shooter'
                    ? 'Galaxy Defender'
                    : rec.gameId === 'snake'
                    ? 'Neon Snake'
                    : 'Quantum Fusion';

                return (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
                  >
                    <div>
                      <span className="font-bold font-arcade text-slate-200 block">{gameName}</span>
                      <span className="text-[10px] text-slate-500 font-mono tabular-nums">{rec.date}</span>
                    </div>
                    <span className="text-sm font-bold font-mono tabular-nums text-cyan-400">{rec.score} pts</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
