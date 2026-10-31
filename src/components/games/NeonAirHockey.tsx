import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  Sparkles,
  Share2,
  Eye
} from 'lucide-react';
import { sounds } from '../../utils/audio';
import { socket } from '../../utils/socket';
import { UserProfile, recordMatchResult } from '../../utils/userProfile';

interface NeonAirHockeyProps {
  onBack: () => void;
  profile: UserProfile;
  initialRoomData?: any;
  role?: string; // 'player1' | 'player2' | 'spectator'
  onProfileUpdated?: (updated: UserProfile) => void;
}

const TABLE_WIDTH = 800;
const TABLE_HEIGHT = 500;
const GOAL_TOP = 170;
const GOAL_BOTTOM = 330;

export const NeonAirHockey: React.FC<NeonAirHockeyProps> = ({
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

  // Local state for AI Solo play or interpolation
  const localStateRef = useRef({
    p1: { x: 120, y: TABLE_HEIGHT / 2, prevX: 120, prevY: TABLE_HEIGHT / 2, vx: 0, vy: 0 },
    p2: { x: TABLE_WIDTH - 120, y: TABLE_HEIGHT / 2, prevX: TABLE_WIDTH - 120, prevY: TABLE_HEIGHT / 2, vx: 0, vy: 0 },
    ball: { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT / 2, vx: 4, vy: 2, radius: 14 },
    sparks: [] as { x: number; y: number; vx: number; vy: number; color: string; life: number }[],
    puckTrail: [] as { x: number; y: number; alpha: number }[],
    score1: 0,
    score2: 0,
    isPlayingSolo: !initialRoomData,
    maxScore: initialRoomData?.maxScore || 5,
    lastGoalTime: 0,
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

  // --- MULTIPLAYER SOCKET WIRING ---
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

      // Interpolate player positions
      if (myRole === 'player1') {
        s.p2.x = data.p2.x;
        s.p2.y = data.p2.y;
      } else if (myRole === 'player2') {
        s.p1.x = data.p1.x;
        s.p1.y = data.p1.y;
      } else {
        // Authoritative spectator view: both players updated from server
        s.p1.x = data.p1.x;
        s.p1.y = data.p1.y;
        s.p2.x = data.p2.x;
        s.p2.y = data.p2.y;
      }
    });

    const unsubMalletHit = socket.on('mallet_hit', (data) => {
      sounds.playLaser();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(30); } catch {}
      }
      // Spawn hit sparks
      const s = localStateRef.current;
      const color = data.side === 'left' ? '#06b6d4' : '#ec4899';
      for (let i = 0; i < 12; i++) {
        s.sparks.push({
          x: data.x,
          y: data.y,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          color,
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
      // Confetti for goal
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

    // Handle auto-reconnect if local network restored
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
      unsubMalletHit();
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

  // Pointer / Mouse move handler
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = TABLE_WIDTH / rect.width;
    const scaleY = TABLE_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const s = localStateRef.current;

    if (isMultiplayer) {
      if (myRole === 'player1') {
        const clampedX = Math.max(40, Math.min(TABLE_WIDTH / 2 - 40, x));
        const clampedY = Math.max(40, Math.min(TABLE_HEIGHT - 40, y));
        s.p1.x = clampedX;
        s.p1.y = clampedY;
        socket.send({ type: 'move_paddle', x: clampedX, y: clampedY });
      } else if (myRole === 'player2') {
        const clampedX = Math.max(TABLE_WIDTH / 2 + 40, Math.min(TABLE_WIDTH - 40, x));
        const clampedY = Math.max(40, Math.min(TABLE_HEIGHT - 40, y));
        s.p2.x = clampedX;
        s.p2.y = clampedY;
        socket.send({ type: 'move_paddle', x: clampedX, y: clampedY });
      }
    } else {
      // Solo Mode: player controls Left mallet
      const clampedX = Math.max(40, Math.min(TABLE_WIDTH / 2 - 40, x));
      const clampedY = Math.max(40, Math.min(TABLE_HEIGHT - 40, y));
      s.p1.vx = (clampedX - s.p1.x) * 0.8;
      s.p1.vy = (clampedY - s.p1.y) * 0.8;
      s.p1.x = clampedX;
      s.p1.y = clampedY;
    }
  };

  // Switch to Solo / AI Mode
  const startSoloGame = () => {
    setIsMultiplayer(false);
    setCurrentRoom(null);
    const s = localStateRef.current;
    s.score1 = 0;
    s.score2 = 0;
    s.ball = { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT / 2, vx: 5, vy: (Math.random() - 0.5) * 4, radius: 14 };
    s.p1 = { x: 120, y: TABLE_HEIGHT / 2, prevX: 120, prevY: TABLE_HEIGHT / 2, vx: 0, vy: 0 };
    s.p2 = { x: TABLE_WIDTH - 120, y: TABLE_HEIGHT / 2, prevX: TABLE_WIDTH - 120, prevY: TABLE_HEIGHT / 2, vx: 0, vy: 0 };
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

  // Main Canvas Render & AI loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const s = localStateRef.current;

      // --- SOLO AI BOT LOGIC (When not in multiplayer) ---
      if (!isMultiplayer && !isGameOver) {
        const b = s.ball;
        b.x += b.vx;
        b.y += b.vy;
        b.vx *= 0.993;
        b.vy *= 0.993;

        // Wall collisions
        if (b.y - b.radius <= 10) {
          b.y = 10 + b.radius;
          b.vy = Math.abs(b.vy) * 0.95;
          sounds.playLaser();
        } else if (b.y + b.radius >= TABLE_HEIGHT - 10) {
          b.y = TABLE_HEIGHT - 10 - b.radius;
          b.vy = -Math.abs(b.vy) * 0.95;
          sounds.playLaser();
        }

        // Left rail (Player 1)
        if (b.x - b.radius <= 10) {
          if (b.y >= GOAL_TOP && b.y <= GOAL_BOTTOM) {
            // Goal AI!
            if (b.x <= 0) {
              s.score2 += 1;
              setScore2(s.score2);
              sounds.playHit();
              resetPuckSolo(1);
              if (s.score2 >= s.maxScore) {
                setIsGameOver(true);
                setWinnerName('Cyber AI Bot');
                sounds.playGameOver();
              }
            }
          } else {
            b.x = 10 + b.radius;
            b.vx = Math.abs(b.vx) * 0.95;
          }
        }

        // Right rail (AI)
        if (b.x + b.radius >= TABLE_WIDTH - 10) {
          if (b.y >= GOAL_TOP && b.y <= GOAL_BOTTOM) {
            // Goal Player 1!
            if (b.x >= TABLE_WIDTH) {
              s.score1 += 1;
              setScore1(s.score1);
              sounds.playCoin();
              resetPuckSolo(-1);
              if (s.score1 >= s.maxScore) {
                setIsGameOver(true);
                setWinnerName(profile.username);
                sounds.playPowerUp();
                confetti({ particleCount: 100, spread: 70 });
                const updated = recordMatchResult(true, s.score1);
                onProfileUpdated?.(updated);
              }
            }
          } else {
            b.x = TABLE_WIDTH - 10 - b.radius;
            b.vx = -Math.abs(b.vx) * 0.95;
          }
        }

        // AI Movement (Right Mallet)
        const targetX = b.x > TABLE_WIDTH / 2 ? Math.min(TABLE_WIDTH - 80, b.x) : TABLE_WIDTH - 120;
        const targetY = b.y;
        s.p2.vx = (targetX - s.p2.x) * 0.08;
        s.p2.vy = (targetY - s.p2.y) * 0.08;
        s.p2.x += s.p2.vx;
        s.p2.y += s.p2.vy;
        s.p2.x = Math.max(TABLE_WIDTH / 2 + 40, Math.min(TABLE_WIDTH - 40, s.p2.x));
        s.p2.y = Math.max(40, Math.min(TABLE_HEIGHT - 40, s.p2.y));

        // Mallet collisions (Player 1 & AI)
        checkMalletCollideSolo(s.p1, 'left');
        checkMalletCollideSolo(s.p2, 'right');
      }

      function resetPuckSolo(dir: number) {
        s.ball.x = TABLE_WIDTH / 2;
        s.ball.y = TABLE_HEIGHT / 2;
        s.ball.vx = dir * 5;
        s.ball.vy = (Math.random() - 0.5) * 3;
      }

      function checkMalletCollideSolo(player: { x: number; y: number; vx: number; vy: number }, side: string) {
        const dx = s.ball.x - player.x;
        const dy = s.ball.y - player.y;
        const dist = Math.hypot(dx, dy);
        const malletRadius = 26;

        if (dist < s.ball.radius + malletRadius) {
          const angle = Math.atan2(dy, dx);
          const overlap = s.ball.radius + malletRadius - dist;
          s.ball.x += Math.cos(angle) * overlap;
          s.ball.y += Math.sin(angle) * overlap;

          const speed = Math.min(16, 6 + Math.hypot(player.vx, player.vy) * 0.5);
          s.ball.vx = Math.cos(angle) * speed + player.vx * 0.3;
          s.ball.vy = Math.sin(angle) * speed + player.vy * 0.3;

          sounds.playLaser();

          for (let i = 0; i < 10; i++) {
            s.sparks.push({
              x: s.ball.x,
              y: s.ball.y,
              vx: (Math.random() - 0.5) * 6,
              vy: (Math.random() - 0.5) * 6,
              color: side === 'left' ? '#06b6d4' : '#ec4899',
              life: 1.0,
            });
          }
        }
      }

      // Record puck trail
      s.puckTrail.push({ x: s.ball.x, y: s.ball.y, alpha: 0.6 });
      if (s.puckTrail.length > 8) s.puckTrail.shift();

      // Clear Table Surface
      ctx.fillStyle = '#060a14';
      ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

      // Neon Table Border
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, TABLE_WIDTH - 14, TABLE_HEIGHT - 14);

      // Glowing inner edge
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(14, 14, TABLE_WIDTH - 28, TABLE_HEIGHT - 28);

      // Center Divider Line
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 12]);
      ctx.beginPath();
      ctx.moveTo(TABLE_WIDTH / 2, 14);
      ctx.lineTo(TABLE_WIDTH / 2, TABLE_HEIGHT - 14);
      ctx.stroke();
      ctx.setLineDash([]);

      // Center Faceoff Circle
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(TABLE_WIDTH / 2, TABLE_HEIGHT / 2, 70, 0, Math.PI * 2);
      ctx.stroke();

      // Goal Pockets
      // Left Goal (Cyan)
      ctx.fillStyle = '#06b6d4';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 15;
      ctx.fillRect(0, GOAL_TOP, 10, GOAL_BOTTOM - GOAL_TOP);

      // Right Goal (Pink)
      ctx.fillStyle = '#ec4899';
      ctx.shadowColor = '#ec4899';
      ctx.shadowBlur = 15;
      ctx.fillRect(TABLE_WIDTH - 10, GOAL_TOP, 10, GOAL_BOTTOM - GOAL_TOP);
      ctx.shadowBlur = 0;

      // Draw Sparks
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
        ctx.fillRect(sp.x, sp.y, 3, 3);
        ctx.globalAlpha = 1.0;
      }

      // Draw Puck Trail
      s.puckTrail.forEach((pt, idx) => {
        const a = (idx / s.puckTrail.length) * 0.35;
        ctx.fillStyle = `rgba(244, 63, 94, ${a})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, s.ball.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Puck
      ctx.save();
      ctx.fillStyle = '#f43f5e';
      ctx.shadowColor = '#fb7185';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(s.ball.x, s.ball.y, s.ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // Puck Core Inner
      ctx.fillStyle = '#fff1f2';
      ctx.beginPath();
      ctx.arc(s.ball.x, s.ball.y, s.ball.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw Mallet 1 (Player 1 - Cyan)
      ctx.save();
      ctx.fillStyle = '#06b6d4';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(s.p1.x, s.p1.y, 26, 0, Math.PI * 2);
      ctx.fill();
      // Handle
      ctx.fillStyle = '#083344';
      ctx.beginPath();
      ctx.arc(s.p1.x, s.p1.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a5f3fc';
      ctx.beginPath();
      ctx.arc(s.p1.x, s.p1.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw Mallet 2 (Player 2 / AI - Pink)
      ctx.save();
      ctx.fillStyle = '#ec4899';
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(s.p2.x, s.p2.y, 26, 0, Math.PI * 2);
      ctx.fill();
      // Handle
      ctx.fillStyle = '#500724';
      ctx.beginPath();
      ctx.arc(s.p2.x, s.p2.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.arc(s.p2.x, s.p2.y, 6, 0, Math.PI * 2);
      ctx.fill();
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
                  <Users className="w-3.5 h-3.5" /> MULTIJOUEUR EN LIGNE
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
              <span className="flex items-center gap-1.5 text-xs font-bold font-arcade px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <Bot className="w-3.5 h-3.5" /> ENTRAÎNEMENT SOLO VS IA
              </span>
            </div>
          )}
        </div>

        {/* Score Board */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-right">
            <div>
              <span className="text-[10px] text-cyan-400 uppercase font-bold block max-w-[100px] truncate">
                {p1Name}
              </span>
              <span className="text-xl sm:text-2xl font-black font-arcade text-cyan-400">{score1}</span>
            </div>
          </div>

          <span className="text-xs font-bold font-arcade text-slate-600">:</span>

          <div className="flex items-center gap-2 text-left">
            <div>
              <span className="text-[10px] text-pink-400 uppercase font-bold block max-w-[100px] truncate">
                {p2Name}
              </span>
              <span className="text-xl sm:text-2xl font-black font-arcade text-pink-400">{score2}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isMultiplayer && (
            <button
              onClick={() => onBack()}
              className="px-3 py-1.5 rounded-xl bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/40 text-xs font-bold font-arcade transition"
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

      {/* Main Air Hockey Canvas */}
      <div className="relative w-full rounded-3xl overflow-hidden border-2 border-cyan-500/40 shadow-2xl bg-black">
        <canvas
          ref={canvasRef}
          width={TABLE_WIDTH}
          height={TABLE_HEIGHT}
          onPointerMove={handlePointerMove}
          className="w-full h-auto block aspect-[800/500] max-h-[520px] cursor-none touch-none"
        />

        {/* Floating Emojis Reaction stream */}
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
            <span className="text-8xl font-black font-arcade text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500 animate-ping">
              {countdown}
            </span>
            <p className="text-sm font-bold font-arcade text-white mt-4 uppercase tracking-widest">
              Préparez vos maillets...
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

        {/* Waiting for Opponent in Multiplayer Room */}
        {isWaitingOpponent && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
            <div className="space-y-4 max-w-md">
              <div className="inline-flex p-3.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 animate-pulse">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black font-arcade text-white tracking-wider">
                EN ATTENTE DU 2ÈME JOUEUR
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Partagez ce code ou envoyez directement le lien à votre adversaire pour démarrer le match !
              </p>

              {/* Share Code & Direct Link */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-800">
                  <span className="text-xl font-black font-mono text-cyan-400 tracking-wider">
                    #{currentRoom?.id}
                  </span>
                  <button
                    onClick={copyRoomCode}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold font-arcade border border-slate-700 transition"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? 'Copié !' : 'Copier Code'}
                  </button>
                </div>

                <button
                  onClick={copyDirectLink}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold font-arcade shadow-lg transition active:scale-95"
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
                  Ou s'entraîner contre l'IA en attendant
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
                <p className="text-xs text-slate-400 mt-1">Match Air Hockey Terminé</p>
              </div>

              <div className="grid grid-cols-2 gap-3 py-3 bg-slate-900/90 rounded-2xl p-4 border border-slate-800">
                <div>
                  <span className="text-xs text-cyan-400 font-bold block truncate">{p1Name}</span>
                  <p className="text-2xl font-black font-arcade text-white">{score1}</p>
                </div>
                <div>
                  <span className="text-xs text-pink-400 font-bold block truncate">{p2Name}</span>
                  <p className="text-2xl font-black font-arcade text-white">{score2}</p>
                </div>
              </div>

              <button
                onClick={handlePlayAgain}
                className="w-full inline-flex items-center justify-center gap-2 py-4 rounded-xl font-bold font-arcade text-sm bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white shadow-xl shadow-cyan-500/25 transition transform active:scale-95"
              >
                <RotateCcw className="w-4 h-4" /> REJOUER UNE MANCHE
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Reaction Emoji Bar */}
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
