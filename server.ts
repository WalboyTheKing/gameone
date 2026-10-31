import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const DATA_DIR = path.resolve(__dirname, 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

// API health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

// Global Multiplayer Leaderboard & Recent Matches API
app.get('/api/leaderboard', (_req, res) => {
  const list = Array.from(leaderboard.values())
    .sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : b.goals - a.goals)
    .slice(0, 20);
  res.json({ leaderboard: list });
});

app.get('/api/matches', (_req, res) => {
  res.json({ matches: recentMatches.slice(0, 20) });
});

// -------------------------------------------------------------
// REAL-TIME MULTIPLAYER ROOMS & AUTHORITATIVE PHYSICS ENGINE
// -------------------------------------------------------------

interface RoomPlayer {
  id: string;
  playerKey: string;
  username: string;
  avatar: string;
  role: 'player1' | 'player2';
  ready: boolean;
  connected: boolean;
  disconnectedAt?: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
}

interface Room {
  id: string;
  gameType: 'pong' | 'hockey';
  name: string;
  hostId: string;
  maxScore: number;
  players: Record<string, RoomPlayer>; // key is socket id
  spectators: string[];
  status: 'waiting' | 'countdown' | 'playing' | 'gameover';
  countdown: number;
  winner?: 'player1' | 'player2';
  winnerName?: string;
  score1: number;
  score2: number;
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    speed: number;
    radius: number;
  };
  lastTouch?: 'player1' | 'player2';
  lastActive: number;
}

interface LeaderboardEntry {
  username: string;
  avatar: string;
  wins: number;
  matches: number;
  goals: number;
  winrate: number;
  lastActive: string;
}

interface MatchHistoryEntry {
  id: string;
  gameType: 'hockey' | 'pong';
  p1: string;
  p2: string;
  score1: number;
  score2: number;
  winner: string;
  time: string;
}

const leaderboard: Map<string, LeaderboardEntry> = new Map();
let recentMatches: MatchHistoryEntry[] = [];

// Load persistent data from disk
function loadPersistentData() {
  try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
      const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf-8');
      const data: LeaderboardEntry[] = JSON.parse(raw);
      if (Array.isArray(data)) {
        for (const item of data) {
          leaderboard.set(item.username, item);
        }
      }
    }
  } catch (err) {
    console.error('[Persistence] Error loading leaderboard:', err);
  }

  try {
    if (fs.existsSync(MATCHES_FILE)) {
      const raw = fs.readFileSync(MATCHES_FILE, 'utf-8');
      const data: MatchHistoryEntry[] = JSON.parse(raw);
      if (Array.isArray(data)) {
        recentMatches = data;
      }
    }
  } catch (err) {
    console.error('[Persistence] Error loading matches:', err);
  }

  // If initial store is empty, seed realistic competitive records
  if (leaderboard.size === 0) {
    const seedLeaderboard: LeaderboardEntry[] = [
      { username: 'CyberPhantom', avatar: '⚡', wins: 18, matches: 21, goals: 74, winrate: 86, lastActive: 'Aujourd\'hui' },
      { username: 'NeonStriker', avatar: '👑', wins: 15, matches: 19, goals: 62, winrate: 79, lastActive: 'Aujourd\'hui' },
      { username: 'QuantumAce', avatar: '🚀', wins: 12, matches: 16, goals: 48, winrate: 75, lastActive: 'Hier' },
      { username: 'PulseViper', avatar: '🔥', wins: 9, matches: 14, goals: 39, winrate: 64, lastActive: 'Hier' },
    ];
    for (const item of seedLeaderboard) {
      leaderboard.set(item.username, item);
    }
    saveLeaderboard();
  }

  if (recentMatches.length === 0) {
    recentMatches = [
      { id: 'm1_demo', gameType: 'hockey', p1: 'CyberPhantom', p2: 'NeonStriker', score1: 5, score2: 3, winner: 'CyberPhantom', time: '14:22:10' },
      { id: 'm2_demo', gameType: 'pong', p1: 'QuantumAce', p2: 'PulseViper', score1: 5, score2: 4, winner: 'QuantumAce', time: '13:50:45' },
    ];
    saveMatches();
  }
}

