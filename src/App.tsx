import React, { useState, useEffect } from 'react';
import { ArcadeDashboard } from './components/ArcadeDashboard';
import { CyberRunner } from './components/games/CyberRunner';
import { SpaceDefender } from './components/games/SpaceDefender';
import { NeonSnake } from './components/games/NeonSnake';
import { QuantumFusion } from './components/games/QuantumFusion';
import { NeonAirHockey } from './components/games/NeonAirHockey';
import { CyberPong } from './components/games/CyberPong';
import { LobbyModal } from './components/multiplayer/LobbyModal';
import { ProfileModal } from './components/multiplayer/ProfileModal';
import { WelcomeOnboardingModal } from './components/multiplayer/WelcomeOnboardingModal';
import { getStorageData } from './utils/storage';
import { getUserProfile, UserProfile } from './utils/userProfile';
import { sounds } from './utils/audio';
import { socket } from './utils/socket';
import { 
  fetchGlobalLeaderboard, 
  fetchRecentMatches, 
  GlobalLeaderboardPlayer, 
  MatchHistoryLog 
} from './utils/multiplayerStats';

type ActiveView = 'dashboard' | 'runner' | 'shooter' | 'snake' | 'tile' | 'hockey' | 'pong';

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [storageData, setStorageData] = useState(getStorageData());
  const [userProfile, setUserProfile] = useState<UserProfile>(getUserProfile());
  const [isMuted, setIsMuted] = useState(sounds.getMuted());
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(() => !getUserProfile().hasChosenNickname);
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('join') || params.get('room');
  });
  const [isLobbyOpen, setIsLobbyOpen] = useState(false);
  const [lobbyGameType, setLobbyGameType] = useState<'hockey' | 'pong'>('hockey');
  const [activeRoomData, setActiveRoomData] = useState<any>(null);
  const [activeRole, setActiveRole] = useState<string>('player1');
  const [globalLeaderboard, setGlobalLeaderboard] = useState<GlobalLeaderboardPlayer[]>([]);
  const [recentMatches, setRecentMatches] = useState<MatchHistoryLog[]>([]);

  const loadStats = () => {
    fetchGlobalLeaderboard().then(setGlobalLeaderboard);
    fetchRecentMatches().then(setRecentMatches);
  };

  useEffect(() => {
    socket.connect();
    loadStats();

    if (pendingJoinCode && userProfile.hasChosenNickname) {
      const targetCode = pendingJoinCode.toUpperCase().trim();
      const tryJoin = () => {
        sounds.playLaser();
        socket.send({
          type: 'join_room',
          roomId: targetCode,
          username: userProfile.username,
          avatar: userProfile.avatar,
          playerKey: userProfile.id,
        });
      };

      if (socket.isConnected()) {
        tryJoin();
      } else {
        const unsub = socket.on('connection_open', () => {
          tryJoin();
          unsub();
        });
      }
    }

    const unsubJoined = socket.on('room_joined', (data) => {
      handleRoomJoined(data.room, data.role);
    });

    const unsubReconnected = socket.on('room_reconnected', (data) => {
      handleRoomJoined(data.room, data.role);
    });

    const unsubOver = socket.on('game_over', () => {
      setTimeout(() => loadStats(), 1000);
    });

    return () => {
      unsubJoined();
      unsubReconnected();
      unsubOver();
    };
  }, []);

  const refreshData = () => {
    setStorageData(getStorageData());
    setUserProfile(getUserProfile());
    loadStats();
  };

  const handleToggleMute = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  const handleNewHighScore = (_score: number) => {
    refreshData();
  };

  const handleBackToDashboard = () => {
    if (activeRoomData) {
      socket.send({ type: 'leave_room' });
      setActiveRoomData(null);
    }
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    refreshData();
    setActiveView('dashboard');
  };

  const handleOpenLobby = (gameType: 'hockey' | 'pong' = 'hockey') => {
    setLobbyGameType(gameType);
    setIsLobbyOpen(true);
  };

  const handleQuickMatch = () => {
    setLobbyGameType('hockey');
    setIsLobbyOpen(true);
  };

  const handleRoomJoined = (roomData: any, role: string) => {
    setActiveRoomData(roomData);
    setActiveRole(role);
    if (roomData.gameType === 'pong') {
      setActiveView('pong');
    } else {
      setActiveView('hockey');
    }
  };

  const handleWelcomeComplete = (updated: UserProfile) => {
    setUserProfile(updated);
    setIsWelcomeOpen(false);
    loadStats();

    if (pendingJoinCode) {
      const targetCode = pendingJoinCode.toUpperCase().trim();
      const sendJoin = () => {
        sounds.playLaser();
        socket.send({
          type: 'join_room',
          roomId: targetCode,
          username: updated.username,
          avatar: updated.avatar,
          playerKey: updated.id,
        });
        setPendingJoinCode(null);
      };

      if (socket.isConnected()) {
        sendJoin();
      } else {
        const unsub = socket.on('connection_open', () => {
          sendJoin();
          unsub();
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Bar Contract (1-Row, 3-Zone: Brand, Nav, Action) */}
      <header className="sticky top-0 z-40 w-full bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            onClick={handleBackToDashboard}
            className="text-lg font-black font-arcade tracking-tight text-white hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0"
          >
            <span className="text-cyan-400">NEON</span> ARCADE
          </button>

          {/* Zone 2: 4 clean single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <button
              onClick={() => {
                if (activeView !== 'dashboard') handleBackToDashboard();
              }}
              className="hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0"
            >
              1v1 Arena
            </button>
            <button
              onClick={() => {
                if (activeView !== 'dashboard') handleBackToDashboard();
              }}
              className="hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0"
            >
              Solo Games
            </button>
            <button
              onClick={() => {
                if (activeView !== 'dashboard') handleBackToDashboard();
              }}
              className="hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0"
            >
              Leaderboard
            </button>
            <button
              onClick={() => {
                if (activeView !== 'dashboard') handleBackToDashboard();
              }}
              className="hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0"
            >
              Trophies
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            {activeView === 'dashboard' ? (
              <button
                onClick={handleQuickMatch}
                className="px-4 py-2 text-xs font-bold font-arcade text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm shadow-cyan-400/20"
              >
                Quick Match
              </button>
            ) : (
              <button
                onClick={handleBackToDashboard}
                className="px-3.5 py-1.5 text-xs font-bold font-arcade text-cyan-400 bg-slate-900 hover:bg-slate-800 rounded-lg border border-cyan-500/40 transition-colors whitespace-nowrap shrink-0"
              >
                ← Back to Menu
              </button>
            )}

            <button
              onClick={() => setIsProfileOpen(true)}
              className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-sm hover:border-cyan-500/50 transition-colors"
              title="Player Profile"
              aria-label="Player Profile"
            >
              {userProfile.avatar}
            </button>
          </div>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="flex-1 flex flex-col justify-center items-center py-4 sm:py-6">
        {activeView === 'dashboard' && (
          <ArcadeDashboard
            onSelectGame={(gameId) => {
              setActiveRoomData(null);
              setActiveView(gameId);
            }}
            onOpenMultiplayerLobby={handleOpenLobby}
            onQuickMatch={handleQuickMatch}
            onOpenProfile={() => setIsProfileOpen(true)}
            profile={userProfile}
            highScores={storageData.scores}
            history={storageData.history}
            achievements={storageData.achievements}
            globalLeaderboard={globalLeaderboard}
            recentMatches={recentMatches}
            coins={storageData.coins}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
          />
        )}

        {/* Solo Retro Games */}
        {activeView === 'runner' && (
          <CyberRunner
            onBack={handleBackToDashboard}
            highScore={storageData.scores['runner'] || 0}
            onNewHighScore={handleNewHighScore}
          />
        )}

        {activeView === 'shooter' && (
          <SpaceDefender
            onBack={handleBackToDashboard}
            highScore={storageData.scores['shooter'] || 0}
            onNewHighScore={handleNewHighScore}
          />
        )}

        {activeView === 'snake' && (
          <NeonSnake
            onBack={handleBackToDashboard}
            highScore={storageData.scores['snake'] || 0}
            onNewHighScore={handleNewHighScore}
          />
        )}

        {activeView === 'tile' && (
          <QuantumFusion
            onBack={handleBackToDashboard}
            highScore={storageData.scores['tile'] || 0}
            onNewHighScore={handleNewHighScore}
          />
        )}

        {/* Real-time Multiplayer & Solo Air Hockey */}
        {activeView === 'hockey' && (
          <NeonAirHockey
            onBack={handleBackToDashboard}
            profile={userProfile}
            initialRoomData={activeRoomData}
            role={activeRole}
            onProfileUpdated={(updated) => setUserProfile(updated)}
          />
        )}

        {/* Real-time Multiplayer & Solo Cyber Pong */}
        {activeView === 'pong' && (
          <CyberPong
            onBack={handleBackToDashboard}
            profile={userProfile}
            initialRoomData={activeRoomData}
            role={activeRole}
            onProfileUpdated={(updated) => setUserProfile(updated)}
          />
        )}
      </main>

      {/* Multiplayer Room Creation & Lobby Browser Modal */}
      <LobbyModal
        isOpen={isLobbyOpen}
        onClose={() => setIsLobbyOpen(false)}
        profile={userProfile}
        initialGameType={lobbyGameType}
        onRoomJoined={handleRoomJoined}
      />

      {/* Profile & Nickname Customization Modal */}
      <ProfileModal
        profile={userProfile}
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onSave={(updated) => {
          setUserProfile(updated);
          loadStats();
        }}
      />

      {/* First Launch Welcome & Nickname Choice Modal */}
      <WelcomeOnboardingModal
        isOpen={isWelcomeOpen}
        currentProfile={userProfile}
        invitationRoomCode={pendingJoinCode}
        onComplete={handleWelcomeComplete}
      />

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 py-6 text-center text-xs text-slate-500 bg-slate-950/60">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>NEON ARCADE · Built by Walboy The King</span>
          <div className="flex items-center gap-4 text-slate-500">
            <span>Authoritative 60 FPS</span>
            <span aria-hidden="true">·</span>
            <span>WebSocket Private Rooms</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
