import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Volume2, VolumeX, Shield, Award, Play, Crosshair } from 'lucide-react';
import { sounds } from '../../utils/audio';
import { saveHighScore, unlockAchievement } from '../../utils/storage';

interface SpaceDefenderProps {
  onBack: () => void;
  highScore: number;
  onNewHighScore: (score: number) => void;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isEnemy?: boolean;
}

interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  type: 'scout' | 'asteroid' | 'cruiser';
  width: number;
  height: number;
}

interface Drop {
  x: number;
  y: number;
  type: 'triple' | 'shield';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

export const SpaceDefender: React.FC<SpaceDefenderProps> = ({ onBack, highScore, onNewHighScore }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(3);
  const [wave, setWave] = useState(1);
  const [isMuted, setIsMuted] = useState(sounds.getMuted());
  const [tripleShotTimer, setTripleShotTimer] = useState(0);

  const stateRef = useRef({
    playerX: 300,
    playerY: 420,
    bullets: [] as Bullet[],
    enemies: [] as Enemy[],
    drops: [] as Drop[],
    particles: [] as Particle[],
    stars: [] as { x: number; y: number; speed: number; size: number }[],
    keys: { left: false, right: false, up: false, down: false, fire: false },
    score: 0,
    health: 3,
    wave: 1,
    enemiesKilled: 0,
    lastShot: 0,
    tripleShotUntil: 0,
    running: false,
    frame: 0,
  });

  const handleMuteToggle = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  const startGame = () => {
    const s = stateRef.current;
    s.playerX = 300;
    s.playerY = 420;
    s.bullets = [];
    s.enemies = [];
    s.drops = [];
    s.particles = [];
    s.score = 0;
    s.health = 3;
    s.wave = 1;
    s.enemiesKilled = 0;
    s.lastShot = 0;
    s.tripleShotUntil = 0;
    s.running = true;
    s.frame = 0;

    // Generate stars
    s.stars = [];
    for (let i = 0; i < 70; i++) {
      s.stars.push({
        x: Math.random() * 600,
        y: Math.random() * 500,
        speed: 0.5 + Math.random() * 2,
        size: Math.random() > 0.8 ? 2 : 1,
      });
    }

    setScore(0);
    setHealth(3);
    setWave(1);
    setTripleShotTimer(0);
    setIsGameOver(false);
    setIsPlaying(true);
    sounds.playPowerUp();
  };

  const fireLaser = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;
    const now = Date.now();
    if (now - s.lastShot < 160) return; // rate limit
    s.lastShot = now;

    const isTriple = now < s.tripleShotUntil;
    if (isTriple) {
      s.bullets.push({ x: s.playerX - 12, y: s.playerY, vx: -1.2, vy: -10 });
      s.bullets.push({ x: s.playerX, y: s.playerY - 8, vx: 0, vy: -11 });
      s.bullets.push({ x: s.playerX + 12, y: s.playerY, vx: 1.2, vy: -10 });
    } else {
      s.bullets.push({ x: s.playerX - 8, y: s.playerY, vx: 0, vy: -10 });
      s.bullets.push({ x: s.playerX + 8, y: s.playerY, vx: 0, vy: -10 });
    }
    sounds.playLaser();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keys = stateRef.current.keys;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = true;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!stateRef.current.running && !isGameOver) {
          startGame();
        } else {
          keys.fire = true;
          fireLaser();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keys = stateRef.current.keys;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
      if (e.code === 'Space') keys.fire = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [fireLaser, isGameOver]);

