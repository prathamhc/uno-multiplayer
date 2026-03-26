"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canPlay = canPlay;
exports.applyCard = applyCard;
exports.advanceTurn = advanceTurn;
exports.hasPlayableCard = hasPlayableCard;
/**
 * Can a card be played on top of the current discard pile?
 * - Wild cards can always be played
 * - Otherwise: match the active color OR match the value
 */
function canPlay(card, topCard, chosenColor, drawStack) {
    // If there's an active draw stack, only draw2/wild-draw4 can be stacked
    if (drawStack && drawStack > 0) {
        if (topCard.value === 'draw2') {
            return card.value === 'draw2'; // can stack draw2 on draw2
        }
        if (topCard.value === 'wild-draw4') {
            return card.value === 'wild-draw4'; // can stack wd4 on wd4
        }
    }
    // Wild cards can always be played (when no draw stack)
    if (card.color === 'wild')
        return true;
    // Match active color or value
    const activeColor = chosenColor ?? topCard.color;
    return card.color === activeColor || card.value === topCard.value;
}
/**
 * Apply a card's effect to the game state.
 * Returns the new state (does not mutate original).
 */
function applyCard(state, card, chosenColor) {
    const s = JSON.parse(JSON.stringify(state));
    // Put card on discard pile
    s.discardPile.unshift(card);
    // Handle wild color choice
    s.chosenColor = card.color === 'wild' ? chosenColor : undefined;
    switch (card.value) {
        case 'reverse':
            s.direction = s.direction === 'clockwise' ? 'counter-clockwise' : 'clockwise';
            // In 2-player, reverse acts as skip
            if (s.players.length === 2) {
                advanceTurn(s);
            }
            break;
        case 'skip':
            advanceTurn(s); // skip one extra turn
            break;
        case 'draw2':
            s.drawStack += 2;
            break;
        case 'wild-draw4':
            s.drawStack += 4;
            break;
    }
    // Move to next player
    advanceTurn(s);
    return s;
}
/**
 * Advance to the next player in the current direction
 */
function advanceTurn(s) {
    const n = s.players.length;
    const step = s.direction === 'clockwise' ? 1 : n - 1;
    s.currentPlayerIndex = (s.currentPlayerIndex + step) % n;
    s.turnStartedAt = Date.now();
}
/**
 * Check if the current player has any playable cards
 */
function hasPlayableCard(state) {
    const player = state.players[state.currentPlayerIndex];
    const topCard = state.discardPile[0];
    return player.hand.some(card => canPlay(card, topCard, state.chosenColor, state.drawStack));
}
//# sourceMappingURL=rules.js.map