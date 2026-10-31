import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Volume2, VolumeX, Award, Play, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Zap, Sparkles } from 'lucide-react';
import { sounds } from '../../utils/audio';
import { saveHighScore, unlockAchievement } from '../../utils/storage';

interface NeonSnakeProps {
  onBack: () => void;
  highScore: number;
  onNewHighScore: (score: number) => void;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
interface Point {
  x: number;
  y: number;
}
interface FoodItem {
  x: number;
  y: number;
  type: 'regular' | 'golden' | 'ghost';
  expiresAt?: number;
}

const GRID_SIZE = 20;

export const NeonSnake: React.FC<NeonSnakeProps> = ({ onBack, highScore, onNewHighScore }) => {
  const [snake, setSnake] = useState<Point[]>([
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]);
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [food, setFood] = useState<FoodItem>({ x: 15, y: 10, type: 'regular' });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isGhost, setIsGhost] = useState(false);
  const [ghostTimer, setGhostTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(sounds.getMuted());

  const dirRef = useRef<Direction>('RIGHT');
  const nextDirRef = useRef<Direction>('RIGHT');
  const ghostUntilRef = useRef<number>(0);
  const snakeRef = useRef<Point[]>(snake);
  snakeRef.current = snake;

  const handleMuteToggle = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  const spawnFood = useCallback((currentSnake: Point[]): FoodItem => {
    let newX = Math.floor(Math.random() * GRID_SIZE);
    let newY = Math.floor(Math.random() * GRID_SIZE);

    while (currentSnake.some(p => p.x === newX && p.y === newY)) {
      newX = Math.floor(Math.random() * GRID_SIZE);
      newY = Math.floor(Math.random() * GRID_SIZE);
    }

    const rand = Math.random();
    let type: FoodItem['type'] = 'regular';
    if (rand > 0.85) type = 'golden';
    else if (rand > 0.72) type = 'ghost';

    return { x: newX, y: newY, type };
  }, []);

  const startGame = () => {
    const initialSnake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    setSnake(initialSnake);
    dirRef.current = 'RIGHT';
    nextDirRef.current = 'RIGHT';
    setDirection('RIGHT');
    setFood(spawnFood(initialSnake));
    setScore(0);
    setIsGhost(false);
    ghostUntilRef.current = 0;
    setIsGameOver(false);
    setIsPlaying(true);
    sounds.playPowerUp();
  };

  const changeDirection = useCallback((newDir: Direction) => {
    const current = dirRef.current;
    if (newDir === 'UP' && current !== 'DOWN') nextDirRef.current = 'UP';
    if (newDir === 'DOWN' && current !== 'UP') nextDirRef.current = 'DOWN';
    if (newDir === 'LEFT' && current !== 'RIGHT') nextDirRef.current = 'LEFT';
    if (newDir === 'RIGHT' && current !== 'LEFT') nextDirRef.current = 'RIGHT';
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        changeDirection('UP');
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        changeDirection('DOWN');
      } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault();
        changeDirection('LEFT');
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        changeDirection('RIGHT');
      } else if (e.code === 'Space' && !isPlaying && !isGameOver) {
        e.preventDefault();
        startGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeDirection, isPlaying, isGameOver]);