function saveLeaderboard() {
  try {
    const list = Array.from(leaderboard.values());
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Persistence] Failed to write leaderboard:', err);
  }
}

function saveMatches() {
  try {
    fs.writeFileSync(MATCHES_FILE, JSON.stringify(recentMatches.slice(0, 50), null, 2), 'utf-8');
  } catch (err) {
    console.error('[Persistence] Failed to write matches:', err);
  }
}

loadPersistentData();

const rooms: Map<string, Room> = new Map();
const socketToRoom: Map<WebSocket, { roomId: string; playerId: string }> = new Map();

const TABLE_WIDTH = 800;
const TABLE_HEIGHT = 500;
const GOAL_TOP = 170;
const GOAL_BOTTOM = 330;
const RECONNECT_GRACE_MS = 30000; // 30 seconds true reconnection window

function resetPuck(room: Room, direction: 'left' | 'right' | 'random' = 'random') {
  room.ball.x = TABLE_WIDTH / 2;
  room.ball.y = TABLE_HEIGHT / 2;
  const dir = direction === 'random' ? (Math.random() > 0.5 ? 1 : -1) : direction === 'right' ? 1 : -1;
  const speed = room.gameType === 'pong' ? 5.5 : 4.5;
  const angle = (Math.random() - 0.5) * (Math.PI / 3);
  room.ball.vx = Math.cos(angle) * speed * dir;
  room.ball.vy = Math.sin(angle) * speed;
  room.ball.speed = speed;
}

function broadcastToRoom(room: Room, payload: unknown) {
  const json = JSON.stringify(payload);
  const targetIds = new Set([...Object.keys(room.players), ...room.spectators]);
  for (const [ws, info] of socketToRoom.entries()) {
    if (info.roomId === room.id && targetIds.has(info.playerId)) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(json);
      }
    }
  }
}

