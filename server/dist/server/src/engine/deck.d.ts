import { Card } from '../../../shared/types';
/**
 * Build a standard 108-card UNO deck:
 * - 1 zero per color (4 total)
 * - 2 of each 1-9 per color (72 total)
 * - 2 of each action (skip, reverse, draw2) per color (24 total)
 * - 4 wilds, 4 wild-draw4 (8 total)
 */
export declare function buildDeck(): Card[];
/**
 * Fisher-Yates shuffle — mutates and returns the array
 */
export declare function shuffle<T>(arr: T[]): T[];
/**
 * Draw N cards from the deck. If deck runs out, reshuffle the discard pile
 * (keeping the top card) back into the deck.
 */
export declare function drawCards(deck: Card[], discardPile: Card[], count: number): {
    drawn: Card[];
    deck: Card[];
    discardPile: Card[];
};
/**
 * Find a valid starting card from the deck (not a wild-draw4)
 */
export declare function findStartingCard(deck: Card[]): {
    card: Card;
    deck: Card[];
};
//# sourceMappingURL=deck.d.ts.map