import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Volume2, VolumeX, Undo2, Award, Play, Sparkles } from 'lucide-react';
import { sounds } from '../../utils/audio';
import { saveHighScore, unlockAchievement } from '../../utils/storage';

interface QuantumFusionProps {
  onBack: () => void;
  highScore: number;
  onNewHighScore: (score: number) => void;
}

type Board = number[][];

const SIZE = 4;

const TILE_COLORS: Record<number, { bg: string; text?: string; shadow?: string }> = {
  2: { bg: 'bg-slate-800 text-slate-100' },
  4: { bg: 'bg-indigo-900/80 text-indigo-100' },
  8: { bg: 'bg-cyan-900/90 text-cyan-100 shadow-sm shadow-cyan-500/20' },
  16: { bg: 'bg-teal-800 text-teal-100 shadow-sm shadow-teal-500/30' },
  32: { bg: 'bg-emerald-700 text-emerald-100 shadow-md shadow-emerald-500/40' },
  64: { bg: 'bg-amber-700 text-amber-100 shadow-md shadow-amber-500/50' },
  128: { bg: 'bg-orange-600 text-white shadow-lg shadow-orange-500/60' },
  256: { bg: 'bg-rose-600 text-white shadow-lg shadow-rose-500/70 font-extrabold' },
  512: { bg: 'bg-purple-600 text-white shadow-xl shadow-purple-500/80 font-extrabold' },
  1024: { bg: 'bg-fuchsia-600 text-white shadow-xl shadow-fuchsia-500/90 font-extrabold' },
  2048: { bg: 'bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 shadow-2xl shadow-yellow-400 font-extrabold animate-pulse' },
};