function broadcastRoomsList() {
  const summary = Array.from(rooms.values()).map(r => ({
    id: r.id,
    name: r.name,
    gameType: r.gameType,
    playerCount: Object.values(r.players).filter(p => p.connected).length,
    status: r.status,
    score1: r.score1,
    score2: r.score2,
    player1: Object.values(r.players).find(p => p.role === 'player1')?.username || 'Empty',
    player2: Object.values(r.players).find(p => p.role === 'player2')?.username || 'Waiting...',
  }));

  const json = JSON.stringify({ type: 'rooms_list', rooms: summary });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

// Global Authoritative 60 FPS Physics Simulation Loop
setInterval(() => {
  const now = Date.now();

  for (const [roomId, room] of rooms.entries()) {
    // Auto cleanup stale rooms inactive for > 15 minutes
    if (now - room.lastActive > 15 * 60 * 1000) {
      rooms.delete(roomId);
      broadcastRoomsList();
      continue;
    }

    if (room.status === 'countdown') {
      room.countdown -= 1 / 60;
      if (room.countdown <= 0) {
        room.status = 'playing';
        resetPuck(room, 'random');
        broadcastToRoom(room, { type: 'game_started', room });
      } else {
        broadcastToRoom(room, {
          type: 'countdown_tick',
          countdown: Math.ceil(room.countdown),
        });
      }
      continue;
    }

    if (room.status !== 'playing') continue;

    // Check for expired reconnection window (30s)
    let hasExpiredForfeit = false;
    for (const player of Object.values(room.players)) {
      if (!player.connected && player.disconnectedAt && (now - player.disconnectedAt > RECONNECT_GRACE_MS)) {
        const opponent = Object.values(room.players).find(p => p.role !== player.role);
        if (opponent) {
          checkWinCondition(room, opponent.role);
          broadcastToRoom(room, {
            type: 'forfeit_timeout',
            forfeitedUser: player.username,
            winnerRole: opponent.role,
            message: `${player.username} ne s'est pas reconnecté sous 30s. Victoire par forfait accordée!`,
          });
        }
        delete room.players[player.id];
        hasExpiredForfeit = true;
        break;
      }
    }
    if (hasExpiredForfeit) {
      broadcastRoomsList();
      continue;
    }

    const b = room.ball;
    const p1 = Object.values(room.players).find(p => p.role === 'player1');
    const p2 = Object.values(room.players).find(p => p.role === 'player2');

    if (!p1 || !p2) continue;

    // --- CYBER PONG SIMULATION ---
    if (room.gameType === 'pong') {
      b.x += b.vx;
      b.y += b.vy;

      // Bounce top & bottom
      if (b.y - b.radius <= 0) {
        b.y = b.radius;
        b.vy = Math.abs(b.vy);
      } else if (b.y + b.radius >= TABLE_HEIGHT) {
        b.y = TABLE_HEIGHT - b.radius;
        b.vy = -Math.abs(b.vy);
      }

      const paddleHeight = 90;
      const paddleWidth = 14;
      const p1X = 35;
      const p2X = TABLE_WIDTH - 35;

      // Check collision with Player 1 Paddle
      if (
        b.x - b.radius <= p1X + paddleWidth / 2 &&
        b.x + b.radius >= p1X - paddleWidth / 2 &&
        b.y >= p1.y - paddleHeight / 2 &&
        b.y <= p1.y + paddleHeight / 2 &&
        b.vx < 0
      ) {
        const offset = (b.y - p1.y) / (paddleHeight / 2); // -1 to 1
        const maxAngle = (Math.PI / 180) * 55;
        const angle = offset * maxAngle;
        b.speed = Math.min(13, b.speed + 0.35);
        b.vx = Math.cos(angle) * b.speed;
        b.vy = Math.sin(angle) * b.speed;
        b.x = p1X + paddleWidth / 2 + b.radius;
        room.lastTouch = 'player1';
        broadcastToRoom(room, { type: 'paddle_hit', side: 'left', y: b.y });
      }

      // Check collision with Player 2 Paddle
      if (
        b.x + b.radius >= p2X - paddleWidth / 2 &&
        b.x - b.radius <= p2X + paddleWidth / 2 &&
        b.y >= p2.y - paddleHeight / 2 &&
        b.y <= p2.y + paddleHeight / 2 &&
        b.vx > 0
      ) {
        const offset = (b.y - p2.y) / (paddleHeight / 2);
        const maxAngle = (Math.PI / 180) * 55;
        const angle = offset * maxAngle;
        b.speed = Math.min(13, b.speed + 0.35);
        b.vx = -Math.cos(angle) * b.speed;
        b.vy = Math.sin(angle) * b.speed;
        b.x = p2X - paddleWidth / 2 - b.radius;
        room.lastTouch = 'player2';
        broadcastToRoom(room, { type: 'paddle_hit', side: 'right', y: b.y });
      }

      // Goal Left (P2 scores)
      if (b.x < 0) {
        room.score2 += 1;
        checkWinCondition(room, 'player2');
        if (room.status === 'playing') {
          resetPuck(room, 'left');
          broadcastToRoom(room, { type: 'goal_scored', scorer: 'player2', score1: room.score1, score2: room.score2 });
        }
      }
      // Goal Right (P1 scores)
      else if (b.x > TABLE_WIDTH) {
        room.score1 += 1;
        checkWinCondition(room, 'player1');
        if (room.status === 'playing') {
          resetPuck(room, 'right');
          broadcastToRoom(room, { type: 'goal_scored', scorer: 'player1', score1: room.score1, score2: room.score2 });
        }
      }
    }

    // --- NEON AIR HOCKEY SIMULATION ---
    else if (room.gameType === 'hockey') {
      b.x += b.vx;
      b.y += b.vy;

      // Friction damping
      b.vx *= 0.993;
      b.vy *= 0.993;

      // Top and bottom rail bounce
      if (b.y - b.radius <= 10) {
        b.y = 10 + b.radius;
        b.vy = Math.abs(b.vy) * 0.95;
      } else if (b.y + b.radius >= TABLE_HEIGHT - 10) {
        b.y = TABLE_HEIGHT - 10 - b.radius;
        b.vy = -Math.abs(b.vy) * 0.95;
      }

      // Left rail bounce (except inside goal slot)
      if (b.x - b.radius <= 10) {
        if (b.y >= GOAL_TOP && b.y <= GOAL_BOTTOM) {
          // Goal for Player 2!
          if (b.x <= 0) {
            room.score2 += 1;
            checkWinCondition(room, 'player2');
            if (room.status === 'playing') {
              resetPuck(room, 'right');
              broadcastToRoom(room, { type: 'goal_scored', scorer: 'player2', score1: room.score1, score2: room.score2 });
            }
          }
        } else {
          b.x = 10 + b.radius;
          b.vx = Math.abs(b.vx) * 0.95;
        }
      }

      // Right rail bounce (except inside goal slot)
      if (b.x + b.radius >= TABLE_WIDTH - 10) {
        if (b.y >= GOAL_TOP && b.y <= GOAL_BOTTOM) {
          // Goal for Player 1!
          if (b.x >= TABLE_WIDTH) {
            room.score1 += 1;
            checkWinCondition(room, 'player1');
            if (room.status === 'playing') {
              resetPuck(room, 'left');
              broadcastToRoom(room, { type: 'goal_scored', scorer: 'player1', score1: room.score1, score2: room.score2 });
            }
          }
        } else {
          b.x = TABLE_WIDTH - 10 - b.radius;
          b.vx = -Math.abs(b.vx) * 0.95;
        }
      }

      // Mallet 1 Collision (Player 1 - Left)
      handleMalletCollision(b, p1, 'player1', room);

      // Mallet 2 Collision (Player 2 - Right)
      handleMalletCollision(b, p2, 'player2', room);
    }

    // Broadcast authoritative position tick
    broadcastToRoom(room, {
      type: 'game_tick',
      ball: room.ball,
      score1: room.score1,
      score2: room.score2,
      p1: { x: p1.x, y: p1.y },
      p2: { x: p2.x, y: p2.y },
    });
  }
}, 1000 / 60);

function handleMalletCollision(
  ball: Room['ball'],
  player: RoomPlayer,
  role: 'player1' | 'player2',
  room: Room
) {
  const malletRadius = 26;
  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const dist = Math.hypot(dx, dy);

  if (dist < ball.radius + malletRadius) {
    const angle = Math.atan2(dy, dx);
    const overlap = ball.radius + malletRadius - dist;

    // Push puck outside overlap
    ball.x += Math.cos(angle) * overlap;
    ball.y += Math.sin(angle) * overlap;

    // Elastic collision + player mallet impulse
    const baseImpact = 6.5;
    const playerSpeed = Math.hypot(player.vx, player.vy);
    const speed = Math.min(18, baseImpact + playerSpeed * 0.6);

    ball.vx = Math.cos(angle) * speed + player.vx * 0.4;
    ball.vy = Math.sin(angle) * speed + player.vy * 0.4;

    room.lastTouch = role;
    broadcastToRoom(room, {
      type: 'mallet_hit',
      side: role === 'player1' ? 'left' : 'right',
      x: ball.x,
      y: ball.y,
    });
  }
}

function checkWinCondition(room: Room, potentialWinnerRole: 'player1' | 'player2') {
  const target = room.maxScore;
  const score = potentialWinnerRole === 'player1' ? room.score1 : room.score2;

  if (score >= target) {
    room.status = 'gameover';
    room.winner = potentialWinnerRole;
    const p1 = Object.values(room.players).find(p => p.role === 'player1');
    const p2 = Object.values(room.players).find(p => p.role === 'player2');
    const winnerPlayer = potentialWinnerRole === 'player1' ? p1 : p2;
    room.winnerName = winnerPlayer?.username || (potentialWinnerRole === 'player1' ? 'Player 1' : 'Player 2');

    // Record Match into Global Match History
    const matchRecord: MatchHistoryEntry = {
      id: Math.random().toString(36).substring(2, 9),
      gameType: room.gameType,
      p1: p1?.username || 'Player 1',
      p2: p2?.username || 'Player 2',
      score1: room.score1,
      score2: room.score2,
      winner: room.winnerName,
      time: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    recentMatches.unshift(matchRecord);
    if (recentMatches.length > 30) recentMatches.pop();
    saveMatches();

    // Update Global Leaderboard for both players
    if (p1) updateLeaderboardUser(p1.username, p1.avatar, potentialWinnerRole === 'player1', room.score1);
    if (p2) updateLeaderboardUser(p2.username, p2.avatar, potentialWinnerRole === 'player2', room.score2);
    saveLeaderboard();

    broadcastToRoom(room, {
      type: 'game_over',
      winner: potentialWinnerRole,
      winnerName: room.winnerName,
      score1: room.score1,
      score2: room.score2,
    });
    broadcastRoomsList();
  }
}

function updateLeaderboardUser(username: string, avatar: string, won: boolean, goals: number) {
  const existing = leaderboard.get(username) || {
    username,
    avatar: avatar || '🎮',
    wins: 0,
    matches: 0,
    goals: 0,
    winrate: 0,
    lastActive: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  };

  existing.avatar = avatar || existing.avatar;
  existing.matches += 1;
  existing.goals += goals;
  if (won) existing.wins += 1;
  existing.winrate = Math.round((existing.wins / existing.matches) * 100);
  existing.lastActive = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  leaderboard.set(username, existing);
  saveLeaderboard();
}

// WebSocket Connection Handlers
wss.on('connection', (ws: WebSocket) => {
  const playerId = Math.random().toString(36).substring(2, 9);

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'list_rooms') {
        broadcastRoomsList();
      }

      // CREATE ROOM
      else if (msg.type === 'create_room') {
        const gameType = msg.gameType === 'pong' ? 'pong' : 'hockey';
        const roomId = (gameType === 'pong' ? 'PONG-' : 'AIR-') + Math.floor(100 + Math.random() * 900);
        const rawName = typeof msg.name === 'string' ? msg.name.trim().slice(0, 25) : '';
        const name = rawName || `Arène ${gameType === 'pong' ? 'Pong' : 'Hockey'}`;
        const maxScore = Math.max(1, Math.min(20, Math.floor(Number(msg.maxScore) || 5)));
        const username = typeof msg.username === 'string' && msg.username.trim() ? msg.username.trim().slice(0, 18) : 'Host Pilot';
        const avatar = typeof msg.avatar === 'string' && msg.avatar.trim() ? msg.avatar.slice(0, 4) : '🤖';
        const playerKey = typeof msg.playerKey === 'string' && msg.playerKey.trim() ? msg.playerKey.trim() : playerId;

        const newRoom: Room = {
          id: roomId,
          gameType,
          name,
          hostId: playerId,
          maxScore,
          players: {
            [playerId]: {
              id: playerId,
              playerKey,
              username,
              avatar,
              role: 'player1',
              ready: true,
              connected: true,
              x: gameType === 'pong' ? 35 : 120,
              y: TABLE_HEIGHT / 2,
              prevX: 120,
              prevY: TABLE_HEIGHT / 2,
              vx: 0,
              vy: 0,
            },
          },
          spectators: [],
          status: 'waiting',
          countdown: 3,
          score1: 0,
          score2: 0,
          ball: {
            x: TABLE_WIDTH / 2,
            y: TABLE_HEIGHT / 2,
            vx: 0,
            vy: 0,
            speed: 5,
            radius: gameType === 'pong' ? 9 : 14,
          },
          lastActive: Date.now(),
        };

        rooms.set(roomId, newRoom);
        socketToRoom.set(ws, { roomId, playerId });

        ws.send(JSON.stringify({
          type: 'room_joined',
          room: newRoom,
          role: 'player1',
          myId: playerId,
        }));

        broadcastRoomsList();
      }

      // JOIN ROOM OR RECONNECT TO ROOM
      else if (msg.type === 'join_room' || msg.type === 'reconnect_room') {
        const cleanRoomId = typeof msg.roomId === 'string' ? msg.roomId.trim().toUpperCase() : '';
        const room = rooms.get(cleanRoomId);
        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: 'Salon introuvable ou déjà expiré.' }));
          return;
        }

        const username = typeof msg.username === 'string' && msg.username.trim() ? msg.username.trim().slice(0, 18) : 'Challenger';
        const avatar = typeof msg.avatar === 'string' && msg.avatar.trim() ? msg.avatar.slice(0, 4) : '⚡';
        const playerKey = typeof msg.playerKey === 'string' && msg.playerKey.trim() ? msg.playerKey.trim() : '';

        // Check if an existing player is disconnected and can resume their exact seat!
        const existingDisconnectedPlayer = Object.values(room.players).find(
          p => (!p.connected && ((playerKey && p.playerKey === playerKey) || p.username === username))
        );

        if (existingDisconnectedPlayer) {
          // Re-bind the new socket to the preserved player
          const oldSocketId = existingDisconnectedPlayer.id;
          delete room.players[oldSocketId];

          existingDisconnectedPlayer.id = playerId;
          existingDisconnectedPlayer.connected = true;
          existingDisconnectedPlayer.disconnectedAt = undefined;
          room.players[playerId] = existingDisconnectedPlayer;

          room.lastActive = Date.now();
          socketToRoom.set(ws, { roomId: room.id, playerId });

          ws.send(JSON.stringify({
            type: 'room_reconnected',
            room,
            role: existingDisconnectedPlayer.role,
            myId: playerId,
          }));

          broadcastToRoom(room, {
            type: 'player_reconnected',
            room,
            playerId,
            username: existingDisconnectedPlayer.username,
            role: existingDisconnectedPlayer.role,
          });

          broadcastRoomsList();
          return;
        }

        const existingConnectedPlayers = Object.values(room.players).filter(p => p.connected);
        let assignedRole: 'player1' | 'player2' | 'spectator' = 'spectator';

        if (existingConnectedPlayers.length < 2) {
          assignedRole = 'player2';
          room.players[playerId] = {
            id: playerId,
            playerKey: playerKey || playerId,
            username,
            avatar,
            role: 'player2',
            ready: true,
            connected: true,
            x: room.gameType === 'pong' ? TABLE_WIDTH - 35 : TABLE_WIDTH - 120,
            y: TABLE_HEIGHT / 2,
            prevX: TABLE_WIDTH - 120,
            prevY: TABLE_HEIGHT / 2,
            vx: 0,
            vy: 0,
          };

          // If both players present and ready -> start countdown!
          if (Object.values(room.players).filter(p => p.connected).length === 2) {
            room.status = 'countdown';
            room.countdown = 3;
          }
        } else {
          room.spectators.push(playerId);
        }

        room.lastActive = Date.now();
        socketToRoom.set(ws, { roomId: room.id, playerId });

        ws.send(JSON.stringify({
          type: 'room_joined',
          room,
          role: assignedRole,
          myId: playerId,
        }));

        broadcastToRoom(room, { type: 'room_update', room });
        broadcastRoomsList();
      }

      // PADDLE / MALLET MOVEMENT
      else if (msg.type === 'move_paddle') {
        const info = socketToRoom.get(ws);
        if (!info) return;
        const room = rooms.get(info.roomId);
        if (!room) return;
        const player = room.players[info.playerId];
        if (!player || !player.connected) return;

        room.lastActive = Date.now();

        // Calculate velocity for impulse collisions
        const currentX = typeof msg.x === 'number' && !isNaN(msg.x) ? msg.x : player.x;
        const currentY = typeof msg.y === 'number' && !isNaN(msg.y) ? msg.y : player.y;

        player.vx = (currentX - player.prevX) * 0.8;
        player.vy = (currentY - player.prevY) * 0.8;
        player.prevX = currentX;
        player.prevY = currentY;

        if (room.gameType === 'pong') {
          player.y = Math.max(50, Math.min(TABLE_HEIGHT - 50, currentY));
        } else {
          // Hockey constraints
          if (player.role === 'player1') {
            player.x = Math.max(40, Math.min(TABLE_WIDTH / 2 - 40, currentX));
          } else {
            player.x = Math.max(TABLE_WIDTH / 2 + 40, Math.min(TABLE_WIDTH - 40, currentX));
          }
          player.y = Math.max(40, Math.min(TABLE_HEIGHT - 40, currentY));
        }
      }

      // PLAY AGAIN / REPLAY
      else if (msg.type === 'play_again') {
        const info = socketToRoom.get(ws);
        if (!info) return;
        const room = rooms.get(info.roomId);
        if (!room) return;

        room.score1 = 0;
        room.score2 = 0;
        room.status = 'countdown';
        room.countdown = 3;
        room.winner = undefined;
        room.winnerName = undefined;
        resetPuck(room, 'random');

        broadcastToRoom(room, { type: 'rematch_started', room });
        broadcastToRoom(room, { type: 'room_update', room });
        broadcastRoomsList();
      }

      // CHAT / QUICK EMOJI
      else if (msg.type === 'send_emoji') {
        const info = socketToRoom.get(ws);
        if (!info) return;
        const room = rooms.get(info.roomId);
        if (!room) return;
        const player = room.players[info.playerId];

        broadcastToRoom(room, {
          type: 'emoji_broadcast',
          sender: player?.username || 'Pilot',
          emoji: msg.emoji,
          role: player?.role || 'spectator',
        });
      }

      // LEAVE ROOM
      else if (msg.type === 'leave_room') {
        handleDisconnect(ws, true);
      }
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws, false);
  });

  ws.on('error', () => {
    handleDisconnect(ws, false);
  });
});

