import { Card, CardColor, GameState } from '../../../shared/types';
/**
 * Can a card be played on top of the current discard pile?
 * - Wild cards can always be played
 * - Otherwise: match the active color OR match the value
 */
export declare function canPlay(card: Card, topCard: Card, chosenColor?: CardColor, drawStack?: number): boolean;
/**
 * Apply a card's effect to the game state.
 * Returns the new state (does not mutate original).
 */
export declare function applyCard(state: GameState, card: Card, chosenColor?: CardColor): GameState;
/**
 * Advance to the next player in the current direction
 */
export declare function advanceTurn(s: GameState): void;
/**
 * Check if the current player has any playable cards
 */
export declare function hasPlayableCard(state: GameState): boolean;
//# sourceMappingURL=rules.d.ts.map