  // Touch and mouse handling
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!stateRef.current.running) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    stateRef.current.playerX = Math.max(25, Math.min(canvas.width - 25, x));
    stateRef.current.playerY = Math.max(100, Math.min(canvas.height - 25, y));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const s = stateRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // Clear Canvas
      ctx.fillStyle = '#05070e';
      ctx.fillRect(0, 0, width, height);

      // Starfield
      ctx.fillStyle = '#ffffff';
      s.stars.forEach(star => {
        star.y += star.speed;
        if (star.y > height) {
          star.y = 0;
          star.x = Math.random() * width;
        }
        ctx.fillRect(star.x, star.y, star.size, star.size);
      });

      if (s.running) {
        s.frame++;

        // Keyboard movement
        const speed = 6;
        if (s.keys.left) s.playerX = Math.max(25, s.playerX - speed);
        if (s.keys.right) s.playerX = Math.min(width - 25, s.playerX + speed);
        if (s.keys.up) s.playerY = Math.max(100, s.playerY - speed);
        if (s.keys.down) s.playerY = Math.min(height - 25, s.playerY + speed);
        if (s.keys.fire && s.frame % 10 === 0) fireLaser();

        // Triple shot timer
        if (s.tripleShotUntil > Date.now()) {
          setTripleShotTimer(Math.ceil((s.tripleShotUntil - Date.now()) / 1000));
        } else {
          setTripleShotTimer(0);
        }

        // Spawn enemies
        const spawnInterval = Math.max(35, 75 - s.wave * 4);
        if (s.frame % spawnInterval === 0) {
          const rand = Math.random();
          if (rand > 0.8 && s.wave >= 2) {
            // Cruiser
            s.enemies.push({
              x: 50 + Math.random() * (width - 100),
              y: -40,
              vx: (Math.random() - 0.5) * 1.5,
              vy: 1.5,
              hp: 5,
              maxHp: 5,
              type: 'cruiser',
              width: 44,
              height: 38,
            });
          } else if (rand > 0.45) {
            // Scout
            s.enemies.push({
              x: 30 + Math.random() * (width - 60),
              y: -30,
              vx: (Math.random() - 0.5) * 2.5,
              vy: 2.8,
              hp: 2,
              maxHp: 2,
              type: 'scout',
              width: 28,
              height: 26,
            });
          } else {
            // Asteroid
            s.enemies.push({
              x: 30 + Math.random() * (width - 60),
              y: -30,
              vx: (Math.random() - 0.5) * 1.2,
              vy: 2.0,
              hp: 3,
              maxHp: 3,
              type: 'asteroid',
              width: 32,
              height: 32,
            });
          }
        }

        // Enemy firing
        if (s.frame % 90 === 0) {
          s.enemies.forEach(en => {
            if (en.type === 'cruiser' && en.y > 20 && en.y < height - 100) {
              s.bullets.push({
                x: en.x,
                y: en.y + 15,
                vx: 0,
                vy: 5,
                isEnemy: true,
              });
            }
          });
        }

        // Update Bullets
        for (let i = s.bullets.length - 1; i >= 0; i--) {
          const b = s.bullets[i];
          b.x += b.vx;
          b.y += b.vy;

          if (b.y < -20 || b.y > height + 20) {
            s.bullets.splice(i, 1);
            continue;
          }

          // Enemy bullet hit player
          if (b.isEnemy) {
            const dist = Math.hypot(b.x - s.playerX, b.y - s.playerY);
            if (dist < 20) {
              s.bullets.splice(i, 1);
              s.health -= 1;
              setHealth(s.health);
              sounds.playHit();
              if (s.health <= 0) {
                // Game over
                handleDeath();
              }
            }
          }
        }

        // Update Drops
        for (let i = s.drops.length - 1; i >= 0; i--) {
          const d = s.drops[i];
          d.y += 2.2;
          if (d.y > height + 20) {
            s.drops.splice(i, 1);
            continue;
          }
          if (Math.hypot(d.x - s.playerX, d.y - s.playerY) < 28) {
            if (d.type === 'triple') {
              s.tripleShotUntil = Date.now() + 8000;
              sounds.playPowerUp();
            } else if (d.type === 'shield') {
              s.health = Math.min(4, s.health + 1);
              setHealth(s.health);
              sounds.playPowerUp();
            }
            s.drops.splice(i, 1);
          }
        }

        // Update Enemies & Collisions
        for (let i = s.enemies.length - 1; i >= 0; i--) {
          const en = s.enemies[i];
          en.x += en.vx;
          en.y += en.vy;

          // Screen bounce
          if (en.x < 20 || en.x > width - 20) en.vx *= -1;

          // Out of screen
          if (en.y > height + 40) {
            s.enemies.splice(i, 1);
            continue;
          }

          // Check hit with player bullets
          for (let bIdx = s.bullets.length - 1; bIdx >= 0; bIdx--) {
            const b = s.bullets[bIdx];
            if (b.isEnemy) continue;

            if (
              b.x > en.x - en.width / 2 &&
              b.x < en.x + en.width / 2 &&
              b.y > en.y - en.height / 2 &&
              b.y < en.y + en.height / 2
            ) {
              s.bullets.splice(bIdx, 1);
              en.hp -= 1;

              // Spark particles
              for (let p = 0; p < 4; p++) {
                s.particles.push({
                  x: b.x,
                  y: b.y,
                  vx: (Math.random() - 0.5) * 4,
                  vy: (Math.random() - 0.5) * 4,
                  life: 0.8,
                  color: '#38bdf8',
                });
              }

              if (en.hp <= 0) {
                // Enemy destroyed
                sounds.playHit();
                const pts = en.type === 'cruiser' ? 60 : en.type === 'scout' ? 30 : 15;
                s.score += pts;
                s.enemiesKilled++;
                setScore(s.score);

                // Chance to drop powerup
                if (Math.random() > 0.75) {
                  s.drops.push({
                    x: en.x,
                    y: en.y,
                    type: Math.random() > 0.5 ? 'triple' : 'shield',
                  });
                }

                // Explosion particles
                for (let p = 0; p < 16; p++) {
                  s.particles.push({
                    x: en.x,
                    y: en.y,
                    vx: (Math.random() - 0.5) * 7,
                    vy: (Math.random() - 0.5) * 7,
                    life: 1.0,
                    color: en.type === 'cruiser' ? '#ec4899' : '#eab308',
                  });
                }

                s.enemies.splice(i, 1);

                if (s.enemiesKilled >= 25) {
                  unlockAchievement('shooter_destroyer');
                }

                if (s.enemiesKilled % 15 === 0) {
                  s.wave++;
                  setWave(s.wave);
                  sounds.playCoin();
                }
                break;
              }
            }
          }

          // Enemy collide with player
          if (Math.hypot(en.x - s.playerX, en.y - s.playerY) < 26) {
            s.health--;
            setHealth(s.health);
            sounds.playHit();
            s.enemies.splice(i, 1);
            if (s.health <= 0) {
              handleDeath();
            }
          }
        }
      }

      function handleDeath() {
        s.running = false;
        setIsPlaying(false);
        setIsGameOver(true);
        sounds.playGameOver();
        const isNewHigh = saveHighScore('shooter', s.score);
        if (isNewHigh) {
          onNewHighScore(s.score);
          confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
        }
      }

      // Render Drops
      s.drops.forEach(d => {
        ctx.fillStyle = d.type === 'triple' ? '#f59e0b' : '#06b6d4';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Render Bullets
      s.bullets.forEach(b => {
        ctx.fillStyle = b.isEnemy ? '#ef4444' : '#38bdf8';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.fillRect(b.x - 2, b.y - 6, 4, 12);
        ctx.shadowBlur = 0;
      });

      // Render Particles
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
        ctx.fillRect(p.x, p.y, 3, 3);
        ctx.globalAlpha = 1.0;
      }

      // Render Enemies
      s.enemies.forEach(en => {
        ctx.save();
        ctx.translate(en.x, en.y);

        if (en.type === 'cruiser') {
          // Boss Cruiser
          ctx.fillStyle = '#9333ea';
          ctx.beginPath();
          ctx.moveTo(0, 18);
          ctx.lineTo(-22, -18);
          ctx.lineTo(22, -18);
          ctx.closePath();
          ctx.fill();
          // Engine glow
          ctx.fillStyle = '#ec4899';
          ctx.fillRect(-8, -20, 16, 4);
        } else if (en.type === 'scout') {
          // Fast Scout
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(0, 13);
          ctx.lineTo(-14, -13);
          ctx.lineTo(14, -13);
          ctx.closePath();
          ctx.fill();
        } else {
          // Asteroid
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, Math.PI * 2);
          ctx.fill();
        }

        // Mini HP Bar
        if (en.maxHp > 1) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(-15, -24, 30, 4);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(-15, -24, (en.hp / en.maxHp) * 30, 4);
        }

        ctx.restore();
      });

      // Render Player Ship
      const px = s.playerX;
      const py = s.playerY;

      ctx.save();
      ctx.translate(px, py);

      // Jet exhaust flame
      ctx.fillStyle = Math.random() > 0.5 ? '#f97316' : '#eab308';
      ctx.beginPath();
      ctx.moveTo(-6, 14);
      ctx.lineTo(6, 14);
      ctx.lineTo(0, 24 + Math.random() * 8);
      ctx.closePath();
      ctx.fill();

      // Ship hull
      ctx.fillStyle = '#3b82f6';
      ctx.shadowColor = '#60a5fa';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(16, 14);
      ctx.lineTo(0, 8);
      ctx.lineTo(-16, 14);
      ctx.closePath();
      ctx.fill();

      // Cockpit canopy
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(0, -3, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [fireLaser, onNewHighScore]);

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
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Shields</span>
            <div className="flex gap-1 justify-center mt-1">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-sm transition ${
                    i < health ? 'bg-cyan-400 shadow-sm shadow-cyan-400' : 'bg-slate-700/50'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="text-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Wave</span>
            <span className="text-lg sm:text-xl font-bold font-arcade text-amber-400">{wave}</span>
          </div>
          <div className="text-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Score</span>
            <span className="text-lg sm:text-xl font-bold font-arcade text-indigo-400">{score}</span>
          </div>
          <div className="text-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Best</span>
            <span className="text-lg sm:text-xl font-bold font-arcade text-emerald-400">{highScore}</span>
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
      <div className="relative w-full rounded-2xl overflow-hidden border-2 border-cyan-500/30 shadow-2xl bg-black">
        <canvas
          ref={canvasRef}
          width={600}
          height={480}
          onPointerMove={handlePointerMove}
          onPointerDown={() => {
            if (isPlaying) fireLaser();
          }}
          className="w-full h-auto block aspect-[600/480] max-h-[520px] cursor-crosshair touch-none"
        />

        {/* Buff Timer */}
        {tripleShotTimer > 0 && (
          <div className="absolute top-4 left-4 bg-amber-500/20 border border-amber-500/40 text-amber-300 px-3 py-1 rounded-full text-xs font-bold font-arcade animate-pulse flex items-center gap-1.5 pointer-events-none">
            <Crosshair className="w-3.5 h-3.5" /> TRIPLE CANNON: {tripleShotTimer}s
          </div>
        )}

        {/* Start / Game Over Overlay */}
        {(!isPlaying || isGameOver) && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            {isGameOver ? (
              <div className="space-y-4 max-w-sm">
                <div className="inline-flex p-3 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400">
                  <Award className="w-8 h-8" />
                </div>
                <h3 className="text-3xl font-extrabold font-arcade text-white tracking-wider">HULL BREACHED</h3>
                <div className="grid grid-cols-2 gap-3 py-2 bg-slate-900/90 rounded-xl p-3 border border-slate-800">
                  <div>
                    <span className="text-xs text-slate-400">Sector Wave</span>
                    <p className="text-lg font-bold text-amber-400">{wave}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Final Score</span>
                    <p className="text-lg font-bold text-cyan-400">{score}</p>
                  </div>
                </div>
                <button
                  onClick={startGame}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold font-arcade text-base bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white shadow-lg shadow-cyan-500/30 transition transform active:scale-95"
                >
                  <RotateCcw className="w-5 h-5" /> RE-ENGAGE
                </button>
              </div>
            ) : (
              <div className="space-y-4 max-w-md">
                <div className="inline-flex p-3 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
                  <Shield className="w-8 h-8" />
                </div>
                <h3 className="text-3xl sm:text-4xl font-extrabold font-arcade text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 tracking-wider">
                  GALAXY DEFENDER
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Defend the sector against alien drones, heavy cruisers, and asteroidal debris. Drag to steer & tap/press Space to blast.
                </p>
                <div className="flex items-center justify-center gap-3 text-xs text-slate-400">
                  <span className="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700">A/D / Arrows: Steer</span>
                  <span className="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700">Mouse/Touch Drag</span>
                  <span className="bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700">SPACE: Fire</span>
                </div>
                <button
                  onClick={startGame}
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold font-arcade text-base bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-cyan-500/30 transition transform active:scale-95"
                >
                  <Play className="w-5 h-5 fill-current" /> DEPLOY STARFIGHTER
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Touch fire button */}
      <div className="flex w-full items-center justify-center gap-4 mt-4 select-none sm:hidden">
        <button
          onClick={fireLaser}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 active:from-blue-700 active:to-cyan-600 text-white font-bold font-arcade text-base shadow-lg shadow-cyan-500/30 transition"
        >
          FIRE PLASMA CANNON
        </button>
      </div>
    </div>
  );
};