function handleDisconnect(ws: WebSocket, explicitLeave: boolean = false) {
  const info = socketToRoom.get(ws);
  if (!info) return;

  const room = rooms.get(info.roomId);
  socketToRoom.delete(ws);

  if (room) {
    const player = room.players[info.playerId];

    if (player) {
      // If the match is currently playing and wasn't an explicit voluntary leave:
      // Give a 30-second grace window to reconnect without destroying the game!
      if (!explicitLeave && (room.status === 'playing' || room.status === 'countdown')) {
        player.connected = false;
        player.disconnectedAt = Date.now();
        broadcastToRoom(room, {
          type: 'player_disconnected_grace',
          playerId: player.id,
          username: player.username,
          role: player.role,
          graceSeconds: 30,
        });
      } else {
        // Explicit exit or room in waiting/gameover: remove immediately
        delete room.players[info.playerId];
        if (Object.keys(room.players).length === 0) {
          rooms.delete(room.id);
        } else {
          if (room.status === 'playing') {
            // Forfeit win for the remaining player
            const remaining = Object.values(room.players)[0];
            if (remaining) {
              checkWinCondition(room, remaining.role);
            }
          } else {
            room.status = 'waiting';
            broadcastToRoom(room, { type: 'player_left', room });
          }
        }
      }
    } else {
      room.spectators = room.spectators.filter(id => id !== info.playerId);
    }

    broadcastRoomsList();
  }
}

// -------------------------------------------------------------
// VITE DEV SERVER / PRODUCTION STATIC SERVING
// -------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`[AI Studio] Server running on http://${HOST}:${PORT}`);
  });
}

startServer();
