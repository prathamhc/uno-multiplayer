import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { GameState, Player, Card, CardColor, GameEvent } from '../../../shared/types';
import { createGameState, redactState, createRoomPublicState } from '../engine/game';
import { canPlay, applyCard, advanceTurn, hasPlayableCard } from '../engine/rules';
import { drawCards } from '../engine/deck';

// ─── In-Memory Room Store ──────────────────────────────────
interface RoomData {
  code: string;
  hostId: string;
  maxPlayers: number;
  state: GameState | null;
  players: { userId: string; nickname: string; socketId: string; isReady: boolean }[];
  createdAt: number;
}

const rooms = new Map<string, RoomData>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  // Ensure uniqueness
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

// ─── Socket Event Registration ─────────────────────────────
export function registerSocketEvents(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    const userId = (socket.handshake.auth?.userId as string) || uuidv4();
    const nickname = (socket.handshake.auth?.nickname as string) || 'Player';

    socket.data.userId = userId;
    socket.data.nickname = nickname;

    // ─── ROOM: CREATE ─────────────────────────────────
    socket.on('room:create', (data: { maxPlayers?: number }, callback: Function) => {
      const code = generateRoomCode();
      const room: RoomData = {
        code,
        hostId: userId,
        maxPlayers: data.maxPlayers || 4,
        state: null,
        players: [{ userId, nickname, socketId: socket.id, isReady: false }],
        createdAt: Date.now(),
      };
      rooms.set(code, room);
      socket.join(code);
      callback({ success: true, code });
      broadcastRoomUpdate(io, code);
      console.log(`[Room] Created: ${code} by ${nickname}`);
    });

    // ─── ROOM: JOIN ───────────────────────────────────
    socket.on('room:join', (data: { code: string }, callback: Function) => {
      const code = data.code.toUpperCase();
      const room = rooms.get(code);

      if (!room) {
        callback({ success: false, error: 'Room not found' });
        return;
      }
      if (room.state && room.state.phase === 'playing') {
        callback({ success: false, error: 'Game already in progress' });
        return;
      }
      if (room.players.length >= room.maxPlayers) {
        callback({ success: false, error: 'Room is full' });
        return;
      }
      if (room.players.some(p => p.userId === userId)) {
        // Rejoin — update socketId
        const player = room.players.find(p => p.userId === userId)!;
        player.socketId = socket.id;
      } else {
        room.players.push({ userId, nickname, socketId: socket.id, isReady: false });
      }
      socket.join(code);
      callback({ success: true, code });
      broadcastRoomUpdate(io, code);
      console.log(`[Room] ${nickname} joined ${code}`);
    });

    // ─── ROOM: READY ──────────────────────────────────
    socket.on('room:ready', (data: { code: string }) => {
      const room = rooms.get(data.code);
      if (!room) return;
      const player = room.players.find(p => p.userId === userId);
      if (player) {
        player.isReady = !player.isReady;
        broadcastRoomUpdate(io, data.code);
      }
    });

    // ─── ROOM: START GAME ─────────────────────────────
    socket.on('room:start', (data: { code: string }, callback: Function) => {
      const room = rooms.get(data.code);
      if (!room) {
        callback({ success: false, error: 'Room not found' });
        return;
      }
      if (room.hostId !== userId) {
        callback({ success: false, error: 'Only the host can start the game' });
        return;
      }
      if (room.players.length < 2) {
        callback({ success: false, error: 'Need at least 2 players' });
        return;
      }
      if (!room.players.every(p => p.isReady)) {
        callback({ success: false, error: 'Not all players are ready' });
        return;
      }

      // Create game state
      const gamePlayers: Player[] = room.players.map(p => ({
        userId: p.userId,
        nickname: p.nickname,
        socketId: p.socketId,
        hand: [],
        isReady: true,
        saidUno: false,
      }));

      room.state = createGameState(data.code, gamePlayers);
      callback({ success: true });
      broadcastGameState(io, data.code, room.state);

      // Send game event
      const event: GameEvent = {
        type: 'card-played',
        by: 'System',
        message: 'Game started! Good luck!',
      };
      io.to(data.code).emit('game:event', event);
      console.log(`[Game] Started in room ${data.code}`);
    });

    // ─── GAME: PLAY CARD ──────────────────────────────
    socket.on('game:play-card', (data: { code: string; cardId: string; chosenColor?: CardColor }, callback: Function) => {
      const room = rooms.get(data.code);
      if (!room || !room.state) {
        callback({ success: false, error: 'Game not found' });
        return;
      }

      const state = room.state;
      if (state.phase !== 'playing') {
        callback({ success: false, error: 'Game is not in progress' });
        return;
      }

      const currentPlayer = state.players[state.currentPlayerIndex];
      if (currentPlayer.userId !== userId) {
        callback({ success: false, error: 'Not your turn' });
        return;
      }

      const cardIndex = currentPlayer.hand.findIndex(c => c.id === data.cardId);
      if (cardIndex === -1) {
        callback({ success: false, error: 'Card not in your hand' });
        return;
      }

      const card = currentPlayer.hand[cardIndex];
      const topCard = state.discardPile[0];

      // If there's a draw stack, player must draw or stack
      if (state.drawStack > 0 && !canPlay(card, topCard, state.chosenColor, state.drawStack)) {
        callback({ success: false, error: 'Must draw cards or stack a matching draw card' });
        return;
      }

      if (state.drawStack === 0 && !canPlay(card, topCard, state.chosenColor)) {
        callback({ success: false, error: 'Cannot play this card' });
        return;
      }

      // Wild card requires color choice
      if (card.color === 'wild' && !data.chosenColor) {
        callback({ success: false, error: 'Must choose a color for wild card' });
        return;
      }

      // Remove card from hand
      currentPlayer.hand.splice(cardIndex, 1);

      // Reset UNO state
      currentPlayer.saidUno = false;

      // Apply card effect
      const newState = applyCard(state, card, data.chosenColor);
      newState.players = state.players; // keep reference to same players array since applyCard deep-copies

      // Copy the newState properties back
      room.state.discardPile = newState.discardPile;
      room.state.chosenColor = newState.chosenColor;
      room.state.direction = newState.direction;
      room.state.drawStack = newState.drawStack;
      room.state.currentPlayerIndex = newState.currentPlayerIndex;
      room.state.turnStartedAt = newState.turnStartedAt;

      // Handle draw stack: if next player can't stack, force them to draw
      if (room.state.drawStack > 0) {
        const nextPlayer = room.state.players[room.state.currentPlayerIndex];
        const nextTopCard = room.state.discardPile[0];
        const canStack = nextPlayer.hand.some(c =>
          canPlay(c, nextTopCard, room.state!.chosenColor, room.state!.drawStack)
        );
        if (!canStack) {
          // Force draw
          const result = drawCards(room.state.deck, room.state.discardPile, room.state.drawStack);
          nextPlayer.hand.push(...result.drawn);
          room.state.deck = result.deck;
          room.state.discardPile = result.discardPile;
          room.state.drawStack = 0;
          advanceTurn(room.state);

          const drawEvent: GameEvent = {
            type: 'drew',
            by: nextPlayer.nickname,
            message: `${nextPlayer.nickname} drew ${result.drawn.length} cards!`,
          };
          io.to(data.code).emit('game:event', drawEvent);
        }
      }

      // Check for win
      if (currentPlayer.hand.length === 0) {
        room.state.phase = 'finished';
        room.state.winner = currentPlayer.nickname;
        const winEvent: GameEvent = {
          type: 'win',
          by: currentPlayer.nickname,
          message: `${currentPlayer.nickname} wins the game! 🎉`,
        };
        io.to(data.code).emit('game:event', winEvent);
      }

      callback({ success: true });

      // Broadcast card played event
      const playEvent: GameEvent = {
        type: 'card-played',
        by: currentPlayer.nickname,
        card,
        message: `${currentPlayer.nickname} played ${formatCard(card)}`,
      };
      io.to(data.code).emit('game:event', playEvent);

      broadcastGameState(io, data.code, room.state);
    });

    // ─── GAME: DRAW CARD ──────────────────────────────
    socket.on('game:draw-card', (data: { code: string }, callback: Function) => {
      const room = rooms.get(data.code);
      if (!room || !room.state) {
        callback({ success: false, error: 'Game not found' });
        return;
      }

      const state = room.state;
      const currentPlayer = state.players[state.currentPlayerIndex];
      if (currentPlayer.userId !== userId) {
        callback({ success: false, error: 'Not your turn' });
        return;
      }

      // Draw count — if draw stack exists, draw that many; else draw 1
      const drawCount = state.drawStack > 0 ? state.drawStack : 1;
      const result = drawCards(state.deck, state.discardPile, drawCount);
      currentPlayer.hand.push(...result.drawn);
      state.deck = result.deck;
      state.discardPile = result.discardPile;
      state.drawStack = 0;

      // If drew 1 card voluntarily and it can be played, mark turn as still active (but let client choose)
      // For simplicity: advance turn after drawing
      advanceTurn(state);

      callback({ success: true, drewCount: result.drawn.length });

      const event: GameEvent = {
        type: 'drew',
        by: currentPlayer.nickname,
        message: `${currentPlayer.nickname} drew ${result.drawn.length} card${result.drawn.length > 1 ? 's' : ''}`,
      };
      io.to(data.code).emit('game:event', event);

      broadcastGameState(io, data.code, state);
    });

    // ─── GAME: SAY UNO ────────────────────────────────
    socket.on('game:say-uno', (data: { code: string }) => {
      const room = rooms.get(data.code);
      if (!room || !room.state) return;

      const player = room.state.players.find(p => p.userId === userId);
      if (!player) return;

      if (player.hand.length <= 2) {
        player.saidUno = true;
        player.unoDeadline = undefined;

        const event: GameEvent = {
          type: 'uno-call',
          by: player.nickname,
          message: `${player.nickname} called UNO! 🔴`,
        };
        io.to(data.code).emit('game:event', event);
        broadcastGameState(io, data.code, room.state);
      }
    });

    // ─── GAME: CHALLENGE UNO ──────────────────────────
    socket.on('game:challenge-uno', (data: { code: string; targetUserId: string }) => {
      const room = rooms.get(data.code);
      if (!room || !room.state) return;

      const target = room.state.players.find(p => p.userId === data.targetUserId);
      if (!target) return;

      // Challenge: if target has 1 card and didn't say UNO, they draw 2
      if (target.hand.length === 1 && !target.saidUno) {
        const result = drawCards(room.state.deck, room.state.discardPile, 2);
        target.hand.push(...result.drawn);
        room.state.deck = result.deck;
        room.state.discardPile = result.discardPile;

        const challenger = room.state.players.find(p => p.userId === userId);
        const event: GameEvent = {
          type: 'uno-penalty',
          by: target.nickname,
          message: `${target.nickname} forgot to say UNO! Drew 2 penalty cards! (Challenged by ${challenger?.nickname || 'someone'})`,
        };
        io.to(data.code).emit('game:event', event);
        broadcastGameState(io, data.code, room.state);
      }
    });

    // ─── ROOM: LEAVE ──────────────────────────────────
    socket.on('room:leave', (data: { code: string }) => {
      handlePlayerLeave(io, socket, data.code, userId);
    });

    // ─── DISCONNECT ───────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
      // Find and handle rooms this user was in
      for (const [code, room] of rooms) {
        if (room.players.some(p => p.userId === userId)) {
          handlePlayerLeave(io, socket, code, userId);
        }
      }
    });
  });
}

