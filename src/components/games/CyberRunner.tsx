import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Play, RotateCcw, Volume2, VolumeX, ArrowUp, ArrowDown, Award, Zap, Shield, Sparkles } from 'lucide-react';
import { sounds } from '../../utils/audio';
import { saveHighScore, unlockAchievement } from '../../utils/storage';

interface CyberRunnerProps {
  onBack: () => void;
  highScore: number;
  onNewHighScore: (score: number) => void;
}

interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'ground' | 'air';
  passed: boolean;
}

interface Item {
  x: number;
  y: number;
  type: 'battery' | 'shield';
  collected: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export const CyberRunner: React.FC<CyberRunnerProps> = ({ onBack, highScore, onNewHighScore }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [shieldActive, setShieldActive] = useState(false);
  const [doubleJumpAvailable, setDoubleJumpAvailable] = useState(false);
  const [isMuted, setIsMuted] = useState(sounds.getMuted());

  // Game state stored in refs for the 60fps loop
  const stateRef = useRef({
    playerY: 260,
    playerVy: 0,
    isGrounded: true,
    isSliding: false,
    jumpCount: 0,
    speed: 5.5,
    obstacles: [] as Obstacle[],
    items: [] as Item[],
    particles: [] as Particle[],
    shield: false,
    doubleJump: false,
    score: 0,
    distance: 0,
    running: false,
    groundY: 260,
    frame: 0,
  });

  const handleMuteToggle = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;

    if (s.isGrounded) {
      s.playerVy = -11.5;
      s.isGrounded = false;
      s.jumpCount = 1;
      s.isSliding = false;
      sounds.playJump();
    } else if (s.doubleJump && s.jumpCount === 1) {
      s.playerVy = -10.5;
      s.jumpCount = 2;
      s.doubleJump = false;
      setDoubleJumpAvailable(false);
      sounds.playJump();
    }
  }, []);

  const slideStart = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;
    if (s.isGrounded) {
      s.isSliding = true;
    }
  }, []);

  const slideEnd = useCallback(() => {
    const s = stateRef.current;
    s.isSliding = false;
  }, []);

  const startGame = () => {
    const s = stateRef.current;
    s.playerY = 260;
    s.playerVy = 0;
    s.isGrounded = true;
    s.isSliding = false;
    s.jumpCount = 0;
    s.speed = 5.5;
    s.obstacles = [];
    s.items = [];
    s.particles = [];
    s.shield = false;
    s.doubleJump = false;
    s.score = 0;
    s.distance = 0;
    s.running = true;
    s.frame = 0;

    setScore(0);
    setDistance(0);
    setShieldActive(false);
    setDoubleJumpAvailable(false);
    setIsGameOver(false);
    setIsPlaying(true);
    sounds.playPowerUp();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (!stateRef.current.running && !isGameOver) {
          startGame();
        } else {
          jump();
        }
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        slideStart();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        slideEnd();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [jump, slideStart, slideEnd, isGameOver]);

  // Main canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      const s = stateRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // Clear Canvas
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Cyber Grid Background
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
      ctx.lineWidth = 1;
      const gridOffset = (s.frame * (s.running ? s.speed * 0.5 : 1)) % 40;
      
      for (let x = -gridOffset; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 290);
        ctx.stroke();
      }

      // Distant neon skyscrapers
      ctx.fillStyle = '#111827';
      ctx.fillRect(80, 160, 60, 130);
      ctx.fillRect(200, 120, 80, 170);
      ctx.fillRect(360, 180, 70, 110);
      ctx.fillRect(520, 140, 90, 150);

      // Ground bar
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 290, width, height - 290);
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 290);
      ctx.lineTo(width, 290);
      ctx.stroke();

      // Glowing sub-ground line
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 294);
      ctx.lineTo(width, 294);
      ctx.stroke();

      if (s.running) {
        s.frame++;
        s.distance += Math.round(s.speed * 0.1);
        s.speed = Math.min(12, 5.5 + s.distance * 0.003);

        // Physics
        s.playerVy += 0.55; // gravity
        s.playerY += s.playerVy;

        if (s.playerY >= s.groundY) {
          s.playerY = s.groundY;
          s.playerVy = 0;
          s.isGrounded = true;
          s.jumpCount = 0;
        }

        // Spawn obstacles
        if (s.frame % Math.max(55, Math.floor(110 - s.speed * 4)) === 0) {
          const isAir = Math.random() > 0.65;
          s.obstacles.push({
            x: width + 20,
            y: isAir ? 210 : 250,
            width: isAir ? 36 : 28,
            height: isAir ? 28 : 40,
            type: isAir ? 'air' : 'ground',
            passed: false,
          });
        }

        // Spawn power-up items
        if (s.frame % 280 === 0 && Math.random() > 0.4) {
          s.items.push({
            x: width + 30,
            y: Math.random() > 0.5 ? 200 : 255,
            type: Math.random() > 0.5 ? 'shield' : 'battery',
            collected: false,
          });
        }

        // Update obstacles
        for (let i = s.obstacles.length - 1; i >= 0; i--) {
          const obs = s.obstacles[i];
          obs.x -= s.speed;

          if (!obs.passed && obs.x + obs.width < 80) {
            obs.passed = true;
            s.score += 20;
            setScore(s.score);
            sounds.playCoin();
          }

          if (obs.x < -60) {
            s.obstacles.splice(i, 1);
          }
        }

        // Update items
        for (let i = s.items.length - 1; i >= 0; i--) {
          const item = s.items[i];
          item.x -= s.speed;
          if (item.x < -60 || item.collected) {
            s.items.splice(i, 1);
          }
        }

        // Player hitbox
        const pw = s.isSliding ? 42 : 30;
        const ph = s.isSliding ? 20 : 38;
        const px = 80;
        const py = s.playerY + (s.isSliding ? 18 : 0);

        // Running trail particles
        if (s.frame % 3 === 0) {
          s.particles.push({
            x: px + (s.isSliding ? 5 : 10),
            y: py + ph - 4,
            vx: -s.speed * 0.4 + (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            life: 1.0,
            color: s.isSliding ? '#ec4899' : '#06b6d4',
          });
        }

        // Check item collection
        s.items.forEach(item => {
          if (!item.collected && Math.hypot(px + 15 - item.x, py + 15 - item.y) < 32) {
            item.collected = true;
            sounds.playPowerUp();
            if (item.type === 'shield') {
              s.shield = true;
              setShieldActive(true);
            } else {
              s.doubleJump = true;
              setDoubleJumpAvailable(true);
            }
          }
        });

        // Check collision
        for (let i = 0; i < s.obstacles.length; i++) {
          const obs = s.obstacles[i];
          const collision =
            px < obs.x + obs.width &&
            px + pw > obs.x &&
            py < obs.y + obs.height &&
            py + ph > obs.y;

          if (collision) {
            if (s.shield) {
              s.shield = false;
              setShieldActive(false);
              s.obstacles.splice(i, 1);
              sounds.playHit();
              // Explode obstacle particles
              for (let p = 0; p < 15; p++) {
                s.particles.push({
                  x: obs.x + 15,
                  y: obs.y + 15,
                  vx: (Math.random() - 0.5) * 8,
                  vy: (Math.random() - 0.5) * 8,
                  life: 1.0,
                  color: '#38bdf8',
                });
              }
              break;
            } else {
              // Game Over
              s.running = false;
              setIsPlaying(false);
              setIsGameOver(true);
              sounds.playGameOver();

              const finalScore = s.score + Math.floor(s.distance * 0.5);
              const isNewHigh = saveHighScore('runner', finalScore);
              if (isNewHigh) {
                onNewHighScore(finalScore);
                confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
              }
              if (s.distance >= 200) {
                unlockAchievement('runner_survivor');
              }
              break;
            }
          }
        }

        setDistance(s.distance);
      }

      // Draw Particles
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.04;
        if (p.life <= 0) {
          s.particles.splice(i, 1);
          continue;
        }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, 4, 4);
        ctx.globalAlpha = 1.0;
      }

      // Draw Obstacles
      s.obstacles.forEach(obs => {
        if (obs.type === 'ground') {
          // Neon Laser Pylon
          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 12;
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          // Core light
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(obs.x + 8, obs.y + 4, obs.width - 16, obs.height - 8);
          ctx.shadowBlur = 0;
        } else {
          // Floating Attack Drone
          ctx.fillStyle = '#a855f7';
          ctx.shadowColor = '#d946ef';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(obs.x + obs.width / 2, obs.y + obs.height / 2, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(obs.x + 6, obs.y + 10, obs.width - 12, 6);
          ctx.shadowBlur = 0;
        }
      });

      // Draw Items
      s.items.forEach(item => {
        if (item.collected) return;
        ctx.save();
        ctx.translate(item.x, item.y);
        if (item.type === 'shield') {
          ctx.fillStyle = '#06b6d4';
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#eab308';
          ctx.shadowColor = '#facc15';
          ctx.shadowBlur = 15;
          ctx.fillRect(-8, -8, 16, 16);
        }
        ctx.restore();
      });

      // Draw Player
      const px = 80;
      const py = s.playerY + (s.isSliding ? 18 : 0);
      const pw = s.isSliding ? 42 : 30;
      const ph = s.isSliding ? 20 : 38;

      ctx.save();
      // Shield aura
      if (s.shield) {
        ctx.strokeStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 16;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px + pw / 2, py + ph / 2, Math.max(pw, ph) * 0.8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Cyber Runner body
      ctx.fillStyle = s.isSliding ? '#ec4899' : '#6366f1';
      ctx.shadowColor = s.isSliding ? '#ec4899' : '#818cf8';
      ctx.shadowBlur = 14;
      ctx.fillRect(px, py, pw, ph);

      // Visor
      ctx.fillStyle = '#22d3ee';
      if (s.isSliding) {
        ctx.fillRect(px + pw - 12, py + 4, 10, 6);
      } else {
        ctx.fillRect(px + pw - 12, py + 8, 10, 8);
      }

      ctx.restore();

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [onNewHighScore]);

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-3 sm:p-6">
      {/* Top Bar */}
      <div className="w-full flex items-center justify-between mb-4 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl px-4 py-3 shadow-xl">
        <button
          onClick={onBack}
          className="text-xs sm:text-sm font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 transition"
        >
          ← Main Arcade
        </button>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Distance</span>
            <span className="text-lg sm:text-xl font-bold font-arcade text-cyan-400">{distance}m</span>
          </div>
          <div className="text-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Score</span>
            <span className="text-lg sm:text-xl font-bold font-arcade text-indigo-400">{score}</span>
          </div>
          <div className="text-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Best</span>
            <span className="text-lg sm:text-xl font-bold font-arcade text-amber-400">{highScore}</span>
          </div>
        </div>

        <button
          onClick={handleMuteToggle}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
          aria-label="Toggle Sound"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
        </button>
      </div>

      {/* Canvas Viewport */}
      <div className="relative w-full rounded-2xl overflow-hidden border-2 border-indigo-500/30 shadow-2xl bg-black">
        <canvas
          ref={canvasRef}
          width={760}
          height={340}
          className="w-full h-auto block aspect-[760/340] max-h-[460px]"
        />

        {/* Buff Indicators */}
        <div className="absolute top-4 left-4 flex gap-2 pointer-events-none">
          {shieldActive && (
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
              <Shield className="w-3.5 h-3.5" /> Shield
            </span>
          )}
          {doubleJumpAvailable && (
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <Zap className="w-3.5 h-3.5" /> 2x Jump
            </span>
          )}
        </div>

        {/* Start / Game Over Overlay */}
        {(!isPlaying || isGameOver) && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            {isGameOver ? (
              <div className="space-y-4 max-w-sm">
                <div className="inline-flex p-3 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400">
                  <Award className="w-8 h-8" />
                </div>
                <h3 className="text-3xl font-extrabold font-arcade text-white tracking-wider">SYSTEM CRASH</h3>
                <div className="grid grid-cols-2 gap-3 py-2 bg-slate-900/90 rounded-xl p-3 border border-slate-800">
                  <div>
                    <span className="text-xs text-slate-400">Distance</span>
                    <p className="text-lg font-bold text-cyan-400">{distance}m</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Final Score</span>
                    <p className="text-lg font-bold text-indigo-400">{score + Math.floor(distance * 0.5)}</p>
                  </div>
                </div>
                <button
                  onClick={startGame}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold font-arcade text-base bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white shadow-lg shadow-indigo-500/30 transition transform active:scale-95"
                >
                  <RotateCcw className="w-5 h-5" /> REBOOT RUNNER
                </button>
              </div>
            ) : (
              <div className="space-y-4 max-w-md">
                <div className="inline-flex p-3 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-400">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-3xl sm:text-4xl font-extrabold font-arcade text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 tracking-wider">
                  CYBER DASH
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Dodge ground pylons and airborne drones in neon cyberspace. Collect energy batteries and defensive shield matrices.
                </p>
                <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
                  <span className="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700">SPACE / UP: Jump</span>
                  <span className="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700">DOWN: Slide</span>
                </div>
                <button
                  onClick={startGame}
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold font-arcade text-base bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 text-white shadow-lg shadow-cyan-500/30 transition transform active:scale-95"
                >
                  <Play className="w-5 h-5 fill-current" /> LAUNCH RUN
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Touch Controls */}
      <div className="flex w-full items-center justify-between gap-4 mt-4 select-none sm:hidden">
        <button
          onTouchStart={slideStart}
          onTouchEnd={slideEnd}
          onMouseDown={slideStart}
          onMouseUp={slideEnd}
          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-slate-900 border border-slate-800 active:bg-slate-800 text-pink-400 font-bold font-arcade text-sm transition"
        >
          <ArrowDown className="w-5 h-5" /> SLIDE
        </button>
        <button
          onClick={jump}
          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 active:from-indigo-700 active:to-cyan-700 text-white font-bold font-arcade text-sm shadow-lg shadow-indigo-600/30 transition"
        >
          <ArrowUp className="w-5 h-5" /> JUMP
        </button>
      </div>
    </div>
  );
};