export const QuantumFusion: React.FC<QuantumFusionProps> = ({ onBack, highScore, onNewHighScore }) => {
  const [board, setBoard] = useState<Board>(() => createEmptyBoard());
  const [history, setHistory] = useState<{ board: Board; score: number } | null>(null);
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [isMuted, setIsMuted] = useState(sounds.getMuted());

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  function createEmptyBoard(): Board {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function addRandomTile(currentBoard: Board): Board {
    const emptyCells: { r: number; c: number }[] = [];
    currentBoard.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val === 0) emptyCells.push({ r, c });
      });
    });

    if (emptyCells.length === 0) return currentBoard;

    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const newBoard = currentBoard.map(row => [...row]);
    newBoard[r][c] = Math.random() < 0.9 ? 2 : 4;
    return newBoard;
  }

  const handleMuteToggle = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  const startGame = () => {
    let newBoard = createEmptyBoard();
    newBoard = addRandomTile(newBoard);
    newBoard = addRandomTile(newBoard);
    setBoard(newBoard);
    setScore(0);
    setHistory(null);
    setIsGameOver(false);
    setHasWon(false);
    setIsPlaying(true);
    sounds.playPowerUp();
  };

  const undoMove = () => {
    if (history) {
      setBoard(history.board);
      setScore(history.score);
      setHistory(null);
      setIsGameOver(false);
    }
  };

  const move = useCallback(
    (direction: 'left' | 'right' | 'up' | 'down') => {
      if (!isPlaying || isGameOver) return;

      let moved = false;
      let pointsEarned = 0;
      const currentCopy = board.map(r => [...r]);

      function slide(row: number[]): { row: number[]; points: number } {
        let arr = row.filter(val => val !== 0);
        let pts = 0;
        for (let i = 0; i < arr.length - 1; i++) {
          if (arr[i] === arr[i + 1]) {
            arr[i] *= 2;
            pts += arr[i];
            arr[i + 1] = 0;
            if (arr[i] === 2048) {
              setHasWon(true);
              confetti({ particleCount: 100, spread: 80 });
            }
          }
        }
        arr = arr.filter(val => val !== 0);
        while (arr.length < SIZE) {
          arr.push(0);
        }
        return { row: arr, points: pts };
      }

      const newBoard = createEmptyBoard();

      if (direction === 'left') {
        for (let r = 0; r < SIZE; r++) {
          const { row, points } = slide(board[r]);
          newBoard[r] = row;
          pointsEarned += points;
        }
      } else if (direction === 'right') {
        for (let r = 0; r < SIZE; r++) {
          const reversed = [...board[r]].reverse();
          const { row, points } = slide(reversed);
          newBoard[r] = row.reverse();
          pointsEarned += points;
        }
      } else if (direction === 'up') {
        for (let c = 0; c < SIZE; c++) {
          const col = [board[0][c], board[1][c], board[2][c], board[3][c]];
          const { row, points } = slide(col);
          for (let r = 0; r < SIZE; r++) newBoard[r][c] = row[r];
          pointsEarned += points;
        }
      } else if (direction === 'down') {
        for (let c = 0; c < SIZE; c++) {
          const col = [board[3][c], board[2][c], board[1][c], board[0][c]];
          const { row, points } = slide(col);
          for (let r = 0; r < SIZE; r++) newBoard[3 - r][c] = row[r];
          pointsEarned += points;
        }
      }

      // Check if board actually changed
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (board[r][c] !== newBoard[r][c]) {
            moved = true;
            break;
          }
        }
      }

      if (moved) {
        setHistory({ board: currentCopy, score });
        const updatedBoard = addRandomTile(newBoard);
        setBoard(updatedBoard);

        const newScore = score + pointsEarned;
        setScore(newScore);

        if (pointsEarned > 0) {
          sounds.playCoin();
        }

        // Check game over
        if (checkGameOver(updatedBoard)) {
          setIsGameOver(true);
          sounds.playGameOver();
          const isNewHigh = saveHighScore('tile', newScore);
          if (isNewHigh) {
            onNewHighScore(newScore);
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          }
        }
      }
    },
    [isPlaying, isGameOver, board, score, onNewHighScore]
  );

  function checkGameOver(b: Board): boolean {
    // Check for empty cells
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (b[r][c] === 0) return false;
      }
    }
    // Check horizontal merges
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE - 1; c++) {
        if (b[r][c] === b[r][c + 1]) return false;
      }
    }
    // Check vertical merges
    for (let c = 0; c < SIZE; c++) {
      for (let r = 0; r < SIZE - 1; r++) {
        if (b[r][c] === b[r + 1][c]) return false;
      }
    }
    return true;
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault();
        move('left');
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        move('right');
      } else if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        move('up');
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        move('down');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move]);

  // Touch swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 30) {
        move(dx > 0 ? 'right' : 'left');
      }
    } else {
      if (Math.abs(dy) > 30) {
        move(dy > 0 ? 'down' : 'up');
      }
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto p-3 sm:p-6 select-none">
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
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Score</span>
            <span className="text-lg sm:text-xl font-bold font-arcade text-indigo-400">{score}</span>
          </div>
          <div className="text-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Best</span>
            <span className="text-lg sm:text-xl font-bold font-arcade text-amber-400">{highScore}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {history && (
            <button
              onClick={undoMove}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Undo Move"
            >
              <Undo2 className="w-4 h-4 text-cyan-400" />
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

      {/* 2048 Grid Board */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full aspect-square rounded-2xl p-3 bg-slate-900 border-2 border-indigo-500/30 shadow-2xl flex flex-col justify-between"
      >
        <div className="w-full h-full grid grid-cols-4 grid-rows-4 gap-2.5">
          {board.map((row, r) =>
            row.map((val, c) => {
              const tile = TILE_COLORS[val] || { bg: 'bg-slate-800/40 text-transparent' };
              return (
                <div
                  key={`${r}-${c}`}
                  className={`flex items-center justify-center rounded-xl font-arcade text-xl sm:text-2xl font-bold transition-all duration-150 ${
                    val === 0 ? 'bg-slate-950/70' : tile.bg
                  }`}
                >
                  {val > 0 && <span>{val}</span>}
                </div>
              );
            })
          )}
        </div>

        {/* Start / Game Over Overlay */}
        {(!isPlaying || isGameOver) && (
          <div className="absolute inset-2 rounded-xl bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            {isGameOver ? (
              <div className="space-y-4 max-w-xs">
                <div className="inline-flex p-3 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400">
                  <Award className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-extrabold font-arcade text-white tracking-wider">NO MOVES REMAINING</h3>
                <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800">
                  <span className="text-xs text-slate-400">Final Score</span>
                  <p className="text-2xl font-bold text-indigo-400">{score}</p>
                </div>
                <button
                  onClick={startGame}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold font-arcade text-base bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30 transition transform active:scale-95"
                >
                  <RotateCcw className="w-5 h-5" /> TRY AGAIN
                </button>
              </div>
            ) : (
              <div className="space-y-4 max-w-xs">
                <div className="inline-flex p-3 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-400">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-3xl font-extrabold font-arcade text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-300 tracking-wider">
                  QUANTUM FUSION
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Swipe or use arrow keys to slide and fuse matching energy tiles together. Reach the 2048 core!
                </p>
                <button
                  onClick={startGame}
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold font-arcade text-base bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30 transition transform active:scale-95"
                >
                  <Play className="w-5 h-5 fill-current" /> INITIALIZE FUSION
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 text-center text-xs text-slate-500">
        Swipe on screen or use keyboard arrows (W, A, S, D) to slide tiles
      </div>
    </div>
  );
};