// ─── Helpers ───────────────────────────────────────────────

function broadcastRoomUpdate(io: Server, code: string): void {
  const room = rooms.get(code);
  if (!room) return;
  io.to(code).emit('room:updated', {
    code: room.code,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    players: room.players.map(p => ({
      userId: p.userId,
      nickname: p.nickname,
      isReady: p.isReady,
    })),
    phase: room.state?.phase ?? 'waiting',
  });
}

function broadcastGameState(io: Server, code: string, state: GameState): void {
  const room = rooms.get(code);
  if (!room) return;
  // Send redacted state to each player
  for (const player of state.players) {
    const redacted = redactState(state, player.socketId);
    io.to(player.socketId).emit('game:state', redacted);
  }
}

function handlePlayerLeave(io: Server, socket: Socket, code: string, leavingUserId: string): void {
  const room = rooms.get(code);
  if (!room) return;

  socket.leave(code);

  if (room.state && room.state.phase === 'playing') {
    // Remove player from game
    const playerIdx = room.state.players.findIndex(p => p.userId === leavingUserId);
    if (playerIdx !== -1) {
      const removedPlayer = room.state.players[playerIdx];
      room.state.players.splice(playerIdx, 1);

      // Adjust currentPlayerIndex
      if (room.state.players.length <= 1) {
        room.state.phase = 'finished';
        room.state.winner = room.state.players[0]?.nickname ?? 'Nobody';
        io.to(code).emit('game:event', {
          type: 'win',
          by: room.state.winner,
          message: `${removedPlayer.nickname} left. ${room.state.winner} wins!`,
        } as GameEvent);
      } else if (playerIdx <= room.state.currentPlayerIndex) {
        room.state.currentPlayerIndex = room.state.currentPlayerIndex % room.state.players.length;
      }
    }
    broadcastGameState(io, code, room.state);
  }

  // Remove from room players list
  room.players = room.players.filter(p => p.userId !== leavingUserId);

  if (room.players.length === 0) {
    rooms.delete(code);
    console.log(`[Room] Deleted empty room: ${code}`);
  } else {
    // Transfer host if needed
    if (room.hostId === leavingUserId) {
      room.hostId = room.players[0].userId;
    }
    broadcastRoomUpdate(io, code);
  }
}

function formatCard(card: Card): string {
  if (card.value === 'wild') return '🌈 Wild';
  if (card.value === 'wild-draw4') return '🌈 Wild +4';
  const colorEmoji: Record<string, string> = { red: '🔴', yellow: '🟡', green: '🟢', blue: '🔵' };
  const emoji = colorEmoji[card.color] || '';
  const valueMap: Record<string, string> = {
    skip: '🚫 Skip',
    reverse: '🔄 Reverse',
    draw2: '+2',
  };
  return `${emoji} ${card.color} ${valueMap[card.value] || card.value}`;
}
