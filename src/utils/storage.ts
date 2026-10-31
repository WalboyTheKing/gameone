export interface GameRecord {
  id: string;
  gameId: 'runner' | 'shooter' | 'snake' | 'tile';
  score: number;
  date: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  icon: string;
}

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_play', title: 'Arcade Rookie', description: 'Play your first game', unlocked: false, icon: 'Gamepad2' },
  { id: 'score_100', title: 'Centurion', description: 'Score 100+ points in any game', unlocked: false, icon: 'Trophy' },
  { id: 'score_500', title: 'High Roller', description: 'Score 500+ points in any game', unlocked: false, icon: 'Flame' },
  { id: 'runner_survivor', title: 'Cyber Speedster', description: 'Survive for 200m in Cyber Runner', unlocked: false, icon: 'Zap' },
  { id: 'shooter_destroyer', title: 'Void Eliminator', description: 'Destroy 25 enemy ships in Galaxy Shooter', unlocked: false, icon: 'Target' },
  { id: 'snake_master', title: 'Neon Serpent', description: 'Reach a snake length of 15', unlocked: false, icon: 'Sparkles' },
];

export const getStorageData = () => {
  try {
    const scores = JSON.parse(localStorage.getItem('arcade_high_scores') || '{}');
    const history: GameRecord[] = JSON.parse(localStorage.getItem('arcade_game_history') || '[]');
    const achievements: Achievement[] = JSON.parse(localStorage.getItem('arcade_achievements') || 'null') || DEFAULT_ACHIEVEMENTS;
    const coins = parseInt(localStorage.getItem('arcade_coins') || '0', 10);
    return { scores, history, achievements, coins };
  } catch {
    return { scores: {}, history: [], achievements: DEFAULT_ACHIEVEMENTS, coins: 0 };
  }
};

export const saveHighScore = (gameId: 'runner' | 'shooter' | 'snake' | 'tile', score: number): boolean => {
  try {
    const { scores, history, achievements, coins } = getStorageData();
    const currentHigh = scores[gameId] || 0;
    const isNewHigh = score > currentHigh;
    
    if (isNewHigh) {
      scores[gameId] = score;
      localStorage.setItem('arcade_high_scores', JSON.stringify(scores));
    }

    const newRecord: GameRecord = {
      id: Math.random().toString(36).substring(2, 9),
      gameId,
      score,
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };
    
    const updatedHistory = [newRecord, ...history].slice(0, 30);
    localStorage.setItem('arcade_game_history', JSON.stringify(updatedHistory));

    // Award coins
    const earnedCoins = Math.floor(score / 10);
    localStorage.setItem('arcade_coins', String(coins + earnedCoins));

    // Check achievements
    let achievementUpdated = false;
    const updatedAchievements = achievements.map(ach => {
      if (ach.id === 'first_play' && !ach.unlocked) {
        achievementUpdated = true;
        return { ...ach, unlocked: true };
      }
      if (ach.id === 'score_100' && score >= 100 && !ach.unlocked) {
        achievementUpdated = true;
        return { ...ach, unlocked: true };
      }
      if (ach.id === 'score_500' && score >= 500 && !ach.unlocked) {
        achievementUpdated = true;
        return { ...ach, unlocked: true };
      }
      return ach;
    });

    if (achievementUpdated) {
      localStorage.setItem('arcade_achievements', JSON.stringify(updatedAchievements));
    }

    return isNewHigh;
  } catch {
    return false;
  }
};

export const unlockAchievement = (id: string) => {
  try {
    const { achievements } = getStorageData();
    const updated = achievements.map(ach => ach.id === id ? { ...ach, unlocked: true } : ach);
    localStorage.setItem('arcade_achievements', JSON.stringify(updated));
  } catch {
    // ignore
  }
};
