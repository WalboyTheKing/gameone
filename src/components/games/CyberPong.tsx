import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Award, 
  Users, 
  Bot, 
  Copy, 
  Check, 
  ArrowUp,
  ArrowDown,
  Share2,
  Eye
} from 'lucide-react';
import { sounds } from '../../utils/audio';
import { socket } from '../../utils/socket';
import { UserProfile, recordMatchResult } from '../../utils/userProfile';

interface CyberPongProps {
  onBack: () => void;
  profile: UserProfile;
  initialRoomData?: any;
  role?: string;
  onProfileUpdated?: (updated: UserProfile) => void;
}

const TABLE_WIDTH = 800;
const TABLE_HEIGHT = 500;
const PADDLE_HEIGHT = 90;
const PADDLE_WIDTH = 14;

export const CyberPong: React.FC<CyberPongProps> = ({
  onBack,
  profile,
  initialRoomData,
  role = 'player1',
  onProfileUpdated,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(!!initialRoomData);
  const [currentRoom, setCurrentRoom] = useState<any>(initialRoomData || null);
  const [myRole, setMyRole] = useState<string>(role);
  const [score1, setScore1] = useState<number>(0);
  const [score2, setScore2] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [winnerName, setWinnerName] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(sounds.getMuted());
  const [copiedCode, setCopiedCode] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: string; sender: string; emoji: string }[]>([]);

  const localStateRef = useRef({
    p1Y: TABLE_HEIGHT / 2,
    p2Y: TABLE_HEIGHT / 2,
    ball: { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT / 2, vx: 5, vy: 2, radius: 9, speed: 5.5 },
    sparks: [] as { x: number; y: number; vx: number; vy: number; color: string; life: number }[],
    score1: 0,
    score2: 0,
    maxScore: initialRoomData?.maxScore || 5,
  });

  const [copiedLink, setCopiedLink] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

  const handleMuteToggle = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  const copyRoomCode = () => {
    if (currentRoom?.id) {
      navigator.clipboard.writeText(currentRoom.id);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const copyDirectLink = () => {
    if (currentRoom?.id && typeof window !== 'undefined') {
      const url = `${window.location.origin}${window.location.pathname}?join=${currentRoom.id}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const sendEmojiReaction = (emoji: string) => {
    if (isMultiplayer && currentRoom) {
      socket.send({ type: 'send_emoji', emoji });
    } else {
      showFloatingEmoji(profile.username, emoji);
    }
  };

  const showFloatingEmoji = (sender: string, emoji: string) => {
    const newEmoji = { id: Math.random().toString(), sender, emoji };
    setFloatingEmojis(prev => [...prev.slice(-4), newEmoji]);
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== newEmoji.id));
    }, 2500);
  };

  const [disconnectGrace, setDisconnectGrace] = useState<{ active: boolean; user: string; secondsLeft: number } | null>(null);

  // --- MULTIPLAYER SOCKET EVENTS ---
  useEffect(() => {
    if (!isMultiplayer) return;

    socket.connect();

    const unsubTick = socket.on('game_tick', (data) => {
      const s = localStateRef.current;
      s.ball.x = data.ball.x;
      s.ball.y = data.ball.y;
      s.ball.vx = data.ball.vx;
      s.ball.vy = data.ball.vy;
      s.score1 = data.score1;
      s.score2 = data.score2;
      setScore1(data.score1);
      setScore2(data.score2);

      if (myRole === 'player1') {
        s.p2Y = data.p2.y;
      } else if (myRole === 'player2') {
        s.p1Y = data.p1.y;
      } else {
        // Authoritative spectator view: both paddles updated
        s.p1Y = data.p1.y;
        s.p2Y = data.p2.y;
      }
    });

    const unsubPaddleHit = socket.on('paddle_hit', (data) => {
      sounds.playLaser();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(30); } catch {}
      }
      const s = localStateRef.current;
      const x = data.side === 'left' ? 35 : TABLE_WIDTH - 35;
      for (let i = 0; i < 10; i++) {
        s.sparks.push({
          x,
          y: data.y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          color: data.side === 'left' ? '#6366f1' : '#06b6d4',
          life: 1.0,
        });
      }
    });

    const unsubCountdown = socket.on('countdown_tick', (data) => {
      setCountdown(data.countdown);
      sounds.playCoin();
    });

    const unsubGameStarted = socket.on('game_started', (data) => {
      setCountdown(null);
      setCurrentRoom(data.room);
      setIsGameOver(false);
      setOpponentDisconnected(false);
      setDisconnectGrace(null);
      sounds.playPowerUp();
    });

    const unsubGoal = socket.on('goal_scored', (data) => {
      sounds.playHit();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([60, 40, 100]); } catch {}
      }
      setScore1(data.score1);
      setScore2(data.score2);
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.5 } });
    });

    const unsubGameOver = socket.on('game_over', (data) => {
      setIsGameOver(true);
      setWinnerName(data.winnerName);
      setDisconnectGrace(null);
      sounds.playGameOver();
      const isWinner = (myRole === 'player1' && data.winner === 'player1') || (myRole === 'player2' && data.winner === 'player2');
      if (isWinner) {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
      }
      const updated = recordMatchResult(isWinner, myRole === 'player1' ? data.score1 : data.score2);
      onProfileUpdated?.(updated);
    });

    const unsubEmoji = socket.on('emoji_broadcast', (data) => {
      showFloatingEmoji(data.sender, data.emoji);
    });

    const unsubUpdate = socket.on('room_update', (data) => {
      setCurrentRoom(data.room);
      if (data.room.status === 'countdown') {
        setCountdown(data.room.countdown);
      }
      if (Object.values(data.room.players || {}).filter((p: any) => p.connected).length >= 2) {
        setOpponentDisconnected(false);
        setDisconnectGrace(null);
      }
    });

    const unsubGrace = socket.on('player_disconnected_grace', (data) => {
      setDisconnectGrace({
        active: true,
        user: data.username || 'Adversaire',
        secondsLeft: data.graceSeconds || 30,
      });
    });

    const unsubReconnected = socket.on('player_reconnected', (data) => {
      setDisconnectGrace(null);
      setOpponentDisconnected(false);
      setCurrentRoom(data.room);
      sounds.playPowerUp();
    });

    const unsubForfeit = socket.on('forfeit_timeout', () => {
      setDisconnectGrace(null);
      setOpponentDisconnected(true);
    });

    const unsubRematch = socket.on('rematch_started', (data) => {
      setCurrentRoom(data.room);
      setIsGameOver(false);
      setCountdown(3);
      setDisconnectGrace(null);
      setOpponentDisconnected(false);
      sounds.playPowerUp();
    });

    const unsubPlayerLeft = socket.on('player_left', (data) => {
      setCurrentRoom(data.room);
      setOpponentDisconnected(true);
      setDisconnectGrace(null);
    });

    const unsubOpen = socket.on('connection_open', () => {
      if (currentRoom?.id) {
        socket.send({
          type: 'reconnect_room',
          roomId: currentRoom.id,
          playerKey: profile.id,
          username: profile.username,
          avatar: profile.avatar,
        });
      }
    });

    return () => {
      unsubTick();
      unsubPaddleHit();
      unsubCountdown();
      unsubGameStarted();
      unsubGoal();
      unsubGameOver();
      unsubEmoji();
      unsubUpdate();
      unsubGrace();
      unsubReconnected();
      unsubForfeit();
      unsubRematch();
      unsubPlayerLeft();
      unsubOpen();
    };
  }, [isMultiplayer, myRole, onProfileUpdated, currentRoom?.id, profile]);

  // Pointer movement handler
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (myRole === 'spectator') return; // Spectators cannot move paddles
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleY = TABLE_HEIGHT / rect.height;
    const y = (e.clientY - rect.top) * scaleY;
    const clampedY = Math.max(50, Math.min(TABLE_HEIGHT - 50, y));

    const s = localStateRef.current;

    if (isMultiplayer) {
      if (myRole === 'player1') {
        s.p1Y = clampedY;
        socket.send({ type: 'move_paddle', y: clampedY });
      } else {
        s.p2Y = clampedY;
        socket.send({ type: 'move_paddle', y: clampedY });
      }
    } else {
      s.p1Y = clampedY;
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const s = localStateRef.current;
      const step = 25;
      let newY = myRole === 'player1' ? s.p1Y : s.p2Y;

      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        newY = Math.max(50, newY - step);
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        newY = Math.min(TABLE_HEIGHT - 50, newY + step);
      }

      if (myRole === 'player1') {
        s.p1Y = newY;
      } else {
        s.p2Y = newY;
      }

      if (isMultiplayer) {
        socket.send({ type: 'move_paddle', y: newY });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMultiplayer, myRole]);

  // Solo AI Practice Start
  const startSoloGame = () => {
    setIsMultiplayer(false);
    setCurrentRoom(null);
    const s = localStateRef.current;
    s.score1 = 0;
    s.score2 = 0;
    s.ball = { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT / 2, vx: 5.5, vy: 2, radius: 9, speed: 5.5 };
    s.p1Y = TABLE_HEIGHT / 2;
    s.p2Y = TABLE_HEIGHT / 2;
    setScore1(0);
    setScore2(0);
    setIsGameOver(false);
    sounds.playPowerUp();
  };

  const handlePlayAgain = () => {
    if (isMultiplayer && currentRoom) {
      socket.send({ type: 'play_again' });
    } else {
      startSoloGame();
    }
  };

  // Main Canvas Render & Solo loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const s = localStateRef.current;

      // SOLO AI BOT LOGIC
      if (!isMultiplayer && !isGameOver) {
        const b = s.ball;
        b.x += b.vx;
        b.y += b.vy;

        // Bounce top & bottom
        if (b.y - b.radius <= 0) {
          b.y = b.radius;
          b.vy = Math.abs(b.vy);
          sounds.playLaser();
        } else if (b.y + b.radius >= TABLE_HEIGHT) {
          b.y = TABLE_HEIGHT - b.radius;
          b.vy = -Math.abs(b.vy);
          sounds.playLaser();
        }

        // AI Paddle (Right)
        const targetY = b.y;
        s.p2Y += (targetY - s.p2Y) * 0.085;
        s.p2Y = Math.max(50, Math.min(TABLE_HEIGHT - 50, s.p2Y));

        // Paddle 1 Collision (Left)
        const p1X = 35;
        if (
          b.x - b.radius <= p1X + PADDLE_WIDTH / 2 &&
          b.x + b.radius >= p1X - PADDLE_WIDTH / 2 &&
          b.y >= s.p1Y - PADDLE_HEIGHT / 2 &&
          b.y <= s.p1Y + PADDLE_HEIGHT / 2 &&
          b.vx < 0
        ) {
          const offset = (b.y - s.p1Y) / (PADDLE_HEIGHT / 2);
          const angle = offset * ((Math.PI / 180) * 55);
          b.speed = Math.min(13, b.speed + 0.4);
          b.vx = Math.cos(angle) * b.speed;
          b.vy = Math.sin(angle) * b.speed;
          sounds.playLaser();

          for (let i = 0; i < 8; i++) {
            s.sparks.push({
              x: p1X + PADDLE_WIDTH / 2,
              y: b.y,
              vx: (Math.random() - 0.5) * 6,
              vy: (Math.random() - 0.5) * 6,
              color: '#6366f1',
              life: 1.0,
            });
          }
        }

        // Paddle 2 Collision (Right AI)
        const p2X = TABLE_WIDTH - 35;
        if (
          b.x + b.radius >= p2X - PADDLE_WIDTH / 2 &&
          b.x - b.radius <= p2X + PADDLE_WIDTH / 2 &&
          b.y >= s.p2Y - PADDLE_HEIGHT / 2 &&
          b.y <= s.p2Y + PADDLE_HEIGHT / 2 &&
          b.vx > 0
        ) {
          const offset = (b.y - s.p2Y) / (PADDLE_HEIGHT / 2);
          const angle = offset * ((Math.PI / 180) * 55);
          b.speed = Math.min(13, b.speed + 0.4);
          b.vx = -Math.cos(angle) * b.speed;
          b.vy = Math.sin(angle) * b.speed;
          sounds.playLaser();

          for (let i = 0; i < 8; i++) {
            s.sparks.push({
              x: p2X - PADDLE_WIDTH / 2,
              y: b.y,
              vx: (Math.random() - 0.5) * 6,
              vy: (Math.random() - 0.5) * 6,
              color: '#06b6d4',
              life: 1.0,
            });
          }
        }

        // Left goal (AI scores)
        if (b.x < 0) {
          s.score2 += 1;
          setScore2(s.score2);
          sounds.playHit();
          resetBallSolo(1);
          if (s.score2 >= s.maxScore) {
            setIsGameOver(true);
            setWinnerName('Cyber AI Bot');
            sounds.playGameOver();
          }
        }
        // Right goal (Player 1 scores)
        else if (b.x > TABLE_WIDTH) {
          s.score1 += 1;
          setScore1(s.score1);
          sounds.playCoin();
          resetBallSolo(-1);
          if (s.score1 >= s.maxScore) {
            setIsGameOver(true);
            setWinnerName(profile.username);
            sounds.playPowerUp();
            confetti({ particleCount: 100, spread: 70 });
            const updated = recordMatchResult(true, s.score1);
            onProfileUpdated?.(updated);
          }
        }
      }

      function resetBallSolo(dir: number) {
        s.ball.x = TABLE_WIDTH / 2;
        s.ball.y = TABLE_HEIGHT / 2;
        s.ball.speed = 5.5;
        s.ball.vx = dir * 5.5;
        s.ball.vy = (Math.random() - 0.5) * 4;
      }

      // Clear Canvas
      ctx.fillStyle = '#060913';
      ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

      // Cyber Grid CRT Lines
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.1)';
      ctx.lineWidth = 1;
      for (let y = 0; y < TABLE_HEIGHT; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(TABLE_WIDTH, y);
        ctx.stroke();
      }

      // Outer Glow Border
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, TABLE_WIDTH - 6, TABLE_HEIGHT - 6);

      // Center Dotted Line
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.35)';
      ctx.lineWidth = 4;
      ctx.setLineDash([14, 14]);
      ctx.beginPath();
      ctx.moveTo(TABLE_WIDTH / 2, 0);
      ctx.lineTo(TABLE_WIDTH / 2, TABLE_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);

      // Sparks
      for (let i = s.sparks.length - 1; i >= 0; i--) {
        const sp = s.sparks[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.life -= 0.05;
        if (sp.life <= 0) {
          s.sparks.splice(i, 1);
          continue;
        }
        ctx.fillStyle = sp.color;
        ctx.globalAlpha = sp.life;
        ctx.fillRect(sp.x, sp.y, 4, 4);
        ctx.globalAlpha = 1.0;
      }

      // Ball
      ctx.save();
      ctx.fillStyle = '#facc15';
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(s.ball.x, s.ball.y, s.ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Paddle 1 (Left - Indigo/Purple)
      ctx.save();
      ctx.fillStyle = '#818cf8';
      ctx.shadowColor = '#6366f1';
      ctx.shadowBlur = 16;
      ctx.fillRect(35 - PADDLE_WIDTH / 2, s.p1Y - PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT);
      ctx.restore();

      // Paddle 2 (Right - Cyan)
      ctx.save();
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 16;
      ctx.fillRect(TABLE_WIDTH - 35 - PADDLE_WIDTH / 2, s.p2Y - PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT);
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isMultiplayer, isGameOver, profile.username, onProfileUpdated]);

  const playersList = (currentRoom?.players ? Object.values(currentRoom.players) : []) as any[];
  const p1Name = isMultiplayer
    ? playersList.find((p: any) => p.role === 'player1')?.username || 'Attente...'
    : profile.username;

  const p2Name = isMultiplayer
    ? playersList.find((p: any) => p.role === 'player2')?.username || 'Attente Joueur 2...'
    : 'Cyber AI Bot';

  const isWaitingOpponent = isMultiplayer && Object.keys(currentRoom?.players || {}).length < 2;

  return (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto p-3 sm:p-6 select-none">
      {/* Top Bar */}
      <div className="w-full flex flex-wrap items-center justify-between mb-4 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl px-4 py-3 shadow-xl gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-xs sm:text-sm font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 transition"
          >
            ← Arcade
          </button>

          {isMultiplayer ? (
            <div className="flex items-center gap-2">
              {myRole === 'spectator' ? (
                <span className="flex items-center gap-1.5 text-xs font-bold font-arcade px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 animate-pulse">
                  <Eye className="w-3.5 h-3.5" /> SPECTATEUR DIRECT (60 FPS)
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-bold font-arcade px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Users className="w-3.5 h-3.5" /> MULTIJOUEUR PONG
                </span>
              )}
              <button
                onClick={copyRoomCode}
                className="flex items-center gap-1 text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition"
                title="Copier le code du salon"
              >
                #{currentRoom?.id} {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold font-arcade px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Bot className="w-3.5 h-3.5" /> ENTRAÎNEMENT SOLO VS IA
              </span>
            </div>
          )}
        </div>

        {/* Score Board */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-right">
            <div>
              <span className="text-[10px] text-indigo-400 uppercase font-bold block max-w-[100px] truncate">
                {p1Name}
              </span>
              <span className="text-xl sm:text-2xl font-black font-arcade text-indigo-400">{score1}</span>
            </div>
          </div>

          <span className="text-xs font-bold font-arcade text-slate-600">:</span>

          <div className="flex items-center gap-2 text-left">
            <div>
              <span className="text-[10px] text-cyan-400 uppercase font-bold block max-w-[100px] truncate">
                {p2Name}
              </span>
              <span className="text-xl sm:text-2xl font-black font-arcade text-cyan-400">{score2}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isMultiplayer && (
            <button
              onClick={() => onBack()}
              className="px-3 py-1.5 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/40 text-xs font-bold font-arcade transition"
            >
              Créer / Rejoindre Salon
            </button>
          )}

          <button
            onClick={handleMuteToggle}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            aria-label="Toggle Sound"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Main Pong Canvas */}
      <div className="relative w-full rounded-3xl overflow-hidden border-2 border-indigo-500/40 shadow-2xl bg-black">
        <canvas
          ref={canvasRef}
          width={TABLE_WIDTH}
          height={TABLE_HEIGHT}
          onPointerMove={handlePointerMove}
          className="w-full h-auto block aspect-[800/500] max-h-[520px] cursor-ns-resize touch-none"
        />

        {/* Floating Emojis */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-2 pointer-events-none z-20">
          {floatingEmojis.map(item => (
            <div
              key={item.id}
              className="animate-bounce bg-slate-900/90 border border-slate-700 text-white px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 shadow-xl"
            >
              <span className="text-xs text-slate-400">{item.sender}:</span>
              <span className="text-xl">{item.emoji}</span>
            </div>
          ))}
        </div>

        {/* Countdown Overlay */}
        {countdown !== null && countdown > 0 && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none z-30">
            <span className="text-8xl font-black font-arcade text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 animate-ping">
              {countdown}
            </span>
            <p className="text-sm font-bold font-arcade text-white mt-4 uppercase tracking-widest">
              Préparez vos raquettes...
            </p>
          </div>
        )}

        {/* Opponent Disconnect 30s Grace Window Alert */}
        {disconnectGrace?.active && !isGameOver && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-amber-950/90 border border-amber-500/60 text-amber-200 px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <div className="text-left">
              <span className="text-xs font-bold font-arcade block text-amber-300">
                Adversaire déconnecté ({disconnectGrace.user})
              </span>
              <span className="text-[11px] text-amber-200/90">
                Fenêtre de reconnexion en cours ({disconnectGrace.secondsLeft}s)... Reprise automatique dès retour
              </span>
            </div>
            <button
              onClick={onBack}
              className="ml-2 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold font-arcade transition"
            >
              Quitter
            </button>
          </div>
        )}

        {/* Opponent Disconnect Alert (Final) */}
        {!disconnectGrace?.active && opponentDisconnected && !isWaitingOpponent && !isGameOver && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-rose-950/90 border border-rose-500/50 text-rose-200 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span className="text-xs font-bold font-arcade">Adversaire parti ou délai de 30s expiré. Match clos.</span>
            <button
              onClick={onBack}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-arcade transition"
            >
              Quitter
            </button>
          </div>
        )}

        {/* Waiting for Opponent */}
        {isWaitingOpponent && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
            <div className="space-y-4 max-w-md">
              <div className="inline-flex p-3.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 animate-pulse">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black font-arcade text-white tracking-wider">
                SALON CYBER PONG OUVERT
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Partagez ce code ou envoyez directement le lien d'invitation à votre adversaire :
              </p>

              {/* Share Code & Direct Link */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-800">
                  <span className="text-xl font-black font-mono text-indigo-400 tracking-wider">
                    #{currentRoom?.id}
                  </span>
                  <button
                    onClick={copyRoomCode}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold font-arcade border border-slate-700 transition"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? 'Copié !' : 'Copier Code'}
                  </button>
                </div>

                <button
                  onClick={copyDirectLink}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-bold font-arcade shadow-lg transition active:scale-95"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Share2 className="w-4 h-4" />}
                  {copiedLink ? 'Lien d\'invitation copié !' : 'Copier le Lien Direct d\'Invitation'}
                </button>
              </div>

              <div className="pt-2">
                <button
                  onClick={startSoloGame}
                  className="text-xs text-slate-400 hover:text-white underline underline-offset-4"
                >
                  Ou s'échauffer contre le bot IA en attendant
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game Over Screen */}
        {isGameOver && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
            <div className="space-y-5 max-w-sm">
              <div className="inline-flex p-4 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400">
                <Award className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-3xl font-black font-arcade text-white tracking-wider">
                  VICTOIRE DE {winnerName.toUpperCase()} !
                </h3>
                <p className="text-xs text-slate-400 mt-1">Match Cyber Pong Terminé</p>
              </div>

              <div className="grid grid-cols-2 gap-3 py-3 bg-slate-900/90 rounded-2xl p-4 border border-slate-800">
                <div>
                  <span className="text-xs text-indigo-400 font-bold block truncate">{p1Name}</span>
                  <p className="text-2xl font-black font-arcade text-white">{score1}</p>
                </div>
                <div>
                  <span className="text-xs text-cyan-400 font-bold block truncate">{p2Name}</span>
                  <p className="text-2xl font-black font-arcade text-white">{score2}</p>
                </div>
              </div>

              <button
                onClick={handlePlayAgain}
                className="w-full inline-flex items-center justify-center gap-2 py-4 rounded-xl font-bold font-arcade text-sm bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white shadow-xl shadow-indigo-500/25 transition transform active:scale-95"
              >
                <RotateCcw className="w-4 h-4" /> REJOUER UNE PARTIE
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Reaction Bar */}
      <div className="flex items-center justify-between w-full mt-4 p-2.5 rounded-2xl bg-slate-900/70 border border-slate-800">
        <span className="text-[11px] font-bold font-arcade uppercase text-slate-400 px-2">
          Réactions en direct:
        </span>
        <div className="flex items-center gap-2">
          {['🔥', '👑', '⚡', '🎯', '💀', '😎'].map(emoji => (
            <button
              key={emoji}
              onClick={() => sendEmojiReaction(emoji)}
              className="text-xl p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 hover:scale-125 transition transform active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
