import {
  GameState,
  GameStatePublic,
  Player,
  PublicPlayer,
  Card,
  RoomPublicState,
} from '../../../shared/types';
import { buildDeck, drawCards, findStartingCard } from './deck';
import { applyCard } from './rules';

const CARDS_PER_PLAYER = 7;

/**
 * Create a fresh game state from the list of players in a room
 */
export function createGameState(roomId: string, players: Player[]): GameState {
  let deck = buildDeck();

  // Deal cards to each player
  for (const player of players) {
    const result = drawCards(deck, [], CARDS_PER_PLAYER);
    player.hand = result.drawn;
    deck = result.deck;
    player.saidUno = false;
  }

  // Find a valid starting card
  const { card: startingCard, deck: remainingDeck } = findStartingCard(deck);

  const state: GameState = {
    roomId,
    phase: 'playing',
    players,
    deck: remainingDeck,
    discardPile: [startingCard],
    currentPlayerIndex: 0,
    direction: 'clockwise',
    drawStack: 0,
    turnStartedAt: Date.now(),
  };

  // If starting card is an action card, apply its effect
  if (['skip', 'reverse', 'draw2'].includes(startingCard.value)) {
    // For the starting card, simulate it being "played" by a virtual player
    if (startingCard.value === 'reverse') {
      state.direction = 'counter-clockwise';
    } else if (startingCard.value === 'skip') {
      // Skip first player
      const n = state.players.length;
      state.currentPlayerIndex = 1 % n;
    } else if (startingCard.value === 'draw2') {
      // First player draws 2
      state.drawStack = 2;
    }
  }

  return state;
}

/**
 * Redact the game state for a specific socket — hide other players' hands
 */
export function redactState(state: GameState, socketId: string): GameStatePublic {
  const myIndex = state.players.findIndex(p => p.socketId === socketId);
  const myHand = myIndex >= 0 ? state.players[myIndex].hand : [];

  const players: PublicPlayer[] = state.players.map((p, i) => ({
    userId: p.userId,
    nickname: p.nickname,
    cardCount: p.hand.length,
    isReady: p.isReady,
    isCurrentTurn: i === state.currentPlayerIndex,
    saidUno: p.saidUno,
  }));

  return {
    roomId: state.roomId,
    phase: state.phase,
    players,
    myHand,
    topCard: state.discardPile.length > 0 ? state.discardPile[0] : null,
    discardPileCount: state.discardPile.length,
    deckCount: state.deck.length,
    currentPlayerIndex: state.currentPlayerIndex,
    direction: state.direction,
    drawStack: state.drawStack,
    chosenColor: state.chosenColor,
    winner: state.winner,
    myIndex,
  };
}

/**
 * Create a public room state from a room document
 */
export function createRoomPublicState(room: any): RoomPublicState {
  const state = room.state as GameState | undefined;
  return {
    code: room.code,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    players: state
      ? state.players.map((p: Player) => ({
          userId: p.userId,
          nickname: p.nickname,
          isReady: p.isReady,
        }))
      : [],
    phase: state?.phase ?? 'waiting',
  };
}
