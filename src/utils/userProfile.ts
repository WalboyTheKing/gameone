export interface UserProfile {
  id: string;
  username: string;
  avatar: string;
  title: string;
  hasChosenNickname?: boolean;
  stats: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    goalsScored: number;
    highestStreak: number;
  };
}

const DEFAULT_AVATARS = ['⚡', '🤖', '👑', '🔥', '🚀', '🎯', '👾', '🦊', '🐯', '💎'];
const COOL_STARTER_NAMES = [
  'CyberViper',
  'NeonGhost',
  'PulseZero',
  'ShadowAce',
  'PixelTitan',
  'MatrixRider',
  'GlitchBlade',
  'AeroStrike',
];

const TITLES = [
  'Recrue Cyber',
  'Pilote d\'Élite',
  'Maître de l\'Arène',
  'Seigneur du Palet',
  'Légende Invicible',
];

export const getRandomStarterName = (): string => {
  const base = COOL_STARTER_NAMES[Math.floor(Math.random() * COOL_STARTER_NAMES.length)];
  const num = Math.floor(10 + Math.random() * 89);
  return `${base}_${num}`;
};

export const getUserProfile = (): UserProfile => {
  try {
    const saved = localStorage.getItem('arcade_user_profile');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.id) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  const initialProfile: UserProfile = {
    id: 'user_' + Math.random().toString(36).substring(2, 9),
    username: getRandomStarterName(),
    avatar: DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)],
    title: 'Recrue Cyber',
    hasChosenNickname: false,
    stats: {
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      goalsScored: 0,
      highestStreak: 0,
    },
  };

  saveUserProfile(initialProfile);
  return initialProfile;
};

export const saveUserProfile = (profile: UserProfile): void => {
  try {
    // Update title based on wins
    if (profile.stats.wins >= 20) profile.title = TITLES[4];
    else if (profile.stats.wins >= 10) profile.title = TITLES[3];
    else if (profile.stats.wins >= 5) profile.title = TITLES[2];
    else if (profile.stats.wins >= 1) profile.title = TITLES[1];
    else profile.title = TITLES[0];

    localStorage.setItem('arcade_user_profile', JSON.stringify(profile));
  } catch {
    // ignore
  }
};

export const recordMatchResult = (won: boolean, goals: number): UserProfile => {
  const profile = getUserProfile();
  profile.stats.matchesPlayed += 1;
  profile.stats.goalsScored += goals;
  if (won) {
    profile.stats.wins += 1;
  } else {
    profile.stats.losses += 1;
  }
  saveUserProfile(profile);
  return profile;
};

export { DEFAULT_AVATARS };
