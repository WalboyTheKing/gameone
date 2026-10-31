export interface GlobalLeaderboardPlayer {
  username: string;
  avatar: string;
  wins: number;
  matches: number;
  goals: number;
  winrate: number;
  lastActive: string;
}

export interface MatchHistoryLog {
  id: string;
  gameType: 'hockey' | 'pong';
  p1: string;
  p2: string;
  score1: number;
  score2: number;
  winner: string;
  time: string;
}

export const fetchGlobalLeaderboard = async (): Promise<GlobalLeaderboardPlayer[]> => {
  try {
    const res = await fetch('/api/leaderboard');
    if (!res.ok) return [];
    const data = await res.json();
    return data.leaderboard || [];
  } catch {
    return [];
  }
};

export const fetchRecentMatches = async (): Promise<MatchHistoryLog[]> => {
  try {
    const res = await fetch('/api/matches');
    if (!res.ok) return [];
    const data = await res.json();
    return data.matches || [];
  } catch {
    return [];
  }
};

export const getDirectRoomLink = (roomId: string): string => {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.set('join', roomId);
  return url.toString();
};
