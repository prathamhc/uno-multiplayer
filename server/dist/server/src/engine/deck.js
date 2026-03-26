"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDeck = buildDeck;
exports.shuffle = shuffle;
exports.drawCards = drawCards;
exports.findStartingCard = findStartingCard;
const uuid_1 = require("uuid");
const COLORS = ['red', 'yellow', 'green', 'blue'];
const NUMBER_VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const ACTION_VALUES = ['skip', 'reverse', 'draw2'];
function makeCard(color, value) {
    return { id: (0, uuid_1.v4)(), color, value };
}
/**
 * Build a standard 108-card UNO deck:
 * - 1 zero per color (4 total)
 * - 2 of each 1-9 per color (72 total)
 * - 2 of each action (skip, reverse, draw2) per color (24 total)
 * - 4 wilds, 4 wild-draw4 (8 total)
 */
function buildDeck() {
    const cards = [];
    for (const color of COLORS) {
        // One zero per color
        cards.push(makeCard(color, '0'));
        // Two of each 1-9 and action cards
        const repeatedValues = [...NUMBER_VALUES.slice(1), ...ACTION_VALUES];
        for (const v of repeatedValues) {
            cards.push(makeCard(color, v));
            cards.push(makeCard(color, v));
        }
    }
    // 4 wilds and 4 wild-draw4s
    for (let i = 0; i < 4; i++) {
        cards.push(makeCard('wild', 'wild'));
        cards.push(makeCard('wild', 'wild-draw4'));
    }
    return shuffle(cards);
}
/**
 * Fisher-Yates shuffle — mutates and returns the array
 */
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
/**
 * Draw N cards from the deck. If deck runs out, reshuffle the discard pile
 * (keeping the top card) back into the deck.
 */
function drawCards(deck, discardPile, count) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
        if (deck.length === 0) {
            // Reshuffle discard pile (keep top card)
            if (discardPile.length <= 1)
                break; // can't draw anymore
            const topCard = discardPile[0];
            const reshuffled = shuffle(discardPile.slice(1));
            // Reset wild card colors when reshuffled back into deck
            for (const card of reshuffled) {
                if (card.value === 'wild' || card.value === 'wild-draw4') {
                    card.color = 'wild';
                }
            }
            deck = reshuffled;
            discardPile = [topCard];
        }
        const card = deck.pop();
        if (card)
            drawn.push(card);
    }
    return { drawn, deck, discardPile };
}
/**
 * Find a valid starting card from the deck (not a wild-draw4)
 */
function findStartingCard(deck) {
    // Find first non-wild-draw4 card
    const idx = deck.findIndex(c => c.value !== 'wild-draw4');
    if (idx === -1) {
        // Extremely unlikely — just use the top card
        return { card: deck.pop(), deck };
    }
    const [card] = deck.splice(idx, 1);
    return { card, deck };
}
//# sourceMappingURL=deck.js.map