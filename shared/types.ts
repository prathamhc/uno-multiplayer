// ─── Card Types ────────────────────────────────────────────
export type CardColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild';
export type CardValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw2'
  | 'wild' | 'wild-draw4';

export interface Card {
  id: string;
  color: CardColor;
  value: CardValue;
}

// ─── Player ────────────────────────────────────────────────
export interface Player {
  userId: string;
  nickname: string;
  socketId: string;
  hand: Card[];
  isReady: boolean;
  saidUno: boolean;
  unoDeadline?: number; // timestamp when uno window expires
}

// ─── Game State ────────────────────────────────────────────
export type GamePhase = 'waiting' | 'playing' | 'finished';
export type Direction = 'clockwise' | 'counter-clockwise';

export interface GameState {
  roomId: string;
  phase: GamePhase;
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  currentPlayerIndex: number;
  direction: Direction;
  drawStack: number;
  chosenColor?: CardColor;
  winner?: string;
  turnStartedAt?: number;
}

// ─── Public (redacted) types sent to clients ───────────────
export interface PublicPlayer {
  userId: string;
  nickname: string;
  cardCount: number;
  isReady: boolean;
  isCurrentTurn: boolean;
  saidUno: boolean;
}

export interface GameStatePublic {
  roomId: string;
  phase: GamePhase;
  players: PublicPlayer[];
  myHand: Card[];
  topCard: Card | null;
  discardPileCount: number;
  deckCount: number;
  currentPlayerIndex: number;
  direction: Direction;
  drawStack: number;
  chosenColor?: CardColor;
  winner?: string;
  myIndex: number;
}

export interface RoomPublicState {
  code: string;
  hostId: string;
  maxPlayers: number;
  players: { userId: string; nickname: string; isReady: boolean }[];
  phase: GamePhase;
}

// ─── Socket Event Payloads ─────────────────────────────────
export interface GameEvent {
  type: 'card-played' | 'drew' | 'uno-call' | 'uno-penalty' | 'challenge-uno' | 'win' | 'turn-skip';
  by: string;
  card?: Card;
  message?: string;
}