  // Game loop
  useEffect(() => {
    if (!isPlaying || isGameOver) return;

    const speed = Math.max(75, 130 - Math.floor(score / 50) * 5);

    const interval = setInterval(() => {
      const currentSnake = [...snakeRef.current];
      const head = { ...currentSnake[0] };
      const dir = nextDirRef.current;
      dirRef.current = dir;
      setDirection(dir);

      if (dir === 'UP') head.y -= 1;
      if (dir === 'DOWN') head.y += 1;
      if (dir === 'LEFT') head.x -= 1;
      if (dir === 'RIGHT') head.x += 1;

      const now = Date.now();
      const ghostActive = now < ghostUntilRef.current;
      setIsGhost(ghostActive);
      setGhostTimer(ghostActive ? Math.ceil((ghostUntilRef.current - now) / 1000) : 0);

      // Wall collision or wrap
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        if (ghostActive) {
          head.x = (head.x + GRID_SIZE) % GRID_SIZE;
          head.y = (head.y + GRID_SIZE) % GRID_SIZE;
        } else {
          // Die
          handleGameOver();
          return;
        }
      }

      // Self collision
      if (currentSnake.some(seg => seg.x === head.x && seg.y === head.y)) {
        if (!ghostActive) {
          handleGameOver();
          return;
        }
      }

      // Eat Food
      const newSnake = [head, ...currentSnake];
      if (head.x === food.x && head.y === food.y) {
        let earned = 10;
        if (food.type === 'golden') {
          earned = 35;
          sounds.playPowerUp();
        } else if (food.type === 'ghost') {
          ghostUntilRef.current = Date.now() + 6000;
          setIsGhost(true);
          sounds.playPowerUp();
        } else {
          sounds.playCoin();
        }

        const newScore = score + earned;
        setScore(newScore);

        if (newSnake.length >= 15) {
          unlockAchievement('snake_master');
        }

        setFood(spawnFood(newSnake));
      } else {
        newSnake.pop();
      }

      setSnake(newSnake);
    }, speed);

    function handleGameOver() {
      setIsPlaying(false);
      setIsGameOver(true);
      sounds.playGameOver();
      const isNewHigh = saveHighScore('snake', score);
      if (isNewHigh) {
        onNewHighScore(score);
        confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
      }
    }

    return () => clearInterval(interval);
  }, [isPlaying, isGameOver, food, score, spawnFood, onNewHighScore]);

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto p-3 sm:p-6">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between mb-4 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl px-4 py-3 shadow-xl">
        <button
          onClick={onBack}
          className="text-xs sm:text-sm font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 transition"
        >
          ← Main Arcade
        </button>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Length</span>
            <span className="text-lg sm:text-xl font-bold font-arcade text-emerald-400">{snake.length}</span>
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

      {/* Snake Grid Board */}
      <div className="relative w-full max-w-[420px] aspect-square rounded-2xl p-2 bg-slate-950 border-2 border-emerald-500/30 shadow-2xl">
        {/* Buff pill */}
        {isGhost && (
          <div className="absolute top-4 left-4 z-20 bg-purple-500/20 border border-purple-500/40 text-purple-300 px-3 py-1 rounded-full text-xs font-bold font-arcade animate-pulse flex items-center gap-1.5 pointer-events-none">
            <Zap className="w-3.5 h-3.5" /> GHOST MODE: {ghostTimer}s
          </div>
        )}

        <div className="w-full h-full grid grid-cols-20 grid-rows-20 gap-0.5 bg-slate-900/60 rounded-xl overflow-hidden p-1">
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
            const x = idx % GRID_SIZE;
            const y = Math.floor(idx / GRID_SIZE);

            const isHead = snake[0]?.x === x && snake[0]?.y === y;
            const bodyIdx = snake.findIndex((s, i) => i > 0 && s.x === x && s.y === y);
            const isBody = bodyIdx !== -1;
            const isFood = food.x === x && food.y === y;

            let cellClass = 'bg-slate-900/20 rounded-xs transition-colors duration-75';

            if (isHead) {
              cellClass = isGhost
                ? 'bg-purple-400 shadow-md shadow-purple-400 rounded-sm'
                : 'bg-emerald-400 shadow-md shadow-emerald-400 rounded-sm';
            } else if (isBody) {
              const alpha = Math.max(0.35, 1 - bodyIdx * 0.04);
              cellClass = isGhost
                ? 'bg-purple-500/80 rounded-xs'
                : `bg-emerald-500 rounded-xs opacity-[${alpha}]`;
            } else if (isFood) {
              if (food.type === 'golden') {
                cellClass = 'bg-amber-400 shadow-lg shadow-amber-400 rounded-full animate-bounce';
              } else if (food.type === 'ghost') {
                cellClass = 'bg-purple-400 shadow-lg shadow-purple-400 rounded-full animate-pulse';
              } else {
                cellClass = 'bg-rose-500 shadow-md shadow-rose-500 rounded-full';
              }
            }

            return <div key={idx} className={cellClass} />;
          })}
        </div>

        {/* Start / Game Over Overlay */}
        {(!isPlaying || isGameOver) && (
          <div className="absolute inset-2 rounded-xl bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-30">
            {isGameOver ? (
              <div className="space-y-4 max-w-xs">
                <div className="inline-flex p-3 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400">
                  <Award className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-extrabold font-arcade text-white tracking-wider">COLLISION DETECTED</h3>
                <div className="grid grid-cols-2 gap-3 py-2 bg-slate-900/90 rounded-xl p-3 border border-slate-800">
                  <div>
                    <span className="text-xs text-slate-400">Length</span>
                    <p className="text-lg font-bold text-emerald-400">{snake.length}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Score</span>
                    <p className="text-lg font-bold text-indigo-400">{score}</p>
                  </div>
                </div>
                <button
                  onClick={startGame}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold font-arcade text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/30 transition transform active:scale-95"
                >
                  <RotateCcw className="w-5 h-5" /> PLAY AGAIN
                </button>
              </div>
            ) : (
              <div className="space-y-4 max-w-xs">
                <div className="inline-flex p-3 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-3xl font-extrabold font-arcade text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300 tracking-wider">
                  NEON SNAKE
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Steer the cyber serpent to consume neon power cells. Gold items award bonus points; purple gives ghost phasing ability.
                </p>
                <button
                  onClick={startGame}
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold font-arcade text-base bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/30 transition transform active:scale-95"
                >
                  <Play className="w-5 h-5 fill-current" /> SLITHER NOW
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* On-screen D-Pad for Mobile */}
      <div className="flex flex-col items-center gap-2 mt-4 select-none">
        <button
          onClick={() => changeDirection('UP')}
          className="w-14 h-14 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 active:bg-emerald-600 active:text-white text-slate-300 shadow transition"
          aria-label="Up"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
        <div className="flex gap-4">
          <button
            onClick={() => changeDirection('LEFT')}
            className="w-14 h-14 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 active:bg-emerald-600 active:text-white text-slate-300 shadow transition"
            aria-label="Left"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => changeDirection('DOWN')}
            className="w-14 h-14 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 active:bg-emerald-600 active:text-white text-slate-300 shadow transition"
            aria-label="Down"
          >
            <ArrowDown className="w-6 h-6" />
          </button>
          <button
            onClick={() => changeDirection('RIGHT')}
            className="w-14 h-14 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 active:bg-emerald-600 active:text-white text-slate-300 shadow transition"
            aria-label="Right"
          >
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
